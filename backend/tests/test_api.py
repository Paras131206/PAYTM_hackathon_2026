"""HTTP contract tests. TestClient runs background tasks before returning, so runs are complete on return."""
import pytest
from fastapi.testclient import TestClient

from app import db
from app.api import app
from app.config import settings


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(settings, "resolved_engine", "rules")
    with TestClient(app) as c:
        yield c


def test_health_and_system(client):
    h = client.get("/api/health").json()
    assert h["status"] == "ok" and h["engine"] == "rules"
    s = client.get("/api/system").json()
    modes = {i["name"]: i["mode"] for i in s["integrations"]}
    assert modes["Payment switch"] == "sandbox" and modes["Refund ledger"] == "sandbox"
    assert {t["name"] for t in s["tools"]} >= {"issue_refund", "verify_refund", "escalate_to_human"}


def test_ticket_list_and_detail(client):
    tickets = client.get("/api/tickets").json()
    assert len(tickets) == 8 and all(t["id"] != "TKT-0901" for t in tickets)
    d = client.get("/api/tickets/TKT-1001").json()
    assert d["customer"]["name"] == "Aarav Mehta" and d["messages"][0]["role"] == "customer"
    assert client.get("/api/tickets/NOPE").status_code == 404


def test_run_end_to_end_and_events(client):
    r = client.post("/api/tickets/TKT-1001/runs", json={})
    assert r.status_code == 202
    run = client.get(f"/api/runs/{r.json()['run_id']}").json()
    assert run["run"]["status"] == "finished" and run["run"]["outcome"] == "resolved"
    kinds = {e["kind"] for e in run["events"]}
    assert {"context", "assessment", "tool_call", "tool_result", "policy_check", "verification", "outcome"} <= kinds
    d = client.get("/api/tickets/TKT-1001").json()
    txn = next(t for t in d["transactions"] if t["id"] == "UPI4021000101")
    assert txn["reversed"] == 1 and d["refunds"][0]["txn_id"] == "UPI4021000101"


def test_request_validation(client):
    assert client.post("/api/tickets/TKT-1001/runs", json={"engine": "gpt"}).status_code == 422
    assert client.post("/api/tickets/TKT-1001/messages", json={"body": ""}).status_code == 422
    assert client.post("/api/tickets/TKT-1001/messages", json={"body": "x", "admin": True}).status_code == 422


def test_claude_engine_without_key_is_refused_explicitly(client, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    r = client.post("/api/tickets/TKT-1001/runs", json={"engine": "claude"})
    assert r.status_code == 400 and "not configured" in r.json()["detail"]
    assert db.query("SELECT * FROM runs") == []


def test_clarification_conversation_over_http(client):
    client.post("/api/tickets/TKT-1004/runs", json={})
    assert client.get("/api/tickets/TKT-1004").json()["ticket"]["status"] == "awaiting_customer"
    r = client.post("/api/tickets/TKT-1004/messages", json={"body": "The Zomato one, Rs 300"})
    assert r.status_code == 201 and r.json()["run_id"]
    assert client.get("/api/tickets/TKT-1004").json()["ticket"]["status"] == "resolved"


def test_message_to_escalated_ticket_does_not_rerun_agent(client):
    client.post("/api/tickets/TKT-1008/runs", json={})
    r = client.post("/api/tickets/TKT-1008/messages", json={"body": "hello?"}).json()
    assert r["run_id"] is None and "human" in r["note"]
    assert client.post("/api/tickets/TKT-1008/runs", json={}).status_code == 409


def test_approval_queue_over_http(client):
    client.post("/api/tickets/TKT-1002/runs", json={})
    pending = client.get("/api/handoffs", params={"status": "pending"}).json()
    assert len(pending) == 1 and pending[0]["kind"] == "approval" and pending[0]["amount_paise"] == 850000
    hid = pending[0]["id"]
    bad = client.post(f"/api/handoffs/{hid}/decision", json={"decision": "mark_handled", "reviewer": "A"})
    assert bad.status_code == 400
    ok = client.post(f"/api/handoffs/{hid}/decision", json={"decision": "approve", "reviewer": "Asha"})
    assert ok.status_code == 200 and ok.json()["verified"] is True
    again = client.post(f"/api/handoffs/{hid}/decision", json={"decision": "approve", "reviewer": "Asha"})
    assert again.status_code == 409


def test_new_ticket_custom_message(client):
    r = client.post("/api/tickets", json={"customer_id": "CUST-001", "subject": "Failed payment",
                                          "body": "Rs 450 debited for UPI4021000101 but failed"})
    assert r.status_code == 201
    tid = r.json()["ticket_id"]
    assert client.get(f"/api/tickets/{tid}").json()["ticket"]["status"] == "resolved"


def test_fault_toggle_and_metrics_and_reset(client):
    client.post("/api/sandbox/faults", json={"adapter": "payment_switch", "target": "*", "mode": "outage"})
    client.post("/api/tickets/TKT-1001/runs", json={})
    m = client.get("/api/metrics").json()
    assert m["tool_failures"] == 1 and m["escalation_rate"]["numerator"] == 1
    assert "SYNTHETIC" in m["label"]
    assert client.post("/api/demo/reset").json()["status"] == "reset"
    assert client.get("/api/metrics").json()["cases_processed"] == 0
