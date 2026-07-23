---
title: '워크스페이스 업그레이드 ②: "AI 분석" 버튼이 실제로 이력서를 써주게 만들기'
date: '2026-07-08'
publish_date: '2026-08-26'
description: 채용공고와 이력서를 비교만 하던 버튼을, 공고에 맞춰 이력서를 직접 재작성하는 기능으로 바꾸고 2단계(분석→번역) 플로우로 재설계한 기록
tags:
  - Next.js
  - Claude API
  - 서버액션
  - UX설계
  - 프롬프트엔지니어링
---

## 지난 편 요약

지난 편에서 칸반 카드 레이아웃을 정리한 이야기를 했다. 이번 편은 워크스페이스(이력서 편집 화면)에 있던 "이 공고에 맞춰 AI 분석" 버튼을 완전히 다시 만든 기록이다.

## 원래 이 버튼은 뭘 했나

워크스페이스는 좌측에 한국어 원본 이력서, 우측에 영문 이력서를 나란히 보여줍니다. 우측 상단에 "이 공고에 맞춰 AI 분석"이라는 버튼이 있었는데, 이걸 누르면 `generateWorkspaceOptimization`이라는 서버 액션이 실행돼서:

- 이력서 문장 중 채용공고 요구사항과 겹치는 구절을 찾아 **하이라이트**
- "OO 공고의 'distributed systems' 경험을 강조했습니다" 같은 **짧은 노트 하나** 생성

이 결과를 DB(`matches.optimization`)에 캐싱해뒀다가, 영문 이력서 아래에 초록색 박스로 보여주는 기능이었습니다. 즉 **이력서를 고쳐 쓰는 게 아니라, "여기가 관련 있어요"라고 짚어주기만** 하는 기능이었습니다.

## 왜 바꾸기로 했나

사용자 입장에서 생각해보면, "관련 있는 부분을 짚어주는" 것보다 "공고에 맞춰 이력서를 직접 다시 써주는" 게 훨씬 실질적인 도움입니다. 이미 매치다에는 비슷한 기능(`generateTailoredResume`)이 있었지만, 그건 별도 팝업 모달에서 실행되는 완전히 분리된 플로우였고, 워크스페이스에서 편집 중인 이력서와는 연결돼 있지 않았습니다.

그래서 "이 공고에 맞춰 AI 분석" 버튼 하나를, **워크스페이스에서 편집 중인 한국어 이력서를 그 자리에서 공고에 맞게 재작성**하는 기능으로 바꾸기로 했습니다.

## Step 1. 새 서버 액션 설계 — 사실은 그대로, 표현만 바꾸기

가장 신경 쓴 부분은 "AI가 이력서를 새로 쓰다가 없는 경력을 지어내면 안 된다"는 것이었습니다. 그래서 AI가 건드릴 수 있는 범위를 명확히 제한했습니다.

```ts
export async function tailorResumeForJob(
  current: StudioResume,
  jobContext: { title: string; company: string; description: string | null }
): Promise<{ ko?: StudioResume; error?: string }> {
  // ...
  const visibleExp = ko.experience.filter(e => !e.hidden)

  // AI에게는 description(성과 서술)만 다시 쓰게 요청
  const message = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    messages: [{
      role: 'user',
      content: `... [채용공고] ... [현재 이력서] ...
규칙:
- 이력서에 있는 사실만 사용하세요. 경력·수치·회사명을 절대 지어내거나 과장하지 마세요.
- experience 는 원본과 같은 개수·순서로, 각 항목의 description(성과 bullet)만 다시 쓰세요.`,
    }],
  })
```

그리고 AI 응답을 원본과 병합할 때, **회사명·직함·기간은 원본 값을 그대로 유지**하고 `description`(성과 bullet)만 AI가 만든 값으로 교체합니다.

```ts
const nextKo: StudioResume = sanitizeStudio({
  ...ko,
  title: raw.title?.trim() || ko.title,
  summary: raw.summary?.trim() || ko.summary,
  skills: Array.isArray(raw.skills) && raw.skills.length ? raw.skills.map(String) : ko.skills,
  experience: [
    ...visibleExp.map((e, i) => ({
      ...e,                                              // company·position·period 원본 유지
      description: raw.experience?.[i]?.description?.trim() || e.description,
    })),
    ...hiddenExp,
  ],
})
```

이렇게 하면 AI가 "회사명을 잘못 옮겨 적거나" "재직 기간을 살짝 바꾸는" 실수를 할 여지 자체가 없어집니다. **애초에 그 필드를 AI 응답에서 가져오지 않으니까요.** 프롬프트로 "지어내지 마세요"라고 부탁하는 것보다, 코드 구조로 아예 못 건드리게 막는 게 훨씬 안전합니다.

## Step 2. 버튼 위치 재배치 — "분석"은 한국어 쪽 일

기존엔 이 버튼이 영문 패널 쪽에 있었습니다. 그런데 이 기능은 이제 **한국어 원본을 다시 쓰는** 동작이니, 한국어 패널 헤더로 옮기는 게 맞았습니다.

