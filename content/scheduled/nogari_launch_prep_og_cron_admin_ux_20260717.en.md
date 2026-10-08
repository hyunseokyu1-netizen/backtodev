---
title: 'Final Checks Before Launch — OG Images, Redundant Cron Jobs, and Admin UX Polish'
date: '2026-07-17'
publish_date: '2026-12-11'
description: A pre-launch checklist for Nogari — fixing share cards, preventing missed cron runs, and cleaning up stale reports and character limits in the admin screen
tags:
  - Next.js
  - Vercel
  - GitHub Actions
  - Supabase
  - OG Image
---

## A Checklist That Started From "How Do I Even Promote This?"

It felt like it was about time to start getting the word out about Nogari to communities, so I thought through how to promote it. I landed on the conclusion that, rather than spamming journalists by email, what mattered first was seeding it naturally into communities and making sure it looked legit when shared over KakaoTalk. So starting from "let's do the OG work first," I spent a whole day running through a final pre-launch check.

This post bundles up the four things I handled that day.

1. Putting the room photo and activity level into the KakaoTalk share card (OG image)
2. Making the Vercel cron that occasionally skipped a day redundant with GitHub Actions
3. Adjusting the character limit to prevent comment spam
4. Adding filtering and search to the admin reports screen

Each one looks small on its own, but once you assume "someone's actually going to come in and use this," every single one turns out to be something you can't skip.

## Step 1: Putting the Room Photo and Comment Count Into the OG Image

The preview card that shows up when you share a link in KakaoTalk was flat, with nothing but text. I decided to add the room photo (including politician profile photos) as a circle, and for active rooms, show a "N comments so far" line to signal that this is a place where conversation is already happening.

The important thing here is that **you can't just drop a remote image straight into OG rendering.** Pass an external URL that might not always be alive directly into satori (Next.js's OG image generator), and the moment that URL dies, the entire OG image breaks with a 500 error. It's not just that one card fails to show up — sharing that room breaks completely.

So I made the server pre-fetch the image, convert it to a data URI, and silently fall back to a photo-less layout if it fails.

```ts
// src/app/topics/[id]/opengraph-image.tsx

/**
 * 방 사진을 미리 받아 data URI로 변환한다. satori에 원격 URL을 그대로 주면
 * 그 URL이 죽었을 때 OG 이미지 전체가 500으로 깨지므로, 실패하면 사진 없는
 * 레이아웃으로 넘어가게 null을 반환한다.
 */
async function fetchImageAsDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentTypeHeader = res.headers.get("content-type") ?? "image/jpeg";
    if (!contentTypeHeader.startsWith("image/")) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    // OG 응답이 너무 무거워지지 않게 원본 4MB 초과는 사진 생략
    if (buffer.byteLength > 4 * 1024 * 1024) return null;
    return `data:${contentTypeHeader};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}
```

I only queried the comment count for active rooms, and swapped in the subcopy accordingly.

```ts
const sub = isPending
  ? "함께 동의하면 방이 열려요"
  : commentCount > 0
    ? `지금까지 노가리 ${commentCount}개 · 익명으로 참여`
    : "익명으로 노가리 까는 곳";
```

There's one core principle here: **the moment an external dependency enters the picture, make sure that if it fails, only a part gets omitted — not the whole thing dying.** A feature like an OG image, where the worst case should be "it just doesn't look as nice," should never escalate into "the link itself is broken." I verified this locally by rendering both a room with a photo and one without before deploying.

## Step 2: Discovering the Cron Skips a Day and Making It Redundant

Casually checking "did the cron run?" turned up a real problem. The seed cron scheduled for noon on July 16 just hadn't run. I'd directly experienced, firsthand, that a cron on the Vercel Hobby plan can fail to fire at exactly its scheduled time.

The fix was "wire this up to both Vercel and GitHub Actions for redundancy." But simply running two schedulers in parallel creates a new problem — **on days when both succeed, the seed gets inserted twice.** So I first needed a guard that records whether a run happened and blocks duplicate execution.

I reused the existing `rate_limit_events` table (originally for limiting how often a user could request something) and added logic to the endpoint that skips the run "if there's an execution record within the last 20 hours."

```ts
// src/app/api/cron/seed-comments/route.ts

