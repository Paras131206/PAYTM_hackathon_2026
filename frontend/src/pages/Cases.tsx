import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import { Timeline } from "../components/Timeline";
import {
  Badge, Empty, EngineBadge, ErrorBanner, SandboxBadge, StatusBadge, ago, rupees, when,
} from "../components/ui";
import type { Customer, Engine, Health, RunDetail, TicketDetail, TicketListItem } from "../types";

const ACTIVE = new Set(["queued", "running"]);
const AGENT_RUNNABLE = new Set(["open", "in_progress", "awaiting_customer", "waiting_on_bank"]);

export function Cases({ ticketId, health, onChange }: {
  ticketId: string | null;
  health: Health | null;
  onChange: () => void;
}) {
  const [tickets, setTickets] = useState<TicketListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const loadList = useCallback(() => {
    api.tickets().then(setTickets).catch((e) => setError(e.message));
  }, []);
  useEffect(loadList, [loadList]);

  const selected = ticketId ?? tickets?.[0]?.id ?? null;

  return (
    <div className="page">
      <ErrorBanner error={error} />
      <div className="cases">
        <section className="card" aria-label="Support queue">
          <div className="card-h">
            <h2>Support queue</h2>
            <button className="btn sm" onClick={() => setCreating((v) => !v)}>{creating ? "Cancel" : "New case"}</button>
          </div>
          {creating && <NewCase onCreated={(id) => { setCreating(false); loadList(); location.hash = `#/cases/${id}`; onChange(); }} />}
          <div className="ticket-list">
            {!tickets && <Empty><span className="spinner" /></Empty>}
            {tickets?.length === 0 && <Empty>No tickets. Reset the demo to load scenarios.</Empty>}
            {tickets?.map((t) => (
              <a key={t.id} href={`#/cases/${t.id}`} className={`ticket-item ${t.id === selected ? "active" : ""}`}>
                <div className="row small" style={{ justifyContent: "space-between" }}>
                  <span className="mono muted">{t.id}</span>
                  <StatusBadge status={t.status} />
                </div>
                <div className="s">{t.subject}</div>
                <div className="p">{t.customer_name} · {t.first_message}</div>
                {t.scenario && t.scenario !== "custom" && <div className="small muted" style={{ marginTop: 4 }}>{t.scenario}</div>}
              </a>
            ))}
          </div>
        </section>
        {selected ? (
          <Workspace key={selected} ticketId={selected} health={health} onChange={() => { loadList(); onChange(); }} />
        ) : (
          <div className="card"><Empty>Select a ticket.</Empty></div>
        )}
      </div>
    </div>
  );
}

function NewCase({ onCreated }: { onCreated: (id: string) => void }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customer, setCustomer] = useState("CUST-001");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.customers().then(setCustomers).catch((e) => setError(e.message)); }, []);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.createTicket(customer, subject || "Payment issue", body);
      onCreated(r.ticket_id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card-b stack" style={{ borderBottom: "1px solid var(--border)" }}>
      <label className="small muted" htmlFor="nc-c">Customer (synthetic)</label>
      <select id="nc-c" className="input" value={customer} onChange={(e) => setCustomer(e.target.value)}>
        {customers.map((c) => <option key={c.id} value={c.id}>{c.id} · {c.name}</option>)}
      </select>
      <input className="input" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" />
      <textarea className="input" placeholder="Customer message" value={body} onChange={(e) => setBody(e.target.value)} aria-label="Customer message" />
      <ErrorBanner error={error} />
      <button className="btn primary" disabled={busy || !body.trim()} onClick={submit}>
        {busy ? "Creating…" : "Create and run agent"}
      </button>
    </div>
  );
}

