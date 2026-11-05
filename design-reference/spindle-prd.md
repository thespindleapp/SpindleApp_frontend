# Spindle — Product Requirements Document

**Version** v0.1 · draft for senior engineer review
**Last updated** May 14, 2026
**Author** [founder]
**Status** Pre-build · seeking engineering lead

---

## 1. One-page summary

**What.** Spindle is a Gmail and Outlook plugin for fashion product teams. It reads the supplier emails the user already gets, builds a structured "style card" for every fashion style under production, and surfaces what's blocking production today.

**Who pays.** Indie and small-to-mid fashion brands, sourcing offices, manufacturers — the ~95% of fashion businesses that are too small for enterprise PLM (Centric, Lectra, Bamboo Rose) but too operationally complex for plain Excel + email.

**Why now.** LLM extraction has become cheap and accurate enough to parse the messy, conversational emails that PLM vendors couldn't handle in 30 years of trying. The thesis: fashion ops doesn't run on PLM systems, it runs on email and Excel — Spindle works *alongside* those rather than against them.

**What we're building first.** A Gmail Chrome extension MVP, backed by a parsing API, that 8 founding customers (already identified) will pay £99/mo to use. Target: live to founding cohort within ~3 months from kickoff.

**Why this PRD exists.** To anchor a hiring or contracting conversation with a senior engineer. The product design is high-fidelity (see Section 8); the engineering architecture is open and the right person should bring opinions.

---

## 2. The problem

### 2.1 What product teams in fashion actually do

A typical merchandiser at an indie or small-to-mid fashion brand spends 60–70% of their week in three places: their email inbox, their tracker spreadsheet, and WhatsApp threads with suppliers. The tracker spreadsheet has roughly 800 rows, 23 columns, dates in eight different formats, and is updated by hand from email content several days after the fact.

The actual current state of every style — what stage of production it's at, what's blocking it, what date it ships, what the lab dip approval said — lives buried in **email threads and PDF attachments**, not in any system of record. PLM systems (Centric, Lectra, Bamboo Rose) attempt to be that system of record. They cost $100,000–$500,000 in year one all-in, take 3–6 months to implement, and require a behavior change that 30 years of PLM history shows fashion ops does not make. Most brands either don't have PLM, or have it and don't use it for daily work.

### 2.2 The specific pains

- **Things fall through cracks.** A senior merchandiser misses a lab dip approval not because they're disorganized, but because the ball was in an email from 23 days ago and nothing in their inbox knew today was the day it became urgent.
- **No memory across emails.** Each email is treated atomically; there's no "this is the 14th message on this style; lab dip is now 8 days overdue."
- **The tracker is always wrong.** It's a snapshot of what someone retyped from email three days ago, in a different format each row.
- **Switching contexts is the job.** Merchandisers scan their inbox 30+ times a day to remind themselves what's happening. There's no surface that pre-digests their pipeline.

### 2.3 Why this hasn't been solved

PLM vendors built databases-of-truth and assumed people would input clean data into them. They don't. The actual data lives in unstructured email. Until LLMs got cheap and good (~late 2023 onwards), reliably parsing those emails was not commercially feasible. It now is.

---

## 3. Users and use cases

### 3.1 Primary persona: the merchandiser

Mid-career fashion product person (5–15 years experience). Works at an indie brand, small-to-mid label, sourcing office, or buying agency. Often has industry-vertical job titles like "merchandiser", "buyer", "sourcing manager", "production manager", or "product developer". Typically owns 50–800 active styles across 3–8 brands or seasons at any time. Native to Excel, comfortable in Gmail or Outlook, occasionally in a PLM tool they tolerate. Has tried — and stopped using — at least one productivity tool that promised to "fix this."

### 3.2 Secondary persona: the founder/owner

Indie brand owner (1–20 employees). Often acts as merchandiser + buyer + finance + everything-else. Pain is similar to above but more acute because they cannot delegate the dropped balls; they ARE the system of record.

### 3.3 Out of scope as users (v1)

