---
title: "South Korea Wasn't in Stripe's Country List, So I Switched to Paddle"
date: '2026-07-08'
publish_date: '2026-07-17'
description: How I resolved being forced to set up a Stripe account as "United States" while running a SaaS from Korea, by migrating to Paddle (a Merchant of Record)
tags:
  - Paddle
  - Stripe
  - Payment Integration
  - SaaS
  - Next.js
---

## Why I'm writing this

I run Matchda, an overseas job-search resume service, solo out of Korea. Trying to add premium subscription payments, I went to create a Stripe account — and **South Korea wasn't in the country selection screen at all.** It's fairly well known that Korea is missing from Stripe's officially supported country list, but actually hitting it firsthand was still jarring. With no other option, I created the account as "United States."

The problem came later. While running the service, Stripe popped up a "please provide additional information" screen. It looked like a routine notice on the surface, but it was actually a demand to **"prove you're really a US business."** I'm a Korean individual business owner with no US corporation, no US bank account. There was no way to clear this requirement.

This post is a record of how I assessed this problem and migrated the code to a different payment service, Paddle. Any developer running a SaaS solo or at small scale out of Korea (or another Stripe-unsupported country) will eventually run into this exact problem, so I'm leaving this written up as I lived it.

## Why setting it to "United States" was a real problem

At first I thought lightly, "can't I just leave it as US?" But the more I looked into it, the more I realized this wasn't just a labeling issue. **A Stripe account's country represents the legal location of the business.** Set the account to the US, and Stripe treats it as an actual US business, applying the regulations that come with that.

Without an actual US corporation (EIN), a US address, and a US bank account, keeping this setting had three problems waiting.

1. **KYC (identity verification) can't pass.** Stripe tightens identity verification once an account crosses a certain revenue threshold or shows anomalies. There's no way to submit the documents it requires (a US corporate registration, etc.).
2. **Even if it passes, payouts get blocked.** Stripe normally only deposits into a bank account in the same country as the account. Without a US account, revenue just stays locked inside Stripe.
3. **Tax filing gets tangled.** If the account is classified as a US business, it may become subject to IRS-based tax filing — an entirely separate process from the tax filing I already need to do as a Korean resident.

Sorting this out narrowed it down to two options.

| Option | Details | Trade-off |
|---|---|---|
| **Set up a real US corporation via Stripe Atlas** | forming a Delaware C-Corp + getting an EIN + opening a US bank account like Mercury | ongoing corporate costs, US corporate tax filing burden. Worth considering if revenue is planned to scale up |
| **Switch to a Merchant of Record (MoR) payment provider** | a service like Paddle takes on the "seller" role on your behalf | a Korean individual/business can get paid out directly with no US corporation. Fees somewhat higher than Stripe's |

For a solo-run, early-stage SaaS, the cost and complexity of forming and maintaining a corporation was too much to take on. I judged **switching to Paddle to be far more realistic.**

### What exactly an MoR (Merchant of Record) does

Paddle handles payments directly as the "seller" on my behalf. The actual card statement shows something like `PADDLE.NET* MATCHDA` instead of my company name. This is the key part — **Paddle handles VAT/GST calculation, collection, and remittance across countries worldwide, on my behalf.** I effectively act as Paddle's "reseller." No need to track per-country tax rates one by one — Paddle calculates and handles it, then pays me out.

## The code migration — the architecture is fundamentally different

From here it's actual code. Stripe and Paddle are designed with fairly different payment flows, so this wasn't a simple substitution — some parts needed restructuring entirely.

### Checkout — a completely different approach

Stripe creates a Checkout Session server-side, then redirects the entire page to the resulting URL.

```ts
// Stripe (Before)
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  customer: customerId,
  line_items: [{ price: priceId, quantity: 1 }],
  success_url: `${origin}/pricing?success=1`,
})
// on the client
window.location.href = session.url
```

Paddle Billing's (the current API version) standard approach is different. **Load Paddle.js on the client and open an overlay (modal) checkout directly.** The server doesn't need to pre-create "a checkout page URL."

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

Because of this difference, I removed the server action `createCheckoutSession()` entirely, replacing it with a lighter `getBillingContext()` that just returns the minimal info (logged-in email, profile ID) needed for the client to open the overlay. The responsibility of creating the checkout session itself moved from server to client.

### Subscription management (the portal) turned out to be surprisingly symmetric

Checkout needed a complete rewrite, but the "Manage Subscription" button (the customer portal) turned out to carry over almost as-is. Paddle also returns a URL via its Customer Portal Sessions API, and the pattern was nearly identical to Stripe's `billingPortal.sessions.create`.

```ts
// Stripe
const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url })

// Paddle
const session = await paddle.customerPortalSessions.create(customerId, [subscriptionId])
// session.urls.general.overview is the returned URL
```

This was a spot where I noticed that even within the same company's payment systems, "the flow that starts a payment" and "the flow that manages an existing subscription" can follow different design philosophies.

### Webhooks — the skeleton is the same, only the event types differ

Webhooks were structurally similar too. Stripe uses the `stripe-signature` header + `stripe.webhooks.constructEvent`; Paddle uses the `paddle-signature` header + `paddle.webhooks.unmarshal(body, secret, signature)`. Since the skeleton of **signature verification → branch by event type → reflect in the DB** is the same, I modeled the existing Stripe webhook route structure and built a new `/api/paddle/webhook`.

