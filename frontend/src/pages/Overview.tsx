import { useEffect, useState } from "react";
import { api } from "../api";
import { Badge, Empty, ErrorBanner, StatusBadge, pct } from "../components/ui";
import { IconArrowRight, IconSparkles, ProgressRing, RobotMascot } from "../components/PaytmIcons";
import type { Metrics, Rate } from "../types";

export type OutcomesViewMode = "summary" | "all" | "operations" | "hidden";

function MetricGaugeCard({
  label,
  rate,
  help,
  color = "#00BAF2",
}: {
  label: string;
  rate: Rate;
  help: string;
  color?: string;
}) {
  const percentage = (rate.value ?? 0) * 100;
  return (
    <div className="card kpi-card" title={help}>
      <div className="kpi-content">
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">{pct(rate.value)}</div>
        <div className="kpi-detail">
          {rate.numerator} of {rate.denominator}
        </div>
      </div>
      <div className="kpi-gauge-wrap">
        <ProgressRing percentage={percentage} size={54} color={color} />
      </div>
    </div>
  );
}

function CountCard({ label, value, detail, highlight }: { label: string; value: string | number; detail: string; highlight?: boolean }) {
  return (
    <div className={`card kpi-card ${highlight ? "highlighted" : ""}`}>
      <div className="kpi-content">
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">{value}</div>
        <div className="kpi-detail">{detail}</div>
      </div>
    </div>
  );
}

function fmtSeconds(s: number | null) {
  if (s === null) return "—";
  return s < 1 ? `${Math.round(s * 1000)} ms` : `${s.toFixed(1)} s`;
}

