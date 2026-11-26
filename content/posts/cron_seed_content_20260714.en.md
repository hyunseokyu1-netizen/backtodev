---
title: 'Solving the Empty Community Problem With Vercel Cron + AI — and Getting Caught Looking Fake'
date: '2026-07-14'
publish_date: '2026-11-27'
description: Building an automated comment-seeding pipeline to keep a community from looking dead before real users arrive, and fixing the giveaway where every seeded comment had the exact same timestamp
tags:
  - Vercel Cron
  - Claude API
  - Supabase
  - Next.js
  - Cold Start
---

## Nobody Comes to an Empty Community

Anyone who's built a community product knows this problem well. **You need people for people to show up, but if there's no one there, nobody comes.** A visitor walks in, sees an empty board, and leaves on the spot. But the first user is exactly the person who has to write the very first post into that emptiness. This vicious cycle is called the cold-start problem.

My side project (an anonymous community called "Nogari") already has roughly 300 National Assembly members plus rooms for objects/brands/events seeded in, but if a room only has a title and no comments, it still looks like a dead space. I could sit down every day and type a few comments in by hand, but that's not sustainable. So I built **a pipeline that automatically fills quiet rooms with comments on a schedule.**

## Design — "Fake Activity," But Safely

This feature is inherently sensitive by nature. An AI is unattended, writing content into a real production DB on a regular schedule. Get the design wrong, and something off-the-wall could end up posted automatically. So I layered on several safeguards:

1. **Exclude rooms about real people.** Politician and celebrity rooms (`POLITICIAN`, `PERSON`) are entirely excluded from auto-generation; only objects/brands/events (`OBJECT`, `BRAND`, `EVENT`) get touched. If an AI keeps generating content unsupervised about a real person, there's a risk that sooner or later a sentence comes out that's factually wrong or borders on defamation — so I blocked that risk off entirely at the category level.
2. **Generated content goes through the exact same moderation as real user comments.** I reused the existing two-stage moderation (`moderateContent`) as-is. No free pass just because the AI wrote it.
3. **Authenticate with `CRON_SECRET`.** Without verifying the secret value Vercel Cron attaches to its requests, anyone outside could hit this endpoint and generate an unlimited number of comments.
4. **Build the off switch first.** Once real users start showing up, this feature needs to be turned off. I pre-planted a single environment variable (`SEED_CRON_ENABLED=false`) that can shut it down instantly.

## Step 1 — The Comment Generation Function

I added a function to the existing `src/lib/anthropic.ts` that generates a single short comment:

```ts
export async function generateSeedComment(
  topicTitle: string,
  topicType: string,
): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODERATION_MODEL,
    max_tokens: 200,
    system:
      "너는 익명 커뮤니티에서 잡담을 남기는 평범한 유저다. " +
      "주제에 대해 짧은 댓글 하나를 한국어 반말/구어체로 자연스럽게 써라.\n" +
      "규칙: 1~2문장, 이모지 금지, 실존 인물 명예훼손·허위사실 금지, " +
      "광고성 문구 금지, 평범한 개인 의견 수준으로.",
    messages: [{ role: "user", content: `주제 유형: ${topicType}\n주제: ${topicTitle}` }],
  });
  // ...텍스트 블록 추출
}
```

The key point is nailing down **"at the level of an ordinary personal opinion"** in the system prompt. Excluding exaggerated meme-speak or extreme opinions is what makes it blend in without feeling off once it's mixed in among real user comments later.

## Step 2 — The Cron Route: Picking Out the Quiet Rooms First

```ts
// app/api/cron/seed-comments/route.ts
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (process.env.SEED_CRON_ENABLED === "false") {
    return NextResponse.json({ skipped: "disabled" });
  }

  const { data: topics } = await admin
    .from("topics")
    .select("id, title, topic_type")
    .eq("status", "ACTIVE")
    .in("topic_type", ["OBJECT", "BRAND", "EVENT"])
    .order("last_comment_at", { ascending: true, nullsFirst: true })  // 가장 오래 조용했던 방부터
    .limit(3);

  for (const topic of topics ?? []) {
    const content = await generateSeedComment(topic.title, topic.topic_type);
    const decision = await moderateContent(content);          // 재검열
    if (decision.blocked) continue;

    const deviceHash = `cron-seed:${randomUUID()}`;
    const nickname = deriveAnonNickname(topic.id, deviceHash); // 기존 로직 재사용

    await admin.from("comments").insert({ topic_id: topic.id, anon_nickname: nickname, content });
    await admin.from("comment_authors").insert({ comment_id: comment.id, device_hash: deviceHash });
  }
}
```

Sorting ascending by `last_comment_at` matters more than it looks. Instead of always filling the same popular rooms, it becomes **a rotation that revives whichever room has been quiet the longest, spreading things out evenly.**

Nicknames aren't generated separately — I reuse the existing `deriveAnonNickname(topicId, deviceHash)` as-is. Since the nickname comes out through exactly the same rule as the real anonymous-user system, it's indistinguishable from a real user on the surface.

## Step 3 — Registering a Vercel Cron and Plan Constraints

