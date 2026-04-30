---
title: '[JobRadar 7편] Google OAuth "Database error" — Supabase 트리거 버그 찾기까지'
date: '2026-04-28'
publish_date: '2026-05-02'
description: Google 로그인이 "Database error saving new user"로 계속 실패하는 이유를 찾아 새 프로젝트까지 팠다가, 결국 트리거 함수 한 줄로 해결한 삽질기
tags:
  - JobRadar
  - Supabase
  - OAuth
  - 디버깅
  - 사이드프로젝트
---

로그인 기능을 붙이고 배포했다. 이메일은 됐다. 근데 Google 버튼을 누르면 계속 로그인 페이지로 튕겨나온다.

에러 메시지조차 없다. URL에 `#error=server_error&error_description=Database+error+saving+new+user`가 달려있을 뿐이다. 페이지가 새로고침되니까 `console.log`도 날아간다.

오늘은 이 에러 하나 잡으려다 새 Supabase 프로젝트까지 만들고, psql 설치하고, Management API까지 두드리고, 결국 트리거 함수 한 줄로 끝난 이야기다.

---

## 전체 삽질 타임라인

```
이메일 로그인 → hasSession: false
  → Confirm email 설정 OFF → 해결

Google 로그인 → "Database error saving new user"
  → confirmation_token 버그 의심
  → SQL Editor: 권한 없음 (auth.users는 supabase_admin 소유)
  → psql / CLI / Management API: 모두 권한 없음 또는 IPv6 실패
  → 새 Supabase 프로젝트 생성 → 여전히 같은 에러
  → Management API로 컬럼 상태 확인 → confirmation_token은 정상
  → 트리거 함수 발견 → SET search_path 누락 → 해결
```

---

## Step 1 — localStorage에 로그 남기기

`console.log`는 페이지 이동과 함께 사라지니까, localStorage에 결과를 저장하도록 코드를 수정했다.

```typescript
const { data, error } = await supabase.auth.signInWithPassword({ email, password })
localStorage.setItem('__login_debug__', JSON.stringify({
  error: error?.message ?? null,
  hasSession: !!data.session,
  userEmail: data.user?.email ?? null,
}))
```

이메일 로그인이 `hasSession: false`로 뜨는 걸 발견했다. 로그인은 성공했는데 세션이 없어서 미들웨어가 다시 `/login`으로 보내는 구조였다.

**증상**: 로그인 성공인데 세션 null  
**원인**: 이메일 인증을 완료하지 않은 계정 → `signInWithPassword` 성공해도 세션 null 반환  
**해결**: Supabase → Authentication → Email → "Confirm email" OFF

이메일은 해결됐다. 그런데 Google은 여전히 `Database error saving new user`. 이건 다른 문제다.

---

## Step 2 — confirmation_token 버그 의심

처음엔 유명한 Supabase `confirmation_token` 버그를 의심했다. `auth.users`의 `confirmation_token` 컬럼에 NOT NULL 제약이 걸려있는데 DEFAULT가 없어서, OAuth 유저 생성 시 NULL이 들어가려다 실패하는 문제다.

이걸 고치려면:

```sql
ALTER TABLE auth.users ALTER COLUMN confirmation_token SET DEFAULT '';
```

근데 Supabase SQL Editor에서 돌리면:

```
ERROR: 42501: must be owner of table users
```

`auth.users`는 `supabase_admin` 소유라 `postgres`로는 못 건드린다.

---

## Step 3 — 연결 방법 총동원

| 방법 | 결과 |
|------|------|
| Supabase SQL Editor | 권한 없음 |
| psql 직접 연결 | IPv6만 있어서 No route to host |
| Supabase CLI `db query` | 동일하게 IPv6 연결 실패 |
| Session Pooler (IPv4) | 연결은 됐지만 권한 없음 |
| Management API (`api.supabase.com`) | 권한 없음 |

`supabase_admin` 권한은 Supabase 인프라 레벨에서만 접근 가능하다는 걸 여기서 알게 됐다.

---

## Step 4 — 새 Supabase 프로젝트 생성

기존 프로젝트 스키마가 망가진 게 아닐까 싶어서 새 프로젝트를 만들었다. 지금까지 쌓인 마이그레이션 파일들을 하나로 정리해서 SQL Editor에서 한 번에 실행했다.

```sql
-- 기존 schema.sql + migration 파일들을 통합
CREATE TABLE profiles ( ... );
CREATE TABLE jobs ( id UUID, ..., memo TEXT, ... );
CREATE TABLE matches ( ... );
CREATE TABLE cover_letters ( ... );
-- RLS 정책들...
```

`.env.local`과 Vercel 환경변수도 새 프로젝트 키로 교체 후 재배포.

근데 **여전히 같은 에러**. 새 프로젝트도 안 됐다. 이쯤에서 `confirmation_token`이 원인이 아닐 수 있다는 생각이 들었다.

---

## Step 5 — Management API로 컬럼 상태 직접 확인

실제로 `confirmation_token`이 문제인지 Management API로 직접 조회해봤다.

```bash
curl -X POST "https://api.supabase.com/v1/projects/{ref}/database/query" \
  -H "Authorization: Bearer {PAT}" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT column_name, is_nullable FROM information_schema.columns WHERE table_schema = '\''auth'\'' AND table_name = '\''users'\'' AND column_name = '\''confirmation_token'\''"}'
```

결과: `is_nullable: YES`

