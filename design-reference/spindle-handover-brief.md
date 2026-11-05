# Spindle — Developer Handover Brief

**This is the entry document.** Read this first. It tells you what Spindle is, what to build, in what order, and which of the other documents to read for detail. Everything you need to scope, price, and build the product is in this folder.

**Last updated** May 2026 · **Prepared by** [founder] · **For** the engineer(s) building Spindle

---

## 0. Read this in 60 seconds

Spindle is an **email plugin for fashion product teams** that works inside both **Gmail and Outlook**. It reads the supplier emails a merchandiser already receives, uses an LLM to extract structured data about each fashion style in production, and surfaces what's blocking production today — without anyone entering data manually.

The product is **one backend serving multiple clients**:
- A **Gmail extension** (Chrome, Manifest V3)
- An **Outlook add-in** (Office.js, works on Outlook 2016 onward)
- A **forward-to-address fallback** (universal — any email client)
- A **web app** (for settings, full style cards, and the production board)

All four talk to the same API and the same parser. **The parser is the moat.** The clients are interchangeable surfaces over one brain.

Your job: build that backend and at least the Gmail client to a standard 8 founding customers will pay £99/month for, then the Outlook client. The design is done. The product decisions are made. This brief and the documents it points to contain everything.

---

## 1. The documents in this folder, and what each is for

Read them in this order:

| Order | Document | What it gives you | Read when |
| --- | --- | --- | --- |
| 1 | **`spindle-handover-brief.md`** (this file) | The map. Scope, architecture, milestones, how to use everything else. | Now, fully |
| 2 | **`spindle-prd.md`** | The product requirements. Problem, users, functional requirements (FR-01…FR-82), non-functional requirements, success metrics, glossary of fashion terms. | Before estimating |
| 3 | **`spindle-screens.html`** | Six core app screens: extension popup, 3-step onboarding, settings, daily digest email. Open in a browser. | Before building any UI |
| 4 | **`spindle-screen-gmail-email.html`** | The Gmail extension — email reading view with Spindle sidebar, inline tags, insight strip. **Primary visual reference for the Gmail client.** | Building Gmail client |
| 5 | **`spindle-screen-gmail-board.html`** | The Gmail extension — production board view inside Gmail. | Building Gmail client |
| 6 | **`spindle-parser-loop.html`** | **The two-sided parser UI** — the "needs your eyes" confirmation queue and the three confidence tiers. Open it and click the buttons. The interaction spec for §7a, the most important architectural section. | Before building the parser/UI |
| 7 | **`spindle-style-card.html`** | The full style card — every field, the timeline, the flat sketch, the conversation digest. | Building style card |
| 8 | **`spindle-today.html`** | The "Today" view — 5 ranked priorities with "why now" sentences. | Building Today view |
| 9 | **`spindle-board.html`** | The standalone production board with a **fully working filter system** (saved views, stage rail, facets, search — real JS). Use as the spec for filter behaviour. | Building the board |
| 10 | **`spindle-outlook.html`** | The Outlook add-in design — task pane, ribbon button, deployment notes. **Primary visual reference for the Outlook client.** | Building Outlook client |
| 11 | **`spindle-parser-test-kit.md`** + **`spindle-parser-scorecard.xlsx`** | The founder's parser accuracy test and its filled-in results. Tells you real per-field accuracy and confidence calibration — which sets the per-field silent-filing thresholds in §7a. | Before building the parser |
| 12 | **`spindle-landing.html`** | The marketing site. Tells you the product's voice, positioning, and pricing. Useful for understanding *why* before *what*. | For context |
| 13 | **`spindle-claude-code-prompt.md`** | An opinionated, stack-specific build plan (originally written for an AI coding agent). Contains a suggested data model, parser prompt skeleton, and phase breakdown. **Treat as a strong starting proposal, not gospel** — bring your own opinions. | While architecting |
| 14 | **`spindle-validation-kit.md`** | Founder's customer-research playbook. Tells you who the user is and how the 8 founding customers were found. Background only. | Optional context |

