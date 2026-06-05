---
title: 'Next.js 페이지 이동할 때마다 스크롤 애니메이션이 생기는 이유'
date: '2026-05-15'
publish_date: '2026-06-06'
description: 뒤로 가기 버튼과 scroll-behavior smooth가 얽혀서 만든 스크롤 점프 버그 두 개를 연속으로 잡은 과정
tags:
  - NextJS
  - AppRouter
  - Debugging
  - UX
  - CSS
---

블로그에 뭔가 이상한 애니메이션이 생겼다.

포스트 목록에서 글 하나를 클릭하면 상세 페이지가 맨 아래서 위로 슬라이딩하고, 상세 페이지에서 `← cd ..` 버튼을 누르면 목록 페이지가 맨 위에서 아래로 슬라이딩했다. 분명히 넣은 적 없는 애니메이션이었다.

원인을 추적했더니 버그가 두 개였다. 하나는 뒤로 가기 버튼의 구현 방식, 하나는 전역 CSS 한 줄.

---

## 증상 전체 그림

| 이동 방향 | 현상 |
|-----------|------|
| 목록 → 상세 클릭 | 상세 페이지가 **맨 아래에서 위로** 스크롤 |
| 상세 → `← cd ..` 클릭 | 목록 페이지가 **맨 위에서 아래로** 스크롤 |

딱 봐서는 스크롤 애니메이션을 의도적으로 넣은 것처럼 보인다. 의도한 게 아닌데.

---

## 원인 1 — `scroll-behavior: smooth`

먼저 `globals.css`를 열어봤다.

```css
/* globals.css */
html { scroll-behavior: smooth; }
```

이 한 줄이 핵심 원인이었다.

`scroll-behavior: smooth`를 `html`에 전역으로 걸면, **JavaScript가 프로그래밍으로 스크롤을 이동시킬 때도 애니메이션이 적용된다.** 사용자가 직접 스크롤하는 경우만이 아니다.

Next.js App Router는 페이지 이동 시 다음 두 가지를 프로그래밍으로 처리한다:

- **새 페이지로 이동할 때**: `window.scrollTo(0, 0)` — 맨 위로 즉시 이동해야 하는데 smooth 애니메이션이 걸림
- **이전 페이지로 돌아갈 때**: 저장된 스크롤 위치 복원 — 복원 위치까지 smooth 애니메이션이 걸림

그래서 모든 페이지 이동에서 스크롤이 부드럽게 슬라이딩하는 것처럼 보였던 것이다.

**해결**: `scroll-behavior: auto`로 변경

```css
/* globals.css */
html { scroll-behavior: auto; }  /* smooth → auto */
```

이렇게 하면 Next.js의 programmatic scroll은 즉시 이동하고, 사용자가 직접 스크롤하는 것만 기본 동작을 따른다.

---

## 원인 2 — `<Link href="/posts">`는 뒤로 가기가 아니다

CSS를 수정한 뒤 스크롤 애니메이션은 사라졌다. 그런데 `← cd ..` 버튼을 눌렀을 때 동작이 여전히 어색했다. 목록 페이지가 처음부터 다시 로드되는 느낌이었다.

코드를 보니 이렇게 구현되어 있었다:

```tsx
// 기존 코드
<Link href="/posts">← cd ..</Link>
```

얼핏 뒤로 가는 것처럼 보이지만, 이건 브라우저의 "뒤로 가기"가 아니다. `/posts`로의 **새 페이지 이동**이다. 브라우저 히스토리를 역행하는 게 아니라, 새 히스토리 항목을 추가한다.

그래서 목록 페이지가 이렇게 동작했다:

```
1. Link 클릭 → /posts 페이지를 처음부터 새로 렌더링
2. 서버 컴포넌트: GitHub API로 포스트 목록 재fetch
3. 데이터 도착 → 포스트 카드들이 DOM에 추가 → 페이지 높이 늘어남
4. Next.js: "이전에 이 페이지에서 스크롤이 600px였으니까 복원해야지"
5. 600px로 스크롤 (이제 smooth는 없어서 순간 점프)
```

