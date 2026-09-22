---
title: '노가리 리뉴얼 (1/5) — "뒷담화 사이트"에서 "실시간 반응 플랫폼"으로'
date: '2026-07-19'
publish_date: '2026-09-23'
description: 익명 커뮤니티 노가리를 실시간 이슈 반응 플랫폼으로 리포지셔닝하며 메인 컨셉과 트렌드 점수 산식부터 다시 짠 기록
tags:
  - Next.js
  - Supabase
  - PostgreSQL
  - 서비스 기획
  - 리뉴얼
---

## 작업지시서 한 장으로 시작한 리뉴얼

노가리(Nogari.org)는 회원가입 없이 사람·물건·브랜드·사건을 두고 익명으로 떠드는 커뮤니티다. 방마다 다른 익명 닉네임이 자동으로 붙고, 같은 방에서는 그 닉네임이 유지된다. 재밌는 컨셉이었지만, 어느 순간 "그래서 이게 정확히 뭐 하는 곳이야?"라는 질문에 5초 안에 답할 수 있는 서비스가 아니라는 게 눈에 들어왔다.

그래서 작업지시서를 한 장 써봤다. 핵심 문장은 이거였다.

> **뉴스와 이슈는 기사에서 보고, 사람들의 반응은 노가리에서 본다.**

기존엔 "누구나 익명으로 뒷담화하는 곳"이었다면, 이제는 "실시간 이슈에 대한 사람들 반응을 빠르게 확인하는 곳"으로 포지셔닝을 바꾸는 거다. 방 하나하나가 인물·브랜드·사건 하나를 담당하고, 신규 방문자는 글을 안 써도 지금 사람들이 뭘 이야기하는지 바로 파악할 수 있어야 한다.

이 작업지시서를 AI 코딩 도구에 그대로 던지지 않고, 먼저 **현재 구조 분석 → 갭 정리 → 승인 → 단계별 구현** 순서로 진행했다. 이 글은 그중 가장 먼저 손댄 두 가지 — 메인 컨셉 문구 교체와 트렌드 점수 산식 재설계 — 를 다룬다.

## Step 1: 분석부터, 코드부터 손대지 않기

작업지시서 끝에 이런 문장을 넣었다.

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

이렇게 순서를 강제한 이유는 간단하다. 지시서에 적힌 요구사항 중 상당수가 **이미 구현돼 있었기** 때문이다. 예를 들어 AI 기반 중복 방 검사, 대나무숲(24시간 휘발 방), 신고 관리 화면 같은 건 지시서가 요구하는 수준과 거의 비슷하게 이미 있었다. 분석 없이 바로 구현부터 들어갔으면 이미 있는 걸 새로 만들거나, 기존 구조와 충돌하는 방식으로 다시 만들 뻔했다.

분석 결과 갭은 12개로 정리됐고, 그중 우선순위가 높은 3개(트렌드 점수, AI 요약, 댓글 공유 카드)부터 먼저 하고 나머지는 순서대로 하기로 정했다.

## Step 2: 메인 히어로 문구 교체

가장 눈에 띄는 변화부터. 기존 히어로는 이랬다.

```tsx
<h1>
  누구나 사람, 사물, 사건을 두고
  <br /> 익명으로 노가리 까는 곳
</h1>
<p>회원가입도, 프로필도 없습니다. 방에 들어가서 그냥 까면 됩니다.</p>
```

CTA도 "방 개설 신청" 하나뿐이었다. 신규 방문자에게 "내가 뭘 할 수 있는지"보다 "새 방을 만들라"는 요구부터 던지는 구조였던 거다. 이걸 이렇게 바꿨다.

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

1순위 CTA를 "지금 뜨는 노가리 보기"로 바꾸고, 방 개설은 2순위 외곽선 버튼으로 내렸다. **"참여하는 곳"에서 "구경하다가 참여하게 되는 곳"으로 진입 장벽을 낮추는 게 핵심**이었다. 브라우저 탭 제목과 카카오톡 공유 시 뜨는 OG 이미지 문구도 같은 컨셉으로 맞췄다 — 텍스트만 바꾸고 이미지는 그대로 두면 검색 결과와 실제 서비스 경험이 따로 노는 느낌이 나기 때문이다.

