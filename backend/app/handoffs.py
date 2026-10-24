"""Human decisions on approvals and escalations. Approved actions run through the same tool registry, attributed to
the reviewer, with fresh evidence (the switch is re-checked at approval time)."""
from __future__ import annotations

from typing import Literal

from . import context as ctxsvc
from . import db, policy
from .config import iso, utcnow
from .tools.registry import RunContext, create_handoff, execute

Decision = Literal["approve", "reject", "request_info", "mark_handled"]


class HandoffError(Exception):
    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code


def list_handoffs(status: str | None = None) -> list[dict]:
    sql = ("SELECT h.*, t.subject, t.customer_id, t.status AS ticket_status, c.name AS customer_name FROM handoffs h"
           " JOIN tickets t ON t.id = h.ticket_id JOIN customers c ON c.id = t.customer_id")
    params: tuple = ()
    if status:
        sql += " WHERE h.status = ?"
        params = (status,)
    rows = db.query(sql + " ORDER BY h.status = 'pending' DESC, h.created_at DESC", params)
    for r in rows:
        for k in ("args", "evidence", "result"):
            r[k] = db.loads(r[k])
    return rows


def _human_run(ticket_id: str, reviewer: str) -> int:
    with db.tx() as c:
        cur = c.execute("INSERT INTO runs (ticket_id, engine, model, status, started_at) VALUES (?,?,?,?,?)",
                        (ticket_id, "human", reviewer, "running", iso(utcnow())))
        return int(cur.lastrowid)


