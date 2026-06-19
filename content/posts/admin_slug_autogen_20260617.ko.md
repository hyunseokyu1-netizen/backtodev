---
title: "Admin 글쓰기 slug 자동생성 개선 — DeepL + camelCase + 날짜"
date: '2026-06-17'
publish_date: '2026-06-20'
description: 한국어 제목에서 slug를 자동 생성할 때 영어 번역, camelCase 변환, 날짜 suffix를 붙이도록 개선한 과정
tags:
  - NextJS
  - Admin
  - UX
  - DeepL
---

블로그 어드민에서 새 글을 쓸 때 slug를 직접 입력하는 게 귀찮았다.

제목을 입력하면 slug가 자동으로 만들어지긴 했는데, 결과가 `나의-첫-번째-글` 같은 형태였다. URL에 한글이 그대로 들어가는 건 기술적으로는 문제없지만, 영어 slug가 더 깔끔하고 공유할 때도 낫다. 날짜도 포함되면 글 관리하기 편하고.

---

## 기존 방식의 문제

기존 코드는 단순했다. 한국어 제목을 소문자로 만들고, 특수문자 제거하고, 공백을 `-`로 바꾸는 게 전부였다.

```typescript
const generated = ko.title
  .toLowerCase()
  .replace(/[^a-z0-9가-힣\s-]/g, "")
  .replace(/\s+/g, "-")
  .slice(0, 60);
```

결과: `나의-첫-번째-글`

두 가지가 마음에 안 들었다.

1. **한글이 그대로 들어간다** — `나의-첫-번째-글` 같은 slug는 URL 인코딩되면 `%EB%82%98%EC%9D%98-...` 형태가 된다
2. **날짜가 없다** — 비슷한 주제의 글이 생기면 slug 충돌이 발생할 수 있고, 파일명만 봐서는 언제 쓴 글인지 모른다

---

## 개선 방향

원하는 최종 결과물: `youAndMe_20260617`

세 가지를 바꾸기로 했다.

- 한국어 제목 → DeepL로 영어 번역
- 영어 단어들 → camelCase로 합치기
- 날짜(`YYYYMMDD`) → 언더스코어로 suffix 추가

---

## 구현

이미 어드민에 DeepL 번역 API(`/api/admin/translate`)가 있었다. 글 본문 번역 초안에 쓰던 거라 그대로 재활용했다.

```typescript
useEffect(() => {
  if (!isEdit && !slugManual && ko.title) {
    const timer = setTimeout(async () => {
      setSlugGenerating(true);
      try {
        const englishTitle = await autoTranslate(ko.title, "ko-en");
        const words = englishTitle
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, "")
          .trim()
          .split(/\s+/)
          .filter(Boolean);
        const base = words
          .map((w, i) => i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1))
          .join("")
          .slice(0, 50);
        slugBaseRef.current = base;
        setSlug(`${base}_${dateRef.current.replace(/-/g, "")}`);
      } catch {
        // DeepL 실패 시 한글 fallback
        const base = ko.title
          .toLowerCase()
          .replace(/[^a-z0-9가-힣\s]/g, "")
          .replace(/\s+/g, "-")
          .slice(0, 50);
        slugBaseRef.current = base;
        setSlug(`${base}_${dateRef.current.replace(/-/g, "")}`);
      } finally {
        setSlugGenerating(false);
      }
    }, 800);
    return () => clearTimeout(timer);
  }
}, [ko.title, isEdit, slugManual]);
```

핵심은 세 부분이다.

**1. 디바운스 (800ms)**
제목을 타이핑할 때마다 API를 호출하면 낭비다. 입력이 멈춘 뒤 800ms 후에 한 번만 호출한다. `useEffect` cleanup에서 `clearTimeout`으로 이전 타이머를 취소하는 표준 패턴.

**2. camelCase 변환**
`"you and me"` → `["you", "and", "me"]` → `i === 0`이면 그대로, 나머지는 첫 글자 대문자 → `"youAndMe"`.

**3. 날짜 연동**
날짜 필드(`date`)가 바뀌면 slug의 날짜 suffix도 자동으로 업데이트된다. 번역된 base를 `slugBaseRef`에 저장해두고 재활용한다.

```typescript
// 날짜 변경 시 slug suffix 업데이트
useEffect(() => {
  if (!isEdit && !slugManual && slugBaseRef.current) {
    setSlug(`${slugBaseRef.current}_${date.replace(/-/g, "")}`);
  }
}, [date, isEdit, slugManual]);
```

---

## 결과

| 한국어 제목 | 기존 slug | 개선 slug |
|---|---|---|
| 너와 나의 이야기 | `너와-나의-이야기` | `youAndMyStory_20260617` |
| 클로드 코드 사용법 | `클로드-코드-사용법` | `howToUseClaudeCode_20260617` |
| Next.js 배포 삽질 | `nextjs-배포-삽질` | `nextjsDeploymentStruggles_20260617` |

DeepL 번역 품질이 제법 좋아서 slug로 쓸 만한 영어가 나온다. 가끔 관사(a, the, an)나 불필요한 단어가 붙는 게 거슬리긴 하지만, 직접 수정하는 것보다는 훨씬 빠르다.

---

## 한 가지 주의

이미 발행된 글의 slug는 변경하면 URL이 바뀌어 404가 난다. 수정 모드(`isEdit = true`)에서는 slug 필드가 비활성화되어 있어서 실수로 바꾸는 건 막혔지만, 기존에 한글 slug로 발행된 글들은 그대로 유지된다.

---

*타이핑 멈추고 1초 기다리면 slug가 완성되는 게 생각보다 편하다.*
