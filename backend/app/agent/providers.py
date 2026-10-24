"""LLM providers behind one interface, so a run can fail over between them mid-conversation.

History is provider-neutral: ("user", text) | ("assistant", Turn) | ("results", [(ToolCall, ToolResult)]).
Each provider renders it into its own wire format. A provider replays its OWN earlier turns verbatim (Gemini thought
signatures, Anthropic content blocks); turns from other providers are rendered from the neutral form. Failover only
moves forward, so a provider never has to replay another provider's turn as if it were its own.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

from ..config import claude_credentials_present, gemini_api_key, settings
from ..tools.registry import anthropic_tool_definitions, gemini_tool_definitions, openai_tool_definitions
from .llm import ClaudeClient, GeminiClient, LLMError, OpenAICompatClient


@dataclass
class ToolCall:
    id: str
    name: str
    args: dict[str, Any]


@dataclass
class Turn:
    provider: str
    model: str
    text: str
    calls: list[ToolCall] = field(default_factory=list)
    raw: Any = None


def _get(block: Any, key: str) -> Any:
    return block.get(key) if isinstance(block, dict) else getattr(block, key, None)


def _result_json(res: Any) -> str:
    return json.dumps(res.to_dict(), default=str)


def _is_error(res: Any) -> bool:
    return res.status in {"error", "invalid_args"}


class ClaudeProvider:
    name = "claude"

    def __init__(self, client: ClaudeClient | None = None):
        self.client = client or ClaudeClient()
        self.model = self.client.model

    def complete(self, system: str, history: list) -> Turn:
        messages: list[dict] = []
        for kind, item in history:
            if kind == "user":
                messages.append({"role": "user", "content": item})
            elif kind == "assistant":
                content = item.raw if item.provider == self.name else (
                    ([{"type": "text", "text": item.text}] if item.text else [])
                    + [{"type": "tool_use", "id": c.id, "name": c.name, "input": c.args} for c in item.calls])
                messages.append({"role": "assistant", "content": content})
            else:  # all tool results in ONE user message
                messages.append({"role": "user", "content": [
                    {"type": "tool_result", "tool_use_id": call.id, "content": _result_json(res),
                     **({"is_error": True} if _is_error(res) else {})} for call, res in item]})
        response = self.client.create(system=system, messages=messages, tools=anthropic_tool_definitions())
        content = list(_get(response, "content") or [])
        text = " ".join(_get(b, "text") or "" for b in content if _get(b, "type") == "text").strip()
        calls = [ToolCall(_get(b, "id"), _get(b, "name"), dict(_get(b, "input") or {}))
                 for b in content if _get(b, "type") == "tool_use"]
        return Turn(self.name, self.model, text, calls if _get(response, "stop_reason") == "tool_use" else [], content)


class GeminiProvider:
    name = "gemini"

    def __init__(self, client: GeminiClient | None = None):
        self.client = client or GeminiClient()
        self.model = self.client.model
        self._n = 0

    def complete(self, system: str, history: list) -> Turn:
        contents: list[dict] = []
        for kind, item in history:
            if kind == "user":
                contents.append({"role": "user", "parts": [{"text": item}]})
            elif kind == "assistant":
                contents.append(item.raw if item.provider == self.name else {"role": "model", "parts": (
                    ([{"text": item.text}] if item.text else [])
                    + [{"functionCall": {"id": c.id, "name": c.name, "args": c.args}} for c in item.calls])})
            else:
                contents.append({"role": "user", "parts": [
                    {"functionResponse": {**({} if call.id.startswith("gemini-") else {"id": call.id}),
                                          "name": call.name, "response": res.to_dict()}} for call, res in item]})
        candidate = self.client.create(system=system, contents=contents, tools=gemini_tool_definitions())
        content = candidate.get("content") or {"role": "model", "parts": []}
        parts = content.get("parts") or []
        calls = []
        for p in parts:
            fc = p.get("functionCall")
            if fc:
                self._n += 1
                calls.append(ToolCall(fc.get("id") or f"gemini-{self._n}", fc["name"], dict(fc.get("args") or {})))
        text = " ".join(p["text"] for p in parts if p.get("text") and not p.get("thought")).strip()
        return Turn(self.name, self.model, text, calls, content)


class OpenAICompatProvider:
    def __init__(self, client: OpenAICompatClient):
        self.client = client
        self.name, self.model = client.name, client.model

    def complete(self, system: str, history: list) -> Turn:
        messages: list[dict] = [{"role": "system", "content": system}]
        for kind, item in history:
            if kind == "user":
                messages.append({"role": "user", "content": item})
            elif kind == "assistant":
                msg: dict = {"role": "assistant", "content": item.text or ""}
                if item.calls:
                    msg["tool_calls"] = [{"id": c.id, "type": "function",
                                          "function": {"name": c.name, "arguments": json.dumps(c.args)}}
                                         for c in item.calls]
                messages.append(msg)
            else:
                messages += [{"role": "tool", "tool_call_id": call.id, "content": _result_json(res)}
                             for call, res in item]
        message = self.client.create(messages=messages, tools=openai_tool_definitions())
        calls = []
        for i, tc in enumerate(message.get("tool_calls") or []):
            fn = tc.get("function") or {}
            raw_args = fn.get("arguments") or "{}"
            try:
                args = json.loads(raw_args) if isinstance(raw_args, str) else dict(raw_args)
            except json.JSONDecodeError:
                args = {"_unparseable_arguments": raw_args}  # rejected by validation as invalid_args
            calls.append(ToolCall(tc.get("id") or f"{self.name}-{i}", fn.get("name", ""), args))
        return Turn(self.name, self.model, (message.get("content") or "").strip(), calls, message)


OPENAI_COMPAT = {
    # name: (base_url, api-key env var or None, model setting attribute)
    "groq": ("https://api.groq.com/openai/v1", "groq_api_key", "groq_model"),
    "cerebras": ("https://api.cerebras.ai/v1", "cerebras_api_key", "cerebras_model"),
    "ollama": (None, None, "ollama_model"),
}


def provider_configured(name: str) -> bool:
    if name == "claude":
        return claude_credentials_present()
    if name == "gemini":
        return bool(gemini_api_key())
    if name == "ollama":
        return bool(settings.ollama_model)
    if name in OPENAI_COMPAT:
        return bool(getattr(settings, OPENAI_COMPAT[name][1]))
    return False


def build_provider(name: str):
    if name == "claude":
        return ClaudeProvider()
    if name == "gemini":
        return GeminiProvider()
    base, key_attr, model_attr = OPENAI_COMPAT[name]
    return OpenAICompatProvider(OpenAICompatClient(
        name=name, base_url=base or settings.ollama_base_url, model=getattr(settings, model_attr),
        api_key=getattr(settings, key_attr) if key_attr else "",
        timeout_s=settings.ollama_timeout_s if name == "ollama" else settings.gemini_timeout_s))


def configured_chain() -> list[str]:
    return [n for n in settings.llm_providers if provider_configured(n)]


def build_chain() -> list:
    names = configured_chain()
    if not names:
        raise LLMError("missing_credentials", "No LLM provider is configured. Set a key in .env (see LLM_PROVIDERS).")
    return [build_provider(n) for n in names]


def chain_label(names: list[str] | None = None) -> str:
    names = configured_chain() if names is None else names
    return " → ".join(f"{n}:{model_of(n)}" for n in names)


def model_of(name: str) -> str:
    return {"claude": settings.anthropic_model, "gemini": settings.gemini_model, "groq": settings.groq_model,
            "cerebras": settings.cerebras_model, "ollama": settings.ollama_model}.get(name, "?")
