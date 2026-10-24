import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Badge, Empty, ErrorBanner } from "../components/ui";
import type { SystemInfo } from "../types";

const MODE_TONE: Record<string, "ok" | "warn" | "neutral" | "bad"> = {
  live: "ok",
  sandbox: "warn",
  internal: "neutral",
  "not configured": "bad",
};

export function System({ onChange }: { onChange: () => void }) {
  const [s, setS] = useState<SystemInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState("*");
  const [mode, setMode] = useState<"outage" | "timeout">("outage");

  const load = useCallback(() => {
    api.system().then(setS).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const fault = async (m: "outage" | "timeout" | null, t = target) => {
    try {
      await api.setFault("payment_switch", t, m);
      load();
      onChange();
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (!s) {
    return (
      <div className="page">
        <ErrorBanner error={error} />
        {!error && <Empty><span className="spinner" /></Empty>}
      </div>
    );
  }

  return (
    <div className="page system-page">
      <div className="page-header">
        <h1>System Architecture &amp; Rails</h1>
        <div className="muted">
          Inspect configured LLM chains, deterministic policy bounds, sandbox payment rails, and fault injection.
        </div>
      </div>

      <ErrorBanner error={error} />

      {/* Agent Engine Details */}
      <section className="card content-card">
        <div className="card-h">
          <h2>Agent Engine &amp; Policies</h2>
          <Badge tone={s.engine === "rules" ? "neutral" : "paytm"}>
            {s.engine === "rules" ? "Rules engine" : "LLM Failover"}
          </Badge>
        </div>
        <div className="card-b">
          <dl className="kv-grid">
            <dt>Active Engine</dt>
            <dd>
              {s.engine === "rules" ? (
                <Badge>Deterministic Rules (No LLM)</Badge>
              ) : (
                <Badge tone="paytm">Multi-Provider LLM Chain</Badge>
              )}
            </dd>
            <dt>Runtime Setting</dt>
            <dd><code>AGENT_ENGINE={s.engine_setting}</code></dd>
            <dt>Failover Models</dt>
            <dd>
              {s.llm_configured ? (
                <code>{s.model}</code>
              ) : (
                <Badge tone="bad">No provider configured</Badge>
              )}
            </dd>
            <dt>Auto-Refund Limit</dt>
            <dd><strong>₹{s.auto_refund_limit_rupees.toLocaleString("en-IN")}</strong> (Refunds above this require human approval)</dd>
            <dt>Safety Budget</dt>
            <dd>{s.max_agent_turns} planner turns max · {s.tool_max_attempts} retries per tool call</dd>
          </dl>
          <div className="small muted safety-note">
            If an LLM call fails all providers, the run fails immediately and escalates to human review. The app never silently falls back to rules.
          </div>
        </div>
      </section>

      {/* LLM Providers */}
      <section className="card content-card">
        <div className="card-h">
          <h2>LLM Providers (Failover Chain)</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="num">Order</th>
                <th>Provider</th>
                <th>Model Identifier</th>
                <th>Chain Status</th>
              </tr>
            </thead>
            <tbody>
              {s.providers.map((p) => (
                <tr key={p.name}>
                  <td className="num">{p.order}</td>
                  <td><strong>{p.name}</strong></td>
                  <td className="mono">{p.model}</td>
                  <td>
                    {p.configured ? (
                      <Badge tone="ok">configured &amp; active</Badge>
                    ) : (
                      <Badge tone="neutral">not configured</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-b small muted">
          Configured in <code>.env</code> via <code>LLM_PROVIDERS</code>. When a provider hits rate limits or server errors, execution advances forward to the next configured model.
        </div>
      </section>

      {/* Integrations */}
      <section className="card content-card">
        <div className="card-h">
          <h2>Integrations &amp; Payment Rails</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>System</th>
                <th>Mode</th>
                <th>Functionality</th>
              </tr>
            </thead>
            <tbody>
              {s.integrations.map((i) => (
                <tr key={i.name}>
                  <td><strong>{i.name}</strong></td>
                  <td><Badge tone={MODE_TONE[i.mode] ?? "neutral"}>{i.mode}</Badge></td>
                  <td className="small">{i.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Failure Injection */}
      <section className="card content-card">
        <div className="card-h">
          <h2>Fault Injection (Sandbox Payment Switch)</h2>
          <span className="small muted">Simulate bank timeouts or 503 switch outages</span>
        </div>
        <div className="card-b stack">
          <div className="row fault-controls-row">
            <input
              className="input"
              style={{ maxWidth: 220 }}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Txn ID or * for all"
              aria-label="Target transaction id or *"
            />
            <select
              className="input"
              style={{ width: "auto" }}
              value={mode}
              onChange={(e) => setMode(e.target.value as any)}
              aria-label="Fault mode"
            >
              <option value="outage">Outage (HTTP 503)</option>
              <option value="timeout">Gateway Timeout</option>
            </select>
            <button className="btn primary sm pill-btn" onClick={() => fault(mode)}>
              Inject Fault
            </button>
          </div>

          {s.faults.length === 0 ? (
            <div className="small muted">No faults currently active in sandbox.</div>
          ) : (
            <div className="table-wrap">
              <table className="small">
                <thead>
                  <tr>
                    <th>Adapter</th>
                    <th>Target Txn</th>
                    <th>Simulated Mode</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {s.faults.map((f) => (
                    <tr key={f.adapter + f.target}>
                      <td>{f.adapter}</td>
                      <td className="mono">{f.target}</td>
                      <td><Badge tone="warn">{f.mode}</Badge></td>
                      <td className="num">
                        <button className="btn sm danger pill-btn" onClick={() => fault(null, f.target)}>
                          Clear Fault
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="small muted">
            Target <code>*</code> fails every switch call. Scenario S5 tests automated recovery on seeded fault <code>UPI4021000501</code>.
          </div>
        </div>
      </section>

      {/* Tools Catalog */}
      <section className="card content-card">
        <div className="card-h">
          <h2>Registered Agent Tools</h2>
          <span className="small muted">{s.tools.length} sandboxed tools</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tool Name</th>
                <th>Access</th>
                <th>Rail</th>
                <th>Purpose</th>
              </tr>
            </thead>
            <tbody>
              {s.tools.map((t) => (
                <tr key={t.name}>
                  <td className="mono"><strong>{t.name}</strong></td>
                  <td>
                    {t.permission === "write" ? (
                      <Badge tone="accent">write (idempotent)</Badge>
                    ) : (
                      <Badge tone="neutral">read</Badge>
                    )}
                  </td>
                  <td>
                    <Badge tone={t.integration === "sandbox" ? "warn" : "neutral"}>
                      {t.integration}
                    </Badge>
                  </td>
                  <td className="small">{t.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
