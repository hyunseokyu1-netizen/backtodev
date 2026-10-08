---
title: 'Nogari Renewal (3/5) — A Single Number Broke My Next.js OG Image with a 500'
date: '2026-07-19'
publish_date: '2026-12-27'
description: Debugging a mysterious 500 error from a satori-based next/og ImageResponse, caused by numeric and emoji children, tracked down with binary search
tags:
  - Next.js
  - satori
  - OG Images
  - Debugging
  - Vercel
---

## A Comment-to-Image Sharing Feature, and an Out-of-Nowhere 500

Nogari is the kind of service where, once a comment racks up enough likes, people want to screenshot it and share it on KakaoTalk or an Instagram Story. So I put a share button on every comment, and pressing it generates a square image card containing the logo, room name, nickname, comment, and like count. Next.js's `ImageResponse` (which uses [satori](https://github.com/vercel/satori) under the hood) lets you draw images with JSX, so it didn't look like it would be hard.

I built the admin-only "today's TOP 5" social card the same way and shipped it, but when I actually clicked it, I got a **500 error**. It reproduced identically on local.

```
GET /api/admin/sns-card?format=square 500 in 947ms
⨯ Error: failed to pipe response
  [cause]: Error: Expected <div> to have explicit "display: flex",
  "display: contents", or "display: none" if it has more than one child node.
```

The error message looked clear enough — it's saying "specify display if there's more than one child." But the problem was, **every single `<div>` in my code already had `display: flex` on it.** The error didn't say which div was the culprit, so this is where the real debugging started.

## Step 1: Build a Repro Environment Locally First

It seemed unlikely I'd find the cause from the deployment logs alone, so I spun up a local dev server, pushed through admin auth, and decided to poke at it directly with curl.

```bash
npx next dev -p 3457 > dev.log 2>&1 &

# 관리자 로그인 → 쿠키 저장
curl -s -c cookies.txt -X POST http://localhost:3457/api/admin/login \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"$ADMIN_SECRET\"}"

# 실제 엔드포인트 호출
curl -s -b cookies.txt -o card.png -w "%{http_code}\n" \
  "http://localhost:3457/api/admin/sns-card?format=square"
```

This way, the error stack satori throws lands straight in `dev.log`. Just having an environment where I could iterate much faster than against the deployed environment was already half the battle.

## Step 2: Binary-Searching by Cutting the JSX in Half

Since the error wouldn't tell me which div was at fault, I had to find it myself. The method was simple: **shrink the JSX down to a bare minimum, confirm it returns 200, then binary-search by adding pieces back in little by little.**

First, I stripped it down to just the shell.

```tsx
return new ImageResponse(
  <div style={{ width: "100%", height: "100%", display: "flex", background: "#F4F3F1" }}>
    <div style={{ fontSize: 64 }}>{headline}</div>
  </div>
);
```

→ **200.** The problem is somewhere below this.

I added the header area (logo + date + title) back.

→ **200.** No problem here either.

I added back the part that renders the TOP 5 list by iteration.

```tsx
{items.map((item) => (
  <div key={item.rank} style={{ display: "flex", ... }}>
    <div style={{ fontSize: 52, width: 56 }}>{item.rank}</div>
    <div style={{ fontSize: 46, flexGrow: 1 }}>{item.title}</div>
    <div style={{ fontSize: 32, color: "#6B6862" }}>{`댓글 ${item.count}`}</div>
    <div style={{ fontSize: 34, color: "#D9480F" }}>{`🔥${item.flame}`}</div>
  </div>
))}
```

→ **500.** The culprit is in here.

Now I deleted these four children one at a time to see which one could be dropped. With only `item.title` left, it passed. The moment I brought `item.rank` back, the 500 reappeared.

```tsx
<div style={{ fontSize: 52, width: 56 }}>{item.rank}</div>
```

`item.rank` was a **number** made from `i + 1`. I tried turning it into a string.

```ts
const items = topics.map((t, i) => ({
  rank: String(i + 1),  // 숫자 → 문자열
  ...
}));
```

→ **200.** Found it.

## The Cause: satori Only Likes "One Child = One String"

