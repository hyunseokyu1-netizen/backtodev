---
title: '인수받은 코드 개선하기 (1/5) — 마스터 이력서를 조용히 덮어쓰던 버그'
date: '2026-07-17'
publish_date: '2026-09-14'
description: AI가 작성한 제품 개선 인수인계 문서를 받아 가장 위험한 데이터 무결성 버그부터 고친 기록
tags:
  - Next.js
  - Supabase
  - 데이터 모델링
  - 리팩토링
---

## 인수인계 문서 하나가 시작이었다

사이드 프로젝트 매치다(MatchDa)를 몇 주간 계속 고치다 보니, 어느 순간 "지금까지 뭘 고쳤고 뭐가 남았는지"가 내 머릿속에만 있는 상태가 됐다. 그래서 다른 세션에 프로젝트 전체를 분석시켜서 인수인계 문서를 하나 뽑아봤다. 우선순위별로 P0/P1/P2, 그리고 실행 순서(Phase 1~5)까지 정리된 28KB짜리 문서였다.

이 문서를 읽고 검증부터 했다. AI가 쓴 문서라고 그대로 믿고 시작하면 안 되니까. 그런데 검증해보니 P0로 지목된 문제가 **진짜였다.** 그것도 꽤 심각한 데이터 무결성 버그였다.

이 글은 그 시리즈의 첫 편 — 가장 위험했던 버그를 고친 기록이다.

## 문제: "맞춤 이력서"가 사실은 마스터 이력서였다

매치다는 지원할 공고마다 이력서를 맞춤화해주는 서비스다. 사용자는 워크스페이스에서 공고를 보면서 이력서를 고치고 저장 버튼을 누른다. 당연히 **이 공고에 한정된 버전**이 저장될 거라 생각한다.

그런데 코드를 보니 아니었다.

```ts
// WorkspaceResume.tsx — 워크스페이스의 "저장" 버튼
async function handleSave() {
  const saveRes = await saveResumeStudio(koRef.current)   // ← 마스터 이력서에 씀
  const sync = await syncResumeEnglish(koRef.current)       // ← 이것도 마스터에 씀
  ...
}
```

`saveResumeStudio`와 `syncResumeEnglish`는 `profiles.onboarding_ko`/`onboarding_en` — 즉 `/profile` 페이지에서 관리하는 **마스터 이력서**를 직접 업데이트하는 함수였다. 워크스페이스에는 "공고별 초안"이라는 개념 자체가 DB에 없었다.

실제로 벌어지는 일을 시나리오로 그려보면 이랬다.

1. 공고 A에서 "리더십 경험 강조" 버전으로 고치고 저장
2. 공고 B에서 "기술 구현 강조" 버전으로 고치고 저장 → **A에서 저장한 내용까지 덮어써짐**
3. `/profile`에 가보면 마스터 이력서가 어느새 공고 B에 맞춰 변형돼 있음

더 헷갈렸던 건, 같은 화면에 "맞춤 이력서" 모달이 **따로** 있었다는 점이다. 그건 `tailored_resumes` 테이블에 공고별로 잘 저장되고 있었다. 즉 같은 목적의 기능이 두 개 있었는데, 하나(모달)는 맞고 하나(워크스페이스 중앙 편집기)는 마스터를 오염시키고 있었던 거다.

## 왜 이런 일이 생겼나

추측하기론, 처음엔 워크스페이스가 "내 마스터 이력서를 보면서 참고용으로 다듬는 화면"이었다가, 나중에 "공고별로 다르게 만드는" 요구사항이 얹히면서 저장 로직은 그대로 둔 채 화면만 확장된 게 아닐까 싶다. 흔한 패턴이다 — **기능은 늘었는데 데이터 모델은 안 늘었다.**

## 고친 방법: 저장 경로를 완전히 분리한다

원칙은 하나였다. **마스터 이력서는 `/profile`에서만 바뀐다. 워크스페이스는 절대 마스터에 쓰지 않는다.**

### 1. 공고별 저장 컬럼 추가

기존 `tailored_resumes` 테이블(원래 평문 텍스트만 담던)에 구조화 데이터 컬럼을 얹었다.

```sql
ALTER TABLE tailored_resumes
  ADD COLUMN IF NOT EXISTS content_ko JSONB,
  ADD COLUMN IF NOT EXISTS content_en JSONB,
  ADD COLUMN IF NOT EXISTS base_resume_synced_at TIMESTAMPTZ;
```

기존 `content`/`translation`(평문, 모달 기능이 쓰던 컬럼)은 그대로 뒀다. 같은 행을 공유해도 **다른 컬럼**이라 두 기능이 충돌 없이 공존한다.

### 2. 워크스페이스 전용 서버 액션 신설

