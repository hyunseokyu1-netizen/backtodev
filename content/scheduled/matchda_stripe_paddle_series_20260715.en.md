---
title: 'Solo SaaS Payments — Starting With Stripe, Ending Up on Paddle'
date: '2026-07-15'
publish_date: '2026-07-17'
description: How I finished wiring Stripe subscriptions into MatchDa, only to discover four days later that the account country itself made the whole setup unsustainable — and the technical lessons from migrating to Paddle (Merchant of Record)
tags:
  - Paddle
  - Stripe
  - Payments
  - SaaS
  - Webhook
---

## Why I'm writing this

I was adding premium subscription billing to MatchDa, a job-search platform for English-speaking markets. Naturally I started with Stripe, and finished the full cycle — account signup through webhook verification. Then, four days after calling it done, **I had to rip the whole payment system out and switch to a different provider (Paddle).** Not because the code was wrong, but because I'd only belatedly realized that the "country" setting on the Stripe account itself was never a sustainable choice.

This post is the full journey in one piece — Stripe integration, an unexpected debugging incident, discovering the country problem, and the migration to Paddle. Anyone running a SaaS solo or on a small team from Korea (or any country Stripe doesn't officially support) will hit this eventually, so I'm leaving the whole thing here exactly as it happened.

## Part 1. Wiring up Stripe

### Korea wasn't a supported country from step one

The first hurdle was already unexpected. Stripe doesn't officially support Korea — it's simply not in the country list at signup.

MatchDa targets the Australian and New Zealand IT job markets, so billing in USD was the plan anyway, and I **signed up with a US account.** For the "What does your business do?" question during signup, I skipped the vague pitch and wrote exactly what I was charging for.

> MatchDa is a SaaS career platform that helps job seekers apply to English-speaking markets. It automatically collects job postings, scores them against the user's resume with AI, and generates tailored resumes and cover letters. We charge a monthly subscription ($7.99/month) for premium features.

At the time, I had no idea this "US account" choice would come back to bite me a few days later.

### API keys — only one of the three actually matters

The Developers menu shows three kinds of keys.

| Key | Purpose | Needed for MatchDa? |
|---|---|---|
| Secret key (`sk_...`) | Server-side Stripe API calls | **Yes** |
| Publishable key (`pk_...`) | Using Stripe.js directly in the browser | No |
| Restricted key (`rk_...`) | Secret key with narrowed permissions | No |

MatchDa **creates a Checkout Session on the server and redirects to Stripe's hosted payment page**, so there's no card form embedded directly on our pages. That meant the only thing that needed to go into `.env` was the secret key. Knowing which architecture you're on up front saves you from second-guessing key setup.

### Products and prices via API, webhooks via dashboard

Prices can be created by clicking through the dashboard, but since a terminal was already open, I did it via API.

```bash
curl https://api.stripe.com/v1/products \
  -u "$STRIPE_SECRET_KEY:" \
  -d name="MatchDa Premium" \
  -d description="Unlimited job sources and tailored resumes"

curl https://api.stripe.com/v1/prices \
  -u "$STRIPE_SECRET_KEY:" \
  -d product=prod_... \
  -d unit_amount=799 \
  -d currency=usd \
  -d "recurring[interval]=month"
```

Webhooks were registered via **Workbench → Webhooks → Add destination**.

- **URL**: `https://matchda.com/api/stripe/webhook`
- **Events**: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`

Registering it issues a signing secret (`whsec_...`), which I put into `STRIPE_WEBHOOK_SECRET`. — And this is exactly where the first incident happened.

### The incident: payment succeeded, but the plan never changed

Paying with the test card (`4242 4242 4242 4242`) created a subscription just fine on the Stripe dashboard. But back on MatchDa, the plan was still `free`.

Before suspecting the code, I checked Stripe's Events API first.

```bash
curl -s "https://api.stripe.com/v1/events?limit=5" -u "$STRIPE_SECRET_KEY:" \
  | python3 -c "import json,sys; [print(e['type'], '| pending_webhooks:', e['pending_webhooks']) for e in json.load(sys.stdin)['data']]"
```

```
checkout.session.completed | pending_webhooks: 1
customer.subscription.created | pending_webhooks: 1
```

`pending_webhooks: 1` meant Stripe had sent the events, but our endpoint hadn't returned a success response, so they were sitting in retry. I double-checked the secret value.

```bash
grep STRIPE_WEBHOOK_SECRET .env.local
# STRIPE_WEBHOOK_SECRET=wwhsec_...
```

**There was an extra `w` in front of `whsec_`.** A stray character had slipped in while copy-pasting the value from the dashboard. Signature verification fails completely if the secret is off by even one character, so no matter how correct the code was, every webhook was bouncing off with a 400. The fix itself was almost anticlimactic.

```bash
sed -i '' 's/wwhsec_/whsec_/' .env.local
# Vercel env vars needed the same fix, plus a redeploy
```

Rather than waiting for the retry schedule, I touched the subscription's metadata with a meaningless value to force-fire a `customer.subscription.updated` event.

```bash
curl https://api.stripe.com/v1/subscriptions/sub_... \
  -u "$STRIPE_SECRET_KEY:" \
  -d "metadata[retrigger]=1"
```

Within seconds, the plan flipped to premium. I then verified the cancellation flow the same way via API, confirming the entire **payment → premium upgrade → cancel → downgrade to free** cycle against real events.

The lessons from this incident stuck with me:

1. **Half of a payment integration lives outside the code.** The root cause here wasn't the billing code — it was one stray character in an environment variable.
2. **Debugging starts by figuring out whose fault it is.** The moment I saw `pending_webhooks: 1` in the Events API, the scope narrowed to "Stripe sent it, we rejected it."
3. **Knowing how to shorten your verification loop is a real edge.** Instead of waiting on webhook retries, forcing an event with a metadata touch let me actively trigger state instead of being at the mercy of an external system's schedule — and that changes how fast you can debug.

At this point, I considered the Stripe integration "done." Within days, that sense of completion fell apart entirely.

## Part 2. The "US account" choice was the real problem

While the service was running, Stripe surfaced a screen asking for "additional information." It looked like a routine notice, but it was really asking me to **prove I was actually a US business.** I'm a Korean sole proprietor with no US corporation and no US bank account. There was no way to satisfy that requirement.

The more I looked into it, the clearer it became that this wasn't just a label. **The country on a Stripe account represents the legal business location.** Keeping a US account without an actual US entity (EIN), address, or bank account meant three problems were waiting for me.

1. **KYC (identity verification) can't be passed.** Once revenue crosses certain thresholds, Stripe asks for documents (like a US business registration) that I simply couldn't provide.
2. **Payouts get blocked.** Stripe typically only pays out to a bank account in the same country as the account. Without a US bank account, revenue just sits stuck inside Stripe.
3. **Tax filing gets tangled.** A US-classified account can trigger IRS filing obligations, which is an entirely separate process from what I need to file as a Korean resident.

The choice narrowed down to two options.

| Option | What it involves | Trade-off |
|---|---|---|
| **Set up a real US entity via Stripe Atlas** | Delaware C-Corp formation + EIN + a US bank account (e.g. Mercury) | Ongoing entity maintenance and US corporate tax filing. Worth considering if you expect meaningful revenue |
| **Switch to a Merchant of Record (MoR)** | A service like Paddle acts as the "seller" on your behalf | A Korean individual can get paid out with no US entity required. Fees are somewhat higher |

Running an early-stage SaaS solo, the cost and tax complexity of forming and maintaining an entity was more than I could take on. **Switching to Paddle was the far more realistic call.**

An MoR like Paddle handles the transaction as the "seller" in my place — the actual charge on a customer's card reads something like `PADDLE.NET* MATCHDA`, not my own business name. The key part is that **Paddle calculates, collects, and remits VAT/GST across every country involved.** I effectively act as Paddle's "reseller," which means I no longer have to track tax rates country by country.

## Part 3. Migrating the code from Stripe to Paddle

Stripe and Paddle are architected quite differently at the payment-flow level, so this wasn't a straight swap — some parts had to be redesigned.

### Checkout — a completely different model

Stripe creates a Checkout Session on the server, then redirects the whole page to the resulting URL.

```ts
// Stripe (Before)
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  customer: customerId,
  line_items: [{ price: priceId, quantity: 1 }],
  success_url: `${origin}/pricing?success=1`,
})
window.location.href = session.url
```

Paddle Billing's standard approach is different: **load Paddle.js on the client and open an overlay (modal) checkout directly.**

```ts
// Paddle (After) — inside a client component
const paddle = await initializePaddle({ token, environment: 'sandbox' })
paddle.Checkout.open({
  items: [{ priceId, quantity: 1 }],
  customer: { email },
  customData: { profile_id: profileId },
  settings: { successUrl: `${window.location.origin}/pricing?success=1` },
})
```

Because of this difference, I removed the server action `createCheckoutSession()` entirely and replaced it with a lightweight `getBillingContext()` that just returns the minimal info the client needs to open the overlay (the logged-in email, the profile ID). The responsibility for starting a checkout session moved from the server to the client.

### Subscription management (the portal) turned out to be surprisingly symmetric

Checkout had to be rebuilt from scratch, but the "manage subscription" button (the customer portal) carried over almost unchanged. Paddle also returns a URL from a Customer Portal Sessions API, and the pattern matched Stripe's `billingPortal.sessions.create` almost one-to-one.

```ts
// Stripe
const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url })

