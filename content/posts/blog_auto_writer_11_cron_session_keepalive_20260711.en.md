---
title: 'Automating Blog Publishing (11): Nothing Happened at 9 AM — Rollback Aftermath and a Session Keep-Alive Cron'
date: '2026-07-11'
publish_date: '2026-11-04'
description: "Why a Vercel Cron I'd definitely set up quietly stopped running (rollback aftermath), and designing a keep-alive cron that extends a Kakao session dying within a day, without ever storing a password"
tags:
  - Vercel
  - Cron
  - Session Management
  - Troubleshooting
  - Serverless
---

In earlier posts, I got all the way to a Vercel Cron that auto-publishes every day at 09:00. But one morning, a post that should have gone out was still sitting on the dashboard with a "Draft complete" status. No error, no failure log — **nothing happened at all.** This post is a record of fixing the two causes behind that — one infrastructure, one session.

## No Clue Was the Clue

The first thing I checked was the logs, and something was off.

```bash
vercel logs <production-url> --since 6h --query "cron"
# → No logs found
```

It wasn't that there was a failure log for the cron — **there wasn't a single line for the cron request itself.** That splits into two possibilities: either the request came in and just didn't get logged (worth noting, Vercel's Hobby plan only retains runtime logs for about an hour, so anything from a few hours ago can't be traced through logs at all), or the request never came in to begin with. Logs couldn't settle it, so I queried the project settings directly through the API.

```bash
curl -s "https://api.vercel.com/v10/projects/{PROJECT_ID}" -H "Authorization: Bearer $TOKEN" \
  | python3 -c "..."
# crons.deploymentId: dpl_FqwU...  (7월 8일자 배포!)
# crons.host: dashboard-2egr82ajh-....vercel.app  (옛날 배포 호스트)
# production: dpl_FqwU...
```

**The cron was bound to a deployment from three days earlier.** And in between, I'd shipped several deployments with new features (multi-tenancy, Naver publishing, etc.).

## The Cause: `vercel rollback` "Pins" Production

A few days earlier, during an emergency, I'd rolled back to an older deployment with `vercel rollback` (see post 8). I didn't know it at the time, but **a rollback doesn't just revert the alias — it pins the production target to that deployment.** After that, any `vercel deploy --prod` behaves like this:

- The domain alias updates to the new deployment → the site shows the new UI → **looks completely normal**
- But the production target (and the cron bound to it) stays pinned to the rollback-time deployment → **the cron is pointing at old code**

And that old deployment's cron code was looking at an old data structure that had already been fully migrated away from and left empty, so even if it had run, it would have quietly finished with "nothing to publish." The visible site and the actual running cron were executing two different sets of code — a pretty nasty kind of mismatch.

The fix is an explicit promote.

```bash
vercel deploy --prod          # 새 배포 생성
vercel promote <새 배포 ID>   # 프로덕션 고정 해제 + cron 재바인딩
```

One thing to watch out for: trying to promote a deployment the alias is already pointing to gives you a "already the current production deployment" 409 error, while leaving the cron binding stuck in that half-broken state. **You need to create a new deployment and promote that one** to actually clear it. After promoting, I confirmed via the API that `crons.deploymentId` had updated to the latest deployment, and that subsequent deployments followed automatically from then on.

> **Lesson**: If you've ever used rollback, subsequent deployments can end up in a state where "the site is on the new version but the cron is on the old one." After using rollback, you must bring things back to a healthy state with promote.

## Second Problem: The Session Doesn't Survive a Day

After fixing the cron binding and running it manually, the code ran fine this time — but a different error came up.

```json
{"ok": false, "error": "티스토리 로그인 세션이 만료되었습니다..."}
```

The login session (TSSESSION) had died again. Just one day after linking it. Tracing back through the timeline, a pattern emerged:

- Last publish (= last session use): yesterday at 11:31
- Today's publish attempt: around 12:00 → **about 24.5 hours of inactivity** → expired

The Kakao session cookie didn't look like an absolute-time expiry — it looked like it was dying after **roughly 24 hours of inactivity.** The original design was "every day a publish succeeds, the session gets refreshed as a side effect." But once the cron skipped a day (due to the binding bug above), that refresh opportunity was missed → the session died → the next day's publish also failed, a chain reaction. It was a fragile structure where a single bad day meant needing to manually re-link.

## "What if I Just Stored the Password?"

A natural thought at this point. If the session dies, why not just auto-log-in again with a stored password? To cut to the conclusion: **I decided not to, and the reason is more practical than moral.**

1. **Storing it wouldn't even help.** Auto-login would mean attempting a Kakao login from a US datacenter IP (Vercel) — and if even a human doing it manually gets hit with a CAPTCHA (reading digits off a receipt photo), there's no way a headless automation would pass. Worst case, it triggers account protection for a suspicious login.
2. For a commercialized service, "we never touch your password" is a core trust point, and building the infrastructure (storage/decryption code) that breaks that principle is itself a risk, regardless of whether it's ever misused.

## The Fix: A Session Keep-Alive Cron

If I can't revive a dead session, **I can just keep it from dying.** Since the expiry condition is "24 hours of inactivity," using the session once every 12 hours should, in theory, keep it alive forever.

```typescript
// /api/cron/refresh-sessions — 매일 21:00 KST (발행 cron은 09:00)
for (const userId of await listUserIds()) {
  for (const platform of ['tistory', 'naver']) {
    const session = await getSession(userId, platform);
    if (!session?.cookies?.length) continue;

    const browser = await launchServerlessBrowser();
    const context = await browser.newContext({ storageState: session });
    const page = await context.newPage();
    await page.goto(PING_URLS[platform]);           // 로그인된 페이지 한 번 열기

    const alive = (await context.cookies())
      .some((c) => c.name === SESSION_COOKIES[platform]);
    if (alive) {
      await saveSession(userId, platform, await context.storageState()); // 갱신된 쿠키 저장
    }
    // 죽은 세션은 덮어쓰지 않는다 — 사용자 재연동 필요 상태를 유지
  }
}
```

There was one plan constraint here. I originally wanted to run this every 6 hours, but **Vercel's Hobby plan only allows one trigger per cron job per day.** So I spaced the publish cron (09:00) and the refresh cron (21:00) 12 hours apart, squeezing the refresh interval down as much as the once-a-day limit would allow.

```json
{
  "crons": [
    { "path": "/api/cron/publish", "schedule": "0 0 * * *" },
    { "path": "/api/cron/refresh-sessions", "schedule": "0 12 * * *" }
  ]
}
```

After deploying, I triggered it manually and checked the actual response.

```json
{"refreshed": 2, "results": [
  {"platform": "tistory", "ok": true, "note": "refreshed"},
  {"platform": "naver",   "ok": true, "note": "refreshed"}
]}
```

## Wrap-Up

| Symptom | Real cause | Fix |
|---|---|---|
| Cron ran with zero log lines | Rollback pinned production to an old deployment, pulling the cron along with it | New deployment + `vercel promote` |
| Session died within a day | Kakao session expires after ~24h of inactivity, and the only refresh trigger was a successful publish | Added a 21:00 session keep-alive cron (12h refresh interval) |
| "Can't I just store the password?" | Auto-login gets blocked by CAPTCHA/anomaly detection, making it ineffective | Designed around never letting the session die instead |

What stuck with me most from this one was how to read the state of "there are no logs." A failure log tells you the cause, but **the absence of logs is a signal to suspect the stage before the request even reaches your code** — routing, bindings, protection settings. When digging through logs turns up nothing no matter how hard you look, querying the configuration directly through the API was far faster.
