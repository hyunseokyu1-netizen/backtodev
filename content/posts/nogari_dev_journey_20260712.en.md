---
title: 'Nogari Dev Log — From Concept to Deployed Anonymous Community Platform in One Day'
date: '2026-07-12'
publish_date: '2026-11-14'
description: Design decisions and trial-and-error building Nogari, a crowd-governed anonymous community, with Next.js 16, Supabase, and the Claude API
tags:
  - Next.js
  - Supabase
  - Claude API
  - PWA
  - Vercel
---

## What If I Turned "Shooting the Breeze" Into a Service

Korean has an expression, "노가리 깐다" (nogari kkanda) — chatting comfortably, talking behind people's backs a little. **Nogari** is the project that started from the thought of carrying that sentiment straight into a service.

The first idea was simple: show a list of politicians and let people leave anonymous comments. But that's too limited. So I changed direction — toward a structure where **anyone can propose a topic — a person, an object, an event — and a board (a Nogari room) opens once enough people agree.** It's a kind of DAO approach, where boards aren't created by an operator but by the collective agreement of users.

The core flow, summarized:

```
[주제 제안] → [AI 유사 주제 검토 (중복 방지)]
    → [72시간 내 30명 동의] → [정식 노가리방 개설]
    → [익명 댓글로 자유로운 소통]
```

I layered a few extra touches on top of this:

- **Bamboo Forest mode**: a volatile room that only burns for 24 hours after opening before it self-destructs
- **Trending ranking**: showing the hottest rooms right now, in real time
- **Fully anonymous + a minimal safety net**: perfectly anonymous on the surface, but structured so that a malicious user can still be sanctioned once a report comes in

