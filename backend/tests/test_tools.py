from app import db
from app.agent.orchestrator import create_run
from app.tools import adapters
from app.tools.registry import TOOLS, RunContext, anthropic_tool_definitions, execute


def make_ctx(ticket="TKT-1001", customer="CUST-001", assessed=True):
    run_id = create_run(ticket, "rules")
    return RunContext(run_id=run_id, ticket_id=ticket, customer_id=customer, actor="agent", engine="rules",
                      assessed=assessed)


def events(ctx, kind):
    return [db.loads(r["payload"]) for r in
            db.query("SELECT payload FROM events WHERE run_id = ? AND kind = ? ORDER BY seq", (ctx.run_id, kind))]


def test_unknown_tool_and_invalid_args_do_not_execute():
    ctx = make_ctx()
    assert execute(ctx, "transfer_money", {}).status == "error"
    r = execute(ctx, "issue_refund", {"txn_id": "UPI4021000101", "reason": "because", "amount": 99999})
    assert r.status == "invalid_args"
    assert db.query("SELECT * FROM refunds") == []


def test_context_tool_and_missing_customer():
    ctx = make_ctx()
    r = execute(ctx, "get_customer_context", {"customer_id": "CUST-001"})
    assert r.status == "ok" and r.data["customer"]["name"] == "Aarav Mehta"
    assert all("switch_status" not in t for t in r.data["recent_transactions"])  # ground truth hidden
    assert execute(ctx, "get_customer_context", {"customer_id": "CUST-999"}).status == "blocked"


def test_unknown_transaction_not_found():
    ctx = make_ctx()
    assert execute(ctx, "lookup_transaction", {"txn_id": "UPI9999999999"}).status == "not_found"


def test_cannot_touch_other_customers_transaction_or_ticket():
    ctx = make_ctx()
    r = execute(ctx, "lookup_transaction", {"txn_id": "UPI4021000201"})   # belongs to CUST-002
    assert r.status == "blocked" and r.data["code"] == "permission_denied"
    r = execute(ctx, "update_ticket", {"ticket_id": "TKT-1002", "status": "in_progress", "note": "x"})
    assert r.data["code"] == "permission_denied"


def test_refund_requires_assessment_and_switch_evidence():
    ctx = make_ctx(assessed=False)
    r = execute(ctx, "issue_refund", {"txn_id": "UPI4021000101", "reason": "failed_debit"})
    assert r.data["code"] == "assessment_required"
    ctx.assessed = True
    r = execute(ctx, "issue_refund", {"txn_id": "UPI4021000101", "reason": "failed_debit"})
    assert r.status == "blocked" and r.data["code"] == "missing_evidence"
    assert db.query("SELECT * FROM refunds") == []


def test_refund_success_persists_before_and_after_state_and_is_idempotent():
    ctx = make_ctx()
    before = db.query_one("SELECT reversed, reversal_ref FROM transactions WHERE id = 'UPI4021000101'")
    assert before == {"reversed": 0, "reversal_ref": None}
    assert execute(ctx, "check_switch_status", {"txn_id": "UPI4021000101"}).data["switch_status"] == "FAILED"
    r1 = execute(ctx, "issue_refund", {"txn_id": "UPI4021000101", "reason": "failed_debit"})
    assert r1.status == "ok" and r1.data["amount_rupees"] == 450
    after = db.query_one("SELECT reversed, reversal_ref FROM transactions WHERE id = 'UPI4021000101'")
    assert after == {"reversed": 1, "reversal_ref": r1.data["refund_id"]}
    r2 = execute(ctx, "issue_refund", {"txn_id": "UPI4021000101", "reason": "failed_debit"})
    assert r2.status == "already_done"
    assert len(db.query("SELECT * FROM refunds")) == 1
    v = execute(ctx, "verify_refund", {"refund_id": r1.data["refund_id"]})
    assert v.data["confirmed"] is True and r1.data["refund_id"] in ctx.verified_refunds


def test_ledger_double_call_returns_existing_row():
    a, created_a = adapters.refund_ledger.refund(txn_id="UPI4021000101", ticket_id="TKT-1001", reason="x",
                                                 created_by="agent", handoff_id=None)
    b, created_b = adapters.refund_ledger.refund(txn_id="UPI4021000101", ticket_id="TKT-1001", reason="x",
                                                 created_by="agent", handoff_id=None)
    assert created_a and not created_b and a["id"] == b["id"]


def test_outage_is_retried_then_fails():
    ctx = make_ctx("TKT-1005", "CUST-005")
    r = execute(ctx, "check_switch_status", {"txn_id": "UPI4021000501"})
    assert r.status == "error" and r.data["attempts"] == 3
    assert len(events(ctx, "tool_retry")) == 2  # 3 attempts = 2 retries
    assert "UPI4021000501" not in ctx.switch_evidence


def test_timeout_then_recovery():
    ctx = make_ctx()
    adapters.set_fault("payment_switch", "UPI4021000101", "timeout")
    assert execute(ctx, "check_switch_status", {"txn_id": "UPI4021000101"}).data["code"] == "adapter_timeout"
    adapters.set_fault("payment_switch", "UPI4021000101", None)
    assert execute(ctx, "check_switch_status", {"txn_id": "UPI4021000101"}).status == "ok"


def test_cannot_resolve_without_verified_refund():
    ctx = make_ctx()
    r = execute(ctx, "update_ticket", {"ticket_id": "TKT-1001", "status": "resolved", "note": "done"})
    assert r.status == "blocked" and r.data["code"] == "unverified_resolution"


def test_reply_claiming_unverified_refund_is_blocked():
    ctx = make_ctx()
    r = execute(ctx, "reply_to_customer", {"ticket_id": "TKT-1001",
                                           "message": "Your refund has been processed successfully."})
    assert r.status == "blocked" and r.data["code"] == "unverified_claim"
    ok = execute(ctx, "reply_to_customer", {"ticket_id": "TKT-1001", "message": "I'm checking your payment now."})
    assert ok.status == "ok"


def test_large_refund_goes_to_approval_queue_once():
    ctx = make_ctx("TKT-1002", "CUST-002")
    execute(ctx, "check_switch_status", {"txn_id": "UPI4021000201"})
    r1 = execute(ctx, "issue_refund", {"txn_id": "UPI4021000201", "reason": "failed_debit"})
    r2 = execute(ctx, "issue_refund", {"txn_id": "UPI4021000201", "reason": "failed_debit"})
    assert r1.status == "approval_required"
    assert r2.status == "blocked" and r2.data["code"] == "handed_to_human"  # agent cannot re-request
    assert len(db.query("SELECT * FROM handoffs WHERE kind = 'approval'")) == 1
    assert db.query("SELECT * FROM refunds") == []
    assert db.query_one("SELECT status FROM tickets WHERE id = 'TKT-1002'")["status"] == "pending_approval"


def test_tool_definitions_are_strict():
    defs = anthropic_tool_definitions()
    assert {d["name"] for d in defs} == set(TOOLS)
    for d in defs:
        s = d["input_schema"]
        assert d["strict"] is True and s["additionalProperties"] is False
        assert set(s["required"]) == set(s["properties"])
