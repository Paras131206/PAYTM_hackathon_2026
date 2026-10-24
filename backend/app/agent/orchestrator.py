"""Run loop: context -> planner turns -> validated tool execution -> verification -> outcome.

The final outcome is derived from persisted state (ticket status, verified refunds), never from planner text.
"""
from __future__ import annotations

from typing import Any, Callable

from .. import context as ctxsvc
from .. import db, guards
from ..config import iso, model_for, parse_iso, settings, utcnow
from ..tools.registry import RunContext, execute
from .llm import LLMError
from .planners import make_planner

ACTIVE_RUN_STATUSES = ("queued", "running")
AGENT_RUNNABLE_TICKET_STATUSES = {"open", "in_progress", "awaiting_customer", "waiting_on_bank"}

OUTCOME_BY_STATUS = {
    "resolved": "resolved",
    "pending_approval": "pending_approval",
    "escalated": "escalated",
    "awaiting_customer": "awaiting_customer",
    "waiting_on_bank": "waiting_on_bank",
    "closed": "closed",
}


class RunConflict(Exception):
    pass


def create_run(ticket_id: str, engine: str) -> int:
    """Insert a queued run. Rejects a second concurrent run on the same ticket."""
    ticket = ctxsvc.get_ticket(ticket_id)
    if ticket["status"] not in AGENT_RUNNABLE_TICKET_STATUSES:
        raise RunConflict(f"Ticket is {ticket['status']}; a human owns it now.")
    model = model_for(engine)
    with db.tx() as c:
        active = c.execute(
            "SELECT id FROM runs WHERE ticket_id = ? AND status IN ('queued','running')", (ticket_id,)
        ).fetchone()
        if active:
            raise RunConflict(f"Run {active['id']} is already in progress for this ticket.")
        cur = c.execute(
            "INSERT INTO runs (ticket_id, engine, model, status, started_at) VALUES (?,?,?,?,?)",
            (ticket_id, engine, model, "queued", iso(utcnow())),
        )
        return int(cur.lastrowid)


def _finish(run_id: int, status: str, outcome: str, turns: int, error: str | None = None) -> None:
    with db.tx() as c:
        c.execute("UPDATE runs SET status = ?, outcome = ?, turns = ?, error = ?, finished_at = ? WHERE id = ?",
                  (status, outcome, turns, error, iso(utcnow()), run_id))


def execute_run(run_id: int, planner_factory: Callable[[str], Any] | None = None) -> str:
    run = db.query_one("SELECT * FROM runs WHERE id = ?", (run_id,))
    if run is None:
        raise ValueError(f"run {run_id} not found")
    ticket = ctxsvc.get_ticket(run["ticket_id"])
    ctx = RunContext(run_id=run_id, ticket_id=ticket["id"], customer_id=ticket["customer_id"], actor="agent",
                     engine=run["engine"])
    with db.tx() as c:
        c.execute("UPDATE runs SET status = 'running' WHERE id = ?", (run_id,))

    turns = 0
    try:
        context = ctxsvc.build_context(ticket["id"])
        # Any customer message on the ticket counts: a later harmless message must not clear an earlier attempt.
        if any(guards.injection_suspected(m["body"]) for m in context["conversation"] if m["role"] == "customer"):
            ctx.suspicious = True
            ctx.emit("guard", {"check": "prompt_injection", "flagged": True,
                               "detail": "A customer message on this ticket matches manipulation patterns. Refunds "
                                         "for this run will require human approval regardless of planner output."})
        ctx.emit("context", {
            "customer": context["customer"],
            "transactions": len(context["recent_transactions"]),
            "prior_tickets": len(context["prior_tickets"]),
            "messages": len(context["conversation"]),
            "refunds_last_30_days": context["refunds_last_30_days"],
            "engine": run["engine"],
            "model": run["model"],
        })

        planner = (planner_factory or make_planner)(run["engine"])
        planner.start(context, ctx.suspicious)
        results: list = []
        for _ in range(settings.max_agent_turns):
            turn = planner.next(results)
            turns += 1
            if turn.note:
                ctx.emit("planner_note", {"text": turn.note[:2000]})
            if turn.done:
                break
            results = [(call, execute(ctx, call.name, call.args)) for call in turn.tool_calls]
        else:
            ctx.emit("guard", {"check": "turn_budget", "flagged": True,
                               "detail": f"Planner exceeded {settings.max_agent_turns} turns."})
            _system_escalate(ctx, "other", "Agent exceeded its turn budget without finishing.")

        outcome = _derive_outcome(ctx)
        _finish(run_id, "finished", outcome, turns)
        return outcome
    except LLMError as e:
        return _fail(ctx, turns, "llm", e.code, str(e), "tool_failure")
    except Exception as e:  # unexpected bug: record it, escalate, never pretend success
        return _fail(ctx, turns, "orchestrator", type(e).__name__, str(e), "other")


def _fail(ctx: RunContext, turns: int, source: str, code: str, message: str, reason: str) -> str:
    """Record the error and escalate; the run is always closed even if escalation itself fails."""
    try:
        ctx.emit("error", {"source": source, "code": code, "message": message,
                           "note": "No fallback output was generated. The ticket was escalated."})
        _system_escalate(ctx, reason, f"Agent run failed ({source}: {code}): {message}"[:800])
    finally:
        _finish(ctx.run_id, "failed", "escalated", turns, f"{code}: {message}")
    return "escalated"


def fail_stale_runs() -> int:
    """Runs left queued/running by a crash or restart would block their ticket forever; close them at startup."""
    with db.tx() as c:
        cur = c.execute("UPDATE runs SET status = 'failed', outcome = 'failed', error = 'interrupted by restart',"
                        " finished_at = ? WHERE status IN ('queued', 'running')", (iso(utcnow()),))
        return cur.rowcount


def _system_escalate(ctx: RunContext, reason: str, summary: str) -> None:
    ticket = ctxsvc.get_ticket(ctx.ticket_id)
    if ticket["status"] in {"escalated", "resolved", "closed", "pending_approval"}:
        return
    prev_actor = ctx.actor
    ctx.actor = "system"
    try:
        execute(ctx, "escalate_to_human", {"ticket_id": ctx.ticket_id, "reason_code": reason, "summary": summary})
    finally:
        ctx.actor = prev_actor


def _derive_outcome(ctx: RunContext) -> str:
    ticket = ctxsvc.get_ticket(ctx.ticket_id)
    status = ticket["status"]
    if status in {"open", "in_progress"}:
        _system_escalate(ctx, "other", "Agent finished without reaching a resolution, question or handoff.")
        status = ctxsvc.get_ticket(ctx.ticket_id)["status"]
    outcome = OUTCOME_BY_STATUS.get(status, status)
    run = db.query_one("SELECT started_at FROM runs WHERE id = ?", (ctx.run_id,))
    ctx.emit("outcome", {
        "outcome": outcome,
        "ticket_status": status,
        "verified_refunds": sorted(ctx.verified_refunds),
        "switch_evidence": ctx.switch_evidence,
        "suspicious": ctx.suspicious,
        "duration_s": round((utcnow() - parse_iso(run["started_at"])).total_seconds(), 2),
    })
    return outcome


def run_events(run_id: int) -> list[dict]:
    rows = db.query("SELECT seq, kind, payload, created_at FROM events WHERE run_id = ? ORDER BY seq", (run_id,))
    for r in rows:
        r["payload"] = db.loads(r["payload"])
    return rows
