"""Gemini planner tests against a mocked HTTP transport. No network calls are made here."""
import json

import httpx
import pytest

from app import db
from app.agent import orchestrator as orch
from app.agent.llm import GeminiClient, LLMError
from app.agent.planners import LLMPlanner
from app.agent.providers import GeminiProvider

KEY = "test-key-not-real"


def fc(name, args, id_=None):
    return {"functionCall": {"name": name, "args": args, **({"id": id_} if id_ else {})}}


def candidate(parts, finish="STOP"):
    return {"candidates": [{"content": {"role": "model", "parts": parts}, "finishReason": finish}]}


def run_with(responses, ticket="TKT-1001"):
    """responses: list of (status, json) or callables(request)->(status, json)."""
    seen = []

    def handler(request: httpx.Request):
        seen.append(request)
        item = responses.pop(0)
        if callable(item):
            item = item(request)
        status, body = item
        return httpx.Response(status, json=body)

    client = GeminiClient(http=httpx.Client(transport=httpx.MockTransport(handler)), api_key=KEY)
    rid = orch.create_run(ticket, "llm")
    out = orch.execute_run(rid, planner_factory=lambda _e: LLMPlanner([GeminiProvider(client)]))
    return rid, out, seen


def events(rid, kind):
    return [e["payload"] for e in orch.run_events(rid) if e["kind"] == kind]


ASSESS = {"intent": "failed_debit", "target_txn_id": "UPI4021000101", "confidence": "high",
          "needs_clarification": False, "injection_suspected": False, "rationale": "explicit id"}


def test_happy_path_resolves_with_verified_refund(monkeypatch):
    monkeypatch.setattr("app.agent.llm.time.sleep", lambda _s: None)

    def verify_step(_req):
        refund_id = db.query_one("SELECT id FROM refunds")["id"]
        return 200, candidate([fc("verify_refund", {"refund_id": refund_id})])

    def finish_step(_req):
        refund_id = db.query_one("SELECT id FROM refunds")["id"]
        return 200, candidate([
            fc("update_ticket", {"ticket_id": "TKT-1001", "status": "resolved", "note": "verified"}),
            fc("reply_to_customer", {"ticket_id": "TKT-1001",
                                     "message": f"Your refund of Rs 450 has been processed ({refund_id})."}),
        ])

    responses = [
        (200, candidate([{"text": "Assessing.", "thoughtSignature": "sig-1"}, fc("record_assessment", ASSESS, "c1")])),
        (200, candidate([fc("check_switch_status", {"txn_id": "UPI4021000101"})])),
        (429, {"error": {"message": "slow down"}}),       # retried transparently
        (200, candidate([fc("issue_refund", {"txn_id": "UPI4021000101", "reason": "failed_debit"})])),
        verify_step,
        finish_step,
        (200, candidate([{"text": "Resolved."}])),
    ]
    rid, out, seen = run_with(responses)
    assert out == "resolved"
    req = seen[0]
    assert req.headers["x-goog-api-key"] == KEY and KEY not in str(req.url)       # key never in the URL
    assert str(req.url).endswith(":generateContent")
    body = json.loads(seen[1].content)
    assert body["contents"][1]["parts"][0]["thoughtSignature"] == "sig-1"        # model turn replayed verbatim
    resp_part = body["contents"][2]["parts"][0]["functionResponse"]
    assert resp_part["id"] == "c1" and resp_part["name"] == "record_assessment"
    last = json.loads(seen[-1].content)["contents"][-1]
    assert [p["functionResponse"]["name"] for p in last["parts"]] == ["update_ticket", "reply_to_customer"]
    decls = body["tools"][0]["functionDeclarations"]
    assert all("additionalProperties" not in d["parameters"] for d in decls)