satori is a library that renders React elements as SVG, and it has a quirk where, when counting a div's children, **anything that isn't a single string literal gets treated as multiple nodes.** So all of the following turned out to be landmines.

```tsx
{/* 숫자 타입 자식 — 지뢰 */}
<div>{item.rank}</div>          // rank: number

{/* 텍스트 + 표현식 혼합 — 지뢰 (JSX가 자식을 ["댓글 ", count] 두 개로 쪼갬) */}
<div>댓글 {item.count}</div>

{/* 이모지 포함 텍스트 — 자식은 문자열 1개인데도 지뢰가 될 수 있음 */}
<div>🔥 {item.flame}</div>
```

Emoji can be rendered internally by satori as a separate image node, so even something that looks like "one string" can end up being treated as text and emoji split into separate children. So I converted every number to a string ahead of time, merged text+variable combinations into one string with template literals, and additionally pinned an explicit `display: "flex"` on any div containing emoji.

```tsx
const items = topics.map((t, i) => ({
  rank: `${i + 1}`,
  title: t.title.length > 14 ? `${t.title.slice(0, 14)}…` : t.title,
  count: `댓글 ${t.comment_24h_count ?? 0}`,      // 템플릿 리터럴로 통일
  flame: `🔥 ${Math.max(0, Math.round(t.trending_score ?? 0))}`,
}));

// JSX에서는 항상 변수 하나만 그대로 출력
<div style={{ fontSize: 52, width: 56 }}>{item.rank}</div>
<div style={{ fontSize: 32, color: "#6B6862" }}>{item.count}</div>
<div style={{ display: "flex", fontSize: 34, color: "#D9480F" }}>{item.flame}</div>
```

The same pattern was hiding in the comment-share card too. Only after I converted every spot that put quote marks right next to a variable — like `` `“{content}”` `` — and every spot that mixed emoji with a variable — like `` `👍 {likeLabel}` `` — into template literals did both cards (square/story) and the comment card all go back to returning 200.

## Step 3: Don't Forget Numbers in the Font Subset Either

One more thing worth noting. Nogari doesn't bundle the full Korean font — it fetches a subset of only the characters actually drawn on screen, via Google Fonts' `text=` parameter.

```ts
export async function loadKoreanFont(text: string): Promise<ArrayBuffer> {
  const unique = Array.from(new Set(text)).join("");
  const cssRes = await fetch(
    `https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@700&text=${encodeURIComponent(unique)}`,
  );
  ...
}
```

This approach keeps the font file light, but it comes with a responsibility: **the subset string has to actually include every character being drawn on screen.** The TOP 5 card is full of numbers — rank, comment count, flame score — and if you leave these out of the subset source string, the numbers alone render as broken tofu boxes.

```ts
const font = await loadKoreanFont(
  headline + dateLabel + urlLabel +
  "노가리댓글 0123456789…" +   // 숫자·특수문자 글리프를 명시적으로 포함
  items.map((i) => i.title).join(""),
);
```

## Wrap-Up

| Symptom | Cause | Fix |
|---|---|---|
| 500 about `display: flex`, without saying which div | satori treats numeric/mixed-text children as multiple nodes | Narrowed the repro by binary-searching through the JSX, cutting it in half each time |
| `{item.rank}` (a number) | A child of number type doesn't count as a single string | Stringify it ahead of time with `${i + 1}` |
| `댓글 {count}` | Text + expression gets split into 2 children | Unify with a template literal: `` `댓글 ${count}` `` |
| `🔥 {flame}` | Emoji can render as a separate node | Template literal + explicit `display: flex` on the emoji div |
| Numbers rendering as tofu boxes | Numeric glyphs missing from the font subset | Explicitly include things like `0123456789` in the subset source string |

The most valuable thing from this round of troubleshooting wasn't the cause itself but the **approach**. When an error message won't tell you where it's coming from, building a local repro command and narrowing it down by cutting the JSX in half beats staring at deployment logs and guessing, by a wide margin. This approach carries over directly to pretty much any rendering bug where "there's an error, but I don't know where" — not just satori.

The next post covers growth features built to give people "a reason to come back" to a login-free service — saving favorite rooms, recent visits, and a question of the day.
