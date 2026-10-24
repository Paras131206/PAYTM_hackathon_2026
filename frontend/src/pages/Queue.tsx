import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Badge, Empty, ErrorBanner, Json, StatusBadge, ago, rupees } from "../components/ui";
import type { Handoff } from "../types";

export function Queue({ onChange }: { onChange: () => void }) {
  const [items, setItems] = useState<Handoff[] | null>(null);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.handoffs(filter === "pending" ? "pending" : undefined).then(setItems).catch((e) => setError(e.message));
  }, [filter]);
  useEffect(load, [load]);

  return (
    <div className="page">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h1>Human queue</h1>
          <div className="muted">Approvals the AI teammate is not allowed to make on its own, and cases it handed over.</div>
        </div>
        <div className="row" role="group" aria-label="Filter">
          <button className={`btn sm ${filter === "pending" ? "primary" : ""}`} onClick={() => setFilter("pending")}>Pending</button>
          <button className={`btn sm ${filter === "all" ? "primary" : ""}`} onClick={() => setFilter("all")}>All</button>
        </div>
      </div>
      <ErrorBanner error={error} />
      {!items && <Empty><span className="spinner" /></Empty>}
      {items?.length === 0 && <div className="card"><Empty>Nothing waiting for a human. Run the demo scenarios from the Cases page.</Empty></div>}
      {items?.map((h) => <HandoffCard key={h.id} h={h} onDone={() => { load(); onChange(); }} />)}
    </div>
  );
}

const WHY: Record<string, string> = {
  policy_exception: "Refund is eligible, but policy requires a human above the auto-refund limit or for frequent refunds.",
  suspicious_request: "The customer's message tried to manipulate the agent. Refunds on flagged requests always need a human.",
  customer_requested_human: "The customer asked for a person.",
  ambiguous_request: "The agent could not identify the payment after one clarifying question.",
  merchant_dispute: "The payment succeeded; only a human can raise a merchant dispute.",
  pending_past_tat: "The payment has been pending past T+1; payments operations must investigate.",
  tool_failure: "A required system kept failing after retries, so the agent stopped instead of guessing.",
  insufficient_evidence: "The agent could not confirm the facts it needed.",
  other: "Outside the agent's scope or it could not finish.",
  customer_not_notified: "The refund is done and verified, but the agent stopped before telling the customer. Send them the outcome (use the note box) and mark handled.",
};

function HandoffCard({ h, onDone }: { h: Handoff; onDone: () => void }) {
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
      onDone();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card">
      <div className="card-h">
        <div className="row">
          <Badge tone={h.kind === "approval" ? "warn" : "bad"}>{h.kind}</Badge>
          <strong>{h.subject}</strong>
          <span className="muted small">{h.customer_name} · <a href={`#/cases/${h.ticket_id}`}>{h.ticket_id}</a> · {ago(h.created_at)}</span>
        </div>
        <StatusBadge status={h.status} />
      </div>
      <div className="card-b queue-item">
        <div className="stack">
          <div>{h.summary}</div>
          <div className="small"><strong>Why a human:</strong> {WHY[h.reason_code] ?? h.reason_code}</div>
          {h.action && (
            <div className="small">
              <strong>Proposed action:</strong> <code>{h.action}</code>{" "}
              <code>{JSON.stringify(h.args)}</code>{h.amount_paise ? <> · <strong>{rupees(h.amount_paise)}</strong></> : null}
            </div>
          )}
          {ev?.transaction && (
            <div className="small">
              <strong>Evidence:</strong> {ev.transaction.merchant} · app status {ev.transaction.app_status} ·
              switch status <Badge tone={ev.switch_status === "FAILED" ? "warn" : "neutral"}>{String(ev.switch_status)}</Badge> ·
              debit {ev.transaction.debit_status}
            </div>
          )}
          {pol?.checks && (
            <ul className="checks">
              {pol.checks.map((c: any) => (
                <li key={c.name}><span className={c.passed ? "y" : "n"}>{c.passed ? "✓" : "✕"}</span><span><code>{c.name}</code> — {c.detail}</span></li>
              ))}
            </ul>
          )}
          <Json value={h.evidence} label="All evidence" />
          {h.result && <Json value={h.result} label="Decision result" />}
          {h.decided_by && <div className="small muted">Decided by {h.decided_by}{h.decision_note ? `: "${h.decision_note}"` : ""}</div>}
        </div>
        {h.status === "pending" ? (
          <div className="stack">
            <label className="small muted" htmlFor={`rv-${h.id}`}>Reviewer</label>
            <input id={`rv-${h.id}`} className="input" value={reviewer} onChange={(e) => setReviewer(e.target.value)} />
            <label className="small muted" htmlFor={`nt-${h.id}`}>Note to customer (optional)</label>
            <textarea id={`nt-${h.id}`} className="input" value={note} onChange={(e) => setNote(e.target.value)} />
            <ErrorBanner error={error} />
            {h.kind === "approval" ? (
              <div className="row">
                <button className="btn primary" disabled={busy || !reviewer.trim()} onClick={() => decide("approve")}>Approve refund</button>
                <button className="btn danger" disabled={busy || !reviewer.trim()} onClick={() => decide("reject")}>Reject</button>
                <button className="btn" disabled={busy || !reviewer.trim()} onClick={() => decide("request_info")}>Ask for info</button>
              </div>
            ) : (
              <div className="row">
                <button className="btn primary" disabled={busy || !reviewer.trim()} onClick={() => decide("mark_handled")}>Mark handled</button>
                <button className="btn" disabled={busy || !reviewer.trim()} onClick={() => decide("request_info")}>Ask customer</button>
              </div>
            )}
            <div className="small muted">Approving runs the same refund and verify tools, re-checks the switch, and records you as the actor.</div>
          </div>
        ) : (
          <div className="stack small">
            {result && <div className="banner">{String(result.outcome)}{result.verified ? " · refund verified" : ""}</div>}
          </div>
        )}
      </div>
    </section>
  );
}
