---
title: '[JobRadar 6편] 커버레터 완성, UX 개선, 그리고 로그인 붙이기'
date: '2026-04-27'
publish_date: '2026-05-01'
description: 커버레터 저장/다운로드/AI재검토, 메모·상태 관리, JD 직접 입력, Supabase Auth까지 하루에 몰아서 만든 이야기
tags:
  - JobRadar
  - Supabase
  - NextJS
  - TypeScript
  - 사이드프로젝트
---

지난 5편에서 URL을 붙여넣으면 JD 스크래핑 → AI 매칭까지 자동으로 돌아가는 파이프라인을 만들었다. 이번엔 그 위에 살을 붙이는 작업이다.

"커버레터를 생성했는데 새로고침하면 사라진다"는 치명적인 문제부터, 지원 상태를 의미 있게 관리하고 싶다는 니즈, 그리고 혼자만 쓰는 앱을 진짜 서비스처럼 만들기 위한 로그인까지. 오늘 하루에 다 만들었다.

---

## 만든 것들 한눈에

| 기능 | 내용 |
|------|------|
| 커버레터 영구 저장 | 모달 열면 기존 내용 자동 로드, 편집 후 저장 |
| 커버레터 다운로드 | TXT / DOCX / PDF 클라이언트 사이드 생성 |
| AI 재검토 | 내가 수정한 내용 기반으로 Claude가 표현 개선 |
| JD 직접 입력 | Glassdoor 등 스크래핑 불가 사이트용 |
| 메모 | 공고별 메모 입력/저장 |
| 지원 상태 개편 | 미분류 → 관심있음 → 고민중 → 지원완료 → 패스 |
| 로그인/회원가입 | Supabase Auth (이메일 + Google OAuth) |
| 미들웨어 라우트 보호 | 미로그인 시 /login 자동 이동 |

---

## Step 1 — 커버레터: 새로고침해도 안 사라지게

가장 먼저 고쳐야 했던 것. 커버레터를 열면 항상 빈 화면이고, 생성해도 새로고침하면 사라졌다.

`cover_letters` 테이블은 이미 있었다. 문제는 모달이 열릴 때 기존 데이터를 불러오지 않는다는 것.

```typescript
// CoverLetterModal.tsx
useEffect(() => {
  getCoverLetter(jobId).then(res => {
    if (res.content) {
      setContent(res.content)
      setSavedContent(res.content)
    }
    setState('idle')
  })
}, [jobId])
```

모달이 열리는 순간 DB에서 기존 커버레터를 당겨온다. 있으면 바로 편집 가능 상태로, 없으면 생성 버튼이 나타난다.

편집 후 저장하려면 "저장" 버튼이 필요했다. 근데 항상 보여주면 지저분하니까 — **수정이 있을 때만** 보이게 했다.

```typescript
const isDirty = content !== savedContent

{isDirty && (
  <button onClick={handleSave}>저장</button>
)}
```

`savedContent`는 DB에서 불러온 원본, `content`는 현재 textarea 값. 둘이 다르면 저장 버튼 등장.

---

## Step 2 — 커버레터 다운로드 (TXT / DOCX / PDF)

세 가지 포맷을 모두 클라이언트 사이드에서 생성한다. 서버 API 호출 없이.

```bash
npm install docx jspdf
```

**TXT** — 가장 간단. Blob으로 만들어서 링크 클릭.

