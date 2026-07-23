---
title: 'AI 코딩 어시스턴트와 SaaS 만들기 ⑧: 죽은 링크 없애기 — 랜딩의 모든 클릭이 어딘가로 이어지게'
date: '2026-07-04'
publish_date: '2026-08-07'
description: 데모 쇼케이스로 그럴듯해진 랜딩을 실제로 클릭해보니 구멍투성이였다 — 히어로 검색을 잡 탐색에 연결하고, 요금제를 비로그인에 공개하고, 서비스 소개 페이지를 신설해 헤더 네비 4개를 전부 살린 과정
tags:
  - Next.js
  - SaaS
  - 랜딩 페이지
  - 미들웨어
  - AI 코딩 어시스턴트
---

## 시작하며

7편에서 랜딩에 데모 쇼케이스 3개를 넣고 나니, 첫 화면은 꽤 그럴듯해졌다. 스크롤을 내리면 이력서 번역 화면, 잡 탐색 화면, 지원 현황 칸반이 차례로 나온다. 그런데 제품 오너(나)가 실제로 랜딩을 **클릭하고 다녀보니** 구멍이 곳곳에 있었다.

- 히어로 한가운데의 검색바 — 검색어를 입력하고 제출하면 **검색어를 무시하고** 대시보드로 이동
- 헤더 네비 4개 중 2개(서비스 소개·요금제)는 링크가 아니라 **죽은 `<span>`** — 클릭해도 아무 일도 안 일어남
- "이력서 번역" 네비는 `/workspace` — 리브랜딩 초기에 만든 **빈 워크스페이스 템플릿**으로 이동

피드백은 사용자의 언어 그대로였다.

> "여기 검색하면 잡탐색으로 가서 검색되게 해줘"
> "요금제·서비스소개 페이지 내용 만들어줘"

보여주기(쇼케이스)와 동작하기(배선)는 별개의 작업이었던 것이다. 이번 편은 랜딩의 죽은 링크를 전부 살린 두 커밋(`83c1454`, `a33746d`) 이야기다.

## Step 1. 히어로 검색 → 잡 탐색 연결

재밌는 건, 검색바 자체는 이미 준비돼 있었다는 점이다. 리브랜딩 때 만든 `SearchBar` 컴포넌트는 처음부터 `submitHref?q=검색어` 패턴으로 설계돼 있었고, 주석에는 이렇게 적혀 있었다.

```tsx
// SearchBar.tsx
/**
 * submitHref: 제출 시 이동 경로. 미지정 시 no-op(디자인 데모용).
 *   입력한 검색어는 q 쿼리로 함께 전달한다(추후 검색 페이지에서 소비 — TODO(api)).
 */
const sep = submitHref.includes('?') ? '&' : '?'
router.push(q ? `${submitHref}${sep}q=${encodeURIComponent(q)}` : submitHref)
```

몇 주 전에 남겨둔 `TODO(api)`를 이번에 회수하는 셈이다. 보내는 쪽은 목적지만 바꾸면 된다. 한 줄 수정.

```tsx
// src/app/page.tsx
-      searchHref={authed ? '/dashboard' : '/login?mode=signup'}
+      searchHref={authed ? '/discover' : '/login?mode=signup'}
```

받는 쪽인 `/discover`는 서버 컴포넌트다. Next.js 15 스타일로 `searchParams`가 Promise로 들어오므로 `await`해서 꺼낸다.

```tsx
// src/app/discover/page.tsx
export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  // 랜딩 히어로 검색바에서 넘어온 초기 검색어
  const { q } = await searchParams
  const initialSearch = (q ?? '').trim()
  // ...
  <DiscoveredJobList jobs={jobs} initialSearch={initialSearch} />
  <PoolJobList jobs={poolJobs} initialSearch={initialSearch} />
```

`/discover`에는 공고 리스트가 두 개다(내 채용페이지 수집 공고 + 공유 공고 풀). 둘 다 클라이언트 컴포넌트고 이미 자체 검색 상태를 갖고 있었으므로, `initialSearch` prop을 받아 `useState`의 초기값으로 쓰기만 하면 된다.

