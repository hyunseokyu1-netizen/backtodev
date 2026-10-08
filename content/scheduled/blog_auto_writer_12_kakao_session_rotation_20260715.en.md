---
title: 'Automating Blog Publishing (12): I Kept the Session Alive, So Why Did It Die Again? — False Positives and One-Time Login Tokens'
date: '2026-07-15'
publish_date: '2026-12-01'
description: "Tracking down why publishing failed again a few days after adding a session keep-alive cron, and discovering that the check logic itself was producing false positives, and then that Kakao's \"stay logged in\" token is single-use and rotates, making fully unattended reissue impossible"
tags:
  - Playwright
  - Session Management
  - Kakao Login
  - Troubleshooting
  - Serverless
---

In the last post, I added a session keep-alive cron and wrapped up with "it won't die within a day anymore." But two mornings later, that familiar red text was back on the dashboard.

> Your Tistory login session has expired.

I'd clearly set up a cron that refreshes the session every 12 hours, so why did it die again? This post is about chasing down that answer and running into two twists along the way — **a false-positive check** and a **one-time login token.**

## Step 1: Was the Keep-Alive Cron Actually Keeping Anything Alive?

The first thing I suspected was whether the keep-alive cron was really keeping the session alive. Reading back through the code, the check logic looked like this.

```typescript
const cookies = await context.cookies();
const alive = cookies.some((c) => c.name === 'TSSESSION');
if (alive) {
  await saveSession(userId, platform, await context.storageState()); // 갱신됐다고 믿고 덮어씀
}
```

It looks for a cookie named `TSSESSION` among the cookies injected via `storageState`, and there's a trap hidden in there. **Playwright's `storageState` "injects" cookies into a browser context — it doesn't revalidate them against the server.** In other words, even if the session was already expired on the server, the cookie (expired or not) still sits in the context as-is, so `cookies.some(...)` always returns `true`.

I actually tested this by feeding a session I knew was dead into this logic.

```
쿠키 수: 27
  TSSESSION @ .tistory.com expires=session   ← 존재는 함
직후 URL: https://www.tistory.com/auth/login?redirectUrl=...  ← 근데 이미 로그인 페이지
```

**The cookie was there, but the login was already gone.** The keep-alive cron had been reporting this dead session as "refreshed" every single time and saving it right back. Which means a large chunk of the "keep-alive succeeded" logs up to this point had been false positives.

### Matching the Check to the Same Criteria as the Publish Logic

To eliminate the false positives, the check needs to be based on "can you actually reach a page that requires being logged in," not "does the cookie exist." The publish code was already using exactly this approach, so I brought the keep-alive cron in line with it.

```typescript
await page.goto(`https://${blogName}.tistory.com/manage/newpost/`, {
  waitUntil: 'domcontentloaded',
});

// 살아 있는 세션도 카카오 SSO 재인증으로 accounts.kakao.com을 경유할 수 있으므로
// 리다이렉트 체인이 끝날 때까지 기다린 뒤 최종 URL로 판정한다.
await page
  .waitForURL((u) => u.pathname.includes('/manage/newpost'), { timeout: 15000 })
  .catch(() => {});

const alive = page.url().includes('/manage/newpost');
```

Checking `page.url()` right away without `waitForURL` here creates yet another kind of false result. Even a live session can briefly detour through `accounts.kakao.com` while Kakao's SSO reissues a token, and if you check at that exact moment, you'll mistakenly conclude it's dead. The key is to wait for the redirect chain to fully finish before judging.

Once I fixed this and ran it again, the check came back honest this time.

```json
{"refreshed": 1, "results": [
  {"platform": "tistory", "ok": false, "note": "expired"},
  {"platform": "naver",   "ok": true,  "note": "refreshed"}
]}
```

Naver really was alive, and Tistory really was dead. The check was fixed, but **the underlying problem was still there.**

## Step 2: How Often Does It Really Die?

Now that the check could be trusted, I dug through the entire RSS publish history to see the actual pattern.

```
Tue, 14 Jul 09:42   ← 발행 성공
Mon, 13 Jul 17:43   ← 발행 성공
Sun, 12 Jul 23:02   ← 발행 성공
Sat, 11 Jul 21:39   ← 발행 성공
...
```

Look closely at the times and none of them are **exactly 09:00.** The auto-publish cron runs every day at 09:00, but the actual publishes went out at 9 PM, 11 PM, 5 AM... every single one right after I'd manually re-linked the session or opened a browser by hand while developing. In other words, **not once had the 09:00 cron succeeded at publishing purely on its own, using only the stored session.** The belief that it was surviving for several days at a stretch was just an illusion created by me poking at the session constantly while developing.

The Kakao login session (`TSSESSION`) didn't seem to expire after 24 hours of inactivity at all — it looked like it was dying on a much shorter cycle, and especially **the instant the connecting IP changed (local → serverless).** This was a fight the keep-alive cron could never have won in the first place.

## Step 3: If "Keeping Alive" Doesn't Work, Automate "Reissuing"

If I can't stop it from dying, I can just automatically log back in every time it does. There was a lead here. On my local PC, there was a persistent browser profile with Kakao's **Easy Login** registered (an account tile you just click — no password — to log in).

```typescript
const context = await chromium.launchPersistentContext(profileDir, { headless: true });
const page = await context.newPage();
await page.goto(`https://${blogName}.tistory.com/manage/newpost/`);

