import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import {
  Badge, Empty, EngineBadge, ErrorBanner, SandboxBadge, StatusBadge, ago, rupees, when,
} from "../components/ui";

import {
  IconArrowRight,
  IconCases,
  IconChevronRight,
  IconSparkles,
} from "../components/PaytmIcons";
import type { Customer, Engine, Health, RunDetail, TicketDetail, TicketListItem } from "../types";

const ACTIVE = new Set(["queued", "running"]);
const AGENT_RUNNABLE = new Set(["open", "in_progress", "awaiting_customer", "waiting_on_bank"]);

type FilterTab = "all" | "actionable" | "awaiting" | "pending_approval" | "resolved" | "escalated";

export function Cases({
  ticketId,
  health,
  onChange,
}: {
  ticketId: string | null;
  health: Health | null;
  onChange: () => void;
}) {
  const [tickets, setTickets] = useState<TicketListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<FilterTab>("all");

  const loadList = useCallback(() => {
    api.tickets().then(setTickets).catch((e) => setError(e.message));
  }, []);
  useEffect(loadList, [loadList]);

  const filteredTickets = (tickets ?? []).filter((t) => {
    if (filter === "actionable") return AGENT_RUNNABLE.has(t.status);
    if (filter === "awaiting") return t.status === "awaiting_customer";
    if (filter === "pending_approval") return t.status === "pending_approval";
    if (filter === "resolved") return t.status === "resolved" || t.status === "closed";
    if (filter === "escalated") return t.status === "escalated";
    return true;
  });

  // Auto-normalize ticket ID if TCK- was entered instead of TKT-
  const normalizedId = ticketId?.replace(/^TCK-/i, "TKT-") ?? null;

  useEffect(() => {
    if (ticketId && /^TCK-/i.test(ticketId)) {
      location.hash = `#/cases/${ticketId.replace(/^TCK-/i, "TKT-")}`;
    }
  }, [ticketId]);

  const ticketExists = tickets ? tickets.some((t) => t.id === normalizedId) : true;
  const selected = (normalizedId && ticketExists)
    ? normalizedId
    : (filteredTickets[0]?.id ?? tickets?.[0]?.id ?? null);

  return (
    <div className="page cases-page">
      <ErrorBanner error={error} />
      
      <div className="cases-layout">
        {/* Cases List Sidebar (Image 1 Screen 3 Style) */}
        <section className="card ticket-sidebar-card" aria-label="Support cases list">
          <div className="card-h">
            <div>
              <h2>Support Cases</h2>
              <span className="small muted">{filteredTickets.length} of {tickets?.length ?? 0} tickets</span>
            </div>
            <button className="btn sm primary pill-btn" onClick={() => setCreating((v) => !v)}>
              {creating ? "Cancel" : "+ New Case"}
            </button>
          </div>

          {creating && (
            <NewCase
              onCreated={(id) => {
                setCreating(false);
                loadList();
                location.hash = `#/cases/${id}`;
                onChange();
              }}
            />
          )}

          {/* Filter Pills (Image 1 Tab Bar) */}
          <div className="filter-pills-bar" role="tablist" aria-label="Ticket status filters">
            <button
              className={`filter-pill ${filter === "all" ? "active" : ""}`}
              onClick={() => setFilter("all")}
            >
              All
            </button>
            <button
              className={`filter-pill ${filter === "actionable" ? "active" : ""}`}
              onClick={() => setFilter("actionable")}
            >
              Actionable
            </button>
            <button
              className={`filter-pill ${filter === "awaiting" ? "active" : ""}`}
              onClick={() => setFilter("awaiting")}
            >
              Awaiting
            </button>
            <button
              className={`filter-pill ${filter === "pending_approval" ? "active" : ""}`}
              onClick={() => setFilter("pending_approval")}
            >
              Approval
            </button>
            <button
              className={`filter-pill ${filter === "resolved" ? "active" : ""}`}
              onClick={() => setFilter("resolved")}
            >
              Resolved
            </button>
          </div>

          <div className="ticket-list">
            {!tickets && <Empty><span className="spinner" /></Empty>}
            {tickets && filteredTickets.length === 0 && (
              <Empty>No tickets match this filter. Reset demo or select 'All'.</Empty>
            )}
            {filteredTickets.map((t) => (
              <a
                key={t.id}
                href={`#/cases/${t.id}`}
                className={`ticket-item-card ${t.id === selected ? "active" : ""}`}
              >
                <div className="ticket-item-icon">
                  <IconCases />
                </div>
                <div className="ticket-item-body">
                  <div className="ticket-item-header">
                    <span className="mono ticket-id">{t.id}</span>
                    <StatusBadge status={t.status} />
                  </div>
                  <div className="ticket-item-subject">{t.subject}</div>
                  <div className="ticket-item-preview">
                    {t.customer_name} · {t.first_message}
                  </div>
                  {t.scenario && t.scenario !== "custom" && (
                    <div className="ticket-scenario-tag">{t.scenario}</div>
                  )}
                </div>
                <div className="ticket-item-chevron">
                  <IconChevronRight />
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* Selected Workspace */}
        {selected ? (
          <Workspace
            key={selected}
            ticketId={selected}
            health={health}
            onChange={() => {
              loadList();
              onChange();
            }}
          />
        ) : (
          <div className="card empty-workspace">
            <Empty>Select a ticket to inspect context and run the agent.</Empty>
          </div>
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

  useEffect(() => {
    api.customers().then(setCustomers).catch((e) => setError(e.message));
  }, []);

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
    <div className="card-b stack new-case-form">
      <label className="small muted" htmlFor="nc-c">Select Customer (Synthetic Demo)</label>
      <select id="nc-c" className="input" value={customer} onChange={(e) => setCustomer(e.target.value)}>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>{c.id} · {c.name}</option>
        ))}
      </select>
      <input
        className="input"
        placeholder="Subject (e.g. ₹650 debited at Big Bazaar)"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        aria-label="Subject"
      />
      <textarea
        className="input"
        placeholder="Customer complaint message..."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        aria-label="Customer message"
      />
      <ErrorBanner error={error} />
      <button className="btn primary pill-btn" disabled={busy || !body.trim()} onClick={submit}>
        {busy ? "Creating…" : "Create & Run Resolv →"}
      </button>
    </div>
  );
}

function Workspace({
  ticketId,
  health,
  onChange,
}: {
  ticketId: string;
  health: Health | null;
  onChange: () => void;
}) {
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [runId, setRunId] = useState<number | null>(null);
  const [run, setRun] = useState<RunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [engine, setEngine] = useState<Engine>(health?.engine ?? "rules");
  const [draft, setDraft] = useState("");
  const [beforeReversed, setBeforeReversed] = useState<Set<string>>(new Set());
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (health) setEngine(health.engine);
  }, [health]);

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
    return () => {
      cancelled = true;
      if (timer.current) window.clearTimeout(timer.current);
    };
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
      const r = await api.sendMessage(ticketId, draft, engine);
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

  if (!detail) {
    return (
      <div className="card workspace-card" style={{ padding: 24 }}>
        <ErrorBanner error={error} />
        {error ? (
          <div style={{ marginTop: 14 }}>
            <p className="muted small">
              The ticket <code>{ticketId}</code> could not be loaded. You can select another case from the sidebar or click below:
            </p>
            <button
              className="btn primary sm pill-btn"
              onClick={() => {
                location.hash = "#/cases/TKT-1001";
              }}
            >
              Open Case TKT-1001 →
            </button>
          </div>
        ) : (
          <Empty><span className="spinner" /></Empty>
        )}
      </div>
    );
  }

  const t = detail.ticket;
  const running = run ? ACTIVE.has(run.run.status) : false;
  const runnable = AGENT_RUNNABLE.has(t.status);
  const pending = detail.handoffs.filter((h) => h.status === "pending");

  return (
    <div className="stack workspace-stack">
      {/* Ticket Action Header */}
      <section className="card ticket-header-card">
        <div className="ticket-header-main">
          <div className="grow">
            <div className="row small muted">
              <span className="mono ticket-id-badge">{t.id}</span>
              <span>· opened {ago(t.created_at)}</span>
              <span>· {t.channel.replace("_", " ")}</span>
            </div>
            <div className="row" style={{ marginTop: 4 }}>
              <h1 className="ticket-title">{t.subject}</h1>
              <StatusBadge status={t.status} />
              {t.priority === "high" && <Badge tone="bad">high priority</Badge>}
            </div>
            {t.scenario && t.scenario !== "custom" && (
              <div className="small muted" style={{ marginTop: 4 }}>
                Scenario: <strong>{t.scenario}</strong>
              </div>
            )}
          </div>

          <div className="ticket-controls-box">
            <div className="engine-select-wrap">
              <label className="small muted" htmlFor="engine">Engine</label>
              <select
                id="engine"
                className="input select-engine"
                value={engine}
                onChange={(e) => setEngine(e.target.value as Engine)}
              >
                <option value="llm" disabled={!health?.llm_configured}>
                  LLM with Failover{health?.llm_configured ? "" : " (no provider configured)"}
                </option>
                <option value="rules">Rules Engine (no LLM)</option>
              </select>
            </div>
            <button
              className="btn primary run-resolv-btn"
              onClick={startRun}
              disabled={busy || running || !runnable}
              title={runnable ? "Run the AI teammate on this ticket" : `Ticket is ${t.status}; a human owns it`}
            >
              <IconSparkles />
              <span>{running ? "Resolv Working…" : "Run Resolv →"}</span>
            </button>
          </div>
        </div>

        {(error || pending.length > 0) && (
          <div className="card-b stack" style={{ borderTop: "1px solid var(--border)" }}>
            <ErrorBanner error={error} />
            {pending.map((h) => (
              <div key={h.id} className="paytm-banner warn">
                <strong>{h.kind === "approval" ? "Waiting for human approval" : "Escalated to human lead"}</strong>
                {" "}— {h.summary}{" "}
                <a href="#/queue" className="banner-link">Open human queue →</a>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3-Column Workspace Grid */}
      <div className="workspace-columns">
        {/* Customer Context Panel */}
        <CustomerPanel detail={detail} beforeReversed={beforeReversed} />

        {/* Conversation Thread */}
        <section className="card thread-card" aria-label="Conversation">
          <div className="card-h">
            <div>
              <h2>Customer Thread</h2>
              <span className="small muted">{detail.messages.length} messages</span>
            </div>
            <a
              href={`#/execution/${detail.ticket.id}${runId ? `/${runId}` : ""}`}
              className="btn sm primary pill-btn thread-execution-btn"
              title="Open autonomous agent execution & timeline in dedicated tab"
            >
              <IconSparkles />
              <span>Agent Execution →</span>
            </a>
          </div>

          <div className="thread">
            {detail.messages.map((m) => (
              <div key={m.id} className={`msg ${m.role}`}>
                <div className="meta">
                  <span className="author-name">
                    {m.role === "agent"
                      ? `Paytm Resolv (${m.author.replace("resolv:", "")})`
                      : m.role === "customer"
                      ? detail.customer.name
                      : m.author}
                  </span>
                  <span className="msg-time">· {when(m.created_at)}</span>
                </div>
                <div className="msg-body">{m.body}</div>
              </div>
            ))}
          </div>

          {/* Quick Execution Status Strip */}
          {run && (
            <div className="card-b row small thread-run-strip">
              <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span className="mono bold run-id-tag">Run #{run.run.id}</span>
                <EngineBadge engine={run.run.engine} model={run.run.model} />
                <StatusBadge status={run.run.status} />
                {run.run.outcome && <span>→ <StatusBadge status={run.run.outcome} /></span>}
                <span className="muted">{run.run.turns} turns</span>
              </div>
              <a
                href={`#/execution/${detail.ticket.id}/${run.run.id}`}
                className="banner-link small bold"
              >
                View Full Timeline &amp; Tool Trace →
              </a>
            </div>
          )}

          <div className="card-b stack composer-box">
            <label className="small muted" htmlFor="composer">Simulate Customer Reply</label>
            <textarea
              id="composer"
              className="input composer-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={
                t.status === "awaiting_customer"
                  ? "e.g. It was the Big Bazaar one, Rs 650"
                  : "Type a customer reply..."
              }
            />
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="small muted">In-app thread only. No SMS/email sent.</span>
              <button
                className="btn primary sm pill-btn"
                disabled={busy || !draft.trim()}
                onClick={sendAsCustomer}
              >
                Send as Customer <IconArrowRight />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}


function CustomerPanel({
  detail,
  beforeReversed,
}: {
  detail: TicketDetail;
  beforeReversed: Set<string>;
}) {
  const c = detail.customer;
  return (
    <section className="card customer-context-card" aria-label="Customer context">
      <div className="card-h">
        <h2>Customer Context</h2>
        <Badge tone="neutral">synthetic</Badge>
      </div>

      <div className="card-b stack">
        {/* Customer Profile Pill */}
        <div className="customer-info-box">
          <div className="customer-avatar-badge">{c.name.charAt(0)}</div>
          <div>
            <div className="customer-name-row">
              <strong>{c.name}</strong>
              <span className="mono small muted">{c.id}</span>
            </div>
            <div className="customer-meta-row">
              <span>{c.phone_masked}</span> · <span className="kyc-badge">KYC {c.kyc_level}</span> · <span className="tier-tag">{c.tier}</span>
            </div>
          </div>
        </div>

        <h3 className="section-subhead">Recent Transactions</h3>
        <div className="txns-list">
          {detail.transactions.map((t) => {
            const changed = !!t.reversed && !beforeReversed.has(t.id);
            return (
              <div key={t.id} className={`txn-card ${changed ? "changed" : ""}`}>
                <div className="txn-top-row">
                  <span className="txn-amount">{rupees(t.amount_paise)}</span>
                  <span className="txn-date">{when(t.created_at)}</span>
                </div>
                <div className="txn-merchant-row">
                  <span className="txn-merchant">{t.merchant}</span>
                  <span className="mono txn-ref">{t.id}</span>
                </div>
                <div className="txn-status-badges">
                  <div className="status-item">
                    <span className="status-label">App:</span>
                    <StatusBadge status={t.app_status.toLowerCase()} />
                  </div>
                  <div className="status-item">
                    <span className="status-label">Switch:</span>
                    <Badge tone="neutral" title="Sandbox ground truth">{t.switch_status}</Badge>
                  </div>
                  {t.reversed ? <Badge tone="ok">refunded · {t.reversal_ref}</Badge> : null}
                  {changed && <Badge tone="ok">reversed just now</Badge>}
                </div>
              </div>
            );
          })}
        </div>

        <h3 className="section-subhead" style={{ marginTop: 12 }}>
          Refund Ledger <SandboxBadge />
        </h3>
        {detail.refunds.length === 0 ? (
          <div className="small muted empty-note">No refunds in ledger.</div>
        ) : (
          <div className="table-wrap">
            <table className="small ledger-table">
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
          </div>
        )}

        <h3 className="section-subhead" style={{ marginTop: 12 }}>Prior Tickets</h3>
        {detail.prior_tickets.length === 0 ? (
          <div className="small muted empty-note">No prior support tickets.</div>
        ) : (
          detail.prior_tickets.map((p) => (
            <div key={p.id} className="prior-ticket-row">
              <span className="mono muted">{p.id}</span>
              <span className="grow">{p.subject}</span>
              <StatusBadge status={p.status} />
            </div>
          ))
        )}
      </div>
    </section>
  );
}