// Vercel Hobby 크론이 하루씩 빼먹는 일이 있어 GitHub Actions가 40분 뒤에
// 백업으로 같은 엔드포인트를 호출한다. 둘 다 성공한 날 시드가 두 번 들어가지
// 않도록, 실행 기록(rate_limit_events 재활용)을 남기고 최근 20시간 내
// 기록이 있으면 스킵한다. 수동 테스트는 ?force=1로 가드를 우회할 수 있다.
const force = request.nextUrl.searchParams.get("force") === "1";
const GUARD_HOURS = 20;
if (!force) {
  const since = new Date(Date.now() - GUARD_HOURS * 3_600_000).toISOString();
  const { count } = await admin
    .from("rate_limit_events")
    .select("*", { count: "exact", head: true })
    .eq("device_hash", "cron:seed-comments")
    .eq("action", "CRON_SEED")
    .gte("created_at", since);
  if ((count ?? 0) > 0) {
    return NextResponse.json({ skipped: "already ran recently" });
  }
}
// 기록은 시드 시작 전에 남긴다 — 두 스케줄러가 거의 동시에 호출해도
// 뒤따라온 쪽이 가드에 걸릴 확률을 최대화
await admin
  .from("rate_limit_events")
  .insert({ device_hash: "cron:seed-comments", action: "CRON_SEED" });
```

The key point is **recording the run "before" the seed job starts**, not after. If the record gets written only after the seed job finishes, two schedulers arriving nearly simultaneously could both pass through without seeing each other's record. Stamping the record first makes it far more likely that whichever one arrives second gets caught by the guard.

On the GitHub Actions side, I built a workflow that calls the same endpoint at UTC 03:40, 40 minutes after the Vercel cron's scheduled time (UTC 03:00).

```yaml
# .github/workflows/cron-seed-backup.yml
name: cron-seed-backup

on:
  schedule:
    - cron: "40 3 * * *" # UTC 03:40 = KST 12:40
  workflow_dispatch: # 수동 실행용

jobs:
  trigger:
    runs-on: ubuntu-latest
    steps:
      - name: Call seed-comments endpoint
        run: |
          code=$(curl -s -o /tmp/res.json -w "%{http_code}" \
            --max-time 290 \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            "https://nogari.org/api/cron/seed-comments")
          echo "HTTP $code"
          cat /tmp/res.json
          test "$code" = "200"
```

I registered `CRON_SECRET` with `gh secret set` so it never gets exposed in the repository. And I didn't just build it and stop — I manually triggered it with `workflow_dispatch` and personally confirmed that the guard actually returns an "already ran recently" skip response. A redundancy mechanism is scariest when it "stays invisible most of the time and silently fails exactly when you actually need it," so I think it's right to deliberately force-trigger it once you've built it.

## Step 3: The Comment Character Limit — There's No Right Answer, So I Adjusted Fast

While looking at a spam-style test comment (a lorem-ipsum-like wall of text filling the whole screen) in a screenshot, I thought "1000 characters seems like way too many." So I cut it to 500. But looking at the screen again, 500 still looked like too many. So I cut it to 333. The commit log, lifted verbatim:

```
42ebc3e feat: 댓글 입력창 글자 수 카운터 + 소개 페이지에 1,000자 제한 안내
abc1b76 fix: 댓글 글자 수 제한 1000자 → 500자로 축소
ff3c40d fix: 댓글 글자 수 제한 500자 → 333자
0878924 fix: 댓글 글자 수 카운터를 처음부터 상시 노출
```

I cut the number twice in a row within 30 minutes. It felt a little embarrassing at first, but thinking about it, **"the right character limit" isn't a value you calculate — it's one you develop a feel for by actually looking at the screen.** As long as there's direction — "Nogari's concept is short, hit-and-run chatter" — bumping into it a few times to find the exact number is actually the faster way.

Every time I changed it, I had to update three places together — server validation, the input's `maxLength`, and the explainer copy on the intro page.

```ts
// src/app/api/comments/route.ts
// 1000자로 시작했다가 한 댓글이 모바일 화면을 통째로 차지하는 걸 보고 축소.
// 짧게 치고 빠지는 수다가 컨셉이라 333자로 제한한다.
const MAX_CONTENT_LENGTH = 333;
```

```tsx
// src/components/topic/CommentInput.tsx
const MAX_LENGTH = 333; // /api/comments의 MAX_CONTENT_LENGTH와 동일해야 함
```

I'd originally made the character counter "only show up starting from the halfway point (167 characters), so it doesn't get in the way for short comments" — but working through the question "should I just show it from the start?", I concluded that once the limit itself had shrunk to 333, there was no real reason to hide it, and switched it to always-visible.

```tsx
// 카운터는 maxLength로 조용히 잘리기 시작할 때 유저가 이유를 알 수
// 있게 붙였다 — 한도가 짧아서(333자) 처음부터 상시 노출
<p
  className={
    content.length >= MAX_LENGTH
      ? "shrink-0 text-xs font-medium text-destructive"
      : "shrink-0 text-xs text-meta"
  }
