"""Customer context retrieval. Read-only, indexed SQL lookups — no vector store needed for this data."""
from __future__ import annotations

from datetime import timedelta

from . import db
from .config import iso, utcnow


class NotFound(Exception):
    pass


def get_customer(customer_id: str) -> dict:
    row = db.query_one("SELECT * FROM customers WHERE id = ?", (customer_id,))
    if not row:
        raise NotFound(f"customer {customer_id} not found")
    return row


def get_ticket(ticket_id: str) -> dict:
    row = db.query_one("SELECT * FROM tickets WHERE id = ?", (ticket_id,))
    if not row:
        raise NotFound(f"ticket {ticket_id} not found")
    return row


def recent_transactions(customer_id: str, limit: int = 10) -> list[dict]:
    return db.query(
        "SELECT * FROM transactions WHERE customer_id = ? ORDER BY created_at DESC LIMIT ?", (customer_id, limit)
    )


def conversation(ticket_id: str) -> list[dict]:
    return db.query(
        "SELECT id, role, author, body, created_at FROM messages WHERE ticket_id = ? ORDER BY id", (ticket_id,)
    )


def prior_tickets(customer_id: str, exclude: str) -> list[dict]:
    return db.query(
        "SELECT id, subject, status, resolution_code, created_at FROM tickets"
        " WHERE customer_id = ? AND id != ? ORDER BY created_at DESC LIMIT 5",
        (customer_id, exclude),
    )


def refunds_for_customer(customer_id: str) -> list[dict]:
    return db.query(
        "SELECT r.* FROM refunds r JOIN transactions t ON t.id = r.txn_id WHERE t.customer_id = ?"
        " ORDER BY r.created_at DESC",
        (customer_id,),
    )


def recent_refund_count(customer_id: str, days: int = 30) -> int:
    since = iso(utcnow() - timedelta(days=days))
    row = db.query_one(
        "SELECT COUNT(*) AS n FROM refunds r JOIN transactions t ON t.id = r.txn_id"
        " WHERE t.customer_id = ? AND r.status = 'SUCCESS' AND r.created_at >= ?",
        (customer_id, since),
    )
    return int(row["n"]) if row else 0


def public_txn(t: dict) -> dict:
    """What the customer-facing app and the planner may see. `switch_status` is ground truth held by the sandbox
    switch, so it is deliberately excluded — the agent must call check_switch_status to learn it."""
    return {
        "id": t["id"],
        "merchant": t["merchant"],
        "amount_rupees": t["amount_paise"] / 100,
        "method": t["method"],
        "debit_status": t["debit_status"],
        "app_status": t["app_status"],
        "reversed": bool(t["reversed"]),
        "created_at": t["created_at"],
    }


def build_context(ticket_id: str) -> dict:
    ticket = get_ticket(ticket_id)
    customer = get_customer(ticket["customer_id"])
    return {
        "ticket": {k: ticket[k] for k in ("id", "subject", "status", "priority", "channel", "created_at")},
        "customer": {k: customer[k] for k in ("id", "name", "phone_masked", "kyc_level", "tier", "language")},
        "recent_transactions": [public_txn(t) for t in recent_transactions(customer["id"])],
        "prior_tickets": prior_tickets(customer["id"], ticket_id),
        "refunds_last_30_days": recent_refund_count(customer["id"]),
        "conversation": conversation(ticket_id),
        "now": iso(utcnow()),
    }