if (page.url().includes('/auth/login')) {
  await page.locator('a.btn_login.link_kakao_id').first().click();
  // 카카오 로그인 페이지에 저장된 계정 타일이 뜬다
  await page.locator('text=/[\\w.+-]+@[\\w.-]+\\.\\w+/').first().click();
  await page.waitForURL((u) => u.pathname.includes('/manage/newpost'));
}
```

Testing it out, it actually worked. Instead of a login form, the saved email account tile showed up, and one click finished the re-login. I registered this script with macOS `launchd` to run every day at 08:40 (20 minutes before the publish cron). Now, without any human stepping in, the session would be freshly issued every morning, and the 09:00 cron should always be able to publish with a fresh session.

For a few days, this really did work.

## Step 4: The Twist — Even Easy Login Got Blocked Within Days

But a few days later, the auto-reissue script itself started failing.

```
[tistory] 세션 만료 감지 — 카카오 간편로그인으로 재발급 시도
간편로그인 계정 타일을 찾지 못했습니다 — 카카오가 전체 로그인을 요구하는 상태입니다.
```

The account tile had vanished entirely, replaced by a screen demanding a full ID/password login. To narrow down the cause, I restarted a profile that had just finished a manual login and checked its cookies immediately.

```
총 쿠키 4개
  from_login @ .tistory.com
  _T_ANO     @ .kakao.com
  _kau       @ .kakao.com
  (❌ _kawlt, _kawltea 등 "로그인 유지" 토큰이 전부 없음)
```

Less than a minute after logging in, the "stay logged in" tokens were already gone. At this point I was sure of the cause. **Kakao's "stay logged in" token (`_kawlt`, etc.) is a single-use rotating token.** Every time you log in, the server issues a new token and immediately discards the old one. This is a common security design meant to stop a stolen token from being reused.

The problem was that this is **fundamentally at odds with a headless batch reissue flow.** Spinning up a new browser context every time, logging in, capturing the session, saving it, and closing the browser — that flow naturally ends up as "log in → context closed before the save fully completes," and if the token rotation happens to land in that window, the next run starts with an already-invalidated saved token. I mitigated it somewhat by increasing the wait before closing the browser, but fundamentally this was a security mechanism built around the assumption of "a person keeps the browser open and uses it continuously," being circumvented by "an automation script that turns on and off occasionally" — and that was never going to be very reliable.

## Conclusion: Giving Up on Full Automation, Minimizing Intervention Instead

Here's how I laid out the options.

| Method | Assessment |
|---|---|
| Store ID/password and auto-relogin | Blocked by CAPTCHA/anomaly detection, and carries a big risk from storing credentials in plaintext (already rejected in post 11) |
| Auto-reissue via headless batch Easy Login | Fundamentally at odds with the stay-logged-in token's rotation policy — holds for a few days, then eventually gets blocked |
| Human logs in once each time the session expires | Not fully automated, but the most honest and safe stopgap |
| (The commercial-product direction) Capture the session daily from the customer's actual browser | No such problem exists, since Kakao recognizes this as a normal "human-used browser" |

For now, I settled on option three. I left the auto-reissue script in place rather than deleting it — it still helps on days when the Easy Login token happens to be alive, and when it fails, it just fails quietly and I log in myself. That said, this experience left an important implication for the direction of commercialization. The Chrome extension approach I'd been planning (where a customer logs in on their own browser, and that session gets uploaded to the server) needs to work not as a "one-time capture" but as a structure that **re-captures from the user's actual browser every morning and resends it.** This made it clear early on that there's no way to clear this wall by logging in on the user's behalf ourselves.

## Wrap-Up

| Symptom | Real cause | Fix |
|---|---|---|
| Keep-alive cron reports "success" but the session is dead | storageState cookies stay in the context even after expiring on the server, so presence alone can't tell life from death | Judge by whether the login-page redirect happens, same as publishing (including waiting out the SSO detour) |
| Even after fixing the check, the session still doesn't survive a day | Kakao sessions expire much faster than 24 hours, especially instantly on an IP change | Gave up on "keeping alive," switched design to "reissue daily" |
| Even auto-reissue gets blocked again within days | Kakao's stay-logged-in token is single-use and rotating, clashing with the headless batch flow | Gave up on full automation, settled for minimal intervention (one manual login), with the real fix deferred to capturing from the user's actual browser |

The biggest thing I learned from this one is that **sometimes you have to doubt the very confirmation that something is "fixed."** The keep-alive cron reporting "success" didn't actually mean the session was alive. When the check logic verifies something different from what it's supposed to be verifying, you end up with logs staying green while the system is already broken underneath. When dealing with automation, the habit of separately confirming "is the actual state what I expect" — rather than just "there's no error" — turned out to be the fastest path in the end, even when it took several days like this one did.
