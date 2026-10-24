# Resolv: fact sheet for the six-slide pitch

## Where the facts come from
- **This repository** (`PLS_SIH_JITADO`) is the APAAR / EduVerify student-data project. It has **no code for an AI sales or customer-service teammate**. Every component on the deck is therefore labelled PROPOSED, MOCKED or PLANNED. Nothing is labelled IMPLEMENTED.
- **Gemini share link** (https://share.gemini.google/YXqEP0Bh9dPL): it opens a sign-in wall. Only the title "Autonomous AI Teammates in Business" was visible, and the conversation itself was **not reviewed**.
- **ReAct**: Yao et al., *ReAct: Synergizing Reasoning and Acting in Language Models*, 2022, arXiv:2210.03629, https://react-lm.github.io. The deck uses its interleaved reason-and-act loop.
- **Toolformer**: Schick et al., *Toolformer: Language Models Can Teach Themselves to Use Tools*, 2023, arXiv:2302.04761, https://arxiv.org/abs/2302.04761. The deck uses its idea of deciding when to call a tool, with what inputs, and how to use the result.
- **No external statistics are used.** The pain points are labelled hypotheses.

## Product
- **Name:** Resolv (a working name; please confirm)
- **Tagline:** The AI teammate that finishes the support case, not just the conversation.
- **Domain focus:** customer service for small and mid-size D2C e-commerce brands. The first workflow is damaged or missing items: replacement, refund and follow-up.
- **Users:** support agents and customers. **Buyer:** the head of support or operations, or the founder.
- **Permitted actions (MVP, all against mocked APIs):**
  - look up an order
  - create a replacement
  - start a refund within a limit
  - update the ticket
  - schedule a follow-up
  - notify the customer
- **Unique selling points (USP):**
  - completes the action instead of only answering
  - grounded in order, case and policy data
  - every action is verified and logged
  - human approval and escalation are built in

## Team
- Team name, team ID and member names: **not found in the repo**. The deck uses placeholders: [Team Name], [Team ID], [Member 1–6].

## Evidence still needed
- Baseline and pilot measurements for the KPIs on slide 5. None exist yet.
