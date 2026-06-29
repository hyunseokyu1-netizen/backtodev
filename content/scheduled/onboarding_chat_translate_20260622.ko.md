---
title: '채팅으로 받은 한국어 답변을 마지막에 한 번에 영어로 — 온보딩 플로우 만들기'
date: '2026-06-22'
publish_date: '2026-07-15'
description: 가입 직후 사용자 정보를 채팅으로 받고, 완료 시점에 Claude API 한 번으로 영어 번역·구조화해 한/영 양쪽을 저장한 경험
tags:
  - Next.js
  - Claude API
  - Supabase
  - 온보딩
---

## 가입은 시켰는데, 그 다음이 없었다

내가 만들고 있는 JobRadar는 호주/뉴질랜드 IT 채용공고를 모아서 AI로 매칭해주는 서비스다. 그런데 빠져 있던 게 하나 있었다. **가입한 사용자가 자기 정보를 입력할 곳이 마땅치 않았다.**

기존에는 `/profile` 페이지에 평범한 폼이 하나 있었다. 이름, 스킬, 희망 포지션을 칸칸이 채우는 그 흔한 폼. 그런데 신규 사용자 입장에서 보면 빈 폼 앞에서 "여기에 뭘 적어야 하지?" 하고 막막해진다. 학력은? 경력은? 빈칸이 많을수록 그냥 닫고 나가버린다.

그래서 생각한 게 **채팅형 온보딩**이다. AI가 한 질문씩 던지고, 사용자는 한국어로 편하게 답하면 된다. 그리고 핵심은 여기다 — 매칭과 커버레터 생성은 영어 기반이라, **마지막에 답변 전체를 영어로 번역해서 한국어/영어를 같이 저장**하는 것.

이 글은 그 과정에서 내가 했던 선택들과, 특히 "LLM을 어디에 얼마나 쓸 것인가"에 대한 고민을 정리한 것이다.

## 첫 번째 갈림길: 채팅을 어떻게 "채팅답게" 만들까

채팅형 UI라고 하면 두 가지 방식이 떠오른다.

| 방식 | 동작 | 장점 | 단점 |
| --- | --- | --- | --- |
| **진짜 대화형** | LLM이 매 턴 답을 읽고 다음 질문을 동적으로 생성 | 자연스럽고 유연함 | API 호출이 턴마다 발생, 흐름이 들쭉날쭉, 비용↑ |
| **스크립트 기반** | 질문 순서는 코드에 고정, 채팅 버블 UI로만 표시 | 안정적·예측 가능·저렴 | 질문이 정해져 있어 덜 유연 |

처음엔 진짜 대화형이 멋져 보였다. 그런데 막상 따져보니 온보딩에서 물어볼 항목(기본정보·학력·경력·스킬·희망조건)은 어차피 정해져 있다. 매 턴 LLM을 부를 이유가 없었다. 게다가 대화가 매번 달라지면 테스트도 어렵고, 사용자가 엉뚱한 답을 했을 때 흐름이 꼬인다.

그래서 **스크립트 기반 채팅**으로 갔다. 질문 순서는 코드에 박아두고, UI만 채팅처럼 보이게 한다. LLM은 **딱 한 곳, 마지막에만** 쓴다.

질문 스크립트는 이렇게 배열로 정의했다.

```ts
// questions.ts
export type Step =
  | { kind: 'single'; key: SingleKey; question: string; placeholder?: string; optional?: boolean }
  | { kind: 'list'; key: ListKey; question: string; addMoreQuestion: string; placeholder?: string }

export const STEPS: Step[] = [
  { kind: 'single', key: 'name', question: '이름이 어떻게 되시나요?' },
  {
    kind: 'list',
    key: 'education',
    question: '학력을 알려주세요. 학교명, 전공, 학위, 재학 기간을 한 번에 적어주시면 됩니다.',
    addMoreQuestion: '다른 학력이 더 있으면 적어주세요.',
  },
  // ... 경력, 스킬, 희망조건
]
```

여기서 포인트는 `kind: 'list'`다. 학력이나 경력은 여러 개일 수 있으니, 한 항목을 받은 뒤 "더 추가하실 내용이 있나요?"를 묻고 [추가하기]/[다음으로] 버튼을 보여준다. 단순하지만 채팅처럼 자연스럽게 반복 입력이 된다.

