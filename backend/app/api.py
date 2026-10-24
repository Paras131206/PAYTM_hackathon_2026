"""FastAPI application: typed HTTP API over the context, agent, handoff and metrics services."""
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Literal

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

from . import context as ctxsvc
from . import db, handoffs, metrics, seed
from .agent import orchestrator
from .config import claude_credentials_present, engine_configured, gemini_api_key, iso, model_for, settings, utcnow
from .tools import adapters
from .tools.registry import TOOLS


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init_db()
    orchestrator.fail_stale_runs()
    if not db.query_one("SELECT 1 FROM customers LIMIT 1"):
        seed.reset()
    yield


app = FastAPI(title="Resolv — AI support teammate (prototype)", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["*"], allow_headers=["*"])


class _Body(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class RunRequest(_Body):
    engine: Literal["claude", "gemini", "rules"] | None = None


class MessageRequest(_Body):
    body: str = Field(min_length=1, max_length=2000)
    auto_run: bool = True


class NewTicketRequest(_Body):
    customer_id: str = Field(min_length=3, max_length=32)
    subject: str = Field(min_length=3, max_length=120)
    body: str = Field(min_length=1, max_length=2000)
    auto_run: bool = True


class DecisionRequest(_Body):
    decision: Literal["approve", "reject", "request_info", "mark_handled"]
    reviewer: str = Field(min_length=1, max_length=60)
    note: str = Field(default="", max_length=1000)


class FaultRequest(_Body):
    adapter: Literal["payment_switch", "refund_ledger"]
    target: str = Field(min_length=1, max_length=32)
    mode: Literal["outage", "timeout"] | None


def _engine_or_400(requested: str | None) -> str:
    engine = requested or settings.resolved_engine
    if not engine_configured(engine):
        key = "ANTHROPIC_API_KEY" if engine == "claude" else "GEMINI_API_KEY"
        raise HTTPException(400, f"The {engine} engine is not configured ({key} is missing). "
                                 "Use engine 'rules' or set the key and restart.")
    return engine


def _start_run(ticket_id: str, engine: str, tasks: BackgroundTasks) -> int:
    try:
        run_id = orchestrator.create_run(ticket_id, engine)
    except ctxsvc.NotFound as e:
        raise HTTPException(404, str(e)) from e
    except orchestrator.RunConflict as e:
        raise HTTPException(409, str(e)) from e
    tasks.add_task(orchestrator.execute_run, run_id)
    return run_id


@app.get("/api/health")
def health() -> dict:
    db.query_one("SELECT 1 AS ok")
    return {
        "status": "ok",
        "time": iso(utcnow()),
        "engine": settings.resolved_engine,
        "engine_setting": settings.agent_engine,
        "claude_configured": claude_credentials_present(),
        "gemini_configured": bool(gemini_api_key()),
        "model": model_for(settings.resolved_engine),
    }


@app.get("/api/system")
def system() -> dict:
    return {
        "engine": settings.resolved_engine,
        "engine_setting": settings.agent_engine,
        "claude_configured": claude_credentials_present(),
        "gemini_configured": bool(gemini_api_key()),
        "model": model_for(settings.resolved_engine) or "—",
        "effort": settings.anthropic_effort,
        "auto_refund_limit_rupees": settings.auto_refund_limit_paise / 100,
        "max_agent_turns": settings.max_agent_turns,
        "tool_max_attempts": settings.tool_max_attempts,
        "integrations": [
            {"name": "Claude (Anthropic API)", "mode": "live" if claude_credentials_present() else "not configured",
             "detail": f"Planner for engine=claude ({settings.anthropic_model}). Live only when ANTHROPIC_API_KEY is set."},
            {"name": "Gemini (Google Generative Language API)", "mode": "live" if gemini_api_key() else "not configured",
             "detail": f"Planner for engine=gemini ({settings.gemini_model}). Live only when GEMINI_API_KEY is set."},
            {"name": "Payment switch", "mode": "sandbox",
             "detail": "Simulated UPI switch backed by SQLite. No bank or NPCI connection."},
            {"name": "Refund ledger", "mode": "sandbox", "detail": "Simulated refund rail. No money moves."},
            {"name": "Ticketing", "mode": "internal", "detail": "Tickets and messages stored in local SQLite."},
            {"name": "Customer messaging", "mode": "internal",
             "detail": "Replies go to the in-app ticket thread only. No SMS, email or WhatsApp is sent."},
        ],
        "tools": [{"name": s.name, "permission": s.permission, "integration": s.integration,
                   "description": s.description} for s in TOOLS.values()],
        "faults": adapters.list_faults(),
    }


@app.get("/api/customers")
def customers() -> list[dict]:
    return db.query("SELECT id, name, tier, kyc_level FROM customers ORDER BY id")


@app.get("/api/tickets")
def tickets() -> list[dict]:
    return db.query(
        "SELECT t.*, c.name AS customer_name,"
        " (SELECT outcome FROM runs r WHERE r.ticket_id = t.id ORDER BY r.id DESC LIMIT 1) AS last_outcome,"
        " (SELECT status FROM runs r WHERE r.ticket_id = t.id ORDER BY r.id DESC LIMIT 1) AS last_run_status,"
        " (SELECT body FROM messages m WHERE m.ticket_id = t.id AND m.role = 'customer' ORDER BY m.id LIMIT 1)"
        "   AS first_message"
        " FROM tickets t JOIN customers c ON c.id = t.customer_id WHERE t.scenario IS NOT 'history'"
        " ORDER BY t.id"
    )


@app.get("/api/tickets/{ticket_id}")
def ticket_detail(ticket_id: str) -> dict:
    try:
        ticket = ctxsvc.get_ticket(ticket_id)
    except ctxsvc.NotFound as e:
        raise HTTPException(404, str(e)) from e
    cust = ctxsvc.get_customer(ticket["customer_id"])
    txns = db.query("SELECT * FROM transactions WHERE customer_id = ? ORDER BY created_at DESC", (cust["id"],))
    return {
        "ticket": ticket,
        "customer": cust,
        "transactions": txns,        # includes sandbox ground truth for the operator view
        "refunds": ctxsvc.refunds_for_customer(cust["id"]),
        "prior_tickets": ctxsvc.prior_tickets(cust["id"], ticket_id),
        "messages": ctxsvc.conversation(ticket_id),
        "runs": db.query("SELECT * FROM runs WHERE ticket_id = ? ORDER BY id DESC", (ticket_id,)),
        "handoffs": [h for h in handoffs.list_handoffs() if h["ticket_id"] == ticket_id],
    }


@app.post("/api/tickets", status_code=201)
def create_ticket(req: NewTicketRequest, tasks: BackgroundTasks) -> dict:
    try:
        ctxsvc.get_customer(req.customer_id)
    except ctxsvc.NotFound as e:
        raise HTTPException(404, str(e)) from e
    engine = _engine_or_400(None) if req.auto_run else None
    now = iso(utcnow())
    with db.tx() as c:
        n = c.execute("SELECT COUNT(*) AS n FROM tickets").fetchone()["n"]
        tid = f"TKT-{2001 + n}"
        c.execute("INSERT INTO tickets (id, customer_id, subject, channel, status, scenario, created_at, updated_at)"
                  " VALUES (?,?,?,?,?,?,?,?)", (tid, req.customer_id, req.subject, "app_chat", "open", "custom",
                                                now, now))
        c.execute("INSERT INTO messages (ticket_id, role, author, body, created_at) VALUES (?,?,?,?,?)",
                  (tid, "customer", req.customer_id, req.body, now))
    run_id = _start_run(tid, engine, tasks) if engine else None
    return {"ticket_id": tid, "run_id": run_id}


@app.post("/api/tickets/{ticket_id}/messages", status_code=201)
def post_message(ticket_id: str, req: MessageRequest, tasks: BackgroundTasks) -> dict:
    try:
        ticket = ctxsvc.get_ticket(ticket_id)
    except ctxsvc.NotFound as e:
        raise HTTPException(404, str(e)) from e
    with db.tx() as c:
        c.execute("INSERT INTO messages (ticket_id, role, author, body, created_at) VALUES (?,?,?,?,?)",
                  (ticket_id, "customer", ticket["customer_id"], req.body, iso(utcnow())))
        if ticket["status"] == "awaiting_customer":
            c.execute("UPDATE tickets SET status = 'open', updated_at = ? WHERE id = ?", (iso(utcnow()), ticket_id))
    run_id = None
    if req.auto_run and ticket["status"] in orchestrator.AGENT_RUNNABLE_TICKET_STATUSES:
        run_id = _start_run(ticket_id, _engine_or_400(None), tasks)
    return {"ticket_id": ticket_id, "run_id": run_id,
            "note": None if run_id else f"Ticket is {ticket['status']}; message stored for the human owner."}


@app.post("/api/tickets/{ticket_id}/runs", status_code=202)
def start_run(ticket_id: str, req: RunRequest, tasks: BackgroundTasks) -> dict:
    engine = _engine_or_400(req.engine)
    return {"run_id": _start_run(ticket_id, engine, tasks), "engine": engine}


@app.get("/api/runs/{run_id}")
def get_run(run_id: int) -> dict:
    run = db.query_one("SELECT * FROM runs WHERE id = ?", (run_id,))
    if not run:
        raise HTTPException(404, "run not found")
    return {"run": run, "events": orchestrator.run_events(run_id)}


@app.get("/api/handoffs")
def get_handoffs(status: str | None = None) -> list[dict]:
    return handoffs.list_handoffs(status)


@app.post("/api/handoffs/{handoff_id}/decision")
def decide(handoff_id: int, req: DecisionRequest) -> dict:
    try:
        return handoffs.decide(handoff_id, req.decision, req.reviewer, req.note)
    except handoffs.HandoffError as e:
        raise HTTPException(e.status_code, str(e)) from e


@app.get("/api/metrics")
def get_metrics() -> dict:
    return metrics.compute()


@app.post("/api/sandbox/faults")
def set_fault(req: FaultRequest) -> list[dict]:
    adapters.set_fault(req.adapter, req.target, req.mode)
    return adapters.list_faults()


@app.post("/api/demo/reset")
def reset_demo() -> dict:
    active = db.query_one("SELECT COUNT(*) AS n FROM runs WHERE status IN ('queued','running')")
    if active and active["n"]:
        raise HTTPException(409, "Wait for running agent runs to finish before resetting.")
    seed.reset()
    return {"status": "reset", "time": iso(utcnow())}