```tsx
// PoolJobList.tsx / DiscoveredJobList.tsx 동일 패턴
export default function PoolJobList({
  jobs,
  initialSearch = '',
}: {
  jobs: PoolJobItem[]
  initialSearch?: string
}) {
  const [search, setSearch] = useState(initialSearch)
```

URL을 상태의 출처로 쓰는 가장 가벼운 방법이다. `nuqs` 같은 URL 상태 동기화 라이브러리를 붙일 수도 있지만, 지금 필요한 건 "랜딩에서 넘어올 때 초기값 한 번 주입"뿐이다. 이후 사용자가 검색어를 바꿔도 URL을 갱신할 필요가 없으니 `useState(initialSearch)`로 충분하다. 양방향 동기화가 필요해지는 날 그때 도입하면 된다.

이제 랜딩에서 "backend engineer"를 치고 엔터를 누르면 `/discover?q=backend%20engineer`로 이동하고, 두 리스트 모두 그 검색어로 필터된 상태로 열린다.

## Step 2. 요금제 페이지 공개 전환

두 번째 구멍은 요금제였다. 기존 `/pricing`의 첫 줄은 이랬다.

```tsx
const email = await getAuthUserEmail()
if (!email) redirect('/login')
```

**가격을 보려면 가입부터 해야 하는** 역설. 결제 기능(5편)을 만들 때 "구독 관리 페이지"로 설계했으니 당연히 로그인 뒤에 있었는데, 헤더 네비에 "요금제"를 노출하는 순간 이 페이지의 역할이 하나 더 생긴 것이다 — 가입 전 방문자에게 가격을 알려주는 마케팅 페이지.

리팩터의 핵심은 **본문과 크롬(chrome)의 분리**다. 요금제 카드 2장과 결제 결과 배너를 `PlanCards`·`PricingBody` 컴포넌트로 추출하고, 같은 본문을 로그인 여부에 따라 다른 크롬으로 감쌌다.

```tsx
export default async function PricingPage({ searchParams }: { ... }) {
  const email = await getAuthUserEmail()
  const { success, canceled } = await searchParams

  // 비로그인 — 공개 요금제 (랜딩 크롬)
  if (!email) {
    const t = getMatchdaDict('ko')
    return (
      <div className="min-h-screen bg-white ...">
        <LandingHeader t={t} />
        <main className="mx-auto max-w-[1200px] px-4 py-16 sm:px-8">
          <PricingBody isPremium={false} authed={false} />
        </main>
        <SiteFooter t={t} />
      </div>
    )
  }

  // 로그인 — 앱 크롬 (사이드바)
  const profile = await getOrCreateProfile(email)
  const isPremium = planOf(profile) === 'premium'
  return (
    <AppShell activeKey="profile" userName={...} userEmail={email}>
      <PricingBody isPremium={isPremium} authed success={success} canceled={canceled} />
    </AppShell>
  )
}
```

비로그인 방문자는 랜딩에서 넘어왔으니 랜딩 헤더+푸터 안에서 요금제를 보고, 로그인 사용자는 사이드바가 있는 앱 안에서 같은 내용을 본다. 본문은 하나, 껍데기만 둘 — 요금이나 기능 목록이 바뀌어도 한 곳만 고치면 된다.

CTA 버튼도 상태별로 3분기한다. 비로그인에게 `UpgradeButton`(Stripe checkout 호출)을 보여주면 클릭 즉시 인증 에러가 날 테니, 가입 퍼널 `Link`로 바꿔치기했다.

```tsx
{!authed ? (
  <Link href="/login?mode=signup" className="...">프리미엄 시작하기</Link>
) : isPremium ? (
  <UpgradeButton mode="manage" label="구독 관리" />
) : (
  <UpgradeButton mode="upgrade" label="프리미엄 시작하기" />
)}
```

버튼 문구는 같아도("프리미엄 시작하기") 목적지는 다르다. 비로그인은 일단 가입, 가입자는 곧장 결제.