Writing a schedule into `vercel.json` is all it takes:

```json
{
  "crons": [{ "path": "/api/cron/seed-comments", "schedule": "0 3 * * *" }]
}
```

One thing to watch out for here — **Vercel's personal (Hobby) plan limits cron to once a day.** Pushing up a frequent schedule like `*/30 * * * *` on a personal plan gets blocked at deploy time. If you're not sure, it's safer to start at once a day and bump the plan later if you need more frequency.

Instead of putting `CRON_SECRET` in code, I registered it straight into the production environment variable via the CLI:

```bash
openssl rand -hex 32 | vercel env add CRON_SECRET production
```

After deploying, I checked that the cron actually got registered with `vercel crons ls`:

```
$ vercel crons ls
  Path                       Schedule
  /api/cron/seed-comments    0 3 * * *
```

I also confirmed on both local and production that hitting the endpoint without auth returns 401. Not just deploying and assuming "it'll probably work," but actually poking at both the success path and the failure path, matters especially for this kind of unattended automation.

## Step 4 — Thought It Was Done, But It Was Giving Itself Away

After deploying the feature and looking around the rooms, I noticed something odd. Some rooms had all 5 comments posted **within the same single minute.** Checking the DB made it worse:

```
2026-07-13T13:42 -> 25 개
2026-07-12T05:46 -> 23 개
2026-07-12T14:22 -> 14 개
```

Running one seeding script inserts 10-20 comments in the span of a few seconds, so `created_at` all gets stamped as "right now." A person could spot this problem in 5 seconds — **a real community doesn't get comments all piling up at once.**

The fix was a backfill script that scatters `created_at` into something plausible:

```ts
const rand = (min: number, max: number) => min + Math.random() * (max - min);

for (const [topicId, topicComments] of byTopic) {
  const topicStart = now - rand(1, 14) * 86_400_000; // 방마다 1~14일 전 중 랜덤 시작점
  let cursor = topicStart;
  const newTimeById = new Map<string, number>();

  for (const c of topicComments) {
    let t: number;
    if (c.parent_id && newTimeById.has(c.parent_id)) {
      const parentTime = newTimeById.get(c.parent_id)!;
      // 답글은 반드시 부모보다 뒤 시간
      t = Math.max(cursor + rand(15, 600) * 60_000, parentTime + rand(3, 360) * 60_000);
    } else {
      t = cursor + rand(15, 600) * 60_000; // 다음 댓글까지 15분~10시간 랜덤 간격
    }
    newTimeById.set(c.id, t);
    cursor = Math.max(cursor, t);
    // updates 배열에 push...
  }
}
```

Two things I paid attention to here:

- **A reply must always have a later timestamp than its parent comment.** Otherwise you get a time-travel bug like "the reply landed 3 hours before the original comment." I prevented this by setting `parentTime + a random interval` as a floor.
- **Each room gets its own independently randomized "activity start point."** If every room looked like it started being active on the exact same day, that would give it away too.

And it's not just a matter of changing `comments.created_at`. The "N today" count on the room list and the trending sort are based on `topics.last_comment_at`, which is a value a trigger auto-fills at the moment a comment is inserted — so even after the backfill, it stays stuck on "just now." So after scattering the timestamps, I had to **re-aggregate the latest comment time per room and update `last_comment_at` along with it** to keep everything consistent.

I verified the work in two ways afterward:

```
서로 다른 '분' 단위 개수: 84 / 전체 84   ← 완전히 해소
✅ 모든 답글이 부모보다 뒤 시간          ← 무결성 확인
```

## Troubleshooting Summary

| Symptom | Cause | Fix |
|---|---|---|
| Cron deploy failed (schedule rejected) | Personal plan limits cron to once a day | Started with `0 3 * * *`, upgrade plan later if needed |
| N comments in the same room all land in the same minute | The seeding script inserts in a loop in an instant | Redistributed with a random start point per room plus cumulative random intervals |
| A reply timestamped earlier than its parent | Parent-child relationship wasn't considered when re-randomizing | Forced `parentTime + buffer time` as a floor |
| The "N today" count didn't add up | `last_comment_at` is only updated by the trigger, left stale after backfill | Recomputed and separately updated the latest timestamp per room after the backfill |

## Wrap-Up

1. **A cold start needs to be solved with a pipeline, not by hand** — filling it in manually every day doesn't scale
2. **The more unattended the automation, the more the safeguards need to be designed first** — excluding real people, re-moderation, authentication, and an off switch were all decided before the feature itself
3. **Reusing existing logic means fake and real become indistinguishable** — nickname generation and moderation both run through the exact same functions as the real user path
4. **A fake dataset's biggest weak point is its timestamps** — the content can be convincing, but "generated all at once" shows up in the timing
5. **Derived data (aggregate columns) needs to be fixed too** — fixing `created_at` and forgetting `last_comment_at` is only half a fix

Right now this pipeline is quietly cycling through a few hundred rooms a day, keeping them filled, and once real users actually start coming in, I plan to switch it off with a single environment variable. Building as smooth a bridge as possible from "starting out fake" to "becoming real" was the goal of this work.
