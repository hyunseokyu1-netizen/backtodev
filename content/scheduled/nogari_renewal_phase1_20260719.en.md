---
title: "Nogari Renewal (1/5) — From a 'Gossip Site' to a 'Real-Time Reaction Platform'"
date: '2026-07-19'
publish_date: '2026-12-25'
description: Repositioning the anonymous community Nogari as a real-time reaction platform — rewriting the core concept and the trend score formula from scratch
tags:
  - Next.js
  - Supabase
  - PostgreSQL
  - Service Planning
  - Renewal
---

## A Renewal That Started From a Single Page of Work Instructions

Nogari (Nogari.org) is a signup-free community where people talk anonymously about people, objects, brands, and events. Each room automatically gets its own anonymous nickname, which stays the same within that room. It was a fun concept, but at some point it became obvious this wasn't a service you could answer "so what exactly is this place for?" about in 5 seconds.

So I wrote up a one-page work order. The key sentence was this.

> **See the news and the issue in the article. See people's reactions on Nogari.**

If it used to be "a place where anyone can anonymously gossip," the repositioning now is toward "a place to quickly check people's reactions to real-time issues." Each room is responsible for one person, brand, or event, and a new visitor should be able to immediately grasp what people are talking about right now without having to write anything.

Instead of throwing this work order straight at an AI coding tool, I went through the order of **analyze the current structure → organize the gaps → get approval → implement step by step.** This post covers the first two things I touched — swapping the main concept copy, and redesigning the trend score formula.

## Step 1: Analyze First, Don't Touch the Code First

I put this sentence at the end of the work order.

```text
바로 코드를 수정하지 말고 먼저 다음 내용을 보고해 주세요.

1. 현재 기술 스택
2. 현재 디렉터리 구조
3. 이미 구현된 기능
4. 작업지시서와 비교했을 때 부족한 기능
5. 데이터베이스 변경이 필요한 부분
...

분석 결과를 먼저 보여준 뒤, 제 승인을 받은 다음 1단계 작업부터 구현해 주세요.
```

The reason I enforced this order is simple. A good chunk of the requirements written in the work order **were already implemented.** For example, AI-based duplicate room checking, Bamboo Forest (24-hour volatile rooms), and the report management screen already existed at close to the level the order was asking for. If I'd jumped straight into implementation without analysis, I would have nearly ended up rebuilding things that already existed, or rebuilding them in a way that clashed with the existing structure.

The analysis narrowed the gaps down to 12, and I decided to tackle the top-3 priority ones (trend score, AI summary, comment share card) first, then work through the rest in order.

## Step 2: Swapping the Main Hero Copy

Starting with the most visible change. The existing hero looked like this.

```tsx
<h1>
  누구나 사람, 사물, 사건을 두고
  <br /> 익명으로 노가리 까는 곳
</h1>
<p>회원가입도, 프로필도 없습니다. 방에 들어가서 그냥 까면 됩니다.</p>
```

There was only one CTA too — "Propose a Room." It was a structure that threw a demand of "go make a new room" at a new visitor before telling them "what you can even do here." I changed it to this.

```tsx
<h1>
  뉴스는 기사로,
  <br /> 사람들 반응은 노가리로
</h1>
<p>
  인물, 브랜드, 제품, 사건에 대한 익명의 실시간 반응을 확인하세요.
  가입 없이 바로 읽고 댓글을 남길 수 있습니다.
</p>

<Link href="/#rooms" className={buttonVariants({ variant: "default" })}>
  지금 뜨는 노가리 보기
</Link>
<ProposeButton variant="outline">새 노가리방 제안하기</ProposeButton>
```

I changed the top-priority CTA to "See What's Trending on Nogari Now" and demoted room creation to a secondary outline button. **The core idea was lowering the entry barrier, from "a place you participate in" to "a place you browse and end up participating in."** I matched the browser tab title and the OG image copy that shows up when sharing on KakaoTalk to the same concept too — because changing only the text while leaving the image as-is makes the search results and the actual service experience feel disconnected from each other.

## Step 3: The Trend Score, From "30-Day Comment Count" to "Right This Moment"

This is the part that took the most work in the renewal. The existing trending formula looked like this.

```sql
-- 트렌딩 랭킹: Score = (최근 1시간 댓글수) / (경과시간(h)+2)^1.5
select
  coalesce(r.cnt, 0) / power(extract(epoch from (now() - t.activated_at)) / 3600.0 + 2, 1.5) as trending_score
from topics t
left join lateral (
  select count(*) as cnt from comments c
  where c.topic_id = t.id and c.created_at > now() - interval '1 hour'
) r on true
```

