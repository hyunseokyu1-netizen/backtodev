---
title: '인수받은 코드 개선하기 (2/5) — AI가 숫자를 지어내도 아무도 몰랐다'
date: '2026-07-17'
publish_date: '2026-09-15'
description: AI 매칭 점수의 근거를 구분해서 보여주고, AI가 이력서에 없는 사실을 지어냈는지 코드로 감지한 이야기
tags:
  - AI SDK
  - Claude
  - UX
  - TypeScript
---

## "0점"이 뭘 의미하는지 아무도 몰랐다

지난 편에서 마스터 이력서를 워크스페이스가 조용히 덮어쓰던 버그를 고쳤다. 이번엔 좀 다른 종류의 문제였다 — 버그라기보단 **신뢰의 문제**였다.

매치다는 공고마다 AI가 매칭 점수를 매긴다. 그런데 화면에 뜨는 "0점"이 두 가지 의미를 섞어 갖고 있었다.

1. AI가 분석한 결과 "이 공고는 나랑 정말 안 맞음" → 진짜 0점
2. AI 응답을 파싱하다가 실패함 → 그냥 실패인데 **0점으로 저장됨**

유저 입장에선 둘 다 똑같이 "0점"으로 보인다. 일시적인 API 오류였을 뿐인데 "당신은 이 회사와 전혀 안 맞아요"라는 거짓 판정을 받는 셈이다.

## 문제 ①: 실패를 0점으로 위장하지 않기

원래 코드는 이랬다.

```ts
try {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON found')
  return JSON.parse(jsonMatch[0]) as MatchResult
} catch {
  return { score: 0, reason: '분석 실패', highlights: [] }  // ← 실패인데 0점?
}
```

고친 방향은 단순하다. **실패는 `null`, 판정은 숫자.** TypeScript로 이 구분을 타입에 박아버렸다.

```ts
interface MatchResult {
  /** null = 분석 실패 (0점과 구분 — 0은 "무관한 직무"라는 실제 판정) */
  score: number | null
  reason: string
  highlights: string[]
}

function clampScore(v: unknown): number | null {
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(100, Math.round(n)))
}
```

`clampScore`를 따로 뽑은 이유는, 모델이 가끔 100을 넘는 숫자나 문자열을 줄 수도 있어서다. **AI 응답을 그대로 신뢰하지 않고 항상 타입·범위를 강제한다**는 원칙을 여기서 처음 세웠는데, 이 원칙은 이후 작업에서도 계속 써먹었다.

이 변경 하나로 끝나지 않았다. DB에 이미 저장된 "가짜 0점"들도 있었으니, 마이그레이션으로 소급 정정했다.

```sql
-- 과거 분석 실패 행: 실제 0점이 아니라 실패였으므로 미채점(NULL)으로 정정
UPDATE matches
SET score = NULL
WHERE score = 0
  AND (reason LIKE '분석 실패%' OR reason LIKE '매칭 실패%');
```

여기서 `AND`와 `OR`의 괄호 우선순위를 잘못 쓰면 진짜 0점 판정을 받은 행까지 지워버릴 수 있어서, 이 부분은 나중에 코드 리뷰에서도 별도로 짚었던 지점이다.

## 문제 ②: "제목만 보고 찍은 점수"와 "JD 다 읽고 낸 점수"가 똑같이 보였다

매치다에는 매칭 채점이 두 종류 있다.

- **경량 채점**: 공고 목록을 훑을 때, 제목·위치·부서만 보고 Haiku가 빠르게 채점
- **정밀 채점**: 실제 JD(공고 상세)를 읽고 분석

제목만 보고 낸 "예상 72점"과 JD를 다 읽고 낸 "72점"이 화면에서 똑같이 보이면, 유저는 후자만큼 신뢰하게 된다. 하지만 제목만으로는 비자 요건, 필수 기술, 경력 연차 같은 걸 전혀 알 수 없다.

`score_type` 컬럼을 추가해 근거를 기록했다.

```ts
export type ScoreType = 'jd_analysis' | 'title_estimate'

const hasJd = !!job.description?.trim()
const scoreType: ScoreType = hasJd ? 'jd_analysis' : 'title_estimate'
```

그리고 화면에서 이걸 구분해 보여줬다. 리스트에서는 "예상 82점", 워크스페이스 배너에는 노란 "제목 기반 예상" 배지, 툴팁으로 "JD를 입력하면 정밀 분석됩니다" 안내까지.

```tsx
{isEstimate ? `예상 ${score}점` : `${score}점`}
```

작은 단어 하나("예상")를 붙이는 게 별거 아닌 것 같지만, **AI가 낸 숫자를 사용자가 어느 정도로 믿어야 하는지**를 알려주는 건 신뢰 UX의 핵심이다.

## 문제 ③: AI가 이력서에 없는 숫자를 만들어냈다

이게 이번 편에서 제일 흥미로웠던 부분이다. 매치다의 "AI로 이력서 보강" 기능은 프롬프트에 이렇게 못을 박아뒀다.

