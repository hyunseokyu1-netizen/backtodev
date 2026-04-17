---
title: '번역 API 3종 비교 — MyMemory vs DeepL vs Claude, 뭘 써야 할까?'
date: '2026-04-19'
description: 블로그 어드민에 번역 기능을 붙이면서 MyMemory, DeepL, Claude API를 직접 써본 경험을 비교 정리합니다.
tags:
  - 번역 API
  - DeepL
  - MyMemory
  - Claude API
  - Next.js
---

## 블로그에 번역 기능을 붙이고 싶었다

한국어로 포스트를 쓰고, 버튼 하나로 영어 초안을 뽑아주는 기능.

단순한 아이디어처럼 보이지만, 실제로 구현하면서 번역 API를 세 개나 갈아탔다. MyMemory로 시작해서 DeepL로 끝냈는데, 그 과정에서 각 서비스가 얼마나 다른지 체감했다.

직접 써보면서 느낀 걸 정리해본다.

---

## 세 가지 서비스 한눈에 비교

| | **MyMemory** | **DeepL** | **Claude API** |
|---|---|---|---|
| **무료 한도** | 1,000자/일 | 500,000자/월 | 없음 (종량제) |
| **유료** | 이메일 등록 시 10,000자/일 무료 | 월 $6.99~ | 사용한 만큼만 |
| **포스트 1개 비용** | 무료 | 무료 | 약 4원 |
| **마크다운 처리** | 특수문자 변형 | 잘 보존 | 완벽하게 이해 |
| **한국어 품질** | 낮음 | 높음 | 매우 높음 |
| **API 키** | 필요 없음 | 필요 (카드 등록 필요) | 필요 |
| **설정 난이도** | 없음 | 낮음 | 낮음 |

---

## MyMemory — 일단 공짜라서 시작했다

처음 번역 기능을 만들 때 MyMemory를 선택한 이유는 단 하나였다. **API 키가 필요 없다.**

```ts
const res = await fetch(
  `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=ko|en`
);
const data = await res.json();
return data.responseData.translatedText;
```

코드 세 줄이면 번역이 됐다. 진입 장벽이 거의 없어서 프로토타입 만들 때는 좋다.

### 문제점

쓰면 쓸수록 문제가 쌓였다.

**1. 마크다운 특수문자를 마음대로 바꾼다**

`**볼드 텍스트**` → `* * 볼드 텍스트 * *`

`**`가 `* *`로 쪼개지거나, `__ BOLD __` 같은 형태로 변형되는 일이 반복됐다. 이걸 막으려고 placeholder를 넣고 복원하는 코드를 계속 추가했는데, API가 placeholder도 변형해버리는 무한 루프가 계속됐다.

**2. 1,000자 제한**

포스트 하나가 1,000자를 금방 넘는다. 청크로 나눠서 여러 번 요청하는 로직을 만들어야 했고, 그러다 보면 청크 경계에서 문장이 어색하게 잘리는 문제도 생겼다.

**3. 번역 품질**

솔직히 기계 번역 티가 많이 난다. 특히 한국어의 조사나 어투가 영어로 자연스럽게 옮겨지지 않는 경우가 많았다.

**결론:** 빠르게 테스트할 때는 쓸 만하다. 하지만 실제 서비스에 붙이기엔 한계가 명확하다.

---

## DeepL — 품질이 다르다

MyMemory에서 마크다운 깨짐 문제를 계속 겪다가 DeepL로 갈아탔다.

### 설정

DeepL API는 무료 플랜도 카드 등록이 필요하다. 이게 진입 장벽이긴 한데, 등록하면 **월 500,000자 무료**다. 블로그 포스트를 매일 써도 한 달에 다 소진하기 어렵다.

API 키를 발급받으면 서버사이드 라우트를 만들어서 사용한다.

```ts
// app/api/admin/translate/route.ts
const res = await fetch("https://api-free.deepl.com/v2/translate", {
  method: "POST",
  headers: {
    Authorization: `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    text: [text],
    source_lang: "KO",
    target_lang: "EN",
  }),
});
const data = await res.json();
return data.translations[0].text;
```

> **클라이언트에서 직접 호출하면 안 된다.** API 키가 브라우저에 노출되기 때문에 반드시 서버 라우트를 거쳐야 한다.

### 장점

- 마크다운 `**`, `##` 같은 특수문자를 대부분 그대로 보존
- 한국어↔영어 번역 품질이 MyMemory와 비교할 수 없이 좋다
- 한 번에 긴 텍스트도 처리 가능 (청크 분리 불필요)

**결론:** 번역 품질과 마크다운 처리 모두 만족스럽다. 무료 한도도 충분하다. 카드 등록이 유일한 장벽.

---

## Claude API — 번역보다 더 잘한다

Claude는 번역 API가 아니라 LLM이다. 근데 번역 용도로 쓰면 오히려 DeepL보다 나은 점이 있다.

```ts
const message = await anthropic.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 4096,
  messages: [{
    role: "user",
    content: `다음 마크다운 텍스트를 영어로 번역해줘. 마크다운 문법은 그대로 유지해.\n\n${text}`,
  }],
});
return message.content[0].text;
```

### 장점

- 마크다운을 언어로 이해하기 때문에 `**`, `##`, 코드 블록 등 완벽하게 보존
- placeholder 처리 같은 꼼수가 전혀 필요 없다
- 단순 번역을 넘어서 문맥에 맞는 자연스러운 표현을 찾아준다
- 이미 Claude API 키가 있다면 별도 가입 불필요

### 단점

- 유료 (종량제). 포스트 1개에 약 4원 수준이라 부담은 없지만 무료는 아님
- MyMemory, DeepL에 비해 응답 속도가 조금 느릴 수 있음

**결론:** API 키가 있다면 가장 좋은 선택이다. 마크다운 보존 문제 자체가 없어진다.

---

## 어떤 걸 써야 할까?

| 상황 | 추천 |
|------|------|
| 빠르게 프로토타입 테스트 | MyMemory |
| 무료로 쓰고 싶고 카드 등록 가능 | DeepL Free |
| Claude API 키 이미 있음 | Claude API |
| 번역 품질이 최우선 | Claude API |

나는 결국 **DeepL**로 정착했다. MyMemory의 마크다운 깨짐 문제에 지쳤고, Claude API는 이미 다른 용도로 충분히 쓰고 있어서 번역까지 붙이기가 조금 망설여졌다. DeepL 무료 한도가 충분하고 품질도 만족스러웠다.

---

## 정리 — 핵심 흐름 한눈에

```
테스트/프로토타입
  └── MyMemory (API 키 없이 바로 사용)

실제 서비스
  ├── DeepL Free (월 50만자 무료, 카드 등록 필요)
  └── Claude API (종량제, 포스트 1개 ≈ 4원, 마크다운 완벽 보존)

마크다운 보존 안정성
  MyMemory < DeepL < Claude API
```

번역 기능 하나를 붙이는 데 세 개의 API를 써봤다. 처음엔 그냥 무료 API 하나 붙이면 되겠지 싶었는데, 실제로 쓰다 보면 품질 차이가 생각보다 크다. 처음부터 DeepL이나 Claude로 시작했으면 훨씬 빨랐을 것 같다.