**The relationship between docs 2 and 13:** The PRD (`spindle-prd.md`) defines *what* must be true, framed for an engineer to bring their own architecture. The Claude Code prompt (`spindle-claude-code-prompt.md`) is a *more prescriptive* take with specific stack choices, a proposed schema, and a parser prompt. If you're an experienced engineer, lead with the PRD and mine the Claude Code doc for the data model and parser detail. If you want a faster start with decisions pre-made, the Claude Code doc is closer to "just build this." Either way, §7a of this brief (the two-sided parser) overrides the simpler "one LLM call, ≥85% accuracy" framing in the older docs — that's the current design.

---

## 2. What Spindle does (the product, concretely)

A merchandiser at a fashion brand manages 50–800 active styles across several brands and seasons. The truth about each style — what stage of production it's at, what's blocking it, when it ships — lives in unstructured supplier emails and their PDF/image attachments, not in any system. Spindle reads those emails and turns them into structured, live style cards.

**The core loop:**
1. A supplier emails the merchandiser (cost sheet, lab dip photo, fit comments, shipping update).
2. Spindle reads it — via the Gmail extension, the Outlook add-in, or the forward address.
3. The parser (an LLM) extracts, with a confidence score per field: which style, what production stage, status, fabric, cost, delivery date, factory, and a one-line "why this matters."
4. **What it's confident about, it files silently. What it's unsure about, it routes to the user for a one-tap confirmation** (the two-sided parser — see §7a, the most important section in this brief). Confirmed/corrected items update the style card; urgent ones hit the "Today" priorities.
5. The merchandiser sees it — inline in their inbox, in the Today view, in the "needs your eyes" confirmation queue, or in the 7am digest email.

**The three things the product must nail:**
- **A trustworthy parser**, which means a near-zero *confidently-wrong* rate, not a single headline accuracy number. The parser is honest about what it's unsure of (see §7a). This is the moat. (PRD §6.3, FR-20…FR-24.)
- **Near-zero data entry.** The user confirms the occasional uncertain item with one tap; they never type data in. If they're typing, the product has failed.
- **It works where they already are.** Gmail and Outlook, not a separate app they have to remember to open.

For the complete functional spec, read `spindle-prd.md` §6.

---

## 3. Architecture: one backend, many clients

This is the single most important architectural principle. Build it this way and Gmail, Outlook, the forward fallback, and the web app all share one brain. Build it any other way and you'll rewrite the parser three times.

```
   GMAIL              OUTLOOK            FORWARD-TO         WEB APP
   extension          add-in             ADDRESS            (settings,
   (Chrome MV3)       (Office.js)        (any client)        full cards,
       │                  │                  │               board)
       │                  │                  │                  │
       └──────────────────┴─────────┬────────┴──────────────────┘
                                     │
                              ┌──────▼───────┐
                              │  SPINDLE API │   ← one REST API
                              └──────┬───────┘
                                     │
                          ┌──────────▼───────────┐
                          │   THE PARSER (LLM)    │   ← the moat
                          │   + style resolution  │
                          │   + priority ranking  │
                          └──────────┬───────────┘
                                     │
                    ┌────────────────┼─────────────────┐
                    ▼                ▼                  ▼
                Database         Queue/jobs         Attachment
               (Postgres)     (email parsing,        storage
                              digest sending,
                              re-ranking)
```

**What's shared across all clients (build once):**
- The parser and its prompts
- Style resolution (mapping an email to the right style, or creating a new one)
- Priority ranking (what goes in "Today")
- The data model (styles, emails, attachments, priorities)
- Billing, auth, settings
- The digest email generator

**What's client-specific (build per platform):**
- **Gmail:** content scripts that inject the sidebar, inline tags, insight strip into Gmail's DOM (Shadow DOM for isolation). Gmail API + OAuth for reading mail server-side.
- **Outlook:** an Office.js task-pane add-in. A manifest. The task pane renders the same data the Gmail sidebar shows, but in Outlook's narrower sandboxed pane. Read mail via Microsoft Graph API.
- **Forward fallback:** an inbound mail handler (e.g. via a service like Postmark or SES) that pipes forwarded mail into the same parser.

