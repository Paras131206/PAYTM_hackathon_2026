"""SANDBOX adapters. These simulate external systems against local SQLite tables.

They are NOT real integrations: no bank, NPCI, payment switch or payment gateway is contacted and no money moves.
Faults (outage / timeout) can be injected through the `sandbox_faults` table to test failure handling.
"""
from __future__ import annotations

import secrets

from .. import db
from ..config import iso, utcnow

MODE = "sandbox"


class AdapterError(Exception):
    retryable = True

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


class AdapterUnavailable(AdapterError):
    pass


class AdapterTimeout(AdapterError):
    pass


def _fault(adapter: str, target: str) -> str | None:
    row = db.query_one(
        "SELECT mode FROM sandbox_faults WHERE adapter = ? AND target IN (?, '*') ORDER BY target = '*' LIMIT 1",
        (adapter, target),
    )
    return row["mode"] if row else None


def _raise_fault(adapter: str, target: str) -> None:
    mode = _fault(adapter, target)
    if mode == "outage":
        raise AdapterUnavailable("adapter_unavailable", f"{adapter} sandbox returned 503 (injected outage)")
    if mode == "timeout":
        raise AdapterTimeout("adapter_timeout", f"{adapter} sandbox timed out (injected timeout)")


class PaymentSwitchSandbox:
    """Simulates asking the UPI switch for the authoritative status of a payment."""

    name = "payment_switch"

    def status(self, txn_id: str) -> str:
        _raise_fault(self.name, txn_id)
        row = db.query_one("SELECT switch_status FROM transactions WHERE id = ?", (txn_id,))
        if not row:
            raise AdapterError("unknown_txn", f"switch has no record of {txn_id}")
        return row["switch_status"]


class RefundLedgerSandbox:
    """Simulates the refund rail. Writes a refund row and marks the transaction reversed, atomically.

    Idempotent: refunds.txn_id is UNIQUE, and an existing refund is returned instead of creating a second one.
    """

    name = "refund_ledger"

    def refund(self, *, txn_id: str, ticket_id: str, reason: str, created_by: str,
               handoff_id: int | None) -> tuple[dict, bool]:
        _raise_fault(self.name, txn_id)
        with db.tx() as c:
            existing = c.execute("SELECT * FROM refunds WHERE txn_id = ?", (txn_id,)).fetchone()
            if existing:
                return dict(existing), False
            txn = c.execute("SELECT amount_paise FROM transactions WHERE id = ?", (txn_id,)).fetchone()
            refund_id = "RFND-" + secrets.token_hex(4).upper()
            now = iso(utcnow())
            c.execute(
                "INSERT INTO refunds (id, txn_id, ticket_id, amount_paise, reason, status, created_by, handoff_id,"
                " created_at) VALUES (?,?,?,?,?,?,?,?,?)",
                (refund_id, txn_id, ticket_id, txn["amount_paise"], reason, "SUCCESS", created_by, handoff_id, now),
            )
            c.execute("UPDATE transactions SET reversed = 1, reversal_ref = ? WHERE id = ?", (refund_id, txn_id))
            row = c.execute("SELECT * FROM refunds WHERE id = ?", (refund_id,)).fetchone()
            return dict(row), True

    def get(self, refund_id: str) -> dict | None:
        return db.query_one("SELECT * FROM refunds WHERE id = ?", (refund_id,))


payment_switch = PaymentSwitchSandbox()
refund_ledger = RefundLedgerSandbox()


def set_fault(adapter: str, target: str, mode: str | None) -> None:
    with db.tx() as c:
        c.execute("DELETE FROM sandbox_faults WHERE adapter = ? AND target = ?", (adapter, target))
        if mode:
            c.execute("INSERT INTO sandbox_faults VALUES (?,?,?)", (adapter, target, mode))


def list_faults() -> list[dict]:
    return db.query("SELECT * FROM sandbox_faults ORDER BY adapter, target")
