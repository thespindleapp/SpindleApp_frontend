# Spindle — Parser Test Kit

**The single most valuable thing you can do before building Spindle.** This kit lets you measure, this weekend, for almost no money, whether an LLM can read your real supplier emails accurately enough to build a business on. Everything else in Spindle is manageable engineering. This is the question that decides whether you have a product.

This kit has three parts:
1. **This document** — the method, the prompt, and how to read the result.
2. **`spindle-parser-scorecard.xlsx`** — where you record results; it auto-calculates your real accuracy and gives you a go/no-go verdict.
3. **Your 30 emails** — real, anonymised supplier emails you provide.

---

## Why this matters more than anything else you could build

Spindle's entire thesis is: *an LLM can read messy fashion supplier emails and extract structured truth accurately enough that merchandisers trust it.* If that's true, the rest is conventional engineering — clients, billing, a database, a digest. If it's not true, no amount of beautiful UI saves the product.

You can find out the answer in a weekend, before hiring anyone, before writing production code, for the cost of a Claude or ChatGPT subscription. That is an extraordinary risk-reduction opportunity. Take it before you spend real money.

**A low score is also a win.** If the parser only hits 60% on your real emails, you've learned the most important thing about Spindle — and *why* it fails will reshape the product (maybe it needs WhatsApp content, maybe it needs the attachment as an image, maybe the emails reference styles in a way no model could resolve without your tracker as context). That's worth knowing before, not after, a three-month build.

---

## What you need

- **30 real supplier emails, anonymised.** Use the same anonymisation approach you used on the Excel tracker — fake brand names, fake people, shifted style numbers, but keep the *structure and messiness* of real emails intact. The whole point is to test on realistic data.
- **Include your worst emails.** The temptation is to pick clean, clear emails. Resist it. Include the vague ones ("pls confirm the khaki one"), the ones where the style number is only in an attachment, the ones discussing three styles at once, the ones in imperfect English from an overseas supplier. Those messy emails are the real test. If the parser handles your clean emails but fails your messy ones, you need to know that now.
- **A Claude or ChatGPT subscription.** Either works. Use the most capable model available to you (this tests the ceiling; production can optimise cost later).
- **The scorecard workbook**, open and ready.

---

## How to run the test (about 2–4 hours for 30 emails)

### Step 1 — Set up
Open a fresh conversation in Claude or ChatGPT. Paste the **parser prompt** (below) as your first message. The model will acknowledge it's ready.

### Step 2 — Feed it one email
Paste the full text of email #1. If the email had attachments, describe them in words after the email text, like:
> `[Attachment 1: PDF — a tech pack for a khaki cotton jacket, style number visible as 6601234]`
> `[Attachment 2: JPG — a photo of a lab dip swatch, no text]`

(In the real product, Spindle will parse the actual attachment. For this test, describing it in words is a fair approximation of what the parser will eventually see.)

### Step 3 — Decide the correct answer yourself
Before you score, look at the email and decide what the *right* extraction would be. You know fashion. You know what that email actually meant, which style it's about, what stage it implies. Hold that correct answer in your head.

### Step 4 — Score it on the scorecard
Go to the **Scorecard** tab. On the row for email #1, mark each field the model returned:
- **1** if it got that field right
- **0** if it got it wrong
- **leave blank** if that field genuinely wasn't in the email (e.g. no cost was mentioned, so there's nothing to extract)

Then, the most important column: **"Flagged correctly?"** Did the model make the right call about its own confidence? If the email was genuinely ambiguous and it flagged itself "needs review" — that's a **Yes** (it was honest). If the email was clear and it extracted confidently — also a **Yes**. If it guessed confidently on an ambiguous email, or flagged a clear one unnecessarily — that's a **No**.

Add a note about anything it got wrong — this is gold for improving the prompt later.

### Step 5 — Repeat, with fresh conversations
Do all 30. **Start a fresh conversation every 5–10 emails.** This stops the model from "learning" your corrections within the session — you want to measure its cold, first-shot accuracy, which is what production will face on a new customer's mail.

### Step 6 — Read the Dashboard
The **Dashboard** tab shows your headline numbers and a plain-English verdict. That verdict is your go/no-go signal.

---

## The parser prompt

