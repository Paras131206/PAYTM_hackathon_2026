"""Claude provider adapter. This is the only module that imports the Anthropic SDK.

Failures are raised as LLMError. There is no fallback to fabricated output: a failed call fails the run.
"""
from __future__ import annotations

import time
from typing import Any

import anthropic
import httpx

from ..config import claude_credentials_present, gemini_api_key, settings


class LLMError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


class ClaudeClient:
    def __init__(self, client: Any | None = None):
        if client is None:
            if not claude_credentials_present():
                raise LLMError("missing_credentials",
                               "ANTHROPIC_API_KEY is not set. Set it in .env or choose the rules engine.")
            client = anthropic.Anthropic(timeout=settings.anthropic_timeout_s, max_retries=2)
        self._client = client
        self.model = settings.anthropic_model

    def create(self, *, system: str, messages: list[dict], tools: list[dict]) -> Any:
        kwargs: dict[str, Any] = dict(
            model=self.model,
            max_tokens=16000,
            system=system,
            messages=messages,
            tools=tools,
            tool_choice={"type": "auto"},
            output_config={"effort": settings.anthropic_effort},
        )
        if settings.anthropic_refusal_fallback:
            # Server-side refusal fallback (opt-in): on a policy decline the API re-runs on a fallback model.
            kwargs["betas"] = ["server-side-fallback-2026-07-01"]
            kwargs["fallbacks"] = "default"
        try:
            response = self._client.beta.messages.create(**kwargs)
        except anthropic.AuthenticationError as e:
            raise LLMError("auth_failed", f"Anthropic rejected the credentials: {e.message}") from e
        except anthropic.PermissionDeniedError as e:
            raise LLMError("permission_denied", e.message) from e
        except anthropic.NotFoundError as e:
            raise LLMError("model_not_found", f"Model {self.model!r} not available: {e.message}") from e
        except anthropic.RateLimitError as e:
            raise LLMError("rate_limited", "Anthropic rate limit hit (after SDK retries).") from e
        except anthropic.BadRequestError as e:
            raise LLMError("bad_request", e.message) from e
        except anthropic.APITimeoutError as e:
            raise LLMError("timeout", "The Anthropic request timed out.") from e
        except anthropic.APIConnectionError as e:
            raise LLMError("connection_error", "Could not reach the Anthropic API.") from e
        except anthropic.APIStatusError as e:
            raise LLMError("api_error", f"Anthropic API error {e.status_code}: {e.message}") from e

        stop = getattr(response, "stop_reason", None)
        if stop == "refusal":
            raise LLMError("refusal", "The model declined this request.")
        if stop == "max_tokens":
            raise LLMError("truncated", "The model response hit max_tokens.")
        if stop not in {"end_turn", "tool_use", "stop_sequence", "pause_turn"}:
            raise LLMError("unexpected_stop", f"Model stopped with {stop!r}; treating the run as failed.")
        return response


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
        for attempt in range(3):  # retry 429/5xx like the vendor SDKs do
            try:
                r = self._http.post(url, json=body, headers={"x-goog-api-key": self._key})
            except httpx.TimeoutException as e:
                raise LLMError("timeout", "The Gemini request timed out.") from e
            except httpx.HTTPError as e:
                raise LLMError("connection_error", f"Could not reach the Gemini API: {e}") from e
            if (r.status_code == 429 or r.status_code >= 500) and attempt < 2:
                time.sleep(1.5 * (attempt + 1))
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


def _gemini_error_message(r: httpx.Response) -> str:
    try:
        return r.json()["error"]["message"]
    except Exception:
        return r.text[:300]
