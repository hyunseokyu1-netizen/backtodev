---
title: '저녁만 되면 화면이 깨진다? prefers-color-scheme와 Tailwind v4 레이어 함정'
date: '2026-06-24'
publish_date: '2026-07-14'
description: OS 자동 다크모드 때문에 배경만 검게 깨지는 버그의 원인과 color-scheme로 라이트 고정하는 해결법
tags:
  - CSS
  - TailwindCSS
  - Next.js
  - 다크모드
---

어느 날 저녁, 내 서비스를 켰는데 화면이 이상했다. 분명 낮에는 멀쩡한 하얀 배경이었는데, **배경만 시커멓게 깔리고 글씨랑 카드는 라이트 모드 그대로**라 어딘가 깨진 듯한 모습이었다. 다크모드를 만든 적도 없는데 말이다.

더 이상한 건 **"저녁이 되면 그런 것 같다"**는 패턴이었다. 이 단서가 결국 범인을 잡는 결정적 힌트가 됐다. 이 글은 "다크모드를 만든 적도 없는데 다크모드가 깨지는" 황당한 버그를 추적한 기록이다.

## 증상: 만든 적 없는 다크모드

상황을 정리하면 이랬다.

- 낮에는 정상 (하얀 배경, 검은 글씨)
- 저녁에는 배경만 검정, 콘텐츠는 라이트용 그대로 → 가독성 엉망
- 코드에 다크모드 토글이나 `dark:` 클래스를 **단 한 번도 쓴 적 없음**

"저녁"이라는 키워드에서 바로 떠오른 게 있었다. **macOS의 자동 외관 전환**이다. 시스템 설정에서 외관을 "자동"으로 두면, 일몰 후 OS가 알아서 다크모드로 바뀐다. 그리고 브라우저는 이 OS 설정을 CSS에 그대로 전달한다 — 바로 `prefers-color-scheme` 미디어 쿼리로.

## 원인 1: create-next-app이 심어둔 다크모드 잔재

`globals.css`를 열어보니 범인이 있었다. **Next.js 프로젝트를 처음 만들 때 자동 생성되는 기본 템플릿**에 이런 코드가 들어있었다.

```css
:root {
  --background: #ffffff;
  --foreground: #171717;
}

/* ← 이 블록이 범인 */
@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;   /* 거의 검정 */
    --foreground: #ededed;   /* 거의 흰색 */
  }
}

body {
  background: var(--background);
  color: var(--foreground);
}
```

`create-next-app`으로 프로젝트를 시작하면 이 다크모드 미디어 쿼리가 기본으로 깔려 있다. **OS가 다크모드가 되면 `--background`가 `#0a0a0a`로 바뀌고, body 배경이 검정이 된다.**

"아, 그럼 이거 지우면 되겠네"라고 생각했는데, 한 가지 더 의문이 남았다. **내 body에는 분명 Tailwind로 밝은 배경을 줬는데?**

```tsx
<body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
```

`bg-zinc-50`이면 밝은 회색 배경이다. 그런데 왜 `globals.css`의 검정 배경이 이걸 이기는 걸까? 클래스 선택자(`.bg-zinc-50`)가 요소 선택자(`body`)보다 우선순위가 높은데도?

## 원인 2: Tailwind v4의 레이어 우선순위 (진짜 함정)

여기가 이번 버그의 핵심이자, 모르면 평생 헷갈릴 부분이다.

Tailwind CSS v4는 `@import "tailwindcss"`로 불러오는데, 이때 **모든 유틸리티 클래스(`bg-zinc-50` 등)는 CSS `@layer` 안에 들어간다.** 반면 내가 `globals.css`에 직접 쓴 `body { background: ... }`는 **레이어 밖(unlayered)**에 있다.

그리고 CSS 캐스케이드 규칙에 이런 게 있다:

> **레이어에 속하지 않은 스타일은, 레이어 안의 스타일을 항상 이긴다.** (선택자 우선순위와 무관하게)

즉:

| 규칙 | 위치 | 우선순위 |
|------|------|----------|
| `body { background: var(--background) }` | 레이어 밖 | **이김** 👑 |
| `.bg-zinc-50 { background: ... }` | `@layer utilities` | 짐 |