The clients are thin. They render data the API gives them and capture the emails the API needs. All intelligence is server-side. A good test: if you can add a third client (say, Apple Mail) later without touching the parser, the architecture is right.

For the suggested data model and parser detail, see `spindle-claude-code-prompt.md` §6 and §7.

---

## 4. Build both Gmail and Outlook — but in this order

The founder wants both Gmail and Outlook. Here's the sequencing that gets there with least risk. **Do not build them in parallel.** Build the backend + Gmail first, prove it with real customers, then add Outlook as a second client to the proven backend.

### Phase A — Backend + Gmail (the foundation)
Everything server-side, plus the Gmail extension and the forward-to-address fallback. This is the biggest phase because you're building the brain here, not just a client. By the end of Phase A, founding customers on Gmail are live and paying.

### Phase B — Outlook add-in (the second client)
Once the backend is proven, the Outlook add-in is "just" a new client over the same API. The task pane renders the same data. The new work is Office.js, the manifest, Microsoft Graph API for mail access, and the AppSource submission. Significantly smaller than Phase A because the backend already exists.

### Why this order and not parallel
- The parser has to be validated against real emails before it's worth building two clients on top of it.
- Gmail's extension model is faster to ship and iterate than Outlook's add-in review cycle.
- Building Outlook second means you build it over a backend that already works, so the Outlook client stays genuinely thin.
- If something about the core premise is wrong, you find out after Phase A, having built one client, not two.

**Important nuance on Outlook versions.** Most fashion brands and manufacturers run older Outlook (2016/2019/2021), not the newest subscription version. The Office.js web add-in model works across all of these from 2016 forward — that's exactly why it's the right choice over any newer Outlook-only API. For the brands whose IT won't approve any add-in at all, the forward-to-address fallback (built in Phase A) already covers them. No customer is ever blocked. See `spindle-outlook.html` notes section for the deployment paths (AppSource, M365 admin push, sideload, forward fallback).

---

## 5. Scope — what's in, what's explicitly out

**Multi-user note (build this in from day one — it's a schema decision, not a feature):** Spindle is a multi-user workspace product — this matches the seat-based pricing (Studio 1 seat, Brand 3, House 8). A workspace is the billing and style-ownership unit. Each user has their own individual Gmail/Outlook OAuth connection (logins can't be shared), but style cards and their data belong to the *workspace*, not to whichever user's inbox an email happened to land in — that's what makes "the second brain for the team" true rather than just "a smarter inbox for one person." Keep v1 permissions minimal: flat shared visibility (everyone in a workspace sees everything) plus a simple owner (billing) / member split. Don't build granular roles or per-brand restrictions yet — that's genuinely deferrable. The workspace *shape* is not.

### In scope (v1, across Phases A and B)
- Gmail extension: sidebar style card, Today view, **"needs your eyes" confirmation queue**, inline email tags, reading-pane insight strip, left-nav injection, scope picker, settings
- Outlook add-in: task pane with the same views (This style / Today / **Confirm** / Board / Search tabs), ribbon button, manifest, deployment
- Forward-to-address fallback for both platforms
- The two-sided parser: confidence-scored extraction (style, stage, status, facts, "why now"), per-field silent-filing thresholds, the confirmation queue, and the per-workspace correction/learning loop (see §7a)
- PDF and image attachment parsing
- Daily digest email (7am user-local)
- Web app: settings, full style card, production board with filters
- Stripe billing (single founding-cohort tier, £99/mo)
- Scope-based privacy (only read designated senders/labels)

### Explicitly OUT of scope for v1
Do not build these without an explicit decision from the founder. They are how this project balloons from 3 months to 12.
- WhatsApp Business API integration (manual forward of WhatsApp content is fine for v1)
- Granular roles/permissions beyond owner/member (flat shared visibility within a workspace is v1 — see note below)
- Native mobile apps
- API access for customers / third-party PLM connectors
- Custom fields and custom production stages (use the default 9-stage model)
- AI-drafted replies (the product is read-only in v1)
- SOC 2 certification (note privacy practices; defer the formal audit)
- Bulk historical email import (only forward-going emails in v1)