```typescript
async function downloadTxt(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.txt`
  a.click()
  URL.revokeObjectURL(url)
}
```

**DOCX** — `docx` 패키지로 단락 생성.

```typescript
async function downloadDocx(content: string, filename: string) {
  const { Document, Packer, Paragraph, TextRun } = await import('docx')
  const paragraphs = content.split('\n').map(line =>
    new Paragraph({ children: [new TextRun(line)] })
  )
  const doc = new Document({ sections: [{ children: paragraphs }] })
  const blob = await Packer.toBlob(doc)
  // ... 다운로드
}
```

**PDF** — `jspdf`로 텍스트를 페이지에 맞게 분할.

```typescript
async function downloadPdf(content: string, filename: string) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF()
  const lines = doc.splitTextToSize(content, 180) // 줄 자동 분할
  doc.setFontSize(11)
  doc.text(lines, 15, 20)
  doc.save(`${filename}.pdf`)
}
```

세 함수 모두 `await import()`로 동적 임포트한다. 번들 사이즈를 줄이고 필요할 때만 로드하기 위해서.

---

## Step 3 — AI 재검토 버튼

"재생성"은 처음부터 다시 쓰는 거고, "AI 재검토"는 내가 수정한 내용을 바탕으로 Claude가 표현만 다듬어주는 기능이다.

```typescript
// actions.ts
export async function reviewCoverLetter(jobId: string, content: string) {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `아래 커버레터의 내용과 구조는 유지하면서,
어색한 표현이나 반복, 어법 오류를 다듬어주세요.
개선된 버전만 출력해주세요.

## 현재 커버레터
${content}`,
    }],
  })
  // ...
}
```

프롬프트 핵심은 "내용 유지, 표현만 개선". 이렇게 하면 내가 공들여 수정한 내용이 날아가지 않는다.

---

## Step 4 — JD 직접 입력 (Glassdoor 대응)

Glassdoor는 Cloudflare가 막아서 JD를 못 긁어온다. URL 슬러그에서 직함/회사명만 가져올 수 있고, 실제 JD는 없다.

그래서 "JD 입력" 버튼을 만들었다. Glassdoor이거나 description이 200자 미만인 공고에 주황색 버튼이 뜬다.

```typescript
{(job.source === 'glassdoor' || !job.description || job.description.length < 200) && (
  <button onClick={() => setShowJdInput(true)}
    className="text-xs border border-orange-200 text-orange-600 ...">
    JD 입력
  </button>
)}
```

버튼을 누르면 모달이 뜨고, 공고 페이지에서 JD를 복사해 붙여넣은 다음 저장하면 자동으로 AI 매칭이 실행된다.

```typescript
// JdInputModal.tsx
async function handleSubmit() {
  await updateJobDescription(jobId, description) // 1. JD 저장
  const res = await matchSingleJob(jobId)        // 2. AI 매칭 자동 실행
  onMatched(res.score)
}
```

---

## Step 5 — 메모 + 지원 상태 개편

### 메모

공고별로 메모를 남기려면 `jobs` 테이블에 컬럼이 필요하다.

```sql
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS memo text;
```

카드에서 "메모" 버튼을 누르면 textarea가 토글된다. 저장하면 DB에 반영.

메모가 있으면 버튼이 노란색으로 강조 표시된다 — 내용이 있다는 시각적 신호.

```typescript
className={`... ${memo
  ? 'border-yellow-300 text-yellow-700 bg-yellow-50'
  : 'border-zinc-200'}`}
```

### 지원 상태 개편

기존 상태(`new / bookmarked / applied / pass`)가 너무 의미가 없었다. 실제 지원 흐름에 맞게 바꿨다.

| 기존 | 변경 |
|------|------|
| new | 미분류 |
| bookmarked | ⭐ 관심있음 |
| (없음) | 🤔 고민중 |
| applied | ✓ 지원완료 |
| pass | ✕ 패스 |

DB는 text 컬럼이라 마이그레이션 없이 새 값을 바로 쓸 수 있었다.

### 버그: 재매칭하면 상태가 'new'로 초기화

점수를 다시 매기면 `matches` 테이블을 upsert하는데, 코드에 `status: 'new'`가 하드코딩돼 있었다.

```typescript
// 수정 전 — 항상 'new'로 덮어씀
await supabaseAdmin.from('matches').upsert({
  ...result,
  status: 'new', // 💀
})

// 수정 후 — 기존 status 보존
const { data: existing } = await supabaseAdmin
  .from('matches').select('status')
  .eq('user_id', profile.id).eq('job_id', job.id).single()

await supabaseAdmin.from('matches').upsert({
  ...result,
  status: existing?.status ?? 'new', // ✅ 기존 상태 유지
})
```

"지원완료"로 표시해뒀던 공고를 재매칭하면 "미분류"로 돌아오는 황당한 일이 있었는데, 이걸로 해결됐다.

---

## Step 6 — Supabase Auth 로그인/회원가입

MVP 단계에서 이메일을 하드코딩해두고 혼자만 썼는데, 이제 진짜 로그인을 붙일 때가 됐다.

### @supabase/ssr 설치

```bash
npm install @supabase/ssr
```

App Router에서 쿠키 기반 세션을 다루려면 `@supabase/supabase-js` 대신 `@supabase/ssr`이 필요하다. 서버 컴포넌트에서 세션을 읽을 수 있게 해준다.

### 클라이언트 두 개

```typescript
// supabase-server.ts — 서버 컴포넌트/Server Action용
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options))
      },
    },
  })
}

// supabase-browser.ts — 클라이언트 컴포넌트용
export function createSupabaseBrowserClient() {
  return createBrowserClient(url, key)
}
```

### 미들웨어로 라우트 보호

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user && !pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|auth/callback).*)'],
}
```

`auth/callback`을 matcher에서 제외하는 게 중요하다. Google OAuth 콜백이 미들웨어에 막히면 세션 교환이 안 된다. 처음에 이걸 빠뜨려서 로그인하면 다시 로그인 페이지로 튕기는 버그가 생겼었다.

