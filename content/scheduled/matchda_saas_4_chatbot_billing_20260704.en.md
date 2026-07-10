---
title: 'Building a SaaS With an AI Coding Assistant (4): One-Click Collection, a Chatbot, and Going Paid for the First Time'
date: '2026-07-04'
publish_date: '2026-08-03'
description: One-click collection of big-name job postings verified against public ATS APIs, a support chatbot that only explains how to use the product, and turning a free SaaS into a paid one with Stripe subscriptions
tags:
  - Stripe
  - Claude API
  - SaaS
  - Next.js
  - Subscription Billing
---

## Starting off

Part 1 covered URLs and flow, Part 2 a data-loss incident, Part 3 resume-related features. This part covers the final three pieces of work from this session.

- A recommended-company preset that registers and collects a big-name career page in a single click
- A support AI chatbot that only explains how to use the product
- The first paid subscription, built with Stripe (in progress)

The first two features are answers to "what should we get the user to do on the very first screen," and the last is the step of turning a service that's been built for free into a product that actually charges money.

## Step 1. Recommended-company presets — verify via API before registering

MatchDa only starts collecting postings once a user registers a career page URL themselves. But telling a first-time visitor to "go ahead and enter a career page URL" leaves them stuck — they don't know what to enter.

So in commit `88ba103`, I pre-registered career pages of well-known companies — Apple, Spotify, Stripe, Anthropic, Databricks, and others — as clickable chips, so a single click does "register + collect immediately."

```
feat: add recommended-company presets + one-click collection to Discover

- Presets for 14 well-known companies' career pages (Apple, Spotify, Stripe, Anthropic, Databricks, etc.)
- Clicking a chip → addPresetSource (register career page) → scrapeSourceAction (collect immediately)
- Only includes slugs validated against public ATS APIs (greenhouse/lever/apple)
```

What I was careful about here was **verifying up front that the slug registered as a preset actually points to a live career page.** ATS (Applicant Tracking System) platforms like Greenhouse and Lever expose public APIs like this.

```
# Greenhouse public API
GET https://boards-api.greenhouse.io/v1/boards/{slug}/jobs

# Lever public API
GET https://api.lever.co/v0/postings/{slug}
```

Only after directly hitting this API with a company slug (e.g. `stripe`, `anthropic`) and confirming a real posting list came back did I add it to the preset list. If you just guess the slug as "company name + greenhouse.io," you run into more cases than you'd expect where the company doesn't actually use Greenhouse, or uses a different slug. The final, completed preset list looks like this.

```ts
// src/lib/discover/presets.ts
export const PRESET_COMPANIES: PresetCompany[] = [
  { name: 'Apple', url: 'https://jobs.apple.com/en-us/search' },
  { name: 'Spotify', url: 'https://jobs.lever.co/spotify' },
  { name: 'Stripe', url: 'https://boards.greenhouse.io/stripe' },
  { name: 'Anthropic', url: 'https://boards.greenhouse.io/anthropic' },
  { name: 'Databricks', url: 'https://boards.greenhouse.io/databricks' },
  // ... 14 companies total
]
```

The server action that runs on click is split into two steps.

```ts
// src/app/discover/actions.ts
export async function addPresetSource(
  name: string,
  url: string
): Promise<{ sourceId?: string; already?: boolean; error?: string }> {
  // if the career page is already registered, just return the existing sourceId (prevents duplicate registration)
  const { data: existing } = await supabaseAdmin
    .from('job_sources')
    .select('id')
    .eq('user_id', profile.id)
    .eq('url', url)
    .maybeSingle()
  if (existing) return { sourceId: existing.id, already: true }

  // if not, register a new one and return sourceId → the client follows up with the collection action
  const { type } = detectAtsType(url)
  const { data, error } = await supabaseAdmin
    .from('job_sources')
    .insert({ user_id: profile.id, name, url, source_type: type })
    .select('id')
    .single()
  ...
}
```

