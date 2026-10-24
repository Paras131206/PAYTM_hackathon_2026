// Builds Resolv_AI_Teammate_Pitch.pptx: six slides, 16:9, native editable shapes.
// Run: NODE_PATH=<dir containing pptxgenjs, react, react-dom, react-icons, sharp> node build_deck.js
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const si = require("react-icons/si");
const path = require("path");

const OUT = path.join(__dirname, "Resolv_AI_Teammate_Pitch.pptx");

// ============================================================================
// Design system
// ============================================================================
const COLOR = {
  bg: "F4F7FB",      // off-white page
  ink: "0B1220",     // deep navy: titles, primary text
  text2: "4B5A70",   // secondary text (darkened slate for contrast on bg)
  slate: "94A3B8",   // lines, secondary connectors
  rule: "D3DBE6",    // hairlines
  blue: "3B82F6",    // meaning: decisions, the primary path, key terms
  teal: "2DD4BF",    // meaning: success state only
  white: "FFFFFF",
  dataFill: "E9EEF5",
};
const FONT = "Calibri";
const SIZE = { cover: 80, tagline: 28, title: 32, insight: 22, heading: 20, body: 17, label: 15, small: 13, foot: 11 };
const GRID = { W: 13.333, H: 7.5, M: 0.75, top: 0.55, footY: 7.0 };
GRID.CW = GRID.W - 2 * GRID.M;   // 11.833
GRID.R = GRID.W - GRID.M;        // right edge 12.583
const STROKE = { hair: 0.75, node: 1, primary: 1.75, secondary: 1.25, human: 2 };

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.title = "Resolv: AI teammate for customer service";
pres.author = "[Team Name]";
pres.theme = { headFontFace: FONT, bodyFontFace: FONT };

pres.defineSlideMaster({ title: "COVER", background: { color: COLOR.bg } });
pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: COLOR.bg },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: GRID.M, y: GRID.top, w: GRID.CW, h: 0.75,
        fontFace: FONT, fontSize: SIZE.title, bold: true, color: COLOR.ink, align: "left", valign: "top", margin: 0 }, text: "" } },
    { text: { text: "Resolv", options: { x: GRID.M, y: GRID.footY, w: 3, h: 0.25, fontFace: FONT, fontSize: SIZE.foot, color: COLOR.text2, margin: 0 } } },
  ],
  slideNumber: { x: GRID.R - 0.6, y: GRID.footY, w: 0.6, h: 0.25, fontFace: FONT, fontSize: SIZE.foot, color: COLOR.text2, align: "right", margin: 0 },
});

// ---------- primitives ----------
const r = (text, o = {}) => ({ text, options: o });

function text(slide, t, o) {
  slide.addText(t, Object.assign({ isTextBox: true, fontFace: FONT, fontSize: SIZE.body, color: COLOR.ink, margin: 0, valign: "top" }, o));
}
function hairline(slide, x, y, w) {
  slide.addShape(pres.shapes.LINE, { x, y, w, h: 0, line: { color: COLOR.rule, width: STROKE.hair } });
}
// connector: primary = blue path, secondary = slate. Any direction.
function arrow(slide, x1, y1, x2, y2, { primary = false, both = false, head = true } = {}) {
  slide.addShape(pres.shapes.LINE, {
    x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1),
    flipH: x2 < x1, flipV: y2 < y1,
    line: { color: primary ? COLOR.blue : COLOR.slate, width: primary ? STROKE.primary : STROKE.secondary,
      endArrowType: head ? "triangle" : undefined, beginArrowType: both ? "triangle" : undefined },
  });
}
// Diagram nodes: shape carries meaning, not only colour.
//   process  = square rectangle       decision = diamond (blue outline)
//   human    = rounded, heavy outline  data     = cylinder
//   external = dashed rectangle       success  = teal rectangle
const NODE = {
  process:  { shape: "RECTANGLE", fill: COLOR.white, line: COLOR.slate, lw: STROKE.node },
  decision: { shape: "DIAMOND", fill: COLOR.white, line: COLOR.blue, lw: STROKE.primary },
  human:    { shape: "ROUNDED_RECTANGLE", fill: COLOR.white, line: COLOR.ink, lw: STROKE.human, radius: 0.18 },
  data:     { shape: "CAN", fill: COLOR.dataFill, line: COLOR.slate, lw: STROKE.node },
  external: { shape: "RECTANGLE", fill: COLOR.bg, line: COLOR.slate, lw: STROKE.node, dash: "dash" },
  success:  { shape: "RECTANGLE", fill: COLOR.teal, line: COLOR.teal, lw: STROKE.node },
};
function node(slide, kind, x, y, w, h, t, o = {}) {
  const k = NODE[kind];
  const opts = {
    shape: pres.shapes[k.shape], x, y, w, h,
    fill: { color: k.fill }, line: { color: k.line, width: k.lw, dashType: k.dash || "solid" },
    fontFace: FONT, fontSize: o.fs || SIZE.label, color: COLOR.ink, bold: !!o.bold,
    align: o.align || "center", valign: "middle", margin: o.margin ?? [4, 4, 4, 4],
    objectName: o.name,
  };
  if (k.radius) opts.rectRadius = k.radius;
  slide.addText(t, opts);
}
async function logo(Comp, color) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color: "#" + color, size: 256 }));
  return "image/png;base64," + (await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64");
}
function content(title) {
  const s = pres.addSlide({ masterName: "CONTENT" });
  s.addText(title, { placeholder: "title" });
  return s;
}