Full scope detail: `spindle-prd.md` §5.

---

## 6. The 9-stage production model (you'll see this everywhere)

Every style moves through these stages. The parser infers which stage a style is at from email content. The timeline UI shows it. Learn these — they're the backbone of the data model.

`TP → CT → LD → SO → FS → PP → TOP → BK → SH`

Tech Pack → Costing → Lab Dip → Strike-off → Fit Sample → PP Sample → Top-of-Production → Bulk → Ship.

Each can be the point where a style is "blocked" or "waiting." The glossary in `spindle-prd.md` §14 explains every term. The visual treatment is in `spindle-style-card.html` and `spindle-board.html`.

---

## 7. The parser is the moat — treat it accordingly

If you take one thing from this brief: **spend disproportionate effort on the parser.** Everything else is conventional CRUD-and-clients engineering. The parser is the part that's hard to copy and the part that determines whether the product works at all.

- One LLM call per email (suggested model and prompt skeleton in `spindle-claude-code-prompt.md` §7), but structured as a confidence-scored pipeline, not a single fire-and-forget call — see §7a below.
- The founder will provide ~30 real anonymized supplier emails as a test set. **Get these before building the parser.** They are the difference between a parser that works and one that guesses. The founder is running an accuracy test on these emails using the parser test kit (`spindle-parser-test-kit.md` + `spindle-parser-scorecard.xlsx`) — ask for the filled-in scorecard; it tells you the real per-field accuracy and confidence calibration before you write a line of parser code.
- The founder has 15 years of fashion vocabulary and will own the prompt *content*. You own the parser *plumbing* (calls, retries, JSON validation, versioning, confidence handling, and the resolution logic that maps output to styles).
- Version the prompts in source control. Capture every user correction as future tuning data — this is not optional; it's the mechanism that makes the parser improve per customer (see §7a).

The "both sides of the email" point matters technically: the founder has lived both the supplier side (family manufacturing business, 40 years) and the brand side (15 years buying). The parser needs to understand fashion vocabulary as *both* a Tirupur sampling manager and a London merchandiser would write it. That bilingual fluency is what gets the parser from 65% (generic) to 92% (domain-tuned). Lean on the founder for this.

---

## 7a. The two-sided parser — THE core design principle

**Read this section twice. It shapes the parser, the data model, the API, and the UI. Getting it wrong produces a product nobody trusts; getting it right makes an 80%-accurate model feel like magic.**

Spindle's parser is **not** a system that silently extracts data and hopes it's right. It is a **human-in-the-loop pipeline**: the model handles what it's confident about, and routes what it's unsure about to the user as fast, one-tap confirmations. The user is the second half of the parser, by design.

### Why this is non-negotiable

A silent parser has an impossible bar. It must be right ~95%+ of the time or merchandisers stop trusting it — and crucially, because they can't tell *which* answers are wrong, one silent error makes them doubt *every* answer. A two-sided parser flips this: it only has to be right about what it's *confident* about, and *honest* about the rest. An 80%-accurate model becomes a trustworthy product, because the ~20% it's unsure about surfaces as "can you confirm?" rather than landing silently wrong.

The thing that destroys trust is not being wrong. It is being **confidently, silently wrong.** The entire design goal of the parser is to drive the *confidently-wrong rate* as close to zero as possible, and let an honest "needs your eyes" tier absorb everything uncertain.

### The three confidence tiers

Every extraction the parser produces carries a confidence score, and falls into one of three tiers:

| Tier | ~Share | Behaviour | Example |
| --- | --- | --- | --- |
| **Confident** | ~80% | File silently. User never sees it unless they look. | "Lab dip approved on 6601234" — style number present, language clear. |
| **Unsure** | ~15% | File a best guess BUT flag for one-tap confirmation. | "The khaki jacket fabric query" — probably 6601234, but no number in the email. Ask. |
| **Lost** | ~5% | Don't guess. Show the likely candidates and let the user pick. | "The blue one is coming out too green" — forwarded from WhatsApp, no number, ambiguous. Offer the 3 blue styles in production. |

