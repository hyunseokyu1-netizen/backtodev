---
title: 'What I Learned Turning an AI Design Handoff into Code — Monochrome Design System, Tailwind Token Pitfalls, and a Trending Algorithm'
date: '2026-07-12'
publish_date: '2026-11-13'
description: Rebuilding an HTML design handoff in code, falling into the Tailwind 4 @theme inline trap, trimming duplicate CTAs, and seeding Wikimedia images — a one-day side project renewal log
tags:
  - Tailwind CSS
  - Next.js
  - Design System
  - Supabase
  - Claude Code
---

I finally put a proper design onto Nogari, the anonymous community I'm building as a side project. Over the course of one day, I took a design handoff bundle and renewed the entire site, and here I'm writing up the stumbling and the lessons from that process.

## The Thing Called a Design Handoff

Up until now, Nogari had just been running shadcn's default styling. Everything worked, but it had that unmistakable "a developer made this" look to it. What I received this time was a design reference bundle built in HTML. The structure was interesting:

- `README.md` — design tokens (5 colors, typography, borders, shadows) written up as a spec
- `*.dc.html` — the actual design, viewable in a browser (main screen / detail / style guide)
- `nogari-icon.svg` — the original logo SVG
- `screenshots/` — captures of the finished screens

The key was this sentence in the README: **"This is not production code and is not meant to be copy-pasted as-is. Reimplement it using the existing codebase's patterns and libraries."** In other words, this wasn't about copy-pasting HTML — it was about reading the design tokens and rules and re-dressing the existing component structure in new styling.

The design concept was fairly bold:

| Rule | Content |
|---|---|
| Colors | ink (#1A1A1A), paper (#F4F3F1), card (#FFF), muted, line — **exactly 5, no more** |
| Banned | Gradients and emoji, both entirely banned |
| Borders | A solid 2px black border on every card and button |
| Shadows | Only a `4px 4px 0` hard shadow, with `translate(-2px,-2px)` on hover |
| Font | IBM Plex Sans KR 400/500/600/700 |

## Step 1 — Starting With Design Tokens: Tailwind 4's `@theme inline` Trap

The first thing I did was define the tokens in `globals.css`. Since the project runs Tailwind CSS 4, there's no config file — declaring tokens inside a CSS `@theme` block auto-generates the corresponding utility classes.

But this is where today's biggest stumble came from. The existing file already had a `@theme inline { ... }` block that shadcn had set up, so I just added my tokens into it:

```css
/* ❌ 이렇게 하면 안 됩니다 */
@theme inline {
  --color-ink: #1a1a1a;      /* 리터럴 값 토큰 */
  --color-paper: #f4f3f1;

  --color-background: var(--background);  /* 기존 shadcn 매핑 */
  /* ... */
}
```

Type check passed, lint passed, build passed. But opening the browser, the `bg-ink` and `border-ink` classes were **entirely ignored** and the page came out flat gray. There wasn't a single error line, so it took a while to track down the cause. Only after grepping the generated CSS directly did I confirm that the `.bg-ink` utility itself had never been created.

The cause was the `inline` keyword. `@theme inline` is a block whose **purpose is to inline-resolve `var()` references**, so custom tokens declared as literal values get silently ignored. The fix is simple — split literal tokens off into a separate plain `@theme` block:

```css
/* ✅ 리터럴 토큰은 일반 @theme 블록에 */
@theme {
  --color-ink: #1a1a1a;
  --color-paper: #f4f3f1;
  --color-line2: #c9c6c0;
  --shadow-hard: 4px 4px 0 rgba(26, 26, 26, 0.15);
}

/* var() 매핑은 기존대로 @theme inline에 */
@theme inline {
  --color-background: var(--background);
  /* ... */
}
```

Splitting it this way and restarting the dev server, utilities like `bg-ink` and `shadow-hard` got generated correctly. Since this is a **bug that fails silently**, it seems worth building the habit of checking whether the class actually exists in the generated CSS whenever you add a new token:

```bash
curl -s "http://localhost:3000/_next/static/chunks/____.css" | grep -c '\.bg-ink'
```

## Step 2 — Fonts and Icons

I switched the font over to `next/font`. It self-hosts Google Fonts at build time, so no requests go out to Google's servers at runtime:

```tsx
import { IBM_Plex_Sans_KR } from "next/font/google";

const ibmPlexSansKR = IBM_Plex_Sans_KR({
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});
```

The logo had its SVG paths right there in the handoff, so I wrapped it in a single `currentColor`-based React component. A fun detail: the design spec called for **scaling stroke-width inversely with the render size.** Thin (10) for the big hero icon, thick (18-20) for the small favicon. Since SVG strokes scale along with the viewBox, this rule compensates for lines getting thinner and blurring together the smaller you draw them. It was the first time I'd seen a handoff spell out something like that in the spec, and it clearly made a difference in the quality of the result.

## Step 3 — Comparing Designs A/B Style with Branches

Once I applied the full renewal, the comment section felt off. The new design puts a 2px-bordered card and "agree/disagree" pill buttons on every comment, but even with just a handful of comments stacked up, the screen filled up with borders and felt heavy.

A useful pattern for situations like this is **a comparison branch.** I kept main on the new design and rolled back just the comment section to the old design (a thin-divider list with 👍/👎 thumb buttons) on a branch, comparing them side by side:

```bash
git checkout -b design/comment-old-style
# 댓글 컴포넌트만 이전 스타일로 복원
git push -u origin design/comment-old-style
```

With Vercel, just pushing a branch gets you a preview URL, so I could flip back and forth between the two designs in an actual deployed environment and decide. The conclusion was "the old design is better for comments," and I merged the branch into main. Being able to make the call to **selectively roll back just one part** without ripping up the entire renewal was purely thanks to branches.

There was one compromise, too. Emoji are banned under the design rules, but the 🔥 score indicator on the trending ranking — I missed the intuitiveness of the old version. As a middle ground, I colored lucide's `Flame` icon red and orange and kept it as "the one accent color on an otherwise monochrome page." Follow the rule, but allow exactly one deliberate exception.

## Step 4 — Trending Ranking: The Hacker News Formula Meets the Reality of the Aggregation Window

Nogari's "hot Nogari rooms" ranking is computed with a single Postgres view. It's a simplified form of the Hacker News ranking formula:

```sql
create or replace view v_trending_topics as
select
  t.id,
  t.title,
  coalesce(r.cnt, 0) as recent_comment_count,
  coalesce(r.cnt, 0)
    / power(extract(epoch from (now() - t.activated_at)) / 3600.0 + 2, 1.5)
    as trending_score
from topics t
left join lateral (
  select count(*) as cnt
  from comments c
  where c.topic_id = t.id
    and c.created_at > now() - interval '30 days'
    and c.deleted_at is null
) r on true
where t.status = 'ACTIVE';
```

Written out, the formula is `score = recent comment count / (room age in hours + 2)^1.5`.

- **The `+2` in the denominator**: a freshly opened room has an age near 0, so without this correction a single comment would send its score through the roof
- **The `1.5` exponent**: the score decays more sharply over time, so older rooms stay near the top only if they have a lot of activity
- **Tiebreaking**: when scores are equal, sort descending by `last_comment_at` — rooms with the most recent conversation rank higher

The original aggregation window was "the last 1 hour." That matches the intent of a real-time trend, but it had a **fatal problem for an early-stage service.** With so few users, almost no room had a comment in the last hour, so every ranking score came out 0 and the ranking became meaningless. So I relaxed the window to 30 days. I'm planning to shrink it back down once users grow, which just means changing the view definition — a single migration file and it's done.

This was a moment where I felt firsthand that, when designing an algorithm, "the formula that's theoretically correct" and "the formula that actually works at your current data scale" can be two different things.

The trending view evolved twice more after this. I added `topic_type` to support a type filter (person/object/brand/event) and `image_url` to show photos in the ranking, but PostgreSQL's `CREATE OR REPLACE VIEW` has the constraint that **columns can only be appended at the end**, so every migration re-declared the whole view while always tacking the new column on at the end. For images, I handled the priority inside the view itself with `coalesce(t.image_url, p.photo_url)` — user-uploaded image first, falling back to the politician's profile photo if there isn't one.

## Step 5 — A CTA Diet: Only Keep a Button When There's No Visible Alternative

The screen right after the renewal had a lot of buttons. "Start Anonymously" in the header, "Browse Nogari Rooms" and "Propose a Room" in the hero, "Shoot the Breeze" in the room detail title bar. But going through them one by one, most turned out to be duplicate CTAs **for a function that was already visible right next to them.**

- "Browse Nogari Rooms" → clicking it scrolls down to the list right below, but the list is already visible on screen → **removed**
- "Start Anonymously" → there's no login on this site, so it's a button with nowhere clear to send you → **removed**
- "Shoot the Breeze" → an anchor to the comment input, but the input box is already sticky and always floating at the bottom → **removed**

In the end, the only one that survived was "Propose a Room." It opens a modal — a button that can't be replaced any other way. I took the opportunity to cut the hero down drastically too — instead of a big tile box, I laid a fish icon as a 7%-opacity watermark in the background and cut the vertical height in half, so the ranking list shows down to 5th place right on the first screen. **If what a button does is "scroll," the layout can do that job instead** — that's today's conclusion.

## Step 6 — Seeding Sample Data: Wikimedia Images and Two Pitfalls

With the design settled, content became the next problem. Object/brand/event rooms just sat there with a bare title and nothing else, so I built a script that pulls license-free images from Wikimedia Commons, attaches a representative photo, and seeds test comments:

```ts
// Wikimedia Commons 파일명 → 640px 썸네일 리다이렉트 URL
function commonsThumb(fileName: string): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=640`;
}
```

I stepped on two pitfalls here.

1. **Wikimedia blocks requests with no User-Agent with a 429.** Explicitly setting a UA header on `fetch` and adding a 1-second delay between requests fixed it. It's also just basic etiquette when scraping a public API with a script.
2. **Supabase Storage rejects Korean-language file keys** (`Invalid key: topics/seed-쿠팡.png`). I worked around it by not using the room title directly as the key, and keeping a separate ASCII slug (`coupang`, `stanley-tumbler`) instead.

When inserting comment reaction counts, instead of directly UPDATE-ing `like_count`, I inserted a row into the `comment_reactions` table and **let the DB trigger bump the counter.** Even seed data needs to go through the same path as a real user, or consistency breaks. The script includes duplicate checks for both images and comments, so it's safe to re-run.

## Troubleshooting Summary

| Symptom | Cause | Fix |
|---|---|---|
| Custom color utilities silently never generated | Literal tokens declared inside `@theme inline` | Split them off into a separate `@theme` block |
| globals.css edits not taking effect | Turbopack HMR missed the theme change | Restart the dev server |
| Text disappears on hover over the active tab | The base component's `hover:text-foreground` was overriding the custom `text-paper` | Specify `data-active:hover:text-paper` explicitly |
| Trending score comes out 0 across the board | The aggregation window (1 hour) was far too short for the service's scale | Relaxed the window to 30 days, to be re-tuned as it grows |
| Wikimedia image download 429 | Policy blocking requests with no User-Agent | Set the UA header explicitly + 1-second delay between requests |
| Storage upload `Invalid key` | Korean characters aren't allowed in file keys | Used an ASCII slug instead of the room title as the key |

## Wrap-Up

The whole day's flow at a glance:

1. Read the tokens and rules from the design handoff's README and ported them into `@theme` blocks
2. Fell into the `@theme inline` trap, then escaped by grepping the generated CSS
3. Self-hosted the font with `next/font`, turned the SVG logo into a `currentColor` component
4. After applying the full renewal, A/B'd just the shaky comment section on a comparison branch and restored the old design
5. Tuned the trending aggregation window from 1 hour to 30 days to match the data scale, and expanded the view to cover the type filter and representative images
6. Stripped out 3 duplicate CTAs (Browse / Start Anonymously / Shoot the Breeze) and slimmed the hero down to a watermark style
7. Filled the empty screens with Wikimedia Commons images plus a test-comment seeding script

Defining a design system with strong constraints — "5 colors, 2px borders, hard shadow only" — actually leaves the implementer with fewer decisions to make, which speeds things up. I also learned that for design decisions you're not sure about, it's much faster to compare them with your own eyes via a branch and preview deploy than to agonize over them in your head — and that for pretty much any single button, if you ask "is there something the user can't do without this?", the surprising answer is usually that you can delete it.