// Paddle
const session = await paddle.customerPortalSessions.create(customerId, [subscriptionId])
// session.urls.general.overview is the returned URL
```

It struck me that even within the same broad category — "payments" — the design philosophy for starting a flow versus managing an existing one can differ this much between providers.

### Webhooks — same skeleton, different event types

The webhook structure itself resembled what I'd already built for Stripe in Part 1. Stripe uses a `stripe-signature` header with `stripe.webhooks.constructEvent`; Paddle uses a `paddle-signature` header with `paddle.webhooks.unmarshal(body, secret, signature)`. Since the skeleton — **verify signature → branch on event type → write to DB** — was identical, I modeled the new `/api/paddle/webhook` route directly on the existing Stripe one.

Paddle does break subscription status events down further, though. Beyond `created`/`updated`/`canceled`, there's also `activated`, `pastDue`, `paused`, `resumed`, and `trialing` — so I routed all of them into the same `applySubscription()` function.

```ts
switch (event.eventType) {
  case EventName.SubscriptionCreated:
  case EventName.SubscriptionUpdated:
  case EventName.SubscriptionCanceled:
  case EventName.SubscriptionActivated:
  case EventName.SubscriptionPastDue:
  case EventName.SubscriptionPaused:
  case EventName.SubscriptionResumed:
  case EventName.SubscriptionTrialing:
    await applySubscription(event.data)
    break
}
```

> Having already been burned by the `wwhsec_` typo in Part 1, I made a habit this time of grepping the secret value one more time whenever I moved it somewhere.

### I found the exact API signatures in the `.d.ts` files

After installing `@paddle/paddle-node-sdk` and `@paddle/paddle-js`, instead of writing against the docs alone, I **opened the type definitions (`.d.ts`) inside `node_modules` directly** to confirm exact method signatures — the `Paddle` class constructor, the return type of `webhooks.unmarshal`, the parameters of `customerPortalSessions.create`, the exact field names on `CheckoutOpenOptions`. Documentation sometimes lags behind the latest API changes; type definitions always match the package version you actually have installed, so they're more trustworthy.

```bash
find node_modules/@paddle/paddle-node-sdk/dist/types -name "*.d.ts"
cat node_modules/@paddle/paddle-node-sdk/dist/types/paddle.d.ts
```

### Database — additive only, nothing dropped

Rather than dropping the existing `stripe_customer_id`/`stripe_subscription_id` columns on a live database, I just added new ones: `paddle_customer_id`/`paddle_subscription_id`.

```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS paddle_customer_id     TEXT,
  ADD COLUMN IF NOT EXISTS paddle_subscription_id TEXT;
