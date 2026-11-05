# Spindle — Claude Code Build Brief

> **Audience.** Claude Code (agentic mode) or a senior full-stack developer.
> **Purpose.** Ship a working Gmail Chrome extension + minimal backend in 10–14 weeks that 8 founding customers can pay for and use.
> **Tone of the brief.** Opinionated. Where a choice would waste days of back-and-forth, I make the choice. Where the human founder genuinely needs to weigh in, I flag it explicitly.

---

## 1. What Spindle is

Spindle is a **Gmail and Outlook plugin** for fashion product teams (merchandisers, buyers, sourcing managers, indie brand founders). It reads the supplier emails the user already gets, builds a structured **style card** for every fashion style, and surfaces what's blocking production today.

**The wedge.** Fashion ops runs on email and Excel — not on PLM systems. Every PLM (Centric, Lectra, Bamboo Rose) has spent 30 years telling brands to *stop* using email and Excel. Nobody stops. Spindle sits *underneath* email and Excel instead of fighting them.

**Who pays.** Indie and small-to-mid fashion brands, sourcing offices, manufacturers — typically the ~95% of fashion businesses too small for enterprise PLM. Pricing is per-workspace flat: £59 (Studio), £149 (Brand), £349 (House), custom (Atelier). Founding cohort: 8 customers at £99/mo locked for life.

**The two specific phrases that define the product:**
- *"Spindle reads every supplier email as it arrives, builds a live style card for every line, and remembers the 23-day-old email that's now urgent."*
- *"Different category, not a replacement for PLM."*

---

## 2. What we're building right now

**Goal of this build.** A Gmail Chrome extension MVP, plus the backend that powers it, that 8 founding customers can pay for and use by their Monday morning. Nothing more.

