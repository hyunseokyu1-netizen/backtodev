---
title: '매치다 안전하게 만들기 ①: "보안 문제 없는지 확인해줘" 한 마디로 시작한 진단'
date: '2026-07-07'
publish_date: '2026-08-19'
description: 서비스 전체를 훑어보다 발견한 인증 누락, 크로스유저 삭제 버그, 공개 리포에 박힌 평문 비밀번호를 정리한 보안 점검 기록
tags:
  - 보안점검
  - Next.js
  - Supabase
  - RLS
  - 서버액션
---

## 왜 지금 보안 점검이 필요했나

서비스를 만들다 보면 "기능이 되냐 안 되냐"에 매몰돼서, "이 기능을 아무나 함부로 못 쓰게 막았나"는 뒤로 밀리기 쉽습니다. 저도 그랬습니다. 매치다(MatchDa)는 이력서·커버레터·채용공고 데이터를 다루는 서비스라 개인정보가 꽤 오갑니다. 그런데 기능 하나하나를 만들 때는 "로그인 확인 넣었나?"를 매번 챙겼어도, 전체를 놓고 훑어본 적은 없었습니다.

그래서 "사이트 보안문제 없는지 확인해줘"라고 통째로 점검을 요청했습니다. 코드를 하나씩 새로 짜는 게 아니라, **이미 만들어둔 걸 의심하는 작업**입니다. 개발 재입문자 입장에서 이 태도가 은근히 중요한데, "내가 짰으니 맞겠지"라는 전제를 버려야 진짜 문제가 보이거든요.

## 점검 범위 — 어디를 봐야 하나

Next.js App Router + Supabase 조합에서 보안 점검을 한다면 아래 네 갈래를 훑으면 됩니다.

1. **API 라우트** (`src/app/api/*/route.ts`) — 인증 헤더를 제대로 검사하는가
2. **서버 액션** (`'use server'` 파일들) — 로그인·소유권 확인 없이 DB를 건드리는 곳이 있는가
3. **RLS(Row Level Security) 정책** — `supabaseAdmin`(service role)이 RLS를 우회하는 만큼, 코드 레벨에서 `user_id` 필터를 빼먹은 곳이 없는가
4. **git 히스토리·환경변수** — 시크릿이 커밋된 적은 없는가

이 넷을 훑으면 대부분의 구멍은 잡힙니다.

## 발견 1 — 미들웨어가 `/api`를 아예 빼놓고 있었다

```ts
// src/middleware.ts
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|auth/callback).*)'],
}
```

matcher에 `api`가 제외돼 있습니다. 페이지 라우트는 미들웨어가 로그인 여부를 확인하지만, **API 라우트는 미들웨어를 아예 거치지 않습니다.** 그러니 API 라우트 안에서 인증을 직접 처리해야 하는데, `/api/scrape-url`이 그걸 빼먹고 있었습니다.

```ts
// Before
export async function POST(request: Request) {
  const { jobId } = await request.json()
  if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 })

  const { data: job } = await supabaseAdmin
    .from('jobs')
    .select('id, url, source, title, description')
    .eq('id', jobId)
    .single()
  // 곧바로 스크래핑 실행...
}
```

로그인 여부와 관계없이 `jobId`만 있으면 누구나 호출할 수 있었습니다. 임의의 `jobId`를 넣어 스크래핑을 유발할 수 있으니 비용 유발은 물론, 외부 URL을 서버가 대신 요청하게 만드는 SSRF 성격도 있습니다.

고친 방식은 다른 서버 액션들과 패턴을 맞췄습니다.

```ts
// After
export async function POST(request: Request) {
  const email = await getAuthUserEmail()
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getOrCreateProfile(email)
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 401 })

  const { jobId } = await request.json()
  if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 })

  // 내 지원 목록(matches)에 있는 공고만 스크래핑 허용
  const { data: myMatch } = await supabaseAdmin
    .from('matches')
    .select('job_id')
    .eq('user_id', profile.id)
    .eq('job_id', jobId)
    .maybeSingle()
  if (!myMatch) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // ...이후 스크래핑 로직
}
```

여기서 배운 점: 로그인 확인만으로는 부족합니다. **"로그인은 했는데 남의 데이터에 접근하는 것"까지 막아야** 진짜 보안입니다. 그래서 `matches` 테이블에서 "이 유저가 이 공고를 자기 목록에 넣었는가"까지 확인합니다.

## 발견 2 — `deleteJob`이 다른 유저의 데이터까지 지우고 있었다

이게 이번 점검에서 제일 아찔했던 부분입니다. 코드를 봤을 때는 그냥 "인증 없음" 정도로 보였는데, 실제로는 그보다 더 심각한 설계 결함이 숨어 있었습니다.

```ts
// Before
export async function deleteJob(jobId: string): Promise<{ error?: string }> {
  await supabaseAdmin.from('matches').delete().eq('job_id', jobId)
  const { error } = await supabaseAdmin.from('jobs').delete().eq('id', jobId)
  if (error) return { error: error.message }
  revalidatePath('/')
  return {}
}
```

`matches.delete().eq('job_id', jobId)` — 여기 `user_id` 조건이 없습니다. 매치다의 `jobs` 테이블은 여러 유저가 공유하는 풀(pool)입니다. 채용공고 하나를 여러 명이 각자 자기 지원 목록(`matches`)에 담아둘 수 있는 구조죠. 그런데 이 함수는 **jobId 하나로 해당 공고와 관련된 모든 유저의 matches를 통째로 지웁니다.** 즉 A가 "이 공고 삭제"를 누르면, 같은 공고를 담아둔 B·C의 지원 현황에서도 그 공고가 사라집니다.

