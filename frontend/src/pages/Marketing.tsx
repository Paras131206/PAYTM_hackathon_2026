import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Badge, ErrorBanner, rupees } from "../components/ui";
import {
  IconArrowRight,
  IconCheck,
  IconMarketing,
  IconRefresh,
  IconSparkles,
  RobotMascot,
} from "../components/PaytmIcons";
import type { MarketingAnalysis, MarketingOverview } from "../types";

const PRESET_PROMPTS = [
  "Where am I investing in marketing and what better can I do?",
  "Audit TV Ads vs Meta / Social Ads for Gen-Z reach & ROI",
  "Simulate budget reallocation from TV to Meta Reels & Soundbox",
  "How can I reduce Customer Acquisition Cost (CAC) under ₹50?",
];

export function Marketing() {
  const [merchants, setMerchants] = useState<string[]>([]);
  const [selectedMerchant, setSelectedMerchant] = useState<string>("Sharma Kirana Store");
  const [overview, setOverview] = useState<MarketingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // AI Agent analysis state
  const [prompt, setPrompt] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<MarketingAnalysis | null>(null);
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
      api.marketingOverview(selectedMerchant === "All Merchants" ? undefined : selectedMerchant).then(setOverview),
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
      const res = await api.analyzeMarketing(selectedMerchant, q);
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

      {/* Header Bar */}
      <div className="intelligence-header">
        <div className="intel-title-block">
          <div className="intel-icon-badge mkt-badge">
            <IconMarketing />
          </div>
          <div>
            <h1>Marketing ROI &amp; Budget Optimization Agent</h1>
            <p className="small muted">
              Multi-channel ad performance, ROAS &amp; CAC benchmarking, and AI-driven budget reallocation blueprints.
            </p>
          </div>
        </div>

        <div className="merchant-picker-row">
          <label htmlFor="mkt-merchant-select" className="small muted bold">Merchant:</label>
          <select
            id="mkt-merchant-select"
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
              <span className="kpi-label">Total Ad Spend</span>
              <strong className="kpi-val">{rupees(overview.total_spend_paise)}</strong>
              <span className="kpi-sub muted">Across active campaigns</span>
            </div>

            <div className="kpi-card">
              <span className="kpi-label">Attributed Revenue</span>
              <strong className="kpi-val paytm-cyan-val">{rupees(overview.total_revenue_paise)}</strong>
              <span className="kpi-sub muted">{overview.total_conversions.toLocaleString()} customer conversions</span>
            </div>

            <div className="kpi-card">
              <span className="kpi-label">Blended ROAS</span>
              <strong className={`kpi-val ${overview.blended_roas >= 3.0 ? "kpi-ok" : "kpi-warn"}`}>
                {overview.blended_roas}x
              </strong>
              <span className="kpi-sub muted">Return on advertising spend</span>
            </div>

            <div className="kpi-card">
              <span className="kpi-label">Average CAC</span>
              <strong className="kpi-val">{rupees(overview.average_cac_paise)}</strong>
              <span className="kpi-sub muted">Customer acquisition cost</span>
            </div>
          </div>

          {/* AI Marketing Advisor Section */}
          <section className="card agent-advisor-card" aria-label="AI Marketing Strategy Advisor">
            <div className="agent-advisor-header">
              <div className="advisor-mascot-box">
                <RobotMascot size={42} />
                <span className="live-dot" />
              </div>
              <div className="advisor-intro">
                <div className="row" style={{ gap: 8 }}>
                  <strong>Resolv AI Marketing &amp; Channel Allocation Advisor</strong>
                  <Badge tone="ok">Autonomous Agent</Badge>
                </div>
                <p className="small muted">
                  Curious where your marketing budget is leaking? Ask Resolv to evaluate channel returns,
                  audit TV ads vs Meta Reels / Gen-Z social campaigns, and simulate high-ROAS budget reallocation.
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
                placeholder={`Ask Resolv AI about marketing for ${selectedMerchant}... (e.g. Where am I investing and what better can I do?)`}
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
                    <span>Auditing Channels…</span>
                  </>
                ) : (
                  <>
                    <span>Audit &amp; Optimize</span>
                    <IconArrowRight />
                  </>
                )}
              </button>
            </div>

            {/* Analysis Output Container */}
            {analysis && (
              <div className="agent-report-container">
                <div className="report-header">
                  <div>
                    <h3 className="report-title">{analysis.report_title}</h3>
                    <span className="small muted">
                      Engine: <strong>{analysis.engine}</strong> · Grounded in live marketing records
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

                {/* Budget Reallocation Blueprint Simulation */}
                {analysis.budget_reallocation_simulation && (
                  <div className="reallocation-simulation-card">
                    <div className="sim-header">
                      <div>
                        <h4 className="sim-title">⚡ AI Budget Reallocation Blueprint</h4>
                        <span className="small muted">
                          Reallocates budget from low-yield broadcast into high-performing Gen-Z &amp; local digital channels.
                        </span>
                      </div>
                      <div className="sim-upside-badge">
                        <span>Projected Growth:</span>
                        <strong>+{analysis.budget_reallocation_simulation.revenue_growth_pct}% GMV</strong>
                      </div>
                    </div>

                    <div className="sim-comparison-grid">
                      <div className="sim-box current">
                        <span className="sim-box-label">Current Plan</span>
                        <div className="sim-kpi-row">
                          <span>ROAS: <strong>{analysis.budget_reallocation_simulation.current_roas}x</strong></span>
                          <span>Revenue: <strong>₹{analysis.budget_reallocation_simulation.current_revenue_rs.toLocaleString()}</strong></span>
                        </div>
                      </div>

                      <div className="sim-arrow">➔</div>

                      <div className="sim-box optimized">
                        <span className="sim-box-label">Optimized Plan (Same Budget)</span>
                        <div className="sim-kpi-row">
                          <span>ROAS: <strong className="text-ok">{analysis.budget_reallocation_simulation.projected_roas}x</strong></span>
                          <span>Revenue: <strong className="text-ok">₹{analysis.budget_reallocation_simulation.projected_revenue_rs.toLocaleString()}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="sim-shifts-list">
                      <h5 className="shifts-title">Recommended Capital Shifts</h5>
                      {analysis.budget_reallocation_simulation.shifts.map((shift, idx) => (
                        <div key={idx} className="shift-row">
                          <span className="shift-badge">Shift ₹{shift.amount_rs.toLocaleString()}</span>
                          <span className="shift-path">
                            <strong>{shift.from_channel}</strong> ➔ <strong>{shift.to_channel}</strong>
                          </span>
                          <span className="shift-reason muted small">{shift.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key Findings */}
                <div className="report-section">
                  <h4 className="section-title">Key Channel Findings</h4>
                  <ul className="findings-list">
                    {analysis.findings.map((f, i) => (
                      <li key={i} className="finding-item">
                        <span className="finding-bullet"><IconCheck /></span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Concrete Recommendations */}
                <div className="report-section">
                  <h4 className="section-title">Step-by-Step Strategic Action Items</h4>
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

                {/* Agent Trace */}
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

          {/* Active Campaigns Table */}
          <section className="card" aria-label="Marketing campaigns table">
            <div className="card-h">
              <h2>Active Marketing Campaigns &amp; Channels</h2>
              <span className="small muted">{overview.campaigns.length} campaigns</span>
            </div>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Channel &amp; Campaign</th>
                    <th>Target Audience</th>
                    <th>Spend</th>
                    <th>Revenue</th>
                    <th>ROAS</th>
                    <th>CAC</th>
                    <th>Efficiency</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.campaigns.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.channel}</strong>
                        <div className="small muted">{c.campaign_name}</div>
                      </td>
                      <td>
                        <span className="audience-tag">{c.target_audience}</span>
                      </td>
                      <td className="mono">{rupees(c.spend_paise)}</td>
                      <td className="mono bold">{rupees(c.revenue_generated_paise)}</td>
                      <td>
                        <span className={`roas-badge ${c.roas >= 4.0 ? "roas-high" : c.roas >= 2.0 ? "roas-mid" : "roas-low"}`}>
                          {c.roas}x
                        </span>
                      </td>
                      <td className="mono">{rupees(c.cac_paise)}</td>
                      <td>
                        <Badge tone={c.efficiency === "exceptional" ? "ok" : c.efficiency === "good" ? "info" : c.efficiency === "moderate" ? "warn" : "bad"}>
                          {c.efficiency}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