Paddle's subscription-status events are more granular, though. Beyond `subscription.created`/`updated`/`canceled`, there's also `activated`, `pastDue`, `paused`, `resumed`, `trialing` — so I branched all of these through an `EventName` enum, handled by the same `applySubscription()` function.

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

### I found the exact API signatures inside the .d.ts files

After installing `@paddle/paddle-node-sdk` and `@paddle/paddle-js`, instead of writing code purely from the docs, **I opened the type definition (`.d.ts`) files inside `node_modules` directly and confirmed the exact method signatures one by one** — the `Paddle` class constructor, the return type of `webhooks.unmarshal`, the parameters of `customerPortalSessions.create`, even the exact field names of `CheckoutOpenOptions`. Documentation sometimes lags behind the latest API changes, but type definitions always match the actually-installed package version, making them more trustworthy.

```bash
# find and read the type definitions directly
find node_modules/@paddle/paddle-node-sdk/dist/types -name "*.d.ts"
cat node_modules/@paddle/paddle-node-sdk/dist/types/paddle.d.ts
```

### DB — only added columns, didn't delete any

Deleting existing `stripe_customer_id`/`stripe_subscription_id` columns from a live DB is something to be cautious about, so I left them as-is. Instead, I only added new `paddle_customer_id`/`paddle_subscription_id` columns.

```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS paddle_customer_id     TEXT,
  ADD COLUMN IF NOT EXISTS paddle_subscription_id TEXT;
```

The `plan`, `subscription_status`, and `current_period_end` columns were named provider-neutrally from the initial design, so they carried over as-is. It wasn't intentional at the time, but I felt it firsthand this time — glad I hadn't named it `stripe_status` back then.

### Some parts actually got simpler

Stripe redirected to a `cancel_url` when checkout was canceled, and there was logic to catch that and show a "payment was canceled" banner. Paddle's overlay checkout just leaves the user on the same screen with no page navigation if they simply close the modal. So this cancel-redirect handling became unnecessary entirely — a rare case where the migration actually made a chunk of code disappear.

### Since it was a full replacement, I deleted without hesitation

Since this wasn't running both providers side by side but a complete switch, I deleted the `stripe` npm package, `src/lib/stripe.ts`, and the Stripe webhook route entirely. Leaving unused code around "just in case" only creates confusion later.

## A mistake — always recheck right after committing

Making the first commit, I staged several files with `git add`, but only the new files (`paddle.ts`, the new webhook route, the migration file) actually made it into the commit, while **the existing files I'd actually modified (`billing-actions.ts`, `UpgradeButton.tsx`, `plan.ts`, etc.) fell out of staging entirely.** Pushing in this state left the remote repo with a broken build — "still importing the already-deleted `stripe.ts`."

Fortunately, I had the habit of checking right after committing.

```bash
git status --short
git show HEAD:src/app/billing-actions.ts | grep -i stripe
```

Seeing the modified files still sitting there in `git status`, I caught it within minutes and fixed it immediately with a second commit. **The habit of rechecking "did this actually get reflected" via `git status` and `git show HEAD:filepath` right after making a commit** really proves its worth in moments like this.

## Something I built along the way — a refund policy page

I learned that Paddle checks whether a site has **a clearly published refund policy** before approving a seller account. The existing terms of service had only a short clause — "refundable within 7 days of payment if premium features haven't been used" — which I fleshed out considerably into its own page (`/refund`).

- Conditions under which a refund is possible, and cases where it's restricted
- Clearly distinguishing that **"canceling a subscription" and "a refund" are different concepts** — canceling only stops the next payment, it doesn't return money already paid
- How to request one and the processing timeline

Building this page, I found yet another bug. The project has a legacy global header component called `AppChrome`, and certain paths (`/terms`, `/privacy`, `/support`, etc.) are whitelisted to skip this legacy header and use their own header instead. I forgot to add the newly built `/refund` to this whitelist, causing a bug where the legacy header (support management/job search/profile menu) and the new page's landing header (about/careers/resume translation/pricing) overlapped, stacked on top of each other. A user sent a screenshot that revealed it, and it was fixed with one line added to the whitelist.

```ts
const usesMatchdaShell =
  pathname?.startsWith('/terms') ||
  pathname?.startsWith('/privacy') ||
  pathname?.startsWith('/refund') ||  // this one line was missing
  pathname?.startsWith('/support') ||
  // ...
```

The lesson: **whenever adding a new static page, always check whether a global layout has whitelist/branching logic like this.**

## Summary

```
Problem: South Korea missing from Stripe's country list, forced to set it to "United States"
  → without an actual US corporation/account, KYC can't pass, payouts get blocked, tax filing tangles
  → options: a real US corporation via Stripe Atlas vs. switching to Paddle (MoR)
  → Paddle is the realistic choice for an early-stage SaaS

Migration work:
  Checkout: server redirect → client-side Paddle.js overlay (structural change)
  Portal: reused Stripe's pattern almost as-is (symmetric)
  Webhooks: same skeleton (signature verification → branch → DB update), only event types more granular
  DB: ADD COLUMN with no deletions, neutral column names allowed broad reuse
  Stripe-related code fully deleted without hesitation, since it was a complete replacement

Lessons:
  - installed package .d.ts files are more accurate than docs for API signatures
  - always recheck with git status / git show HEAD right after committing
  - checking a global layout's whitelist is mandatory when adding a new static page
```

Running a SaaS solo out of Korea, you run into country-based constraints starting from something as simple as adding a single payment provider. Knowing that alternatives like an MoR exist — that Stripe not working isn't the end of the road — opens up far more options than you'd expect.
