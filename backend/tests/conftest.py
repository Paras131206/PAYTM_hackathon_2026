from __future__ import annotations

import copy
from types import SimpleNamespace

import pytest

from app import seed
from app.config import settings


@pytest.fixture(autouse=True)
def fresh_db(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "db_path", tmp_path / "test.db")
    monkeypatch.setattr(settings, "tool_retry_backoff_s", 0.0)
    seed.reset()
    yield


def tool_use(id_: str, name: str, args: dict) -> dict:
    return {"type": "tool_use", "id": id_, "name": name, "input": args}


def text(t: str) -> dict:
    return {"type": "text", "text": t}


class FakeAnthropic:
    """Stands in for anthropic.Anthropic(). Returns scripted responses and records every request."""

    def __init__(self, script: list):
        self.script = list(script)
        self.requests: list[dict] = []
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self._create))

    def _create(self, **kwargs):
        self.requests.append(copy.deepcopy(kwargs))
        if not self.script:
            raise AssertionError("FakeAnthropic script exhausted")
        item = self.script.pop(0)
        if isinstance(item, Exception):
            raise item
        content, stop = item
        return SimpleNamespace(content=content, stop_reason=stop)
