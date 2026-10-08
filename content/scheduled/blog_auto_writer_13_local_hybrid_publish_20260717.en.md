---
title: "Automating Blog Publishing (13): Don't Move the Session, Move the Publishing — From Serverless to a Local Hybrid"
date: '2026-07-17'
publish_date: '2026-12-07'
description: Accepting that capturing and moving a Kakao session to the server was a fight I could never fundamentally win, and switching to a hybrid setup that keeps topic and draft management in the cloud while moving just the publishing step to local
tags:
  - Playwright
  - Session Management
  - Kakao Login
  - Serverless
  - Architecture
---

In the last post, I landed on the conclusion that "Kakao's stay-logged-in token is single-use and rotates, so fully unattended reissue is impossible." And exactly one day later, that conclusion proved itself true all over again. Auto-reissue got blocked again, and I had to open a login window myself. At this point it was time to change the question. Not "how do I keep the session from dying," but **"did I even need to move the session in the first place?"**

## The Shared Premise Behind Everything I'd Tried So Far

Summed up in one line, every approach I tried from post 1 through post 12 shared the same pattern.

1. Log into Kakao somewhere (whether that's my local PC or a remote Browserbase browser)
2. Capture the login session (cookies) via `storageState`
3. Store that session in Redis, then inject it into a **Vercel serverless function (a US datacenter IP)** to publish

This structure was a natural way to hit the goal of "publish in the cloud, automatically, every day." But there was a premise hiding behind it that I'd been taking for granted. **The premise that the session would stay perfectly alive even when "where you logged in" and "where you publish" are different places.**

Looking at it from Kakao's point of view, you can see just how shaky that premise is. A session a human logged into from a Korean IP suddenly gets used a few hours later from a US IP. That's exactly the pattern a security system is designed to catch. The symptoms we'd been running into for days — "the session can't survive half a day," "even the Easy Login auto-reissue gets blocked within days" — turned out to all be different faces of the same root cause.

## Flipping the Idea: Don't Move the Session, Move the Publishing

If moving the captured session is the problem, the answer is simple. **Publish from the exact same place you logged in.** Publishing directly to Tistory with the local PC's persistent browser profile means:

- The login IP and the publishing IP are always the same (my home internet)
- The act of publishing every day becomes "normal session usage" on its own, which is itself the session refresh
- There's no longer a step where the session gets transmitted anywhere, so there's no chance for it to die in transit

The question then becomes "so why did I build the cloud dashboard in the first place?" Things like registering topics, reviewing/editing drafts, and checking publish status were things I still wanted to be able to do from anywhere, through a web dashboard. So **I split the responsibilities.**

| Role | Owner |
|---|---|
| Register topics, write/edit drafts, check publish status | Cloud (Redis + Vercel dashboard) — unchanged |
| Actual Tistory publishing | Local PC (persistent browser profile) |
| Actual Naver publishing | Cloud serverless — unchanged (session is stable, no problem here) |

The data still lives in the cloud (Redis), and **the local script just becomes one of the clients that reads and writes that data.** Instead of the binary choice of "local CLI backup vs. cloud SaaS," the cloud stays the source of truth, and I just pick whichever publishing executor fits the situation.

## Implementation: The `publish-cloud` Command

The core logic looks like this.

```typescript
export async function publishTodayFromCloud(): Promise<void> {
  const accounts = loadAccounts();
  const userId = accounts.cloudUserId;

  // 1. 클라우드에서 오늘 날짜의 미발행 티스토리 주제만 골라낸다
  const topics = await getCloudTopics(userId);
  const due = topics.filter(
    (t) =>
      t.date === todayKST() &&
      (t.platform === 'tistory' || t.platform === 'both') &&
      !(t.publishedPlatforms ?? []).includes('tistory'),
  );
  if (due.length === 0) return; // 할 일 없으면 조용히 종료 (멱등)

  // 2. 발행 전에 세션부터 확보한다 (만료면 간편로그인 재발급 먼저 시도)
  await ensureTistorySession();

  // 3. 클라우드 초안이 있으면 그대로, 없으면 로컬 생성 후 클라우드에 반영
  for (const entry of due) {
    const draft = await resolveDraft(entry, userId);
    await publishToTistory(draft, accounts.tistory); // 로컬 영구 프로필로 발행
    await markPublished(userId, entry.id);           // 클라우드 상태 갱신
  }
}
```

The part where "if there's already a cloud draft, use it as-is; if not, generate one locally and push it back up to the cloud" matters more than it looks. If I've already polished a draft on the dashboard, it gets respected; if I haven't touched it at all, the local run generates one and reflects it back to the dashboard too. Either way, everything converges on one place (Redis).

## Scheduling: "Just Turn On the Computer, and Publishing Happens Automatically"

The remaining weakness of this setup is obvious. **If the local PC is off, nothing gets published.** That's an unavoidable trade-off, but combining two macOS `launchd` options can noticeably shrink how often it actually matters.

```xml
<key>StartCalendarInterval</key>
<dict>
  <key>Hour</key><integer>8</integer>
  <key>Minute</key><integer>50</integer>
</dict>
<key>RunAtLoad</key>
<true/>
```

- `StartCalendarInterval`: attempt to run every day at 08:50
- `RunAtLoad`: **also run once whenever you log in or boot up**

Using both together means that even if the Mac was asleep at 8:50, publishing catches up the moment you later wake the screen (macOS runs missed scheduled jobs on wake) or the moment you turn it on from being fully off. And the cloud side's publish cron (09:00) already had logic to skip topics that are already published, so if local publishes early, the cloud cron just finds nothing to do and quietly passes. They end up backing each other up without stepping on each other's toes.

## What's Still Unverified

As I'm writing this post, I just overhauled the structure, so **the first automatic run (this morning at 08:50) hasn't happened yet.** What I've confirmed so far is just how it behaves when I run the command manually — whether it exits quietly when there's nothing to publish today, and whether it actually publishes and updates cloud state when there is an unpublished topic. The real test is **whether a post shows up in the morning without a human touching anything.** I'll carry the actual result of that over into the next post.

## Wrap-Up

| Previous approach | This approach |
|---|---|
| Where you log in and where you publish are different (local/remote → serverless) | Publish from right where you logged in (local → local) |
| A "moving" step for the session always exists | No step where the session moves at all |
| When the session dies, start over tracing "why did it die" | Publishing = usage, so there's little chance to die in the first place |
| Local CLI as the cloud's "backup method" | Local CLI as one of the cloud's "executors" (data always stays in the cloud) |

Across several posts, I went looking for ways to keep the session from dying, and ways to revive it once it did — and in the end, the answer was to sidestep the problem entirely. **Once you understand why a system behaves the way it does, designing around that behavior instead of fighting it can end up working far more robustly, with far less code.** Instead of fighting Kakao's security policy, aligning the publishing pipeline with the way that policy is comfortable (keep logging in from the same place) was the most fundamental shift in all the trial and error so far.
