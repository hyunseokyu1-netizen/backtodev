---
title: 'Google이 내 블로그 예시 코드를 링크로 크롤링한 날'
date: '2026-05-17'
publish_date: '2026-06-07'
description: Search Console 404 오류를 추적했더니 포스트 본문의 코드 예시 파일명을 Google이 실제 URL로 인식한 것이었다 — next.config.ts redirects로 해결
tags:
  - NextJS
  - SEO
  - GoogleSearchConsole
  - Debugging
---

Google Search Console을 열었더니 **페이지 색인 생성 → 찾을 수 없음(404)** 항목에 URL 4개가 쌓여 있었다.

```
https://backtodev.com/posts/hello-world
https://backtodev.com/ko/posts/hello-world
https://backtodev.com/ko/posts/ai-개발시작001-클로드-코드-시작
https://backtodev.com/posts/ai-개발시작001-클로드-코드-시작
```

이상했다. `hello-world`라는 포스트를 쓴 적이 없는데.

---

## 원인 추적

### `ai-개발시작001-클로드-코드-시작` — 구 슬러그

초기에 이 블로그의 포스트 파일명이 한국어였던 시절이 있었다.

```
# 예전 파일명
ai-개발시작001-클로드-코드-시작.ko.md

# 현재 파일명
ai_coding_start_001_20260327.ko.md
```

파일명이 그대로 slug가 되는 구조라, 파일명을 영어로 바꾸면서 URL이 바뀌었다. Google은 이미 옛날 URL을 크롤링해서 인덱스에 가지고 있었고, 지금도 그 URL을 주기적으로 확인하러 온다. 매번 404를 맞는 것이다.

### `hello-world` — 코드 예시를 링크로 착각

이건 더 황당했다. `hello-world` 포스트는 존재하지 않는다. 어디서 나온 URL일까 찾아봤더니, 다른 포스트 본문의 **코드 예시**에 있었다.

```markdown
<!-- ai_coding_start_003 포스트 본문 중 -->
파일 구조 예시:
  hello-world.ko.md   ← 한국어 버전
  hello-world.en.md   ← 영어 버전
```

Google 크롤러가 마크다운에서 렌더링된 HTML을 읽다가 `hello-world`라는 텍스트를 발견하고, 현재 URL(`/ko/posts/ai_coding_start_003_...`)을 기준으로 상대 경로를 추측해서 `/ko/posts/hello-world`를 방문한 것으로 보인다.

실제로 링크로 만든 것도 아닌데, 코드 블록 안의 텍스트를 URL 힌트로 해석한 셈이다.

---

## 해결: next.config.ts에 redirects 추가

Next.js에서 URL 리다이렉트는 `next.config.ts`의 `redirects()` 함수로 처리한다.

```ts
// next.config.ts
const nextConfig: NextConfig = {
  pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdx"],
  async redirects() {
    return [
      // 구 한국어 슬러그 → 현재 슬러그 (301 영구 이동)
      {
        source: "/:locale(ko|en)/posts/ai-%EA%B0%9C%EB%B0%9C%EC%8B%9C%EC%9E%91001-%ED%81%B4%EB%A1%9C%EB%93%9C-%EC%BD%94%EB%93%9C-%EC%8B%9C%EC%9E%91",
        destination: "/:locale/posts/ai_coding_start_001_20260327",
        permanent: true,
      },
      // locale 없는 버전도 처리
      {
        source: "/posts/ai-%EA%B0%9C%EB%B0%9C%EC%8B%9C%EC%9E%91001-...",
        destination: "/ko/posts/ai_coding_start_001_20260327",
        permanent: true,
      },
      // hello-world → 포스트 목록 (302 임시)
      {
        source: "/:locale(ko|en)/posts/hello-world",
        destination: "/:locale/posts",
        permanent: false,
      },
      {
        source: "/posts/hello-world",
        destination: "/ko/posts",
        permanent: false,
      },
    ];
  },
};
```