Copy everything between the lines. This is a production-grade starting point — the same prompt structure the real parser will use. If you want to improve it after a first pass (e.g. add vocabulary specific to your brands), do — and note what you changed.

---

```
You are Spindle's fashion-operations email parser. You read ONE supplier
email (and descriptions of any attachments) and extract structured facts
about the fashion style(s) it concerns. You serve fashion product teams —
merchandisers, buyers, sourcing managers — who receive these emails from
factories, agents, and mills.

FASHION DOMAIN KNOWLEDGE YOU MUST APPLY:

Production stages, in order (a style moves through these):
  TP  — Tech Pack: the spec sent to the factory
  CT  — Costing: price negotiation, FOB quotes
  LD  — Lab Dip: fabric colour samples sent for approval
  SO  — Strike-off: print/pattern samples for approval
  FS  — Fit Sample: first sewn garment, fitted and commented
  PP  — Pre-Production sample: final sign-off before bulk
  TOP — Top of Production: first piece off the bulk line, for QC
  BK  — Bulk: full production run
  SH  — Ship: BL issued, goods sailing

Common vocabulary and shorthand:
  FOB = Free On Board (the factory's garment price)
  BL  = Bill of Lading (shipping doc; "BL issued" = goods shipped)
  GSM = grams per square metre (fabric weight)
  CMT = Cut Make Trim
  "lab dip", "LD", "dip" = colour sample
  "PP approved" = cleared for bulk production
  "reach DC by [date]" = arrive at distribution centre
  Style numbers vary wildly in format: 6601234, SL000040, AH6601,
    82034501. Never assume a fixed format. Never assume numeric.
  Currencies vary: $ often = factory FOB (USD), £ = UK brand (GBP),
    € = EUR. Read the context.
  Suppliers often write in second-language English. Interpret intent
    generously, but never invent facts that aren't there.

YOUR TASK:
1. Identify the style number(s) the email concerns. An email may concern
   several styles — capture all of them. If you cannot confidently
   identify the style, say so (see confidence rules below).
2. Detect the current production stage from context.
3. Determine the status: blocked, waiting, on_track, shipped, or cancelled.
4. Extract any facts present: fabric, colour, FOB cost, delivery date,
   quantity, factory/supplier.
5. Write ONE plain-English sentence on why this email matters, IF it
   represents something the merchandiser needs to act on or notice.

CONFIDENCE AND HONESTY RULES (the most important part):
- For EACH style reference, give a confidence from 0.0 to 1.0.
- If your confidence that you've identified the right style is below 0.7,
  set "flagged_for_review": true and explain why in "review_reason".
- It is far better to flag uncertainty than to guess. A wrong silent
  answer destroys user trust. An honest "I'm not sure which style this
  is about" is useful.
- Only extract facts that are actually present. Never infer a delivery
  date, cost, or quantity that isn't stated. If it's not there, omit it.

OUTPUT — respond with ONLY this JSON, nothing else:

{
  "style_references": [
    {
      "style_number": "6601234",
      "confidence": 0.95,
      "brand_hint": "POPPI or null",
      "garment_hint": "jacket / dress / top / etc, or null"
    }
  ],
  "stage_detected": "ld",
  "stage_confidence": 0.88,
  "status_inferred": "blocked",
  "status_reason": "Lab dip pending 8 days; cutting window closes tomorrow.",
  "facts": {
    "fabric": "Cotton Duck 280gsm or null",
    "colour": "khaki or null",
    "fob_cost": "13.50 USD or null",
    "delivery_date": "2025-02-15 or null",
    "qty": 600,
    "factory": "Halverra Mills, Tirupur or null"
  },
  "why_it_matters": "One plain-English sentence, or null if routine.",
  "flagged_for_review": false,
  "review_reason": null
}

Acknowledge you're ready, and I'll send the first email.
```

---

## How to score each field fairly

A few judgment calls, so you score consistently across all 30:

