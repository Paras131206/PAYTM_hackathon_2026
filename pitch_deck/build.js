// Resolv pitch deck: Paytm Hackathon 2026, Track 3. Theme mirrors the prototype UI
// (navy hero, cyan accent, green/amber status chips, white rounded cards, robot mascot).
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const tb = require("react-icons/tb");
const path = require("path");
const { applyTheme } = require("./apply_theme.js");

const OUT = process.argv[2] || "Resolv_Paytm_Hackathon_2026.pptx";
const IMG = (f) => path.join(__dirname, "img", f);
const REPO = "https://github.com/Paras131206/PAYTM_hackathon_2026";

const HEX = {
  ink: "0F172A", white: "FFFFFF", navy: "0B2A5B", bg: "F3F6FB",
  cyan: "0EA5E0", green: "16A34A", amber: "D97706", deep: "1E3A8A", rose: "E11D48", muted: "64748B",
  navy2: "12366F", line: "DCE3EE", cyanSoft: "E0F4FC", greenSoft: "DCFCE7", amberSoft: "FEF3C7", roseSoft: "FFE4E6",
};
const THEME = {
  name: "Resolv",
  headFontFace: "Arial",
  bodyFontFace: "Calibri",
  colors: {
    dk1: HEX.ink, lt1: HEX.white, dk2: HEX.navy, lt2: HEX.bg,
    accent1: HEX.cyan, accent2: HEX.green, accent3: HEX.amber, accent4: HEX.deep, accent5: HEX.rose, accent6: HEX.muted,
    hlink: HEX.cyan, folHlink: HEX.deep,
  },
};

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "Resolv: AI support teammate for failed UPI payments";
pres.author = "Team 4-Goats";
pres.subject = "Paytm Hackathon 2026, Track 3: Autonomous AI Teammates";
const C = pres.SchemeColor;
const W = 13.333;

// ------------------------------------------------------------------ helpers
async function icon(name, colorHex, px = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(tb[name], { color: "#" + colorHex, size: px }));
  const buf = await sharp(Buffer.from(svg)).resize(px, px).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}
const shadow = () => ({ type: "outer", color: HEX.navy, opacity: 0.12, blur: 9, offset: 2, angle: 90 });

function card(slide, x, y, w, h, opt = {}) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h, rectRadius: opt.radius ?? 0.14,
    fill: { color: opt.fill ?? C.background1 },
    line: { color: opt.line ?? HEX.line, width: opt.lineW ?? 0.75 },
    shadow: opt.noShadow ? undefined : shadow(),
    objectName: opt.name,
  });
}
function pill(slide, text, x, y, w, h, opt = {}) {
  slide.addText(text, {
    x, y, w, h, isTextBox: true, shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: h / 2,
    fill: { color: opt.fill ?? C.accent1 }, line: { color: opt.line ?? opt.fill ?? C.accent1, width: 0.75 },
    color: opt.color ?? C.background1, fontSize: opt.size ?? 12, bold: opt.bold ?? true, align: "center", valign: "middle",
    margin: 0, objectName: opt.name,
  });
}
async function iconDot(slide, name, x, y, d, opt = {}) {
  slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: opt.bg ?? C.accent1 }, line: { color: opt.bg ?? C.accent1, width: 0 } });
  const pad = d * 0.22;
  slide.addImage({ data: await icon(name, opt.fg ?? HEX.white), x: x + pad, y: y + pad, w: d - 2 * pad, h: d - 2 * pad, altText: opt.alt ?? name.replace(/^Tb/, "") + " icon" });
}
async function arrow(slide, dir, x, y, s, colorHex = HEX.cyan) {
  const n = { right: "TbArrowRight", down: "TbArrowDown", left: "TbArrowLeft" }[dir];
  slide.addImage({ data: await icon(n, colorHex), x, y, w: s, h: s, altText: "arrow" });
}

// ------------------------------------------------------------------ layouts
pres.defineSlideMaster({
  title: "Title (dark)",
  background: { color: HEX.navy },
  objects: [],
});
pres.defineSlideMaster({
  title: "Content",
  background: { color: HEX.bg },
  margin: [0.4, 0.5, 0.5, 0.5],
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.5, y: 0.3, w: 9.6, h: 0.75, fontSize: 30, bold: true, color: C.text2, align: "left", valign: "middle", margin: 0, fontFace: THEME.headFontFace }, text: "" } },
    { text: { text: "Resolv  ·  Paytm Hackathon 2026  ·  Track 3: Autonomous AI Teammates", options: { x: 0.5, y: 7.08, w: 8, h: 0.28, fontSize: 10, color: C.accent6, margin: 0 } } },
  ],
  slideNumber: { x: 12.33, y: 7.08, w: 0.5, h: 0.28, fontSize: 10, color: C.accent6, align: "right" },
});