The UI for this is designed and built as a reference mockup: **`spindle-parser-loop.html`** — open it, click the buttons, see exactly how confirmation and correction behave. The "needs your eyes" queue is a first-class product surface, not an error state.

### Thresholds are per-field, set by cost-of-error — NOT one global number

This is the subtle, important part. There is **no single confidence threshold** for silent filing. The bar is set per field by *how expensive it is to be wrong about that field*:

- **Style assignment** — high cost of error (wrong assignment corrupts two style cards and erodes trust fast). Silent only above a HIGH bar (~0.85). Below that, ask.
- **Production stage** — low cost (off-by-one on a timeline, visible and self-correcting as more email arrives). Silent at a LOWER bar (~0.70).
- **Status** (blocked/waiting/on-track) — medium (drives the Today view). ~0.75.
- **Cheap facts** (fabric, colour, qty) — low cost, easily corrected in context. Relaxed bar (~0.65).
- **Money/time facts** (cost, delivery date) — these drive real decisions. Higher bar (~0.80).

These starting numbers are guesses. **The founder's parser test (the filled-in scorecard) is what calibrates them**: for each field, it reveals the confidence level above which the model is reliably correct on real emails. Set each silent-filing threshold at that level. Don't hard-code a global 80% or, worse, a "safe-sounding" 99% — a 99% bar would route the majority of real emails into the confirmation queue and recreate the manual data entry the product exists to eliminate. The goal is the *lowest* per-field threshold at which the model is reliably right, so the silent tier stays large while the confidently-wrong rate stays near zero.

**Make thresholds configurable per workspace**, not compiled in. A brand whose suppliers always include style numbers can run lower bars safely; a brand whose suppliers write "the khaki one" needs higher bars and will see more questions early — until learning kicks in.

### The correction loop is the moat compounding

Every time a user confirms or corrects a flagged item, that becomes training signal for *that workspace's* vocabulary: "the khaki jacket" → 6601234; Arjun's "the blue one" → the Cobalt dress; Vikram's gsm emails → fabric substitutions. The share of emails needing confirmation should fall steeply over a customer's first weeks (illustratively ~32% in week 1 to ~4% by week 8). This is what turns the human-in-the-loop from a tax into an asset — and it's a moat: a competitor starting fresh with a new customer is back at the high question rate, while Spindle is near-silent for a customer who's been correcting it for two months.

Mechanically: persist every flagged item, the model's guess, the user's answer, and the source email features. Feed confirmed mappings back as retrieval context (or few-shot examples, or a per-workspace alias table) on subsequent parses. You do not need fine-tuning for v1 — a per-workspace store of confirmed aliases and corrections, injected into the prompt as context, gets most of the benefit. Design the data model so this is captured from day one even if the feedback mechanism is simple at first.

### What this means concretely for your build

- **Data model:** every extracted field carries a confidence score and a state (`confident` / `unsure` / `lost` / `user_confirmed` / `user_corrected`). Style assignment is a first-class entity with its own confidence, separate from the facts. Persist the model's original guess even after a user corrects it (you need both for the learning loop and for measuring confidently-wrong rate).
- **API:** expose a "needs your eyes" queue endpoint (the unsure + lost items) and a confirmation/correction endpoint. The confirmation endpoint must be cheap and idempotent — users will hit it many times a day.
- **UI:** the confirmation queue is a first-class surface in every client (Gmail sidebar, Outlook task pane, web app), built to the interaction shown in `spindle-parser-loop.html`. Correcting must be exactly as fast as confirming — one tap — or users won't do it, and the learning loop dies.
- **Metrics:** track three numbers continuously: silent-and-correct rate, correctly-flagged rate, and **confidently-wrong rate**. The last one is the one that matters most; it should trend toward zero. The founder's scorecard measures these at the cold-start baseline; production telemetry should measure them live.

