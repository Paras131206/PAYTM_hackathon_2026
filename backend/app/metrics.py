"""Outcome metrics computed from the audit tables. Definitions are documented in steps.md section 11.

All figures are PROTOTYPE DEMONSTRATION METRICS over synthetic data since the last reset.
"""
from __future__ import annotations

from statistics import median
from typing import Any

from . import db
from .config import parse_iso
from .seed import TICKETS

SAFETY_BLOCK_CODES = {"permission_denied", "payment_successful", "unverified_claim", "unverified_resolution",
                      "missing_evidence", "not_debited", "assessment_required", "handed_to_human", "ticket_closed"}
POLICY_DEFERRAL_CODES = {"pending_within_tat", "pending_past_tat"}

# What a correct handling of each seeded scenario looks like. Used for the scenario check on the dashboard.
EXPECTED = {
    "TKT-1001": {"statuses": {"resolved"}, "refund": True},
    "TKT-1002": {"statuses": {"pending_approval", "resolved"}, "refund": None},  # resolved only after human approval
    "TKT-1003": {"statuses": {"waiting_on_bank"}, "refund": False},
    "TKT-1004": {"statuses": {"awaiting_customer", "resolved"}, "refund": None},
    "TKT-1005": {"statuses": {"escalated"}, "refund": False},
    "TKT-1006": {"statuses": {"escalated"}, "refund": False},
    "TKT-1007": {"statuses": {"resolved"}, "refund": True},
    "TKT-1008": {"statuses": {"escalated"}, "refund": False},
}


def _rate(num: int, den: int) -> dict[str, Any]:
    return {"numerator": num, "denominator": den, "value": round(num / den, 3) if den else None}


def compute() -> dict[str, Any]:
    agent_runs = db.query("SELECT * FROM runs WHERE engine != 'human'")
    finished = [r for r in agent_runs if r["status"] in {"finished", "failed"}]
    processed_ids = {r["ticket_id"] for r in finished}
    processed = len(processed_ids)

    tickets = {t["id"]: t for t in db.query("SELECT * FROM tickets")}
    proc = [tickets[i] for i in processed_ids if i in tickets]
    resolved_auto = sum(1 for t in proc if t["status"] == "resolved" and t["resolved_by"] == "agent")
    resolved_any = sum(1 for t in proc if t["status"] == "resolved")
    escalated_ids = {r["ticket_id"] for r in db.query("SELECT DISTINCT ticket_id FROM handoffs WHERE kind = 'escalation'")}
    escalated = len(escalated_ids & processed_ids)

    results = db.query("SELECT payload FROM events WHERE kind = 'tool_result'")
    payloads = [db.loads(r["payload"]) for r in results]
    write_keys_ok: set[str] = set()
    blocked: dict[str, int] = {}
    deferrals = 0
    failures = 0
    for p in payloads:
        status = p.get("status")
        if p.get("permission") == "write" and status in {"ok", "already_done"}:
            write_keys_ok.add(p.get("idempotency_key") or f"{p.get('tool')}:{id(p)}")
        if status == "blocked":
            code = (p.get("data") or {}).get("code", "unknown")
            if code in POLICY_DEFERRAL_CODES:
                deferrals += 1
            else:
                blocked[code] = blocked.get(code, 0) + 1
        if status == "error":
            failures += 1
    retries = db.query_one("SELECT COUNT(*) AS n FROM events WHERE kind = 'tool_retry'")["n"]

    refunds = db.query("SELECT id FROM refunds")
    verified_ids = set()
    for r in db.query("SELECT payload FROM events WHERE kind = 'verification'"):
        p = db.loads(r["payload"])
        if p.get("confirmed"):
            verified_ids.add(p["refund_id"])
    refund_ids = {r["id"] for r in refunds}

    durations = [
        (parse_iso(r["finished_at"]) - parse_iso(r["started_at"])).total_seconds()
        for r in finished if r["finished_at"]
    ]
    approvals = db.query("SELECT status, COUNT(*) AS n FROM handoffs WHERE kind = 'approval' GROUP BY status")
    escalations = db.query("SELECT status, COUNT(*) AS n FROM handoffs WHERE kind = 'escalation' GROUP BY status")

    scenario = []
    for tkt, _cust, subject, label, _msg, _m in TICKETS:
        t = tickets.get(tkt)
        exp = EXPECTED[tkt]
        has_refund = bool(db.query_one("SELECT 1 FROM refunds WHERE ticket_id = ?", (tkt,)))
        ran = tkt in processed_ids
        ok = ran and t is not None and t["status"] in exp["statuses"] and (
            exp["refund"] is None or exp["refund"] == has_refund)
        scenario.append({"ticket_id": tkt, "scenario": label, "processed": ran,
                         "status": t["status"] if t else None, "expected": sorted(exp["statuses"]),
                         "refund_expected": exp["refund"], "refund_present": has_refund,
                         "match": ok if ran else None})
    checked = [s for s in scenario if s["processed"]]

    return {
        "label": "Prototype demonstration metrics on SYNTHETIC data since last reset. Not business results.",
        "cases_processed": processed,
        "agent_runs": len(finished),
        "autonomous_resolution_rate": _rate(resolved_auto, processed),
        "resolution_rate_incl_human": _rate(resolved_any, processed),
        "escalation_rate": _rate(escalated, processed),
        "verified_refund_rate": _rate(len(verified_ids & refund_ids), len(refund_ids)),
        "successful_write_actions": len(write_keys_ok),
        "blocked_actions": {"total": sum(blocked.values()), "by_code": blocked},
        "policy_deferrals": deferrals,
        "tool_failures": failures,
        "tool_retries": retries,
        "median_run_seconds": round(median(durations), 3) if durations else None,
        "approvals": {r["status"]: r["n"] for r in approvals},
        "escalations": {r["status"]: r["n"] for r in escalations},
        "scenario_check": {"rows": scenario, **_rate(sum(1 for s in checked if s["match"]), len(checked))},
    }
