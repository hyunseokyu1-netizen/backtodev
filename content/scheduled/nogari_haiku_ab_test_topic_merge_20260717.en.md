---
title: "Wondering 'Should I Keep Using Opus?' — How I Ran My Own A/B Test to Downgrade the Model"
date: '2026-07-17'
publish_date: '2026-12-10'
description: Before swapping Opus for Haiku in comment moderation, I ran my own accuracy comparison script to decide — plus the duplicate-room merge feature I built the same day
tags:
  - Claude API
  - Anthropic
  - LLM Moderation
  - Next.js
  - Supabase
---

## "Wait, Is It Actually Fine to Keep Using Opus?"

Every time a comment goes up on Nogari, an LLM filters it for profanity and abuse. When I first built it, I didn't think much about it and just hooked up the smartest model (Opus). But now, before traffic has grown, it suddenly occurred to me to wonder.

> "Wait, am I really using Opus for comment moderation? How much is that costing me? Would Haiku be better?"

Answering this question required two things. One was **how much I was actually spending**, and the other was **how much quality would drop if I downgraded the model.** Instead of going on gut feeling, I checked both directly.

## Step 1: Check Actual Usage First

To talk about cost, I first needed to know the traffic scale. Querying the DB, Nogari had 140 total comments, and the seed cron was creating about 10 rooms a day. It's still early stage, so the absolute cost itself isn't large, but it seemed right to check in advance "what happens if traffic grows 10x or 100x with this same structure."

Lifted straight from the Anthropic pricing page:

| Model | Input (1M tokens) | Output (1M tokens) |
|---|---|---|
| Claude Opus | $5 | $25 |
| Claude Haiku | $1 | $5 |

Exactly a 5x difference. For a high-call-frequency feature like comment moderation, that multiplier translates directly into the monthly cost difference.

## Step 2: Don't Judge "Is the Accuracy the Same" by Gut Feeling

Downgrading based on cost alone is risky. The moment the moderation model starts producing false positives (blocking a normal comment) or false negatives (letting profanity through) on edge cases, the service's trust breaks instantly. So I gathered actual **edge cases that pass the regex first-stage filter** and built a comparison script that asked Opus and Haiku the exact same questions.

I put together the test cases like this:

- 5 profanity cases — expressions that dodge regex via consonant-only shorthand or variants (censorship-evading versions in the vein of Korean profanity terms)
- 2 non-profane criticism cases — sharply worded but with no profanity, the "this should pass" cases

These are exactly the cases that don't get filtered by regex alone and have to go all the way to an LLM judgment — the precise edge cases that actually trip things up in the live service. Both models got 7/7 correct on these 7 cases. And on top of that, Haiku responded faster. That secured the evidence that I could cut the cost down to a fifth with no accuracy loss at all.

```ts
// src/lib/anthropic.ts
-const SIMILARITY_MODEL = "claude-opus-4-8";
-const MODERATION_MODEL = "claude-opus-4-8";
+// 트래픽이 늘어나기 전(테스트 기간) 비용을 감당 가능한 수준으로 두기 위해
+// Haiku로 낮춰서 시작한다 — 댓글 검열은 정규식 1차 필터를 통과한 애매한
+// 케이스(욕설 5종 + 욕설없는 비판 2종)로 Opus와 직접 비교했을 때 정확도
+// 차이가 없었다(둘 다 7/7). 트래픽이 커지고 오탐/미탐이 늘면 그때 재검토.
+const SIMILARITY_MODEL = "claude-haiku-4-5-20251001";
+const MODERATION_MODEL = "claude-haiku-4-5-20251001";
```

Four functions got changed. Comment moderation (`moderateComment`), re-reviewing reported content (`reviewReportedContent`), seed comment generation (`generateSeedComment`), and checking room title duplicates (`checkTopicSimilarity`). I left comments in all of them explaining "why I switched to Haiku" and "when to revisit this (once traffic grows and false positives/negatives increase)." The bare minimum courtesy for my future self (or some other developer) who'll run into this decision again later.

The lesson I took from this is one thing: **don't make the decision to downgrade a model based on "this should be good enough" — gather the cases most likely to actually fail, verify with an A/B test, and leave that evidence in the code.** If false positives show up later once traffic grows, that same piece of evidence becomes the reference point for judging "it was right back then, but the situation has changed now."

## A Feature Built the Same Day: Letting Admins Merge Duplicate Rooms