smooth를 제거했더니 애니메이션은 사라졌지만, 스크롤 위치 복원 자체는 여전히 발생했다.

**해결**: `router.back()`으로 교체

진짜 뒤로 가기를 쓰면 된다. 브라우저 히스토리 스택에서 직전 페이지를 꺼내서 복원하므로, 새 렌더링이 아니라 캐시에서 그대로 가져온다. 스크롤 위치도 그 시점 그대로다.

`useRouter`는 클라이언트 훅이라 서버 컴포넌트에서 직접 쓸 수 없다. 작은 클라이언트 컴포넌트로 분리한다.

```tsx
// components/BackButton.tsx
"use client";

import { useRouter } from "next/navigation";

export default function BackButton({ label = "← cd .." }: { label?: string }) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
        color: "hsl(var(--muted-foreground))",
        fontFamily: "var(--font-mono), monospace",
      }}
    >
      {label}
    </button>
  );
}
```

서버 컴포넌트인 포스트 상세 페이지에서는 이렇게 교체한다.

```tsx
// 기존
import { Link } from "@/i18n/navigation";
<Link href="/posts">← cd ..</Link>

// 변경
import BackButton from "@/components/BackButton";
<BackButton />
```

---

## Link vs router.back() — 언제 뭘 써야 하나

| 상황 | 사용 |
|------|------|
| 항상 같은 페이지로 이동하는 링크 | `<Link href="...">` |
| 다양한 경로에서 접근할 수 있는 경우 | `router.back()` |
| 직전 페이지 스크롤 위치를 유지해야 할 때 | `router.back()` |
| SEO가 필요한 링크 (크롤러가 따라가야 함) | `<Link href="...">` |

포스트 상세 → 목록 뒤로 가기는 전형적인 `router.back()` 케이스다. 목록 페이지에서 왔을 수도 있고, 직접 URL로 접근했을 수도 있는데, 어느 경우든 "뒤로 가기"의 의도는 "방금 있던 곳으로 돌아가는 것"이니까.

---

## 트러블슈팅

**smooth를 지웠는데 앵커 링크(`#section`)에서 부드러운 이동이 없어졌다**

`scroll-behavior: smooth`를 전역에서 제거했기 때문이다. 앵커 이동 시 smooth 효과가 필요하다면, 링크 클릭 핸들러에서 명시적으로 처리한다.

```tsx
// 앵커 링크에서 smooth 스크롤이 필요한 경우
element.scrollIntoView({ behavior: 'smooth' })
```

전역 CSS 대신 필요한 곳에서만 선택적으로 적용하는 방식이 더 안전하다.

**`router.back()`을 눌렀는데 아무것도 안 일어난다**

브라우저 히스토리에 이전 페이지가 없을 때 발생한다 (직접 URL 입력으로 접근한 경우). fallback을 추가한다.

```tsx
onClick={() => {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/posts')
  }
}}
```

---

## 정리

두 버그의 원인과 해결을 정리하면:

```
버그 1 — scroll-behavior: smooth
  원인: globals.css에 html { scroll-behavior: smooth }
  영향: Next.js의 programmatic scrollTo도 애니메이션 적용
  해결: scroll-behavior: auto로 변경

버그 2 — Link href vs router.back()
  원인: <Link href="/posts"> = 새 페이지 이동 (히스토리 추가)
  영향: 목록 페이지 재렌더링 + 스크롤 위치 복원 점프
  해결: router.back() = 브라우저 히스토리 복원 (캐시에서 즉시)
```

`scroll-behavior: smooth`는 `html`에 전역으로 걸면 예상치 못한 곳에서 애니메이션이 생긴다. Next.js처럼 페이지 이동을 JavaScript로 처리하는 프레임워크에서는 특히 그렇다. 필요한 곳에서만 명시적으로 쓰는 게 낫다.
