---
title: "첫 번째 글"
date: "2026-03-26"
description: "backtodev 블로그를 시작합니다."
tags: ["일상", "시작"]
lang: "ko"
---

## 시작하며

이 블로그는 개발 기록을 위한 공간입니다.

## 글 작성 방법

`content/posts/` 폴더에 마크다운 파일을 추가하면 자동으로 글이 생성됩니다.

파일 상단에 frontmatter를 작성합니다:

```yaml
---
title: "글 제목"
date: "2026-03-26"
description: "짧은 설명"
tags: ["태그1", "태그2"]
---
```

## 마크다운 지원

**굵게**, _기울임_, `인라인 코드`, [링크](#) 모두 사용 가능합니다.

```typescript
// 코드 블록도 지원합니다
const greet = (name: string) => `Hello, ${name}!`;
console.log(greet("world"));
```

> 인용구도 사용할 수 있습니다.

---

테이블:

| 항목 | 내용 |
|------|------|
| 프레임워크 | Next.js 15 |
| 언어 | TypeScript |
| 스타일링 | Tailwind CSS |