Clicking a chip registers via `addPresetSource` on the client, then immediately follows up by calling `scrapeSourceAction` (collection) with the returned `sourceId`. From the user's perspective it's "one chip click," but internally it's a structure of two sequential steps — register, then collect. I also added handling for duplicate clicks — "reuse the existing one if it's already registered."

## Step 2. The support chatbot — deliberately narrowing scope

In commit `03800a7`, I added a support chatbot as a floating widget in the bottom-right corner.

```
feat: add a support AI chatbot (usage guidance)

- Bottom-right floating widget (SupportChat) handles usage/FAQ questions across every page
- askSupportBot server action: responds via Haiku based on the MatchDa knowledge base, no DB lookups
- Politely declines out-of-scope requests and points to relevant service features instead
- Suggested-question chips + conversation history (last 12 turns) retained
```

The most important design decision in this feature was the constraint that **this chatbot never queries the DB.** I could have built a chatbot that answers questions like "what's my application status?" using real data, but that would require a much larger scope of work — user data access permissions, prompt injection defenses, response accuracy verification. At this stage, narrowing the scope to "a chatbot that only answers usage questions and FAQs" was the pragmatic choice.

The knowledge base is organized as markdown in a separate file.

```ts
// src/lib/support/knowledge.ts
export const SUPPORT_KNOWLEDGE = `
# MatchDa Service Overview
MatchDa is a global career platform that polishes a Korean resume into
professional-level English and automatically optimizes it against a job posting.

## Job Discovery (/discover)
- "Collect from recommended companies": clicking a chip for a big-name company
  like Apple, Spotify, Stripe, or Anthropic registers the career page and
  immediately collects postings.
- Browse and sort within "all collected postings," and use the "send to tracking"
  button to add it to Applications.
...
# Frequently Asked Questions (FAQ)
- What's the match score? AI compares your resume against the posting and computes a 0-100 fit score.
- I don't see any postings: register a career page in Discover, or collect from a
  recommended company, then use "send to tracking" to add it to Applications.
`.trim()
```