**주의**: 한국어가 포함된 URL은 URL 인코딩된 형태로 써야 한다. `ai-개발시작001`은 `ai-%EA%B0%9C%EB%B0%9C%EC%8B%9C%EC%9E%91001`이 된다. 브라우저 주소창에 한국어 URL을 붙여넣고 개발자 도구 Network 탭에서 실제 요청 URL을 확인하면 인코딩된 값을 알 수 있다.

---

## 301 vs 302 — 언제 뭘 써야 하나

| | 301 (영구) | 302 (임시) |
|--|-----------|-----------|
| `permanent` | `true` | `false` |
| Google 처리 | 기존 URL 인덱스 삭제, 새 URL로 SEO 점수 이전 | 기존 URL 유지, 새 URL은 임시 |
| 언제 쓰나 | 콘텐츠가 실제로 이사한 경우 | 임시 점검, 정체 불명의 404 처리 |

이번 케이스에서:
- **구 슬러그 (`ai-개발시작001-...`)** → 실제로 콘텐츠가 존재하고 URL만 바뀐 것 → **301**
- **`hello-world`** → 원래 없던 URL, 어디로 보낼지 확실하지 않음 → **302**

---

## 리다이렉트 작동 확인

배포 후 `curl`로 리다이렉트가 제대로 작동하는지 확인할 수 있다.

```bash
curl -I "https://backtodev.com/ko/posts/hello-world"
```

```
HTTP/2 302
location: /ko/posts
```

```bash
curl -I "https://backtodev.com/posts/hello-world"
```

```
HTTP/2 302
location: /ko/posts
```

응답에 `location` 헤더가 붙어서 오면 리다이렉트가 정상 작동하는 것이다.

---

## 트러블슈팅

**한국어 URL을 source에 직접 쓰면 빌드 에러가 난다**

Next.js redirects의 `source`는 URL 인코딩된 문자열이어야 한다. 한국어를 그대로 쓰면 파싱 오류가 발생한다.

```ts
// 틀림 — 한국어 직접 사용
source: "/posts/ai-개발시작001-클로드-코드-시작"

// 맞음 — URL 인코딩
source: "/posts/ai-%EA%B0%9C%EB%B0%9C%EC%8B%9C%EC%9E%91001-..."
```

인코딩 방법: 브라우저 주소창에 URL 붙여넣기 → Network 탭 → Request URL 확인. 또는 JavaScript `encodeURIComponent()` 사용.

```js
encodeURIComponent("개발시작001")
// → "%EA%B0%9C%EB%B0%9C%EC%8B%9C%EC%9E%91001"
```

**`/:locale(ko|en)` 패턴에서 destination에도 같은 값을 쓰려면**

`source`에서 `:locale(ko|en)`으로 캡처한 값은 `destination`에서 `:locale`로 재사용할 수 있다.

```ts
source: "/:locale(ko|en)/posts/old-slug",
destination: "/:locale/posts/new-slug",  // :locale에 ko 또는 en이 들어감
```

---

## Search Console에서 마무리

리다이렉트를 배포했다고 해서 Search Console 오류가 즉시 사라지지는 않는다. Google이 해당 URL을 재크롤링해야 오류 상태가 업데이트된다.

Search Console → URL 검사 → 해당 URL 입력 → **색인 생성 요청**을 누르면 우선순위를 높여서 재크롤링을 요청할 수 있다. 보통 며칠 내로 반영된다.

---

## 정리

```
404 원인 두 가지:

1. 구 슬러그
   파일명 변경 → URL 변경 → Google은 옛날 URL 기억
   → 301 리다이렉트로 새 URL로 안내

2. 코드 예시 텍스트
   본문에 hello-world.md 라고 썼더니
   Google이 /posts/hello-world 를 방문
   → 302 리다이렉트로 포스트 목록으로 보냄
```

파일명을 바꾸면 URL이 바뀐다. 한 번 Google에 인덱싱된 URL은 없어지는 게 아니라 404로 남는다. 파일명을 바꿀 때는 리다이렉트를 함께 챙기는 습관이 필요하다.
