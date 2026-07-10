---
title: 'Building a SaaS With an AI Coding Assistant (5): Stripe Billing, All the Way to Real Money Moving'
date: '2026-07-04'
publish_date: '2026-08-04'
description: How I actually wired up the Stripe subscription billing that Part 4 left only half-built in code — signing up for a US account, creating a price via the API, registering a webhook, and the full story of a payment that succeeded but never got reflected, because of one typo'd character in an env var (wwhsec_)
tags:
  - Stripe
  - SaaS
  - Subscription Billing
  - Webhook
  - Debugging
---

## Starting off

At the end of Part 4, I'd left Stripe subscription billing as "in progress." The Checkout session, customer portal, webhook handler, and plan-determination logic were all fully coded — but not a single thing on the Stripe side (account, product, price, webhook endpoint) was set up yet.

This part is the record of that other half. And to spoil it upfront: **a payment succeeded, but the plan never changed** — and the cause wasn't the code, it was **one extra character from a copy-paste into an environment variable.** How hard problems that blow up in configuration (rather than code) are to find, and how I tracked it down, is the highlight of this part.

- Part 5 (this post): Signing up for Stripe → creating a price → registering the webhook → verifying the full payment/cancellation cycle
- Part 6: Unifying brand logos + managing 171 collected postings + AI analysis of pasted-in job descriptions

## Step 1. Signing up — Korea isn't a Stripe-supported country

The very first gate was unexpected. Stripe doesn't officially support Korea. Korea isn't even in the country list at signup.

Since MatchDa targets the Australian/New Zealand IT market, I was planning to bill in USD anyway, so I **signed up with a US account.** During signup, there's a "What does your business do?" field you have to fill in with a business description, and I wrote it out clearly stating what the service does and what it charges for.

> MatchDa is a SaaS career platform that helps job seekers apply to English-speaking markets. It automatically collects job postings, scores them against the user's resume with AI, and generates tailored resumes and cover letters. We charge a monthly subscription ($7.99/month) for premium features.

Since what matters for Stripe's review is clarity about "what you're actually selling," I wrote concretely what's being charged and how much, instead of an abstract intro.

## Step 2. API keys — only one of the three is actually needed

The Developers menu shows three kinds of keys. At first I was confused about which goes where, but sorted out, it's this.

| Key | Use | Needed for MatchDa? |
|---|---|---|
| Secret key (`sk_...`) | Calling the Stripe API from the server (creating sessions, querying subscriptions, etc.) | **Needed** |
| Publishable key (`pk_...`) | Using Stripe.js directly in the browser | Not needed |
| Restricted key (`rk_...`) | A scope-limited secret key (only certain APIs allowed) | Not needed |

MatchDa works by **creating a Checkout session on the server and redirecting to Stripe's hosted payment page.** Since a card-entry form is never embedded directly in our own page, there's no use for the publishable key. In the end, all that needed to go into `.env` was one secret key.

```bash
# .env.local
STRIPE_SECRET_KEY=sk_test_...
```

If it had been an approach that draws its own payment UI on the front end (Elements), the publishable key would've been needed too. Knowing "which side my architecture is on" up front saves you from fumbling around key setup.

## Step 3. Creating the product and price via the API

A Price can be created with a few clicks in the dashboard, but since the terminal was already open, I created it via the API instead. Creating a product and a price is two curl calls, done.

```bash
# 1) Create the product
curl https://api.stripe.com/v1/products \
  -u "$STRIPE_SECRET_KEY:" \
  -d name="MatchDa Premium" \
  -d description="Unlimited job sources and tailored resumes"

# 2) Create a $7.99/month recurring price (unit_amount is in cents)
curl https://api.stripe.com/v1/prices \
  -u "$STRIPE_SECRET_KEY:" \
  -d product=prod_... \
  -d unit_amount=799 \
  -d currency=usd \
  -d "recurring[interval]=month"
```

Dropping the `price_...` ID from the response into an environment variable makes the `billingEnabled()` gate from Part 4 recognize "billing is live in this environment" and start applying the free-tier limits.

```ts
// src/lib/plan.ts — the gate built in Part 4 now actually does something
export function billingEnabled(): boolean {
  return !!process.env.STRIPE_PRICE_ID
}
```

I also finalized the price label at this point. What had originally been written as `₩9,900/month` got changed to match the real Stripe price (`940c758`).

```diff
-export const PREMIUM_PRICE_LABEL = '₩9,900 / month'
+export const PREMIUM_PRICE_LABEL = '$7.99 / month'
```

## Step 4. Registering the sandbox webhook

A webhook is the channel through which Stripe tells our server that a payment has completed. In test mode (Sandbox), you register an endpoint via **Workbench → Webhooks → Add destination.**

- **URL**: `https://matchda.com/api/stripe/webhook`
- **4 subscribed events**:
  - `checkout.session.completed` — payment completed
  - `customer.subscription.created` — subscription created
  - `customer.subscription.updated` — subscription changed (renewal, status change)
  - `customer.subscription.deleted` — subscription canceled

Registering it issues a signing secret (`whsec_...`) — the value the webhook handler uses to verify "did this request actually come from Stripe." I dropped this into the `STRIPE_WEBHOOK_SECRET` environment variable. — And this is exactly where the incident happened.