export function Overview({ version }: { version: number }) {
  const [m, setM] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outcomesView, setOutcomesView] = useState<OutcomesViewMode>(() => {
    const saved = localStorage.getItem("resolv_outcomes_view") as OutcomesViewMode;
    return saved || "summary";
  });

  useEffect(() => {
    api.metrics().then(setM).catch((e) => setError(e.message));
  }, [version]);

  const handleOutcomesChange = (mode: OutcomesViewMode) => {
    setOutcomesView(mode);
    localStorage.setItem("resolv_outcomes_view", mode);
  };

  if (error) return <div className="page"><ErrorBanner error={error} /></div>;
  if (!m) return <div className="page"><Empty><span className="spinner" /></Empty></div>;

  const showGauges = outcomesView === "all" || outcomesView === "summary";
  const showOperations = outcomesView === "all" || outcomesView === "operations";

  return (
    <div className="page">
      {/* Welcome & AI Teammate Hero Card */}
      <section className="assistant-hero-banner">
        <div className="hero-text-side">
          <div className="hero-badge">
            <IconSparkles />
            <span>Resolv AI Teammate</span>
          </div>
          <h1 className="hero-title">
            Autonomous UPI Resolution <span className="highlight-text">&amp; Refunds</span>
          </h1>
          <p className="hero-subtitle">
            Resolving failed-but-debited payments, duplicate charges, and pending settlements with deterministic policy and sandbox ledger verification.
          </p>
          <div className="hero-actions">
            <a href="#/cases" className="btn primary hero-cta">
              <span>View Cases &amp; Scenarios</span>
              <IconArrowRight />
            </a>
            <a href="#/queue" className="btn hero-secondary">
              <span>Human Queue</span>
              {m.approvals.pending ? <span className="count-pill">{m.approvals.pending}</span> : null}
            </a>
          </div>
        </div>
        <div className="hero-robot-side">
          <div className="robot-glow-backdrop" />
          <RobotMascot size={110} />
          <div className="hero-stat-pill">
            <span className="dot ok-dot" />
            <span>100% Deterministic Policy</span>
          </div>
        </div>
      </section>

      {/* No cases alert */}
      {m.cases_processed === 0 && (
        <div className="paytm-banner warn">
          <div className="banner-title">No cases processed since the last reset</div>
          <div className="banner-desc">
            Open <a href="#/cases">Cases</a> and click <strong>Run Resolv</strong> on any ticket to test autonomous resolution.
          </div>
        </div>
      )}

      {/* Performance Outcomes with Dropdown & Collapsible Control */}
      <section className="outcomes-section">
        <div className="section-header outcomes-header">
          <div className="row" style={{ gap: 10 }}>
            <button
              type="button"
              className="outcomes-toggle-btn"
              onClick={() => handleOutcomesChange(outcomesView === "hidden" ? "summary" : "hidden")}
              title={outcomesView === "hidden" ? "Click to expand metrics" : "Click to collapse metrics"}
            >
              <span className={`chevron-icon ${outcomesView !== "hidden" ? "open" : ""}`} aria-hidden>
                {outcomesView !== "hidden" ? "▾" : "▸"}
              </span>
              <h2>Performance Outcomes</h2>
            </button>
            <span className="badge neutral sm">{m.cases_processed} processed</span>
          </div>

          <div className="row outcomes-controls">
            <label className="small muted" htmlFor="outcomes-view-select">
              Display:
            </label>
            <select
              id="outcomes-view-select"
              className="input select-engine outcomes-dropdown"
              value={outcomesView}
              onChange={(e) => handleOutcomesChange(e.target.value as OutcomesViewMode)}
              aria-label="Performance outcomes display option"
            >
              <option value="summary">Summary (4 Key Gauges)</option>
              <option value="all">Detailed (All 10 Metrics)</option>
              <option value="operations">Operations (6 Cards)</option>
              <option value="hidden">Collapsed / Hidden</option>
            </select>
          </div>
        </div>

        {outcomesView === "hidden" ? (
          <div className="outcomes-collapsed-hint muted">
            Performance metrics are hidden to keep the page uncluttered. Choose an option from the dropdown above to display them.
          </div>
        ) : (
          <div className="kpis-grid" style={{ marginTop: 12 }}>
            {showGauges && (
              <>
                <MetricGaugeCard
                  label="Resolved Autonomously"
                  rate={m.autonomous_resolution_rate}
                  help="Tickets resolved by the agent with a verified refund, no human involved / tickets processed"
                  color="#00BAF2"
                />
                <MetricGaugeCard
                  label="Refunds Verified in Ledger"
                  rate={m.verified_refund_rate}
                  help="Refunds confirmed by verify_refund in ledger / refunds written"
                  color="#10B981"
                />
                <MetricGaugeCard
                  label="Total Resolution (Incl. Human)"
                  rate={m.resolution_rate_incl_human}
                  help="Resolved tickets (any actor) / tickets processed"
                  color="#3B82F6"
                />
                <MetricGaugeCard
                  label="Escalation Rate"
                  rate={m.escalation_rate}
                  help="Processed tickets with at least one escalation / tickets processed"
                  color="#F59E0B"
                />
              </>
            )}

            {showOperations && (
              <>
                <CountCard
                  label="Cases Processed"
                  value={m.cases_processed}
                  detail={`${m.agent_runs} agent runs`}
                  highlight
                />
                <CountCard
                  label="Successful Write Actions"
                  value={m.successful_write_actions}
                  detail="distinct idempotency keys; retries counted once"
                />
                <CountCard
                  label="Pending Approvals"
                  value={m.approvals.pending ?? 0}
                  detail={`${m.approvals.approved ?? 0} approved · ${m.approvals.rejected ?? 0} rejected`}
                />
                <CountCard
                  label="Blocked Actions"
                  value={m.blocked_actions.total}
                  detail="refused by policy or permission"
                />
                <CountCard
                  label="Tool Failures"
                  value={m.tool_failures}
                  detail={`${m.tool_retries} retries before giving up`}
                />
                <CountCard
                  label="Median Run Time"
                  value={fmtSeconds(m.median_run_seconds)}
                  detail="start to finish, per run"
                />
              </>
            )}
          </div>
        )}
      </section>

      {/* UPI Scenarios Banners with verified TKT-100x IDs */}
      <div className="section-header" style={{ marginTop: 8 }}>
        <h2>Pre-Configured UPI Scenarios</h2>
        <span className="section-caption">Click any scenario to inspect context and run Resolv</span>
      </div>

      <div className="paytm-promo-grid">
        <a href="#/cases/TKT-1001" className="paytm-promo-card">
          <div className="promo-badge">Scenario S1</div>
          <div className="promo-title">Failed UPI Payment (Debited)</div>
          <div className="promo-desc">Auto-refund verified in ledger within seconds</div>
          <div className="promo-link">Open Case TKT-1001 <IconArrowRight /></div>
        </a>

        <a href="#/cases/TKT-1002" className="paytm-promo-card">
          <div className="promo-badge warn-badge">Scenario S2</div>
          <div className="promo-title">High-Value Refund (&gt; ₹2,000)</div>
          <div className="promo-desc">Strict policy check escalates to Human Queue</div>
          <div className="promo-link">Open Case TKT-1002 <IconArrowRight /></div>
        </a>

        <a href="#/cases/TKT-1003" className="paytm-promo-card">
          <div className="promo-badge">Scenario S3</div>
          <div className="promo-title">Pending Settlement (Inside T+1)</div>
          <div className="promo-desc">Deterministic deferral advises customer to wait</div>
          <div className="promo-link">Open Case TKT-1003 <IconArrowRight /></div>
        </a>

        <a href="#/cases/TKT-1004" className="paytm-promo-card">
          <div className="promo-badge">Scenario S4</div>
          <div className="promo-title">Ambiguous Payment</div>
          <div className="promo-desc">Resolv asks customer to clarify which transaction</div>
          <div className="promo-link">Open Case TKT-1004 <IconArrowRight /></div>
        </a>

        <a href="#/cases/TKT-1005" className="paytm-promo-card">
          <div className="promo-badge">Scenario S5</div>
          <div className="promo-title">Bank Switch Outage</div>
          <div className="promo-desc">Retries with backoff &amp; safely escalates on failure</div>
          <div className="promo-link">Open Case TKT-1005 <IconArrowRight /></div>
        </a>

        <a href="#/cases/TKT-1006" className="paytm-promo-card">
          <div className="promo-badge danger-badge">Scenario S6</div>
          <div className="promo-title">Prompt Injection Defense</div>
          <div className="promo-desc">Deterministic guard blocks manipulation attempt</div>
          <div className="promo-link">Open Case TKT-1006 <IconArrowRight /></div>
        </a>

        <a href="#/cases/TKT-1007" className="paytm-promo-card">
          <div className="promo-badge">Scenario S7</div>
          <div className="promo-title">Duplicate UPI Charge</div>
          <div className="promo-desc">Detects twin debits &amp; reverses the second charge</div>
          <div className="promo-link">Open Case TKT-1007 <IconArrowRight /></div>
        </a>

        <a href="#/cases/TKT-1008" className="paytm-promo-card">
          <div className="promo-badge warn-badge">Scenario S8</div>
          <div className="promo-title">Human Transfer Request</div>
          <div className="promo-desc">Customer asks for a person; escalated immediately</div>
          <div className="promo-link">Open Case TKT-1008 <IconArrowRight /></div>
        </a>
      </div>

      {/* Scenario Check Table */}
      <section className="card content-card">
        <div className="card-h">
          <div>
            <h2>Scenario Evaluation Check</h2>
            <div className="small muted">
              Correct-action rate on labelled demo scenarios: {m.scenario_check.numerator} of {m.scenario_check.denominator} processed
            </div>
          </div>
          <span className="badge paytm">
            {pct(m.scenario_check.value)} accuracy
          </span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Scenario</th>
                <th>Status now</th>
                <th>Expected</th>
                <th>Refund</th>
                <th>Match</th>
              </tr>
            </thead>
            <tbody>
              {m.scenario_check.rows.map((r) => (
                <tr key={r.ticket_id}>
                  <td>
                    <a className="mono ticket-link" href={`#/cases/${r.ticket_id}`}>
                      {r.ticket_id}
                    </a>
                  </td>
                  <td><strong>{r.scenario}</strong></td>
                  <td>{r.processed ? <StatusBadge status={r.status} /> : <span className="muted">not run</span>}</td>
                  <td className="small">{r.expected.join(" or ")}</td>
                  <td className="small">
                    {r.refund_present ? <span className="text-ok">✓ Yes</span> : <span className="muted">No</span>}
                    {r.refund_expected !== null && (
                      <span className="muted"> (expect {r.refund_expected ? "yes" : "no"})</span>
                    )}
                  </td>
                  <td>
                    {r.match === null ? (
                      <span className="muted">—</span>
                    ) : r.match ? (
                      <Badge tone="ok">match</Badge>
                    ) : (
                      <Badge tone="bad">mismatch</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Blocked Actions */}
      {m.blocked_actions.total > 0 && (
        <section className="card content-card">
          <div className="card-h">
            <h2>Blocked actions by reason</h2>
          </div>
          <div className="card-b row">
            {Object.entries(m.blocked_actions.by_code).map(([k, v]) => (
              <Badge key={k} tone="bad">{k} · {v}</Badge>
            ))}
            {m.policy_deferrals > 0 && (
              <Badge tone="warn">refund deferred (pending inside T+1) · {m.policy_deferrals}</Badge>
            )}
          </div>
        </section>
      )}

    </div>
  );
}