function Workspace({ ticketId, health, onChange }: { ticketId: string; health: Health | null; onChange: () => void }) {
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [runId, setRunId] = useState<number | null>(null);
  const [run, setRun] = useState<RunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [engine, setEngine] = useState<Engine>(health?.engine ?? "rules");
  const [draft, setDraft] = useState("");
  const [beforeReversed, setBeforeReversed] = useState<Set<string>>(new Set());
  const timer = useRef<number | null>(null);

  useEffect(() => { if (health) setEngine(health.engine); }, [health]);

  const loadDetail = useCallback(async () => {
    const d = await api.ticket(ticketId);
    setDetail(d);
    return d;
  }, [ticketId]);

  useEffect(() => {
    loadDetail()
      .then((d) => {
        setRunId(d.runs[0]?.id ?? null);
        setBeforeReversed(new Set(d.transactions.filter((t) => t.reversed).map((t) => t.id)));
      })
      .catch((e) => setError(e.message));
  }, [loadDetail]);

  // Poll the selected run while it is active; refresh the ticket when it finishes.
  useEffect(() => {
    if (runId === null) { setRun(null); return; }
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await api.run(runId);
        if (cancelled) return;
        setRun(r);
        if (ACTIVE.has(r.run.status)) {
          timer.current = window.setTimeout(tick, 700);
        } else {
          await loadDetail();
          onChange();
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      }
    };
    tick();
    return () => { cancelled = true; if (timer.current) window.clearTimeout(timer.current); };
  }, [runId, loadDetail]); // eslint-disable-line react-hooks/exhaustive-deps

  const startRun = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.startRun(ticketId, engine);
      setRunId(r.run_id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const sendAsCustomer = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.sendMessage(ticketId, draft);
      setDraft("");
      await loadDetail();
      if (r.run_id) setRunId(r.run_id);
      if (r.note) setError(r.note);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!detail) return <div className="card"><ErrorBanner error={error} />{!error && <Empty><span className="spinner" /></Empty>}</div>;

  const t = detail.ticket;
  const running = run ? ACTIVE.has(run.run.status) : false;
  const runnable = AGENT_RUNNABLE.has(t.status);
  const pending = detail.handoffs.filter((h) => h.status === "pending");

  return (
    <div className="stack" style={{ gap: 12 }}>
      <section className="card">
        <div className="card-h" style={{ flexWrap: "wrap" }}>
          <div className="grow">
            <div className="row small muted"><span className="mono">{t.id}</span> · opened {ago(t.created_at)} · {t.channel.replace("_", " ")}</div>
            <div className="row"><h1>{t.subject}</h1><StatusBadge status={t.status} />
              {t.priority === "high" && <Badge tone="bad">high priority</Badge>}</div>
            {t.scenario && t.scenario !== "custom" && <div className="small muted">Demo scenario: {t.scenario}</div>}
          </div>
          <div className="row">
            <label className="small muted" htmlFor="engine">Engine</label>
            <select id="engine" className="input" style={{ width: "auto" }} value={engine}
              onChange={(e) => setEngine(e.target.value as Engine)}>
              <option value="claude" disabled={!health?.claude_configured}>
                Claude{health?.claude_configured ? "" : " (no API key)"}
              </option>
              <option value="gemini" disabled={!health?.gemini_configured}>
                Gemini{health?.gemini_configured ? "" : " (no API key)"}
              </option>
              <option value="rules">Rules engine (no LLM)</option>
            </select>
            <button className="btn primary" onClick={startRun} disabled={busy || running || !runnable}
              title={runnable ? "Run the AI teammate on this ticket" : `Ticket is ${t.status}; a human owns it`}>
              {running ? "Working…" : "Run Resolv"}
            </button>
          </div>
        </div>
        {(error || pending.length > 0) && (
          <div className="card-b stack">
            <ErrorBanner error={error} />
            {pending.map((h) => (
              <div key={h.id} className="banner warn">
                <strong>{h.kind === "approval" ? "Waiting for human approval" : "Escalated to a human"}</strong>
                {" "}— {h.summary} <a href="#/queue">Open human queue →</a>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="workspace">
        <CustomerPanel detail={detail} beforeReversed={beforeReversed} />

        <section className="card" aria-label="Conversation">
          <div className="card-h"><h2>Conversation</h2><span className="small muted">{detail.messages.length} messages</span></div>
          <div className="thread">
            {detail.messages.map((m) => (
              <div key={m.id} className={`msg ${m.role}`}>
                <div className="meta">{m.role === "agent" ? `Resolv (${m.author.replace("resolv:", "")})` : m.role === "customer" ? detail.customer.name : m.author} · {when(m.created_at)}</div>
                <div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div>
              </div>
            ))}
          </div>
          <div className="card-b stack" style={{ borderTop: "1px solid var(--border)" }}>
            <label className="small muted" htmlFor="composer">Simulate the customer's next message</label>
            <textarea id="composer" className="input" value={draft} onChange={(e) => setDraft(e.target.value)}
              placeholder={t.status === "awaiting_customer" ? "e.g. It was the Big Bazaar one, Rs 650" : "Type as the customer"} />
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="small muted">Replies appear in this in-app thread only. No SMS or email is sent.</span>
              <button className="btn" disabled={busy || !draft.trim()} onClick={sendAsCustomer}>Send as customer</button>
            </div>
          </div>
        </section>

        <section className="card" aria-label="Agent run">
          <div className="card-h">
            <h2>Agent run</h2>
            <div className="row">
              {detail.runs.length > 1 && (
                <select className="input" style={{ width: "auto" }} value={runId ?? ""} aria-label="Select run"
                  onChange={(e) => setRunId(Number(e.target.value))}>
                  {detail.runs.map((r) => <option key={r.id} value={r.id}>Run #{r.id} · {r.engine} · {r.outcome ?? r.status}</option>)}
                </select>
              )}
            </div>
          </div>
          {run ? (
            <>
              <div className="card-b row small" style={{ borderBottom: "1px solid var(--border)" }}>
                <span className="mono">#{run.run.id}</span>
                <EngineBadge engine={run.run.engine} model={run.run.model} />
                <StatusBadge status={run.run.status} />
                {run.run.outcome && <span>→ <StatusBadge status={run.run.outcome} /></span>}
                <span className="muted">{run.run.turns} planner turns</span>
                {run.run.error && <Badge tone="bad" title={run.run.error}>error</Badge>}
              </div>
              <Timeline events={run.events} />
            </>
          ) : (
            <Empty>No run yet. Press <strong>Run Resolv</strong> to let the AI teammate work this ticket.</Empty>
          )}
        </section>
      </div>
    </div>
  );
}

function CustomerPanel({ detail, beforeReversed }: { detail: TicketDetail; beforeReversed: Set<string> }) {
  const c = detail.customer;
  return (
    <section className="card" aria-label="Customer context">
      <div className="card-h"><h2>Customer context</h2><Badge>synthetic</Badge></div>
      <div className="card-b stack">
        <dl className="kv">
          <dt>Name</dt><dd>{c.name} <span className="muted mono">{c.id}</span></dd>
          <dt>Phone</dt><dd>{c.phone_masked}</dd>
          <dt>KYC</dt><dd>{c.kyc_level} · {c.tier}</dd>
        </dl>
        <h3 style={{ marginTop: 8 }}>Transactions</h3>
        {detail.transactions.map((t) => {
          const changed = !!t.reversed && !beforeReversed.has(t.id);
          return (
            <div key={t.id} className={`txn ${changed ? "changed" : ""}`}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>{rupees(t.amount_paise)}</strong>
                <span className="small muted">{when(t.created_at)}</span>
              </div>
              <div className="small">{t.merchant} · <span className="mono">{t.id}</span></div>
              <div className="row small">
                <span className="muted">App:</span><StatusBadge status={t.app_status.toLowerCase()} />
                <span className="muted">Switch:</span><Badge tone="neutral" title="Sandbox ground truth. The agent learns it only by calling check_switch_status.">{t.switch_status}</Badge>
                {t.reversed ? <Badge tone="ok">refunded · {t.reversal_ref}</Badge> : null}
                {changed && <Badge tone="ok">changed in this session</Badge>}
              </div>
            </div>
          );
        })}
        <h3 style={{ marginTop: 8 }}>Refund ledger <SandboxBadge /></h3>
        {detail.refunds.length === 0 ? <div className="small muted">No refunds.</div> : (
          <table className="small">
            <tbody>
              {detail.refunds.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.id}</td>
                  <td className="num">{rupees(r.amount_paise)}</td>
                  <td><Badge tone={r.status === "SUCCESS" ? "ok" : "bad"}>{r.status}</Badge></td>
                  <td className="muted">{r.created_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <h3 style={{ marginTop: 8 }}>Prior tickets</h3>
        {detail.prior_tickets.length === 0 ? <div className="small muted">None.</div> :
          detail.prior_tickets.map((p) => (
            <div key={p.id} className="small row"><span className="mono muted">{p.id}</span>{p.subject}<StatusBadge status={p.status} /></div>
          ))}
      </div>
    </section>
  );
}