- Enterprise brand merchandising teams (50+ users, often already on PLM)
- Pure design teams (designers don't track production)
- Garment retailers without their own product line
- Adjacent verticals: footwear, jewelry, fast-fashion private label

### 3.4 Core use cases

1. **Monday morning triage.** "Show me the 5 things I need to do today, with one-sentence explanations of why each is urgent."
2. **Mid-thread context.** "I'm reading this email from a factory; tell me what style it's about, what's been said before, and what stage of production we're at."
3. **Style deep-dive.** "Senior leadership just asked me 'what's happening with style 6601234?' — give me the answer in 30 seconds."
4. **Pipeline scan.** "Show me every style in production, grouped by stage, sorted by what's slipping." (Phase 2 — see scope.)
5. **Time-aware re-prioritization.** "The email from 23 days ago is now urgent because the related production milestone is in 48 hours. Surface it."

Use case #5 is the wedge — the differentiator vs every static dashboard.

---

## 4. Market and business context

### 4.1 Market size (rough)

- Global fashion brands with 1–500 employees: ~250,000 businesses
- UK + EU subset addressable in year 1: ~25,000 businesses
- Of these, the segment with 50+ active styles and 2+ people in product ops (Spindle's sweet spot): ~12,000 businesses

### 4.2 Competitive landscape

- **Enterprise PLM** (Centric, Lectra, Bamboo Rose, BlueCherry): $100k–500k+ year-one TCO, sells to brands with $50M+ revenue. ~20,000 brands globally use one. Not a competitor at our market segment. Complementary at the top end.
- **Generic project management tools** (Asana, Monday, Notion): not domain-specific; users abandon them within 6 months because they require manual data entry.
- **Email productivity tools** (Streak, Boomerang, SaneBox): productivity layer for email but no fashion domain knowledge. Useful pattern for our extension architecture, not a competitor.
- **Direct competitors:** none identified. Several "AI for fashion" companies but all targeting design or trend forecasting, not operations.

### 4.3 Business model

Per-workspace flat pricing, not per-seat. Four tiers:

| Tier | Price/mo | Style cap | Seats included | Persona |
| --- | --- | --- | --- | --- |
| Studio | £59 | 50 | 1 | Solo / freelance |
| Brand | £149 | 250 | 3 | Indie brand / small team |
| House | £349 | 800 | 8 | Established brand / buying office |
| Atelier | Custom | Unlimited | Unlimited | Enterprise / multi-brand groups |

Founding-customer pricing: £99/mo locked for life, 8 customers max.

Pricing structure derives from analysis of what Centric and Lectra actually charge ($150–300/seat/month + 6-figure implementation). Spindle's per-workspace model is the deliberate differentiator.

---

## 5. Product scope (v1 MVP)

### 5.1 In scope

**Platform.** Gmail Chrome extension. Manifest V3.

**Primary surfaces (must ship):**

- **A. Spindle sidebar inside Gmail.** Right-hand panel, appears alongside an open email. Shows the detected style for that email — compact style card with status, key facts, mini production timeline, recent thread history, action buttons. Tabs allow switching to "Today" view without leaving the panel.
- **B. Today view.** Five ranked priority items with plain-English "why now" explanations. Generated by a re-ranking worker that runs every 6 hours, considers production timelines, thread silence, and detected blockers.
- **C. Inline tags in the email list.** Each email in the user's inbox gets a Spindle-rendered tag showing the detected style number and current production stage. Clicking the tag opens the relevant style.
- **D. Left-nav injection in Gmail.** A "Spindle" section in Gmail's left nav with Today / auto-created style folders. Mirrors how Streak works visually.
- **E. Reading-pane insight strip.** When an email is open, a small banner appears above the email body summarizing context: "14th message on style 6601234; lab dip 8 days overdue; cutting window closes tomorrow."
- **F. Settings & scope picker.** User chooses which senders or Gmail labels Spindle should watch. Can pause Spindle, change scope, or revoke access at any time.
- **G. Daily digest email.** 7am user-local-time. Subject line names the most urgent item. Body lists the 5 Today priorities with deep links back to Gmail.
- **H. Onboarding flow.** Install → sign up → pay → connect Gmail → scope picker → first style card built within 5 minutes.
- **I. Stripe billing.** Single tier at launch (£99/mo founding cohort). Tier switching can be v1.1.

**Universal fallback (must ship):**

- **J. Forward-to-address pathway.** Every workspace gets a private inbox address (e.g. `priya-7x3k@in.spindle.app`). Forwarded mail flows through the same parser. This is the path for Outlook 2016 / Apple Mail / WhatsApp content / IT-restricted brands. About 5–10% of build effort; preserves universal coverage; do not cut.

**Note on multi-user.** Spindle IS a multi-user workspace product, not single-user — this matches the seat-based pricing in §4.3. A workspace has multiple users, each with their own Gmail/Outlook connection; styles and their data belong to the workspace, not to whichever user's inbox an email arrived in. What's deferred to v2 is granular permissions (roles, per-brand restrictions) — v1 can ship with flat visibility (everyone in a workspace sees everything) plus a simple owner/member split for billing access.

### 5.2 Out of scope (deferred to v2+)

- **Outlook add-in** (separate Phase 2 build; design done, ~10–14 weeks engineering)
- **Production board with full filters** (designed; ship after MVP validates)
- **WhatsApp Business API integration** (manual forward suffices for v1)
- **Granular roles/permissions** beyond a simple owner/member split (flat shared visibility within a workspace is v1; see note below)
- **API access / PLM connectors** (Atelier tier feature)
- **Custom fields, custom production stages** (use defaults; customization is v2)
- **SOC 2 / formal security certification** (note privacy practices; defer audit)
- **Native mobile apps**
- **Bulk historical email import** (only forward-going emails in v1)
- **AI-generated reply drafting** (read-only in v1)

---

## 6. Functional requirements

Grouped as user stories. Each numbered for traceability in tickets.

### 6.1 Account & onboarding

- **FR-01.** As a new user, I can install the Spindle Chrome extension from the Chrome Web Store.
- **FR-02.** I can create an account using email + password OR sign in with Google.
- **FR-03.** I can subscribe to a paid plan via Stripe Checkout before any product functionality is unlocked.
- **FR-04.** I am guided through a 4-step onboarding (connect Gmail → pick scope → confirm watch list → "we'll start watching").
- **FR-05.** I can pause Spindle from the extension popup; pausing stops all email reading and digest generation until I resume.
- **FR-06.** I can revoke Gmail access from settings; doing so deletes OAuth tokens and stops processing within 60 seconds.

### 6.2 Gmail integration

- **FR-10.** I can grant Spindle restricted-scope Gmail access (read-only).
- **FR-11.** I choose which senders, domains, or Gmail labels Spindle should watch. Emails outside scope are never read.
- **FR-12.** I can edit my scope at any time from settings.
- **FR-13.** New emails matching my scope are processed by Spindle within 60 seconds of receipt.
- **FR-14.** OAuth tokens auto-refresh without user intervention.

### 6.3 Parsing & style extraction

- **FR-20.** When an email matching my scope arrives, Spindle extracts: style number(s), brand, garment type, current production stage, status (blocked/waiting/on-track/shipped/cancelled), and key facts (fabric, color, cost, delivery date, quantity, factory).
- **FR-21.** PDF and image attachments are parsed for additional context.
- **FR-22.** When the parser is < 70% confident about the style mapping, the email is flagged "needs your eyes" and surfaced in the sidebar for one-tap confirmation.
- **FR-23.** Every user correction trains the model on that user's specific brand vocabulary.
- **FR-24.** Parsing accuracy target: ≥ 85% on a held-out test set of 30 real anonymized supplier emails.

### 6.4 Today view

- **FR-30.** I see the 5 highest-priority items each morning, ranked by a combination of: production timeline urgency, thread silence duration, detected blockers, and value at risk.
- **FR-31.** Each priority item has a one-sentence "why now" explanation in plain English.
- **FR-32.** I can dismiss an item, mark it resolved, or open the underlying style.
- **FR-33.** The Today view re-ranks every 6 hours automatically; I can manually refresh at any time.

### 6.5 Style card

- **FR-40.** Every detected style has a card showing: style number, brand, name, garment type, current stage on a 9-stage timeline, status, fabric, color, cost, delivery date, qty, factory, recent thread history, attachments.
- **FR-41.** The compact card renders in the Gmail sidebar; a full-screen card opens in an overlay panel.
- **FR-42.** I can see all email messages associated with a style, in chronological order.
- **FR-43.** I can manually edit any extracted field; my edits override the parser's value and inform future extractions.

### 6.6 Email list & reading pane integration

- **FR-50.** Every email matching my scope shows an inline tag in the Gmail list view with detected style number and current stage.
- **FR-51.** When I open such an email, a Spindle insight strip appears above the email body with context: thread depth, current production stage, days since last action, and blocker if any.
- **FR-52.** Extracted entities (style numbers, dates, costs) in the email body are highlighted.
- **FR-53.** Clicking any highlighted entity opens the relevant view.

### 6.7 Forward-to-address fallback

- **FR-60.** Each user gets a private forwarding address on signup.
- **FR-61.** Email forwarded to that address is processed by the same parser within 60 seconds.
- **FR-62.** Forwarded-mail style cards appear in the same UI as Gmail-extension-mail style cards; the source is shown as "forwarded" for transparency but otherwise treated identically.

### 6.8 Daily digest

- **FR-70.** At 7am user-local-time each day, Spindle sends a digest email summarizing the 5 Today priorities.
- **FR-71.** The digest subject line names the most urgent item.
- **FR-72.** Each digest item links to the relevant style in Gmail.
- **FR-73.** I can pause or unsubscribe from the digest while keeping the rest of Spindle running.

### 6.9 Billing

- **FR-80.** I subscribe to a single founding-cohort tier via Stripe Checkout at signup.
- **FR-81.** I can manage my subscription via Stripe Customer Portal.
- **FR-82.** When my subscription lapses, Spindle pauses (does not delete) my data and shows a re-activation prompt in the extension.

---

## 7. Non-functional requirements

### 7.1 Performance budgets

- **Parser latency:** ≤ 8 seconds from email receipt to style card update, p95.
- **Extension UI:** Spindle sidebar renders ≤ 100ms after an email opens.
- **API:** p95 ≤ 200ms for `/today` and `/styles` endpoints.
- **Extension cold start:** ≤ 500ms from page load to UI injection complete.

### 7.2 Reliability

- **Uptime target:** 99.5% for the backend (allows ~3.5 hours of monthly downtime — reasonable for an early-stage product).
- **Graceful degradation:** if Gmail's DOM structure changes unexpectedly, the extension shows a "Spindle is checking" banner rather than silently failing.
- **Email loss prevention:** every email entering the system goes onto a durable queue before any processing; idempotent retries on transient failures.

### 7.3 Security & privacy

- **OAuth tokens encrypted at rest.**
- **Scope respect:** the parser only reads emails matching the user's declared scope. Emails outside scope are filtered at the worker level before any LLM call.
- **Body retention:** raw email body content kept for 90 days, then truncated to a redacted summary. Original mail is the user's, not Spindle's.
- **No outbound mail:** Spindle never sends email on behalf of the user beyond the daily digest TO the user themselves.
- **One-click revoke:** revoking Gmail access in Spindle settings deletes OAuth tokens within 60 seconds; backfilled deletion of body content within 24 hours.
- **GDPR compliant** by design — UK & EU customers in the founding cohort.

### 7.4 Privacy posture (commercially important)

This is the question every prospect will ask first: "Does Spindle read my whole inbox?"

The answer: **no — only the senders or labels you designate.** This needs to be true at the architectural level, not just at the policy level. The parser must reject emails outside scope before passing them to Claude. The UX must make scope visible and editable. Anything ambiguous on this point is a deal-killer for prospect conversations.

### 7.5 Compliance milestones

- **Google OAuth verification.** Required for restricted scopes. Process takes 4–8 weeks and includes a privacy policy, demo video, and security questionnaire. Must start in week 1 of engagement.
- **Chrome Web Store review.** 1–3 weeks typical. Must submit by end of week 8.
- **GDPR documentation.** Privacy notice, data processing record, sub-processor list. Founder-prepared with engineering input on technical accuracy.

### 7.6 Scale assumptions for v1

- 8 founding customers in month 3
- Growing to ~50 paying customers by month 12
- ~500 emails/user/day average → ~25,000 emails/day at month 12
- ~5,000 active style cards at month 12

These are well within single-region single-database scale. No premature horizontal scaling work required.

---

## 8. Reference designs

A full set of high-fidelity HTML mockups exists for every primary surface. The senior engineer should read these before the call — they're the visual source of truth and answer many implementation-detail questions implicitly.

| File | What it shows |
| --- | --- |
| `spindle-landing.html` | Marketing site. Product positioning, pricing, copy voice. |
| `spindle-gmail-extension.html` | **Primary reference.** Gmail with Spindle extension active: left-nav injection, inline tags, insight strip, sidebar style card. |
| `spindle-gmail-board.html` | Production board view inside Gmail (Phase 2 — designed but not in v1 MVP). |
| `spindle-style-card.html` | Full style card detail (overlay form). |
| `spindle-today.html` | The Today priorities view. |
| `spindle-board.html` | Standalone production board with filters (Phase 2). |
| `spindle-outlook.html` | Outlook add-in design (Phase 2). |
| `spindle-validation-kit.md` | Founder's customer-research playbook (gives user-research context). |

All mockups use anonymized real data from a 864-row factory production tracker. Style numbers, brand names, people names are anonymized but the data shape is real.

**Design system tokens:** paper #F4EFE5, ink #14110C, ochre accent #B07527. Typography: Instrument Serif italic for editorial moments, Geist for UI, JetBrains Mono for IDs and data. These are commercially meaningful — fashion ops people respond to design quality in a way generic SaaS users don't.

---

## 9. Technical considerations (for engineer discussion)

The areas where I want the engineer's expertise and opinion. These are NOT pre-decided.

### 9.1 Extension framework

Manifest V3 imposes hard constraints on what content scripts can do. Choices to evaluate:

- Vanilla TS vs Preact vs React for the sidebar UI
- Shadow DOM strategy for style isolation from Gmail's CSS
- Content script vs service worker boundary — what runs where
- DOM-injection patterns that survive Gmail's frequent UI changes

I have a strong intuition that **Preact in Shadow DOM** is the right call. Open to better arguments.

### 9.2 Backend stack

I am not opinionated about:

- Node.js vs Python vs Go for the parsing service. Whatever the engineer is fastest in.
- Postgres vs other databases. Postgres seems obviously right, but happy to discuss.
- Hosting (Railway, Fly, Render, AWS, self-hosted). Cost minimization matters; reliability matters more.
- Queue technology (BullMQ, Inngest, AWS SQS, etc.) for the email processing pipeline.

### 9.3 Gmail integration architecture

Three patterns to evaluate, each with trade-offs:

1. **Gmail API + push notifications.** Cleanest. Requires Pub/Sub setup. Subject to Google's verification process.
2. **Gmail API + polling.** Simpler to build. Worse latency. Easier to debug.
3. **Extension-side message extraction.** Read emails client-side in the content script, forward parsed content to API. Avoids OAuth verification BUT we lose the ability to process mail when the user isn't actively in Gmail.

I lean toward **#1 for production, #2 for development**. Engineer should weigh in.

### 9.4 LLM parsing strategy

- **Single Claude API call per email** is the obvious starting point.
- **Cost estimate at 500 emails/user/day × 50 users × £0.003/call ≈ £75/day** at month 12. Acceptable.
- Open questions: function calling vs JSON mode; chunking long emails; how to handle attachments (separate calls or inline?); embeddings for similarity-based style resolution.

### 9.5 The parser is the moat

The single most important investment area. Engineer should plan for:

- 1 week of dedicated prompt engineering on real data BEFORE writing parser code
- Versioned prompts in source control with A/B comparison harness
- Capture every user correction as fine-tuning data for future model swap

I have 15 years of fashion vocabulary that should inform the system prompt. I plan to own the prompt content; engineer owns the parser plumbing.

### 9.6 Privacy architecture

The scope-filtering logic has to be airtight. Suggested architecture:

- Filter happens in a worker BEFORE any LLM call
- Filter logic is unit-tested against synthetic emails covering edge cases (subdomain matches, label hierarchies, etc.)
- Audit log records every email that was filtered OUT and why, for accountability

Engineer should review this approach.

### 9.7 Known hard problems

In rough order of difficulty:

1. **Gmail DOM stability.** Gmail's HTML structure changes regularly. Streak has a full-time engineer maintaining selector compatibility. We need a sustainable pattern; expect ongoing maintenance cost.
2. **Parser accuracy on edge cases.** "The khaki one" — style number not present in the email. Solvable with thread context but requires careful prompt design.
3. **Multi-style emails.** A single email may reference 3 styles. Spindle has to fan out cleanly to all of them without double-counting.
4. **Style number ambiguity.** A 7-digit number in an email may or may not be a style number. Disambiguation logic needs to be defensive.
5. **Time zone correctness.** Daily digest at 7am user-local matters for adoption. User can be in any TZ.

---

## 10. Success metrics

### 10.1 Pre-launch (within the 12-week build)

- Parser accuracy ≥ 85% on held-out test set of 30 real anonymized emails (style number, brand, garment, stage, status)
- Extension passes Chrome Web Store review
- Google OAuth verification granted
- All 10 acceptance criteria in Section 5.1 demonstrably working in QA

### 10.2 First 90 days post-launch

- 8 founding customers signed up and paying
- Daily digest open rate ≥ 60%
- Today-view engagement ≥ 4 days/week per user
- ≥ 4 customers willing to be publicly quoted
- < 1 unhandled error per user per day

### 10.3 Year 1 ambition

- 50 paying customers
- £6–10k MRR
- Outlook add-in shipped
- Production board UI shipped

If these numbers are met, we have product-market fit and the next decision is funding-versus-bootstrap. If they're not met, the assumptions in this PRD were wrong somewhere — and we use the customer-research playbook (`spindle-validation-kit.md`) to figure out which assumption broke.

---

## 11. Timeline and milestones

These are illustrative, not contractual. Senior engineer should re-baseline.

| Week | Milestone |
| --- | --- |
| 0 | Engineer onboarding, repo setup, infra provisioning |
| 1 | Google OAuth verification application submitted; privacy policy drafted |
| 1–3 | Backend skeleton + auth + Stripe billing live in staging |
| 3–4 | Parser v1 tuned against 30-email test set, ≥ 80% accuracy achieved |
| 4–6 | Gmail OAuth flow + email ingestion + parser pipeline working end-to-end |
| 6–8 | Extension scaffold + content scripts + sidebar style card |
| 8–10 | Reading pane insight strip + email list tags + Today view |
| 10–11 | Settings, scope picker, daily digest, polish |
| 11–12 | Chrome Web Store submission, QA pass, beta with founder |
| 13–14 | Launch to 8 founding customers, monitor, iterate |

**Critical path items the engineer should weigh:**
- Google OAuth verification has a 4–8 week lead time and must start in week 1.
- Chrome Web Store review can take 1–3 weeks.
- Parser tuning requires the founder's anonymized real-email test set, available by week 2.

---

## 12. Constraints

### 12.1 Founder is non-technical

- 15 years of fashion industry experience; can speak confidently about user pain, market, vocabulary, design.
- Cannot read code, debug, or evaluate technical trade-offs alone.
- Will own: product decisions, prompt content, founding-customer relationships, marketing, sales.
- Needs from engineer: technical decisions explained in plain English; honest flagging of risks; pragmatic scope management.

### 12.2 Budget

To be discussed on the call. Bootstrap-funded by founder; potential founding-customer revenue once live (~£800/mo at 8 customers). Compensation model open: contractor, fractional CTO, equity-bearing co-founder, or hire.

### 12.3 Operational

- Founder is solo and will not hire additional engineers in v1.
- Designer not required: all v1 design assets exist as detailed HTML mockups.
- Support is founder-owned; no support team in v1.

### 12.4 Geographic

- Founder is UK-based.
- Founding customers expected primarily UK + EU.
- Backend hosting in EU region preferable for GDPR.

---

## 13. Open questions for the engineering call

The questions I most want the senior engineer's view on:

1. **Is 10–14 weeks realistic** for this scope, with the architecture described? What would push it longer? What could shorten it?

2. **DOM-injection sustainability.** Gmail changes frequently. What patterns make the extension robust to those changes without a full-time maintainer?

3. **Single-engineer feasibility.** Is this a one-person job for the v1 timeline, or does it need a co-engineer for the extension while another owns the backend?

4. **OAuth verification risk.** What can we do in weeks 1–2 to maximize the chance Google approves us quickly? What's the fallback if they delay or reject?

5. **Cost ceiling.** At 50 paying customers, what's the realistic monthly infrastructure + LLM cost? Where are the levers if it gets uncomfortable?

6. **Phase 2 architecture readiness.** What architectural decisions in v1 most affect the difficulty of building the Outlook add-in in Phase 2? We want to share the backend; the extension layer is the only thing that should differ.

7. **Engagement model.** Contract, equity, hire, fractional CTO? What's the structure that gets the best engineer for the work to be done?

---

## 14. Glossary

Fashion ops vocabulary the engineer will see in user emails, mockups, and parser prompts:

- **PLM.** Product Lifecycle Management. Enterprise software category (Centric, Lectra, etc.).
- **Tech pack.** A detailed specification document for a garment — measurements, materials, construction notes. Sent from brand to factory.
- **Lab dip.** A small fabric sample dyed to a specific color, sent from factory to brand for approval before bulk dyeing.
- **Strike-off.** A test print sample of a fabric pattern, sent for approval before bulk printing.
- **Fit sample.** A garment sewn in the target fabric, sent for fitting and adjustment.
- **PP sample.** Pre-production sample. Final sample sewn after all approvals; the green-light for bulk production.
- **TOP sample.** Top-of-production sample. First garment off the bulk line, sent for QA.
- **FOB.** Free On Board. The factory's price for the garment, excluding shipping.
- **BL.** Bill of Lading. The shipping document; "BL issued" means goods have left the factory.
- **CMT.** Cut Make Trim. A factory model where the brand supplies fabric and the factory does only assembly.
- **GSM.** Grams per Square Meter. Fabric weight.
- **AW25 / SS25.** Autumn-Winter 2025 / Spring-Summer 2025. Fashion seasons.

The 9-stage production timeline that Spindle infers and tracks: TP → CT → LD → SO → FS → PP → TOP → BK → SH (Ship).

---

## 15. Appendix: parser system prompt skeleton

For technical reference. This will be iterated on real data during the build.

```
You are Spindle's fashion-ops parser. You read one supplier email and
extract structured facts about the fashion style(s) it references.

DOMAIN VOCABULARY:
[Stage abbreviations, fabric terms, common shorthand…]

YOUR JOB:
1. Identify the style number(s). If ambiguous, flag for human review.
2. Detect the current production stage.
3. Extract facts: fabric, color, cost, delivery date, qty, factory.
4. Determine status: blocked, waiting, on_track, shipped, cancelled.
5. Write a one-sentence "why this matters" if state changed.

OUTPUT JSON:
{
  "style_references": [...],
  "stage_detected": "ld",
  "stage_confidence": 0.88,
  "status_inferred": "blocked",
  "status_reason": "Lab dip pending 8 days; cutting window closes tomorrow.",
  "facts": {...},
  "flagged_for_review": false
}
```

---

**End of PRD.**

Ready to discuss on the call. If the engineer wants to dive deeper before then, the most useful 30 minutes of prep is reading `spindle-gmail-extension.html` and `spindle-style-card.html` — they'll answer 80% of "how should the UI behave" questions implicitly.