```tsx
{/* 좌: 한국어 원본 패널 헤더 */}
<button type="button" onClick={handleTailorToJob} disabled={busy !== null}
  className="flex items-center gap-[6px] rounded-[9px] border border-[#CEEBDC] bg-[#ECFDF3] px-3 py-[7px] text-[13px] font-semibold text-[#046C4E]">
  <Sparkle size={14} strokeWidth={1.8} />
  {busy === 'tailor' ? labels.optimizing : labels.optimizeButton}
</button>
```

## Step 3. "AI 번역·맞춤화(영어)"를 진짜 버튼으로

여기서 또 하나 발견한 게 있었습니다. 영문 패널 헤더에 있던 "AI 번역·맞춤화(영어)"라는 문구는 겉보기엔 버튼처럼 생겼지만, 실제로는 `onClick`이 없는 **정적인 배지**였습니다.

```tsx
// Before — 클릭해도 아무 일도 안 일어나는 장식용 배지
<div className="flex items-center gap-2 rounded-lg border bg-[#ECFDF3] px-3 py-[6px]">
  <Sparkle size={14} strokeWidth={1.8} className="text-[#046C4E]" />
  <span className="text-[13px] font-semibold text-[#046C4E]">{labels.translated}</span>
</div>
```

영어 패널은 그동안 "저장" 버튼을 누르면 자동으로 함께 갱신되는 구조였습니다. 이번에 플로우를 다시 짜면서, 이 배지를 **명시적으로 눌러야 번역이 실행되는 진짜 버튼**으로 바꿨습니다.

```tsx
// After
<button type="button" onClick={handleTranslate} disabled={busy !== null}
  className="flex items-center gap-2 rounded-lg bg-[#046C4E] px-3 py-[6px] text-[13px] font-semibold text-white">
  <Sparkle size={14} strokeWidth={1.8} />
  {busy === 'translate' ? labels.translating : labels.translated}
</button>
```

```ts
async function handleTranslate() {
  setBusy('translate')
  const sync = await syncResumeEnglish(koRef.current)
  if (sync.en) setEnDoc(studioToDoc(sync.en, contact))
  setDirty(false)
  setSavedAt(true)
  router.refresh()
}
```

## 완성된 흐름 — 2단계로 명확히 분리

결과적으로 워크스페이스의 사용 흐름이 이렇게 정리됐습니다.

```
1. [이 공고에 맞춰 AI 분석] 클릭
   → 한국어 이력서가 이 공고에 맞춰 재작성됨 (아직 저장 전, "저장 안 됨" 표시)
2. 사용자가 결과를 검토·수정
   → 기존 편집 UI(contentEditable) 그대로 사용, 자유롭게 고칠 수 있음
3. [AI 번역 · 맞춤화 (영어)] 클릭
   → 확정된 한국어를 영어로 번역하며 동시에 저장
```

"분석 → 검토 → 번역"을 분리한 이유는, AI가 쓴 첫 결과물을 사용자가 그대로 믿고 넘어가지 않게 하기 위해서입니다. 한 번에 번역까지 자동으로 진행됐다면, 사용자가 한국어 단계에서 고칠 기회 없이 영어까지 밀려버렸을 겁니다.

## 트러블슈팅 — 안 쓰는 prop 정리하기

기존 기능(`GenerateOptimizationButton`)을 걷어내면서, 그 기능에만 쓰이던 `optimizable`이라는 prop이 컴포넌트 여러 곳에 남아있었습니다. TypeScript는 사용하지 않는 함수 매개변수를 기본적으로 에러로 잡지 않지만, 그대로 두면 "왜 있는지 모르는 prop"이 코드에 쌓이게 됩니다. `optimizable`을 컴포넌트 타입 정의, 페이지에서 넘기는 부분까지 전부 찾아 제거했습니다.

```bash
# 특정 prop/식별자가 남아있는 곳을 전부 찾을 때
grep -rn "optimizable" src/ --include="*.ts" --include="*.tsx"
```

기능을 걷어낼 때는 코드만 지우는 게 아니라, 그 기능에 딸려있던 타입·props까지 같이 추적해서 지워야 "죽은 코드"가 남지 않습니다.

## 정리

```
Before: "AI 분석" = 하이라이트·노트만 생성 (편집 불가한 부가 정보)
After:  "AI 분석" = 한국어 이력서를 JD에 맞춰 재작성 (회사명·기간은 유지, 성과 서술만 AI가 재작성)
        → 검토/수정 → "AI 번역" 버튼으로 명시적 영어 동기화
```

가장 크게 남은 인상은, **AI가 손댈 수 있는 범위를 프롬프트 문구가 아니라 코드 구조로 제한하는 것**이 훨씬 안전하다는 점이었다. "지어내지 마세요"라고 아무리 정성껏 프롬프트를 써도, 애초에 그 필드를 AI 응답에서 가져오지 않는 것만큼 확실하진 않다.

다음 편에서는 이 기능을 만들다가 우연히 발견한, 영문 이력서에 한글 이름이 그대로 나오던 버그를 다룬다.