## 두 번째 갈림길: 번역을 언제 할까

한국어로 받은 답을 영어로 바꿔야 하는데, 타이밍이 두 가지다.

- **단계마다 번역**: 답할 때마다 그 부분을 영어로 → API 호출이 단계 수만큼 발생
- **마지막에 한 번에**: 전부 입력받고 완료 버튼 누를 때 한 방에 → API 호출 1회

당연히 후자를 택했다. 호출 1회면 비용도 1회, 그리고 전체 맥락을 한꺼번에 주니 번역 품질도 더 일관적이다.

그런데 마지막 한 번의 호출에 욕심을 좀 냈다. 단순 번역이 아니라 **세 가지를 동시에** 시켰다.

1. 자유 텍스트를 구조화 (예: "서울대 컴퓨터공학과 학사, 2011-2015" → `school`, `major`, `degree`, `period`로 분리)
2. 한국어 정리본(`ko`)과 영어 번역본(`en`)을 같은 구조로 둘 다 생성
3. 경력 기반 영어 요약(`career_summary_en`)까지 작성

프롬프트에서 JSON 스키마를 명확히 박아주고, "정보가 없으면 빈 문자열/빈 배열로 두고 절대 지어내지 말 것"을 강조했다. LLM이 빈칸을 그럴듯하게 채워버리는 게 제일 무섭기 때문이다.

```ts
// actions.ts — 완료 시 호출되는 서버 액션
const message = await anthropic.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 2000,
  messages: [{ role: 'user', content: PROMPT(answers) }],
})
const text = message.content[0].type === 'text' ? message.content[0].text : ''
const result = extractJson(text)  // { ko, en, career_summary_en }
```

모델은 `claude-haiku`를 골랐다. 번역+구조화 정도는 가벼운 모델로 충분하고, 빠르고 싸다.

### JSON 파싱은 방어적으로

LLM에게 "JSON만 출력해"라고 해도, 가끔 ` ```json ` 코드펜스로 감싸거나 앞뒤에 설명을 붙인다. 그래서 응답을 그냥 `JSON.parse` 하지 않고 한 단계 걸렀다.

```ts
function extractJson(text: string) {
  // ```json ... ``` 펜스가 있으면 그 안을, 없으면 첫 { ~ 마지막 } 사이를 파싱
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fenced ? fenced[1] : text
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('JSON을 찾을 수 없습니다.')
  return JSON.parse(raw.slice(start, end + 1))
}
```

별것 아닌 것 같지만, 이거 안 해두면 멀쩡하던 온보딩이 어느 날 갑자기 깨진다.

## 세 번째 갈림길: 한/영을 어떻게 저장할까

한국어와 영어를 둘 다 보관해야 했다. 사용자에게는 한국어를 보여주고 싶고, 매칭·커버레터 로직은 영어를 써야 하니까.

처음엔 컬럼을 영어용/한국어용으로 두 벌씩 만들까 했는데, 학력·경력처럼 구조가 있는 데이터는 그게 지저분해진다. 그래서 **JSONB 두 개**로 갔다.

```sql
-- migration 011
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_ko        JSONB   NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS onboarding_en        JSONB   NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS phone                TEXT;
```

`onboarding_ko`와 `onboarding_en`은 **완전히 같은 모양**의 JSON이다. 한쪽은 한국어, 한쪽은 영어. 구조가 같으니 나중에 화면에서 언어 토글만 해주면 된다.

그런데 여기서 한 가지 더. 기존 매칭/커버레터 코드는 `name`, `skills`, `career_summary`, `desired_positions` 같은 **평면 컬럼**을 읽고 있었다. 이걸 다 고치긴 부담스러웠다. 그래서 저장할 때 **영어 데이터를 기존 평면 컬럼에도 같이 매핑**해줬다.

```ts
await supabaseAdmin
  .from('profiles')
  .update({
    onboarding_ko: result.ko,
    onboarding_en: result.en,
    onboarding_completed: true,
    // 기존 로직 호환용 — 평면 컬럼엔 영어를 채운다
    name: en.name || profile.name,
    skills: en.skills ?? [],
    career_summary: result.career_summary_en || '',
    desired_positions: en.desired?.positions ?? [],
    preferences: {
      salary_min: en.desired?.salary_min ?? null,
      salary_max: en.desired?.salary_max ?? null,
      salary_currency: en.desired?.salary_currency || 'AUD',
    },
  })
  .eq('id', profile.id)
