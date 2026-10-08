---
title: 'Nogari Renewal (4/5) — Making People Want to Come Back to a Login-Free Service'
date: '2026-07-19'
publish_date: '2026-12-28'
description: Using localStorage to track favorite and recently visited rooms in a login-free anonymous community, plus related room suggestions, a question of the day, and social content generation
tags:
  - Next.js
  - localStorage
  - Claude API
  - next/og
  - Retention
---

## How Do You Build "a Reason to Come Back" Without Login?

Nogari has no sign-up and no login. That's the core advantage that keeps the entry barrier low, but it also means I can't use the most common ways of building retention — login-based notifications, favorites, history. Chapter 12 of the spec tackled this problem head-on.

> Even without login, provide the following features on a per-browser basis: recently visited rooms, rooms I've recently commented in, comments I've liked, saved favorite rooms, new-comment indicators

This post rounds up what I actually built under this "Stage 2: growth features" umbrella — saving favorite rooms, related room suggestions, a question of the day, header search, and even a tool for generating content the admin can push out on social media.

## Step 1: A Login-Free "My Rooms" List — localStorage

Since there's no way to identify a user on the server, I decided to store favorite rooms and recent-visit history in the browser (localStorage) instead. I started with one small utility module.

```ts
// src/lib/local-rooms.ts
export interface StoredRoom {
  id: string;
  title: string;
  visitedAt: number;
}

const RECENT_KEY = "nogari_recent_rooms";
const FAVORITE_KEY = "nogari_favorite_rooms";

function read(key: string): StoredRoom[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return []; // 프라이빗 모드·용량 초과는 조용히 무시
  }
}

export function recordVisit(id: string, title: string): void {
  const rooms = read(RECENT_KEY).filter((r) => r.id !== id);
  rooms.unshift({ id, title, visitedAt: Date.now() });
  write(RECENT_KEY, rooms.slice(0, 10));
}

export function toggleFavorite(id: string, title: string): boolean {
  const rooms = read(FAVORITE_KEY);
  const exists = rooms.some((r) => r.id === id);
  if (exists) {
    write(FAVORITE_KEY, rooms.filter((r) => r.id !== id));
    return false;
  }
  rooms.unshift({ id, title, visitedAt: Date.now() });
  write(FAVORITE_KEY, rooms.slice(0, 50));
  return true;
}
```

I put in a component that quietly records a visit the moment you enter a room's detail page,

```tsx
// src/components/topic/RoomVisitTracker.tsx
export function RoomVisitTracker({ topicId, topicTitle }: Props) {
  useEffect(() => {
    recordVisit(topicId, topicTitle);
  }, [topicId, topicTitle]);
  return null;
}
```

and at the top of the main screen, saved favorite rooms and recently visited rooms are shown as chips.

```tsx
// src/components/dashboard/MyRoomsSection.tsx
useEffect(() => {
  const favs = getFavoriteRooms().slice(0, 8);
  const favIds = new Set(favs.map((r) => r.id));
  setFavorites(favs);
  // 관심 방에 이미 있으면 최근 방문에서 중복 노출 안 함
  setRecents(getRecentRooms().filter((r) => !favIds.has(r.id)).slice(0, 8));
}, []);
```

One detail I had to be careful about here. localStorage doesn't exist on the server (SSR), so if you reflect its value directly in the initial render, you get a **hydration warning because the server-rendered HTML and the client-rendered HTML don't match.** So I always read it inside `useEffect` after mount, starting with an empty array at server-render time. I declared the component itself as `"use client"` for the same reason, so any UI that depends on this value is decided purely on the client.

## Step 2: Related Room Suggestions — Reusing a Trend View That Already Existed

I added a "how about these Nogari rooms?" section at the bottom of the room detail page. Rather than building yet another aggregation query for this, I reused the `v_trending_topics` view from Part 1 as-is.

```ts
async function getRelatedTopics(topicId: string, topicType: TopicType) {
  const { data } = await supabase
    .from("v_trending_topics")
    .select("id, title, image_url, comment_24h_count")
    .in("topic_type", dbTypes)
    .neq("id", topicId)
    .order("trending_score", { ascending: false })
    .limit(5);
  return data ?? [];
}
```