I inject this knowledge base directly into the system prompt, and instruct the model to politely decline anything not covered here (account issues, billing issues, off-topic chatter beyond the service's scope). Here too the model is Haiku — this is answering within a fixed body of knowledge, not creative generation, so speed and cost took priority. Conversation context is kept to only the last 12 turns, so token cost doesn't grow unbounded.

Placing the RAG tailored resume from Part 3 next to this chatbot makes for an interesting contrast. Both use the same pattern — Haiku plus custom context injection — but RAG is "generate based on facts, referencing user data," while the chatbot is "answer only within a static knowledge base, and never touch user data at all." The scope of data access was designed differently depending on the risk level of the feature.

## Step 3. Stripe subscription billing — turning a free SaaS into a paid one

Commit `6a413fa` implemented a $7.99/month subscription model. This part is still **in progress** — the secret key setup in the Stripe dashboard and the DB migration are done, but the price ID and webhook setup remain.

```
feat: Stripe monthly subscription billing + free-plan limits

- Pricing page (/pricing): free vs. premium, upgrade/manage-subscription buttons
- Stripe Checkout subscription session + customer portal (billing-actions), webhook reflects subscription status → plan
- Free limits: 5 career pages, 2 tailored resumes (only applied when STRIPE_PRICE_ID is set)
- Sidebar 'Upgrade to Premium' → links to /pricing
- Migration 015: adds plan/stripe columns to profiles (to be run after approval)
```

The structure looks like this.

```
User clicks "Upgrade"
        │
        ▼
Create a Stripe Checkout session (billing-actions)
        │
        ▼
Stripe payment completes
        │
        ▼
Receive webhook event (checkout.session.completed / subscription.updated / etc.)
        │
        ▼
Update plan, subscription_status in the profiles table
```

Looking at the webhook handler code, the logic that reflects Stripe events into profile state is gathered into one function.

```ts
// src/app/api/stripe/webhook/route.ts
async function applySubscription(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  const profileId = sub.metadata?.profile_id
  const status = sub.status
  const active = status === 'active' || status === 'trialing'

  const patch = {
    plan: active ? 'premium' : 'free',
    subscription_status: status,
    stripe_subscription_id: sub.id,
    stripe_customer_id: customerId,
    current_period_end: sub.items.data[0]?.current_period_end
      ? new Date(sub.items.data[0].current_period_end * 1000).toISOString()
      : null,
    updated_at: new Date().toISOString(),
  }

  // prefer profile_id (metadata); fall back to matching by stripe_customer_id
  const query = supabaseAdmin.from('profiles').update(patch)
  if (profileId) await query.eq('id', profileId)
  else await query.eq('stripe_customer_id', customerId)
}
```

Two things are worth noting here.

First, I didn't skip **webhook signature verification.** `stripe.webhooks.constructEvent(body, sig, webhookSecret)` confirms a request genuinely came from Stripe before it's processed at all. Without this, anyone could forge a `checkout.session.completed` event and get a premium plan for free.

Second, **limits aren't enforced at all in environments without billing wired up.**

```ts
// src/lib/plan.ts
export function billingEnabled(): boolean {
  return !!process.env.STRIPE_PRICE_ID
}
```

Without the `STRIPE_PRICE_ID` environment variable, the free-tier limits (5 career pages, 2 tailored resumes) simply don't apply. This prevents a situation in a dev/staging environment where billing setup isn't finished yet, but the limits still kick in with no way to upgrade — locking users out of the feature for no reason. It's a simple gate — one environment variable deciding "is billing live in this environment" — but it turned out to be a genuinely useful pattern in practice.

The free/premium determination logic is also centralized in one place.

```ts
export function planOf(profile): Plan {
  if (!profile) return 'free'
  const active = profile.subscription_status === 'active' || profile.subscription_status === 'trialing'
  if (profile.plan === 'premium' && active) return 'premium'
  if (profile.plan === 'premium' && profile.subscription_status == null) return 'premium'
  return 'free'
}
```

Worth noticing is the exception that still counts a profile as premium if `plan === 'premium'` even when `subscription_status` isn't set yet (right after migration). This is defensive code so that existing data doesn't suddenly get demoted to free during a mid-schema-change state.

What's still left is creating the actual Price object in the Stripe dashboard, filling in `STRIPE_PRICE_ID`, and registering the production webhook endpoint. That's planned to wrap up next session, so it might warrant a Part 5 to cover what follows.

## Common patterns, summarized

| Feature | Core pattern |
|---|---|
| One-click collection | Register (idempotent) → collect immediately; pre-verify slugs against public ATS APIs |
| Support chatbot | Inject a static knowledge base + no DB queries, minimizing risk scope |
| Subscription billing | Webhook signature verification is mandatory; gate "is billing active" via an env var |

## Summary

The three features built in this part differ in nature, but shared a common attitude.

1. **I put real effort into reducing friction in the first experience.** Letting users start with a single chip click even without knowing a career page URL, and letting them just ask the chatbot even without knowing how to use the product — both were choices aimed at making sure a first-time user never gets stuck.
2. **Data access scope was designed differently depending on the feature's risk.** The chatbot never touches the DB at all, billing mandates webhook signature verification, and presets are pre-verified against an external API before registration. Rather than "make it work first, bolt on safeguards later," boundaries matching the risk level were drawn from the start.
3. **Going paid isn't one feature — it's a system.** Checkout, the customer portal, webhooks, plan determination, and environment-variable gating all have to interlock for the single feature of "billing" to be complete. That's exactly why the price ID and webhook setup are still outstanding — even with all the code written, it only actually works once the external service (Stripe) side is configured to match.

Looking back at the whole session, in one day working with an AI coding assistant I covered everything from a URL redesign to a data-loss incident, a RAG implementation, and the start of monetization. The biggest lesson wasn't really "the AI writes code fast" — it was that a human still has to keep judging "what to build, how much authority to grant, and what absolutely must be confirmed by a person." Next session I plan to keep recording as the Stripe setup gets finished, and whatever feedback comes in after that.
