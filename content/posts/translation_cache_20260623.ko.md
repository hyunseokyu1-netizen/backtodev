---
title: '매번 번역 API를 부르고 있었다 — 번역 결과를 DB에 캐싱하기'
date: '2026-06-23'
publish_date: '2026-07-09'
description: 모달을 열 때마다 같은 내용을 다시 번역하던 낭비를 DB 캐싱으로 없애고, 원문이 바뀌면 캐시를 무효화하는 패턴까지 정리
tags:
  - Supabase
  - Next.js
  - PostgreSQL
  - Claude API
---

## 들어가며: "이거 매번 번역하는 거 아냐?"

요즘 만들고 있는 JobRadar에는 **맞춤 이력서** 기능이 있다. 채용공고(JD)에 맞춰 영문 이력서를 생성해주고, 그 옆에 **한글 번역(참고용)** 패널을 띄워준다. 영어로 쓰인 이력서가 무슨 말인지 한 번에 안 들어오니까, 참고용으로 한글을 같이 보여주는 것이다.

그런데 코드를 다시 보다가 문득 의심이 들었다.

> "이 번역, 모달 열 때마다 다시 부르는 거 아냐?"

확인해보니 정확히 그랬다. 번역 버튼을 누르면 Claude API로 번역을 받아오는데, 그 결과를 **아무 데도 저장하지 않고** 화면 상태(`useState`)에만 들고 있었다. 모달을 닫았다 다시 열면 번역은 사라지고, 또 버튼을 눌러 **똑같은 내용을 다시 번역**해야 했다.

API 호출은 공짜가 아니다. 돈이 들고, 시간이 걸리고, 사용자는 매번 버튼을 눌러야 한다. "한 번 번역했으면 저장해두자"는, 너무나 당연한데 빠져 있던 한 줄이었다.

이 글은 그 **번역 결과를 DB에 캐싱**하는 과정을 정리한 것이다. 별것 아닌 작업 같지만, "캐시를 언제 무효화할 것인가"라는 캐싱의 본질적인 고민이 그대로 담겨 있다.

## 먼저, 지금 구조 파악하기

캐싱을 붙이기 전에 현재 흐름부터 봤다.

번역을 담당하는 서버 액션은 이렇게 생겼었다.

```ts
// 번역만 하고 저장은 안 함 — 그냥 결과를 반환
export async function translateTailoredResume(content: string) {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 3000,
    messages: [{ role: 'user', content: `아래 영문 이력서를 한국어로 번역...\n\n${content}` }],
  })
  const translation = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  return { translation }   // ← DB 저장 없이 바로 반환
}
```

자세히 보면 인자가 `content`(영문 텍스트)뿐이다. **어느 공고의 번역인지(jobId)조차 받지 않는다.** 저장하려고 해도 어디에 저장할지 특정할 수 없는 구조였다.

이력서 본문이 저장되는 테이블은 따로 있었다.

```sql
-- tailored_resumes: 영문 이력서만 저장
CREATE TABLE tailored_resumes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  job_id      UUID NOT NULL,
  content     TEXT,           -- 영문 이력서
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, job_id)
);
```

여기엔 `content`(영문)만 있고, 번역을 담을 칸이 없었다. 그러니 매번 새로 번역할 수밖에.

## 캐싱 설계: 핵심은 "언제 버릴 것인가"

캐싱은 "저장하면 끝"이 아니다. **저장한 값이 더 이상 유효하지 않을 때 버리는 것**까지가 한 세트다. 안 그러면 영문 이력서를 수정했는데 번역은 옛날 내용 그대로 남아서, 두 패널이 서로 다른 말을 하는 사태가 벌어진다.

그래서 규칙을 이렇게 잡았다.

| 동작 | 번역 캐시 처리 |
|------|----------------|
| 번역 버튼 클릭 | API 호출 → **DB에 저장** |
| 모달 다시 열기 | **DB에서 로드** (재번역 X) |
| 영문 생성 / 수정 / 저장 | 캐시를 **무효화**(`null`로) → 다시 번역 필요 |

즉 "영문이 바뀌는 모든 길목"에서 번역 캐시를 비워주는 게 핵심이다.

## Step 1. 번역을 담을 칸 만들기 (마이그레이션)

먼저 테이블에 `translation` 칼럼을 추가한다.

```sql
-- 009_add_translation_to_tailored_resumes.sql
ALTER TABLE tailored_resumes
  ADD COLUMN IF NOT EXISTS translation TEXT;
```

`IF NOT EXISTS`를 붙여서 여러 번 실행해도 안전하게(멱등) 만들었다. 마이그레이션은 두 번 돌아갈 일이 종종 생기니, 이런 안전장치는 습관처럼 넣어두는 게 좋다.

> Supabase를 쓴다면 이 SQL을 대시보드의 SQL Editor에 붙여넣고 실행하면 된다. CLI(`supabase db push`)를 쓸 수도 있지만, 칼럼 하나 추가하는 정도면 대시보드가 더 빠르다.

## Step 2. 번역 액션이 저장하도록 고치기

이제 `translateTailoredResume`가 `jobId`를 받아서, 번역 결과를 DB에 저장하게 만든다.

