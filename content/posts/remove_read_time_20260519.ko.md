---
title: '블로그 포스트 목록에서 "1분 읽기" 지운 이유'
date: '2026-05-19'
publish_date: '2026-06-09'
description: 읽기 시간 표시가 초기 블로그에서 오히려 역효과가 나는 이유와 Next.js 컴포넌트에서 제거하는 방법
tags:
  - Next.js
  - UI
  - 블로그
  - React
---

블로그 포스트 목록을 보다가 작은 게 눈에 걸렸다.

날짜 옆에 **"⏱ 1 분 읽기"** 라고 표시되고 있었다.

미디엄(Medium) 같은 플랫폼에서 자주 보는 그 기능이다. 읽기 전에 시간이 얼마나 걸리는지 알려주는 거. 처음엔 그냥 넣었는데, 이게 진짜 필요한 건지 의문이 들었다.

---

## 왜 지웠는가

두 가지 이유였다.

**첫째, 정보값이 없다.**
내 포스트는 대부분 실용적인 설정 가이드나 짧은 경험 기록이다. 거의 다 "1~2분 읽기"로 나온다. 모든 포스트가 "1분 읽기"면 독자에게 아무 정보도 주지 못한다. 눈만 차지하는 텍스트다.

**둘째, 하드코딩 값이었다.**
코드를 보니 실제 글자 수로 계산하는 게 아니라 그냥 `1 {minReadLabel}` 로 고정 값이 박혀 있었다. 이러면 더더욱 의미가 없다.

---

## "조회수로 바꾸는 건 어떨까?"

이 생각도 잠깐 해봤다. 근데 결론은 **지금은 아니다**.

초기 블로그에 조회수가 붙으면 어떻게 될까. "3 views", "7 views" 같은 숫자가 보인다. 이게 신뢰를 올려주는 게 아니라 **"아무도 안 읽는 블로그구나"** 라는 인상을 줄 수 있다.

게다가 조회수를 제대로 구현하려면 Supabase 같은 백엔드가 필요하다. 지금 당장 그 리소스를 쓸 이유가 없다.

**트래픽이 어느 정도 쌓인 후에 추가하는 게 훨씬 효과적이다.**

결국 지금은 둘 다 없애고, 날짜 + 태그만 남기기로 했다.

---

## 어디를 고쳐야 하나

먼저 읽기 시간이 어디서 렌더링되는지 찾았다.

```bash
grep -r "분 읽기\|readingTime\|minRead" . --include="*.tsx" -l
```

결과:
```
app/[locale]/page.tsx
app/[locale]/posts/page.tsx
app/[locale]/posts/[slug]/page.tsx
components/PostCard.tsx
components/PostsClient.tsx
```

두 군데에 중복으로 있었다. `PostCard`는 홈 페이지에서 쓰이고, `PostsClient`는 포스트 목록 페이지에서 쓰인다. 둘 다 손봐야 했다.

---

## Step 1 — PostCard.tsx 수정

홈 화면 포스트 카드에서 읽기 시간 부분을 제거한다.

**before:**
```tsx
interface Props {
  post: PostMeta;
  minReadLabel?: string;  // 제거
  readLabel?: string;
}

export default function PostCard({ post, minReadLabel = "min read", readLabel = "Read →" }: Props) {
  // ...
  <span className="flex items-center" style={{ gap: "0.375rem" }}>
    <svg ...> {/* 시계 아이콘 */} </svg>
    1 {minReadLabel}
  </span>
}
```

**after:**
```tsx
interface Props {
  post: PostMeta;
  readLabel?: string;
}

export default function PostCard({ post, readLabel = "Read →" }: Props) {
  // ...
  // 읽기 시간 span 전체 삭제
}
```

---

## Step 2 — PostsClient.tsx 수정

포스트 목록 페이지에서 필터/검색 기능과 함께 포스트를 렌더링하는 컴포넌트다.

**before:**
```tsx
interface Props {
  posts: PostMeta[];
  minReadLabel: string;  // 제거
  readLabel: string;
}

export default function PostsClient({ posts, minReadLabel, readLabel }: Props) {
  // ...
  <span className="flex items-center" style={{ gap: "0.375rem" }}>
    <svg ...> {/* 시계 아이콘 */} </svg>
    1 {minReadLabel}
  </span>
}
```

**after:**
```tsx
interface Props {
  posts: PostMeta[];
  readLabel: string;
}

export default function PostsClient({ posts, readLabel }: Props) {
  // 읽기 시간 span 삭제
}
```

---

## Step 3 — 상위 컴포넌트에서 prop 전달 제거

`PostCard`와 `PostsClient`를 호출하는 쪽에서도 `minReadLabel` prop을 넘기고 있었다. 이것도 전부 지워야 TypeScript 에러가 안 난다.

**app/[locale]/posts/page.tsx:**
```tsx
// before
<PostsClient
  posts={posts}
  minReadLabel={tPost("minRead")}
  readLabel={tPost("read")}
/>

// after
<PostsClient
  posts={posts}
  readLabel={tPost("read")}
/>
```

**app/[locale]/page.tsx (홈):**
```tsx
// before
<PostCard post={post} minReadLabel={tPost("minRead")} readLabel={tPost("read")} />

// after
<PostCard post={post} readLabel={tPost("read")} />
```

---

## Step 4 — 타입 체크 후 배포

```bash
npx tsc --noEmit
```

에러 없으면 커밋 & 푸시.

```bash
git add components/PostCard.tsx components/PostsClient.tsx \
        'app/[locale]/posts/page.tsx' 'app/[locale]/page.tsx'
git commit -m "feat: 포스트 목록에서 읽기 시간 표시 제거"
git push origin main
```

> **참고:** Next.js 프로젝트에서 `app/[locale]/` 같이 대괄호가 포함된 경로는 git add 시 반드시 따옴표로 감싸야 한다. 안 그러면 zsh가 glob으로 해석해서 `no matches found` 에러가 난다.

---

## 정리

```
문제 인식: "1분 읽기"가 모든 포스트에 고정 값으로 표시됨 → 정보값 없음
    ↓
대안 검토: 조회수? → 초기 블로그엔 역효과. 구현 비용도 있음
    ↓
결론: 둘 다 제거, 날짜 + 태그만 남김
    ↓
코드 작업:
  PostCard.tsx → minReadLabel prop 제거 + 시계 아이콘 span 제거
  PostsClient.tsx → 동일하게 제거
  상위 페이지들 → prop 전달 코드 정리
    ↓
tsc --noEmit 확인 → 커밋 & 배포
```

작은 변경이지만 UI에서 의미 없는 요소를 하나씩 걷어내는 게 결국 깔끔한 디자인으로 이어진다. 조회수 기능은 트래픽이 어느 정도 쌓인 뒤에 다시 고민해볼 예정이다.
