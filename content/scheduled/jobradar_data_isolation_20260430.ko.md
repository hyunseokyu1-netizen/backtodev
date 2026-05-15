---
title: 'Supabase service role로 멀티 유저 앱 만들다 터진 데이터 격리 버그들'
date: '2026-04-30'
publish_date: '2026-05-17'
description: RLS 없이 service role 클라이언트만 쓸 때 빠지기 쉬운 데이터 격리 함정 4가지와 해결법
tags:
  - Supabase
  - Next.js
  - PostgreSQL
  - PostgREST
  - 멀티유저
---

## "나만 보여야 하는 데이터가 다른 사람한테도 보인다"

JobRadar라는 사이드 프로젝트를 만들고 있다. 호주·NZ 채용 공고를 긁어 모아서 AI로 매칭해주는 앱인데, 처음에는 나 혼자 쓸 생각으로 만들었다. 그래서 Supabase의 RLS(Row Level Security)는 일단 넘어가고, 서버에서만 쓰는 `service role` 클라이언트로 전부 처리했다.

그런데 두 번째 유저를 추가하는 순간 문제가 터지기 시작했다.

- 내 커버레터가 다른 유저 화면에서도 보인다
- 메모를 저장했더니 두 유저가 같은 메모를 공유한다
- 공고 목록에 필터를 걸었는데 다른 유저 공고도 그대로 나온다
- 프로파일 저장이 엉뚱한 유저 데이터를 덮어쓴다

딱 봐도 심각하다. 오늘은 이 버그들을 하나씩 잡아나간 과정을 기록해둔다. RLS 없이 service role로 멀티 유저 앱을 구축할 때 반드시 알아야 할 함정들이다.

---

## 배경: service role이란 뭔가

Supabase 클라이언트는 크게 두 가지다.

| 클라이언트 | 키 | RLS 적용 | 주 사용처 |
|---|---|---|---|
| `createClient` (anon key) | `SUPABASE_ANON_KEY` | 적용됨 | 브라우저, 클라이언트 컴포넌트 |
| `createClient` (service role) | `SUPABASE_SERVICE_ROLE_KEY` | **무시됨** | 서버 전용, 관리자 작업 |

RLS를 쓰면 `auth.uid() = user_id` 같은 정책을 DB 레벨에서 강제할 수 있어서 아무리 쿼리를 잘못 짜도 다른 유저 데이터가 새지 않는다. 반면 service role은 RLS를 완전히 우회하기 때문에 쿼리가 조금이라도 잘못되면 바로 데이터가 섞인다.

Next.js App Router에서 서버 액션을 쓰다 보면 자연스럽게 service role 클라이언트를 쓰게 되는데, 이때 `user_id` 필터를 빠뜨리거나 잘못 거는 실수가 생각보다 많다.

---

## 함정 1: cover_letters 테이블에 user_id 필터 누락

### 문제

커버레터를 저장하고 불러오는 함수가 `job_id`만으로 쿼리하고 있었다.

```typescript
// 버그: job_id만으로 조회 → 같은 공고에 지원한 모든 유저 커버레터가 섞임
const { data } = await supabaseAdmin
  .from('cover_letters')
  .select('*')
  .eq('job_id', jobId)
  .single()
```

A 유저가 특정 공고에 커버레터를 쓰면, B 유저가 같은 공고를 열었을 때 A의 커버레터가 그대로 나왔다.

### 해결

모든 커버레터 관련 함수(`getCoverLetter`, `saveCoverLetter`, `reviewCoverLetter`)에 `user_id` 필터를 추가했다.

```typescript
// 수정: user_id + job_id 조합으로 조회
const { data } = await supabaseAdmin
  .from('cover_letters')
  .select('*')
  .eq('user_id', profile.id)
  .eq('job_id', jobId)
  .single()
```

그리고 DB에 UNIQUE constraint도 추가했다. 이게 없으면 `upsert`가 중복 row를 만들어버린다.

```sql
-- Migration 003
ALTER TABLE cover_letters
  ADD CONSTRAINT cover_letters_user_id_job_id_key
  UNIQUE (user_id, job_id);
```

upsert할 때는 이 constraint를 `onConflict` 기준으로 지정해야 한다.

```typescript
await supabaseAdmin
  .from('cover_letters')
  .upsert(
    { user_id: profile.id, job_id: jobId, content: text },
    { onConflict: 'user_id,job_id' }
  )
```