>
  {content.length}/{MAX_LENGTH}
</p>
```

The lesson here: for a UX number like a limit, where there's no right answer, **it's better to converge on it quickly rather than trying to find the perfect number from the start.** What mattered more was making sure every place that value gets used — server validation, client-side limit, explainer copy — gets updated together, without missing a single one.

## Step 4: Admin Reports Screen — Don't Let It Get Buried in Resolved Reports

Looking at a screenshot of the report management page, I found yet another problem. As resolved reports kept piling up, the unresolved reports I actually needed to see were getting pushed down and out of view. I'd originally split it into a "pending review" section on top and a "resolution history" section below, but that meant the scroll length kept growing as the history got longer.

I changed it so the default view shows only unresolved reports, switching to Resolved/All and keyword search only when needed.

```tsx
// src/app/admin/reports/page.tsx
const FILTER_TABS = [
  { value: "open", label: "미처리" },
  { value: "done", label: "처리됨" },
  { value: "all", label: "전체" },
] as const;
```

Search sweeps across the report target, reason, resolution, and even the AI's judgment rationale all at once.

```tsx
const visibleReports = reports.filter((r) => {
  const isOpen = STATUS_META[r.status].open;
  if (filter === "open" && !isOpen) return false;
  if (filter === "done" && isOpen) return false;
  if (q) {
    const haystack = [
      r.targetLabel,
      r.reason,
      r.resolution,
      r.ai_reason,
      STATUS_META[r.status].label,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(q.toLowerCase())) return false;
  }
  return true;
});
```

I managed filter state through the query string (`?f=done&q=searchterm`), so the state stays intact even if you share the link as-is or refresh the page. It's not that a new screen got created — the screen that was already there turned into one "an admin could actually stand to look at every day."

## One More Small Thing: Type Chip Wrapping to Horizontal Scroll

There was one more small fix I handled the same day. The home screen's "hot Nogari rooms" type filter has 6 chips (including "All"), and on narrow screens, wrapping to a new line left the last chip ("Other") sitting alone, orphaned on the next row. I switched from wrapping to horizontal scroll so it always stays on one line. It's only a few lines of code, but this is exactly the kind of problem you only discover by actually tapping through it on a phone, so I'm keeping it on the list.

## Wrap-Up

The four things I touched before starting to promote this all had a very different character.

| Task | Problem | Guiding fix |
|---|---|---|
| OG image | Card was flat, text only | Pre-fetch external images into data URIs, so the whole thing doesn't break even if that fails |
| Cron redundancy | Vercel Hobby cron occasionally skipped a day | Added a backup scheduler + an execution-record-based duplicate-prevention guard |
| Character limit | Long spam comments filled the screen | Converge quickly on a value with no right answer, and sync every place it's used without missing one |
| Report filter | Unresolved reports got buried under resolved ones | Default to "what needs attention right now," push the rest behind filter/search |

There was one thing in common: every single one was a check on whether "a feature I'd already built actually holds up once real people use it." I felt once again that it's finishing work like this, more than flashy new features, that actually decides whether a service is ready to open to the public.