**`confirmation_token` 버그가 아니었다.** 새 프로젝트는 이미 nullable로 되어있다. 3시간을 엉뚱한 방향으로 팠다.

---

## Step 6 — 트리거 발견, 진짜 원인

트리거를 확인해봤다.

```sql
SELECT trigger_name FROM information_schema.triggers WHERE trigger_schema = 'auth';
-- 결과: on_auth_user_created
```

트리거 함수 내용을 보니:

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;
```

문제는 `SET search_path`가 없다는 것. `SECURITY DEFINER` 함수는 함수 소유자의 권한으로 실행되는데, `search_path`가 설정되지 않으면 어떤 스키마에서 `profiles`를 찾을지 모른다. 로컬에서는 기본 search_path 덕분에 잘 됐다가, 프로덕션 OAuth 흐름에서만 터지는 유형의 버그였다.

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
```

두 가지 변경:
1. `SET search_path = public` — `profiles` 테이블을 public 스키마에서 명시적으로 찾기
2. `ON CONFLICT (id) DO NOTHING` — 중복 유저가 들어와도 에러 없이 넘어가기

Management API로 함수 업데이트 후 Google 로그인 시도 → 성공.

---

## 삽질하는 동안 모바일 반응형도 손봤다

OAuth 디버깅하면서 모바일에서 UI가 깨지는 것도 발견해서 같이 정리했다.

**AddJobForm** — 모바일에서 입력창 + 버튼이 옆으로 넘치는 문제

```tsx
// 전: flex gap-2
// 후: 모바일에서 세로 스택
<form className="flex flex-col sm:flex-row gap-2">
```

**JobList 카드** — 액션 버튼이 좌측 내용과 겹치는 문제

```tsx
// 콘텐츠 아래에 버튼 묶기
<div className="flex items-center gap-2 mt-2.5 flex-wrap">
  <button>JD 입력</button>
  <button>메모</button>
  <button>커버레터</button>
</div>
// 우측에는 보기/삭제만
<div className="flex items-center gap-1.5 shrink-0">
  <a>보기 →</a>
  <button>✕</button>
</div>
```

**ProfileForm** — 연봉 입력 필드 너비 고정으로 잘리는 문제

```tsx
// 전: className="input w-36"
// 후: className="input flex-1 min-w-0"
```

---

## 트러블슈팅

**"Database error saving new user"는 트리거 실패일 수 있다**

GoTrue가 이 에러를 반환하는 경우는 두 가지다. `auth.users` INSERT 자체 실패, 또는 그 이후 실행되는 트리거 함수 실패. 둘 다 같은 메시지로 묶여 나온다.

**해결**: `information_schema.triggers`로 트리거 존재 여부를 먼저 확인하고, 함수 내용도 점검하자.

**SECURITY DEFINER 함수에 SET search_path 누락**

`SECURITY DEFINER`로 선언한 함수에 `SET search_path`가 없으면, 프로덕션 환경에서 스키마를 못 찾는 경우가 있다. 로컬에서는 기본 search_path가 맞아서 잘 되다가 배포 후에만 터진다.

**해결**: 함수 선언에 `SET search_path = public` 추가. 테이블 참조도 `public.profiles`처럼 스키마 명시.

**Supabase auth 스키마는 직접 못 건드린다**

SQL Editor, psql, CLI, Management API 모두 `auth.users` DDL 권한이 없다. `supabase_admin` 소유 테이블이라 Supabase 인프라 레벨에서만 접근 가능하다.

**해결**: `auth` 스키마 직접 수정을 포기하고, 실제로 그게 원인이 맞는지 먼저 검증하는 방향으로 전환.

---

## 정리 — 핵심 흐름 한눈에

```
Google 로그인 버튼 클릭
        ↓
Google 계정 선택
        ↓
Supabase GoTrue: auth.users에 신규 유저 INSERT
        ↓
on_auth_user_created 트리거 실행
  → handle_new_user() 호출
  → [수정 전] search_path 미설정 → profiles 테이블 못 찾음 → 에러
  → [수정 후] SET search_path = public → profiles INSERT 성공
        ↓
/auth/callback → 세션 교환 → 대시보드 이동 ✅
```

결국 원인은 트리거 함수 선언 한 줄이었다. 3시간 동안 `confirmation_token`, psql 연결, 새 프로젝트 생성까지 다 해봤는데. 에러 메시지를 곧이곧대로 믿지 말자는 교훈이 생겼다. "Database error saving new user"가 user 저장 실패인 줄 알았는데, 실제로는 그 다음 트리거 실패였다.

다음 편에서는 잡 상세 페이지(`/jobs/[id]`)를 만들 예정이다. JD 전문과 매칭 결과, 커버레터를 한 페이지에서 볼 수 있게.

---

*JobRadar 개발기 시리즈*
- [1편: Next.js + Supabase 프로젝트 셋업](/posts/jobradar_01_setup_20260420)
- [2편: Supabase 설계 + Playwright 스크래퍼](/posts/jobradar_02_scraper_20260421)
- [3편: Vercel에 Playwright 올렸더니 터졌다](/posts/jobradar_03_vercel_playwright_20260422)
- [4편: Playwright 버리고 cheerio로 갈아탔다](/posts/jobradar_04_url_scraper_20260423)
- [5편: on-demand 파이프라인 완성](/posts/jobradar_05_coverletter_pipeline_20260424)
- [6편: 커버레터 완성 + Auth](/posts/jobradar_06_auth_ux_20260427)
- **7편: Google OAuth 디버깅 (현재)**
