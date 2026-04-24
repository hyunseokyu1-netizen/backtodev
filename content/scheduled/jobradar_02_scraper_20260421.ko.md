---
title: 'JobRadar 2편: Supabase 설계 + Playwright 스크래퍼 — 삽질 기록'
date: '2026-04-21'
publish_date: '2026-04-25'
description: JobRadar 2편. Supabase 멀티유저 스키마 설계부터 Indeed · Seek Playwright 스크래퍼 구현까지. Glassdoor 차단, ETXTBSY, 모듈 누락까지 삽질 과정 전부 정리.
tags:
  - JobRadar
  - Playwright
  - Supabase
  - 스크래핑
---

호주/NZ IT 취업을 준비하면서 매일 반복하는 루틴이 생겼다.

1. Indeed 열기 → "React Native developer Sydney" 검색
2. Seek 열기 → 동일 검색
3. 어제 본 것들 다시 스크롤
4. 비슷한 공고인지 기억 안 나서 또 읽기
5. 결국 아무것도 안 지원하고 탭 닫기

이걸 매일 하고 있으니 효율이 0에 수렴했다. 그래서 생각했다.

> "이거 자동화하면 되잖아?"

목표는 단순했다. **매일 아침, 내 스킬에 맞는 공고 TOP 10이 이메일로 오면 된다.** 거기에 Claude API로 커버레터까지 자동 생성되면 더 좋고.

이번 편에서는 Supabase 스키마 설계와 Playwright 스크래퍼 구현, 그리고 거기서 만난 삽질들을 다룬다.

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Next.js 14 App Router + TypeScript |
| DB | Supabase (PostgreSQL) |
| AI | Claude API (Anthropic) |
| 스크래핑 | Playwright + @sparticuz/chromium |
| 이메일 | Resend |
| 배포 | Vercel + Vercel Cron |

---

## Step 1 — Supabase 스키마 설계

### 테이블 구조

```
auth.users (Supabase 관리)
    ↓ 1:1
profiles (유저 프로파일)
    ↓
matches (AI 매칭 결과) → jobs (전체 채용공고 풀)
    ↓
cover_letters (커버레터)
```

`jobs`는 모든 유저가 공유하는 채용공고 풀이다. `matches`와 `cover_letters`는 유저별로 분리된다.

### profiles 테이블

```sql
CREATE TABLE profiles (
  id                UUID PRIMARY KEY REFERENCES auth.users(id),
  email             TEXT,
  name              TEXT,
  skills            TEXT[],
  desired_positions TEXT[],   -- ['React Native developer', 'Fullstack developer']
  desired_sources   TEXT[] DEFAULT ARRAY['indeed'],
  desired_locations TEXT[] DEFAULT ARRAY['Sydney NSW'],
  career_summary    TEXT,
  story             TEXT,     -- 커버레터에 재사용할 커리어 스토리
  resume_text       TEXT,
  preferences       JSONB
);
```

핵심은 `desired_positions`, `desired_sources`, `desired_locations`다. 스크래퍼가 이 값들을 읽어서 "어디서, 무엇을, 어떤 키워드로" 검색할지 결정한다.

### 신규 가입 시 프로파일 자동 생성

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### RLS (Row Level Security)

```sql
CREATE POLICY "profiles: 본인만 조회" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "jobs: 인증 유저 전체 조회" ON jobs
  FOR SELECT TO authenticated USING (true);
```

RLS 덕분에 유저 A가 유저 B의 매칭 결과나 커버레터를 못 본다. 멀티유저 SaaS에서는 이게 기본이다.

### 스크래퍼는 service role key 필요

RLS를 켜면 인증되지 않은 요청은 모두 막힌다. Vercel Cron으로 돌아가는 스크래퍼는 유저 세션이 없기 때문에 **service role key**가 필요하다.

```typescript
// src/lib/supabase-admin.ts
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,  // RLS 우회
  { auth: { autoRefreshToken: false, persistSession: false } }
)
```

---

## Step 2 — 스크래퍼 만들기

### 원래 계획 vs 현실

처음 계획은 **Indeed + Glassdoor** 두 곳을 스크래핑하는 것이었다.

현실은 달랐다.

```
Glassdoor 접근 시도 → "Just a moment..." → 10분 대기 → 또 CAPTCHA
playwright-extra stealth 적용 → 그래도 차단
API 엔드포인트 직접 시도 → 403
```

Glassdoor는 Cloudflare로 완전 차단이었다. 미련 없이 **Seek.com.au**로 교체했다. Seek은 호주/NZ 1위 잡보드이고 봇 차단도 훨씬 느슨하다.

### Indeed 스크래퍼 — 패널 클릭 방식

Indeed도 한 가지 함정이 있었다.

