"""Runtime configuration. Every value comes from the environment (or a .env file); nothing secret is hardcoded."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_DIR = BACKEND_DIR.parent

# A repo-root .env is loaded if present. Real environment variables take precedence.
load_dotenv(REPO_DIR / ".env", override=False)


def gemini_api_key() -> str:
    return os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or ""


PROVIDER_ENV = {"gemini": ("GEMINI_API_KEY", "GOOGLE_API_KEY"), "groq": ("GROQ_API_KEY",), "ollama": ("OLLAMA_MODEL",)}


def provider_env_present(name: str) -> bool:
    return any(os.getenv(k) for k in PROVIDER_ENV.get(name, ()))


@dataclass
class Settings:
    db_path: Path = field(default_factory=lambda: Path(os.getenv("RESOLV_DB_PATH", BACKEND_DIR / "data" / "resolv.db")))
    # auto | llm | rules. "auto" is resolved ONCE at startup: llm if any provider is configured, else rules.
    # "llm" runs the LLM_PROVIDERS chain in order, failing over to the next provider on quota/outage errors.
    agent_engine: str = field(default_factory=lambda: os.getenv("AGENT_ENGINE", "auto").strip().lower())
    gemini_model: str = field(default_factory=lambda: os.getenv("GEMINI_MODEL", "gemini-3.6-flash"))
    gemini_timeout_s: float = field(default_factory=lambda: float(os.getenv("GEMINI_TIMEOUT_S", "90")))
    llm_providers: list[str] = field(default_factory=lambda: [
        p.strip().lower() for p in os.getenv("LLM_PROVIDERS", "gemini,groq,ollama").split(",")
        if p.strip()])
    groq_api_key: str = field(default_factory=lambda: os.getenv("GROQ_API_KEY", ""))
    groq_model: str = field(default_factory=lambda: os.getenv("GROQ_MODEL", "openai/gpt-oss-120b"))
    ollama_model: str = field(default_factory=lambda: os.getenv("OLLAMA_MODEL", ""))  # empty = Ollama not used
    ollama_base_url: str = field(default_factory=lambda: os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1"))
    ollama_timeout_s: float = field(default_factory=lambda: float(os.getenv("OLLAMA_TIMEOUT_S", "180")))
    auto_refund_limit_paise: int = field(default_factory=lambda: int(os.getenv("AUTO_REFUND_LIMIT_PAISE", "200000")))
    max_agent_turns: int = field(default_factory=lambda: int(os.getenv("MAX_AGENT_TURNS", "12")))
    tool_max_attempts: int = field(default_factory=lambda: int(os.getenv("TOOL_MAX_ATTEMPTS", "3")))
    tool_retry_backoff_s: float = field(default_factory=lambda: float(os.getenv("TOOL_RETRY_BACKOFF_S", "0.4")))
    cors_origins: list[str] = field(
        default_factory=lambda: os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    )

    resolved_engine: str = ""

    def __post_init__(self) -> None:
        if self.agent_engine not in {"auto", "llm", "rules"}:
            raise ValueError(f"AGENT_ENGINE must be auto|llm|rules, got {self.agent_engine!r}")
        unknown = set(self.llm_providers) - {"gemini", "groq", "ollama"}
        if unknown:
            raise ValueError(f"LLM_PROVIDERS has unknown providers: {sorted(unknown)}")
        if self.agent_engine == "auto":
            self.resolved_engine = "llm" if any(provider_env_present(p) for p in self.llm_providers) else "rules"
        else:
            self.resolved_engine = self.agent_engine


settings = Settings()


def utcnow() -> datetime:
    """Single clock for the app so tests can patch it."""
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat(timespec="seconds")


def parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value)

