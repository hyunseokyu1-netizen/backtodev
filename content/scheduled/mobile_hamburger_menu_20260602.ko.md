---
title: '모바일에서 메뉴가 잘린다 — 햄버거 메뉴로 해결하기'
date: '2026-06-02'
publish_date: '2026-06-18'
description: Next.js 블로그 네비게이션이 모바일에서 스크롤이 생기는 문제를 햄버거 메뉴로 해결한 과정
tags:
  - Next.js
  - React
  - 반응형 디자인
  - Tailwind CSS
---

## 모바일에서 메뉴가 밀려나고 있었다

블로그를 만들고 나서 한동안 데스크톱에서만 확인했다.

어느 날 폰으로 들어가봤더니 상단 네비게이션이 이렇게 생겼다.

```
[로고]  Home Posts Portfolio About [EN]
```

화면 너비가 좁아서 메뉴가 꽉 차 있고, 잘 보이지 않는 경우도 있었다. 스크롤을 해야 메뉴 전체가 보이는 상황.

이건 고쳐야 했다.

---

## 어떤 방식으로 해결할까

모바일 네비게이션 처리 방법은 크게 세 가지다.

| 방식 | 설명 | 단점 |
|------|------|------|
| 글자 크기 축소 | 폰트를 줄여서 한 줄에 억지로 맞춤 | 가독성 나빠짐 |
| 하단 탭바 | 화면 아래에 아이콘 메뉴 배치 | 구조 변경이 크고, 앱 느낌 |
| 햄버거 메뉴 | 버튼 클릭 시 드롭다운 펼침 | 클릭 한 번이 추가됨 |

블로그는 콘텐츠가 중심이고, 메뉴 항목이 4개라서 햄버거 메뉴가 제일 깔끔하다고 판단했다.

데스크톱은 기존 가로 메뉴 그대로 유지하고, 모바일(`md` 미만)에서만 햄버거로 전환하는 방식으로 구현했다.

---

## 구현

### Step 1 — 아이콘 컴포넌트 추가

라이브러리 없이 SVG로 직접 만들었다. 용량이 가볍고, 스타일 커스터마이징도 자유롭다.

```tsx
const HamburgerIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
```

---

### Step 2 — 메뉴 열림 상태 관리

```tsx
const [menuOpen, setMenuOpen] = useState(false);
```

열렸는지 닫혔는지를 단순 boolean으로 관리한다.

---

### Step 3 — 햄버거 버튼 추가

기존 헤더 안에, 데스크톱 nav 옆에 버튼을 붙인다.

`md:hidden`으로 모바일에서만 보이게 하고, 데스크톱 nav는 `hidden md:flex`로 모바일에서는 숨긴다.

```tsx
{/* 데스크톱 nav — md 이상에서만 표시 */}
<nav className="hidden md:flex items-center">
  {/* ...링크들... */}
</nav>

{/* 햄버거 버튼 — md 미만에서만 표시 */}
<button
  className="flex md:hidden items-center justify-center rounded-lg transition-colors"
  style={{
    padding: "0.375rem",
    color: "hsl(var(--muted-foreground))",
    background: menuOpen ? "hsl(var(--primary) / 0.1)" : "transparent",
  }}
  onClick={() => setMenuOpen((v) => !v)}
  aria-label="메뉴 열기"
>
  {menuOpen ? <CloseIcon /> : <HamburgerIcon />}
</button>
```

버튼이 열려있을 때는 배경색을 살짝 주어서 상태를 시각적으로 표현했다.

---

### Step 4 — 드롭다운 메뉴 패널

헤더 바로 아래에 조건부로 드롭다운을 렌더링한다.

```tsx
{menuOpen && (
  <div
    className="md:hidden"
    style={{
      borderTop: "1px solid hsl(var(--border) / 0.4)",
      background: "hsl(var(--background) / 0.95)",
      backdropFilter: "blur(20px)",
    }}
  >
    <nav className="flex flex-col px-6 py-4" style={{ gap: "0.25rem" }}>
      {links.map(({ href, label }) => {
        const active = href === "/" ? cleanPath === "/" : cleanPath.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setMenuOpen(false)} // 링크 클릭 시 메뉴 닫기
            className="flex items-center py-3 text-base font-medium transition-colors"
            style={{
              color: active ? "hsl(var(--primary))" : "hsl(var(--foreground))",
              borderBottom: "1px solid hsl(var(--border) / 0.3)",
              gap: "0.75rem",
            }}
          >
            <span style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: "0.8rem",
              color: active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
            }}>
              {active ? "▶" : "○"}
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  </div>
)}
```

몇 가지 챙긴 것들:

- **링크 클릭 시 메뉴 닫기** — `onClick={() => setMenuOpen(false)}`. 안 넣으면 링크 이동 후에도 메뉴가 열려있다.
- **현재 페이지 표시** — `▶` / `○` 로 활성 링크를 구분.
- **배경 블러** — `backdropFilter: blur(20px)` 로 헤더와 동일한 유리 효과.
- **구분선** — 각 항목 사이 `borderBottom`으로 구분.

---

### Step 5 — 로고 클릭 시도 메뉴 닫기

메뉴가 열린 상태에서 로고를 클릭하면 홈으로 이동하면서 메뉴도 닫히도록 처리했다.

```tsx
<Link href="/" onClick={() => setMenuOpen(false)}>
  {/* 로고 */}
</Link>
```

---

## 전후 비교

| | 변경 전 | 변경 후 |
|--|---------|---------|
| 데스크톱 | 가로 메뉴 | 가로 메뉴 (동일) |
| 모바일 | 메뉴 꽉 참, 스크롤 필요 | 햄버거 버튼 → 드롭다운 |
| 현재 페이지 표시 | 하단 밑줄 | ▶ 아이콘 + 색상 강조 |

---

## 정리

```
모바일 네비게이션 흐름:

헤더
├── [데스크톱] hidden md:flex → 가로 메뉴 그대로
└── [모바일]  flex md:hidden → 햄버거 버튼

버튼 클릭
├── menuOpen: false → true → 드롭다운 렌더링
└── menuOpen: true  → false → 드롭다운 제거

드롭다운 링크 클릭 → setMenuOpen(false) → 자동으로 닫힘
```

라이브러리 없이 SVG 아이콘과 `useState` 하나로 구현했다. Tailwind의 반응형 prefix(`md:hidden`, `hidden md:flex`)를 활용하면 데스크톱과 모바일을 깔끔하게 분리할 수 있다.