The criterion "the 5 most active rooms right now among the same type (people/brands/events/etc.)" was enough on its own. Instead of writing a new aggregation query, I just layered a filter condition on top of a view that was already battle-tested, so even if the trend score formula changes again down the line, related room suggestions update automatically right along with it.

## Step 3: Question of the Day — AI Drafts, Admin Approves

Leaving the first comment in a room with no comments yet feels especially intimidating. So I added a feature that pins one conversation-starting question to each room. Here too I followed one of the spec's principles exactly — **no fully automated publishing.**

```ts
// src/lib/anthropic.ts
export async function generateTodayQuestion(
  topicTitle: string,
  topicDescription: string | null,
): Promise<string> {
  const response = await anthropic.messages.create({
    model: SUMMARY_MODEL,
    system:
      "... 오늘의 질문 하나를 한국어 존댓말로 작성해라.\n" +
      "규칙: 1문장, 60자 이내, 물음표로 끝나기, 찬반이나 경험담이 갈릴 만한 " +
      "구체적 질문으로. 명예훼손·허위사실을 전제하는 질문 금지.",
    messages: [{ role: "user", content: `방 주제: ${topicTitle}\n설명: ${topicDescription || "(없음)"}` }],
  });
  return textBlock.text.trim();
}
```

On the admin screen (`/admin/topics`), searching for a room brings up an "AI generate" button; pressing it fills the input field with a candidate question. From there, the admin can edit it or save it as-is. The key point is that **generation and publishing aren't bundled into a single button.** An AI-written question can end up off-context or awkward, so there's always a step for a human to look it over before it goes live.

## Step 4: The Same Principle Applies to Social Content — No Auto-Posting

When the admin wants to post today's TOP 5 or the hottest comment to social media, manually capturing and polishing it every single time is a hassle. So I made a single `/admin/sns` page that auto-generates both text and images.

```tsx
const top5Text =
  `🔥 오늘의 노가리 TOP 5 (${dateLabel})\n\n` +
  topTopics.map((t, i) => `${i + 1}. ${t.title} — 24시간 댓글 ${t.comment_24h_count}개`).join("\n") +
  `\n\n지금 반응 보러 가기 👉 https://nogari.org`;
```

For images, having sidestepped all the satori traps covered in Part 3, they come out in two formats: square (for feeds) and vertical (for stories).

```
GET /api/admin/sns-card?format=square   → 1080×1080
GET /api/admin/sns-card?format=story    → 1080×1920
```

The principle here is the same as everywhere else. **Generation is automatic, publishing is human.** I only provide a copy button for text and a download link for images — actually posting to Twitter or Instagram is something the admin does by hand. I never built a pipeline where AI/automation-generated content goes straight out externally without review.

## Step 5: Why Header Search Wasn't There from the Start

Global search originally only existed inside the "Nogari Rooms" tab on the main screen. This time I added one more entry point so you can search from the header too, but instead of building new search logic, I just routed it to the existing screen.

```tsx
function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  const trimmed = query.trim();
  if (!trimmed) return;
  trackEvent("search_submit", { query_length: trimmed.length });
  router.push(`/?tab=browse&q=${encodeURIComponent(trimmed)}`);
}
```

The reason I didn't build a new search engine, and instead just piggybacked on the existing screen's query-string convention (`?tab=browse&q=`), is that sorting and filtering logic for search results already lived entirely on that screen. Just adding another entry point was far safer than maintaining the same feature in two places.

## Wrap-Up

| Feature | Where it's stored/handled | Core principle |
|---|---|---|
| Favorite rooms / recent visits | localStorage | Read only after mount, to avoid hydration mismatches |
| Related room suggestions | Reuses the existing trend view | No new aggregation logic, just a filter layered on top |
| Question of the day | Haiku generation + admin save | AI drafts only, a human approves publishing |
| Social content | Auto-generated text/images | Generation is automatic, external publishing is always manual |
| Header search | Routes to the existing search screen | Just another entry point added, no duplicated logic |

The final post covers an "issue room generation" feature that opens a room automatically from a single news keyword, and the work of pulling admin pages that had scattered all over the place into a single home screen.