While working on the Haiku switch, a problem naturally came to mind. Nogari's seed cron automatically creates rooms every day, and sometimes a room pointing to the same target (say, the same person or event) gets created twice, just worded differently. Leaving this alone splits the conversation across two rooms and weakens the community effect.

So I built a merge feature based on the requirement "let the admin merge duplicate rooms when they show up."

### Schema: One Column to Record Merge History

```sql
-- supabase/migrations/0024_topic_merge.sql
alter table topics add column merged_into_id uuid references topics(id);
```

The room that disappears into a merge isn't deleted. Instead, its status gets changed to `EXPIRED` and `merged_into_id` keeps the id of the surviving room. That way, even someone who comes in through that room's URL can be shown a "This room has been merged" notice and linked to the new room.

### API: Why I Used POST Instead of PATCH

`/api/admin/topic-merge` isn't a simple status change — it's an operation with big side effects that actually moves comments around, so I judged POST to be semantically more correct than PATCH.

```ts
// src/app/api/admin/topic-merge/route.ts
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { keepId, mergeId } = await request.json();
  // ...유효성 검사...

  const admin = createAdminClient();

  // 댓글을 복사가 아니라 실제로 이동시킨다 — 작성 시각, 공감 수 등이
  // 그대로 유지된다
  await admin
    .from("comments")
    .update({ topic_id: keepId })
    .eq("topic_id", mergeId);

  // last_comment_at은 댓글 insert 트리거로만 갱신되는데, 여기서는 새 댓글을
  // 만드는 게 아니라 topic_id만 옮기는 거라 트리거가 안 붙는다 — 병합된
  // 댓글까지 반영해서 직접 재계산한다.
  const { data: latestComment } = await admin
    .from("comments")
    .select("created_at")
    .eq("topic_id", keepId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestComment) {
    await admin
      .from("topics")
      .update({ last_comment_at: latestComment.created_at })
      .eq("id", keepId);
  }

  await admin
    .from("topics")
    .update({ status: "EXPIRED", merged_into_id: keepId })
    .eq("id", mergeId);

  return NextResponse.json({ ok: true });
}
```

Two things are worth noting here.

1. **Comments are moved, not copied.** Only `topic_id` gets swapped out, so the created time and like count stay exactly as they were. No new data gets created, which leaves little room for consistency to break.
2. **Side effects a trigger can't catch get handled by hand.** The `last_comment_at` column was originally designed to update only via a trigger "when a new comment gets inserted." But a merge is an update, so that trigger never fires. This kind of "blind spot a trigger doesn't cover" is easy to miss — I only noticed it after checking the screen post-merge and seeing the latest comment time hadn't updated.

I also cleaned up any open reports on the room being merged away, closing them as RESOLVED with a resolution note of "judged as a duplicate room, processed as a merge."

### UI: A Form for Searching and Picking Two Rooms

I added a `TopicMergeForm` to the admin page (`/admin/topics`) so searching for and selecting two rooms sends a merge request right away. I used Base UI's Dialog component to pop up a confirmation window, guarding against accidentally merging the wrong rooms.

After the feature was fully built, I actually created 2 test rooms and ran the entire merge flow (search → select → confirm → comments move → original room marked EXPIRED → detail page notice copy) end-to-end with Playwright. For an admin feature with side effects this big, something always ends up off if you just review the code and move on.

## Summary of Frequently Used Patterns

| Situation | How to decide |
|---|---|
| Wondering whether it's okay to downgrade a model | Gather the boundary cases most likely to actually fail, A/B test, leave the result as evidence in a code comment |
| Building an admin feature that moves data | Move rather than copy; manually recompute derived columns (counts, latest timestamps, etc.) that a trigger doesn't cover |
| HTTP method for a status-change API | If side effects are large, consider a more semantically clear POST over PATCH |
| Merging instead of deleting | Record history with a status flag + reference column instead of an actual delete |

## Wrap-Up

The decision to switch from Opus to Haiku actually looks pretty trivial on its own — it's just changing two constant lines. But the process of actually answering the question "is it okay to switch?" — checking real usage, comparing pricing, A/B testing with edge cases — took more work than expected. In exchange, I ended up with evidence I can point to immediately the next time someone asks "wait, why are we using Haiku for this?"

And the room merge feature I built the same day was a reconfirmation of patterns I'll keep running into when building admin tools — "move comments, don't copy them," "manually recompute derived columns a trigger misses." Neither one is a flashy feature, but I think it's exactly this kind of "habit of leaving evidence behind" and "habit of tracking side effects all the way through" that, over time, ends up making the difference in whether a service keeps running smoothly for the long haul.