### What "done" means for the parser, restated

Not "≥85% silent accuracy." The real bar is: **the confidently-wrong rate is low enough that users trust silent answers, the confirmation queue is small enough that clearing it takes under two minutes a day, and the queue shrinks measurably over a customer's first month as the correction loop learns their vocabulary.** A parser that is 78% confident-and-correct, 18% honestly-flagged, and 4% confidently-wrong is a better product than one that is 88% correct with the other 12% silently wrong. Build for honesty and the learning curve, not for a single accuracy headline.

---

## 8. Non-negotiables

These are the things that, if you get them wrong, break trust or break the product. From `spindle-prd.md` §7.

**Privacy (this is a sales dealbreaker, not just a nicety):**
- Only read emails matching the user's chosen scope (specific senders, domains, or labels). Filter *before* any LLM call. Never read mail outside scope.
- Never read the user's own sent replies.
- Encrypt OAuth tokens at rest.
- One-click revoke deletes tokens within 60 seconds.
- The first question every prospect asks is "does this read my whole inbox?" The honest answer must be "no, only what you choose" — and that must be true at the architecture level.

**Extension robustness:**
- All injected UI in Shadow DOM (Gmail) / the sandboxed task pane (Outlook).
- Gmail's DOM changes frequently — build a resilient MutationObserver pattern that degrades gracefully (show a "Spindle is reconnecting" state, never a broken inbox).

**Performance budgets:**
- Parser: ≤ 8 seconds from email arrival to updated style card.
- Sidebar/task pane renders ≤ 100ms after an email opens.

