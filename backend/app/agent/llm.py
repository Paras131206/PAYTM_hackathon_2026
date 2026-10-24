"""LLM provider clients (Gemini REST, OpenAI-compatible for Groq and Ollama). All provider HTTP lives here.

Failures are raised as LLMError. There is no fallback to fabricated output: a failed call fails the run.
"""
from __future__ import annotations

import time
from typing import Any

import httpx

from ..config import gemini_api_key, settings


class LLMError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


# ---------------------------------------------------------------------------------------------------- Gemini
# REST (generateContent) via httpx: the google-genai SDK could not be installed from this network, and the REST
# surface needs no extra dependency. The key goes in the x-goog-api-key header, never in the URL.
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
_GEMINI_BLOCKED = {"SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION", "IMAGE_SAFETY"}


class GeminiClient:
    def __init__(self, http: httpx.Client | None = None, api_key: str | None = None):
        key = api_key if api_key is not None else gemini_api_key()
        if not key:
            raise LLMError("missing_credentials",
                           "GEMINI_API_KEY is not set. Set it in .env or choose another engine.")
        self._key = key
        self._http = http or httpx.Client(timeout=settings.gemini_timeout_s)
        self.model = settings.gemini_model

    def create(self, *, system: str, contents: list[dict], tools: list[dict]) -> dict:
        body = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": contents,
            "tools": tools,
            "toolConfig": {"functionCallingConfig": {"mode": "AUTO"}},
        }
        url = GEMINI_URL.format(model=self.model)
        attempts = 4
        for attempt in range(attempts):  # retry 429/5xx; free-tier 429s say how long to wait
            try:
                r = self._http.post(url, json=body, headers={"x-goog-api-key": self._key})
            except httpx.TimeoutException as e:
                raise LLMError("timeout", "The Gemini request timed out.") from e
            except httpx.HTTPError as e:
                raise LLMError("connection_error", f"Could not reach the Gemini API: {e}") from e
            if (r.status_code == 429 or r.status_code >= 500) and attempt < attempts - 1:
                delay = _retry_delay(r)
                if delay and delay > 60:  # e.g. a daily quota: waiting inside a run cannot help
                    break
                time.sleep(delay or 2.0 * 2 ** attempt)
                continue
            break
        if r.status_code != 200:
            detail = _gemini_error_message(r)
            code = {400: "bad_request", 401: "auth_failed", 403: "auth_failed", 404: "model_not_found",
                    429: "rate_limited"}.get(r.status_code, "api_error")
            if r.status_code == 400 and "API key" in detail:
                code = "auth_failed"
            raise LLMError(code, f"Gemini API error {r.status_code}: {detail}")
        data = r.json()
        candidates = data.get("candidates") or []
        if not candidates:
            reason = (data.get("promptFeedback") or {}).get("blockReason", "no candidates")
            raise LLMError("refusal", f"Gemini returned no answer ({reason}).")
        finish = candidates[0].get("finishReason", "STOP")
        if finish in _GEMINI_BLOCKED:
            raise LLMError("refusal", f"Gemini stopped for {finish}.")
        if finish == "MAX_TOKENS":
            raise LLMError("truncated", "The Gemini response hit its token limit.")
        if finish != "STOP":
            raise LLMError("unexpected_stop", f"Gemini stopped with {finish}; treating the run as failed.")
        return candidates[0]


def _retry_delay(r: httpx.Response) -> float | None:
    """Seconds from a google.rpc.RetryInfo detail (e.g. "retryDelay": "23s")."""
    try:
        for d in r.json()["error"].get("details", []):
            if str(d.get("@type", "")).endswith("RetryInfo"):
                return float(str(d["retryDelay"]).rstrip("s")) + 0.5
    except Exception:
        pass
    return None


def _gemini_error_message(r: httpx.Response) -> str:
    try:
        return r.json()["error"]["message"]
    except Exception:
        return r.text[:300]


# ---------------------------------------------------------------------------------- OpenAI-compatible (Groq etc.)
class OpenAICompatClient:
    """POST {base_url}/chat/completions. Groq and Ollama both speak this format."""

    def __init__(self, *, name: str, base_url: str, model: str, api_key: str = "", timeout_s: float = 90,
                 http: httpx.Client | None = None):
        self.name, self.model = name, model
        self._url = base_url.rstrip("/") + "/chat/completions"
        self._headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
        self._http = http or httpx.Client(timeout=timeout_s)

    def create(self, *, messages: list[dict], tools: list[dict]) -> dict:
        body = {"model": self.model, "messages": messages, "tools": tools, "tool_choice": "auto"}
        attempts = 3
        for attempt in range(attempts):
            try:
                r = self._http.post(self._url, json=body, headers=self._headers)
            except httpx.TimeoutException as e:
                raise LLMError("timeout", f"The {self.name} request timed out.") from e
            except httpx.HTTPError as e:
                raise LLMError("connection_error", f"Could not reach {self.name}: {e}") from e
            if _tool_call_glitch(r) and attempt < attempts - 1:
                continue  # the model emitted a call to a tool that doesn't exist; a fresh sample usually doesn't
            if (r.status_code == 429 or r.status_code >= 500) and attempt < attempts - 1:
                delay = _retry_after(r)
                if delay and delay > 60:  # quota window too long to wait inside a run
                    break
                time.sleep(delay or 2.0 * 2 ** attempt)
                continue
            break
        if r.status_code != 200:
            code = {400: "bad_request", 401: "auth_failed", 403: "auth_failed", 404: "model_not_found",
                    429: "rate_limited"}.get(r.status_code, "api_error")
            raise LLMError(code, f"{self.name} API error {r.status_code}: {_openai_error_message(r)}")
        choice = (r.json().get("choices") or [{}])[0]
        finish = choice.get("finish_reason")
        if finish == "length":
            raise LLMError("truncated", f"The {self.name} response hit its token limit.")
        if finish == "content_filter":
            raise LLMError("refusal", f"{self.name} blocked the response (content_filter).")
        if finish not in {"stop", "tool_calls", None}:
            raise LLMError("unexpected_stop", f"{self.name} stopped with {finish!r}; treating the run as failed.")
        return choice.get("message") or {}


def _tool_call_glitch(r: httpx.Response) -> bool:
    """Groq rejects a sample whose tool call is malformed or names an unknown tool (seen live with gpt-oss)."""
    return r.status_code == 400 and "tool call validation failed" in _openai_error_message(r).lower()


def _retry_after(r: httpx.Response) -> float | None:
    try:
        return float(r.headers["retry-after"])
    except (KeyError, ValueError):
        return None


def _openai_error_message(r: httpx.Response) -> str:
    try:
        err = r.json()["error"]
        return err["message"] if isinstance(err, dict) else str(err)
    except Exception:
        return r.text[:300]
