---
title: '매치다 안전하게 만들기 ⑤: 학력이 1개만 보이던 버그, 타입 설계가 문제였다'
date: '2026-07-07'
publish_date: '2026-08-23'
description: 이력서 학력이 항상 1개만 보이던 버그를 추적해 배열이 아닌 단일 객체로 설계된 타입이 원인이었음을 찾고 고친 기록
tags:
  - TypeScript
  - React
  - 버그추적
  - 타입설계
  - Next.js
---

## 문제 상황

"내 이력서에 학력을 2개 등록했는데, 워크스페이스 화면에는 1개만 보인다"는 제보를 받았습니다. 이런 유형의 버그는 겪어보면 은근히 흔합니다. 처음엔 "학력이 1개인 경우만 테스트하고 만든 화면이겠지"라고 생각했는데, 코드를 실제로 추적해보니 훨씬 근본적인 문제였습니다.

## 추적 과정

먼저 학력이 화면에 그려지기까지 데이터가 어떤 경로를 거치는지부터 파악했습니다.

```
프로필 DB (onboarding_en, JSONB — 학력 배열 저장)
  → toStudioResume()      : DB JSON → StudioResume 타입 (여기까진 배열 유지)
  → studioToDoc()          : StudioResume → ResumeDocumentData (렌더용)
  → ResumeDocument 컴포넌트 : 화면에 그리기
```

DB에는 분명 학력이 배열로 잘 저장돼 있었습니다. 실제로 확인해보니 두 개가 다 들어있었죠.

```
학력 개수: 2
  - California State University, Long Beach / Computer Science / B.S. (2015)
  - Grossmont College, San Diego, CA / Biology (2009 – 2011)
```

그런데 렌더링 직전 단계인 `ResumeDocumentData`의 타입 정의를 보니 원인이 바로 보였습니다.

```ts
// src/lib/matchda/types.ts (수정 전)
export interface ResumeEducation {
  org: string
  period: string
}

export interface ResumeDocumentData {
  name: string
  title: string
  contact: string
  experiences: ResumeExperience[]   // 배열
  skills: string[]                  // 배열
  education: ResumeEducation        // ← 배열이 아니라 단일 객체!
}
```

`experiences`와 `skills`는 여러 개를 담을 수 있는 배열인데, `education`만 유독 단일 객체였습니다. 그러니 이 타입을 채우는 변환 함수도 학력을 딱 하나만 골라 담을 수밖에 없었습니다.

```ts
// src/lib/resume.ts (수정 전)
export function studioToDoc(r: StudioResume, contact: string): ResumeDocumentData {
  const exps = r.experience.filter(e => !e.hidden)
  const edu = r.education.filter(e => !e.hidden)[0]   // ← [0], 첫 번째 것만 취함
  return {
    // ...
    education: edu
      ? { org: [edu.school, edu.major || edu.degree].filter(Boolean).join(' — '), period: edu.period }
      : { org: '', period: '' },
  }
}
```

`.filter(e => !e.hidden)[0]` — 숨김 처리 안 된 학력 중 **첫 번째 것만** 꺼내고 있었습니다. 학력이 몇 개가 등록돼 있든 상관없이, 타입 자체가 "학력은 하나"라고 못박아둔 것이 근본 원인이었습니다.

이런 버그의 특징은, 타입 시스템이 도와주기는커녕 오히려 문제를 숨긴다는 점입니다. TypeScript는 `education: ResumeEducation`이라는 타입 그대로 아무 에러 없이 컴파일을 통과시킵니다. "학력이 1개일 것"이라는 잘못된 전제 자체가 타입에 박혀 있으니, 컴파일러 입장에서는 전혀 이상할 게 없는 코드였던 겁니다.

## Step 1. 영향 범위 먼저 파악하기

타입 하나를 바꾸는 거니 간단해 보이지만, 이 타입을 쓰는 곳을 전부 찾아야 빠짐없이 고칠 수 있습니다. `grep`으로 훑었습니다.

```bash
grep -rn "\.education\|ResumeEducation" src/lib src/components --include="*.ts" --include="*.tsx"
```

결과로 나온 지점은 6곳이었습니다.

| 파일 | 역할 |
|---|---|
| `types.ts` | 타입 정의 (`education: ResumeEducation` → 배열로) |
| `resume.ts`의 `studioToDoc` | 스튜디오 데이터 → 렌더용 변환 |
| `resume.ts`의 `docToRender` | 렌더용 → 다운로드(PDF/DOCX)용 변환 |
| `matchda/data.ts` | DB 데이터 → 렌더용 변환 (워크스페이스 실데이터 경로) |
| `matchda/mock-data.ts` | 데모용 목업 데이터 |
| `ResumeDocument.tsx` | 실제 화면 렌더링 |
| `WorkspaceResume.tsx` | 워크스페이스 좌측 편집 미리보기 렌더링 |

## Step 2. 타입부터 배열로

```ts
// After
export interface ResumeDocumentData {
  // ...
  education: ResumeEducation[]   // 배열로 변경
}
```

## Step 3. 변환 함수들을 `[0]` 대신 `.map()`으로

```ts
// resume.ts — studioToDoc (After)
export function studioToDoc(r: StudioResume, contact: string): ResumeDocumentData {
  const exps = r.experience.filter(e => !e.hidden)
  const edu = r.education.filter(e => !e.hidden)   // [0] 제거 — 전부 유지
  return {
    // ...
    education: edu.map(e => ({
      org: [e.school, e.major || e.degree].filter(Boolean).join(' — '),
      period: e.period,
    })),
  }
}
```