```

덕분에 매칭 로직은 한 줄도 안 고치고 그대로 굴러간다. 신규 구조는 추가하되, 기존 인터페이스는 유지하는 것 — 이게 의외로 마음이 편하다.

## 번역이 실패하면? — 입력은 지켜라

마지막 한 방의 API 호출에 모든 걸 걸었으니, 그게 실패하면 사용자가 한참 입력한 게 통째로 날아간다. 최악이다.

그래서 번역에 실패하면 **한국어 원본 답변이라도 일단 저장**하고, "잠시 후 다시 시도해달라"고 안내하게 했다.

```ts
try {
  // ... 번역 호출
} catch (e) {
  // 번역 실패해도 입력 내용은 보존
  await supabaseAdmin
    .from('profiles')
    .update({ onboarding_ko: answers })
    .eq('id', profile.id)
  return { error: '프로필 정리 중 오류가 발생했어요. 입력 내용은 저장됐으니 잠시 후 다시 시도해주세요.' }
}
```

클라이언트에서도 입력 중인 답변을 `localStorage`에 백업해뒀다. 사용자가 실수로 새로고침해도 답이 살아 있도록. 이런 방어막은 평소엔 티가 안 나지만, 한 번 사고가 나면 있고 없고 차이가 크다.

## 곁들인 작업: 작은 UI 두 가지

온보딩만큼 거창하진 않지만, 같은 날 공고 목록 UI도 손봤다.

**1. 매칭 설명 펼치기.** AI가 써준 매칭 설명이 `line-clamp-2`로 두 줄에서 잘려 `...`로 끝나서 전체를 볼 수가 없었다. 클릭하면 펼쳐지도록 토글을 달았다.

```tsx
<p
  onClick={() => setReasonExpanded(p => !p)}
  className={`text-xs text-zinc-400 mt-1.5 cursor-pointer ${reasonExpanded ? '' : 'line-clamp-2'}`}
>
  {job.match_reason}
</p>
```

상태 하나(`reasonExpanded`)와 조건부 클래스 하나면 끝. 모달 띄울 것도 없었다.

**2. JD 입력된 공고 음영 처리.** 공고 설명이 부실하면 `JD 입력` 버튼이 뜨고, JD를 채우면 버튼이 사라진다. "이미 채운 공고"를 한눈에 구분하려고 배경에 음영을 줬다. 이때 버튼 노출 조건이 코드 여기저기 흩어져 있어서, 변수 하나로 묶어 재사용했다.

```tsx
// 조건을 한 곳에서 정의해 버튼 노출과 음영이 같은 기준으로 동작
const needsJdInput = job.source === 'glassdoor' || !job.description || job.description.length < 200

// li 배경
className={`... ${needsJdInput ? 'bg-white' : 'bg-zinc-100/70'} ...`}
```

같은 판단 기준이 두 군데서 쓰이면 변수로 빼두자. 안 그러면 한쪽만 고치고 다른 쪽을 까먹는다.

## 정리

이번 작업의 흐름을 한눈에 보면 이렇다.

1. **질문은 코드에, LLM은 마지막에 한 번만** — 정해진 항목을 묻는 온보딩에 매 턴 LLM을 부를 필요는 없다.
2. **마지막 한 방에 욕심내기** — 번역·구조화·요약을 한 호출에 묶어 비용을 아꼈다.
3. **JSON 응답은 방어적으로 파싱** — 코드펜스와 군더더기를 걸러내야 어느 날 안 깨진다.
4. **한/영은 같은 모양의 JSONB 두 개로, 기존 컬럼엔 영어를 매핑** — 신규 구조는 추가하되 기존 로직은 안 건드린다.
5. **실패해도 사용자 입력은 지킨다** — 부분 저장 + localStorage 백업.

"채팅형 온보딩"이라고 하면 거창한 대화 AI를 떠올리기 쉽지만, 실제로 필요한 건 **잘 짜인 질문 순서 + 마지막의 똑똑한 한 번**이었다. LLM은 만능 망치가 아니라, 꼭 필요한 곳에 정확히 박는 못 같은 거라는 걸 또 한 번 느꼈다.
