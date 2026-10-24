import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Badge, Empty, ErrorBanner, Json, StatusBadge, ago, rupees } from "../components/ui";
import { IconCheck } from "../components/PaytmIcons";
import type { Handoff } from "../types";

export function Queue({ onChange }: { onChange: () => void }) {
  const [items, setItems] = useState<Handoff[] | null>(null);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    api.handoffs(filter === "pending" ? "pending" : undefined)
      .then(setItems)
      .catch((e) => setError(e.message));
  }, [filter]);

  useEffect(load, [load]);

  return (
    <div className="page queue-page">
      <div className="queue-header-row">
        <div>
          <h1>Human Review Queue</h1>
          <div className="muted">
            High-risk approvals requiring human authorization, and edge cases escalated by Resolv.
          </div>
        </div>
        <div className="filter-pills-bar" role="group" aria-label="Filter">
          <button
            className={`filter-pill ${filter === "pending" ? "active" : ""}`}
            onClick={() => setFilter("pending")}
          >
            Pending Review
          </button>
          <button
            className={`filter-pill ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All Decisions
          </button>
        </div>
      </div>

      <ErrorBanner error={error} />
      {!items && <Empty><span className="spinner" /></Empty>}
      {items?.length === 0 && (
        <div className="card">
          <Empty>Nothing waiting for a human. All cases were either resolved autonomously or not yet run.</Empty>
        </div>
      )}
      {notice && <div className="paytm-banner ok" role="status">{notice}</div>}
      
      <div className="stack" style={{ gap: 14 }}>
        {items?.map((h) => (
          <HandoffCard
            key={h.id}
            h={h}
            onDone={(msg) => {
              setNotice(msg);
              load();
              onChange();
            }}
          />
        ))}
      </div>
    </div>
  );
}

const WHY: Record<string, string> = {
  policy_exception: "Refund is eligible, but policy requires human sign-off above the ₹2,000 auto-refund threshold or for frequent refunders.",
  suspicious_request: "The customer's message showed manipulation patterns. Refunds on flagged requests strictly mandate human review.",
  customer_requested_human: "The customer explicitly asked to talk to a human agent.",
  ambiguous_request: "The agent could not unambiguously identify the transaction after one clarifying prompt.",
  merchant_dispute: "The payment succeeded on the rail; only a human operations lead can raise a merchant dispute.",
  pending_past_tat: "The payment has been pending past T+1 standard TAT; payments operations must investigate.",
  tool_failure: "A required banking switch kept failing after all retries, so Resolv stopped safely instead of guessing.",
  insufficient_evidence: "The agent could not confirm ledger and switch facts required by policy.",
  other: "Outside the agent's scope or it could not finish.",
  customer_not_notified: "The refund is verified in the ledger, but Resolv halted before notifying the customer. Send them the update and mark handled.",
};

const OUTCOME_TEXT: Record<string, string> = {
  resolved: "refund executed, verified in the ledger, ticket resolved and customer notified",
  escalated: "the action could not be completed, so the ticket was escalated again",
  closed: "ticket closed and the customer notified",
  awaiting_customer: "question sent to the customer",
};

function HandoffCard({ h, onDone }: { h: Handoff; onDone: (message: string) => void }) {
  const [reviewer, setReviewer] = useState("Support lead");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, any> | null>(null);
  const ev = h.evidence as Record<string, any>;
  const pol = ev?.policy as Record<string, any> | undefined;

  const decide = async (decision: string) => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.decide(h.id, decision, reviewer, note);
      setResult(r);
      const outcome = String(r.outcome ?? "");
      onDone(
        `${h.ticket_id}: ${decision.replace(/_/g, " ")} → ${OUTCOME_TEXT[outcome] ?? outcome}.` +
          (r.error ? ` ${String(r.error)}` : "")
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card handoff-card">
      <div className="card-h">
        <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
          <Badge tone={h.kind === "approval" ? "warn" : "bad"}>{h.kind.toUpperCase()}</Badge>
          <strong className="handoff-subject">{h.subject}</strong>
          <span className="muted small">
            {h.customer_name} · <a href={`#/cases/${h.ticket_id}`} className="mono ticket-link">{h.ticket_id}</a> · {ago(h.created_at)}
          </span>
        </div>
        <StatusBadge status={h.status} />
      </div>

      <div className="card-b queue-item-grid">
        <div className="stack evidence-col">
          <div className="handoff-summary-text">{h.summary}</div>
          <div className="small why-callout">
            <strong>Why a human is required:</strong> {WHY[h.reason_code] ?? h.reason_code}
          </div>

          {h.action && (
            <div className="small action-detail-pill">
              <strong>Proposed Action:</strong> <code>{h.action}</code>{" "}
              {h.amount_paise ? <span className="action-amount">· {rupees(h.amount_paise)}</span> : null}
            </div>
          )}

          {ev?.transaction && (
            <div className="small txn-evidence-row">
              <strong>Evidence:</strong> {ev.transaction.merchant} · App: {ev.transaction.app_status} ·
              Switch: <Badge tone={ev.switch_status === "FAILED" ? "warn" : "neutral"}>{String(ev.switch_status)}</Badge> ·
              Debit: {ev.transaction.debit_status}
            </div>
          )}

          {pol?.checks && (
            <ul className="checks">
              {pol.checks.map((c: any) => (
                <li key={c.name}>
                  <span className={c.passed ? "y" : "n"}>{c.passed ? "✓" : "✕"}</span>
                  <span><code>{c.name}</code> — {c.detail}</span>
                </li>
              ))}
            </ul>
          )}

          <Json value={h.evidence} label="Full Verification Evidence" />
          {h.result && <Json value={h.result} label="Decision Audit Record" />}
          {h.decided_by && (
            <div className="small muted decided-tag">
              Decided by {h.decided_by}{h.decision_note ? `: "${h.decision_note}"` : ""}
            </div>
          )}
        </div>

        {h.status === "pending" ? (
          <div className="stack decision-col">
            <label className="small muted" htmlFor={`rv-${h.id}`}>Reviewer Sign-off</label>
            <input
              id={`rv-${h.id}`}
              className="input"
              value={reviewer}
              onChange={(e) => setReviewer(e.target.value)}
            />
            <label className="small muted" htmlFor={`nt-${h.id}`}>Note to Customer (Optional)</label>
            <textarea
              id={`nt-${h.id}`}
              className="input"
              placeholder="Explanation sent to customer..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <ErrorBanner error={error} />
            
            {h.kind === "approval" ? (
              <div className="row decision-buttons-row">
                <button
                  className="btn primary pill-btn"
                  disabled={busy || !reviewer.trim()}
                  onClick={() => decide("approve")}
                >
                  <IconCheck /> Approve Refund
                </button>
                <button
                  className="btn danger pill-btn"
                  disabled={busy || !reviewer.trim()}
                  onClick={() => decide("reject")}
                >
                  Reject
                </button>
                <button
                  className="btn pill-btn"
                  disabled={busy || !reviewer.trim()}
                  onClick={() => decide("request_info")}
                >
                  Ask Customer
                </button>
              </div>
            ) : (
              <div className="row decision-buttons-row">
                <button
                  className="btn primary pill-btn"
                  disabled={busy || !reviewer.trim()}
                  onClick={() => decide("mark_handled")}
                >
                  <IconCheck /> Mark Handled
                </button>
                <button
                  className="btn pill-btn"
                  disabled={busy || !reviewer.trim()}
                  onClick={() => decide("request_info")}
                >
                  Ask Customer
                </button>
              </div>
            )}
            <div className="small muted help-text">
              Approving executes sandboxed refund &amp; ledger verification, records the human reviewer, and resolves the case.
            </div>
          </div>
        ) : (
          <div className="stack small resolved-decision-box">
            {result && (
              <div className="paytm-banner ok">
                {String(result.outcome)}{result.verified ? " · verified in ledger" : ""}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