```ts
// src/app/workspace/actions.ts
export async function saveJobResumeDraft(jobId: string, input: StudioResume) {
  const auth = await authorizeJobAccess(jobId) // matches 테이블로 소유권 확인
  const ko = sanitizeStudio(input)

  await supabaseAdmin.from('tailored_resumes').upsert({
    user_id: auth.id,
    job_id: jobId,
    content_ko: ko,           // ← tailored_resumes에만 씀. profiles는 안 건드림
    base_resume_synced_at: ...,
  }, { onConflict: 'user_id,job_id' })
}
```

`saveResumeStudio`(마스터 전용)는 그대로 두고, `saveJobResumeDraft`(공고별 전용)를 새로 만들어 워크스페이스가 이걸 쓰도록 바꿨다. 함수 이름부터 분리하니 나중에 실수로 섞어 쓸 여지가 줄어든다.

### 3. 마스터가 바뀌면? — 자동 덮어쓰기는 절대 안 된다

여기서 하나 더 신경 쓴 게 있다. 공고 A에 초안을 만들어둔 상태에서 사용자가 `/profile`에서 마스터 이력서에 새 경력을 추가하면 어떻게 해야 할까?

**자동으로 초안에 반영하면 안 된다.** 사용자가 공고 A용으로 다듬어놓은 내용이 조용히 사라지는 거니까. 대신 "마스터가 바뀌었어요" 배너만 띄우고, 반영 여부는 사용자가 직접 선택하게 했다.

```tsx
{masterChanged && (
  <div className="border border-amber-200 bg-amber-50 ...">
    마스터 이력서가 이 공고 초안을 만든 뒤 수정됐어요. 이 초안은 자동으로 바뀌지 않아요.
    <button onClick={handleResyncFromMaster}>최신 마스터로 갱신</button>
  </div>
)}
```

이걸 판단하려고 `profiles.resume_updated_at`이라는 컬럼을 새로 뒀다. 처음엔 기존 `updated_at`을 쓰려 했는데, 이 컬럼은 희망 연봉 같은 이력서와 무관한 설정을 바꿔도 갱신되는 컬럼이라 **가짜 알림**이 뜰 뻔했다. "이력서 내용이 실제로 바뀔 때만 갱신되는 전용 컬럼"을 따로 두는 게 맞았다.

```ts
// 이력서 내용을 실제로 쓰는 5곳 전부에 이 한 줄을 추가
resume_updated_at: new Date().toISOString(),
```

## 검증까지가 작업이다

이런 리팩토링은 "고쳤다"고 말하기 전에 실제로 격리가 되는지 확인해야 의미가 있다. 시나리오를 정해서 직접 밟아봤다.

1. 공고 A에 리더십 강조 버전 저장 → 공고 B에 기술 강조 버전 저장 → 공고 A로 돌아가서 내용이 그대로인지 확인
2. `/profile`에서 마스터를 수정 → 기존 공고 초안을 열어서 조용히 안 바뀌고 배너만 뜨는지 확인
3. `/profile` 마스터 이력서가 두 번의 공고별 저장 후에도 처음 그대로인지 확인

세 시나리오 모두 통과했다. 그리고 나중에 후속 편(5편)에서 이 검증 로직 일부를 Vitest 테스트로 정식 등록했다.

## AI가 준 문서를 믿을 것인가, 검증할 것인가

이번 작업에서 배운 건 기술적인 것보다 프로세스 쪽이었다. AI가 작성한 인수인계 문서를 받았을 때:

- **주장을 코드로 검증한다.** "워크스페이스가 마스터를 덮어쓴다"는 문장을 실제 함수 호출 체인을 따라가며 확인한 뒤에야 작업을 시작했다.
- **문서의 유효기간을 의심한다.** 그 사이 다른 작업으로 이미 해결된 항목이 문서에 "미해결"로 남아있진 않은지 먼저 걸렀다.
- **작은 단위로 쪼개 커밋한다.** "이력서 저장 구조 정리"라는 큰 작업을 스키마 변경 → 서버 액션 분리 → UI 배너 → 검증까지 하나의 논리적 커밋으로 묶되, 다른 성격의 변경과는 섞지 않았다.

## 정리

| 항목 | Before | After |
|---|---|---|
| 워크스페이스 저장 대상 | `profiles.onboarding_ko/en` (마스터) | `tailored_resumes.content_ko/en` (공고별) |
| 마스터 변경 시 초안 | 조용히 덮어써질 위험 | 배너 안내 + 수동 갱신만 |
| 변경 감지 기준 | 없음 | `resume_updated_at` 전용 컬럼 |
| 저장 함수 | 마스터/공고별 혼용 | `saveResumeStudio` vs `saveJobResumeDraft` 명확 분리 |

다음 편은 AI가 만든 결과를 사용자가 얼마나 신뢰할 수 있는지 — 매칭 점수의 근거를 구분해서 보여주고, AI가 이력서에 없는 사실을 지어냈는지 감지하는 이야기다.