`data.ts`(실제 DB 데이터를 워크스페이스용으로 변환하는 함수)도 같은 패턴으로 고쳤습니다.

```ts
// matchda/data.ts (After)
const edu = (resume.education ?? []).filter((e) => !e.hidden)
// ...
education: edu.map((e) => ({
  org: [e.school, e.major || e.degree].filter(Boolean).join(' — '),
  period: e.period ?? '',
})),
```

## Step 4. 화면 렌더링을 반복문으로

```tsx
// ResumeDocument.tsx (Before)
<div className="flex items-baseline justify-between">
  <div>{doc.education.org}</div>
  <div>{doc.education.period}</div>
</div>
```

```tsx
// ResumeDocument.tsx (After)
{doc.education.map((edu, ei) => (
  <div key={`${edu.org}-${ei}`} className={ei > 0 ? 'mt-[6px]' : ''}>
    <div>{edu.org}</div>
    <div>{edu.period}</div>
  </div>
))}
```

워크스페이스 좌측의 한글 편집 미리보기(`WorkspaceResume.tsx`)도 동일하게 `.map()`으로 바꿨습니다. 원래 `edu &&` 조건으로 단일 객체 존재 여부를 체크하던 걸 `edu.length > 0`으로만 바꾸면 됩니다.

## Step 5. 목업 데이터도 배열로

실데이터 경로만 고치면 데모/목업 화면이 깨질 수 있어서, 목업 데이터도 함께 손봤습니다.

```ts
// mock-data.ts (Before → After)
education: { org: '서울대학교 — 컴퓨터공학 학사', period: '2015 – 2019' },
// ↓
education: [{ org: '서울대학교 — 컴퓨터공학 학사', period: '2015 – 2019' }],
```

## Step 6. 실제로 렌더링해서 검증

타입 체크(`tsc --noEmit`)를 통과했다고 끝내지 않았습니다. 학력을 실제로 2개 가진 계정으로 화면을 띄워서 **둘 다 나오는지** 직접 확인했습니다.

```bash
curl -s http://localhost:3999/r/테스트슬러그 | grep -o "California State University"
curl -s http://localhost:3999/r/테스트슬러그 | grep -o "Grossmont College"
```

둘 다 출력되는 걸 확인하고서야 "고쳐졌다"고 결론 내렸습니다. 타입 체크는 "코드가 문법적으로 말이 되는가"만 보장하지, "의도한 대로 동작하는가"는 보장하지 않기 때문입니다.

## 자주 쓰는 패턴 요약

| 상황 | 체크포인트 |
|---|---|
| "여러 개"가 자연스러운 데이터(학력·경력·스킬 등) | 타입을 단일 객체가 아니라 배열로 설계했는가 |
| `.filter(...)[0]` 같은 코드를 발견했을 때 | 정말 "하나만 필요한 경우"인지, 아니면 설계 실수로 나머지가 버려지는 중인지 의심 |
| 타입 하나를 바꿀 때 | `grep`으로 해당 타입/필드를 쓰는 모든 지점을 먼저 나열 |
| 버그 수정 후 | 타입 체크만 믿지 말고 실제 데이터로 렌더링 결과를 확인 |

## 트러블슈팅

**Q. 이런 버그를 애초에 방지하려면?**
A. 데이터 모델링 단계에서 "이 필드가 현실에서 0개, 1개, 여러 개 다 있을 수 있는가"를 항상 따져보는 습관이 도움이 됩니다. 학력·경력·자격증처럼 사람마다 개수가 다른 정보는 기본적으로 배열로 설계하는 게 안전합니다. 반대로 이름·이메일처럼 정말 하나만 존재하는 값은 단일 필드가 맞습니다.

**Q. `[0]`으로 첫 번째만 쓰는 코드가 항상 버그인가?**
A. 아닙니다. "가장 최근 것만 필요하다"처럼 의도된 경우도 많습니다. 다만 그 의도가 맞는지 반드시 확인해야 합니다. 이번 경우엔 UI에 "학력 추가" 버튼이 있어서 유저가 여러 개를 등록할 수 있었는데, 렌더링 타입만 하나로 막혀 있었으니 명백한 설계 불일치였습니다.

## 정리

```
"학력이 1개만 보인다" 제보 → 데이터 흐름 추적(DB→변환→렌더)
  → 타입 정의에서 단일 객체로 설계된 지점 발견
  → 영향 범위 전수 조사(grep) → 타입·변환 함수·렌더링을 배열 기준으로 통일
  → 목업 데이터까지 동기화 → 실제 계정으로 렌더링 검증
```

이번 버그에서 가장 크게 남은 인상은, **타입 시스템은 "타입이 맞는 코드"를 보장할 뿐 "현실을 제대로 반영한 타입"까지 보장하진 않는다**는 점입니다. `experiences: ResumeExperience[]`와 나란히 있던 `education: ResumeEducation`(단수)을 그냥 눈으로 스캔하면서 발견했는데, 이렇게 "옆에 있는 필드와 비교했을 때 이상한 게 없는가"를 살피는 것도 코드 리뷰에서 꽤 쓸모 있는 습관인 것 같습니다.

이걸로 이번 시리즈를 마칩니다. 보안 점검에서 시작해서 히스토리 정리, DB 스키마 통합, 신기능 개발, 버그 수정까지 — 결국 전부 "이미 만든 걸 의심하고 검증하는" 작업이었다는 공통점이 있었습니다.
