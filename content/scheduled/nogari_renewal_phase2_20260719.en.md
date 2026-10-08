---
title: 'Nogari Renewal (2/5) — Why I Never Let AI Make "Factual Rulings"'
date: '2026-07-19'
publish_date: '2026-12-26'
description: Building a Claude Haiku-powered comment summary for every room, and the caching strategy and disclaimer text designed alongside it
tags:
  - Claude API
  - Anthropic
  - Next.js
  - Supabase
  - AI Summaries
---

## Telling People What's Happening in a Room — in 3 Seconds

Part 1 was about switching the trend score over to a real-time formula. This time it's about the screen that sits on top of that. The spec called for a new visitor landing in a room for the first time to be able to tell "what's being talked about here right now" without reading through 100 comments from scratch.

```text
지금 이 방에서는

- 손흥민의 이적 가능성이 가장 많이 언급되고 있어요.
- 새로운 팀에서의 출전 기회를 기대하는 의견이 많아요.
- 잔류가 더 안정적이라는 반대 의견도 있어요.
```

That's the feature — summarizing recent comments down to 3-4 lines like this. Two things needed careful handling here. First, **never let the AI phrase anything the way a factual ruling would be phrased**. Second, **don't call the LLM on every single page load**.

## Step 1: Banning "Rulings" Starting at the Prompt Level

Comments in an anonymous community are a mix of facts, speculation, and jokes. The moment an AI summary states something flatly — like "Son Heung-min is transferring" — it stops being a summary of community sentiment and turns into AI-generated misinformation. So I nailed this principle down in the system prompt.

```ts
// src/lib/anthropic.ts
export async function summarizeTopicComments(
  topicTitle: string,
  comments: { nickname: string; content: string }[],
): Promise<string[]> {
  const response = await anthropic.messages.create({
    model: SUMMARY_MODEL, // claude-haiku-4-5
    system:
      "너는 익명 커뮤니티 '노가리'의 대화 요약 담당자다. ... " +
      "규칙: 댓글에 나온 '의견'을 요약할 뿐 사실 여부를 판정하는 표현을 절대 " +
      "쓰지 마라('~라고 해요', '~라는 의견이 많아요'처럼 전달 형식으로). " +
      "욕설이나 개인정보는 요약에 옮기지 마라. 각 문장은 60자 이내로 간결하게.",
    messages: [{ role: "user", content: `...` }],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: { points: { type: "array", items: { type: "string" } } },
          required: ["points"],
        },
      },
    },
  });
  ...
}
```

I used `output_config` to force a JSON schema, so the response always comes back strictly as `points: string[]`. Then, right below the summary on screen, I attached a disclaimer — **always, no exceptions**.

```tsx
<p className="mt-2.5 text-xs text-muted-foreground">
  AI가 최근 댓글을 요약한 내용이며 사실과 다를 수 있습니다.
</p>
```

Blocking ruling-style phrasing in the prompt, and wrapping the result in an on-screen disclaimer, aren't substitutes for one another — they're a **double safety net**. No matter how carefully the prompt is written, there's no guarantee the LLM will follow it 100% of the time.

## Step 2: It Can't Be Called Every Time — Designing the Cache Conditions

The second problem was cost and speed. If I gathered the latest 50 comments and called Haiku every time someone entered a room, even a small bump in traffic would be unmanageable. So I built a cache table and set clear regeneration conditions.

```sql
create table ai_summaries (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references topics(id) on delete cascade,
  key_points jsonb not null,
  source_comment_count integer not null, -- 생성 시점의 댓글 수 스냅샷
  created_at timestamptz not null default now()
);
```

I split the display condition and the regeneration condition like this.

- **Display condition**: at least 10 comments in the last 24 hours, or at least 30 comments total (so rooms that are too quiet simply don't show it)
- **Regeneration condition**: 20 new comments have piled up since the last generation, or 30 minutes have passed

```ts
// src/app/api/topics/[id]/summary/route.ts
const cacheFresh =
  cached &&
  Date.now() - new Date(cached.created_at).getTime() < REGEN_INTERVAL_MS &&
  totalCount - cached.source_comment_count < REGEN_COMMENT_DELTA;

if (cached && cacheFresh) {
  return NextResponse.json({ points: cached.key_points });
}
```

The snapshot column `source_comment_count` is the key piece. If you only check "how many minutes have passed," an active room's cache gets milked for way too long. If you only check "how many new comments have come in," a quiet room never regenerates at all. I joined the two conditions with **OR**, so hitting either one triggers a fresh generation.

I also made sure to handle failure gracefully. If the LLM call fails and a new summary can't be generated, **the previous cache gets shown instead.**

```ts
} catch (e) {
  console.error("AI 요약 생성 실패:", e);
  if (cached) {
    return NextResponse.json({ points: cached.key_points, createdAt: cached.created_at });
  }
  return NextResponse.json({ points: null });
}
```

The spec itself had a principle along these lines — "if the AI call fails, show the existing cache or a default message" — and I think this is a pattern you need almost every time you ship an AI feature to production. **You have to design on the assumption that the AI call will fail eventually.**

## Step 3: Don't Block the Page Load

Lastly, instead of prefetching the summary in a server component and shipping it down with the initial HTML, I made it **load asynchronously on the client after mount**.

```tsx
// src/components/topic/TopicAiSummary.tsx
export function TopicAiSummary({ topicId }: { topicId: string }) {
  const [points, setPoints] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/topics/${topicId}/summary`)
      .then((res) => (res.ok ? res.json() : { points: null }))
      .then((data) => {
        if (!cancelled && data.points?.length > 0) setPoints(data.points);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [topicId]);

  if (!points) return null;
  return ( /* ... */ );
}
```

If the cache is fresh, the response comes back quickly. But if regeneration is needed, the Haiku call tacks on a few hundred extra milliseconds. The principle was that this delay must never hold up the overall loading of the room detail page. Even if the summary box shows up late, the comment list and the input box have to appear immediately.

## Bonus: Four Comment Sort Modes and a Duplicate-Room Notice, Same Day

Alongside the AI summary, I also added sorting comments by live/latest/most-liked/most-controversial. The "most controversial" sort uses this formula.

```ts
// 공감·비공감이 모두 많은 댓글을 우선 노출
function controversyScore(c: Comment): number {
  return Math.min(c.like_count, c.dislike_count) + (c.like_count + c.dislike_count) * 0.2;
}
```

The reason for using `min(likes, dislikes)` is simple. A comment with 200 likes and nothing else is "a comment everyone agrees with," not "a controversial comment." A comment is only genuinely divisive when **both** likes and dislikes are high.

And for room proposals, when a similar room already exists, I added a "go to the existing room" button, plus a flow where — if the user still wants to create a new room anyway — they have to write a reason of at least 5 characters. That reason isn't thrown away; it's kept in `topic_meta` so an admin can later use it as grounds for judging "why did this person insist on making a new room."

## Wrap-Up

| Feature | Core design |
|---|---|
| AI summary | Double safety net of prompt + on-screen disclaimer, no ruling-style phrasing |
| Cache strategy | Regenerate on 20 new comments OR 30 minutes elapsed; fall back to the previous cache on failure |
| Loading strategy | No server-side prefetch, async client fetch instead — arriving late is fine, blocking the page isn't |
| Comment sorting | Most-controversial = min(likes, dislikes) + total reactions × 0.2 |
| Duplicate-room UX | "Go to room" button when a similar room is found, with an option to proceed anyway after entering a reason |

Next up is the story of a 500 error I ran into while building a feature that turns a single comment into an image card for social sharing. The cause was unusual enough that it filled an entire post on its own.