인증이 없다는 것보다 더 근본적인 문제는 **"삭제"라는 동작의 의미 자체가 잘못 설계돼 있었다**는 것입니다. UI에서 "삭제"는 "내 목록에서 빼기"를 의미하는데, 코드는 "공유 데이터 자체를 파괴하기"로 동작하고 있었습니다.

고칠 때는 인증을 추가하는 데서 그치지 않고 동작 자체를 다시 정의했습니다.

```ts
// After — 공유 jobs 풀은 여러 유저가 함께 쓰므로,
// "삭제"는 내 목록(matches)에서만 제거한다.
export async function deleteJob(jobId: string): Promise<{ error?: string }> {
  const email = await getAuthUserEmail()
  if (!email) return { error: '로그인이 필요합니다.' }

  const profile = await getOrCreateProfile(email)
  if (!profile) return { error: 'Profile not found' }

  const { error } = await supabaseAdmin
    .from('matches')
    .delete()
    .eq('user_id', profile.id)
    .eq('job_id', jobId)
  if (error) return { error: error.message }
  revalidatePath('/')
  return {}
}
```

공유 `jobs` 행과 다른 유저의 `matches`는 절대 건드리지 않습니다. 오직 호출한 사람 본인의 match만 지웁니다.

> 여기서 얻은 교훈: **공유 데이터와 유저별 데이터가 섞인 구조에서는, "삭제"·"수정" 같은 동사 하나하나가 정확히 무엇을 지우는지 반드시 확인해야 합니다.** `.eq('job_id', jobId)`만 있고 `.eq('user_id', ...)`가 없는 쿼리를 볼 때마다 "이거 다른 사람 것도 건드리는 거 아닌가?"를 습관적으로 의심하게 됐습니다.

같은 관점으로 `updateJobDescription`(공유 공고 필드를 아무나 수정 가능했던 함수)에도 "내 매치 목록에 있는 공고인지" 소유권 확인을 추가했고, `translateCoverLetter`에는 로그인 확인이 빠져 있어 추가했습니다.

## 발견 3 — 공개 GitHub 리포에 평문 비밀번호가 박혀 있었다

이건 코드 로직 문제가 아니라 그냥 실수였습니다. 초기에 특정 계정을 시딩하려고 만든 SQL 파일에 비밀번호가 그대로 들어가 있었습니다.

```sql
-- supabase/migrations/002_seed_hyunseok_profile.sql (수정 전)
INSERT INTO auth.users (id, email, encrypted_password, ...)
VALUES (
  gen_random_uuid(),
  'user@example.com',
  crypt('MyPassword2026!', gen_salt('bf')),
  ...
);
```

그리고 이 리포는 **GitHub 퍼블릭**이었습니다. `gh repo view --json visibility`로 확인하니 바로 나오더군요.

```bash
gh repo view <owner>/<repo> --json visibility -q .visibility
# PUBLIC
```

다행히 이 비밀번호는 실사용 중이 아니라 실질적 피해는 없었지만, "공개 저장소에 시크릿을 커밋하면 무슨 일이 벌어지는가"를 체감하는 계기였습니다. 이 부분은 다음 편에서 git 히스토리 정리와 함께 자세히 다룹니다.

## 점검할 때 실제로 쓴 명령어들

```bash
# 1. API 라우트 전수 확인
find src/app/api -name "route.ts" | xargs cat

# 2. 서버 액션에서 인증 체크 누락 찾기 (직관적이진 않지만 빠름)
grep -rn "'use server'" src/ --include="*.ts"
grep -L "getAuthUserEmail" src/app/**/actions.ts   # 인증 호출이 없는 파일 찾기

# 3. supabaseAdmin(RLS 우회) 사용처와 user_id 필터 여부 대조
grep -n "supabaseAdmin" src/app/actions.ts

# 4. 리포 공개 여부
gh repo view <owner>/<repo> --json visibility -q .visibility

# 5. git 히스토리에 시크릿 패턴이 있는지 스캔
git grep -iE "sk-ant|sk_live|sk_test|eyJhbGciOi" $(git rev-list --all) -- . 2>/dev/null
```

`grep -L "getAuthUserEmail"`처럼 "이 패턴이 없는 파일 찾기"는 서버 액션 인증 누락을 빠르게 훑을 때 꽤 유용했습니다.

## 정리

이번 점검에서 가장 크게 배운 건 두 가지입니다.

- **"인증이 있다/없다"보다 더 중요한 건 "인증된 사람이 정확히 자기 데이터만 건드리는가"** 입니다. `deleteJob` 사례처럼, 로그인 확인이 있어도 소유권 필터(`user_id` 매칭)가 빠지면 크로스유저 사고가 납니다.
- **API 라우트는 미들웨어를 믿지 말고 라우트 안에서 직접 인증하기.** Next.js 미들웨어 matcher에서 `/api`를 제외하는 건 흔한 패턴인데, 그만큼 라우트 핸들러 자체가 인증의 마지막 방어선이라는 뜻입니다.

발견한 문제는 이렇게 정리됩니다.

| 문제 | 심각도 | 조치 |
|---|---|---|
| `/api/scrape-url` 인증 없음 | 높음 | 로그인 + 소유권 검사 추가 |
| `deleteJob` 크로스유저 삭제 | 높음 | 본인 match만 삭제하도록 재설계 |
| `updateJobDescription` 소유권 검사 없음 | 중간 | matches 소유권 확인 추가 |
| `translateCoverLetter` 인증 없음 | 낮음(비용 유발) | 로그인 확인 추가 |
| 공개 리포에 평문 비밀번호 | 심각(공개 노출) | 다음 편에서 히스토리 정리 |

다음 편에서는 이 비밀번호를 git 히스토리에서 완전히 지우는 과정 — `git-filter-repo`로 174개 커밋을 재작성하고 force-push까지 한 이야기를 다룹니다.