```

The `plan`, `subscription_status`, and `current_period_end` columns were provider-agnostic by name from the very first design, so they carried over as-is. That wasn't a deliberate bet on Paddle at the time — but I definitely felt the payoff of not having named them `stripe_status`.

### Some parts actually got simpler

With Stripe, canceling a checkout redirected to a `cancel_url`, which required logic to show a "payment canceled" banner. Paddle's overlay checkout just leaves the user on the original page with no navigation when they close the modal — so that whole cancel-redirect handling became unnecessary. A rare case where migrating a system actually deleted a chunk of code instead of adding one.

Since this was a full replacement rather than running two providers side by side, I removed the `stripe` npm package, `src/lib/stripe.ts`, and the Stripe webhook route without hesitation. Leaving unused code around "just in case" only causes confusion later.

### My mistake — always double-check right after committing

On the first commit, I staged several files with `git add`, but only the new files (`paddle.ts`, the new webhook route, the migration file) actually made it into the commit — **the existing files I'd modified (`billing-actions.ts`, `UpgradeButton.tsx`, `plan.ts`, etc.) never got staged.** Pushing in that state left the remote repo in a broken build state, still importing an already-deleted `stripe.ts`.

Fortunately, checking right after a commit is already a habit of mine.

```bash
git status --short
git show HEAD:src/app/billing-actions.ts | grep -i stripe
```

Seeing the modified files still sitting there in `git status` caught it within minutes, and a second commit fixed it. **The habit of confirming a commit actually landed the way you think it did — via `git status` and `git show HEAD:path`** — earns its keep in exactly this kind of moment.

### A side effect — a refund policy page

Paddle checks that a **clear refund policy is publicly posted** on your site before approving a seller account. The existing terms of service had a short clause; I turned it into a dedicated page (`/refund`) with real detail — refund conditions and exclusions, a clear distinction between "canceling a subscription" and "getting a refund" (canceling only stops the next charge, it doesn't return money already paid), and the request process and timeline.

Building this page surfaced another bug. A legacy global header component (`AppChrome`) was set up to skip itself on a whitelist of paths (`/terms`, `/privacy`, `/support`, etc.), and I forgot to add the new `/refund` route to that list — so the legacy header and the new landing header ended up stacked on top of each other.

```ts
const usesMatchdaShell =
  pathname?.startsWith('/terms') ||
  pathname?.startsWith('/privacy') ||
  pathname?.startsWith('/refund') ||  // this line was missing
  pathname?.startsWith('/support')
