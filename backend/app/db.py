"""SQLite persistence (stdlib sqlite3). One short-lived connection per unit of work."""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from typing import Any, Iterator

from .config import settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone_masked TEXT NOT NULL,
    kyc_level TEXT NOT NULL,
    tier TEXT NOT NULL,
    language TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    merchant TEXT NOT NULL,
    amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
    method TEXT NOT NULL,
    debit_status TEXT NOT NULL,          -- DEBITED | NOT_DEBITED
    app_status TEXT NOT NULL,            -- what the customer sees in the app
    switch_status TEXT NOT NULL,         -- sandbox ground truth returned by the payment-switch adapter
    reversed INTEGER NOT NULL DEFAULT 0,
    reversal_ref TEXT,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    subject TEXT NOT NULL,
    channel TEXT NOT NULL,
    status TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal',
    scenario TEXT,
    resolution_code TEXT,
    resolved_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    resolved_at TEXT
);
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id TEXT NOT NULL REFERENCES tickets(id),
    role TEXT NOT NULL,                  -- customer | agent | human | system
    author TEXT NOT NULL,
    body TEXT NOT NULL,
    run_id INTEGER,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS refunds (
    id TEXT PRIMARY KEY,
    txn_id TEXT NOT NULL UNIQUE REFERENCES transactions(id),
    ticket_id TEXT NOT NULL,
    amount_paise INTEGER NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL,                -- SUCCESS | FAILED
    created_by TEXT NOT NULL,
    handoff_id INTEGER,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id TEXT NOT NULL REFERENCES tickets(id),
    engine TEXT NOT NULL,                -- claude | rules | human
    model TEXT,
    status TEXT NOT NULL,                -- queued | running | finished | failed
    outcome TEXT,                        -- resolved | pending_approval | escalated | awaiting_customer | waiting_on_bank | closed | failed
    turns INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    started_at TEXT NOT NULL,
    finished_at TEXT
);
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL REFERENCES runs(id),
    seq INTEGER NOT NULL,
    kind TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_run ON events(run_id, seq);
CREATE TABLE IF NOT EXISTS handoffs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,                  -- approval | escalation
    ticket_id TEXT NOT NULL REFERENCES tickets(id),
    run_id INTEGER,
    action TEXT,
    args TEXT,
    amount_paise INTEGER,
    reason_code TEXT NOT NULL,
    summary TEXT NOT NULL,
    evidence TEXT NOT NULL,
    status TEXT NOT NULL,                -- pending | approved | rejected | info_requested | handled
    decided_by TEXT,
    decision_note TEXT,
    result TEXT,
    created_at TEXT NOT NULL,
    decided_at TEXT
);
CREATE TABLE IF NOT EXISTS policies (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    version TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sandbox_faults (
    adapter TEXT NOT NULL,               -- payment_switch | refund_ledger
    target TEXT NOT NULL,                -- a txn id, or '*' for every call
    mode TEXT NOT NULL,                  -- outage | timeout
    PRIMARY KEY (adapter, target)
);
"""


def connect() -> sqlite3.Connection:
    settings.db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(settings.db_path, timeout=10, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 10000")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


@contextmanager
def tx() -> Iterator[sqlite3.Connection]:
    """An explicit transaction: committed on success, rolled back on any exception."""
    conn = connect()
    try:
        conn.execute("BEGIN IMMEDIATE")
        yield conn
        conn.execute("COMMIT")
    except BaseException:
        conn.execute("ROLLBACK")
        raise
    finally:
        conn.close()


def init_db() -> None:
    conn = connect()
    try:
        conn.executescript(SCHEMA)
    finally:
        conn.close()


def query(sql: str, params: tuple | dict = ()) -> list[dict[str, Any]]:
    conn = connect()
    try:
        return [dict(r) for r in conn.execute(sql, params).fetchall()]
    finally:
        conn.close()


def query_one(sql: str, params: tuple | dict = ()) -> dict[str, Any] | None:
    rows = query(sql, params)
    return rows[0] if rows else None


def dumps(value: Any) -> str:
    return json.dumps(value, default=str, ensure_ascii=False)


def loads(value: str | None) -> Any:
    return json.loads(value) if value else None
