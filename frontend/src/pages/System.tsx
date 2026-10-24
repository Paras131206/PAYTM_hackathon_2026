import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Badge, Empty, ErrorBanner } from "../components/ui";
import type { SystemInfo } from "../types";

const MODE_TONE: Record<string, "ok" | "warn" | "neutral" | "bad"> = {
  live: "ok", sandbox: "warn", internal: "neutral", "not configured": "bad",
};

export function System({ onChange }: { onChange: () => void }) {
  const [s, setS] = useState<SystemInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState("*");
  const [mode, setMode] = useState<"outage" | "timeout">("outage");

  const load = useCallback(() => { api.system().then(setS).catch((e) => setError(e.message)); }, []);
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

  if (!s) return <div className="page"><ErrorBanner error={error} />{!error && <Empty><span className="spinner" /></Empty>}</div>;

  return (
    <div className="page">
      <h1>System and integrations</h1>
      <ErrorBanner error={error} />
      <section className="card">
        <div className="card-h"><h2>Agent engine</h2></div>
        <div className="card-b">
          <dl className="kv">
            <dt>Active engine</dt><dd>{s.engine === "rules" ? <Badge>Rules engine (no LLM)</Badge> : <Badge tone="accent">{s.engine === "claude" ? "Claude" : "Gemini"} · {s.model}</Badge>}</dd>
            <dt>Setting</dt><dd><code>AGENT_ENGINE={s.engine_setting}</code> (resolved once at startup)</dd>
            <dt>Gemini key</dt><dd>{s.gemini_configured ? <Badge tone="ok">configured</Badge> : <Badge tone="bad">missing GEMINI_API_KEY</Badge>}</dd>
            <dt>Claude key</dt><dd>{s.claude_configured ? <Badge tone="ok">configured</Badge> : <Badge>not set</Badge>}</dd>
            <dt>Model</dt><dd><code>{s.model}</code></dd>
            <dt>Auto-refund limit</dt><dd>Rs {s.auto_refund_limit_rupees.toLocaleString("en-IN")}</dd>
            <dt>Turn budget</dt><dd>{s.max_agent_turns} planner turns · {s.tool_max_attempts} attempts per tool call</dd>
          </dl>
          <p className="small muted" style={{ marginBottom: 0 }}>
            A failed LLM call fails the run and escalates the ticket. The app never switches to the rules engine silently.
          </p>
        </div>
      </section>

      <section className="card">
        <div className="card-h"><h2>Integrations</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>System</th><th>Mode</th><th>What it really does</th></tr></thead>
            <tbody>
              {s.integrations.map((i) => (
                <tr key={i.name}><td>{i.name}</td><td><Badge tone={MODE_TONE[i.mode] ?? "neutral"}>{i.mode}</Badge></td><td className="small">{i.detail}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card-h"><h2>Failure injection (sandbox payment switch)</h2></div>
        <div className="card-b stack">
          <div className="row">
            <input className="input" style={{ width: 200 }} value={target} onChange={(e) => setTarget(e.target.value)}
              aria-label="Target transaction id or *" />
            <select className="input" style={{ width: "auto" }} value={mode} onChange={(e) => setMode(e.target.value as any)} aria-label="Fault mode">
              <option value="outage">outage (503)</option>
              <option value="timeout">timeout</option>
            </select>
            <button className="btn" onClick={() => fault(mode)}>Inject fault</button>
          </div>
          {s.faults.length === 0 ? <div className="small muted">No faults active.</div> : (
            <table className="small">
              <thead><tr><th>Adapter</th><th>Target</th><th>Mode</th><th /></tr></thead>
              <tbody>
                {s.faults.map((f) => (
                  <tr key={f.adapter + f.target}>
                    <td>{f.adapter}</td><td className="mono">{f.target}</td><td>{f.mode}</td>
                    <td className="num"><button className="btn sm" onClick={() => fault(null, f.target)}>Clear</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="small muted">Use <code>*</code> to fail every switch call. The seeded fault on UPI4021000501 drives scenario S5.</div>
        </div>
      </section>

      <section className="card">
        <div className="card-h"><h2>Tools available to the agent</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Tool</th><th>Permission</th><th>Integration</th><th>Description</th></tr></thead>
            <tbody>
              {s.tools.map((t) => (
                <tr key={t.name}>
                  <td className="mono">{t.name}</td>
                  <td>{t.permission === "write" ? <Badge tone="accent">write</Badge> : <Badge>read</Badge>}</td>
                  <td><Badge tone={t.integration === "sandbox" ? "warn" : "neutral"}>{t.integration}</Badge></td>
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
