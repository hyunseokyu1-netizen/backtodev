---
title: '동작하지 않는 UI는 없느니만 못하다 — MVP UI 정리 하루'
date: '2026-07-17'
publish_date: '2026-09-04'
description: 가짜 검색바 제거, 랜딩 헤더 로그인 상태 표시, 회사 칩 필터까지 — 사이드 프로젝트 MVP의 UI를 하루 동안 정리하며 배운 것들
tags:
  - Next.js
  - React
  - MVP
  - UX
  - TypeScript
---

사이드 프로젝트를 만들다 보면 "일단 자리만 잡아두자"는 UI가 하나둘 쌓입니다. 검색바 모양의 div, 로그인해도 로그인 버튼만 보여주는 헤더, 개발자용 예시로 가득한 온보딩 placeholder 같은 것들이요.

저는 해외 취업 잡 매칭 서비스를 Next.js로 만들고 있는데, 오늘 하루는 새 기능 대신 이런 "찜찜한 UI"들을 정리하는 데 썼습니다. 커밋 하나(12개 파일, +127/−56)로 끝난 작은 작업이지만, MVP를 만들 때 생각해볼 만한 포인트가 몇 개 있어서 기록으로 남깁니다.

## 왜 이 작업이 필요했나

정리 대상은 네 가지였습니다.

| 문제 | 증상 |
|---|---|
| 가짜 검색바 | 대시보드 상단에 검색바가 있는데, 클릭해도 아무 일도 안 일어남 |
| 헤더가 로그인 상태 무시 | 로그인한 유저가 랜딩에 와도 "로그인 / 무료로 시작하기" 버튼만 보임 |
| 잡 탐색 동선 | 전체 공고 리스트에서 회사별로 모아 볼 방법이 없음 |
| IT 편향 | 서비스 타깃은 "해외 취업 전반"인데 예시가 전부 개발자 직군 |

하나씩 어떻게 풀었는지 살펴보겠습니다.

## Step 1: 가짜 검색바 제거 — 장식용 UI의 함정

대시보드 상단 Topbar에는 그럴싸한 검색바가 있었습니다. 그런데 코드를 열어보면 이렇습니다.

```tsx
{/* TODO(api): 공고/회사/국가 검색 연동 */}
<div className="hidden w-[200px] items-center gap-[9px] rounded-[10px] border ... md:flex lg:w-[340px]">
  <Search size={17} strokeWidth={1.8} className="text-[#98A2B3]" />
  <span className="truncate text-[14px] text-[#98A2B3]">{t.dashboard.topbarSearch}</span>
</div>
```

`input`조차 아닙니다. `TODO` 주석이 달린 **장식용 div**였죠. 디자인 목업을 옮기면서 "나중에 연동하지"라고 남겨둔 흔적입니다.

문제는 사용자 입장입니다. 검색바처럼 생긴 걸 클릭했는데 아무 반응이 없으면, 사용자는 "기능이 아직 없구나"가 아니라 "**이 서비스 뭔가 고장났나?**"라고 느낍니다. 동작하지 않는 UI는 기대치를 만들어놓고 배신하기 때문에, 없는 것보다 신뢰를 더 깎아먹습니다.

그래서 검색 기능을 급하게 만드는 대신, 검색바를 통째로 제거했습니다.

```tsx
// Before: 가짜 검색바 div
// After:
<div className="flex-1" />
```

레이아웃 유지용 spacer 하나로 끝. 미사용이 된 i18n 키(`topbarSearch`)도 같이 정리했습니다. 검색은 진짜 필요해지는 시점에, 진짜 동작하는 걸로 만들 예정입니다.

> **교훈**: MVP에서 "나중에 붙일 기능의 자리"를 UI로 먼저 그려두지 말 것. 기능이 생길 때 UI도 같이 생기면 됩니다.

## Step 2: 랜딩 헤더에 로그인 상태 표시하기

더 재미있는 건 헤더였습니다. `LandingHeader` 컴포넌트는 `authed`라는 prop을 **받고도 의도적으로 무시**하고 있었습니다.

```tsx
/** @deprecated 랜딩 헤더는 항상 방문자 관점(로그인·가입 버튼)으로 표시한다 */
authed?: boolean
```

원래 의도는 "랜딩은 항상 방문자 관점으로 보여주고, 로그인 유저가 버튼을 누르면 미들웨어가 알아서 앱으로 보낸다"였습니다. 구현은 단순해지지만, 로그인한 유저가 랜딩에 돌아왔을 때 자기가 로그인 상태인지 알 방법이 없다는 부작용이 있었죠. "로그인" 버튼을 또 눌러야 하나? 하는 혼란이 생깁니다.

이번에 설계를 뒤집어서, `userName`/`userEmail` props를 추가하고 로그인 시 아바타 + 이름 + 대시보드 버튼을 보여주도록 바꿨습니다.

```tsx
{userEmail ? (
  <div className="flex items-center gap-[10px]">
    <Link href="/dashboard" className="rounded-lg bg-[#046C4E] ...">
      {t.dashboard.nav.dashboard}
    </Link>
    <Link href="/settings" title={userEmail} className="flex items-center gap-[9px] ...">
      <Avatar initial={displayName.slice(0, 1).toUpperCase()} size={32} />
      <span className="hidden max-w-[140px] truncate ... sm:block">{displayName}</span>
    </Link>
  </div>
) : (
  /* 기존 로그인 · 무료로 시작하기 버튼 */
)}
```

이름이 없으면 이메일 앞부분으로 대체하는 fallback도 넣었습니다.