```ts
export async function translateTailoredResume(jobId: string, content: string) {
  if (!content.trim()) return { error: '번역할 내용이 없습니다.' }

  // 로그인 유저 확인 (항상 동적으로)
  const email = await getAuthUserEmail()
  if (!email) return { error: '로그인이 필요합니다.' }
  const profile = await getOrCreateProfile(email)
  if (!profile) return { error: 'Profile not found' }

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 3000,
    messages: [{ role: 'user', content: `아래 영문 이력서를 한국어로 번역...\n\n${content}` }],
  })
  const translation = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  if (!translation) return { error: '번역에 실패했습니다. 다시 시도해주세요.' }

  // 현재 영문(content)과 함께 번역을 저장 → 재방문 시 그대로 재사용
  const { error } = await supabaseAdmin
    .from('tailored_resumes')
    .upsert(
      { user_id: profile.id, job_id: jobId, content, translation, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,job_id' }
    )
  if (error) return { error: error.message }

  return { translation }
}
```

포인트가 두 개 있다.

1. **`jobId`를 받도록 시그니처를 바꿨다.** 저장하려면 "어느 행"인지 알아야 한다.
2. **`content`와 `translation`을 같이 저장한다.** 번역 시점의 영문도 함께 박아두면, 나중에 "이 번역이 지금 영문과 짝이 맞나"를 판단할 근거가 된다.

## Step 3. 영문이 바뀌면 캐시를 비우기

가장 중요한 부분이다. 영문 이력서가 바뀌는 길목은 세 군데였다 — **생성 / AI 수정 / 직접 편집 후 저장**. 이 세 곳에서 모두 `translation: null`을 같이 써준다.

```ts
// 이력서 생성/수정/저장 시 — 영문이 바뀌었으니 번역 캐시 무효화
await supabaseAdmin.from('tailored_resumes').upsert({
  user_id: profile.id,
  job_id: jobId,
  content,
  translation: null,   // ← 캐시 무효화
  updated_at: new Date().toISOString(),
}, { onConflict: 'user_id,job_id' })
```

이 한 줄(`translation: null`)이 캐싱 로직의 안전핀이다. 이게 빠지면 "영문은 새 내용, 번역은 옛 내용"이라는 최악의 버그가 생긴다.

## Step 4. 조회할 때 번역도 같이 꺼내오기

모달을 열 때 호출하는 조회 함수도 `translation`을 같이 반환하게 한다.

```ts
export async function getTailoredResume(jobId: string) {
  // ... 로그인/프로필 확인 ...
  const { data } = await supabaseAdmin
    .from('tailored_resumes')
    .select('content, translation')   // ← translation 추가
    .eq('job_id', jobId)
    .eq('user_id', profile.id)
    .single()
  return {
    content: data?.content ?? undefined,
    translation: data?.translation ?? undefined,
  }
}
```

## Step 5. 프론트엔드: 열 때 불러오기

마지막으로 모달이 처음 열릴 때, 저장된 번역이 있으면 바로 화면에 채워준다.

```tsx
useEffect(() => {
  getTailoredResume(jobId).then(res => {
    if (res.content) {
      setContent(res.content)
      setSavedContent(res.content)
    }
    if (res.translation) setTranslation(res.translation)  // ← 캐시된 번역 복원
    setState('idle')
  })
}, [jobId])
```

그리고 번역 버튼 핸들러는 이제 `jobId`를 같이 넘긴다.

```tsx
const res = await translateTailoredResume(jobId, content)
```

이제 흐름이 완성됐다. **한 번 번역하면 DB에 저장되고, 모달을 닫았다 다시 열어도 버튼을 누를 필요 없이 곧바로 번역이 떠 있다.**

## 트러블슈팅: 검증은 어떻게 했나

"잘 되겠지" 하고 넘기면 꼭 탈이 난다. 그래서 코드를 배포하기 전에 두 가지를 확인했다.

**1) 빌드/타입 체크**

```bash
npx tsc --noEmit   # 타입 에러 0
npm run build      # 컴파일 성공
```

함수 시그니처를 바꿨으니(`content` → `jobId, content`) 호출부가 다 맞는지 타입 체커가 잡아준다. 이래서 TypeScript를 쓴다.

**2) DB 레벨 라운드트립 테스트**

UI를 일일이 클릭하는 대신, service role 키로 DB에 직접 쿼리해서 "저장 → 조회 → 무효화"가 도는지 비파괴적으로 확인했다.

```
✅ 1) translation 칼럼 존재 및 조회 가능
✅ 2) 번역 저장 → 조회 라운드트립 성공 (캐싱 동작)
✅ 3) 영문 수정 시 번역 무효화(null) 동작
🧹 4) 테스트 행 정리 완료
```

테스트용으로 넣은 행은 끝나고 반드시 지워서, 실데이터에 흔적을 남기지 않도록 했다.

## 정리: 캐싱은 "저장 + 무효화"가 한 세트

이번 작업의 흐름을 한눈에 보면 이렇다.

1. **칸 만들기** — `translation TEXT` 칼럼 추가 (멱등 마이그레이션)
2. **저장하기** — 번역 액션이 `jobId`를 받아 결과를 upsert
3. **버리기** — 영문이 바뀌는 모든 길목에서 `translation: null`로 무효화
4. **꺼내기** — 조회 시 번역도 함께 반환, 모달 열 때 복원
5. **검증** — 타입/빌드 + DB 라운드트립으로 확인

작업 자체는 칼럼 하나에 코드 몇 줄이지만, 진짜 핵심은 **"캐시를 언제 버릴 것인가"**였다. 저장만 하고 무효화를 빼먹으면, 캐싱은 성능 개선이 아니라 버그가 된다. "영문이 바뀌면 번역은 더 이상 유효하지 않다" — 이 한 문장을 코드로 옮기는 게 이번 작업의 전부였다.

별것 아닌 한 줄이 빠져 있을 때, 그걸 알아채고 메우는 것. 다시 개발을 하면서 가장 많이 느끼는 건, 화려한 기능보다 이런 작은 빈틈을 줄이는 일이 실력이라는 점이다.