- **Style number** — mark 1 only if it identified the correct style. If the email was about style 6601234 and it said 6601234, that's a 1. If it flagged "unsure" on a genuinely ambiguous email, score the *flag* column Yes and leave style blank or score by whether "unsure" was the right call.
- **Stage** — mark 1 if it picked the right production stage. "Lab dip" when the email is about a lab dip = 1. Close-but-wrong (said "fit sample" when it was "PP sample") = 0.
- **Status** — blocked / waiting / on-track / shipped / cancelled. Mark 1 if it matches what you'd have said.
- **Facts** (fabric, colour, cost, delivery, qty, factory) — mark 1 if correct, 0 if wrong, blank if that fact wasn't in the email. Don't penalise the model for not extracting something that wasn't there.
- **'Why now'** — mark 1 if the sentence is accurate and useful, 0 if it's wrong or misleading, blank if the email was genuinely routine and "null" was the right answer.
- **Flagged correctly?** — Yes if its confidence call matched reality (flagged the ambiguous, confident on the clear). No otherwise. This is the trust metric and it matters as much as raw accuracy.

---

## Reading your result

The Dashboard gives you a verdict, but here's the deeper interpretation:

**If overall accuracy is 85%+ (Strong go).** The cold, single-shot floor is already at the target the production parser needs to clear. Because the real parser will be a multi-stage pipeline with per-customer learning, production accuracy will exceed this. Build with confidence. The risk now is execution, not concept.

**If 70–84% (Promising).** This is the most common and most encouraging realistic result. Above 70% cold means that with the confidence-flagging system (the model asking when unsure) and per-customer learning (accuracy climbing as it learns each brand's vocabulary), production will likely clear 85%. Build it — but make the "needs your eyes" confirmation flow and the correction-capture loop first-class features, not afterthoughts. They're what turn 75% into trustworthy.

**If 55–69% (Needs work).** The concept holds but the prompt needs real iteration before you build. Spend a focused week: look at every email scored 0, find the patterns (is it always the vague ones? always the multi-style ones? always the ones with key info in attachments?), and improve the prompt against those specific failures. Then re-test. Don't build production code until you've cleared 70% on a second run.

**If below 55% (Stop and investigate).** Don't build yet. But also don't give up — instead, diagnose *why*. The reason is the most valuable information you'll get. Common causes and what they mean:
- *Style numbers are only in attachments the model couldn't see* → the product needs strong attachment parsing (PDF/image), which is buildable.
- *Emails reference styles by name or description, not number* → the product needs your existing tracker as a lookup table, which reframes (but doesn't kill) the approach.
- *The decisions live in WhatsApp, not email* → the email-first wedge may be wrong; WhatsApp-first might be the real product.
- *The emails are genuinely too ambiguous even for a human without context* → this is the hardest finding, and it means the product needs to be more of an assistant (asking the merchant) than an extractor (telling them).

Each of these reshapes the product in a specific, useful way. A low score isn't failure — it's the cheapest product research you'll ever buy.

---

## What to do with the result

**Share the filled-in scorecard with your developer on the first call.** It's the single most useful thing you can bring. A developer who sees "82% cold accuracy on 30 real emails, with the model correctly flagging 9 of 11 ambiguous ones" knows exactly what they're building on. It also tells the honest developers from the ones who'd have quoted you a parser timeline without ever looking at real data.

**Keep the 30 emails and your correct answers.** They become the regression test set for the production parser. Every time the developer changes the prompt, they re-run these 30 and check the score didn't drop. This is how you keep the moat sharp over time.

**If you improved the prompt during testing, save the improved version.** Note what you changed and why. Your fashion-vocabulary edits are the start of the production prompt — the thing only you can write.

---

## One honest caveat about this test

This measures the *cold floor*: one prompt, one shot, no pipeline, no learning, no attachment parsing beyond your text descriptions. The production parser will be better than this test in three ways — it'll parse real attachments, it'll learn each customer's vocabulary over weeks, and it'll be a multi-stage pipeline that catches its own errors. So a "Promising" 75% here is genuinely likely to become a "Strong go" 88% in production.

But it can also be worse in one way: your text descriptions of attachments are cleaner than what real PDF/image parsing will extract. So don't over-read a great score that depended heavily on you describing attachments perfectly. If most of your accuracy came from attachment descriptions, flag that — it tells the developer attachment parsing is mission-critical, not optional.

Either way: run this before you build. It's a weekend and a subscription against a three-month, several-thousand-pound build. There is no better trade available to you right now.

---

**Run the test. Then we'll know.**