> "사실 날조 금지: 원본에 없는 구체적 수치(%, 건수, 금액), 회사명, 프로젝트명을 지어내지 마세요."

그런데 **프롬프트 지시만으로는 완전한 보장이 안 된다.** 모델이 "성과를 더 인상적으로 써줘" 같은 요청을 받으면, 종종 그럴듯한 숫자를 슬쩍 끼워 넣는다. "응답 속도 40% 개선" 같은 문장이 원본엔 없던 걸 만들어내는 식이다.

이걸 프롬프트로 100% 막을 수 없다면, **결과를 코드로 검증**하면 된다. 원본과 AI 수정본을 비교해서 새로 등장한 숫자·회사명·기간·스킬·직함을 감지하는 순수 함수를 만들었다.

```ts
// resume-fact-check.ts
function numberTokens(text: string): Set<string> {
  const tokens = text.match(/\d[\d,.]*/g) ?? []
  return new Set(tokens.map(t => t.replace(/[,.]+$/, '').replace(/,/g, '')).filter(t => t.length >= 2))
}

export function checkResumeFacts(original: StudioResume, revised: StudioResume): FactWarning[] {
  const warnings: FactWarning[] = []

  const origNums = numberTokens(allText(original))
  const addedNums = [...numberTokens(allText(revised))].filter(n => !origNums.has(n))
  if (addedNums.length) {
    warnings.push({ kind: 'number', message: `원본에 없던 숫자가 추가됐어요: ${addedNums.join(', ')}` })
  }
  // 회사명·기간·스킬·직함도 같은 방식으로 비교
  ...
}
```

핵심은 **차단이 아니라 경고**라는 점이다. 이 검사를 통과 못 하면 저장을 막는 게 아니라, 사용자에게 "이 부분 확인해주세요"라고 보여준다. AI가 항상 틀리는 건 아니니까 — 정당한 이유로 숫자가 바뀔 수도 있다. 판단은 사람이 한다.

```tsx
{undoSnapshot && (
  <div className="border border-amber-200 bg-amber-50 ...">
    ✨ AI가 이력서를 수정했어요 — 제출 전 사실이 맞는지 확인해주세요.
    <ul>{factWarnings.map(w => <li key={w}>{w}</li>)}</ul>
    <button onClick={handleUndoAi}>↺ 수정 전으로 되돌리기</button>
  </div>
)}
```

이 작업을 하다가 흥미로운 걸 하나 더 발견했다. 워크스페이스의 "AI 채팅으로 수정" 기능이 결과를 **곧바로 마스터 이력서에 저장**하고 있었다 — 1편에서 고쳤던 것과 같은 종류의 버그가 다른 함수에 하나 더 남아있었던 거다. 그것도 이번에 같이 고치면서, AI 수정 결과가 저장 전엔 "제안 상태"로만 남아있고 사용자가 "저장"을 눌러야 확정되도록 바꿨다.

## 정탐과 오탐을 가르는 선

이 감지 로직에서 제일 신경 쓴 건 **오탐**이었다. 문장을 다듬거나(표현 개선), 스킬 순서만 바꾼 것까지 "경고"로 뜨면 유저가 금방 무시하게 된다. 그래서 8가지 케이스로 정탐/오탐을 나눠 테스트했다.

```ts
it('표현만 수정(사실 동일) → 경고 없음', () => {
  const r = clone()
  r.summary = '3년간 Node.js 기반 API 서버를 설계·개발한 경험이 있습니다.'
  expect(kinds(r)).toEqual([])  // 문장이 바뀌어도 숫자·고유명사가 그대로면 통과
})

it('원본에 없던 숫자 날조 → number 경고', () => {
  const r = clone()
  r.experience[0].description += '\n응답 속도 40% 개선'
  expect(kinds(r)).toEqual(['number'])
})
```

경고가 너무 자주 뜨면 "양치기 소년"이 되고, 너무 안 뜨면 있으나 마나다. 이 균형은 실제 시나리오를 여러 개 만들어보는 것 말곤 답이 없었다.

## 정리

| 문제 | 해결 |
|---|---|
| AI 실패가 0점으로 보임 | `score: number \| null`로 분리, 과거 데이터 소급 정정 |
| 제목 추정 점수가 정밀 분석처럼 보임 | `score_type` 컬럼 + "예상" 표기 |
| AI가 이력서에 없는 사실을 지어냄 | 원본-결과 비교 감지기, 차단 대신 경고+되돌리기 |
| AI 채팅 수정이 마스터를 바로 저장 | 저장 전 "제안 상태"로 전환 |

AI 기능을 만들 때 "프롬프트에 규칙을 적어뒀으니 안전하다"는 착각을 하기 쉽다. 이번 편에서 배운 건, **모델이 뭘 하지 말라고 지시하는 것과, 실제로 안 하는지 코드로 확인하는 건 별개**라는 거다. 다음 편은 이 서비스가 외부 URL을 긁어올 때 생기는 보안 문제 — SSRF를 막는 이야기다.
