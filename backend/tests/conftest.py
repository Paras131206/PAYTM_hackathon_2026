from __future__ import annotations

import pytest

from app import seed
from app.config import settings


@pytest.fixture(autouse=True)
def fresh_db(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "db_path", tmp_path / "test.db")
    monkeypatch.setattr(settings, "tool_retry_backoff_s", 0.0)
    seed.reset()
    yield
