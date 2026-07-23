---
title: '디자인 데모를 실제 앱으로 (2) — 모달 재사용과 라우트 스왑'
date: '2026-07-02'
publish_date: '2026-07-26'
description: 기존 모달들을 slot 패턴으로 재사용해 per-job 기능을 옮기고, AppChrome 조건부 크롬과 컴포넌트 추출로 로그인 홈을 MatchDa 대시보드로 갈아끼운 기록
tags:
  - Next.js
  - App Router
  - React
  - Server Actions
---

[1편](#)에서 인터랙티브 칸반과 보드 진입점을 옮겼습니다. 이제 가장 큰 덩어리 두 개가 남았습니다.

- **per-job 기능** — 공고 하나에 딸린 커버레터·맞춤이력서·JD·메모·삭제 등
- **라우트 스왑** — 로그인 `/`를 실제로 MatchDa 대시보드로 교체

2편은 "이미 있는 걸 어떻게 안 부수고 옮기느냐"의 실전입니다.

## Step 1. 모달은 그대로, 여는 곳만 새로

옛 앱의 per-job 모달들(커버레터·맞춤이력서·JD입력·지원이력서)을 열어보니 **props가 놀랍도록 일관**됐습니다.

```ts
// 네 모달 모두 사실상 같은 시그니처
{ jobId, jobTitle, company, onClose }
```

게다가 각 모달은 자기 데이터를 **스스로 로드**합니다(`getCoverLetter(jobId)` 등). 그러니 제가 할 일은 딱 하나 — **워크스페이스에서 이 모달들을 여는 버튼만** 만드는 것.

`WorkspaceActions`라는 클라이언트 컴포넌트를 만들어 버튼 + 모달을 담았습니다.

```tsx
'use client'
import CoverLetterModal from '@/components/CoverLetterModal'   // 옛 모달 그대로
import TailoredResumeModal from '@/components/TailoredResumeModal'

export default function WorkspaceActions({ jobId, jobTitle, company, ... }) {
  const [modal, setModal] = useState<ModalKind>(null)
  return (
    <>
      <button onClick={() => setModal('cover')}>커버레터</button>
      <button onClick={() => setModal('tailored')}>맞춤 이력서</button>
      {/* ⋯ 오버플로 메뉴: JD 입력 · 지원 이력서 · 메모 · 정보 편집 · 재매칭 · 삭제 */}

      {modal === 'cover' && <CoverLetterModal jobId={jobId} jobTitle={jobTitle} company={company} onClose={() => setModal(null)} />}
      {/* ... */}
    </>
  )
}
```

### slot 패턴으로 서버/클라이언트 경계 넘기

워크스페이스 상단바(`WorkspaceTopbar`)는 **서버 컴포넌트**입니다. 여기에 클라이언트 액션 버튼을 어떻게 끼울까요? React의 기본기 — **`ReactNode` 슬롯**을 열어두면 됩니다.

```tsx
// 서버 컴포넌트: 슬롯만 열어둔다
export default function WorkspaceTopbar({ t, data, actions }: { ...; actions?: React.ReactNode }) {
  return <header>{/* ... */}{actions}{/* ... */}</header>
}
```

```tsx
// 페이지(서버)에서 클라이언트 컴포넌트를 슬롯에 주입
<WorkspaceTopbar
  data={data}
  actions={real && jobId ? <WorkspaceActions jobId={jobId} ... /> : undefined}
/>
```

서버 컴포넌트가 클라이언트 컴포넌트를 **자식으로 렌더**하는 건 완전히 정상입니다. 슬롯 덕에 상단바를 클라이언트로 바꾸지 않고도 인터랙션을 얹었습니다.

### 없던 것만 새로 — 메모/정보 편집

옛 앱에서 메모와 제목/회사/위치 편집은 모달이 아니라 **인라인**이었습니다. 이건 워크스페이스 맥락에 안 맞아서, 작은 모달 두 개(`MemoModal`, `JobInfoModal`)를 새로 만들었습니다. 물론 저장은 기존 액션 재사용.

```tsx
// JobInfoModal: 변경된 항목만 저장
if (title.trim() !== initialTitle) await updateJobTitle(jobId, title.trim())
if (company.trim() !== initialCompany) await updateJobCompany(jobId, company.trim())
// ...
```

per-job에 필요한 부가 데이터(JD·메모·지원이력서·지원일)는 워크스페이스 조회 함수가 한 번에 담아 내려주게 했습니다.

## Step 2. 라우트 스왑 — 드디어 실제 홈 교체

이제 로그인 `/`를 MatchDa 대시보드로 바꿉니다. 세 가지가 필요했습니다.

### ① 대시보드를 재사용 컴포넌트로 추출

`/matchda/dashboard`와 로그인 `/`가 **같은 화면**을 써야 하니, 페이지 JSX를 `DashboardScreen` 컴포넌트로 뽑았습니다.

```tsx
// 두 라우트가 공유
export default function DashboardScreen({ t, summary, columns, real, unmatchedCount, userEmail }) {
  return <div className="flex ..."><Sidebar .../><main>{/* 통계 + 칸반 */}</main></div>
}
```

```tsx
// app/page.tsx
if (!email) return <MatchdaLanding ... />          // 비로그인 → 랜딩
return <DashboardScreen real={!!real} ... />        // 로그인 → 대시보드
```

### ② AppChrome — 조건부로 전역 크롬 숨기기

문제는 루트 레이아웃의 **전역 헤더**였습니다. MatchDa 화면은 자기 사이드바/헤더가 있으니 전역 헤더가 겹칩니다. 루트 레이아웃은 서버 컴포넌트라 `usePathname`을 못 쓰죠. 그래서 크롬을 **클라이언트 컴포넌트로 추출**하고 경로로 분기했습니다.

```tsx
'use client'
const pathname = usePathname()
const usesMatchdaShell =
  pathname === '/' || pathname?.startsWith('/matchda') /* ... */
if (usesMatchdaShell) return <>{children}</>   // 풀블리드, 전역 헤더 숨김
return <><header>…옛 전역 헤더…</header><main>{children}</main></>
```

여기엔 미묘한 지점이 있습니다. `/`는 **로그인 여부에 따라 다른 화면**(랜딩 vs 대시보드)이지만, **둘 다 자기 크롬을 갖습니다.** 그래서 `pathname === '/'`이면 인증 상태와 무관하게 전역 크롬을 숨기면 됩니다. 깔끔하게 떨어졌습니다.

### ③ 사이드바를 진짜 네비게이션으로

MatchDa 사이드바는 그동안 placeholder 링크였습니다. 실제 라우트로 연결하고, 유저 정보 + 로그아웃을 붙였습니다. 로그아웃은 서버 액션이라 **서버 컴포넌트에서 폼으로** 렌더할 수 있습니다.

```tsx
import { signOut } from '@/app/auth-actions'
{userEmail && (
  <form action={signOut}>
    <button type="submit">로그아웃</button>
  </form>
)}
```

## 트러블슈팅

**일관성 게이트.** per-job 액션 버튼은 워크스페이스가 **실데이터로 뜰 때만** 보이게 했습니다. 왜냐면 버튼이 모달에 넘기는 `jobTitle/company`가 목업 폴백일 땐 가짜(Spotify)라, 실제 `jobId`와 어긋나 파일명 등이 뒤섞이거든요. "보이는 데이터와 동작하는 데이터를 일치"시키는 게 사용자 신뢰의 기본입니다.

**세션 없이도 최대한 검증.** 로그인 실화면은 로컬에서 세션 없이 못 보지만, `tsc`·`eslint` + 비로그인 목업 렌더 + 인증 게이트(307 리다이렉트) 확인으로 회귀를 최대한 걸렀습니다.

## 정리

옮기기의 핵심.

1. **props가 일관된 모달은 "여는 곳"만 새로** — 본체는 손대지 않는다
2. **slot(ReactNode)으로 서버 컴포넌트에 클라이언트 인터랙션 주입**
3. **없던 UX만 새로 만들되 저장은 기존 액션 재사용**
4. **화면 추출**로 두 라우트가 한 컴포넌트 공유
5. **전역 크롬은 클라이언트 + usePathname으로 조건부 렌더**

이제 로그인하면 진짜 MatchDa 대시보드가 뜹니다. 그런데 `/discover`·`/profile`은 아직 옛 헤더에 zinc 톤이에요. 마지막 편에서 **앱 셸 통일과 색 톤 일괄 매핑**으로 마무리합니다.