@pytest.mark.parametrize("status,body,code", [
    (400, {"error": {"message": "API key not valid. Please pass a valid API key."}}, "auth_failed"),
    (404, {"error": {"message": "models/x is not found"}}, "model_not_found"),
    (429, {"error": {"message": "quota"}}, "rate_limited"),
])
def test_http_errors_fail_run_without_fallback(monkeypatch, status, body, code):
    monkeypatch.setattr("app.agent.llm.time.sleep", lambda _s: None)
    rid, out, _ = run_with([(status, body)] * 4)
    assert out == "escalated" and events(rid, "error")[0]["code"] == code
    assert db.query_one("SELECT status FROM runs WHERE id = ?", (rid,))["status"] == "failed"
    assert db.query("SELECT * FROM refunds") == [] and not db.query("SELECT * FROM messages WHERE role='agent'")


@pytest.mark.parametrize("payload,code", [
    (candidate([{"text": "x"}], "SAFETY"), "refusal"),
    (candidate([{"text": "x"}], "MAX_TOKENS"), "truncated"),
    (candidate([{"text": "x"}], "MALFORMED_FUNCTION_CALL"), "unexpected_stop"),
    ({"promptFeedback": {"blockReason": "SAFETY"}}, "refusal"),
])
def test_bad_finishes_are_errors(payload, code):
    rid, _, _ = run_with([(200, payload)])
    assert events(rid, "error")[0]["code"] == code


def test_gemini_cannot_bypass_policy():
    responses = [
        (200, candidate([fc("record_assessment", {**ASSESS, "target_txn_id": "UPI4021000601"})])),
        (200, candidate([fc("issue_refund", {"txn_id": "UPI4021000601", "reason": "failed_debit"})])),
        (200, candidate([fc("issue_refund", {"txn_id": "UPI4021000101", "reason": "failed_debit"})])),  # other customer
        (200, candidate([{"text": "done"}])),
    ]
    rid, out, _ = run_with(responses, ticket="TKT-1006")
    codes = [r["data"].get("code") for r in events(rid, "tool_result") if r["tool"] == "issue_refund"]
    assert codes == ["missing_evidence", "permission_denied"]
    assert db.query("SELECT * FROM refunds") == [] and out == "escalated"


def test_missing_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    with pytest.raises(LLMError) as e:
        GeminiClient()
    assert e.value.code == "missing_credentials"


def test_rate_limit_honours_retry_delay(monkeypatch):
    slept = []
    monkeypatch.setattr("app.agent.llm.time.sleep", slept.append)
    limited = {"error": {"code": 429, "message": "quota", "details": [
        {"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": "12s"}]}}
    rid, _, seen = run_with([(429, limited), (200, candidate([{"text": "nothing to do"}]))])
    assert slept == [12.5] and len(seen) == 2


def test_llm_failure_after_approval_queued_keeps_pending_approval(monkeypatch):
    monkeypatch.setattr("app.agent.llm.time.sleep", lambda _s: None)
    responses = [
        (200, candidate([fc("record_assessment", {**ASSESS, "target_txn_id": "UPI4021000201"})])),
        (200, candidate([fc("check_switch_status", {"txn_id": "UPI4021000201"})])),
        (200, candidate([fc("issue_refund", {"txn_id": "UPI4021000201", "reason": "failed_debit"})])),
    ] + [(429, {"error": {"message": "quota"}})] * 4
    rid, out, _ = run_with(responses, ticket="TKT-1002")
    assert out == "pending_approval"
    assert db.query_one("SELECT status, outcome FROM runs WHERE id = ?", (rid,)) == {"status": "failed",
                                                                                   "outcome": "pending_approval"}


def test_daily_quota_fails_fast(monkeypatch):
    slept = []
    monkeypatch.setattr("app.agent.llm.time.sleep", slept.append)
    daily = {"error": {"code": 429, "message": "You exceeded your current quota", "details": [
        {"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": "79525s"}]}}
    rid, out, seen = run_with([(429, daily)])
    assert slept == [] and len(seen) == 1 and events(rid, "error")[0]["code"] == "rate_limited"