```

**Lesson: whenever you add a new static page, always check whether a global layout has a path whitelist or branching logic you need to update.**

## Patterns I used often

| Situation | Pattern |
|---|---|
| Server-side Checkout (Stripe) | A single secret key is enough |
| Webhook not reflecting | Check the Events API's `pending_webhooks` before touching code |
| Signature verification failing | Suspect a typo, stray whitespace, or newline in the secret first — copy-paste mistakes are more common than you'd think |
| Tired of waiting on webhook retries | Touch subscription metadata to force-fire `subscription.updated` |
| Confused about a billing SDK's API | The `.d.ts` files in `node_modules` are more accurate than the docs |
| Right after a commit | Re-verify with `git status` / `git show HEAD:path` |
| Adding a new static page | Check the global layout's path whitelist/branching logic |

## Summary

```
Part 1 — Stripe integration
  Sign up (choose US country) → API key (secret key only) → create product/price → register webhook
  → wwhsec_ typo breaks payment-to-plan sync → root-caused via Events API → fixed
  → verified full payment/cancellation cycle

Part 2 — the cost of the "US account"
  Keeping a US account with no real US entity → KYC fails, payouts blocked, tax filing tangled
  → options: Stripe Atlas (a real entity) vs. Paddle (MoR)
  → Paddle is the realistic call for an early-stage SaaS

Part 3 — migrating Stripe to Paddle
  Checkout: server redirect → client-side overlay (architecture change)
  Portal: reused the Stripe pattern almost as-is
  Webhooks: same skeleton, just handling more event types
  DB: additive columns only, nothing dropped
  Removed all Stripe code; added a refund policy page
```

Running a SaaS solo out of Korea means you run into country-specific constraints starting with something as basic as adding payments. I learned the hard way that the satisfaction of finishing a Stripe integration can be undone within days by discovering the choice itself wasn't sustainable. Still, knowing that a Stripe rejection isn't the end of the road — that an MoR is a real alternative — opens up a lot more options than you'd expect.