## Step 3: 트렌드 점수, "30일 댓글 수"에서 "지금 이 순간"으로

리뉴얼에서 가장 손이 많이 간 부분이 이거다. 기존 트렌딩 산식은 이랬다.

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

"1시간 댓글 수를 방 나이로 감쇠"시키는 방식이라 나쁘지 않았지만, 지시서가 원하는 그림은 더 입체적이었다. 참여자 수, 공유 수, 신고까지 반영해서 "지금 진짜 핫한 방"을 더 정확히 잡아내는 산식이었다.

```text
trend_score =
  최근 1시간 댓글 수 × 5
  + 최근 6시간 댓글 수 × 2
  + 최근 24시간 참여자 수 × 3
  + 공유 수 × 4
  + 공감 수
  - 신고 누적 가중치
```

여기서 문제가 하나 있었다. **공유 수를 추적하는 테이블 자체가 없었다.** 산식에 넣고 싶어도 재료가 없는 상태였던 거다. 그래서 먼저 `share_events` 테이블을 새로 만들고, 가중치는 하드코딩하지 않고 `app_settings`라는 키-값 설정 테이블에 저장해서 관리자 화면에서 바로 조정할 수 있게 했다.

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

뷰는 이 가중치를 `app_settings`에서 읽어와서 계산하도록 다시 짰다.

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

관리자 화면(`/admin/settings`)에서 이 6개 가중치를 숫자 입력으로 바로 수정할 수 있게 폼을 만들었다. **"신고가 많이 들어온 방을 얼마나 깎을지" 같은 값은 운영해보기 전엔 정답을 알 수 없는 값**이라, 배포 후에 코드 수정 없이 바로 튜닝할 수 있어야 한다고 판단했다.

## 트러블슈팅: 뷰 컬럼 타입은 조용히 안 바뀐다

마이그레이션을 실제 DB에 밀어넣으면서 처음 만난 에러.

```
ERROR: 42P16: cannot change data type of view column "trending_score"
from numeric to double precision
```

새 산식을 짤 때 `power()` 계산 결과를 명시적으로 `::double precision`으로 캐스팅했는데, 기존 뷰의 `trending_score` 컬럼은 `numeric` 타입이었다. `CREATE OR REPLACE VIEW`는 컬럼을 **끝에 추가하는 건 되지만, 기존 컬럼의 타입을 바꾸는 건 안 된다.** PostgreSQL이 그 뷰에 의존하는 다른 객체가 있을지 몰라 타입 변경을 막아두는 거다.

해결은 간단했다. 캐스팅을 원래 타입에 맞췄다.

```sql
  )::numeric as trending_score,  -- power(numeric,numeric)의 원래 반환형에 맞춤
```

당연한 얘기 같지만, `CREATE OR REPLACE VIEW`로 뷰를 고칠 때는 **"컬럼 추가는 허용, 기존 컬럼 이름/타입/순서 변경은 불허"**라는 제약을 항상 기억해야 한다는 걸 다시 배웠다.

## 정리

| 항목 | Before | After |
|---|---|---|
| 메인 문구 | "익명으로 노가리 까는 곳" | "뉴스는 기사로, 사람들 반응은 노가리로" |
| 1순위 CTA | 방 개설 신청 | 지금 뜨는 노가리 보기 |
| 트렌드 산식 | 1시간 댓글 ÷ 방 나이 감쇠 | 1h/6h 댓글 + 24h 참여자 + 공유 + 공감 − 신고 (가중치 6종) |
| 가중치 위치 | 코드에 없음(단일 변수) | `app_settings` 테이블 + 관리자 화면에서 실시간 조정 |
| 공유 추적 | 없음 | `share_events` 테이블 신설 |

다음 편은 이 트렌드 점수 위에 올라가는 화면 — "오늘의 노가리 TOP 5"와, 댓글이 쌓인 방에서 자동으로 흐름을 요약해주는 AI 요약 기능 이야기다.