---

## 함정 2: 공유 컬럼(jobs.memo)을 유저별 테이블로 옮겨야 했다

### 문제

메모 기능을 처음 만들 때 `jobs` 테이블에 `memo` 컬럼을 달아뒀다. 어차피 혼자 쓸 거니까 괜찮겠다 싶었는데, 다중 유저가 되는 순간 `jobs`는 **모든 유저가 공유하는 테이블**이라는 게 문제였다.

A가 메모를 저장하면 B도 같은 메모를 보게 되는 구조였다.

### 해결

`jobs.memo`를 `matches.memo`로 이동했다. `matches` 테이블은 어차피 `(user_id, job_id)` 쌍을 저장하는 유저별 연결 테이블이다. 메모처럼 유저마다 달라야 하는 데이터는 여기 넣는 게 맞다.

```sql
-- matches에 memo 컬럼 추가
ALTER TABLE matches ADD COLUMN IF NOT EXISTS memo TEXT;

-- 기존 jobs.memo 데이터를 matches로 이전
UPDATE matches m
SET memo = j.memo
FROM jobs j
WHERE m.job_id = j.id AND j.memo IS NOT NULL;

-- jobs.memo 제거
ALTER TABLE jobs DROP COLUMN IF EXISTS memo;
```

데이터 설계 원칙으로 정리하면 이렇다.

| 데이터 성격 | 저장 위치 |
|---|---|
| 공고 원문, 회사명, URL 등 | `jobs` (공유) |
| 매칭 점수, 지원 상태, 메모 | `matches` (유저별) |
| 커버레터 내용 | `cover_letters` (유저별) |

---

## 함정 3: PostgREST INNER JOIN 필터가 service role에서 무시된다

이게 가장 황당했다.

### 문제

공고 목록을 유저별로 분리하려고 `matches!inner`로 JOIN하고 `.eq('matches.user_id', profile.id)` 필터를 걸었다.

```typescript
// 의도: matches에 있는 공고만 + 해당 유저 것만
const { data: jobs } = await supabaseAdmin
  .from('jobs')
  .select(`
    id, title, company, url,
    matches!inner ( score, reason, status, memo )
  `)
  .eq('matches.user_id', profile.id)
  .order('scraped_at', { ascending: false })
```

로컬에서 테스트했을 때는 잘 됐다. 근데 실제로 돌려보니 다른 유저의 공고도 전부 나왔다.

### 원인

PostgREST에서 관계 테이블의 컬럼을 필터로 쓰는 `.eq('matches.user_id', ...)` 구문이 service role 클라이언트에서는 제대로 동작하지 않는다. RLS가 켜져 있으면 자동으로 `auth.uid()` 컨텍스트가 붙어서 필터가 강제되는데, service role은 그 컨텍스트 자체가 없다 보니 관계 필터가 조용히 무시되는 것이다.

### 해결: 2단계 쿼리로 분리

관계 필터에 의존하지 않고, 쿼리를 두 단계로 나눴다.

```typescript
// 1단계: 이 유저의 matches를 먼저 조회
const { data: myMatches } = await supabaseAdmin
  .from('matches')
  .select('job_id, score, reason, status, memo')
  .eq('user_id', profile.id)

const matchMap = new Map(myMatches.map(m => [m.job_id, m]))
const jobIds = myMatches.map(m => m.job_id)

// 2단계: job_id 목록으로 jobs 조회
const { data: jobs } = await supabaseAdmin
  .from('jobs')
  .select('id, title, company, location, salary, url, ...')
  .in('id', jobIds)
  .order('scraped_at', { ascending: false })
```

이렇게 하면 `matches` 조회 시 `user_id` 필터가 단순 `.eq()`이기 때문에 확실하게 동작한다. 그리고 `matchMap`으로 매핑해두면 두 번째 쿼리 결과에 매치 정보를 붙이는 것도 간단하다.

```typescript
const jobList = (jobs ?? []).map((j: any) => {
  const m = matchMap.get(j.id)
  return {
    ...j,
    match_score: m?.score ?? null,
    match_reason: m?.reason ?? null,
    match_status: m?.status ?? 'new',
    memo: m?.memo ?? null,
  }
})
```

