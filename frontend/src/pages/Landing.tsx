import { useState } from "react";
import { ResolvLogo, IconArrowRight, IconSparkles, IconCheck } from "../components/PaytmIcons";
import type { Health } from "../types";

interface LandingProps {
  onProceed: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  health?: Health | null;
}

export function Landing({ onProceed, theme, onToggleTheme }: LandingProps) {
  const [coinHover, setCoinHover] = useState(false);

  return (
    <div className="landing-page">
      {/* Background ambient lighting blobs */}
      <div className="landing-ambient-bg" aria-hidden="true">
        <div className="ambient-blob cyan" />
        <div className="ambient-blob gold" />
        <div className="ambient-blob navy" />
        <div className="ambient-grid-overlay" />
      </div>

      {/* Top Navigation Bar */}
      <header className="landing-header">
        <div className="landing-header-inner">
          <div className="landing-logo-group">
            <ResolvLogo />
          </div>

          <nav className="landing-nav-links" aria-label="Landing Navigation">
            <a href="#/overview" onClick={(e) => { e.preventDefault(); onProceed(); }}>Overview</a>
            <a href="#/cases" onClick={(e) => { e.preventDefault(); location.hash = "#/cases"; }}>Live Cases</a>
            <a href="#/queue" onClick={(e) => { e.preventDefault(); location.hash = "#/queue"; }}>Human Queue</a>
            <a href="#/system" onClick={(e) => { e.preventDefault(); location.hash = "#/system"; }}>Switch Sandbox</a>
          </nav>

          <div className="landing-header-actions">
            <button
              className="theme-toggle-btn"
              onClick={onToggleTheme}
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} theme`}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
            </button>

            <button className="btn sm primary landing-quick-cta" onClick={onProceed}>
              <span>Enter Resolv</span>
              <IconArrowRight />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="landing-hero-section">
        <div className="landing-hero-container">
          {/* Track 3 Pill Badge */}
          <div className="hero-pill-badge">
            <span className="sparkle-icon"><IconSparkles /></span>
            <span className="badge-text">Track 3: Autonomous AI Teammates</span>
            <span className="status-live-dot" />
          </div>

          <h1 className="landing-hero-title">
            Autonomous AI Support for <br />
            <span className="text-gradient-cyan">Failed UPI Payments</span>
          </h1>

          <p className="landing-hero-subtitle">
            Resolv operates your payments support queue autonomously. It inspects customer intent, verifies payment switch ground truth, applies deterministic refund policies, executes sandboxed reversals, and reconciles ledgers with zero manual overhead.
          </p>

          {/* Symbol Showcase: Gold Coin Medallion with Light Blue Center and Gold Rupee Symbol */}
          <div
            className={`landing-coin-showcase ${coinHover ? "hovered" : ""}`}
            onMouseEnter={() => setCoinHover(true)}
            onMouseLeave={() => setCoinHover(false)}
          >
            {/* Glowing aura rings */}
            <div className="coin-aura-pulse" aria-hidden="true" />
            <div className="coin-glow-mesh" aria-hidden="true" />

            {/* The Coin Container */}
            <div className="coin-frame">
              <img
                src="/paytm_rupee_coin.png"
                alt="Resolv Rupee Gold Medallion with light blue center and gold rupee symbol"
                className="coin-symbol-image"
              />
              <div className="coin-shine-sweep" aria-hidden="true" />
            </div>

            {/* Floating context pills surrounding the coin */}
            <div className="coin-floating-chip chip-left" title="Instant refund policy">
              <span className="chip-icon">⚡</span>
              <div className="chip-content">
                <strong>Auto-Refunds</strong>
                <small>Instant under ₹2,000</small>
              </div>
            </div>

            <div className="coin-floating-chip chip-right" title="Sandbox switch validation">
              <span className="chip-icon">🛡️</span>
              <div className="chip-content">
                <strong>Switch Sandbox</strong>
                <small>Bank ledger verified</small>
              </div>
            </div>

            <div className="coin-floating-chip chip-bottom" title="Multi-LLM Failover Chain">
              <span className="chip-icon">🤖</span>
              <div className="chip-content">
                <strong>Failover Chain</strong>
                <small>Gemini → Groq → Ollama → Rules</small>
              </div>
            </div>
          </div>

          {/* The Primary Call to Action Button */}
          <div className="landing-cta-group">
            <button
              id="click-to-proceed-btn"
              className="btn-proceed-hero"
              onClick={onProceed}
              aria-label="Click to proceed to the application"
            >
              <span className="proceed-btn-glow" />
              <span className="proceed-btn-content">
                <span className="proceed-text">Click to proceed</span>
                <span className="proceed-arrow"><IconArrowRight /></span>
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Key Metrics Strip */}
      <section className="landing-metrics-strip">
        <div className="metrics-strip-inner">
          <div className="metric-item">
            <span className="metric-val">&lt; 1s</span>
            <span className="metric-lbl">Autonomous Decision Speed</span>
          </div>
          <div className="metric-divider" />
          <div className="metric-item">
            <span className="metric-val">100%</span>
            <span className="metric-lbl">Deterministic Policy Guardrail</span>
          </div>
          <div className="metric-divider" />
          <div className="metric-item">
            <span className="metric-val">₹2,000</span>
            <span className="metric-lbl">Auto-Refund Approval Cap</span>
          </div>
          <div className="metric-divider" />
          <div className="metric-item">
            <span className="metric-val">0 Risk</span>
            <span className="metric-lbl">Sandboxed Rails & Switch</span>
          </div>
        </div>
      </section>

      {/* 4 Pillars of Resolv */}
      <section className="landing-features-section">
        <div className="features-container">
          <div className="section-header text-center">
            <span className="section-eyebrow">BUILT FOR SCALE</span>
            <h2 className="section-title">How Resolv Works as an Autonomous Teammate</h2>
            <p className="section-subtitle">
              Combining LLM natural language understanding with strictly deterministic banking policy guardrails.
            </p>
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-card-glow" />
              <div className="feature-icon-box">🔍</div>
              <h3>1. Intent & Context Discovery</h3>
              <p>
                Extracts the transaction reference, amount, and customer grievance from conversational support tickets. Automatically correlates against UPI payment history.
              </p>
              <ul className="feature-checklist">
                <li><IconCheck /> Multi-turn conversation parsing</li>
                <li><IconCheck /> Resolves ambiguity before taking action</li>
              </ul>
            </div>

            <div className="feature-card">
              <div className="feature-card-glow" />
              <div className="feature-icon-box">🏦</div>
              <h3>2. Payment Switch Verification</h3>
              <p>
                Directly queries the sandboxed switch API to verify whether funds were debited, whether the NPCI/bank switch timed out, or if the transaction is pending.
              </p>
              <ul className="feature-checklist">
                <li><IconCheck /> Injected outages and timeout handling</li>
                <li><IconCheck /> Bank rail response code validation</li>
              </ul>
            </div>

            <div className="feature-card">
              <div className="feature-card-glow" />
              <div className="feature-icon-box">⚖️</div>
              <h3>3. Deterministic Policy Guardrails</h3>
              <p>
                Zero hallucinations on money movement. Strict code-level policies govern refund eligibility: auto-refund allowed only for debited failures up to ₹2,000.
              </p>
              <ul className="feature-checklist">
                <li><IconCheck /> Strict T+1 regulatory adherence</li>
                <li><IconCheck /> Duplicate refund prevention in ledger</li>
              </ul>
            </div>

            <div className="feature-card">
              <div className="feature-card-glow" />
              <div className="feature-icon-box">👥</div>
              <h3>4. Human-in-the-Loop Escalation</h3>
              <p>
                When a claim exceeds the ₹2,000 threshold, reveals suspicious patterns, or hits ambiguous data, Resolv prepares an audit dossier and escalates to human agents.
              </p>
              <ul className="feature-checklist">
                <li><IconCheck /> Full decision timeline with rationale</li>
                <li><IconCheck /> One-click human approval or rejection</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Architecture Flow Preview */}
      <section className="landing-flow-section">
        <div className="flow-container">
          <div className="flow-card">
            <div className="flow-header">
              <div className="flow-badge">END-TO-END WORKFLOW</div>
              <h3>From Customer Ticket to Instant Resolution</h3>
              <p>Watch how every step is recorded in an immutable audit timeline.</p>
            </div>

            <div className="flow-steps-grid">
              <div className="flow-step">
                <div className="step-num">01</div>
                <h4>Customer Support Ticket</h4>
                <p>&ldquo;Money debited for ₹850 at Sharma General Store but payment failed.&rdquo;</p>
              </div>

              <div className="flow-connector" aria-hidden="true">→</div>

              <div className="flow-step">
                <div className="step-num">02</div>
                <h4>Switch Sandbox Check</h4>
                <p>Queries Switch status: <span className="status-code">DEBITED_REMITTER_FAILED_BENEFICIARY</span></p>
              </div>

              <div className="flow-connector" aria-hidden="true">→</div>

              <div className="flow-step">
                <div className="step-num">03</div>
                <h4>Policy Engine Gate</h4>
                <p>Amount ₹850 &le; ₹2,000 limit. Bank failure confirmed. Safe for auto-refund.</p>
              </div>

              <div className="flow-connector" aria-hidden="true">→</div>

              <div className="flow-step highlight">
                <div className="step-num">04</div>
                <h4>Execute & Verify</h4>
                <p>Sandboxed reversal processed. Ledger updated. Customer notified with UTR reference.</p>
              </div>
            </div>

            <div className="flow-action-footer">
              <button className="btn-proceed-hero sm" onClick={onProceed}>
                <span className="proceed-btn-content">
                  <span className="proceed-text">Click to proceed to Live Dashboard</span>
                  <span className="proceed-arrow"><IconArrowRight /></span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="footer-left">
            <ResolvLogo />
          </div>

          <div className="footer-right">
            <button className="btn sm secondary" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
              Back to Top ↑
            </button>
            <button className="btn sm primary" onClick={onProceed}>
              Click to proceed →
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
