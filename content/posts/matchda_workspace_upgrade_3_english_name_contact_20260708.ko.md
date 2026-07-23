---
title: '워크스페이스 업그레이드 ③: 영문 이력서에 한글 이름이 나오던 버그와 연락처 필드 추가'
date: '2026-07-08'
publish_date: '2026-08-27'
description: 영어 번역 프롬프트 규칙 하나가 만든 한글 이름 노출 버그를 고치고, 이력서 연락처 줄에 전화번호·포트폴리오 링크를 편집 가능하게 추가한 기록
tags:
  - TypeScript
  - 프롬프트엔지니어링
  - React
  - UX설계
---

## 지난 편 요약

지난 편에서 워크스페이스의 "AI 분석" 버튼을 이력서 재작성 기능으로 바꾼 이야기를 했다. 이번 편은 그 작업을 확인하다 발견한 자잘하지만 실사용에 중요한 버그 두 가지를 다룬다.

## 문제 1 — 영문 이력서인데 이름이 한글

영문 이력서를 DOCX로 다운로드했더니, 다른 내용은 다 영어로 번역돼 있는데 **이름만 "유현석"** 그대로 나왔습니다. 영어 이력서에 한글 이름이 있으면 해외 채용담당자 입장에서 어색하고, 애초에 왜 이런 일이 생기는지 원인을 찾아야 했습니다.

원인은 영어 동기화(한국어 → 영어 변환)를 담당하는 AI 프롬프트에 있었습니다.

```
규칙:
- 이력서에 있는 사실만 사용하고 절대 지어내지 마세요.
- name/phone/period 는 번역하지 않고 원본 표기 유지.
```

"이름은 번역하지 않는다"는 규칙이 있었습니다. 이 규칙 자체는 나쁜 의도가 아니었습니다 — 아마 "이름을 AI가 멋대로 다른 이름으로 지어내면 안 된다"는 걸 막으려던 규칙이었을 겁니다. 그런데 "번역하지 않는다"를 "원본 문자 그대로 유지한다"로 해석해버리는 바람에, 한글 이름이 그대로 영어 버전에 복사돼버렸습니다.

## 해결 — "번역 금지"가 아니라 "로마자 표기로 변환"

이름을 다루는 규칙을 이렇게 바꿨습니다.

```
규칙:
- name 은 영문 이력서 표기(로마자)로 변환하세요. 예: "유현석" → "Hyunseok Yu". 이미 로마자면 그대로.
- phone/period 는 번역하지 않고 원본 표기 유지.
```

"번역하지 마세요"에서 "이름은 로마자로 변환하세요"로 바꾼 게 전부입니다. 사소해 보이지만, **AI에게 내리는 지시는 "하지 말 것"보다 "정확히 무엇을 할 것인지"를 구체적으로 주는 게 훨씬 안전**하다는 걸 다시 느꼈습니다. "번역하지 마세요"는 "그대로 둬라"로 오해되기 쉽지만, "로마자로 변환하세요"는 해석의 여지가 없습니다.

그리고 워크스페이스가 문서를 렌더링할 때도, 영문 문서는 영문판 이름을 우선 쓰도록 정리했습니다.

```ts
function buildDoc(resume: OnboardingResume, name: string, email: string, fallbackTitle: string) {
  return {
    // 이력서 데이터에 언어별 이름(영문판은 로마자)이 있으면 우선 사용
    name: resume.name?.trim() || name,
    ...
  }
}
```

다운로드 파일명도 마찬가지로 영문판 이름 기준으로 만들도록 바꿨습니다.

```ts
const fileBaseEn = `resume_${(enDoc.name || ko.name || 'resume').replace(/\s+/g, '_')}`
```

## 문제 2 — 연락처에 이메일만 있고 전화번호·링크가 없다

이력서 상단 연락처 줄을 보니 이메일 하나만 덩그러니 있었습니다. 실제 이력서라면 전화번호나 포트폴리오/GitHub 링크도 함께 적는 게 자연스러운데, 이걸 입력할 수 있는 항목 자체가 없었습니다.

## Step 1. 데이터 구조에 필드 추가

이력서 편집 데이터 타입(`StudioResume`)에 `links` 필드를 새로 추가했습니다. (전화번호 `phone`은 원래 있었지만 UI에 노출되지 않고 있었습니다.)

```ts
export interface StudioResume {
  name: string
  phone: string
  /** 포트폴리오·GitHub 등 추가 연락처 링크 (자유 텍스트, ' · ' 구분 표시) */
  links: string
  title: string
  // ...
}
```

## Step 2. 연락처 줄을 조합하는 헬퍼 함수

이메일·전화번호·링크, 이 세 개를 상황에 따라 있는 것만 이어붙여야 합니다(전화번호를 안 적었으면 그 자리는 그냥 생략). 매번 이 로직을 반복하지 않도록 헬퍼 함수 하나로 뽑았습니다.