선택자만 보면 `.bg-zinc-50`(클래스)이 `body`(요소)를 이겨야 정상이다. 하지만 **레이어 규칙이 선택자 우선순위보다 먼저 적용**되기 때문에, 레이어 밖의 `body` 규칙이 이긴다.

결론적으로:
1. 저녁 → OS 다크모드 → `--background`가 `#0a0a0a`
2. `body { background: var(--background) }`(레이어 밖)가 `bg-zinc-50`(레이어 안)을 **이김**
3. 배경만 검정, 나머지 라이트 → **깨진 화면**

두 가지 원인이 맞물려서 생긴 버그였다.

## 해결: 라이트 전용으로 고정하기

이 앱은 애초에 라이트 전용 디자인이다(모든 컴포넌트가 밝은 색 기준). 그러니 **다크모드를 어설프게 지원하려 하지 말고, 아예 라이트로 고정**하는 게 맞는 처방이다.

`globals.css`에서 다크 미디어 쿼리를 제거하고, `color-scheme: light`를 추가했다.

```css
:root {
  --background: #ffffff;
  --foreground: #171717;
  /* OS 다크모드(저녁 자동 전환)에도 폼/스크롤바까지 라이트 고정 */
  color-scheme: light;
}

/* @media (prefers-color-scheme: dark) { ... } ← 통째로 삭제 */

body {
  background: var(--background);  /* 이제 항상 #ffffff */
  color: var(--foreground);
}
```

핵심 두 가지:

1. **`@media (prefers-color-scheme: dark)` 블록 삭제** → 이제 OS가 다크모드여도 `--background`는 항상 흰색
2. **`color-scheme: light` 추가** → 배경뿐 아니라 **브라우저 네이티브 UI**(인풋 박스, 셀렉트, 스크롤바 등)까지 라이트로 강제. 이걸 안 하면 폼 컨트롤이 OS 다크 스타일로 렌더링돼서 또 어색해진다.

배포 후 저녁에 다시 확인하니 멀쩡한 라이트 화면이 유지됐다.

## 트러블슈팅

- **배포했는데 안 바뀐다** → 브라우저 CSS 캐시 때문이다. 강력 새로고침(Mac은 `Cmd+Shift+R`)으로 해결.
- **인풋/드롭다운만 여전히 어둡다** → `color-scheme: light`를 빠뜨린 경우다. 배경색만 고치면 네이티브 폼 컨트롤은 여전히 OS 다크를 따른다.
- **재현이 안 된다** → 본인 OS를 다크모드로 직접 바꿔서 테스트하면 된다. macOS는 시스템 설정 → 디스플레이 → 외관을 "다크"로. 굳이 저녁까지 기다릴 필요 없다.

## 정리

"만든 적도 없는 다크모드가 깨진다"의 전말:

1. **`create-next-app` 기본 `globals.css`**에 `prefers-color-scheme: dark` 미디어 쿼리가 숨어 있었다
2. 저녁에 **OS가 자동 다크모드**로 바뀌며 이게 발동
3. **Tailwind v4 레이어 규칙** 때문에, 레이어 밖의 `body` 배경이 `bg-zinc-50`을 이겨버림
4. 해결: 다크 미디어 쿼리 **삭제** + `color-scheme: light` **고정**

두 가지 교훈을 얻었다. 첫째, **스타터 템플릿이 깔아둔 기본 코드를 한 번은 들여다보자.** 내가 안 쓴 코드가 버그를 일으킬 수 있다. 둘째, **Tailwind v4에서는 `globals.css`에 직접 쓴 요소 스타일이 유틸리티 클래스를 이긴다.** 레이어 개념을 모르면 "분명 클래스를 줬는데 왜 안 먹지?"로 한참 헤맬 수 있다.

> 참고: 만약 **진짜 다크모드를 지원**하고 싶다면 이건 별도의 큰 작업이다. 모든 컴포넌트에 `dark:` 변형 클래스를 입히고 토글 UI를 다는 일이라, 라이트 전용으로 고정하는 것과는 차원이 다르다. 필요해지면 그때 제대로 하자.
