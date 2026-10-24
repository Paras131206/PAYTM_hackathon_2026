import { useEffect, useState } from "react";
import { api } from "../api";
import { Badge, Empty, ErrorBanner, StatusBadge, pct } from "../components/ui";
import type { Metrics, Rate } from "../types";

function RateCard({ label, rate, help }: { label: string; rate: Rate; help: string }) {
  return (
    <div className="card kpi" title={help}>
      <div className="l">{label}</div>
      <div className="v">{pct(rate.value)}</div>
      <div className="d">{rate.numerator} of {rate.denominator}</div>
      <div className="bar" aria-hidden><span style={{ width: `${(rate.value ?? 0) * 100}%` }} /></div>
    </div>
  );
}

function CountCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="card kpi">
      <div className="l">{label}</div>
      <div className="v">{value}</div>
      <div className="d">{detail}</div>
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
  useEffect(() => { api.metrics().then(setM).catch((e) => setError(e.message)); }, [version]);

  if (error) return <div className="page"><ErrorBanner error={error} /></div>;
  if (!m) return <div className="page"><Empty><span className="spinner" /></Empty></div>;

  return (
    <div className="page">
      <div>
        <h1>Outcomes</h1>
        <div className="muted">{m.label}</div>
      </div>
      {m.cases_processed === 0 && (
        <div className="banner">No cases processed since the last reset. Open <a href="#/cases">Cases</a> and press
          <strong> Run Resolv</strong> on a ticket.</div>
      )}
      <div className="kpis">
        <CountCard label="Cases processed" value={m.cases_processed} detail={`${m.agent_runs} agent runs`} />
        <RateCard label="Resolved autonomously" rate={m.autonomous_resolution_rate}
          help="Tickets resolved by the agent with a verified refund, no human involved / tickets processed" />
        <RateCard label="Resolved incl. human approval" rate={m.resolution_rate_incl_human}
          help="Resolved tickets (any actor) / tickets processed" />
        <RateCard label="Escalation rate" rate={m.escalation_rate}
          help="Processed tickets with at least one escalation / tickets processed" />
        <RateCard label="Refunds verified in ledger" rate={m.verified_refund_rate}
          help="Refunds confirmed by verify_refund / refunds written" />
        <CountCard label="Successful write actions" value={m.successful_write_actions} detail="distinct idempotency keys; retries counted once" />
        <CountCard label="Blocked actions" value={m.blocked_actions.total} detail="refused by policy or permission" />
        <CountCard label="Tool failures" value={m.tool_failures} detail={`${m.tool_retries} retries before giving up`} />
        <CountCard label="Median agent run" value={fmtSeconds(m.median_run_seconds)} detail="start to finish, per run" />
        <CountCard label="Pending approvals" value={m.approvals.pending ?? 0} detail={`${m.approvals.approved ?? 0} approved · ${m.approvals.rejected ?? 0} rejected`} />
      </div>

      <section className="card">
        <div className="card-h">
          <h2>Scenario check</h2>
          <span className="small muted">
            Correct-action rate on the labelled demo scenarios: {m.scenario_check.numerator} of {m.scenario_check.denominator} processed
          </span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Ticket</th><th>Scenario</th><th>Status now</th><th>Expected</th><th>Refund</th><th>Match</th></tr>
            </thead>
            <tbody>
              {m.scenario_check.rows.map((r) => (
                <tr key={r.ticket_id}>
                  <td><a className="mono" href={`#/cases/${r.ticket_id}`}>{r.ticket_id}</a></td>
                  <td>{r.scenario}</td>
                  <td>{r.processed ? <StatusBadge status={r.status} /> : <span className="muted">not run</span>}</td>
                  <td className="small">{r.expected.join(" or ")}</td>
                  <td className="small">{r.refund_present ? "yes" : "no"}{r.refund_expected !== null && <span className="muted"> (expect {r.refund_expected ? "yes" : "no"})</span>}</td>
                  <td>{r.match === null ? <span className="muted">—</span> : r.match ? <Badge tone="ok">match</Badge> : <Badge tone="bad">mismatch</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {m.blocked_actions.total > 0 && (
        <section className="card">
          <div className="card-h"><h2>Blocked actions by reason</h2></div>
          <div className="card-b row">
            {Object.entries(m.blocked_actions.by_code).map(([k, v]) => <Badge key={k} tone="bad">{k} · {v}</Badge>)}
            {m.policy_deferrals > 0 && <Badge tone="warn">refund deferred (pending inside T+1) · {m.policy_deferrals}</Badge>}
          </div>
        </section>
      )}
      <div className="small muted">Definitions (numerator, denominator, window, source) are in steps.md §11. No baseline exists, so no "time saved" figure is shown.</div>
    </div>
  );
}