## Step 3. 서비스 소개(/about) 신설

세 번째는 아예 페이지가 없던 케이스다. 헤더의 "서비스 소개"는 만들 페이지가 없어서 `<span>`으로 남겨뒀던 것. `/about`을 신설했다.

구성은 정석대로 4개 섹션이다.

1. **인트로** — "해외 취업의 가장 큰 벽, 영어 이력서를 AI가 해결합니다"
2. **사용 흐름 4단계** — 이력서 올리기 → 영어로 번역·다듬기 → 공고 수집과 AI 매칭 → 맞춤 이력서로 지원
3. **주요 기능 6카드** — 번역, 공고 수집·채점, 맞춤 최적화, 커버레터, 칸반 추적, PDF·DOCX 다운로드
4. **그린 CTA 밴드** — "지금 무료로 시작해보세요" + 요금제 링크

7편의 칸반 목업 때와 같은 원칙으로, 콘텐츠는 상수 배열로 분리하고 JSX는 map만 돌린다.

```tsx
const STEPS = [
  {
    n: '1',
    title: '이력서 올리기',
    desc: '한국어 이력서 파일(PDF·DOCX)을 올리면 AI가 자동 분석해 기본 정보를 채워줍니다. ...',
  },
  // ... 4단계
]

{STEPS.map(s => (
  <div key={s.n} className="rounded-[14px] border border-[#ECEEF0] bg-white p-6">
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ECFDF3] text-[15px] font-bold text-[#046C4E]">
      {s.n}
    </div>
    <div className="mt-3 text-[16px] font-bold text-[#1F2A37]">{s.title}</div>
    <p className="mt-1.5 text-[14px] leading-[1.6] text-[#667085]">{s.desc}</p>
  </div>
))}
```

소개 페이지는 카피가 자주 바뀌는 페이지다. `STEPS`·`FEATURES` 배열만 고치면 되는 구조로 만들어두면 "문구 수정"이 "레이아웃 코드 수정"과 분리된다. CTA는 여기서도 로그인 분기 — `authed ? '/dashboard' : '/login?mode=signup'`.

## Step 4. 배선 마무리 — 미들웨어·크롬·네비

페이지를 만들었다고 끝이 아니다. 이 앱은 미들웨어가 **공개 경로 화이트리스트** 방식이라, 등록 안 된 경로는 비로그인 접근 시 로그인으로 리다이렉트된다. `/about`·`/pricing`을 추가했다.

```ts
// src/middleware.ts
-  // 루트(/)는 공개 소개 페이지 (로그인 여부와 무관하게 랜딩)
-  if (pathname === '/') {
+  // 루트(/)와 소개·요금제 페이지는 공개 (로그인 여부와 무관)
+  if (pathname === '/' || pathname === '/about' || pathname === '/pricing') {
     return supabaseResponse
   }
```

또 하나, `AppChrome`(구 레이아웃의 전역 헤더)이 씌워지지 않도록 MatchDa 셸 경로 목록에 `/about`을 추가했다. 이걸 빼먹으면 랜딩 헤더 위에 구 헤더가 한 겹 더 얹혀 이중 헤더가 된다 — `/pricing`은 이미 목록에 있어서 넘어갔지만, 새 페이지를 만들 때마다 걸리는 체크포인트다.

```tsx
// src/components/AppChrome.tsx
    pathname?.startsWith('/pricing') ||
+   pathname?.startsWith('/about') ||
```

마지막으로 헤더 네비. 죽은 `<span>` 2개를 `Link`로 바꾸고, 목적지가 어긋나 있던 2개도 정리해서 4개 전부 최종 연결했다.

| 네비 항목 | 이전 | 이후 |
|---|---|---|
| 서비스 소개 | `<span>` (죽은 링크) | `/about` (신설) |
| 채용 정보 | `/dashboard` | `/discover` (잡 탐색) |
| 이력서 번역 | `/workspace` (빈 템플릿) | `/profile` (실제 이력서 에디터) |
| 요금제 | `<span>` (죽은 링크) | `/pricing` (공개 전환) |

