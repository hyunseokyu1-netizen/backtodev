---
title: 'Automating Blog Publishing (10): When You Need to Log Into Someone Else''s Account — Why I Chose Browserbase, and How to Actually Use It'
date: '2026-07-09'
publish_date: '2026-09-01'
description: Why I chose Browserbase as the way to connect someone else's Tistory/Naver account without our code ever touching their password, and the actual integration code from session creation to login detection
tags:
  - Browserbase
  - Playwright
  - SaaS
  - Browser Automation
  - Next.js
---

In Part 8, deciding to pivot to a SaaS, the hardest technical problem I identified was "how does a user connect their own Tistory/Naver account." This part covers why I chose **Browserbase** as the answer, and how I actually wired it up.

## The problem: we shouldn't be handling someone else's password

Up to now, this tool had only ever been used with my own personal account. Locally, I logged in myself via a browser, and saved and reused that session's cookies (see Part 3). But to let other people use it, there's an option of "take the user's ID/password as input and have our server log in on their behalf" — except this must never be done. The moment a password touches our database or our code, all the liability and trust issues from a leak become entirely ours.

I reviewed three alternatives.

| Approach | Password handling | Infrastructure cost | User experience |
|---|---|---|---|
| **Embed a remote browser (Browserbase)** | Never touches our server at all | Billed per session | Done with a single button, no install needed |
| Browser extension | Never touches our server at all | None | The barrier of installing an extension |
| Manually pasting cookies | Never touches our server at all | None | Unrealistic — requires opening dev tools |

All three uphold the principle of "never touching the password." The difference is onboarding experience and cost. A browser extension carries the burden of building, shipping, and maintaining it separately, and manual cookie-pasting is too technical for a general user. Prioritizing smooth onboarding, I picked Browserbase.

## What Browserbase does

Summarized in one line: "a service that launches a Chrome browser on a remote server, and shows that screen directly inside our own website." A user completes login inside a browser actually running on Browserbase's server, without ever leaving our site.

Since this project already had code (`tistory-publish.ts`) controlling headless Chrome via `playwright-core`, there's one more practical reason Browserbase made sense — **there's no new library to learn.** One line, `chromium.connectOverCDP()`, connects our existing Playwright code straight to the remote browser.

```typescript
import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });
const session = await bb.sessions.create({ projectId, keepAlive: true });

const browser = await chromium.connectOverCDP(session.connectUrl);
// from here on, it's the exact same Playwright API as controlling local Chrome
```

## The actual integration flow

```
[User] clicks "Connect Naver"
   → POST /api/blog-connect/start
      creates a Browserbase session (keepAlive: true) → navigates ahead to the login page
      → responds with { sessionId, liveViewUrl }

[Screen] embeds liveViewUrl directly in an iframe
   → the user enters their ID/password themselves inside that screen, completes login

[Polling] GET /api/blog-connect/status?sessionId=...  (every 2 seconds)
   reconnects to the remote session and only checks whether a cookie indicating
   login success (NID_AUT, etc.) has appeared — if so, enables the "Connection complete" button

[User] clicks "Connection complete"
   → POST /api/blog-connect/finish
      reconnects to the remote session → captures cookies via storageState() → saves to Redis
      → ends the Browserbase session
```

The important design point here is `keepAlive: true`. A Browserbase session, by default, terminates the moment its CDP connection drops. Turning on `keepAlive` keeps the session alive even after we disconnect and reconnect later. Without this, the entire flow — launch the login page → wait for the user to log in → reconnect after completion to capture cookies — which disconnects and reconnects multiple times, would be impossible.

Before writing code around this assumption, I verified it was actually true with a smoke test first.

```typescript
const session = await bb.sessions.create({ keepAlive: true });
const browser1 = await chromium.connectOverCDP(session.connectUrl);
await browser1.contexts()[0].pages()[0].goto('https://example.com');
await browser1.close(); // only closes the local connection

const browser2 = await chromium.connectOverCDP(session.connectUrl); // reconnect
console.log(browser2.contexts()[0].pages()[0].url()); // → still example.com ✅
```

## Why I didn't automatically pass through on login completion

Even once the polling confirms the login cookie exists, I didn't automatically call `finish` right away — I made the user click "Connection complete" themselves. The reason is the same lesson that's kept recurring throughout this series — a login cookie existing doesn't necessarily mean login is "completely" finished. Things like 2FA or additional confirmation screens might still remain, and capturing the session in that state means the problem only surfaces later, at publish time. It's far safer to capture at the moment the user actually looks at the screen themselves and judges "this is done now."

## Problem 1 I ran into: proxies were blocked on the free plan

I set up a country-specific proxy to attempt Kakao/Naver login from a Korean IP, but using it for real threw this error.

```
402 Proxies are not included in the free plan. Please upgrade to a paid plan to continue
```

Proxies (specifying a regional IP) turned out to be a paid-plan-only feature. I decided to first check whether login actually gets blocked without a proxy at all, and built the code so it could be toggled on and off via an environment variable.

```typescript
...(process.env.BROWSERBASE_USE_KR_PROXY === 'true'
  ? { proxies: [{ type: 'browserbase', geolocation: { country: 'KR' } }] }
  : {}),
```

## Problem 2 I ran into: the screen was too small to read a captcha

During real-use testing, I got feedback that captcha text (like reading numbers off a receipt photo) was unreadable, because the remote browser screen was squeezed into a small modal box. I solved this with two things.

1. **Enlarged the modal itself to 96% of the screen** (it had been a small 720px-wide box)
2. **Added a zoom in/out control to the iframe** — scaling the remote screen itself with CSS `transform: scale()`, with overflow handled by scrolling

```tsx
<iframe
  src={liveViewUrl}
  style={{ width: '100%', height: '100%', transform: `scale(${zoom})`, transformOrigin: 'top left' }}
/>
```

I also raised the Browserbase session's own resolution (`browserSettings.viewport`) generously, to 1440×1000, so it displayed a bit sharper from the start even without any zooming.

## Summary

| Decision | Reason |
|---|---|
| A remote browser instead of a browser extension | Install-free, smooth onboarding was the priority |
| Choosing Browserbase | Lets the already-in-use Playwright code be reused as-is |
| `keepAlive: true` | A prerequisite for the whole disconnect-and-reconnect flow |
| Not auto-capturing right after login detection | "Looks logged in on screen" and "actually fully done" can differ |
| Proxy gated behind an env var | Safely handles the free-plan limitation, one line to enable on a paid upgrade |

In the end, once again, the habit of "verify it actually works with a smoke test before writing code around it" did the most work here. Browserbase's `keepAlive` reconnection behavior wasn't something I could feel fully confident about from the official docs alone, but confirming it with a 10-line script in 5 minutes made everything designed afterward far easier.