### Google OAuth + 콜백 처리

```typescript
// LoginForm.tsx
async function handleGoogleLogin() {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  })
}

// app/auth/callback/route.ts
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get('code')
  if (code) {
    const supabase = await createSupabaseServerClient()
    await supabase.auth.exchangeCodeForSession(code)
  }
  return NextResponse.redirect(new URL('/', request.url))
}
```

### 하드코딩 이메일 제거

`actions.ts`, `matching.ts`, `profile/actions.ts` 곳곳에 박혀있던 이메일 하드코딩을 전부 교체했다.

```typescript
// auth-helpers.ts
export async function getAuthUserEmail() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email ?? null
}

export async function getOrCreateProfile(email: string) {
  const { data: existing } = await supabaseAdmin
    .from('profiles').select('*').eq('email', email).single()

  if (existing) return existing

  // 첫 로그인 시 빈 프로파일 자동 생성
  const { data: created } = await supabaseAdmin
    .from('profiles').insert({ email, name: '' }).select().single()

  return created
}
```

모든 Server Action의 시작에 이걸 넣어줬다.

```typescript
const email = await getAuthUserEmail()
if (!email) return { error: '로그인이 필요합니다.' }
const profile = await getOrCreateProfile(email)
```

---

## 트러블슈팅

**Google OAuth 후 localhost로 리다이렉트**

Supabase Dashboard의 Site URL이 기본값 `localhost:3000`으로 설정돼 있어서 생긴 문제.

**해결**: Authentication → URL Configuration → Site URL을 Vercel 배포 URL로 변경.

**Google 로그인 후 다시 로그인 페이지로 튕김**

미들웨어 matcher에서 `auth/callback`을 제외 안 했을 때 발생. OAuth 콜백 URL에 미들웨어가 먼저 실행되면서 세션 쿠키가 없다고 판단해 `/login`으로 보내버린다.

**해결**: matcher 패턴에 `auth/callback` 제외 추가.

```typescript
matcher: ['/((?!_next/static|_next/image|favicon.ico|api|auth/callback).*)'],
```

**`redirect_uri_mismatch` (Google OAuth)**

Google Cloud Console의 승인된 리디렉션 URI에 Supabase 콜백 URL이 빠져있을 때.

**해결**: `https://<project-id>.supabase.co/auth/v1/callback` 추가.

---

## 정리 — 핵심 흐름 한눈에

```
로그인 (/login)
  ├── 이메일/비밀번호
  └── Google OAuth → /auth/callback → 세션 교환 → /

미들웨어: 미로그인 → /login 리다이렉트 (auth/callback 제외)

대시보드 (/)
  └── 잡 카드
        ├── JD 입력 버튼 (description 없을 때)
        ├── 메모 버튼 → textarea 토글 → 저장
        ├── 지원 상태 버튼 (클릭으로 순환)
        └── 커버레터 버튼
              ├── 기존 내용 자동 로드
              ├── 편집 → 저장
              ├── AI 재검토 (현재 내용 기반 표현 개선)
              ├── 재생성 (처음부터 새로 작성)
              └── 다운로드 (TXT / DOCX / PDF)
```

오늘 작업의 핵심은 두 가지였다. 첫째, **사용자 경험 디테일** — 새로고침하면 사라지는 커버레터, 의미없는 상태 레이블, 재매칭하면 초기화되는 상태값. 이런 것들이 쌓이면 실제로 쓰고 싶은 툴이 안 된다. 둘째, **인증 구조** — Supabase Auth + `@supabase/ssr` 조합은 Next.js App Router와 잘 맞는다. 미들웨어 하나로 라우트 보호가 되고, 서버 컴포넌트에서도 세션을 읽을 수 있다.

다음 편에서는 OAuth 로그인 직후 터지는 "Database error saving new user" 에러 삽질기를 다룬다.

---

*JobRadar 개발기 시리즈*
- [1편: Next.js + Supabase 프로젝트 셋업](/posts/jobradar_01_setup_20260420)
- [2편: Supabase 설계 + Playwright 스크래퍼](/posts/jobradar_02_scraper_20260421)
- [3편: Vercel에 Playwright 올렸더니 터졌다](/posts/jobradar_03_vercel_playwright_20260422)
- [4편: Playwright 버리고 cheerio로 갈아탔다](/posts/jobradar_04_url_scraper_20260423)
- [5편: on-demand 파이프라인 완성](/posts/jobradar_05_coverletter_pipeline_20260424)
- **6편: 커버레터 완성 + Auth (현재)**
