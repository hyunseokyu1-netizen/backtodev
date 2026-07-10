---
title: '디자인 핸드오프를 진짜 제품으로 (2) — 목업을 실데이터로, 그리고 공개 랜딩 승격'
date: '2026-07-01'
publish_date: '2026-07-21'
description: 목 데이터로 동작하던 MatchDa 화면을 Supabase 실데이터로 연결하고, 디자인 데모 랜딩을 실제 첫 화면으로 승격시키며 모바일 반응형까지 입힌 기록
tags:
  - Next.js
  - Supabase
  - Server Components
  - Tailwind CSS
---

[1편](#)에서 핸드오프를 코드로 재현했습니다. 그런데 그 화면들은 전부 **하드코딩 목업**이었어요. 대시보드 칸반의 공고 카드도, 워크스페이스의 이력서도, 요약 통계도 전부 가짜. 예쁘긴 한데 "내 데이터"가 아니죠.

2편은 이 껍데기에 **진짜 데이터를 흘려보내고**, 디자인 데모를 **실제 서비스 첫 화면으로 승격**시키는 이야기입니다. 핵심 원칙은 하나였습니다 — **로그인하면 실데이터, 아니면 목업 데모로 폴백**. 디자인 쇼케이스(비로그인 방문자)와 실제 앱(로그인 유저)을 한 컴포넌트로 동시에 만족시키는 거죠.

## Step 1. 공개 랜딩 승격 — 디자인을 "진짜 첫 화면"으로

기존 `/`는 비로그인 시 옛 소개 페이지를 보여줬습니다. 이걸 새 MatchDa 랜딩으로 바꿨습니다. 먼저 랜딩을 **재사용 컴포넌트**로 추출:

```tsx
// 데모(/matchda)와 공개(/) 양쪽에서 재사용
export default function MatchdaLanding({ loginHref, signupHref, searchHref }) { … }
```

그리고 `/` 페이지에서 비로그인일 때 이걸 렌더합니다.

```tsx
if (!email) return <MatchdaLanding loginHref="/login" signupHref="/login?mode=signup" />
```

문제는 1편에서 만든 `AppChrome`였습니다. `/matchda`는 전역 헤더를 숨기지만, `/`는 **로그인 유저에겐 전역 헤더가 필요**하거든요. 그래서 조건을 하나 더 달았습니다.

```tsx
// 비로그인 상태의 / 는 공개 랜딩 → 전역 크롬 숨기고 풀블리드
const isPublicLanding = pathname === '/' && !userEmail
if (isMatchda || isPublicLanding) return <>{children}</>
```

경로 + 인증 상태로 분기하니, **같은 `/` 경로가 로그인 여부에 따라 전혀 다른 셸**을 갖게 됐습니다.

## Step 2. 대시보드 — 칸반과 통계를 Supabase로

가장 재밌는 매핑이 여기 있었습니다. 디자인의 칸반은 4컬럼(준비 중 / 지원 완료 / 면접 진행 / 오퍼)인데, 실제 `matches.status`는 8가지 값을 씁니다. 그래서 **상태를 컬럼으로 접어주는 매핑**을 만들었습니다.

| 실제 `matches.status` | 칸반 컬럼 |
|---|---|
| new / interested / considering | 준비 중 |
| applied | 지원 완료 |
| interview | 면접 진행 |
| accepted | 오퍼 |
| rejected / pass | (보드 제외) |

회사 로고가 없으니 머리글자 칩을 쓰는데, 색이 매번 바뀌면 어지럽습니다. **회사명 해시로 색을 고정**했어요.

```ts
function brandFor(company: string) {
  let h = 0
  for (const c of company) h = (h * 31 + c.charCodeAt(0)) | 0
  return { initial: (company[0] ?? '?').toUpperCase(),
           color: CHIP_COLORS[Math.abs(h) % CHIP_COLORS.length] }
}
```

요약 통계도 실측으로 바꿨습니다. 단, 디자인의 "+1 이번 주", "상위 15%" 같은 **허구 델타는 과감히 버렸습니다.** 없는 데이터를 그럴듯하게 지어내느니, 실제로 셀 수 있는 값만 보여주는 게 정직하니까요.

```ts
// 비로그인이면 null → 호출부에서 목업으로 폴백
export async function getMatchdaDashboard() {
  const email = await getAuthUserEmail()
  if (!email) return null
  // matches + jobs 조회 → 컬럼 버킷 채우기 → 실측 통계
}
```

```tsx
// 페이지: 실데이터 우선, 없으면 목업 데모
const real = await getMatchdaDashboard()
const columns = real?.columns ?? getKanbanColumns()
```

## Step 3. 워크스페이스 — 구조화 이력서를 2열로

워크스페이스는 한국어 원본 ↔ 영어본을 나란히 보여줍니다. 마침 프로필에 **구조화된 한/영 이력서**(`onboarding_ko` / `onboarding_en`)가 JSONB로 저장돼 있었어요. `{ summary, experience[], education[], skills[] }` 구조라 디자인의 2열에 거의 그대로 매핑됐습니다.

```ts
function buildDoc(resume, name, contact, fallbackTitle) {
  return {
    name, contact,
    title: resume.experience?.[0]?.position || fallbackTitle,
    experiences: (resume.experience ?? []).map(e => ({
      org: [e.company, e.position].filter(Boolean).join(' — '),
      period: e.period ?? '',
      bullets: (e.description ?? '').split('\n').filter(Boolean).map(text => ({ text })),
    })),
    skills: resume.skills ?? [],
    // …
  }
}
```

`?jobId=`로 타깃 공고와 매칭률을 실측하고, 영어 이력서가 비어 있으면 역시 목업으로 폴백합니다. 대시보드 카드도 `/matchda/workspace?jobId=<id>`로 연결해 **대시보드 → 워크스페이스 흐름**을 완성했습니다.

## Step 4. 모바일 반응형 — 모바일 우선으로 다시 칠하기

핸드오프는 데스크톱 와이드(≥1200px) 기준이었습니다. 모바일을 위해 **데스크톱 레이아웃을 `lg:`로 밀고, 작은 화면을 기본값**으로 잡았습니다.

```tsx
// 2열 → 1열, 큰 폰트는 단계적으로
<section className="grid grid-cols-1 lg:grid-cols-[1.04fr_0.96fr] …">
<h1 className="text-[34px] sm:text-[44px] lg:text-[53px] …">
```

주요 규칙:

- 랜딩 헤더 nav는 `hidden lg:flex`로 모바일에서 숨김
- 검색바는 좁을 때 국가 셀렉트를 숨겨 입력창 확보
- 대시보드 **사이드바는 모바일에서 숨기고**(`lg:flex`), 대신 Topbar에 로고를 노출
- 칸반 4열 → `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`

## 트러블슈팅

**마이그레이션 타이밍 안전하게.** 워크스페이스에서 나중에 추가될 컬럼을 읽어야 했는데, 컬럼이 아직 없으면 `select('score, optimization')`은 에러가 납니다. 대신 `select('*')`로 받으면 **있는 컬럼만 돌아오고**, 없는 필드는 `undefined`라 에러가 안 납니다. 마이그레이션 적용 전후 모두 안전해지죠. (이 "추가될 컬럼" 이야기는 4편에서)

**허구 데이터의 유혹.** "상위 15%" 같은 라벨을 실데이터로 흉내 내려다 보면 결국 지어내게 됩니다. 셀 수 있으면 보여주고, 아니면 라벨 자체를 빼는 편이 낫습니다.

## 정리

목업 → 실데이터 전환의 핵심.

1. **로그인/비로그인 폴백** — `null` 반환으로 한 컴포넌트가 데모와 실데이터를 겸한다
2. **디자인 ↔ 실제 모델 매핑** — 8개 상태를 4개 컬럼으로 접는 식의 변환표를 명시
3. **있는 데이터를 재사용** — 프로필의 구조화 이력서가 마침 2열에 딱 맞았다
4. **허구 수치는 버린다** — 정직한 빈칸이 그럴듯한 거짓보다 낫다
5. **반응형은 모바일 우선**, 데스크톱을 `lg:`로

이제 화면은 진짜 데이터로 살아 움직입니다. 그런데 랜딩의 버튼과 검색은 아직 **데모 링크**예요. 다음 편에서 이걸 실제 로그인·회원가입 퍼널로 연결합니다.
