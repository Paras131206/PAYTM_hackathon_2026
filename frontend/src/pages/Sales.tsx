import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Badge, ErrorBanner, rupees } from "../components/ui";
import {
  IconArrowRight,
  IconCheck,
  IconRefresh,
  IconSales,
  IconSparkles,
  RobotMascot,
} from "../components/PaytmIcons";
import type { SalesAnalysis, SalesOverview } from "../types";

const PRESET_PROMPTS = [
  "Identify revenue loss from failed payments & checkout friction",
  "Which product categories have the highest margins and growth?",
  "Recommend peak hour checkout & Paytm Soundbox inventory strategies",
  "How can I increase Average Order Value (AOV) through combo deals?",
];

export function Sales() {
  const [merchants, setMerchants] = useState<string[]>([]);
  const [selectedMerchant, setSelectedMerchant] = useState<string>("Sharma Kirana Store");
  const [overview, setOverview] = useState<SalesOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // AI Agent analysis state
  const [prompt, setPrompt] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<SalesAnalysis | null>(null);
  const [showTrace, setShowTrace] = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.merchants().then((list) => {
        setMerchants(list);
        if (!list.includes(selectedMerchant) && list.length > 0) {
          setSelectedMerchant(list[0]);
        }
      }),
      api.salesOverview(selectedMerchant === "All Merchants" ? undefined : selectedMerchant).then(setOverview),
    ])
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedMerchant]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const runAnalysis = async (customQuery?: string) => {
    const q = customQuery ?? prompt;
    if (!q.trim()) return;
    setAnalyzing(true);
    try {
      const res = await api.analyzeSales(selectedMerchant, q);
      setAnalysis(res);
      setPrompt(q);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="page intelligence-page">
      <ErrorBanner error={error} />

      {/* Header bar with Merchant Switcher */}
      <div className="intelligence-header">
        <div className="intel-title-block">
          <div className="intel-icon-badge sales-badge">
            <IconSales />
          </div>
          <div>
            <h1>Sales Intelligence &amp; Revenue Agent</h1>
            <p className="small muted">
              Real database-driven GMV analytics, conversion rates, and autonomous AI revenue optimization suggestions.
            </p>
          </div>
        </div>

        <div className="merchant-picker-row">
          <label htmlFor="merchant-select" className="small muted bold">Merchant:</label>
          <select
            id="merchant-select"
            className="input merchant-select"
            value={selectedMerchant}
            onChange={(e) => {
              setSelectedMerchant(e.target.value);
              setAnalysis(null);
            }}
          >
            <option value="All Merchants">All Merchants (Consolidated)</option>
            {merchants.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <button className="btn sm secondary" onClick={loadData} title="Refresh live data">
            <IconRefresh className={loading ? "spinning" : ""} />
          </button>
        </div>
      </div>

      {overview && (
        <>
          {/* Top KPI Cards Grid */}
          <div className="intel-kpi-grid">
            <div className="kpi-card">
              <span className="kpi-label">Gross Sales (GMV)</span>
              <strong className="kpi-val paytm-cyan-val">{rupees(overview.gross_sales_paise)}</strong>
              <span className="kpi-sub muted">Across {overview.total_orders.toLocaleString()} orders</span>
            </div>

            <div className="kpi-card">
              <span className="kpi-label">Payment Success Rate</span>
              <strong className={`kpi-val ${overview.payment_success_rate_pct >= 95 ? "kpi-ok" : "kpi-warn"}`}>
                {overview.payment_success_rate_pct}%
              </strong>
              <span className="kpi-sub muted">{overview.failed_orders} checkout drop-offs</span>
            </div>

            <div className="kpi-card">
              <span className="kpi-label">Average Order Value</span>
              <strong className="kpi-val">{rupees(overview.avg_order_value_paise)}</strong>
              <span className="kpi-sub muted">Per completed customer transaction</span>
            </div>

            <div className="kpi-card">
              <span className="kpi-label">Reversals &amp; Lost Revenue</span>
              <strong className="kpi-val kpi-bad">{rupees(overview.refunded_amount_paise)}</strong>
              <span className="kpi-sub muted">Reversed due to payment switch errors</span>
            </div>
          </div>

          {/* AI Sales Strategy Advisor Box */}
          <section className="card agent-advisor-card" aria-label="AI Sales Strategy Agent">
            <div className="agent-advisor-header">
              <div className="advisor-mascot-box">
                <RobotMascot size={42} />
                <span className="live-dot" />
              </div>
              <div className="advisor-intro">
                <div className="row" style={{ gap: 8 }}>
                  <strong>Resolv AI Sales Strategy Teammate</strong>
                  <Badge tone="ok">Autonomous Agent</Badge>
                </div>
                <p className="small muted">
                  Ask anything about your merchant sales data, revenue bottlenecks, or category opportunities.
                  Resolv analyzes actual SQLite transaction data and generates actionable growth blueprints.
                </p>
              </div>
            </div>

            {/* Quick Prompt Presets */}
            <div className="advisor-prompts-bar">
              <span className="small muted bold">Quick Prompts:</span>
              <div className="prompt-chips">
                {PRESET_PROMPTS.map((p, idx) => (
                  <button
                    key={idx}
                    className="prompt-chip"
                    onClick={() => runAnalysis(p)}
                    disabled={analyzing}
                  >
                    <IconSparkles />
                    <span>{p}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Query Input */}
            <div className="advisor-input-row">
              <input
                type="text"
                className="input advisor-input"
                placeholder={`Ask Resolv AI about sales for ${selectedMerchant}... (e.g. How can I boost weekend sales?)`}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runAnalysis()}
              />
              <button
                className="btn primary pill-btn advisor-submit-btn"
                disabled={analyzing || !prompt.trim()}
                onClick={() => runAnalysis()}
              >
                {analyzing ? (
                  <>
                    <IconRefresh className="spinning" />
                    <span>Analyzing DB Data…</span>
                  </>
                ) : (
                  <>
                    <span>Ask AI Agent</span>
                    <IconArrowRight />
                  </>
                )}
              </button>
            </div>

            {/* Agent Analysis Report Output */}
            {analysis && (
              <div className="agent-report-container">
                <div className="report-header">
                  <div>
                    <h3 className="report-title">{analysis.report_title}</h3>
                    <span className="small muted">
                      Engine: <strong>{analysis.engine}</strong> · Grounded in live SQLite data
                    </span>
                  </div>
                  <button
                    className="btn sm secondary"
                    onClick={() => setShowTrace((t) => !t)}
                  >
                    {showTrace ? "Hide Agent Trace" : "🔍 View DB Trace"}
                  </button>
                </div>

                {/* Executive Summary Callout */}
                <div className="exec-summary-box">
                  <div className="exec-summary-title">Executive Summary</div>
                  <p>{analysis.executive_summary}</p>
                </div>

                {/* Key Findings */}
                <div className="report-section">
                  <h4 className="section-title">Key Data Findings (Grounded in Database)</h4>
                  <ul className="findings-list">
                    {analysis.findings.map((f, i) => (
                      <li key={i} className="finding-item">
                        <span className="finding-bullet"><IconCheck /></span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Concrete Strategic Recommendations */}
                <div className="report-section">
                  <h4 className="section-title">Actionable AI Recommendations &amp; Expected Impact</h4>
                  <div className="recs-grid">
                    {analysis.recommendations.map((rec, i) => (
                      <div key={i} className="rec-card">
                        <div className="rec-top">
                          <strong className="rec-title">{rec.title}</strong>
                          <span className="rec-impact-badge">{rec.expected_impact}</span>
                        </div>
                        <p className="rec-action">{rec.action}</p>
                        <div className="rec-meta">
                          <span className="small muted"><strong>Rationale:</strong> {rec.rationale}</span>
                          <div className="rec-tags">
                            <span className="rec-tag">Effort: {rec.effort}</span>
                            <span className="rec-tag">Timeline: {rec.timeline}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Transparent Agent DB Query Trace */}
                {showTrace && (
                  <div className="trace-accordion">
                    <h5 className="trace-heading">Autonomous Agent Query &amp; Reasoning Steps</h5>
                    <div className="trace-steps">
                      {analysis.agent_trace.map((step, idx) => (
                        <div key={idx} className="trace-step-item">
                          <span className="trace-step-num">{idx + 1}</span>
                          <div>
                            <strong>{step.step}</strong>
                            <p className="small muted mono">{step.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Breakdown Tables (Categories & Payment Channels) */}
          <div className="breakdown-grid">
            <section className="card" aria-label="Category performance">
              <div className="card-h">
                <h2>Product Categories Breakdown</h2>
                <span className="small muted">{overview.categories.length} categories</span>
              </div>
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Orders</th>
                      <th>Gross GMV</th>
                      <th>Revenue Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.categories.map((c) => (
                      <tr key={c.category}>
                        <td><strong>{c.category}</strong></td>
                        <td>{c.orders.toLocaleString()}</td>
                        <td className="mono bold">{rupees(c.gross_sales_paise)}</td>
                        <td>
                          <div className="progress-bar-cell">
                            <div className="progress-bar-fill" style={{ width: `${c.share_pct}%` }} />
                            <span className="small">{c.share_pct}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="card" aria-label="Channel breakdown">
              <div className="card-h">
                <h2>Payment Channels</h2>
                <span className="small muted">In-Store vs Gateway</span>
              </div>
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Payment Channel</th>
                      <th>Orders</th>
                      <th>Gross GMV</th>
                      <th>Failed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.channels.map((ch) => (
                      <tr key={ch.channel}>
                        <td><strong>{ch.channel}</strong></td>
                        <td>{ch.orders.toLocaleString()}</td>
                        <td className="mono bold">{rupees(ch.gross_sales_paise)}</td>
                        <td>
                          {ch.failed_orders > 0 ? (
                            <Badge tone="bad">{ch.failed_orders} dropped</Badge>
                          ) : (
                            <Badge tone="ok">0 failed</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