```ts
/** 이력서 상단 연락처 줄: 이메일 · 전화번호 · 링크 (빈 값 제외) */
export function contactLine(email: string, phone?: string, links?: string): string {
  return [email, phone, links].map(v => v?.trim()).filter(Boolean).join(' · ')
}
```

`filter(Boolean)`이 핵심입니다. 빈 문자열이나 `undefined`는 배열에서 걸러지므로, 값이 있는 항목만 자동으로 이어붙습니다. 이 함수 하나를 이력서 렌더링(`studioToDoc`), PDF/DOCX 변환(`studioToRender`), 텍스트 다운로드(`studioToText`) 세 군데에서 공통으로 씁니다 — 예전엔 각자 따로 `[contact, r.phone].filter(Boolean).join(' • ')` 같은 코드를 중복해서 갖고 있었는데, 한 곳으로 모았습니다.

## Step 3. 워크스페이스에서 바로 입력 가능하게

매치다 워크스페이스는 이력서 필드를 클릭하면 바로 수정할 수 있는 `contentEditable` 방식을 쓰고 있습니다. 전화번호·링크도 같은 방식으로 추가했습니다.

```tsx
<div className="mt-[6px] font-mono text-[13px] text-[#98A2B3]">
  {contact}
  <span className="mx-1.5 text-[#D0D5DD]">·</span>
  <EditableText editKey={editKey} v={ko.phone} ph="전화번호" cls=""
    onCommit={val => commit(d => ({ ...d, phone: val }), val, ko.phone)} />
  <span className="mx-1.5 text-[#D0D5DD]">·</span>
  <EditableText editKey={editKey} v={ko.links} ph="포트폴리오·GitHub 링크" cls=""
    onCommit={val => commit(d => ({ ...d, links: val }), val, ko.links)} />
</div>
```

값이 비어있을 때 "여기 뭘 적어야 하는지" 안내가 없으면 사용자가 그 자리가 입력 가능한 곳인지도 모릅니다. 그래서 `EditableText` 컴포넌트에 플레이스홀더(`ph`) 옵션을 추가해서, 비어있을 땐 흐린 안내 문구가 뜨도록 CSS만으로 처리했습니다.

```tsx
className={`${cls} ... ${
  ph ? 'empty:before:text-[#C5CBD3] empty:before:content-[attr(data-ph)]' : ''
}`}
```

Tailwind의 `empty:before:content-[attr(data-ph)]`는 요소가 비어있을 때(`:empty`)만 `data-ph` 속성값을 가상 요소로 보여주는 CSS 트릭입니다. JavaScript로 "비어있으면 플레이스홀더 텍스트를 보여주고, 입력하면 숨기고"를 직접 구현하지 않고 CSS 선택자만으로 해결했습니다.

## Step 4. 공개 이력서는 전화번호만 계속 제외

전에 만든 공개 이력서 공유 페이지(`/r/<slug>`)는 개인정보 보호를 위해 연락처를 아예 노출하지 않았습니다. 이번에 링크 필드가 생기면서 그 원칙을 다시 점검했습니다 — 포트폴리오·GitHub 링크는 애초에 "공개해도 되는" 정보이므로 노출해도 되지만, 전화번호는 여전히 개인정보라 제외해야 합니다.

```ts
// 공개 이력서에는 이메일·전화번호를 넣지 않는다 — 개인정보 최소화
// (포트폴리오·GitHub 링크는 공개를 전제로 한 정보이므로 유지)
const doc = studioToDoc({ ...resume, phone: '' }, '')
```

`phone`만 빈 문자열로 덮어써서 넘기면, 앞서 만든 `contactLine` 헬퍼가 알아서 그 항목을 건너뛰고 이메일 없이 링크만(또는 아무것도) 표시합니다. 새 필드를 추가할 때마다 "이게 공개돼도 되는 정보인가?"를 한 번씩 짚고 넘어가는 게 중요하다는 걸 다시 느꼈습니다.

## 정리

```
버그: 영어 이력서에 한글 이름 노출
원인: "번역하지 마세요" 규칙이 "그대로 둬라"로 해석됨
수정: "로마자로 변환하세요"로 구체화 + 영문 문서는 영문판 이름 우선 사용

기능: 연락처에 전화번호·링크 추가
구현: StudioResume.links 필드 + contactLine() 공통 헬퍼로 중복 제거
      + contentEditable 플레이스홀더(empty:before CSS)
      + 공개 페이지는 전화번호만 계속 제외
```

다음 편(마지막)에서는 칸반 보드에 드래그 앤 드롭을 붙이고, 매칭률을 즉석에서 다시 측정하는 기능을 추가한 이야기를 다룬다.
