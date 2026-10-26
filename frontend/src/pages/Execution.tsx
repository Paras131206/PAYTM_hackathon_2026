import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Timeline } from "../components/Timeline";
import {
  Badge,
  EngineBadge,
  ErrorBanner,
  StatusBadge,
  when,
} from "../components/ui";

import {
  IconCases,
  IconExecution,
  IconRefresh,
  IconSparkles,
  RobotMascot,
} from "../components/PaytmIcons";
import type { Engine, Health, RunDetail, TicketDetail, TicketListItem } from "../types";

export function Execution({
  ticketId,
  runIdParam,
  health,
  onChange,
}: {
  ticketId: string | null;
  runIdParam: string | null;
  health: Health | null;
  onChange: () => void;
}) {
  const [tickets, setTickets] = useState<TicketListItem[] | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(ticketId);
  const [ticketDetail, setTicketDetail] = useState<TicketDetail | null>(null);
  const [runId, setRunId] = useState<number | null>(runIdParam ? Number(runIdParam) : null);
  const [run, setRun] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [engine, setEngine] = useState<Engine>(health?.engine ?? "llm");
  const [running, setRunning] = useState(false);

  // Sync prop changes into state
  useEffect(() => {
    if (ticketId) {
      setSelectedTicketId(ticketId);
    }
  }, [ticketId]);

  useEffect(() => {
    if (runIdParam) {
      setRunId(Number(runIdParam));
    }
  }, [runIdParam]);

  // Load ticket list
  useEffect(() => {
    api.tickets().then((list) => {
      setTickets(list);
      if (!selectedTicketId && list.length > 0) {
        setSelectedTicketId(list[0].id);
      }
    }).catch((e) => setError(e.message));
  }, [selectedTicketId]);

  // Load ticket details when selectedTicketId changes
  const loadTicket = useCallback(() => {
    if (!selectedTicketId) return;
    setLoading(true);
    api.ticket(selectedTicketId)
      .then((d) => {
        setTicketDetail(d);
        if (d.runs.length > 0) {
          // If current runId is not in runs, pick the latest
          const exists = d.runs.some((r) => r.id === runId);
          if (!exists) {
            setRunId(d.runs[d.runs.length - 1].id);
          }
        } else {
          setRunId(null);
          setRun(null);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedTicketId, runId]);

  useEffect(() => {
    loadTicket();
  }, [loadTicket]);

  // Load run detail when runId changes
  useEffect(() => {
    if (!runId) {
      setRun(null);
      return;
    }
    api.run(runId)
      .then(setRun)
      .catch((e) => setError(e.message));
  }, [runId]);

  // Polling if the selected run is active
  useEffect(() => {
    if (!run || (run.run.status !== "queued" && run.run.status !== "running")) return;
    const interval = window.setInterval(() => {
      api.run(run.run.id).then((updated) => {
        setRun(updated);
        if (updated.run.status !== "queued" && updated.run.status !== "running") {
          loadTicket();
          onChange();
        }
      }).catch(() => undefined);
    }, 1500);
    return () => window.clearInterval(interval);
  }, [run, loadTicket, onChange]);

  const startRun = async () => {
    if (!selectedTicketId) return;
    setRunning(true);
    setError(null);
    try {
      const res = await api.startRun(selectedTicketId, engine);
      setRunId(res.run_id);
      loadTicket();
      onChange();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  const handleTicketChange = (id: string) => {
    setSelectedTicketId(id);
    location.hash = `#/execution/${id}`;
  };

  return (
    <div className="page execution-page">
      <ErrorBanner error={error} />

      {/* Header bar */}
      <div className="intelligence-header execution-header">
        <div className="intel-title-block">
          <div className="intel-icon-badge execution-badge">
            <IconExecution />
          </div>
          <div>
            <h1>Agent Execution &amp; Policy Trace</h1>
            <p className="small muted">
              Autonomous reasoning timeline, tool invocation logs, RBI TAT compliance checks, and verification ledger.
            </p>
          </div>
        </div>

        <div className="execution-header-actions">
          {selectedTicketId && (
            <a
              href={`#/cases/${selectedTicketId}`}
              className="btn sm secondary pill-btn"
              title="Return to conversation & customer context"
            >
              <IconCases />
              <span>← Back to Case Thread</span>
            </a>
          )}
          <button className="btn sm secondary" onClick={loadTicket} title="Refresh execution data">
            <IconRefresh className={loading ? "spinning" : ""} />
          </button>
        </div>
      </div>

      {/* Ticket Selector Bar */}
      <div className="execution-controls-card card">
        <div className="execution-controls-grid">
          <div className="control-item">
            <label className="small muted bold" htmlFor="exec-ticket-select">Select Support Case:</label>
            <select
              id="exec-ticket-select"
              className="input exec-select"
              value={selectedTicketId ?? ""}
              onChange={(e) => handleTicketChange(e.target.value)}
            >
              {tickets?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.id} · {t.customer_name} ({t.status}) — {t.subject.slice(0, 40)}…
                </option>
              ))}
            </select>
          </div>

          {ticketDetail && ticketDetail.runs.length > 0 && (
            <div className="control-item">
              <label className="small muted bold" htmlFor="exec-run-select">Execution Run:</label>
              <select
                id="exec-run-select"
                className="input exec-select"
                value={runId ?? ""}
                onChange={(e) => setRunId(Number(e.target.value))}
              >
                {ticketDetail.runs.map((r) => (
                  <option key={r.id} value={r.id}>
                    Run #{r.id} · {r.engine} · {r.outcome ?? r.status} ({when(r.started_at)})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Trigger Run Controls */}
          <div className="control-item trigger-run-box">
            <label className="small muted bold" htmlFor="exec-engine-select">Engine:</label>
            <div className="row" style={{ gap: 8 }}>
              <select
                id="exec-engine-select"
                className="input exec-engine-select"
                value={engine}
                onChange={(e) => setEngine(e.target.value as Engine)}
              >
                <option value="llm" disabled={!health?.llm_configured}>
                  LLM Chain{health?.llm_configured ? "" : " (offline)"}
                </option>
                <option value="rules">Rules Engine</option>
              </select>
              <button
                className="btn primary sm pill-btn"
                disabled={running || loading || !selectedTicketId}
                onClick={startRun}
                title="Execute AI teammate resolution loop"
              >
                <IconSparkles />
                <span>{running ? "Working…" : "Run Resolv →"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Selected Ticket Context Banner */}
        {ticketDetail && (
          <div className="exec-ticket-banner">
            <div className="exec-ticket-info">
              <span className="mono bold ticket-id-pill">{ticketDetail.ticket.id}</span>
              <strong className="ticket-subject-text">{ticketDetail.ticket.subject}</strong>
              <StatusBadge status={ticketDetail.ticket.status} />
              {ticketDetail.ticket.scenario && (
                <span className="scenario-tag muted small">Scenario: {ticketDetail.ticket.scenario}</span>
              )}
            </div>
            <div className="exec-customer-tag">
              Customer: <strong>{ticketDetail.customer.name}</strong> ({ticketDetail.customer.id}) · {ticketDetail.customer.phone_masked}
            </div>
          </div>
        )}
      </div>

      {/* Main Execution View Container */}
      <section className="card dedicated-execution-card" aria-label="Dedicated agent execution timeline">
        {run ? (
          <>
            <div className="card-h execution-view-header">
              <div className="row" style={{ gap: 10 }}>
                <div className="execution-avatar-dot">
                  <RobotMascot size={32} />
                  <span className="live-dot" />
                </div>
                <div>
                  <h2 style={{ fontSize: 16 }}>Execution #{run.run.id} Timeline</h2>
                  <span className="small muted">Started {when(run.run.started_at)}</span>
                </div>
              </div>

              <div className="row small exec-status-chips">
                <EngineBadge engine={run.run.engine} model={run.run.model} />
                <StatusBadge status={run.run.status} />
                {run.run.outcome && <span>➔ <StatusBadge status={run.run.outcome} /></span>}
                <span className="turns-badge">{run.run.turns} planner turns</span>
                {run.run.error && <Badge tone="bad" title={run.run.error}>error</Badge>}
              </div>
            </div>

            <div className="dedicated-timeline-scroll">
              <Timeline events={run.events} />
            </div>
          </>
        ) : (
          <div className="empty-execution-state">
            <RobotMascot size={64} />
            <h3>No Agent Execution Recorded</h3>
            <p className="muted small" style={{ maxWidth: 440, margin: "8px auto 16px" }}>
              This ticket has not been processed by Resolv yet. Click <strong>Run Resolv →</strong> to
              trigger autonomous policy checks, payment switch lookup, and sandbox ledger resolution.
            </p>
            <button className="btn primary pill-btn" onClick={startRun} disabled={running}>
              <IconSparkles />
              <span>{running ? "Resolv Working…" : "Run Resolv Now →"}</span>
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