쿼리가 한 번 더 나가는 건 맞는데, 데이터가 섞이는 것보다는 훨씬 낫다.

---

## 함정 4: 새 공고 추가 시 matches 자동 등록 누락

### 문제

URL로 공고를 추가하는 `addJobByUrl` 함수가 `jobs` 테이블에만 upsert하고 `matches`에는 등록하지 않았다. 그러면 앞서 말한 2단계 쿼리에서 해당 공고가 아예 안 보인다.

### 해결

`jobs` upsert 직후에 `matches`에도 등록하는 코드를 추가했다.

```typescript
// jobs에 upsert
const { data } = await supabaseAdmin
  .from('jobs')
  .upsert({ url, title, company, ... }, { onConflict: 'url' })
  .select()
  .single()

// 해당 유저의 matches에 등록 (이미 있으면 무시)
await supabaseAdmin
  .from('matches')
  .upsert(
    { user_id: profile.id, job_id: data.id, status: 'new' },
    { onConflict: 'user_id,job_id' }
  )
```

`onConflict: 'user_id,job_id'`를 지정해두면 같은 공고를 다시 추가해도 기존 지원 상태나 메모가 덮어씌워지지 않는다.

---

## 함정 5: 서버 액션에 이메일 하드코딩

이건 좀 부끄러운 버그다.

### 문제

개발 초기에 "어차피 나만 쓰니까" 하고 프로파일 페이지를 이렇게 짰다.

```typescript
// 실제 코드에 이런 게 있었다...
const { data: profile } = await supabaseAdmin
  .from('profiles')
  .select('*')
  .eq('email', 'hyunseok.yu1@gmail.com')  // 하드코딩
  .single()
```

프로파일 저장 액션도 마찬가지였다.

```typescript
// 저장도 이메일로 필터
.eq('email', email)   // email을 session에서 가져오긴 했지만
```

`email` 컬럼으로 필터를 거는 것도 문제다. 이메일은 변경될 수 있고, `id`(UUID)가 훨씬 안정적인 식별자다.

### 해결

로그인한 유저의 이메일을 동적으로 조회하고, 이메일이 아닌 `id`로 필터를 걸도록 수정했다.

```typescript
// profile/page.tsx
const email = await getAuthUserEmail()
if (!email) redirect('/login')

const profile = await getOrCreateProfile(email)
```

```typescript
// profile/actions.ts
const profile = await getOrCreateProfile(email)
if (!profile) return { error: 'Profile not found' }

await supabaseAdmin
  .from('profiles')
  .update({ ... })
  .eq('id', profile.id)  // email → id로 변경
```

---

## 정리: service role 앱에서 데이터 격리 체크리스트

RLS를 쓰지 않고 service role로 멀티 유저 앱을 만든다면, 아래 항목을 반드시 확인해야 한다.

**DB 설계 단계**
- [ ] 유저별 데이터는 `user_id` 컬럼이 있는 테이블(또는 유저별 연결 테이블)에 저장
- [ ] 공유 테이블(`jobs` 같은)에 유저별 데이터(`memo`, `status` 등)를 절대 넣지 않기
- [ ] 유저별 테이블에 `UNIQUE(user_id, 다른_키)` constraint 추가로 upsert 안전하게

**쿼리 작성 단계**
- [ ] 모든 조회/수정 쿼리에 `.eq('user_id', profile.id)` 필터 확인
- [ ] PostgREST 관계 필터(`.eq('관계테이블.user_id', ...)`)는 service role에서 동작 안 함 → 2단계 쿼리로 대체
- [ ] 새 데이터 생성 시 연결 테이블(`matches` 등)에도 함께 등록

**코드 작성 단계**
- [ ] 이메일·유저명 하드코딩 절대 금지
- [ ] 유저 식별은 항상 session의 UUID `id` 기준으로
- [ ] 미로그인 시 `/login` redirect 처리

---

사실 RLS를 처음부터 쓰는 게 정석이긴 하다. 하지만 서버 액션 위주로 만들다 보면 service role이 편하다 보니, 이런 실수가 생기기 쉽다. 지금이라도 하나씩 잡아나가고 있으니 다행이라고 생각한다.

다음에 Supabase 프로젝트를 새로 시작한다면, 아마 처음부터 RLS를 켜고 시작할 것 같다. 아니면 적어도 이 체크리스트를 옆에 두고 짤 것이다.
