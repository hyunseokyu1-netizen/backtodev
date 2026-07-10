---
title: '홈 화면에 게임 오버레이 띄우기 — 매번 뜨면 성가시니까 세션당 1회'
date: '2026-07-10'
publish_date: '2026-09-06'
description: 블로그 홈 첫 진입에 픽셀 게임을 전체 화면으로 보여주되, sessionStorage로 재방문자를 성가시게 하지 않는 방법. 그리고 X 버튼이 Nav에 가려졌던 스태킹 컨텍스트 버그
tags:
  - NextJS
  - React
  - UX
  - sessionStorage
  - 픽셀마을
---

블로그 안에 Three.js로 픽셀 RPG 마을을 만들었다(제작기는 별도 시리즈로 쓰고 있다). 만들고 나니 욕심이 생겼다. **홈에 처음 들어온 방문자에게 이 마을을 바로 보여주고 싶다.**

그런데 여기서 바로 UX 고민이 시작된다. 홈에 올 때마다 게임이 풀스크린으로 뜬다면? 글 읽으러 온 재방문자 입장에서는 매번 X 버튼부터 찾아야 하는 성가신 팝업일 뿐이다. 나라도 두 번째부터는 짜증날 것 같았다.

이 글은 그 균형을 잡은 기록이다. 구현 자체는 몇 줄 안 되는데, 선택지를 비교하는 과정과 중간에 만난 z-index 버그가 공유할 만해서 남긴다.

---

## 요구사항 정리

- 홈(`/`) 첫 진입 시 픽셀 마을이 **전체 화면 오버레이**로 뜬다
- 오른쪽 위 X 버튼을 누르면 닫히고, 평범한 블로그 홈이 보인다
- 닫은 사람에게 **다시 들이밀지 않는다**

세 번째가 핵심이다. "다시 안 보여준다"의 기준을 어디에 둘 것인가.

## 선택지 3개 비교

| 방식 | 동작 | 장점 | 단점 |
|------|------|------|------|
| 항상 표시 | 홈 로드마다 오버레이 | 구현 최소 | 재방문자에게 매번 성가심 |
| sessionStorage | 탭 세션당 1회 | 새 방문마다 신선하게 노출 | 같은 탭에서는 다시 못 봄 |
| localStorage + 날짜 | 하루 1회 | 노출 빈도 세밀 제어 | 코드 복잡, 영영 안 볼 수도 |

**sessionStorage를 골랐다.** 이유는 단순하다.

- 새로고침하거나 글 읽다가 홈으로 돌아와도 안 뜬다 → 탐색 흐름을 안 끊음
- 탭을 닫았다가 다음에 다시 오면 뜬다 → "오랜만에 온 방문자"에게는 다시 보여줌
- 코드가 두 줄이다

localStorage로 "하루 1회"를 하면 더 정교하지만, 개인 블로그에서 그 정도 빈도 제어가 필요할까 싶었다. 참고로 마을을 다시 보고 싶은 사람을 위해 Nav에 Village 메뉴를 따로 달아뒀다. 오버레이는 어디까지나 "입구 이벤트"고, 정식 입장은 메뉴로.

## 구현 — 오버레이 컴포넌트

```tsx
"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import VillageGame from "@/app/[locale]/village/VillageGame";

const SEEN_KEY = "pv-intro-seen";

export default function VillageIntroOverlay({ locale, posts, guestbook }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // SSR 하이드레이션 불일치 방지 — 마운트 후 세션 확인
    if (!sessionStorage.getItem(SEEN_KEY)) setOpen(true);
  }, []);

  if (!open) return null;

  const close = () => {
    sessionStorage.setItem(SEEN_KEY, "1");
    setOpen(false);
  };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#0a0d08", overflowY: "auto" }}>
      <button onClick={close} style={{ position: "fixed", top: 18, right: 22, zIndex: 101 }}>
        X
      </button>
      <VillageGame locale={locale} posts={posts} guestbook={guestbook} />
    </div>,
    document.body
  );
}
```