**Explicitly out of scope for v1:**
- Outlook add-in (separate Phase 2 build, ~10–14 weeks after this)
- WhatsApp Business API integration (manual forward-to-email is fine for v1)
- Production board with full filters (UI exists in mockups but it's complex; ship Today + Style card first)
- API access / PLM connectors / multi-brand workspaces
- Team / multi-seat features beyond a single user per workspace
- SOC 2 certification (note privacy practices, defer formal audit)
- Native mobile apps
- Bulk historical email import (only forward-going emails in v1)

**Forward-to-address fallback.** Keep it built as a universal back door — for Apple Mail users, IT-restricted brands, and WhatsApp content. Every workspace gets a private inbox address (`firstname-randomhash@in.spindle.app`); forwarded mail flows through the same parser as Gmail-extension mail. This is roughly 5–10% of the build effort and preserves universal coverage. Don't skip it.

---

## 3. Reference materials (read these before writing code)

The design has been iterated to high fidelity. Read these files in order to understand the intended product:

| File | What to study |
| --- | --- |
| `spindle-landing.html` | Product positioning, pricing tiers, the hero copy. The marketing story is the user-facing source of truth. |
| `spindle-gmail-extension.html` | **Primary visual reference.** The exact Gmail extension UX — left nav injection, inline email-list tags, insight strip in reading pane, Spindle box sidebar. Build to match. |
| `spindle-gmail-board.html` | The "Production board" view inside Gmail (left nav active, board in main pane). Out of MVP scope but read for context on Phase 2. |
| `spindle-style-card.html` | Full style-card layout. The sidebar version in the extension is a compact form of this. |
| `spindle-today.html` | "Today" priorities view — 5 ranked items with "why now" sentences. Build a compact version of this for the extension sidebar. |
| `spindle-board.html` | Full production board with filters. Mostly for Phase 2 but useful to understand the data model. |
| `spindle-outlook.html` | Outlook design — read for context on Phase 2 only. |
| `spindle-validation-kit.md` | The founder's customer-research playbook. Tells you *who* the user is. |

**Visual system in all mockups.** Paper #F4EFE5, ink #14110C, ochre accent #B07527, Instrument Serif italic for editorial moments, Geist for UI, JetBrains Mono for data/IDs. Hand-drawn flat sketches as garment illustrations. These design tokens MUST survive into the extension — they're a meaningful part of why merchandisers find Spindle credible.

---

## 4. Tech stack (decided)

I'm making opinionated choices to avoid burning days on stack debates. If a senior dev has a strong reason to deviate, flag it before changing.

### Extension (Chrome)
- **Manifest V3** (V2 is sunset).
- **TypeScript** + **Preact** (10kb runtime; lighter than React, more ergonomic than vanilla).
- **Vite** for build (use `@crxjs/vite-plugin` for Manifest V3 hot reload).
- **Shadow DOM** for every injected UI element — Gmail's CSS is hostile.
- **Tailwind CSS** scoped to shadow DOM via `@tailwindcss/postcss`, OR plain CSS modules. Pick Tailwind if comfortable, plain CSS modules if not.

### Backend
- **Node.js 20+** with **TypeScript** (same language as extension; easier handoff between layers).
- **Hono** as the HTTP framework (lightweight, modern, runs on Node/Bun/edge).
- **Drizzle ORM** for Postgres (typed, no codegen hassle).
- **BullMQ** for background jobs (email parsing, digest sending) backed by **Redis**.
- **Zod** for runtime validation.

### Database & infra
- **Postgres 16** (managed — start with Neon free tier).
- **Redis** (managed — Upstash free tier).
- **Hosting:** Railway or Fly.io. Pick Railway for first deploy (simpler).
- **Object storage:** Cloudflare R2 for email attachments (cheaper than S3, no egress fees).

### External services
- **LLM:** Anthropic Claude API — `claude-sonnet-4-6` for the parser (cheap, fast, smart enough). Fall back to `claude-opus-4-7` for edge cases the cheaper model flags as ambiguous.
- **Auth:** Clerk for user accounts (fastest setup; £25/mo or free under 10k MAU).
- **Gmail integration:** Gmail API via OAuth 2.0 (NOT IMAP). Push notifications via Pub/Sub.
- **Email sending (digests):** Resend (cleanest API).
- **Billing:** Stripe Checkout + Customer Portal.
- **Error tracking:** Sentry.
- **Analytics:** PostHog (self-hostable later if needed).

### Repository structure
Monorepo via pnpm workspaces:
```
spindle/
├── apps/
│   ├── extension/        # Chrome extension (Manifest V3, Preact, Vite)
│   └── api/              # Backend API (Hono, Drizzle, BullMQ)
├── packages/
│   ├── db/               # Drizzle schema + migrations, shared types
│   ├── parser/           # LLM prompts + parsing logic
│   └── shared/           # TypeScript types shared between extension and API
└── docs/
    └── prompts/          # Versioned LLM prompts
```

---

## 5. System architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      USER'S BROWSER                             │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Gmail (mail.google.com)                                 │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  Spindle Extension (content scripts)               │  │   │
│  │  │  · Injects left-nav section                        │  │   │
│  │  │  · Adds inline tags to email list rows             │  │   │
│  │  │  · Adds insight strip above email body             │  │   │
│  │  │  · Renders Spindle box in right sidebar            │  │   │
│  │  │  · All UI in Shadow DOM                            │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────│────────────────────────────┘   │
│                                │                                │
│  Extension service worker ────────► api.spindle.app/v1/...      │
└────────────────────────────────│────────────────────────────────┘
                                 │
                                 ▼
   ┌──────────────────────────────────────────────────────┐
   │              SPINDLE BACKEND (Hono on Node)          │
   │  ┌────────────────────────────────────────────────┐  │
   │  │  REST API                                      │  │
   │  │  · /v1/styles  — fetch user's style cards      │  │
   │  │  · /v1/today   — 5 ranked priorities           │  │
   │  │  · /v1/parse   — parse arbitrary email body    │  │
   │  │  · /v1/oauth/gmail — connect Gmail             │  │
   │  └────────────────────────────────────────────────┘  │
   │                                                      │
   │  ┌────────────────────────────────────────────────┐  │
   │  │  Background workers (BullMQ)                   │  │
   │  │  · pull-gmail        (poll + Pub/Sub push)     │  │
   │  │  · parse-email       (Claude API call)         │  │
   │  │  · rank-today        (re-rank every 6 hours)   │  │
   │  │  · send-digest       (daily 7am user TZ)       │  │
   │  └────────────────────────────────────────────────┘  │
   └──────────────────────────────────────────────────────┘
              │              │                │
              ▼              ▼                ▼
       Postgres (Neon)   Redis (Upstash)   R2 (attachments)
              │
              ▼
        Claude API (Anthropic)
```

**Key flow — when a supplier email arrives in Gmail:**
1. Gmail Pub/Sub push notification → `/v1/webhooks/gmail` → BullMQ job enqueued
2. Worker fetches full message via Gmail API (with stored OAuth token)
3. Worker filters: is this sender / label in the user's watch scope? If not, drop.
4. Worker calls Claude API with system prompt + email body → structured JSON
5. Worker resolves which existing Style this maps to (by style number, fuzzy match, or creates new)
6. Worker writes EmailMessage row, updates Style row, optionally creates PriorityItem
7. Extension polls `/v1/today` every 60 seconds when Gmail is open; live updates appear in the sidebar.

---

## 6. Data model (Postgres via Drizzle)

This is the v1 schema. Keep it lean — Spindle is a CRUD app dressed up in good design.

```typescript
// packages/db/schema.ts

// USERS & WORKSPACES (single-user workspaces in v1)
users {
  id              uuid pk
  email           text unique
  name            text
  clerk_user_id   text unique
  stripe_customer_id text
  subscription_tier text  // 'founding' | 'studio' | 'brand' | 'house' | 'atelier'
  subscription_status text  // 'trialing' | 'active' | 'past_due' | 'canceled'
  spindle_inbox_address text unique  // e.g. priya-7x3k@in.spindle.app
  timezone        text default 'Europe/London'
  created_at, updated_at
}

// GMAIL CONNECTION (one per user in v1)
gmail_connections {
  id              uuid pk
  user_id         uuid fk users
  gmail_email     text
  access_token    text encrypted
  refresh_token   text encrypted
  watch_history_id text  // Gmail API history cursor
  watch_expires_at timestamp
  scope_senders   text[]  // ['vikram@halverra.in', '@palamgroup.com', ...]
  scope_labels    text[]  // ['Suppliers', 'Factories', ...]
  scope_mode      text  // 'senders_only' | 'labels_only' | 'both'
  connected_at    timestamp
  paused_at       timestamp nullable
}

// STYLES (the unit of value)
styles {
  id              uuid pk
  user_id         uuid fk users
  style_number    text  // '6601234', 'SL000040', 'AH6601' — varies wildly
  brand           text  // 'POPPI', 'MARLOWE LANE'
  name            text  // 'Jasmine Emb Jacket'
  garment_type    text  // 'jacket', 'dress', 'top', 'trouser', 'skirt'
  season          text nullable  // 'AW25', 'SS25'
  factory         text nullable
  current_stage   text  // 'tp' | 'ct' | 'ld' | 'so' | 'fs' | 'pp' | 'to' | 'bk' | 'sh' | 'shipped' | 'cancelled'
  status          text  // 'blocked' | 'waiting' | 'ontrack' | 'shipped' | 'cancelled'
  fabric          text nullable
  color           text nullable
  fob_cost        text nullable  // free-form string '$13.50' (currency varies)
  delivery_date   date nullable
  qty             integer nullable
  facts           jsonb  // all other extracted fields, flexible
  first_seen_at   timestamp
  last_email_at   timestamp
  created_at, updated_at

  unique(user_id, style_number)
}

// EMAIL MESSAGES (one per supplier email Spindle processed)
email_messages {
  id              uuid pk
  user_id         uuid fk users
  style_id        uuid fk styles nullable  // null if not yet resolved
  source          text  // 'gmail' | 'forward'
  gmail_message_id text nullable
  from_email      text
  from_name       text
  subject         text
  body_text       text
  body_html       text nullable
  received_at     timestamp
  parse_status    text  // 'pending' | 'parsed' | 'ambiguous' | 'error'
  parse_error     text nullable
  extracted       jsonb  // raw LLM output
  confidence      decimal  // 0.0–1.0
  flagged_for_review boolean default false
  reviewed_at     timestamp nullable
  created_at
}

// ATTACHMENTS
attachments {
  id              uuid pk
  email_message_id uuid fk email_messages
  filename        text
  mime_type       text
  size_bytes      bigint
  r2_key          text
  parsed_text     text nullable  // for PDFs
  parsed_at       timestamp nullable
}

// PRIORITY ITEMS (the Today view)
priority_items {
  id              uuid pk
  user_id         uuid fk users
  style_id        uuid fk styles
  reason          text  // "Lab dip pending 8 days; cutting window closes tomorrow"
  ranked_position integer  // 1, 2, 3, 4, 5
  ranked_at       timestamp
  dismissed_at    timestamp nullable
  resolved_at     timestamp nullable
}
```

**Critical schema notes:**
- `style_number` is `text` not `integer` — fashion style numbers come in wildly different formats (`6601234`, `SL000040`, `AH6601`, `82034501`). Never assume numeric.
- `facts` and `extracted` as `jsonb` give the parser room to add new fields without migrations. Resist the urge to flatten everything into columns.
- `current_stage` is an enum but stored as text so it's easy to extend.
- Encrypt OAuth tokens at rest. Use `pgcrypto` extension.

---

## 7. The parser (the moat)

This is the only part of the system that's hard to copy. Spend disproportionate time here.

### Approach
- One Claude API call per email.
- System prompt encodes fashion domain vocabulary (LD = lab dip, PP = pre-production, FOB = free on board, etc.) and the 9-stage production timeline.
- User message: full email body + sender + subject + attachment text (if PDF parsed).
- Response: structured JSON matching the `extracted` schema, plus a confidence score per field.

### Prompt skeleton

```
You are Spindle's fashion-ops parser. You read one supplier email and
extract structured facts about the fashion style(s) it references.

DOMAIN VOCABULARY:
- Style number formats vary: '6601234', 'SL000040', 'AH6601', '82034501', etc.
- 9-stage production timeline: tech pack (TP) → costing (CT) → lab dip (LD)
  → strike-off (SO) → fit sample (FS) → pre-production sample (PP) → top
  sample (TOP) → bulk (BK) → ship (SH).
- Common terms: FOB, BL (bill of lading), CMT, TPD, GSM, gauge, woven/knit.
- Currencies: $ (USD, often factory FOB), £ (GBP, often UK brand), € (EUR).

YOUR JOB:
1. Identify the style number(s) referenced. If ambiguous, set confidence < 0.7
   and flag for human review.
2. Detect the current production stage from context cues.
3. Extract facts: fabric, color, cost, delivery date, quantity, factory.
4. Determine status: blocked, waiting, on_track, shipped, cancelled.
5. Write a one-sentence "why this matters" if the email represents a state change.

OUTPUT JSON:
{
  "style_references": [
    {
      "style_number": "6601234",
      "confidence": 0.95,
      "garment_hint": "jacket",
      "brand_hint": "POPPI"
    }
  ],
  "stage_detected": "ld",
  "stage_confidence": 0.88,
  "status_inferred": "blocked",
  "status_reason": "Lab dip pending 8 days; cutting window closes tomorrow.",
  "facts": {
    "fabric": "Cotton Duck 280gsm",
    "color": "khaki",
    "fob_cost_usd": 13.50,
    "delivery_date": "2025-02-15",
    "qty": 600
  },
  "flagged_for_review": false,
  "review_reason": null
}
```

Iterate this prompt on real anonymized emails from the founder's data. The 92% extraction accuracy claim in the marketing copy is the bar to clear before launch.

### Prompt versioning
Store prompts in `docs/prompts/parser-v1.md`, `parser-v2.md`, etc. Every code-deployed version of the parser references a specific prompt file by name. This makes A/B testing and rollback trivial.

### Ambiguity handling
If `style_references` has multiple candidates with similar confidence, OR the highest confidence is < 0.7, set `flagged_for_review = true` and surface in the extension UI as "needs your eyes" with one-tap confirmation. Every correction gets logged for fine-tuning later.

---

## 8. Build phases (10–14 weeks)

Each phase is a coherent unit of 3–10 days. Ship each phase to the founder for review before starting the next.

### Phase 0 — Project setup (3 days)
- Monorepo scaffold with pnpm workspaces
- Drizzle schema + first migration
- Hono API skeleton with `/health`
- Extension scaffold (Vite + Preact + Manifest V3 stub)
- Clerk integration for user auth (sign-up via extension popup)
- Stripe Checkout for the Brand tier (£149/mo) — gate everything behind active subscription
- Deploy api.spindle.app to Railway, configure Cloudflare DNS
- **Done when:** founder can sign up, pay, see an empty dashboard.

### Phase 1 — Gmail OAuth + scope picker (5 days)
- `/v1/oauth/gmail/authorize` redirects to Google consent screen
- Restricted scopes: `gmail.readonly` only
- Token exchange + encrypted storage in `gmail_connections`
- Extension popup shows scope picker: "Which senders or labels should Spindle watch?"
  - User can add senders by email, domain, or selecting Gmail labels
  - Save to `gmail_connections.scope_senders` / `scope_labels`
- Set up Gmail Pub/Sub push for incoming mail
- **Done when:** founder connects their Gmail, picks "watch label: Suppliers", and the extension shows "connected · watching 1 label".

### Phase 2 — Email ingestion + parser (7 days)
- `/v1/webhooks/gmail` receives Pub/Sub pushes, enqueues parse jobs
- BullMQ worker: fetch message via Gmail API, filter by scope, call Claude API
- Parser prompt v1 implemented and tested against 30 real anonymized emails from the founder
- Style resolution logic: match `style_number` to existing Style, fuzzy match if needed, create new if confident
- Forward-to-address fallback: each user gets `firstname-randomhash@in.spindle.app`, inbound mail via Postmark or AWS SES → same parser
- **Done when:** founder forwards / receives 10 real supplier emails and Spindle creates 8+ correctly populated style cards within 60 seconds each.

### Phase 3 — Extension content scripts: left nav + email-list tags (5 days)
- Content script injects "Spindle" section into Gmail left nav with Today / Style labels
- Content script adds inline tags to every email-list row (style number + stage pill)
- All UI in Shadow DOM, isolated from Gmail's CSS
- Live updates via long-polling `/v1/today` every 60s, or upgrade to SSE if time permits
- **Reference:** `spindle-gmail-extension.html` lines showing left nav and inline tags
- **Done when:** founder opens Gmail and sees their supplier emails tagged with style info on every row.

### Phase 4 — Reading pane: insight strip + entity highlighting (4 days)
- When an email is open, detect it via DOM observer
- Inject Spindle insight strip above email body: "14th message on this style, lab dip 8 days overdue"
- Highlight extracted entities (style numbers, dates, costs) inline in the email body
- **Reference:** `spindle-gmail-extension.html` insight strip and email body sections
- **Done when:** founder opens a real supplier email and sees the insight strip + highlighted entities.

### Phase 5 — Spindle box: right sidebar with style card (8 days)
- Inject collapsible Spindle box into right side of Gmail
- Renders the detected style's compact card: sketch placeholder, status, key facts, mini timeline, recent threads, action buttons
- "Open full style card" button opens a panel overlay (NOT a new tab) with the full view
- **Reference:** `spindle-gmail-extension.html` (compact) + `spindle-style-card.html` (full)
- **Note on sketches:** use placeholder SVG silhouettes for v1, by garment_type. Real hand-drawn flat sketches are Phase 2 polish work.
- **Done when:** founder clicks an email, the Spindle box shows the correct style with all extracted facts.

### Phase 6 — Today view in sidebar (4 days)
- New tab in the Spindle box: "Today (5)" badge
- Renders 5 ranked priority items with "why now" sentences
- Re-rank worker runs every 6 hours; users can also manually refresh
- Each card click takes the user to the relevant style
- **Reference:** `spindle-today.html` for visual treatment; right sidebar of `spindle-gmail-board.html` for the compact form
- **Done when:** founder opens the Today tab on Monday morning and sees 5 ranked items, each with a sentence explaining why.

### Phase 7 — Settings, onboarding, daily digest email (4 days)
- Settings page: change scope, pause Spindle, manage subscription
- First-time onboarding: walks user through Gmail connect → scope picker → "we'll start watching"
- Daily digest email at 7am user time via Resend: "5 things in Spindle this morning" linking back to Gmail
- **Done when:** founder gets their first 7am digest with real content, on the day after their first night with Spindle running.

### Phase 8 — Polish, error handling, ship to founding cohort (5 days)
- Sentry error tracking wired through extension and API
- Graceful failure states: "Spindle is taking a moment to read this email…"
- Rate-limit handling on Claude API
- Gmail token refresh logic (tokens expire after 1 hour)
- Chrome Web Store submission (this takes 1–3 weeks for review)
- **Done when:** 8 founding customers are using the extension on their own Gmail, paying via Stripe, and Sentry shows < 1 error per user per day.

---

## 9. Definition of done (v1)

The MVP is done when ALL of these are true:

1. A new user can install the Chrome extension, sign up, pay £99/mo via Stripe, connect their Gmail, pick which senders/labels to watch, and see their first style card built within 5 minutes.
2. Parser hits ≥85% extraction accuracy on the founder's 30-email test set (style number, brand, garment type, stage, status all correct).
3. The Spindle box renders correctly in Gmail on Chrome and Edge (Chromium-based), without breaking Gmail's own UI.
4. Daily digest email lands in the user's inbox at 7am their time.
5. Forward-to-address fallback works: forwarding any email to the user's `@in.spindle.app` address creates a style card within 60 seconds.
6. The extension survives a Gmail UI refresh — a sane MutationObserver pattern that doesn't blow up when Google ships a tweak.
7. User can pause Spindle from the extension popup; pausing stops all parsing and digest sending until resumed.
8. User can revoke Gmail access from settings; doing so deletes the OAuth tokens and stops new email processing immediately.
9. Stripe webhook reliably gates extension access on subscription status.
10. Sentry shows < 1 unhandled error per user per day across the founding cohort.

---

## 10. Non-negotiables

### Privacy and scope
- **Only read emails matching user-defined scope.** Never read mail outside the watched senders/labels, even if Gmail API would let you.
- **Never read replies the user sends.** Filter outgoing mail at the worker level.
- **Encrypt OAuth tokens at rest** using `pgcrypto`.
- **Body content retention:** keep parsed text for 90 days, then truncate to a redacted summary. Full original body is the user's, not Spindle's.
- **One-click revoke:** user revokes Gmail access in settings → tokens deleted within 60 seconds.

### Scope discipline
- If a feature isn't in the v1 list, it doesn't ship in v1. The most common failure mode for this build is feature creep into the production-board complexity. The board is real, the filters are gorgeous in the mockup, but it isn't the wedge — Today + Style card is the wedge.
- If you're spending more than 2 days on something that isn't in a numbered phase, stop and ask the founder.

### Extension hygiene
- All injected UI inside Shadow DOM. No exceptions.
- MutationObserver patterns with debounce (300ms) to avoid hammering Gmail's DOM.
- Graceful degradation if Gmail's selectors change — show a "Spindle paused: Gmail update detected, we're checking" banner rather than silent failure.
- Never modify Gmail's own DOM elements — only inject Spindle-owned containers alongside them.

### Performance budgets
- Parser: ≤ 8 seconds from email arrival to style card update.
- Extension UI: ≤ 100ms to render Spindle box when an email is opened.
- API responses: p95 ≤ 200ms for `/v1/today` and `/v1/styles`.

---

## 11. Areas to ask the founder about

These are decisions that need a human in the loop. Don't guess; ask.

1. **Chrome Web Store account.** Founder needs to create a developer account ($5 one-time) and add Claude Code as a collaborator. Submission and OAuth verification take 1–3 weeks — start this in Phase 0.

2. **Google OAuth verification.** Restricted scopes (`gmail.readonly`) require Google's verification process. This means a privacy policy, a demo video, and a security questionnaire. Takes 4–8 weeks. Start applying in Phase 1.

3. **Real test emails.** Founder needs to provide 30 anonymized real supplier emails (with attachments) by Phase 2. These tune the parser. Without them, accuracy is guesswork.

4. **Founding-customer waitlist.** Eight names. Their email addresses. Their brand sizes. Phase 8 ships to these specific humans, not to a marketing list.

5. **Domain.** `spindle.app` or another? Founder owns the domain decision. Need to know by Phase 0 for DNS setup.

6. **Pricing for v1.** £99/mo founding cohort or £149/mo Brand tier from day one? Affects Stripe Checkout config.

7. **Time zone defaulting.** UK-based founder. UK-default for digest sending in v1; multi-TZ in v2.

8. **Brand assets.** Founder has the wordmark and palette in the mockups; need final logo SVG and a polished icon at multiple sizes for the Chrome Web Store listing.

---

## 12. Initial prompt to paste into Claude Code

When you're ready to start, paste this into a fresh Claude Code session:

```
We're building Spindle — a Gmail Chrome extension + backend for fashion
product teams. I've prepared a comprehensive build brief at
docs/spindle-claude-code-prompt.md. Read it in full before doing anything
else.

Also read these design mockups for visual reference:
- docs/spindle-gmail-extension.html (primary visual reference)
- docs/spindle-style-card.html
- docs/spindle-today.html
- docs/spindle-landing.html (for positioning and copy voice)

Once you've read them, do three things:

1. Confirm you've understood the scope by listing back to me: what's in v1,
   what's explicitly out of v1, and the 8-phase build plan.

2. Flag any decisions in the brief you'd push back on or want to discuss
   before we start writing code.

3. Set up Phase 0 (project setup): monorepo scaffold, initial schema,
   Hono API skeleton, extension scaffold, Clerk integration, Stripe
   Checkout, Railway deploy. Stop and check with me before starting Phase 1.

Important: I am the founder, not a developer. Explain technical decisions
in plain English. When you encounter areas in section 11 ("Areas to ask the
founder about"), stop and ask me rather than guessing.
```

---

## 13. What success looks like 90 days from kickoff

- 8 founding customers paying £99/mo, all actively using the extension daily.
- ≥ 85% parser accuracy on real-world emails.
- ≥ 60% daily digest open rate.
- ≥ 4 of 8 customers willing to be quoted publicly for the launch.
- Phase 2 (Outlook add-in) ready to start, with the same backend already validated and stable.
- Founder has stopped iterating on mockups and is now selling.

If all six are true at day 90, Spindle has product-market fit and the next decision is funding-versus-bootstrap, not product-versus-no-product. If three or fewer are true, the assumptions in the brief were wrong somewhere — and the founder uses the validation kit (`spindle-validation-kit.md`) to figure out which assumption broke.