```
// 처음 시도한 방법 — 차단됨
await page.goto(`https://au.indeed.com/viewjob?jk=${jobId}`)
// → "We're sorry, this job is no longer available"
```

공고 목록에서 직접 URL을 추출해서 이동하면 차단된다. 해결책은 **패널 클릭 방식**이다. 목록 페이지에서 공고 카드를 클릭하면 오른쪽에 패널이 열리는데, 거기서 JD를 추출한다.

```typescript
for (const card of jobCards) {
  await card.click()
  await page.waitForTimeout(1500)
  const description = await page.$eval(
    '#jobDescriptionText',
    el => el.textContent?.trim() ?? null
  ).catch(() => null)
}
```

### Seek 스크래퍼 — URL 슬러그 변환

Seek의 URL 형식:

```
https://www.seek.com.au/react-native-developer-jobs/in-Sydney-NSW?daterange=7
```

`"React Native developer"` → `"react-native-developer"` 변환이 필요했다.

```typescript
function toSeekSlug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
```

### 프로파일 기반 동적 타겟

하드코딩 없이 유저 프로파일에서 스크래핑 대상을 읽는다.

```typescript
async function collectScrapeTargets(): Promise<ScrapeTarget[]> {
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('desired_positions, desired_locations, desired_sources')
    .not('desired_positions', 'is', null)
    .contains('desired_sources', ['seek'])

  const seen = new Set<string>()
  const targets: ScrapeTarget[] = []

  for (const profile of profiles ?? []) {
    for (const keyword of profile.desired_positions) {
      for (const location of profile.desired_locations) {
        const key = `${keyword}|${location}`
        if (!seen.has(key)) {
          seen.add(key)
          targets.push({ keyword, location })
        }
      }
    }
  }
  return targets
}
```

---

## Step 3 — Vercel Cron 자동화

```json
{
  "crons": [
    {
      "path": "/api/scrape",
      "schedule": "0 22 * * *"
    }
  ]
}
```

22:00 UTC = 08:00 AEST (시드니 기준 아침 8시). 매일 출근 전에 공고가 쌓이도록.

```typescript
// src/app/api/scrape/route.ts
export const maxDuration = 300

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { scrapeIndeed } = await import('@/lib/scrapers/indeed')
  const { scrapeSeek } = await import('@/lib/scrapers/seek')

  // 순차 실행 — 동시 실행하면 /tmp/chromium ETXTBSY 에러 발생
  const indeedResult = await scrapeIndeed().catch(e => ({ error: String(e) }))
  const seekResult = await scrapeSeek().catch(e => ({ error: String(e) }))

  return NextResponse.json({ ok: true, indeed: indeedResult, seek: seekResult })
}
```

---

## 삽질 기록

### 1. Glassdoor 완전 차단

**증상**: playwright-extra + stealth 적용해도 "Just a moment..." 무한 로딩  
**원인**: Cloudflare Enterprise급 봇 차단  
**해결**: Seek.com.au로 교체

### 2. Indeed viewjob URL 직접 접근 차단

**증상**: `viewjob?jk=xxx` 접근 시 "job no longer available"  
**원인**: 목록 페이지를 거치지 않은 직접 접근 감지  
**해결**: 목록 페이지에서 카드 클릭 → 패널 JD 추출

### 3. Vercel Lambda에서 playwright-extra 모듈 누락

**증상**: `Cannot find module 'is-plain-object'`  
**원인**: playwright-extra의 동적 require 의존성을 Next.js File Tracer가 포함시키지 못함  
**해결**: playwright-extra 완전 제거, `playwright-core` 직접 사용

### 4. ETXTBSY — Chromium 바이너리 충돌

**증상**: `spawn ETXTBSY`  
**원인**: Indeed, Seek 동시 실행 시 `/tmp/chromium` 충돌  
**해결**: 순차 실행으로 변경

### 5. Vercel US 서버 → AU 잡보드 결과 0

**증상**: 스크래퍼 정상 실행, `targets: 12`인데 `inserted: 0`  
**원인**: Vercel Hobby 플랜은 Washington DC에서 실행됨. 미국 IP로 접근하면 결과가 달라지거나 봇으로 감지됨  
**현재 상태**: 인프라는 완성. 스크래핑 품질 개선은 다음 과제

---

## 트러블슈팅 요약

| 에러 | 원인 | 해결 |
|------|------|------|
| `Just a moment...` | Cloudflare 차단 | 다른 잡보드로 교체 |
| `viewjob 차단` | 직접 URL 감지 | 패널 클릭 방식 |
| `Cannot find module` | lazy-cache 동적 require | playwright-extra 제거 |
| `spawn ETXTBSY` | Chromium 바이너리 동시 실행 | 순차 실행 |
| `inserted: 0` | 미국 서버 위치 | 개선 예정 |

---

## 정리 — 핵심 흐름 한눈에

```
Vercel Cron (매일 08:00 AEST)
    ↓
/api/scrape (Bearer 인증)
    ↓
Supabase profiles 읽기 (service role)
    → desired_positions × desired_locations 조합 생성
    ↓
Indeed 스크래퍼 (패널 클릭 방식)
    ↓
Seek 스크래퍼
    ↓
jobs 테이블 upsert (URL 기준 중복 제거)
```

인프라가 갖춰졌으니 이제 진짜 핵심인 AI 매칭 엔진을 만들 차례다. 3편에서 계속.