## Step 5. The payment went through, but the plan didn't change

I ran a payment using the test card (`4242 4242 4242 4242`). The Stripe dashboard showed the subscription created correctly. But going back to MatchDa, **the plan was still free.**

Before suspecting the code, I first checked how the event had been handled on Stripe's side. Querying the Events API turned up a clue.

```bash
curl -s "https://api.stripe.com/v1/events?limit=5" -u "$STRIPE_SECRET_KEY:" \
  | python3 -c "import json,sys; [print(e['type'], '| pending_webhooks:', e['pending_webhooks']) for e in json.load(sys.stdin)['data']]"
```

```
checkout.session.completed | pending_webhooks: 1
customer.subscription.created | pending_webhooks: 1
```

`pending_webhooks: 1` means **Stripe sent the event, but our endpoint never returned success, so it's waiting to retry.** In other words, the event arrived, but our server was rejecting it — returning a 400 due to signature verification failure.

I checked the secret value again.

```bash
grep STRIPE_WEBHOOK_SECRET .env.local
# STRIPE_WEBHOOK_SECRET=wwhsec_...
```

`wwhsec_...`. **There was an extra `w` in front of `whsec_`.** A stray character had crept in while copying the value from the dashboard and pasting it into the terminal. Signature verification fails entirely if even one character in the secret is off, so no matter how perfect the code was, every single webhook was getting bounced with a 400.

The fix was almost anticlimactically simple.

```bash
# local
sed -i '' 's/wwhsec_/whsec_/' .env.local

# Vercel — needs a redeploy after fixing the env var (env changes don't take effect without one)
```

I fixed the environment variable on Vercel too and redeployed (commit `e470d57` is exactly this redeploy trigger).

### A trick to re-verify immediately instead of waiting for a retry

Stripe retries failed webhooks with exponential backoff, but waiting around for the next retry was frustrating. So I **meaninglessly touched the subscription's metadata to force-refire a `customer.subscription.updated` event.**

```bash
curl https://api.stripe.com/v1/subscriptions/sub_... \
  -u "$STRIPE_SECRET_KEY:" \
  -d "metadata[retrigger]=1"
```

A metadata change is still, technically, a subscription update, so it immediately triggers a `customer.subscription.updated` event, which the `applySubscription()` function built in Part 4 picks up and uses to refresh the profile. Checking a few seconds later, **the plan had flipped to premium.** Rather than waiting on the retry schedule, actively triggering the event myself shortened the verification loop — personally my favorite trick from this whole session.

## Step 6. The cycle isn't closed until cancellation is verified too

Stopping at "payment succeeded" would only be half the job. You also need to see that the plan properly demotes on cancellation. I canceled the subscription immediately via the API.

```bash
curl -X DELETE https://api.stripe.com/v1/subscriptions/sub_... \
  -u "$STRIPE_SECRET_KEY:"
```

A `customer.subscription.deleted` event fired, and the webhook handler updated the DB.

```
profiles.plan                = 'free'
profiles.subscription_status = 'canceled'
```

With that, the full cycle — **payment → promoted to premium → cancellation → demoted to free** — was verified end-to-end through real events. In Part 4 I wrote that "even with all the code written, it only actually works once the external service's configuration matches" — and that turned out to be exactly right.

## Common patterns, summarized

| Situation | Pattern |
|---|---|
| Server-side Checkout approach | One secret key is enough — publishable/restricted depend on your architecture |
| Webhook not reflecting | Check the Events API's `pending_webhooks` before touching code |
| Signature verification failing | Suspect a secret typo, stray space, or newline first (paste accidents are surprisingly common) |
| Frustrated waiting on webhook retries | Force-fire `subscription.updated` by touching subscription metadata |
| After fixing an env var | Vercel needs a redeploy to take effect — don't forget to deploy after just editing |
| Environments without billing set up | Gate limits off via `billingEnabled()` — avoid a dead end with no upgrade path |

## Summary

1. **Half of a payment integration lives outside the code.** Account review answers, key selection, the price object, webhook registration, environment variables — if even one of these is off, perfectly good code goes silent. The cause of this incident wasn't hundreds of lines of billing code — it was one character in an environment variable.
2. **Debugging starts with figuring out whose fault it is.** If I'd started digging into the code the moment the plan didn't change, I'd have wandered for a long time. The instant I saw `pending_webhooks: 1` in the Events API, the scope narrowed to "Stripe sent it and we rejected it," and from there it naturally led down to signature verification, then to the secret value.
3. **Knowing how to shorten the verification loop is powerful.** Just like force-refiring an event via a metadata touch instead of waiting for a webhook retry, being able to actively trigger state instead of getting dragged along by an external system's own schedule changes debugging speed completely.
4. **Monetization isn't done until cancellation is tested too.** If you only verify the upgrade path and ship, and cancellation doesn't get reflected, you end up in the worst-case scenario — no money coming in, but premium access still being granted forever.

Next up (Part 6): the remaining work outside of billing — a brand inconsistency where the favicon and the in-app logo didn't match, the management problem that emerged once collected postings ballooned to 171, and "AI analysis of a pasted-in full job description" for sites where scraping fails.
