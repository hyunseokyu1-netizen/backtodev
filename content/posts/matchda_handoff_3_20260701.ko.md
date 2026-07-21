---
title: '디자인 핸드오프를 진짜 제품으로 (3) — CTA와 검색을 실제 로그인 퍼널로 연결하기'
date: '2026-07-01'
publish_date: '2026-07-22'
description: 랜딩의 데모 링크였던 CTA·검색을 Server Actions와 useRouter로 실제 로그인·회원가입 퍼널에 연결하고 useSearchParams를 Suspense로 처리한 기록
tags:
  - Next.js
  - Server Actions
  - React
  - App Router
---

[2편](#)까지 화면은 실데이터로 살아났습니다. 그런데 공개 랜딩의 "로그인", "무료로 시작하기" 버튼과 히어로 검색바는 여전히 **디자인 데모 링크**(`/matchda/dashboard` 같은 목업 화면)를 가리키고 있었어요. 진짜 첫 화면이라면, 버튼을 눌렀을 때 **진짜 가입 흐름**으로 이어져야죠.

3편은 짧지만 실전적인 이야기입니다 — 정적인 링크를 **실제 동작하는 퍼널**로 바꾸기.

## 먼저: 우리 앱은 전부 인증 게이트

핵심 전제를 짚고 가야 합니다. 이 앱은 `/`·`/login` 외 모든 경로가 로그인 뒤에 있습니다. 즉 **로그아웃 방문자에겐 "검색"이라는 행위 자체가 불가능**합니다. 그러니 검색의 자연스러운 종착지는 검색 결과가 아니라 **로그인(가입) 화면**이에요. 이걸 인정하고 나니 설계가 단순해졌습니다.

| CTA | 목적지 |
|---|---|
| 로그인 | `/login` |
| 무료로 시작하기 | `/login?mode=signup` |
| 검색 제출 / Enter | `/login?mode=signup&q=<입력어>` |

## Step 1. 목적지를 prop으로 분리

같은 랜딩 컴포넌트가 데모(`/matchda`)와 공개(`/`)에서 다르게 행동해야 했습니다. 그래서 링크 목적지를 **prop으로 빼고, 데모 기본값**을 줬어요.

```tsx
export default function LandingHeader({
  loginHref = '/matchda/dashboard',   // 데모 기본값
  signupHref = loginHref,             // 기본은 login과 동일
}) { … }
```

공개 랜딩에서만 실제 퍼널로 오버라이드합니다.

```tsx
<MatchdaLanding loginHref="/login" signupHref="/login?mode=signup" searchHref="/login?mode=signup" />
```

JS 구조 분해의 소소한 팁 — `signupHref = loginHref`처럼 **앞에서 분해한 파라미터를 기본값으로 참조**할 수 있습니다. 데모는 둘 다 같은 곳, 공개는 따로 지정.

## Step 2. 검색을 실제로 라우팅

검색바는 그동안 `handleSearch`가 빈 함수였습니다. `useRouter`로 실제 이동을 붙였어요.

```tsx
'use client'
const router = useRouter()
function handleSearch() {
  if (!submitHref) return                 // 데모면 no-op
  const q = query.trim()
  const sep = submitHref.includes('?') ? '&' : '?'
  router.push(q ? `${submitHref}${sep}q=${encodeURIComponent(q)}` : submitHref)
}
```

입력한 검색어는 `q`로 함께 넘깁니다. 지금은 소비처가 없지만, 의도를 잃지 않게 실어두는 거죠(나중에 검색 페이지가 받으면 됨).

## Step 3. `/login?mode=signup` — 탭 자동 선택

"무료로 시작하기"로 들어오면 **회원가입 탭**이 먼저 켜져야 자연스럽습니다. 로그인 폼은 탭 상태를 내부 `useState`로만 갖고 있었는데, URL 파라미터를 읽도록 바꿨습니다.

```tsx
const searchParams = useSearchParams()
const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login'
const [mode, setMode] = useState(initialMode)
```

## Step 4. useSearchParams엔 Suspense가 필요하다

여기서 한 번 걸립니다. App Router에서 `useSearchParams`를 쓰는 클라이언트 컴포넌트는 **Suspense 경계로 감싸야** 합니다(정적 렌더링 시 빌드 경고/디옵트). 로그인 페이지에서 폼을 Suspense로 감쌌어요.

```tsx
// app/login/page.tsx
<Suspense fallback={null}>
  <LoginForm />
</Suspense>
```

확인해보니 `useSearchParams`가 페이지를 동적 렌더로 만들어, 폼이 SSR HTML에 정상 포함됐습니다(빈 화면 깜빡임 없음).

## 트러블슈팅

**검색어를 어디서 받을 건가?** 솔직히 지금 앱엔 공개 자유검색 엔드포인트가 없습니다. 그래서 `q`를 실어 보내되 **소비는 다음 작업으로 미뤘습니다.** 억지로 검색 결과 페이지를 만드는 것보다, 로그인 퍼널로 유도하는 게 현재 구조에 맞는 정직한 흐름이었어요.

**데모와 공개를 한 컴포넌트로.** prop 기본값 덕에 `/matchda` 데모는 손대지 않고도 그대로 동작하고, `/`만 실제 퍼널을 씁니다. 분기를 컴포넌트 안에 if로 박지 않은 게 유지보수에 좋았습니다.

## 정리

CTA·검색 연결의 요점.

1. **앱이 게이트면 검색의 종착지는 로그인** — 이 사실을 인정하면 설계가 단순해진다
2. **목적지는 prop으로**, 데모 기본값 + 공개 오버라이드
3. **검색은 useRouter로 실제 라우팅**, 의도(`q`)는 잃지 않게 함께 전달
4. **`?mode=signup`으로 탭 자동 선택** — 작은 디테일이 전환율을 만든다
5. **useSearchParams는 Suspense로** 감싼다

이제 방문자가 버튼을 누르면 진짜 가입 흐름으로 들어갑니다. 마지막 편에서는 이 시리즈의 하이라이트 — **Claude로 이력서를 공고에 맞춰 최적화**하고, 그 과정에서 테스트가 어떻게 버그를 잡아냈는지를 다룹니다.