// Small top-right brand chip on content slides (mirrors the prototype's engine chip).
async function brand(slide) {
  pill(slide, "", 10.55, 0.42, 2.28, 0.5, { fill: C.background1, line: HEX.line, name: "brand chip" });
  await iconDot(slide, "TbRobot", 10.62, 0.47, 0.4, { bg: C.text2, fg: HEX.cyan, alt: "Resolv robot logo" });
  slide.addText([{ text: "Resolv", options: { bold: true, color: C.text2, fontSize: 13 } }, { text: "  AI teammate", options: { color: C.accent6, fontSize: 11 } }],
    { x: 11.1, y: 0.42, w: 1.7, h: 0.5, isTextBox: true, valign: "middle", margin: 0 });
}

async function main() {
  // ================================================================ 1. TITLE
  pres.addSection({ title: "Introduction" });
  let s = pres.addSlide({ masterName: "Title (dark)", sectionTitle: "Introduction" });
  // soft glow circles behind the mascot
  s.addShape(pres.shapes.OVAL, { x: 8.75, y: 0.85, w: 4.0, h: 4.0, fill: { color: HEX.cyan, transparency: 88 }, line: { color: HEX.cyan, transparency: 100 } });
  s.addShape(pres.shapes.OVAL, { x: 9.3, y: 1.4, w: 2.9, h: 2.9, fill: { color: HEX.navy2 }, line: { color: HEX.cyan, width: 1.5, transparency: 40 } });
  s.addImage({ data: await icon("TbRobot", HEX.cyan, 512), x: 9.75, y: 1.85, w: 2.0, h: 2.0, altText: "Resolv robot mascot" });
  pill(s, "●  100% deterministic refund policy", 9.15, 4.55, 3.2, 0.42, { fill: HEX.ink, line: HEX.navy2, color: C.background1, size: 12, bold: false });

  pill(s, "PAYTM HACKATHON 2026  ·  TRACK 3: AUTONOMOUS AI TEAMMATES", 0.6, 0.6, 6.4, 0.42, { fill: C.text2, line: HEX.cyan, color: HEX.cyan, size: 12 });
  s.addText("Resolv", { x: 0.6, y: 1.2, w: 7.5, h: 1.1, fontSize: 66, bold: true, color: C.background1, fontFace: THEME.headFontFace, margin: 0, isTextBox: true });
  s.addText([
    { text: "The AI support teammate that ", options: { color: "CFE3F7" } },
    { text: "resolves", options: { color: HEX.cyan, bold: true } },
    { text: " failed UPI payments end to end, instead of just talking about them", options: { color: "CFE3F7" } },
  ], { x: 0.6, y: 2.35, w: 7.6, h: 1.0, fontSize: 21, margin: 0, isTextBox: true, valign: "top" });

  const rows = [
    ["Problem statement", "Build AI teammates that don't just respond; they get the job done"],
    ["Team name", "4-Goats"],
    ["Team members", "Paras Patil  ·  Swastik Athanikar\nNitish Shinde  ·  Sanchit Tawde"],
  ];
  rows.forEach(([k, v], i) => {
    const y = 3.75 + i * 0.62;
    const h = v.includes("\n") ? 0.8 : 0.45;  // the member list sits on two lines, two names each
    s.addText(k.toUpperCase(), { x: 0.6, y, w: 2.2, h: 0.45, fontSize: 12, bold: true, color: HEX.cyan, margin: 0, valign: "middle", isTextBox: true, charSpacing: 1 });
    s.addText(v, { x: 2.8, y: y + (h > 0.45 ? 0.03 : 0), w: 5.6, h, fontSize: 16, color: C.background1, margin: 0, valign: h > 0.45 ? "top" : "middle", isTextBox: true });
  });
  const chips = [["Understands", HEX.cyan], ["Acts", HEX.green], ["Verifies", HEX.cyan], ["Escalates", HEX.amber]];
  chips.forEach(([t, c], i) => pill(s, t, 0.6 + i * 1.55, 5.85, 1.4, 0.42, { fill: C.text2, line: c, color: c, size: 13 }));
  s.addText([{ text: "GitHub: ", options: { color: "9FB6D3" } }, { text: "github.com/Paras131206/PAYTM_hackathon_2026", options: { color: HEX.cyan, hyperlink: { url: REPO } } }],
    { x: 0.6, y: 6.7, w: 8, h: 0.35, fontSize: 12, margin: 0, isTextBox: true });
  s.addNotes("Introduce the team and Resolv: an AI teammate for Paytm-style payment support that resolves failed UPI payment tickets end to end — it understands the complaint, checks the payment, issues the refund within policy, verifies it, and hands anything risky to a human.");

  // ================================================================ 2. PROBLEM
  pres.addSection({ title: "Problem" });
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Problem" });
  s.addText("Problem statement", { placeholder: "title" });
  await brand(s);
  // official statement
  card(s, 0.5, 1.3, 5.0, 5.45, { fill: C.text2, line: HEX.navy, name: "official problem statement" });
  pill(s, "OFFICIAL PROBLEM STATEMENT", 0.85, 1.6, 3.2, 0.38, { fill: HEX.navy2, line: HEX.cyan, color: HEX.cyan, size: 11 });
  s.addText("“How might we build an AI teammate that can independently handle a customer-service or sales workflow end-to-end — resolving issues, taking actions across systems, and escalating to humans only when needed?”",
    { x: 0.85, y: 2.15, w: 4.35, h: 2.6, fontSize: 18, italic: true, color: C.background1, margin: 0, valign: "top", isTextBox: true });
  s.addShape(pres.shapes.LINE, { x: 0.85, y: 4.95, w: 4.3, h: 0, line: { color: HEX.navy2, width: 1 } });
  s.addText([
    { text: "Our focus: ", options: { bold: true, color: HEX.cyan } },
    { text: "customer service for failed and disputed UPI payments, the most common payments-support ticket.", options: { color: "CFE3F7" } },
  ], { x: 0.85, y: 5.1, w: 4.35, h: 1.3, fontSize: 15, margin: 0, isTextBox: true, valign: "top" });

  const pains = [
    ["TbCash", "“Money debited, payment failed”", "Every ticket needs the same manual checks: payment switch, ledger, refund policy, then a reply. Customers wait and worry.", C.accent5, HEX.roseSoft],
    ["TbMessages", "Chatbots answer, they don't act", "Today's bots can explain a refund but cannot issue it, verify it or close the ticket, so a human still does the work.", C.accent3, HEX.amberSoft],
    ["TbShieldLock", "Letting AI move money is risky", "An LLM can invent an amount, obey a prompt injection, or claim a refund that never happened.", C.accent4, HEX.cyanSoft],
  ];
  for (let i = 0; i < pains.length; i++) {
    const [ic, t, d, col, soft] = pains[i];
    const y = 1.3 + i * 1.3;
    card(s, 5.8, y, 7.03, 1.12, { name: "pain " + (i + 1) });
    s.addShape(pres.shapes.OVAL, { x: 6.02, y: y + 0.24, w: 0.64, h: 0.64, fill: { color: soft }, line: { color: soft, width: 0 } });
    s.addImage({ data: await icon(ic, { [C.accent5]: HEX.rose, [C.accent3]: HEX.amber, [C.accent4]: HEX.deep }[col]), x: 6.15, y: y + 0.37, w: 0.38, h: 0.38, altText: t });
    s.addText(t, { x: 6.9, y: y + 0.1, w: 5.8, h: 0.38, fontSize: 16, bold: true, color: C.text1, margin: 0, isTextBox: true, valign: "middle" });
    s.addText(d, { x: 6.9, y: y + 0.48, w: 5.8, h: 0.58, fontSize: 13, color: C.accent6, margin: 0, isTextBox: true, valign: "top" });
  }
  card(s, 5.8, 5.2, 7.03, 1.55, { fill: HEX.cyanSoft, line: "BDE5F7", name: "RBI rule callout" });
  s.addText("T+1", { x: 6.0, y: 5.32, w: 1.45, h: 0.85, fontSize: 40, bold: true, color: C.text2, margin: 0, isTextBox: true, fontFace: THEME.headFontFace });
  s.addText("₹100/day", { x: 6.0, y: 6.12, w: 1.6, h: 0.45, fontSize: 18, bold: true, color: C.accent5, margin: 0, isTextBox: true });
  s.addText([
    { text: "Slow resolution has a real cost. ", options: { bold: true, color: C.text1 } },
    { text: "RBI requires a failed UPI debit to be reversed by T+1. After that, the customer must be compensated ₹100 for every day of delay.", options: { color: C.text1 } },
  ], { x: 7.75, y: 5.3, w: 4.9, h: 0.95, fontSize: 14, margin: 0, isTextBox: true, valign: "top" });
  s.addText("Source: RBI circular on TAT harmonisation and compensation for failed transactions, 20 Sep 2019", { x: 7.75, y: 6.3, w: 4.9, h: 0.35, fontSize: 10, color: C.accent6, margin: 0, isTextBox: true });
  s.addNotes("The official problem asks for an AI teammate that completes a workflow end to end. We picked failed UPI payments: a high-volume, rule-bound ticket where speed matters (T+1, then ₹100/day compensation) and where a careless AI could do real damage by moving money.");

  // ================================================================ 3. PROPOSED SOLUTION
  pres.addSection({ title: "Solution" });
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Solution" });
  s.addText("Proposed solution: Resolv", { placeholder: "title" });
  await brand(s);
  card(s, 0.5, 1.25, 12.33, 0.9, { fill: C.text2, line: HEX.navy, name: "core idea" });
  await iconDot(s, "TbBulb", 0.72, 1.4, 0.6, { bg: HEX.navy2, fg: HEX.cyan, alt: "core idea" });
  s.addText([
    { text: "Core idea:  ", options: { bold: true, color: HEX.cyan } },
    { text: "the AI decides what to do, fixed rules decide what is allowed, tools do it, and the ledger proves it.", options: { color: C.background1 } },
  ], { x: 1.5, y: 1.25, w: 11.1, h: 0.9, fontSize: 18, margin: 0, isTextBox: true, valign: "middle" });

  const does = [
    ["TbEye", "Understands", "Profile, recent payments, past tickets and the chat."],
    ["TbBrain", "Decides", "Intent and which payment; asks once if unsure."],
    ["TbBolt", "Acts", "Checks the switch, refunds, updates the ticket, replies."],
    ["TbClipboardCheck", "Verifies", "Confirms the refund in the ledger before saying so."],
    ["TbUserCheck", "Escalates", "Big refunds, disputes, outages, tricks go to a human."],
  ];
  for (let i = 0; i < does.length; i++) {
    const [ic, t, d] = does[i];
    const y = 2.45 + i * 0.75;
    await iconDot(s, ic, 0.55, y + 0.04, 0.56, { alt: t });
    s.addText(t, { x: 1.3, y, w: 4.1, h: 0.32, fontSize: 16, bold: true, color: C.text2, margin: 0, isTextBox: true });
    s.addText(d, { x: 1.3, y: y + 0.32, w: 4.25, h: 0.3, fontSize: 13, color: C.accent6, margin: 0, isTextBox: true, valign: "top" });
  }
  // product shot
  card(s, 5.75, 2.45, 7.08, 3.6, { name: "screenshot frame" });
  s.addImage({ path: IMG("shot3.png"), x: 5.88, y: 2.58, w: 6.82, h: 3.22, altText: "Resolv prototype: case workspace with customer context, thread and agent execution timeline" });
  s.addText("Working prototype: the case workspace. The ₹450 payment shows “refunded” after a verified ledger check.", { x: 5.88, y: 5.8, w: 6.82, h: 0.25, fontSize: 10, color: C.accent6, margin: 0, isTextBox: true });
  s.addText("WHO IT'S FOR", { x: 0.5, y: 6.38, w: 1.6, h: 0.42, fontSize: 12, bold: true, color: C.accent6, margin: 0, isTextBox: true, valign: "middle" });
  ["UPI app support teams", "Payment aggregators", "Bank service desks", "Merchant operations"].forEach((t, i) =>
    pill(s, t, 2.1 + i * 2.7, 6.38, 2.5, 0.42, { fill: C.background1, line: HEX.cyan, color: C.text2, size: 13 }));
  s.addNotes("Resolv is a teammate, not a chatbot. The language model plans; a deterministic policy engine decides what is allowed; validated tools do the work; and a ledger check proves it worked. The screenshot is the live prototype after resolving TKT-1001.");

  // ================================================================ 4. END-TO-END WORKFLOW
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Solution" });
  s.addText("End-to-end workflow", { placeholder: "title" });
  await brand(s);
  const steps = [
    ["TbMessageCircle", "Customer message", "App chat: “₹450 debited, payment failed”"],
    ["TbDatabase", "Load context", "Profile, last 10 payments, past tickets, policies"],
    ["TbTargetArrow", "Assess", "Intent + which payment + manipulation check"],
    ["TbFileSearch", "Gather evidence", "Ask the payment switch: SUCCESS / FAILED / PENDING"],
    ["TbScale", "Policy decision", "Fixed rules: auto-refund, approve, wait or block"],
    ["TbReceiptRefund", "Act", "Refund (amount from ledger), update ticket, reply"],
    ["TbChecks", "Verify", "Re-read the ledger; no claim before proof"],
    ["TbUserCheck", "Close or hand off", "Resolve + notify, or human queue with evidence"],
  ];
  const sw = 2.72, sh = 1.95, gx = 0.45, x0 = 0.5;
  for (let i = 0; i < 8; i++) {
    const row = i < 4 ? 0 : 1;
    const col = row === 0 ? i : 7 - i; // snake: second row runs right-to-left
    const x = x0 + col * (sw + gx), y = row === 0 ? 1.3 : 3.75;
    const [ic, t, d] = steps[i];
    card(s, x, y, sw, sh, { name: "step " + (i + 1) });
    await iconDot(s, ic, x + 0.2, y + 0.2, 0.55, { alt: t });
    s.addText(String(i + 1), { x: x + sw - 0.62, y: y + 0.2, w: 0.42, h: 0.42, fontSize: 13, bold: true, color: C.accent1, align: "center", valign: "middle",
      shape: pres.shapes.OVAL, fill: { color: HEX.cyanSoft }, line: { color: HEX.cyanSoft }, margin: 0, isTextBox: true });
    s.addText(t, { x: x + 0.2, y: y + 0.85, w: sw - 0.4, h: 0.36, fontSize: 15, bold: true, color: C.text2, margin: 0, isTextBox: true });
    s.addText(d, { x: x + 0.2, y: y + 1.22, w: sw - 0.4, h: 0.65, fontSize: 13, color: C.accent6, margin: 0, isTextBox: true, valign: "top" });
    if (i < 3) await arrow(s, "right", x + sw + 0.05, y + sh / 2 - 0.17, 0.34);
    if (i === 3) await arrow(s, "down", x + sw / 2 - 0.17, y + sh + 0.12, 0.34);
    if (i > 3 && i < 7) await arrow(s, "left", x - 0.4, y + sh / 2 - 0.17, 0.34);
  }
  card(s, 0.5, 5.98, 12.33, 0.88, { fill: C.background1, name: "outcomes" });
  s.addText("OUTCOMES", { x: 0.72, y: 5.98, w: 1.3, h: 0.88, fontSize: 12, bold: true, color: C.accent6, margin: 0, isTextBox: true, valign: "middle" });
  const outs = [["Auto-resolved", 1.75, HEX.green, HEX.greenSoft], ["Human approval (> ₹2,000 / flagged)", 3.05, HEX.amber, HEX.amberSoft],
    ["Wait (pending inside T+1)", 2.35, HEX.cyan, HEX.cyanSoft], ["Escalate (dispute · outage · tricks)", 2.95, HEX.rose, HEX.roseSoft]];
  let ox = 1.95;
  for (const [t, w, c, soft] of outs) {
    pill(s, "●  " + t, ox, 6.21, w, 0.42, { fill: soft, line: c, color: c, size: 12 });
    ox += w + 0.14;
  }
  s.addNotes("Walk the loop with TKT-1001: the agent loads context, records its assessment, checks the switch (FAILED), the policy engine allows an automatic refund under ₹2,000, the refund is written and then verified in the ledger, the ticket is resolved and the customer told — all in one run. Other branches go to approval, wait or escalation.");

  // ================================================================ 5. TECHNOLOGY
  pres.addSection({ title: "Technology" });
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Technology" });
  s.addText("Technology & tech stack", { placeholder: "title" });
  await brand(s);
  pill(s, "SYSTEM ARCHITECTURE", 0.5, 1.22, 2.6, 0.38, { fill: C.text2, color: HEX.cyan, size: 11 });
  const arch = [
    ["TbBrandReact", "React UI", "Cases, timeline, human queue, metrics"],
    ["TbApi", "FastAPI", "Typed API, background agent runs"],
    ["TbRoute", "Orchestrator", "Turn budget, audit, outcome from state"],
    ["TbBrain", "LLM chain", "Gemini → Groq → Ollama failover"],
    ["TbScale", "Policy + tools", "Rules engine, 10 validated tools"],
    ["TbDatabase", "Sandbox + SQLite", "Switch, refund ledger, audit trail"],
  ];
  const aw = 1.8, ag = 0.306;
  for (let i = 0; i < arch.length; i++) {
    const [ic, t, d] = arch[i];
    const x = 0.5 + i * (aw + ag), y = 1.75;
    card(s, x, y, aw, 1.75, { name: "arch " + t });
    await iconDot(s, ic, x + aw / 2 - 0.27, y + 0.15, 0.54, { bg: i === 3 ? C.accent2 : C.accent1, alt: t });
    s.addText(t, { x: x + 0.1, y: y + 0.75, w: aw - 0.2, h: 0.32, fontSize: 14, bold: true, color: C.text2, align: "center", margin: 0, isTextBox: true });
    s.addText(d, { x: x + 0.1, y: y + 1.07, w: aw - 0.2, h: 0.6, fontSize: 12, color: C.accent6, align: "center", margin: 0, isTextBox: true, valign: "top" });
    if (i < arch.length - 1) await arrow(s, "right", x + aw + 0.02, y + 0.72, 0.27);
  }
  // stack list
  card(s, 0.5, 3.8, 5.6, 3.05, { name: "tech stack" });
  s.addText("Tech stack", { x: 0.75, y: 3.92, w: 3, h: 0.4, fontSize: 17, bold: true, color: C.text2, margin: 0, isTextBox: true });
  const stack = [
    ["TbBrandPython", "Python 3.14 · FastAPI · Pydantic", "backend, tool schemas"],
    ["TbBrandReact", "React 19 · TypeScript · Vite", "operations UI"],
    ["TbSparkles", "Gemini · Groq · Ollama (local)", "LLM providers, free tiers"],
    ["TbDatabase", "SQLite", "tickets, ledger, audit events"],
    ["TbTestPipe", "pytest (95 tests) · GitHub", "quality and versioning"],
  ];
  for (let i = 0; i < stack.length; i++) {
    const [ic, t, d] = stack[i];
    const y = 4.42 + i * 0.47;
    s.addImage({ data: await icon(ic, HEX.cyan), x: 0.78, y: y + 0.04, w: 0.32, h: 0.32, altText: t });
    s.addText([{ text: t, options: { bold: true, color: C.text1 } }, { text: "  " + d, options: { color: C.accent6 } }],
      { x: 1.25, y, w: 4.75, h: 0.4, fontSize: 13, margin: 0, isTextBox: true, valign: "middle" });
  }
  card(s, 6.35, 3.8, 6.48, 3.05, { fill: C.text2, line: HEX.navy, name: "why this stack" });
  s.addText("Why this stack", { x: 6.6, y: 3.92, w: 4, h: 0.4, fontSize: 17, bold: true, color: HEX.cyan, margin: 0, isTextBox: true });
  s.addText([
    { text: "FastAPI + Pydantic: ", options: { bold: true, color: C.background1, bullet: true } },
    { text: "every tool call is validated against a typed schema before it runs.", options: { color: "CFE3F7", breakLine: true } },
    { text: "Three LLM providers: ", options: { bold: true, color: C.background1, bullet: true } },
    { text: "if one hits a quota or outage, the run switches mid-ticket. Ollama works offline.", options: { color: "CFE3F7", breakLine: true } },
    { text: "SQLite: ", options: { bold: true, color: C.background1, bullet: true } },
    { text: "zero setup, and every decision, tool call and result is stored for audit.", options: { color: "CFE3F7", breakLine: true } },
    { text: "React + TypeScript: ", options: { bold: true, color: C.background1, bullet: true } },
    { text: "a typed UI that shows real backend state, never mock activity.", options: { color: "CFE3F7" } },
  ], { x: 6.6, y: 4.38, w: 6.05, h: 2.35, fontSize: 13, margin: 0, isTextBox: true, valign: "top", paraSpaceAfter: 5 });
  s.addNotes("Architecture: the UI talks to a FastAPI backend. The orchestrator runs the loop; the LLM chain only proposes tool calls; the policy engine and tool registry decide and execute; sandbox adapters stand in for the payment switch and refund rail; SQLite stores everything for audit.");

  // ================================================================ 6. USP
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Technology" });
  s.addText("USP: what makes Resolv different", { placeholder: "title" });
  await brand(s);
  const usps = [
    ["TbBolt", "Acts, not just answers", "Issues the refund, updates the ticket and replies, in one run."],
    ["TbScale", "Policy lives outside the AI", "Fixed rules decide refunds; amounts come from the ledger, never the model."],
    ["TbChecks", "Verify before claiming", "Can't say “refunded” or close a ticket until the ledger confirms it."],
    ["TbUserCheck", "Humans where it matters", "Approval queue shows evidence and policy checks for every handoff."],
    ["TbArrowsShuffle", "Never fakes an answer", "Gemini → Groq → Ollama failover; if all fail, a human takes over."],
    ["TbFingerprint", "Audit trail + injection guard", "Every step is logged; “admin mode” tricks are flagged and blocked."],
  ];
  const uw = 2.92, uh = 2.55;
  for (let i = 0; i < usps.length; i++) {
    const [ic, t, d] = usps[i];
    const x = 0.5 + (i % 3) * (uw + 0.3), y = 1.3 + Math.floor(i / 3) * (uh + 0.3);
    card(s, x, y, uw, uh, { name: "usp " + (i + 1) });
    await iconDot(s, ic, x + 0.25, y + 0.25, 0.62, { alt: t });
    s.addText(t, { x: x + 0.25, y: y + 1.0, w: uw - 0.5, h: 0.62, fontSize: 16, bold: true, color: C.text2, margin: 0, isTextBox: true, valign: "top" });
    s.addText(d, { x: x + 0.25, y: y + 1.62, w: uw - 0.5, h: 0.85, fontSize: 13, color: C.accent6, margin: 0, isTextBox: true, valign: "top" });
  }
  card(s, 10.35, 1.3, 2.48, 5.4, { name: "timeline screenshot frame" });
  s.addImage({ path: IMG("shot5.png"), x: 10.47, y: 1.42, w: 2.24, h: 4.52, altText: "Agent execution timeline showing policy checks, verified refund and reply" });
  s.addText("Real policy checks and ledger proof in the live timeline", { x: 10.47, y: 5.98, w: 2.24, h: 0.62, fontSize: 10, color: C.accent6, margin: 0, isTextBox: true, valign: "top" });
  s.addNotes("Most AI agents are trusted to behave. Resolv is built so it doesn't have to be trusted: the model can propose anything, but only policy-approved, validated, verified actions happen — and every one is visible in the timeline.");

  // ================================================================ 7. IMPACT & BENEFITS
  pres.addSection({ title: "Impact" });
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Impact" });
  s.addText("Impact & benefits", { placeholder: "title" });
  await brand(s);
  const stats = [
    ["8 / 8", "demo scenarios handled correctly", C.accent2],
    ["100%", "of refunds verified in the ledger before the customer was told", C.accent1],
    ["14–83 s", "live LLM run, from complaint to resolved ticket", C.text2],
    ["95", "automated tests: policy, tools, failover, API", C.accent4],
  ];
  for (let i = 0; i < stats.length; i++) {
    const [n, l, col] = stats[i];
    const x = 0.5 + (i % 2) * 2.95, y = 1.3 + Math.floor(i / 2) * 2.25;
    card(s, x, y, 2.75, 2.05, { name: "stat " + n });
    s.addText(n, { x: x + 0.22, y: y + 0.2, w: 2.35, h: 0.9, fontSize: 38, bold: true, color: col, margin: 0, isTextBox: true, fontFace: THEME.headFontFace, valign: "middle" });
    s.addText(l, { x: x + 0.22, y: y + 1.12, w: 2.35, h: 0.8, fontSize: 13, color: C.accent6, margin: 0, isTextBox: true, valign: "top" });
  }
  s.addText("Prototype measurements on synthetic demo data (sandboxed payment rails), not business results.", { x: 0.5, y: 5.85, w: 5.7, h: 0.5, fontSize: 11, italic: true, color: C.accent6, margin: 0, isTextBox: true });
  const ben = [
    ["TbUsers", "Customers", ["Money back faster, inside the T+1 window", "Clear, honest status updates in the app chat"]],
    ["TbHeadset", "Support teams", ["Repetitive lookups and refunds are handled for them", "Every handoff arrives with evidence and policy checks"]],
    ["TbBuildingBank", "The business", ["Avoids ₹100/day delay compensation", "Consistent policy, no wrong or duplicate refunds, audit-ready"]],
  ];
  for (let i = 0; i < ben.length; i++) {
    const [ic, t, items] = ben[i];
    const y = 1.3 + i * 1.82;
    card(s, 6.45, y, 6.38, 1.64, { name: "benefit " + t });
    await iconDot(s, ic, 6.68, y + 0.3, 0.62, { bg: [C.accent1, C.accent2, C.text2][i], alt: t });
    s.addText(t, { x: 7.55, y: y + 0.15, w: 5.1, h: 0.38, fontSize: 16, bold: true, color: C.text2, margin: 0, isTextBox: true });
    s.addText(items.map((it, k) => ({ text: it, options: { bullet: true, breakLine: k < items.length - 1 } })),
      { x: 7.55, y: y + 0.55, w: 5.1, h: 1.0, fontSize: 13, color: C.text1, margin: 0, isTextBox: true, valign: "top", paraSpaceAfter: 3 });
  }
  s.addNotes("These are honest prototype numbers on synthetic data: every seeded scenario ends in the expected state, every refund is verified before the customer hears about it, and live LLM runs take seconds to about a minute. The business value is speed inside T+1, freed agent time, and consistent, auditable decisions.");

  // ================================================================ 8. BUSINESS MODEL
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Impact" });
  s.addText("Business model", { placeholder: "title" });
  await brand(s);
  pill(s, "B2B SaaS  ·  PROPOSED", 0.5, 1.22, 2.7, 0.38, { fill: C.text2, color: HEX.cyan, size: 11 });
  const bm = [
    ["TbBuildingStore", "Customers", ["UPI apps & payment service providers", "Payment aggregators", "Banks' digital service desks", "High-volume merchants"]],
    ["TbTargetArrow", "Value", ["Resolves routine payment tickets end to end", "Keeps humans for exceptions", "Stays inside RBI timelines", "Full audit trail"]],
    ["TbCash", "Revenue", ["Platform fee per support queue", "Outcome fee per verified, auto-resolved ticket", "Enterprise tier: on-prem / local LLM, custom policies, SLA"]],
    ["TbCpu", "Costs", ["LLM usage: low, with free-tier and local models in the failover chain", "Hosting", "Integration with switch and refund APIs"]],
  ];
  const bw = 2.9, bh = 3.15;
  for (let i = 0; i < bm.length; i++) {
    const [ic, t, items] = bm[i];
    const x = 0.5 + i * (bw + 0.243), y = 1.78;
    card(s, x, y, bw, bh, { name: "bm " + t });
    await iconDot(s, ic, x + 0.22, y + 0.22, 0.56, { bg: i === 2 ? C.accent2 : C.accent1, alt: t });
    s.addText(t, { x: x + 0.92, y: y + 0.22, w: bw - 1.1, h: 0.56, fontSize: 17, bold: true, color: C.text2, margin: 0, isTextBox: true, valign: "middle" });
    s.addText(items.map((it, k) => ({ text: it, options: { bullet: true, breakLine: k < items.length - 1 } })),
      { x: x + 0.22, y: y + 0.95, w: bw - 0.4, h: bh - 1.1, fontSize: 13, color: C.text1, margin: 0, isTextBox: true, valign: "top", paraSpaceAfter: 5 });
  }
  card(s, 0.5, 5.08, 12.33, 1.5, { fill: C.text2, line: HEX.navy, name: "go to market" });
  s.addText("GO-TO-MARKET", { x: 0.75, y: 5.18, w: 3, h: 0.35, fontSize: 12, bold: true, color: HEX.cyan, margin: 0, isTextBox: true, charSpacing: 1 });
  const gtm = [["1", "Pilot", "One support queue: failed UPI debits"], ["2", "Expand", "Wallet, merchant settlement, KYC tickets"], ["3", "Scale", "Offer to other PSPs, banks and merchants"]];
  for (let i = 0; i < gtm.length; i++) {
    const [n, t, d] = gtm[i];
    const x = 0.75 + i * 4.05;
    s.addText(n, { x, y: 5.66, w: 0.55, h: 0.55, fontSize: 16, bold: true, color: C.text2, align: "center", valign: "middle",
      shape: pres.shapes.OVAL, fill: { color: HEX.cyan }, line: { color: HEX.cyan }, margin: 0, isTextBox: true });
    s.addText([{ text: t + "  ", options: { bold: true, color: C.background1 } }, { text: d, options: { color: "CFE3F7" } }],
      { x: x + 0.7, y: 5.56, w: 3.05, h: 0.8, fontSize: 14, margin: 0, isTextBox: true, valign: "middle" });
    if (i < 2) await arrow(s, "right", x + 3.72, 5.77, 0.32);
  }
  s.addText("Outcome-based pricing: customers pay most when tickets are actually resolved, matching the brief's “measurable outcomes”.", { x: 0.5, y: 6.66, w: 12.3, h: 0.38, fontSize: 11, italic: true, color: C.accent6, margin: 0, isTextBox: true });
  s.addNotes("Proposed model: B2B SaaS with a platform fee plus an outcome fee per verified auto-resolved ticket, and an enterprise tier for on-prem or local models. Start with one queue, prove the numbers against a baseline, then expand to more ticket types and more payment companies.");

  // ================================================================ 9. FUTURE SCOPE & REFERENCES
  pres.addSection({ title: "Next steps" });
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Next steps" });
  s.addText("Future scope & references", { placeholder: "title" });
  await brand(s);
  const fut = [
    ["TbPlugConnected", "Real integrations", "Bank / PSP sandbox APIs for switch status and refunds"],
    ["TbLanguage", "Multilingual & voice", "Hindi and regional languages, voice notes"],
    ["TbCurrencyRupee", "Compensation automation", "Auto-credit ₹100/day when T+1 is missed"],
    ["TbLock", "Roles & security", "Login, approval roles, per-team policies"],
    ["TbChartBar", "Measured pilot", "Resolution time vs today's baseline, A/B tested"],
  ];
  const fw = 2.3;
  for (let i = 0; i < fut.length; i++) {
    const [ic, t, d] = fut[i];
    const x = 0.5 + i * (fw + 0.208), y = 1.3;
    card(s, x, y, fw, 2.75, { name: "future " + t });
    await iconDot(s, ic, x + 0.22, y + 0.25, 0.58, { alt: t });
    s.addText(t, { x: x + 0.22, y: y + 1.0, w: fw - 0.4, h: 0.66, fontSize: 15, bold: true, color: C.text2, margin: 0, isTextBox: true, valign: "top" });
    s.addText(d, { x: x + 0.22, y: y + 1.66, w: fw - 0.4, h: 1.0, fontSize: 13, color: C.accent6, margin: 0, isTextBox: true, valign: "top" });
  }
  card(s, 0.5, 4.35, 7.9, 2.5, { name: "references" });
  s.addText("References", { x: 0.75, y: 4.48, w: 4, h: 0.4, fontSize: 17, bold: true, color: C.text2, margin: 0, isTextBox: true });
  const refs = [
    ["RBI: TAT & compensation for failed transactions (2019)", "https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=11693"],
    ["ReAct: reasoning + acting in language models (Yao et al.)", "https://arxiv.org/abs/2210.03629"],
    ["Gemini API: function calling", "https://ai.google.dev/gemini-api/docs/function-calling"],
    ["Groq API documentation", "https://console.groq.com/docs"],
  ];
  s.addText(refs.map(([t, u], k) => ({ text: t, options: { hyperlink: { url: u }, color: C.accent4, bullet: true, breakLine: k < refs.length - 1 } })),
    { x: 0.75, y: 4.95, w: 7.45, h: 1.8, fontSize: 13, margin: 0, isTextBox: true, valign: "top", paraSpaceAfter: 6 });
  card(s, 8.65, 4.35, 4.18, 2.5, { fill: C.text2, line: HEX.navy, name: "links" });
  s.addText("Links", { x: 8.9, y: 4.48, w: 3, h: 0.4, fontSize: 17, bold: true, color: HEX.cyan, margin: 0, isTextBox: true });
  await iconDot(s, "TbBrandGithub", 8.9, 5.05, 0.5, { bg: HEX.navy2, fg: HEX.white, alt: "GitHub" });
  s.addText([{ text: "GitHub repository", options: { bold: true, color: C.background1, hyperlink: { url: REPO }, breakLine: true } },
    { text: "Paras131206/PAYTM_hackathon_2026", options: { color: "9FB6D3" } }], { x: 9.55, y: 4.98, w: 3.15, h: 0.66, fontSize: 13, margin: 0, isTextBox: true, valign: "middle" });
  await iconDot(s, "TbVideo", 8.9, 5.85, 0.5, { bg: HEX.navy2, fg: HEX.white, alt: "Demo video" });
  s.addText([{ text: "Demo video", options: { bold: true, color: C.background1, breakLine: true } },
    { text: "[add link]", options: { color: "9FB6D3" } }], { x: 9.55, y: 5.78, w: 3.15, h: 0.66, fontSize: 13, margin: 0, isTextBox: true, valign: "middle" });
  s.addNotes("Next: connect real bank or PSP sandbox APIs, add Indian languages and voice, automate T+1 compensation, add roles and login, and run a measured pilot against today's baseline. Code is on GitHub; add the demo video link before submitting.");

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
}
main().catch((e) => { console.error(e); process.exit(1); });