포인트 세 가지.

### 1. sessionStorage 체크는 useEffect 안에서

처음엔 이렇게 쓰고 싶어진다.

```tsx
// ❌ SSR에서 터진다
const [open, setOpen] = useState(!sessionStorage.getItem(SEEN_KEY));
```

`sessionStorage`는 브라우저 API라 서버 렌더링 중에는 존재하지 않는다. Next.js에서는 `ReferenceError`가 나거나, 어찌어찌 피해도 서버 HTML과 클라이언트 첫 렌더가 달라지는 하이드레이션 불일치가 생긴다.

그래서 **초기값은 무조건 `false`(안 보임)로 두고, 마운트 후 useEffect에서 열지 결정**한다. 첫 페인트에 오버레이가 한 박자 늦게 뜨지만, 페이드 인과 함께라 어색하지 않다.

### 2. "봤음" 기록은 닫을 때

열 때 기록하면 게임 중에 새로고침한 사람이 마을을 잃어버린다. 닫기 버튼을 눌렀을 때만 기록하면 "명시적으로 닫은 사람에게만 다시 안 보여준다"는 의도와 정확히 일치한다.

### 3. 뒤 페이지 스크롤 잠금

오버레이가 떠 있는 동안 뒤의 홈 페이지가 스크롤되면 이상하다.

```tsx
useEffect(() => {
  if (!open) return;
  const prev = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  return () => {
    document.body.style.overflow = prev;
  };
}, [open]);
```

---

## 트러블슈팅 — X 버튼이 있는데 안 보인다

배포하고 확인해 보니 X 버튼이 안 보였다. 코드에는 분명히 있다. `position: fixed`에 `zIndex: 101`인데?

원인은 **스태킹 컨텍스트(stacking context)**였다. 내 레이아웃 구조가 이랬다.

```tsx
// layout.tsx
<Nav />                                    {/* sticky, z-index: 50 */}
<main style={{ position: "relative", zIndex: 10 }}>
  {children}                               {/* 오버레이가 여기 안에서 렌더링 */}
</main>
```

오버레이의 `zIndex: 100`은 **`<main>`이 만든 스태킹 컨텍스트 안에서의 100**이다. 바깥에서 보면 `<main>` 전체가 z-index 10짜리 한 덩어리이고, 형제인 Nav(z-50)가 항상 그 위에 그려진다. X 버튼은 화면 오른쪽 위, 정확히 Nav 헤더 영역에 있었으니 Nav의 반투명 배경 뒤에 숨어 있었던 것.

부모에 `position: relative` + `z-index`가 있으면 자식이 z-index를 9999로 올려도 부모의 컨텍스트를 못 벗어난다. 모달/오버레이에서 정말 자주 만나는 함정이다.

해결은 **portal**. `createPortal(overlay, document.body)`로 오버레이를 `<main>` 바깥, body 직속으로 렌더링하면 `<main>`의 스태킹 컨텍스트에서 탈출한다. 이제 오버레이의 z-100이 Nav의 z-50과 같은 층위에서 비교되므로 Nav까지 덮는다.

```tsx
return createPortal(<div style={{ zIndex: 100 }}>...</div>, document.body);
```

React 컴포넌트 트리는 그대로라 props와 상태는 전부 유지된다. 렌더링되는 DOM 위치만 바뀐다.

---

## 정리

| 항목 | 선택 | 이유 |
|------|------|------|
| 노출 빈도 | sessionStorage 세션당 1회 | 재방문 성가심 방지 + 새 세션엔 다시 노출 |
| 체크 시점 | useEffect (마운트 후) | SSR 하이드레이션 불일치 방지 |
| 기록 시점 | 닫기 버튼 클릭 시 | 게임 중 새로고침해도 유지 |
| 렌더 위치 | createPortal → document.body | 부모 스태킹 컨텍스트 탈출, Nav 위에 표시 |

"닫았는데 새로고침하니 안 떠요"는 버그가 아니라 기획이다. 탭을 닫고 다시 오면 마을이 반겨준다.