**Compliance lead times (start these on day one — they're not engineering but they block launch):**
- Google OAuth verification for restricted Gmail scopes: 4–8 weeks. Needs a privacy policy, demo video, security questionnaire.
- Microsoft AppSource submission for the Outlook add-in: ~2 week review.
- Chrome Web Store review: 1–3 weeks.

---

## 9. What "done" looks like (acceptance criteria)

The founder considers v1 shipped when these are all true. Full list in `spindle-prd.md` §5.1 and §10.

1. A new user installs the Gmail extension, signs up, pays via Stripe, connects Gmail, picks scope, and sees their first style card within 5 minutes.
2. The two-sided parser works as designed (§7a): confident extractions file silently, uncertain ones land in the "needs your eyes" queue, and the *confidently-wrong* rate on the 30-email test set is low (a wrong silent answer is the failure mode that matters, not a flagged one). Per-field silent-filing thresholds are calibrated from the founder's scorecard, not hard-coded.
3. The confirmation queue works end-to-end: a flagged item can be confirmed or corrected in one tap, the correction updates the style, and the correction is persisted to the per-workspace learning store.
4. The Gmail sidebar renders correctly without breaking Gmail's own UI, on Chrome and Edge.
5. Daily digest arrives at 7am user-local.
6. Forward-to-address fallback creates a style card (or a queue item, if uncertain) within 60 seconds.
7. The extension survives a Gmail UI update without breaking.
8. User can pause Spindle and revoke access; revoke deletes tokens within 60 seconds.
9. Stripe webhooks gate access on subscription status.
10. (Phase B) The Outlook add-in renders the same views — including the confirmation queue — in the task pane, installs via AppSource or sideload, and reads mail via Microsoft Graph.
11. (Phase B) The Outlook add-in works on Outlook 2016/2019/2021 as well as current.

---

## 10. What the founder needs from you on the first call

The founder is non-technical — 15 years in fashion, deep on the problem and the users, reliant on you for all technical judgment. Explain trade-offs in plain English. On your first conversation, the founder wants your view on:

1. **Is the Phase A → Phase B sequencing right, and how long is each realistically?** (The PRD suggests ~3 months to a Gmail launch; pressure-test that.)
2. **Is this one engineer's job or does it need two** — one on the backend, one on the extension/add-in DOM work?
3. **What's the realistic monthly cost** (infrastructure + LLM) at 8 customers, and at 50?
4. **What can we start in week 1** to get ahead of the Google OAuth verification lead time?
5. **What stack would you actually build this in**, and why? (See `spindle-claude-code-prompt.md` §4 for one proposal — agree, improve, or replace it.)
6. **What's the engagement model** — contract, fractional CTO, equity, hire? (Open conversation.)

The seven open questions in `spindle-prd.md` §13 are the founder's actual agenda for that call. Come having read them.

---

## 11. How to give the founder confidence you've understood

Before writing code, send the founder a one-page response covering:
- Your understanding of the scope: what's in v1, what's out, and the Phase A/B split, in your own words.
- Your proposed stack and architecture (agreeing with, improving, or replacing the proposal in `spindle-claude-code-prompt.md`).
- Your realistic timeline and what could blow it.
- Anything in these documents you'd push back on.
- What you need from the founder and when (the 30 test emails, the 8 customer names, domain/DNS access, Google and Microsoft developer accounts).

That one page is the contract. It proves you've read the material and turns this brief into a shared plan.

---

## 12. File quick-reference (everything in this folder)

**Build-critical:**
- `spindle-handover-brief.md` — this file, the map
- `spindle-prd.md` — the requirements (what must be true)
- `spindle-claude-code-prompt.md` — a prescriptive build proposal (data model, parser, stack, phases)
- `spindle-parser-test-kit.md` + `spindle-parser-scorecard.xlsx` — the founder's parser accuracy test. The filled-in scorecard tells you real per-field accuracy and confidence calibration, and sets the per-field silent-filing thresholds (§7a). Ask for it.

**Design — the screens to build:**
- `spindle-screens.html` — popup, onboarding ×3, settings, digest email
- `spindle-screen-gmail-email.html` — Gmail client, email view (clean, import-ready)
- `spindle-screen-gmail-board.html` — Gmail client, board view (clean, import-ready)
- `spindle-parser-loop.html` — **the two-sided parser confirmation UI** (the "needs your eyes" queue and the three confidence tiers). The interaction spec for §7a.
- `spindle-style-card.html` — full style card
- `spindle-today.html` — Today priorities view
- `spindle-board.html` — production board with working filters (filter behaviour spec)
- `spindle-outlook.html` — Outlook add-in design + deployment notes

**Context (not build-critical):**
- `spindle-landing.html` — marketing site, product voice and positioning
- `spindle-validation-kit.md` — how the 8 founding customers were found, who the user is
- `spindle-gmail-extension.html` / `spindle-gmail-board.html` — the original annotated mockups (the `spindle-screen-*` versions above are the cleaned ones; these have explanatory notes you may find useful for understanding what's Spindle vs what's Gmail)

**Not part of Spindle** (ignore — leftover from earlier exploration):
- `cited-landing.html`, `cited-wireframes.html`, `spindle-demo.html`

---

## 13. The one-paragraph version, for your notes

Spindle is an email plugin for fashion product teams, built as one LLM-powered backend serving multiple thin clients: a Gmail extension, an Outlook add-in, a universal forward-to-address fallback, and a web app. It reads supplier emails and extracts structured data about fashion styles in production. The parser is **two-sided** (§7a): it files what it's confident about silently, and routes what it's unsure about to the user as one-tap confirmations — every confirmation teaching it that customer's vocabulary, so the questions fade over the first weeks. The design goal is a near-zero *confidently-wrong* rate, not a single accuracy headline. Build the backend and Gmail client first (Phase A), prove the two-sided parser with 8 paying founding customers, then add the Outlook add-in as a second client over the same backend (Phase B). The parser is the moat; the founder owns its fashion-vocabulary prompts and is running an accuracy test whose scorecard sets the per-field confidence thresholds. Privacy (read only what the user designates) is a hard architectural requirement and a sales dealbreaker. Read the PRD for the full spec, the screens to see the product, `spindle-parser-loop.html` for the two-sided interaction, and the Claude Code prompt for a prescriptive starting architecture.

---

**Questions before you start?** The founder would rather you ask than assume. The most expensive thing you can do is build the wrong thing well.