async function main() {
  const { M, R, CW } = GRID;

  // ==========================================================================
  // 1 — Cover: name and promise first, one product preview
  // ==========================================================================
  {
    const s = pres.addSlide({ masterName: "COVER" });
    text(s, "Resolv", { x: M, y: 1.35, w: 6.4, h: 1.3, fontSize: SIZE.cover, bold: true, valign: "middle" });
    text(s, "The AI teammate that finishes the support case, not just the conversation.",
      { x: M, y: 2.75, w: 6.6, h: 1.45, fontSize: SIZE.tagline });
    text(s, [r("Problem statement", { bold: true, color: COLOR.ink, breakLine: true }),
             r("Design an AI teammate that goes beyond answering questions to deliver measurable outcomes in sales or customer service.", { color: COLOR.text2 })],
      { x: M, y: 4.5, w: 5.9, h: 0.9, fontSize: SIZE.label });
    text(s, [r("[Team Name]", { bold: true }), r("   Team ID [Team ID]", { color: COLOR.text2 })], { x: M, y: 5.75, w: 6.4, h: 0.35, fontSize: SIZE.body });
    text(s, "[Member 1] · [Member 2] · [Member 3] · [Member 4] · [Member 5] · [Member 6]",
      { x: M, y: 6.15, w: 6.6, h: 0.3, fontSize: SIZE.small, color: COLOR.text2 });

    // Product preview: one case, the steps Resolv takes.
    const px = 7.85, py = 1.35, pw = R - px, ph = 4.95;
    s.addShape(pres.shapes.RECTANGLE, { x: px, y: py, w: pw, h: ph, fill: { color: COLOR.white }, line: { color: COLOR.rule, width: STROKE.hair }, objectName: "Product preview" });
    const ix = px + 0.35, iw = pw - 0.7;
    text(s, [r("Case A-1042", { bold: true }), r("   damaged item, via chat", { color: COLOR.text2 })], { x: ix, y: py + 0.3, w: iw, h: 0.35, fontSize: SIZE.label });
    hairline(s, ix, py + 0.85, iw);
    text(s, "“My blender arrived with a cracked jar.”", { x: ix, y: py + 1.05, w: iw, h: 0.4, fontSize: SIZE.label, italic: true });
    hairline(s, ix, py + 1.65, iw);
    const steps = [
      ["Checked the order and the damage policy", true],
      ["Chose a replacement, within its limit", true],
      ["Created the replacement order", true],
      ["Confirmed the new order ID", true],
      ["Waiting for agent review", false],
    ];
    steps.forEach(([t, done], i) => {
      const y = py + 1.9 + i * 0.58;
      s.addShape(pres.shapes.OVAL, { x: ix, y: y + 0.09, w: 0.16, h: 0.16,
        fill: { color: done ? COLOR.blue : COLOR.white }, line: { color: COLOR.blue, width: STROKE.secondary } });
      text(s, t, { x: ix + 0.35, y, w: iw - 0.35, h: 0.34, fontSize: SIZE.label, color: done ? COLOR.ink : COLOR.text2, valign: "middle" });
    });
    text(s, "Illustrative concept, not a built screen", { x: px, y: py + ph + 0.12, w: pw, h: 0.25, fontSize: SIZE.foot, color: COLOR.text2, italic: true });

    s.addNotes("Resolv is our working name for an AI teammate for e-commerce customer service, starting with damaged or missing items. The right-hand panel is an illustrative concept of one case, not a screenshot. Team name, team ID and members are placeholders.");
  }

  // ==========================================================================
  // 2 — Problem: workflow line, pain → cost, one insight
  // ==========================================================================
  {
    const s = content("Answering is quick. Finishing the case is still manual.");

    text(s, "A damaged-item case today", { x: M, y: 1.6, w: 5, h: 0.3, fontSize: SIZE.small, color: COLOR.text2 });
    const ly = 2.15;
    arrow(s, M, ly, R, ly);
    const flow = ["Customer reports a damaged item", "Agent searches helpdesk, orders, courier",
      "Agent pieces the context together", "Agent applies policy, updates each tool", "Outcome logged unevenly"];
    const colW = CW / flow.length;
    flow.forEach((t, i) => {
      const x = M + i * colW;
      s.addShape(pres.shapes.OVAL, { x, y: ly - 0.08, w: 0.16, h: 0.16, fill: { color: COLOR.ink }, line: { color: COLOR.ink } });
      text(s, t, { x, y: ly + 0.25, w: colW - 0.3, h: 0.7, fontSize: SIZE.label });
    });

    // pain point -> what it costs
    const tx = M, c2 = 4.55, tw = 7.35, ty = 3.45;
    text(s, "Pain point", { x: tx, y: ty, w: 3, h: 0.3, fontSize: SIZE.small, color: COLOR.text2 });
    text(s, "What it costs the team", { x: c2, y: ty, w: 3.5, h: 0.3, fontSize: SIZE.small, color: COLOR.text2 });
    hairline(s, tx, ty + 0.38, tw);
    const rows = [
      ["Context is split across tools", "Longer handling; customers repeat themselves"],
      ["Bots answer but don't act", "The work is left unfinished"],
      ["Actions aren't checked", "Errors and rework"],
      ["Follow-ups live in memory", "Cases reopen; repeat sales are lost"],
    ];
    rows.forEach(([p, c], i) => {
      const y = ty + 0.48 + i * 0.6;
      text(s, p, { x: tx, y, w: 3.4, h: 0.5, fontSize: SIZE.body, bold: true, valign: "middle" });
      arrow(s, 4.05, y + 0.25, 4.38, y + 0.25);
      text(s, c, { x: c2, y, w: tw - (c2 - tx), h: 0.5, fontSize: SIZE.body, valign: "middle" });
      hairline(s, tx, y + 0.55, tw);
    });

    // insight
    const ix = 8.85, iw = R - ix;
    text(s, [r("The gap isn't the answer. It's "), r("completing the next action", { color: COLOR.blue, bold: true }),
             r(", checking it worked, and knowing when to bring in a person.")],
      { x: ix, y: 3.45, w: iw, h: 1.95, fontSize: SIZE.insight });
    text(s, [r("Chatbot", { bold: true, color: COLOR.text2 }), r("   answers, suggests", { color: COLOR.text2, breakLine: true }),
             r("AI teammate", { bold: true, color: COLOR.blue }), r("   understands, decides, acts, verifies, escalates")],
      { x: ix, y: 5.65, w: iw, h: 0.85, fontSize: SIZE.label, paraSpaceAfter: 6 });

    text(s, "Pain points are hypotheses for small and mid-size e-commerce support teams, to be checked in user interviews. No external statistics are claimed.",
      { x: M, y: 6.6, w: CW, h: 0.25, fontSize: SIZE.foot, italic: true, color: COLOR.text2 });
    s.addNotes("Read the workflow left to right, then each pain point and what it costs. These are hypotheses for our chosen segment; we cite no industry statistics because we have not verified any. The insight on the right sets up the solution: completing and checking the next action, with a person involved when needed.");
  }

  // ==========================================================================
  // 3 — Solution: one flow, one human lane, example + differentiators below
  // ==========================================================================
  {
    const s = content("Resolv finishes the case, and asks a human when it should.");

    const fy = 2.0, nh = 0.95, dh = 1.2, rw = 1.4, dw = 1.75;
    const items = [
      ["process", "Receive request"], ["process", "Retrieve context"], ["process", "Choose action"],
      ["decision", "Within policy?"], ["process", "Act via tool"], ["decision", "Verified?"], ["success", "Case resolved"],
    ];
    const total = items.reduce((a, [k]) => a + (k === "decision" ? dw : rw), 0);
    const gap = (CW - total) / (items.length - 1);
    const cy = fy + nh / 2;
    const pos = [];
    let x = M;
    items.forEach(([k, t], i) => {
      const w = k === "decision" ? dw : rw, h = k === "decision" ? dh : nh;
      node(s, k, x, cy - h / 2, w, h, t, { fs: k === "decision" ? SIZE.small + 1 : SIZE.label, bold: k !== "process", margin: k === "decision" ? 0 : undefined });
      pos.push({ x, w, cx: x + w / 2, bot: cy + h / 2 });
      if (i < items.length - 1) arrow(s, x + w + 0.02, cy, x + w + gap - 0.02, cy, { primary: true });
      x += w + gap;
    });
    [3, 5].forEach((i) => text(s, "yes", { x: pos[i].x + pos[i].w + gap / 2 - 0.3, y: cy - 0.72, w: 0.6, h: 0.24, fontSize: SIZE.small, color: COLOR.text2, align: "center" }));

    // human lane under the two decisions
    const hy = 3.75, hh = 0.85, hx = pos[3].x, hw = pos[5].x + pos[5].w - hx;
    node(s, "human", hx, hy, hw, hh, [r("Human teammate", { bold: true }), r("  approves, edits or takes over")], { fs: SIZE.label, name: "Human teammate" });
    arrow(s, pos[3].cx, pos[3].bot + 0.02, pos[3].cx, hy - 0.02);
    arrow(s, pos[5].cx, pos[5].bot + 0.02, pos[5].cx, hy - 0.02);
    arrow(s, pos[4].cx, hy - 0.02, pos[4].cx, pos[4].bot + 0.02);
    text(s, "needs approval", { x: pos[3].cx - 1.55, y: 3.25, w: 1.45, h: 0.3, fontSize: SIZE.small, color: COLOR.text2, align: "right" });
    text(s, "approved", { x: pos[4].cx + 0.1, y: 3.25, w: 0.9, h: 0.3, fontSize: SIZE.small, color: COLOR.text2 });
    text(s, "fails after a retry", { x: pos[5].cx + 0.1, y: 3.25, w: 1.6, h: 0.3, fontSize: SIZE.small, color: COLOR.text2 });
    text(s, "Human decisions and verified outcomes are added to the test set.",
      { x: hx, y: hy + hh + 0.12, w: hw, h: 0.3, fontSize: SIZE.small, color: COLOR.text2 });

    // example
    const ey = 5.15;
    text(s, [r("Example", { bold: true }), r("  illustrative", { color: COLOR.text2, italic: true })], { x: M, y: ey, w: 5, h: 0.3, fontSize: SIZE.label });
    const ex = [
      ["Customer", "“My blender jar arrived cracked.”"],
      ["Resolv acts", "Creates a replacement within the auto-approve limit"],
      ["Resolv checks", "Order API returns a new order ID; ticket updated"],
    ];
    const ew = 2.35, eg = 0.25;
    ex.forEach(([h, t], i) => {
      text(s, [r(h, { bold: true, color: COLOR.blue, fontSize: SIZE.small, breakLine: true }), r(t)],
        { x: M + i * (ew + eg), y: ey + 0.45, w: ew, h: 1.1, fontSize: SIZE.label });
    });

    // differentiators
    const ux = 8.85, uw = R - ux;
    text(s, "What's different", { x: ux, y: ey, w: uw, h: 0.3, fontSize: SIZE.label, bold: true });
    text(s, ["Completes the action, not just the reply", "Grounded in order and policy data", "Every action checked and logged", "Human approval built in"]
      .map((t, i, a) => r(t, { breakLine: i < a.length - 1 })),
      { x: ux, y: ey + 0.45, w: uw, h: 1.15, fontSize: SIZE.label, paraSpaceAfter: 4 });

    s.addNotes("Flow: receive, retrieve order/ticket/policy context, choose an action (LLM proposes, rules constrain), policy check, act through an allow-listed tool, verify an explicit postcondition, resolve. Anything needing approval, or failing after one idempotent retry, goes to a human, who can approve (back to 'act') or take over. Learning is offline: human decisions and verified outcomes become test cases. The example is illustrative, not a measured result.");
  }

  // ==========================================================================
  // 4 — Architecture + stack: same layer names on both sides
  // ==========================================================================
  {
    const s = content("The model proposes. Rules and tools decide what happens.");
    const ax = M, aw = 6.9;

    node(s, "process", ax, 1.8, 3.3, 0.65, "Customer chat", { fs: SIZE.label });
    node(s, "process", ax + 3.6, 1.8, 3.3, 0.65, "Agent console", { fs: SIZE.label });

    const cy0 = 2.85, ch = 1.75;
    s.addShape(pres.shapes.RECTANGLE, { x: ax, y: cy0, w: aw, h: ch, fill: { color: COLOR.white }, line: { color: COLOR.slate, width: STROKE.node }, objectName: "Agent service" });
    text(s, [r("Agent service", { bold: true }), r("   FastAPI + LangGraph", { color: COLOR.text2 })], { x: ax + 0.2, y: cy0 + 0.12, w: aw - 0.4, h: 0.3, fontSize: SIZE.small });
    const inner = [["process", "Retrieve context"], ["process", "Propose action (Claude)"], ["decision", "Policy gate"], ["process", "Act + verify"]];
    const iw = 1.45, ig = 0.2, iy = cy0 + 0.6, ih = 0.95;
    const ipos = inner.map(([k, t], i) => {
      const x = ax + 0.2 + i * (iw + ig);
      node(s, k, x, iy, iw, ih, t, { fs: SIZE.small + 1, bold: k === "decision" });
      if (i < inner.length - 1) arrow(s, x + iw + 0.02, iy + ih / 2, x + iw + ig - 0.02, iy + ih / 2, { primary: true });
      return { cx: x + iw / 2 };
    });
    arrow(s, ax + 1.65, 2.47, ax + 1.65, cy0 - 0.02);
    arrow(s, ipos[2].cx, 2.47, ipos[2].cx, iy - 0.02, { both: true });
    text(s, "approval", { x: ipos[2].cx + 0.08, y: 2.5, w: 0.9, h: 0.28, fontSize: SIZE.small, color: COLOR.text2 });

    const dy = 5.05, dh = 0.85;
    [["data", "Orders & tickets", ax, 1.6], ["data", "Policy KB", ax + 1.8, 1.5], ["data", "Audit log", ax + 3.5, 1.5], ["external", "Store / helpdesk APIs (mocked)", ax + 5.2, 1.7]]
      .forEach(([k, t, x, w]) => {
        node(s, k, x, dy, w, dh, t, { fs: SIZE.small + 1 });
        arrow(s, x + w / 2, cy0 + ch + 0.02, x + w / 2, dy - 0.02);
      });

    const lgY = 6.12;
    [["process", "Component"], ["decision", "Decision"], ["data", "Data store"], ["external", "External, mocked"]].forEach(([k, t], i) => {
      const x = ax + i * 1.75;
      node(s, k, x, lgY, 0.3, 0.22, "");
      text(s, t, { x: x + 0.4, y: lgY - 0.02, w: 1.3, h: 0.26, fontSize: SIZE.foot, color: COLOR.text2, valign: "middle" });
    });
    text(s, "Agent loop follows ReAct (Yao et al., 2022, arXiv:2210.03629) and Toolformer (Schick et al., 2023, arXiv:2302.04761).",
      { x: ax, y: 6.47, w: aw, h: 0.28, fontSize: SIZE.foot, italic: true, color: COLOR.text2 });

    const tx = 8.05, tw = R - tx, colW = [1.4, 2.2, tw - 3.6];
    const stack = [
      ["Interface", "React + TypeScript", "Proposed", si.SiReact, "149ECA"],
      ["Agent service", "FastAPI, Python 3.11", "Proposed", si.SiFastapi, "009688"],
      ["Agent loop", "LangGraph", "Proposed", si.SiLanggraph, "1C3C3C"],
      ["Model", "Claude Sonnet 5.5", "Proposed", si.SiAnthropic, "191919"],
      ["Data + audit", "PostgreSQL + pgvector", "Proposed", si.SiPostgresql, "4169E1"],
      ["Store / helpdesk", "Mock APIs", "Mocked", null],
      ["Auth", "OAuth2 + roles", "Planned", null],
      ["Testing", "pytest scenarios", "Proposed", si.SiPytest, "0A9EDC"],
      ["Deploy", "Docker Compose", "Proposed", si.SiDocker, "2496ED"],
    ];
    const none = { type: "none" }, rule = { type: "solid", pt: STROKE.hair, color: COLOR.rule }, strong = { type: "solid", pt: 1, color: COLOR.slate };
    const hdr = ["Layer", "Technology", "Status"].map((t) => ({ text: t, options: { color: COLOR.text2, fontSize: SIZE.small, border: [none, none, strong, none] } }));
    const statusStyle = { Proposed: { color: COLOR.ink }, Mocked: { color: COLOR.ink, italic: true }, Planned: { color: COLOR.text2, italic: true } };
    const body = stack.map(([l, t, st]) => [
      { text: l, options: { border: [none, none, rule, none] } },
      { text: t, options: { border: [none, none, rule, none], margin: [0, 0.04, 0, 0.36] } },
      { text: st, options: Object.assign({ border: [none, none, rule, none] }, statusStyle[st]) },
    ]);
    const tY = 1.8, rowH = 0.44;
    s.addTable([hdr, ...body], { x: tx, y: tY, w: tw, colW, rowH, fontFace: FONT, fontSize: SIZE.label - 1, color: COLOR.ink, valign: "middle", margin: [0, 0.04, 0, 0.04] });
    for (let i = 0; i < stack.length; i++) {
      const [, t, , Comp, col] = stack[i];
      if (!Comp) continue;
      s.addImage({ data: await logo(Comp, col), x: tx + colW[0] + 0.06, y: tY + rowH * (i + 1) + (rowH - 0.22) / 2, w: 0.22, h: 0.22, altText: t + " logo" });
    }
    text(s, "Proposed: in the MVP plan, not yet built. Mocked: simulated for the demo. Planned: pilot or later. Nothing is implemented yet.",
      { x: tx, y: 6.27, w: tw, h: 0.5, fontSize: SIZE.foot, color: COLOR.text2 });

    s.addNotes("The LLM only proposes a structured action; the policy gate (deterministic rules, limits, roles) decides whether it runs, may route it to the agent console for approval, and only allow-listed connectors can act. Store/helpdesk APIs are mocked in the MVP. Status labels reflect the plan; no component is implemented yet. Logos are Simple Icons brand marks. Sources: ReAct https://react-lm.github.io (arXiv:2210.03629); Toolformer https://arxiv.org/abs/2302.04761.");
  }

  // ==========================================================================
  // 5 — Impact: three stakeholders, one metrics list
  // ==========================================================================
  {
    const s = content("Who gains, and how we'll know.");
    const lw = 6.9;
    const who = [
      ["Support agents", "Fewer lookups and repeated updates; more time for hard cases.", "context retrieval and tool actions"],
      ["Customers", "A fix that's actually done, with proof, without repeating the story.", "verified actions and notifications"],
      ["Managers and owners", "See what was resolved, escalated or failed, inside set limits.", "audit log, policy gate, roles"],
    ];
    who.forEach(([h, b, via], i) => {
      const y = 1.85 + i * 1.45;
      text(s, h, { x: M, y, w: lw, h: 0.38, fontSize: SIZE.heading, bold: true });
      text(s, b, { x: M, y: y + 0.42, w: lw, h: 0.4, fontSize: SIZE.body });
      text(s, "via " + via, { x: M, y: y + 0.84, w: lw, h: 0.3, fontSize: SIZE.small, color: COLOR.text2 });
      if (i < who.length - 1) hairline(s, M, y + 1.3, lw);
    });
    text(s, "Method: run a scripted case set with today's process, then the same set with Resolv, and compare from the audit log.",
      { x: M, y: 6.25, w: lw, h: 0.5, fontSize: SIZE.small, color: COLOR.text2 });

    const kx = 8.25, kw = R - kx;
    text(s, "Pilot metrics", { x: kx, y: 1.85, w: kw, h: 0.38, fontSize: SIZE.heading, bold: true });
    text(s, "Proposed, not yet measured", { x: kx, y: 2.25, w: kw, h: 0.3, fontSize: SIZE.small, color: COLOR.blue, bold: true });
    const kpis = [
      ["Task completion rate", "cases closed by a verified action"],
      ["Resolution time", "first message to verified outcome"],
      ["First-contact resolution", "no repeat contact needed"],
      ["Escalation rate", "share sent to an agent, with reason"],
      ["Action success rate", "actions that pass their check"],
      ["Record accuracy", "fields correct on an audit sample"],
    ];
    hairline(s, kx, 2.68, kw);
    kpis.forEach(([h, d], i) => {
      const y = 2.78 + i * 0.66;
      text(s, h, { x: kx, y, w: kw, h: 0.3, fontSize: SIZE.label, bold: true });
      text(s, d, { x: kx, y: y + 0.29, w: kw, h: 0.27, fontSize: SIZE.small, color: COLOR.text2 });
      hairline(s, kx, y + 0.6, kw);
    });

    s.addNotes("Benefits are expected effects tied to specific capabilities, not measured results. There is no baseline or pilot data yet. When results exist, report the sample size and test conditions alongside them.");
  }

  // ==========================================================================
  // 6 — Business: roadmap line, revenue model, future themes
  // ==========================================================================
  {
    const s = content("Start narrow, prove the outcome, then scale.");
    const ty = 1.95;
    arrow(s, M, ty, R, ty);
    const phases = [
      ["MVP", "Damaged and missing items, on mock store APIs"],
      ["Pilot", "One brand's helpdesk, measured against a baseline"],
      ["Production", "SSO, roles, retries and monitoring"],
      ["Scale", "Multi-tenant SaaS and more workflows"],
    ];
    const pw = CW / 4;
    phases.forEach(([h, d], i) => {
      const x = M + i * pw;
      s.addShape(pres.shapes.OVAL, { x, y: ty - 0.09, w: 0.18, h: 0.18, fill: { color: i === 0 ? COLOR.blue : COLOR.white }, line: { color: COLOR.blue, width: STROKE.primary } });
      text(s, h, { x, y: ty + 0.25, w: pw - 0.3, h: 0.35, fontSize: SIZE.heading, bold: true, color: i === 0 ? COLOR.blue : COLOR.ink });
      text(s, d, { x, y: ty + 0.65, w: pw - 0.35, h: 0.8, fontSize: SIZE.label });
    });
    text(s, [r("Go-to-market  ", { bold: true }), r("D2C e-commerce brands first  →  controlled pilot  →  measured ROI  →  more workflows", { color: COLOR.text2 })],
      { x: M, y: 3.6, w: CW, h: 0.32, fontSize: SIZE.label });

    const by = 4.35, lw = 6.6;
    text(s, [r("Revenue model", { bold: true }), r("   hypothesis; pricing not yet validated", { color: COLOR.text2, fontSize: SIZE.small })],
      { x: M, y: by, w: lw, h: 0.38, fontSize: SIZE.heading });
    hairline(s, M, by + 0.5, lw);
    [["Subscription", "by agent seats and monthly case volume"],
     ["Per verified resolution", "charged only when an action passes its check"],
     ["Onboarding", "paid store and helpdesk setup"],
     ["Enterprise", "private deployment, governance, support"]].forEach(([h, d], i) => {
      const y = by + 0.58 + i * 0.47;
      text(s, h, { x: M, y, w: 2.5, h: 0.38, fontSize: SIZE.label, bold: true, valign: "middle" });
      text(s, d, { x: M + 2.55, y, w: lw - 2.55, h: 0.38, fontSize: SIZE.label, valign: "middle" });
      hairline(s, M, y + 0.43, lw);
    });

    const fx = 8.05, fw = R - fx;
    text(s, "Next, by theme", { x: fx, y: by, w: fw, h: 0.38, fontSize: SIZE.heading, bold: true });
    hairline(s, fx, by + 0.5, fw);
    [["Channels", "WhatsApp, email, voice"],
     ["Integrations", "Shopify, Zendesk, Freshdesk"],
     ["Reach", "Hindi and regional languages; sales follow-ups"]].forEach(([h, d], i) => {
      const y = by + 0.58 + i * 0.63;
      text(s, [r(h, { bold: true, breakLine: true }), r(d, { color: COLOR.text2 })], { x: fx, y, w: fw, h: 0.58, fontSize: SIZE.label });
      hairline(s, fx, y + 0.6, fw);
    });

    s.addNotes("Pricing is a hypothesis to test in the pilot; no price points are claimed. The per-verified-resolution fee ties revenue to the outcome the problem statement asks for. Phases are sized for a small team: MVP during the hackathon on mocked APIs, then a pilot with one brand, then production hardening and scale.");
  }

  await pres.writeFile({ fileName: OUT });
  console.log("wrote", OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