"이력서 번역"의 목적지 변경이 특히 중요했다. `/workspace`는 리브랜딩 핸드오프를 구현할 때 만든 정적 템플릿이라 데모 데이터만 보인다. 실제 번역 기능이 사는 곳은 `/profile`(이력서 에디터)이므로, 네비는 기능이 실제로 있는 곳을 가리켜야 한다.

검증은 두 갈래로 했다. Playwright로 랜딩·/about·/pricing 스크린샷을 찍어 이중 헤더 여부와 레이아웃을 눈으로 확인하고, 비로그인 상태를 흉내 낸 `curl`로 `/about`·`/pricing`이 302가 아닌 **200**을 반환하는지 확인했다. 미들웨어 화이트리스트 누락은 브라우저(로그인 세션 쿠키가 있는)에서는 절대 안 잡히는 종류의 버그다.

## 자주 쓴 패턴 요약

| 상황 | 패턴 |
|---|---|
| URL 검색어 → 클라이언트 리스트 초기값 | 서버에서 `await searchParams` → prop 전달 → `useState(initialSearch)` |
| URL 상태 라이브러리(nuqs 등) | 단방향 초기 주입만 필요하면 불필요 — 양방향 동기화가 필요해질 때 도입 |
| 같은 본문, 다른 껍데기 | 본문 컴포넌트 추출 후 비로그인=랜딩 크롬 / 로그인=AppShell 이중 크롬 |
| 비로그인에게 결제 버튼 | Stripe 버튼 대신 가입 퍼널 `Link`로 분기 |
| 소개 페이지 콘텐츠 | `STEPS`·`FEATURES` 상수 배열 + map — 카피 수정과 코드 수정 분리 |
| 새 공개 페이지 추가 시 | ① 미들웨어 화이트리스트 ② AppChrome 경로 목록 ③ 네비 링크, 3종 세트 |
| 나중에 이을 배선 | `TODO(api)` 주석 + 인터페이스(`submitHref?q=`)만 미리 설계 |
| 공개 페이지 검증 | 비로그인 `curl`로 200 확인 — 로그인된 브라우저로는 못 잡는다 |

## 정리

1. **보여주기와 동작하기는 별개의 작업이다.** 7편의 쇼케이스로 랜딩은 그럴듯해졌지만, 클릭은 여전히 죽어 있었다. 그리고 이런 구멍은 diff 리뷰가 아니라 **실제로 클릭해본 사람의 피드백**에서만 나온다. "여기 검색하면 잡탐색으로 가서 검색되게 해줘"는 코드 리뷰어가 아니라 사용자의 문장이다.
2. **TODO 주석은 미래의 나에게 보내는 설계 문서다.** SearchBar의 `submitHref?q=` 패턴과 "추후 검색 페이지에서 소비 — TODO(api)" 주석 덕분에, 몇 주 뒤 검색 연결 작업이 "설계"가 아니라 "회수"가 됐다. 보내는 쪽 한 줄 + 받는 쪽 prop 주입으로 끝.
3. **페이지의 역할은 진입점이 정한다.** `/pricing`은 원래 구독 관리 페이지였지만, 랜딩 헤더에 노출되는 순간 마케팅 페이지 역할이 추가됐다. 가격을 보는 데 로그인이 필요하다는 건 그 역할 충돌의 증상이었고, 본문/크롬 분리로 두 역할을 다 살렸다.
4. **화이트리스트 미들웨어는 새 페이지마다 통행세를 걷는다.** 공개 경로를 명시하는 방식은 안전하지만, 페이지 신설 시 미들웨어·AppChrome·네비 3곳을 함께 배선해야 한다. 이걸 체크리스트로 굳혀두면 다음 공개 페이지는 실수 없이 나간다.

이제 matchda.com의 랜딩에서는 어떤 클릭도 허공으로 가지 않는다. 검색은 검색 결과로, 요금제는 가격표로, 소개는 소개로. 죽은 링크가 없는 랜딩 — 당연해 보이지만, 직접 클릭해보기 전까지는 당연하지 않았다.
