---
title: 'Automating Blog Publishing (8): The Time Deploying Monetization Code Nearly Killed Auto-Publishing, Silently'
date: '2026-07-09'
publish_date: '2026-08-30'
description: During a multi-tenant conversion turning a personal tool into a monthly-subscription SaaS, a single deploy nearly stopped daily auto-publishing with nobody noticing — and the recovery that followed
tags:
  - Next.js
  - Redis
  - SaaS
  - Troubleshooting
  - Vercel
---

Everything built across the previous seven parts was strictly a personal tool for me. But then the thought struck — "what if I sold this as a monthly subscription to other Tistory/Naver bloggers?" — and the requirements changed completely, overnight. An account system, per-user data separation, even letting other people log into their own blogs — the work of turning a personal script into a real service began. And in this process, I ran into the quietest, most dangerous bug of the whole series so far.

## The plan: Google login + a remote browser for blog integration

Commercializing this needed at least two things.

1. **Login to the site itself** — per a confirmed requirement, support only Google OAuth (Auth.js v5)
2. **A way for users to connect their own Tistory/Naver accounts** — this was the genuinely hard part

Looking at the second problem first, there were three candidates.

| Approach | Pros | Cons |
|---|---|---|
| Embed a remote browser service (Browserbase) | Smooth onboarding, code never handles passwords | Per-session cost, external vendor dependency |
| Extract cookies via a browser extension | No per-session infrastructure cost | Requires building, shipping, and maintaining an extension |
| Manually pasting cookies | Simplest to implement | Too technical for a general user |

I picked Browserbase. Using the already-in-use `playwright-core`, just calling `chromium.connectOverCDP()` connects to a remote browser, and `proxies: [{ geolocation: { country: 'KR' } }]` lets you specify a Korean IP. Given that Kakao/Naver login can flag access from a foreign IP as suspicious, this was a practically important option.

The flow: the user clicks "Connect," a remote browser session launches, and that screen gets embedded directly into our site via an iframe. The user logs in themselves inside it, and our server detects that login completed by checking for the presence of a session cookie, then captures and saves only the `storageState`. The password never passes through our code, not even once.

## Splitting every Redis key by user

Previously, one single global key (`blog-auto-writer:topics`) held every topic for everyone. I separated this completely, per user.

```typescript
function topicsKey(userId: string): string {
  return `user:${userId}:topics`;
}
function sessionKey(userId: string, platform: string): string {
  return `user:${userId}:session:${platform}`;
}
```

I changed the existing functions (`getTopics`, `saveTopics`, `publishToTistoryServerless`, etc.) with minimal invasiveness, without rewriting their logic — just slotting `userId` in as the first argument everywhere. It mattered that I didn't touch the core automation logic already refined through two rounds of troubleshooting (body-injection verification, publicness verification).

I adjusted the cron the same way. It used to scan a single global topics list; now it iterates through every user (`users:index`) and publishes using each user's own topics and blog settings.

```typescript
const userIds = await listUserIds();
for (const userId of userIds) {
  const topics = await getTopics(userId);
  const due = topics.filter(/* due today, unpublished */);
  const blogConfig = await getBlogConfig(userId, 'tistory');
  if (!blogConfig) continue;
  // ... publish ...
}
```

Up to this point, the typecheck passed and `next build` succeeded with no issue. I figured I'd done everything verifiable locally, and deployed.

## Right after deploying, it started silently doing nothing, with zero errors

While fixing a UI bug (covered in the next part), I shipped this entire multi-tenant codebase to production in the same go. The site came up fine, pages rendered correctly. But something felt off, so I called the cron endpoint directly.

```json
{"date":"2026-07-09","users":0,"processed":0}
```

`users: 0`. Meaning nobody got processed. The cause was clear — since Google login credentials didn't exist yet, **nobody had ever actually logged in,** so `users:index` (the full user list) was completely empty. And the new cron code, iterating over this empty list, "correctly" concluded there was nothing to publish and finished.

What makes this terrifying is **there wasn't a single error.** HTTP 200, clean logs. The next morning at 9am, nothing gets posted, and the only way to notice is a human manually visiting the blog and thinking "huh, no post today?" The pattern that's kept recurring throughout this project — "the screen looks fine, but the actual state is different" — this time blew up not in the UI, but in **the architecture migration itself.**

## Rollback first, then a transitional workaround

The very first thing I did wasn't cause analysis — it was **reverting.** I immediately restored the single-user version that had been working correctly through yesterday, via `vercel rollback`.

```bash
vercel rollback dpl_FqwU4PixqrfctcN2h4A4AKZBkpyg --yes
```

Only once auto-publishing was safely working again did I actually dig into solving the real problem. With no Google login credentials yet, safely using the new multi-tenant code needed a transitional mechanism that "works like before, even without login."

```typescript
export const LEGACY_USER_ID = 'legacy-single-tenant';

export async function requireUserId() {
  if (process.env.DISABLE_AUTH === 'true') return { userId: LEGACY_USER_ID };
  const session = await auth();
  // ... real login logic ...
}
```

I migrated all the existing global data (33 topics, drafts, the Tistory session) once, under a fixed user called `legacy-single-tenant,` and put a safety net in the cron so that if `users:index` is empty, it processes this account instead. Redeploying with this in place let the UI fix and the new architecture survive safely, together.

Only afterward, once I'd actually issued Google OAuth credentials and confirmed a user could successfully log in themselves, did I migrate `legacy-single-tenant`'s data over to the real account (the unique ID Google issues) and remove `DISABLE_AUTH`. Now, there's no access at all without login, and the cron only ever runs against real accounts.

## Summary — "the build succeeded" is not proof that "operations are safe"

| What was checked | What it actually guarantees |
|---|---|
| Typecheck passed | Only that the types are correct |
| `next build` succeeded | Only that bundling works |
| The site returns 200 | Only that pages render |
| The cron returns 200 | **It can return 200 while doing absolutely nothing** |

What stung most about this incident was that auto-publishing was completely stopped in reality, despite passing all four of the above. I relearned that for a deploy that changes architecture, the habit needed isn't "did the build succeed" — it's directly hitting it with curl to check "does the core metric (this time, the `users` count) match what's expected." Next up: two more trivial, but equally confusing, UI bugs I ran into the same day.