The approach of "decaying the 1-hour comment count by room age" wasn't bad, but the picture the work order wanted was more three-dimensional — a formula that also factors in participant count, share count, and reports, to more accurately capture "the room that's genuinely hot right now."

```text
trend_score =
  최근 1시간 댓글 수 × 5
  + 최근 6시간 댓글 수 × 2
  + 최근 24시간 참여자 수 × 3
  + 공유 수 × 4
  + 공감 수
  - 신고 누적 가중치
```

There was one problem here. **There was no table at all tracking share counts.** I wanted to put it into the formula, but the raw ingredient didn't exist. So I first created a new `share_events` table, and instead of hardcoding the weights, I stored them in a key-value settings table called `app_settings`, so they could be adjusted directly from the admin screen.

```sql
create table app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into app_settings (key, value) values (
  'trend_weights',
  '{"comment_1h": 5, "comment_6h": 2, "participant_24h": 3, "share": 4, "like": 1, "report": 10}'::jsonb
);

create table share_events (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references topics(id) on delete cascade,
  comment_id uuid references comments(id) on delete cascade,
  platform text not null,
  device_hash text not null,
  created_at timestamptz not null default now()
);
```

I rewrote the view to read these weights from `app_settings` and compute from there.

```sql
create or replace view v_trending_topics as
select
  t.id, t.title, ...,
  (
    coalesce(r.c1h, 0) * w.comment_1h
    + coalesce(r.c6h, 0) * w.comment_6h
    + coalesce(r.p24h, 0) * w.participant_24h
    + coalesce(se.cnt, 0) * w.share
    + coalesce(lk.cnt, 0) * w.like_w
    - coalesce(rp.cnt, 0) * w.report
  )::numeric as trending_score,
  ...
from topics t
cross join (
  select
    coalesce((s.value ->> 'comment_1h')::numeric, 5) as comment_1h,
    ...
  from (select 1) one
  left join app_settings s on s.key = 'trend_weights'
) w
left join lateral (...) r on true   -- 1h/6h/24h 댓글, 24h 참여자
left join lateral (...) se on true  -- 24h 공유
left join lateral (...) lk on true  -- 24h 공감
left join lateral (...) rp on true  -- 7일 신고 (AI가 자동 기각한 건 제외)
where t.status = 'ACTIVE';
```

I built a form on the admin screen (`/admin/settings`) so these 6 weights can be edited directly as number inputs. **A value like "how much to dock a room that's gotten a lot of reports" is something you can't know the right answer to until you've actually run the service**, so I judged it needed to be tunable right after deployment, with no code changes required.

## Troubleshooting: A View Column's Type Doesn't Change Quietly

The first error I hit while pushing the migration into the real DB.

```
ERROR: 42P16: cannot change data type of view column "trending_score"
from numeric to double precision
```

While writing the new formula, I'd explicitly cast the result of the `power()` calculation to `::double precision`, but the existing view's `trending_score` column was type `numeric`. `CREATE OR REPLACE VIEW` lets you **append columns at the end, but not change the type of an existing column.** PostgreSQL blocks the type change because it doesn't know whether some other object depends on that view.

The fix was simple. I matched the cast to the original type.

```sql
  )::numeric as trending_score,  -- power(numeric,numeric)의 원래 반환형에 맞춤
```

It sounds obvious, but I learned all over again that when editing a view with `CREATE OR REPLACE VIEW`, you always have to remember the constraint: **"adding columns is allowed, changing an existing column's name/type/order is not."**

## Wrap-Up

| Item | Before | After |
|---|---|---|
| Main copy | "A place to shoot the breeze anonymously" | "News in articles, people's reactions on Nogari" |
| Top-priority CTA | Propose a Room | See What's Trending on Nogari Now |
| Trend formula | 1-hour comments ÷ room-age decay | 1h/6h comments + 24h participants + shares + likes − reports (6 weights) |
| Weight location | Not in code (single variable) | `app_settings` table + real-time adjustment from the admin screen |
| Share tracking | None | New `share_events` table |

Next up is the screen built on top of this trend score — "Today's Top 5 Nogari" — and the story of the AI summary feature that automatically summarizes the flow of conversation in rooms where comments have piled up.