def decide(handoff_id: int, decision: Decision, reviewer: str, note: str) -> dict:
    reviewer = reviewer.strip() or "reviewer"
    with db.tx() as c:
        h = c.execute("SELECT * FROM handoffs WHERE id = ?", (handoff_id,)).fetchone()
        if h is None:
            raise HandoffError(404, "handoff not found")
        if h["status"] != "pending":
            raise HandoffError(409, f"handoff already {h['status']}")
        if decision in {"approve", "reject"} and h["kind"] != "approval":
            raise HandoffError(400, "only approval handoffs can be approved or rejected")
        if decision == "mark_handled" and h["kind"] != "escalation":
            raise HandoffError(400, "only escalations can be marked handled")
        ticket_status = c.execute("SELECT status FROM tickets WHERE id = ?", (h["ticket_id"],)).fetchone()["status"]
        expected = "pending_approval" if h["kind"] == "approval" else "escalated"
        stale = ticket_status != expected
        # A stale handoff is retired instead of acted on; otherwise claim it so a double click cannot run twice.
        c.execute("UPDATE handoffs SET status = ? WHERE id = ?", ("superseded" if stale else "deciding", handoff_id))
    if stale:
        raise HandoffError(409, f"ticket is now {ticket_status}; this {h['kind']} is no longer current")
    h = dict(h)
    ticket = ctxsvc.get_ticket(h["ticket_id"])
    run_id = _human_run(ticket["id"], reviewer)
    actor = f"human:{reviewer}"
    ctx = RunContext(run_id=run_id, ticket_id=ticket["id"], customer_id=ticket["customer_id"], actor=actor,
                     engine="human", approved_handoff_id=handoff_id if decision == "approve" else None, assessed=True)
    ctx.emit("human_decision", {"handoff_id": handoff_id, "kind": h["kind"], "decision": decision, "note": note})

    result: dict = {"decision": decision}
    final_status = {"approve": "approved", "reject": "rejected", "request_info": "info_requested",
                    "mark_handled": "handled"}[decision]
    outcome = None
    try:
        if decision == "approve":
            args = db.loads(h["args"]) or {}
            txn_id = args["txn_id"]
            sw = execute(ctx, "check_switch_status", {"txn_id": txn_id})
            res = execute(ctx, "issue_refund", args) if sw.status == "ok" else sw
            refund_id = res.data.get("refund_id") or (res.data.get("refund") or {}).get("id")
            verified = execute(ctx, "verify_refund", {"refund_id": refund_id}) if refund_id else None
            confirmed = bool(verified and verified.data.get("confirmed"))
            result.update(refund=res.to_dict(), verified=confirmed)
            updated = confirmed and execute(ctx, "update_ticket", {
                "ticket_id": ticket["id"], "status": "resolved",
                "note": f"Approved by {reviewer}; refund {refund_id} verified."}).status == "ok"
            if updated:
                execute(ctx, "reply_to_customer", {
                    "ticket_id": ticket["id"],
                    "message": f"Good news: your refund of Rs {res.data.get('amount_rupees', 0):,.0f} has been "
                               f"approved and processed (refund ID {refund_id}). It should reflect in "
                               f"{policy.REFUND_CREDIT_ETA}." + (f" Note from our team: {note}" if note else "")})
                outcome = "resolved"
            else:
                # Hand the ticket back to the queue as a new escalation so a human still owns it.
                create_handoff(ctx, kind="escalation",
                               reason_code="tool_failure" if res.status == "error" else "policy_exception",
                               summary=f"Approved refund for {txn_id} could not be completed: {res.message}",
                               evidence={"approval_handoff_id": handoff_id, "refund_result": res.to_dict()},
                               ticket_status="escalated")
                result["error"] = "Approved, but the refund could not be executed and verified; ticket escalated."
                final_status = "approved_failed"
                outcome = "escalated"
        elif decision == "reject":
            _close(ctx, "closed", "refund_rejected")
            execute(ctx, "reply_to_customer", {
                "ticket_id": ticket["id"],
                "message": "We reviewed your request and are unable to refund this payment."
                           + (f" {note}" if note else "")})
            outcome = "closed"
        elif decision == "request_info":
            _close(ctx, "awaiting_customer", None)
            execute(ctx, "reply_to_customer", {
                "ticket_id": ticket["id"],
                "message": note or "Could you share a little more detail so we can complete your request?"})
            outcome = "awaiting_customer"
        else:  # mark_handled
            _close(ctx, "closed", "handled_by_human")
            if note:
                execute(ctx, "reply_to_customer", {"ticket_id": ticket["id"], "message": note})
            outcome = "closed"
    except Exception as e:
        result["error"] = f"{type(e).__name__}: {e}"
        final_status = "pending"  # release the claim so the reviewer can retry
        outcome = "failed"
    with db.tx() as c:
        c.execute("UPDATE handoffs SET status = ?, decided_by = ?, decision_note = ?, decided_at = ?, result = ?"
                  " WHERE id = ?", (final_status, actor, note, iso(utcnow()), db.dumps(result), handoff_id))
        c.execute("UPDATE runs SET status = ?, outcome = ?, finished_at = ? WHERE id = ?",
                  ("finished" if outcome != "failed" else "failed", outcome, iso(utcnow()), run_id))
    ctx.emit("outcome", {"outcome": outcome, "handoff_status": final_status, **result})
    return {"handoff_id": handoff_id, "status": final_status, "outcome": outcome, "run_id": run_id, **result}


def _close(ctx: RunContext, status: str, resolution: str | None) -> None:
    with db.tx() as c:
        c.execute("UPDATE tickets SET status = ?, resolution_code = COALESCE(?, resolution_code), resolved_by = ?,"
                  " resolved_at = CASE WHEN ? = 'closed' THEN ? ELSE resolved_at END, updated_at = ? WHERE id = ?",
                  (status, resolution, ctx.actor, status, iso(utcnow()), iso(utcnow()), ctx.ticket_id))
        c.execute("INSERT INTO messages (ticket_id, role, author, body, run_id, created_at) VALUES (?,?,?,?,?,?)",
                  (ctx.ticket_id, "system", ctx.actor, f"Status set to {status} by {ctx.actor}.", ctx.run_id,
                   iso(utcnow())))
    ctx.emit("ticket_update", {"status": status, "resolution_code": resolution})