This post is a record of the process — starting this service from a single page of planning notes and taking it all the way to an actual deployment (https://nogari.vercel.app).

## Tech Stack — What to Build It With

The goal was building an MVP fast, so I picked the stack boldly.

| Area | Choice | Reason |
|---|---|---|
| Frontend + backend | Next.js 16 (App Router) | Handles API routes too, all in one project |
| UI | Tailwind CSS v4 + shadcn/ui | Utility CSS since responsive mobile support was mandatory |
| DB/auth/realtime | Supabase | Postgres + anonymous auth + Realtime in one |
| AI | Claude API (Anthropic) | Judging similar topics + filtering comments |
| PWA | Serwist | A Turbopack-compatible service worker (more on this below) |
| Deployment | Vercel + GitHub integration | Auto-deploys on push |

### Checking for Duplicates Without Embeddings

The original plan had something like "convert the title into an embedding vector and treat it as a duplicate if pgvector's cosine similarity is 0.85 or higher." But here I hit my first real-world problem. **Anthropic doesn't offer an embeddings API.** Using embeddings would have meant getting yet another key issued from OpenAI or Voyage AI.

So I changed the approach. Instead of embeddings plus a vector DB, I **handed the entire list of existing topics to Claude and just asked it directly, "is this a duplicate?"**

```typescript
// 신규 제목 + 기존 주제 목록(JSON)을 Claude에게 전달
const response = await anthropic.messages.create({
  model: "claude-opus-4-8",
  system: "단순 표기 차이(띄어쓰기, 영문/한글, 약칭)뿐 아니라 " +
          "같은 인물/사물/사건을 가리키는 경우도 중복으로 간주해라.",
  messages: [{ role: "user", content: `신규: ${title}\n기존: ${JSON.stringify(topics)}` }],
  output_config: {
    format: { type: "json_schema", schema: /* is_duplicate, similar_topics */ },
  },
});
```

Testing it for real, after registering `__TEST_아이폰17__` and then proposing "아이폰 17" (iPhone 17), it correctly blocked it, even attaching a reason like *"refers to the same product, with only a spacing difference — effectively the same target."* Once the topic count grows into the thousands and won't fit in the context, I can switch to embeddings then — for an MVP, this is far simpler. It also means I only ever need one API key.

## DB Design — The Anonymous Community's Dilemma

The thing I agonized over most in designing an anonymous community's DB was this: **"it has to look perfectly anonymous to users, while still letting me ban a malicious user once a report comes in."**

### device_hash: Traceable, But Not Identifiable

Since this is a signup-free service, I used Supabase's **anonymous sign-in.** On first visit, the middleware (`proxy.ts` in Next.js 16) automatically issues an anonymous session. Instead of storing that session's `user.id` directly in the DB, I store a `device_hash` — the `user.id` HMAC-hashed with a server-only secret (pepper).

```typescript
export function deriveDeviceHash(userId: string): string {
  return createHmac("sha256", process.env.DEVICE_HASH_PEPPER!)
    .update(userId)
    .digest("hex");
}
```

This value lets me handle "one agreement per topic," "a limit of 5 comments per minute," and "sanctions once reports pile up" — all while being a hash that can't be reversed to figure out who someone actually is.

### Why I Split the Tables Because of Realtime

Supabase Realtime's `postgres_changes` **broadcasts the entire row, not individual columns.** That means if I put a `device_hash` column on the comments table and turn on realtime subscription, every connected client gets the author's `device_hash` broadcast straight to them. Anonymity breaks.

So I physically split sensitive values off into different tables:

| Public tables (Realtime subscription OK) | Private tables (service-role only) |
|---|---|
| `topics` (title, status, agreement count) | `topic_meta` (proposer's device_hash) |
| `comments` (nickname, content, like count) | `comment_authors` (author's device_hash) |
| `categories` | `topic_votes`, `reports`, `rate_limit_events` |

I locked down the private tables by turning on RLS (Row Level Security) but **deliberately never creating any policy at all.** With no policy, the anon key can't read anything, and only the service-role key (server-only, which bypasses RLS) can access it.

### Every Write Goes Through the Server

I didn't allow the client to INSERT directly into Supabase. Every write (proposing, voting, commenting, reporting) goes through a Next.js Route Handler and executes with service-role. That lets me enforce rate limiting, AI filtering, and validation all in one place. Even if the client claims "I already passed the similarity check," the server doesn't trust it and re-verifies anyway.

### Agreement → Automatic Promotion via a DB Trigger

"Switch from PENDING to ACTIVE the moment the 30th agreement comes in" — doing this in application code creates a race condition under concurrent voting. So I pushed it down into a Postgres trigger:

```sql
create or replace function fn_after_vote_insert() returns trigger as $$
begin
  update topics set votes_count = votes_count + 1 where id = new.topic_id;
  update topics
    set status = 'ACTIVE', activated_at = now(),
        -- 대나무숲이면 승격 순간부터 24시간 시한부
        expires_at = case when room_mode = 'BAMBOO_24H'
                          then now() + interval '24 hours' else null end
    where id = new.topic_id and status = 'PENDING'
      and votes_count >= required_votes;
  return new;
end; $$ language plpgsql security definer;
```

Since a row lock gets taken inside the same transaction, the transition happens exactly once, the instant the threshold is crossed. "If a new category name is written in along with the proposal, the category also gets auto-created the moment it's promoted" works the same way, via a trigger. Instead of building a separate category-voting system, I treated **30 people agreeing on a topic as also being agreement on its category.**

### Expiration and Self-Destruct Batches via pg_cron

Expiring proposals that don't reach enough agreement within 72 hours, self-destructing Bamboo Forest rooms after 24 hours, archiving rooms with no comments for 48 hours — these batch jobs all run inside the DB via Supabase's built-in `pg_cron`, with no external worker.

```sql
select cron.schedule('explode-bamboo-rooms', '0 * * * *', $$
  update topics set status = 'EXPIRED'
  where room_mode = 'BAMBOO_24H' and status = 'ACTIVE' and expires_at < now();
$$);
```

## Features I Built

### Anonymous Nicknames — A Different Face in Every Room

Writing a comment attaches a nickname like "Furious Lawmaker" or "Shy Convenience Store Clerk." The key point is that it's **deterministically generated from a seed of (room ID + device_hash).** Inside the same room, you always get the same nickname so the conversation stays coherent, while it's completely different in another room, making cross-room tracking impossible.

```typescript
export function deriveAnonNickname(topicId: string, deviceHash: string) {
  const digest = createHash("sha1").update(`${topicId}:${deviceHash}`).digest();
  return `${ADJECTIVES[digest[0] % ADJECTIVES.length]} ${NOUNS[digest[1] % NOUNS.length]}`;
}
```

### Two-Stage Comment Filtering

The first stage is regex. If something looks like a resident registration number, phone number, or email pattern, it gets blocked immediately with no LLM call at all, and never even gets saved to the DB. Only what passes the first stage goes to Claude to judge "is this a serious insult about someone's family / a death threat / a clear falsehood, or is it just ordinary criticism, satire, or humor." The key point is explicitly stating that rough language typical of anonymous communities is, on its own, not grounds for blocking — because a Nogari service can't go around blocking all the trash talk.

### Real-Time — Realtime and Presence

- Comments: SSR draws the initial list, then subscribes to `postgres_changes` INSERT/UPDATE events to reflect new comments and like counts in real time
- Vote gauge: the agreement gauge on a proposal card fills up in real time as other people vote
- Concurrent users: Supabase Presence shows "N people shooting the breeze right now" — a volatile state that's never stored on the server, so it has no impact on anonymity either

### The Trending Ranking and the "Ahn Cheol-soo Disappeared" Bug

I implemented the trending score as a SQL view, exactly matching the planning doc's formula:

```
Score = (최근 1시간 내 댓글 수) / (개설 후 경과시간 + 2)^1.5
```

But real usage turned up a funny bug. I commented on the Ahn Cheol-soo room, and an hour later **the whole room vanished from the trending list.** The cause: once the recent-1-hour window goes empty, the score becomes 0, and with 300 rooms (every seeded National Assembly member) all sitting at 0, the sort order became arbitrary and the room got pushed out of the top 20. I added `last_comment_at` to the view and a secondary sort of "score → last comment time," so a room that had seen activity stays near the top even once its window empties out.

### Seeding 300 National Assembly Members

Since "trash-talking politicians" was the early anchor content, I needed real data. I collected the names, parties, and official profile photos of all 300 members of the 22nd National Assembly from "Open Assembly," a public DB run by the People's Solidarity for Participatory Democracy (PSPD). The list page only marked parties with colored dots, so I pulled out the 8 distinct colors, visited one representative member's detail page per color just once, and built a color-to-party-name mapping from that. After collecting everything, I verified it by checking whether the per-party distribution (Democratic 161, People Power 110, Rebuilding Korea 12...) matched the actual seat counts.

### Browsing by Type, Search, and Image Upload

Having only politicians isn't interesting, so I reorganized the main screen into **Person / Object / Brand / Event / Other** type chips (politicians get folded into "Person") and added search by type. Search runs on the server with `ilike`, and it's important not to forget that pattern characters like `%` and `_` in the search term need to be escaped.

Image upload goes through a public Supabase Storage bucket. One security point: when accepting an `imageUrl` at proposal registration, I **verify the prefix to confirm it was actually issued by our own Storage.** Without that check, anyone could push in an arbitrary external URL.

### The Admin Reports Page

Where do I even look when reports pile up? I initially built it as `/admin/reports?key=secretkey`, but having the key exposed in the URL and sitting in browser history bothered me, so I switched to a **password login scheme.** The password gets compared with `timingSafeEqual`, an httpOnly cookie gets issued, and every request after that authenticates via the cookie. A wrong key throws a 404, hiding the very existence of the page.

## Trial and Error Log

### Next.js 16: middleware Became proxy

Creating a `middleware.ts` threw a deprecation warning. Starting with Next.js 16, the file name and export name changed to `proxy.ts`. The functionality is identical.

### next-pwa Doesn't Work With Turbopack

I installed `next-pwa` to add PWA support, and it conflicted with Turbopack, Next.js 16's default bundler (it's webpack-only). The fix was **Serwist's Turbopack-specific package** (`@serwist/turbopack`). Instead of a webpack plugin, it dynamically serves the service worker through a `/serwist/sw.js` route, so it doesn't conflict with the bundler.

```typescript
// app/serwist/[path]/route.ts — 서비스워커를 라우트로 서빙
export const { GET, generateStaticParams, ... } = createSerwistRoute({
  swSrc: "src/app/sw.ts",
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
});
```

### If the supabase CLI Silently Hangs

`supabase db push` sat there with no output at all, and I was stuck on it for a while — turns out it was running in the background **waiting on a DB password input prompt.** Passing it via the `--password` flag fixes it. For reference, the Personal Access Token (for login) and the DB password (for Postgres access) are two separate things.

### Long Text Breaks Out of the Mobile Layout

Taking screenshots at 360/390/430px viewports with Playwright, a long string with no spaces spilled off the edge of the screen. I applied `break-words` everywhere user input gets rendered (comments, titles, descriptions), and `truncate` + `min-w-0` on trending titles that share a line with a rank badge. I ran into that classic trap again too — `truncate` doesn't work on a flex child without `min-w-0`.

## Deployment

I created a private GitHub repo and pushed, and linking the project with the Vercel CLI automatically wired up the GitHub integration too. I registered the 5 environment variables (2 Supabase URL/keys, the Anthropic key, the device_hash pepper) with `vercel env add`, and one `vercel --prod` finished the job. From then on, every push to main auto-deploys.

## Wrap-Up — Key Design Decisions

| Decision | Details |
|---|---|
| Unified write path | Every INSERT goes through a Route Handler + service-role. Rate limiting/filtering enforced in one place |
| Separated sensitive-data tables | Since Realtime broadcasts the whole row, device_hash lives in a physically separate table |
| Consistency lives in the DB | Agreement → promotion and count aggregation via triggers. Race conditions solved with Postgres locks |
| Batches via pg_cron | Expiration/self-destruct/archiving run inside the DB, no external worker |
| Direct LLM judgment instead of embeddings | At MVP scale, handing Claude the list and asking is simpler |
| Anonymous, yet traceable | HMAC(user.id, pepper) = device_hash. Can't identify, but can sanction |

Starting from a single page of planning notes, I ended up with 17 migrations, 12 API routes, and a live service URL. The most thrilling moment was watching the concept of "a board opens by collective agreement" actually run inside a single trigger. The next step is bringing in real users and tuning numbers like `required_votes` to match reality.