```tsx
const displayName = userName || userEmail?.split('@')[0] || ''
```

서버 컴포넌트인 `page.tsx`에서는 인증 헬퍼로 유저를 조회해 내려줍니다. 이메일을 하드코딩하지 않고 항상 동적으로 확인하는 게 포인트입니다.

```tsx
const [email, testimonials] = await Promise.all([
  getAuthUserEmail(),
  getPublicTestimonials(),
])
const profile = email ? await getOrCreateProfile(email) : null
```

`Promise.all`로 인증 확인과 데이터 조회를 병렬 처리하고, 프로필 조회는 이메일이 있을 때만 이어서 합니다.

덤으로 로고 링크도 정리했습니다. Sidebar/AppShell/Topbar 세 곳의 로고가 `/dashboard`로 링크되어 있었는데, "로고 = 홈"이라는 관례에 맞게 `/`로 통일했습니다. 절대 URL이 아니라 상대 경로라서 로컬·프리뷰 환경에서도 그대로 동작합니다.

## Step 3: 잡 탐색에 회사 칩 필터 추가

전체 수집 공고 리스트(`PoolJobList`)는 텍스트 검색만 가능했습니다. 그런데 실제로 써보니 "이 회사 공고만 모아서 보고 싶다"는 니즈가 훨씬 컸습니다.

`useMemo`로 회사별 공고 수를 집계하고, 공고 수가 많은 순으로 칩을 정렬했습니다.

```tsx
const [companyFilter, setCompanyFilter] = useState<string>('all')

// 회사별 공고 수 — 많은 순으로 칩 정렬
const companies = useMemo(() => {
  const counts = new Map<string, number>()
  for (const j of jobs) counts.set(j.company, (counts.get(j.company) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}, [jobs])
```

칩은 토글 방식입니다. 선택된 칩을 다시 누르면 전체 보기로 돌아갑니다.

```tsx
<button onClick={() => setCompanyFilter(prev => (prev === name ? 'all' : name))}>
  {name} ({count})
</button>
```

기존 텍스트 검색 필터와는 AND로 결합됩니다.

```tsx
const visible = jobs.filter(j => {
  if (companyFilter !== 'all' && j.company !== companyFilter) return false
  if (!q) return true
  return `${j.title} ${j.company} ${j.location ?? ''}`.toLowerCase().includes(q)
})
```

서버에 다시 요청하지 않고 이미 받아온 배열을 클라이언트에서 거르기만 하는, MVP 규모에 딱 맞는 가벼운 구현입니다. 페이지 동선도 함께 손봤습니다. "URL을 직접 등록"하는 파워유저용 기능보다 "회사 프리셋에서 고르기"가 먼저 보이도록 순서를 바꿨습니다. 대부분의 유저가 실제로 밟는 경로를 위로 올린 거죠.

## Step 4: 예시 데이터의 IT 편향 제거

마지막은 코드가 아니라 **카피와 목업 데이터** 이야기입니다.

이 서비스의 타깃을 "해외 개발자 취업"에서 "해외 취업 전반"으로 넓히기로 했는데, 랜딩의 데모 공고와 온보딩 placeholder가 전부 개발자 예시였습니다.

```
Before: 'Senior Backend Engineer, Payments' — Stripe
After:  'Registered Nurse — Emergency Department' — Ramsay Health Care
```

```ts
// 온보딩 placeholder
- placeholder: '예: 풀스택 개발자, 백엔드 개발자, React Native 개발자',
+ placeholder: '예: 간호사, 마케팅 매니저, 백엔드 개발자',
```

목업 예시가 전부 개발자 직군이면, 간호사인 방문자는 랜딩만 보고 "이건 개발자용 서비스구나" 하고 이탈합니다. **예시 데이터는 장식이 아니라 서비스가 누구를 위한 것인지 알려주는 신호**입니다.

한 가지 의식적으로 한 결정: 포지셔닝 확장을 **카피 층위**와 **데이터 층위**로 나눴습니다.

1. **카피 층위 (오늘)** — 랜딩 쇼케이스, 온보딩 placeholder의 예시 직군 다양화
2. **데이터 층위 (다음 단계)** — 실제 공고 수집 소스를 비개발 직군으로 확장

둘을 한 번에 하려면 스크래퍼 확장까지 필요해서 작업이 커집니다. 먼저 "누구를 향한 서비스인지"를 보여주는 겉면을 바꾸고, 데이터는 별도 단계로 미뤄서 오늘 안에 배포 가능한 크기를 유지했습니다.

## 정리

오늘 작업의 핵심 흐름을 한눈에 보면:

| 작업 | 원칙 |
|---|---|
| 가짜 검색바 제거 | 동작하지 않는 UI는 없느니만 못하다 |
| 헤더 로그인 상태 표시 | "구현이 단순해지는 설계"가 유저 혼란을 만들면 뒤집는다 |
| 로고 링크 `/` 통일 | 관례를 따르고, 경로는 상대 경로로 |
| 회사 칩 필터 | 유저가 실제로 밟는 경로를 기본 동선으로 |
| 예시 직군 다양화 | 목업 데이터가 서비스의 타깃 인상을 결정한다 |

새 기능 하나 없는 커밋이었지만, 체감 완성도는 이런 정리에서 옵니다. MVP를 만들고 계시다면 오늘 한번 자문해보세요 — **내 화면에 클릭해도 아무 일도 안 일어나는 UI가 있지 않은가?** 있다면, 기능을 급조하는 것보다 지우는 게 답일 때가 많습니다.
