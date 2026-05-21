---
title: '스크린샷 50장이 블로그를 통째로 날렸다 — GitHub API 한도 초과 디버깅'
date: '2026-05-12'
publish_date: '2026-06-02'
description: 이미지 50개를 한 번에 커밋했더니 Vercel 빌드가 50번 돌면서 GitHub API 요청이 한도를 꽉 채운 이야기
tags:
  - Vercel
  - GitHub
  - NextJS
  - Debugging
---

구글 플레이스토어 앱 등록 과정을 이미지로 정리한 포스트를 올리고 있었다.

스크린샷을 찍으면서 하나씩 커밋했다. 50장쯤 됐을 때 사이트에 접속했더니 포스트 목록이 텅 비어 있었다. 어제까지 잘 보이던 글들이 전부 사라졌다.

빌드 로그에는 이렇게만 나와 있었다:

```
Error: Command "npm run build" exited with 1
```

---

## 이 블로그의 구조

먼저 구조를 설명하면, 이 블로그는 Next.js + Vercel 조합이고 포스트는 GitHub 저장소의 `content/posts/` 폴더에 마크다운 파일로 저장된다.

그런데 Vercel에서는 파일을 직접 읽지 않는다. 대신 **GitHub API**를 호출해서 파일 목록과 내용을 가져온다.

```typescript
// 프로덕션에서는 GitHub API로 읽음
const IS_PROD = !!process.env.VERCEL;

if (IS_PROD) {
  const files = await listGitHubDir("content/posts"); // API 호출 1회
  await Promise.all(
    files.map(f => fetchFromGitHub(`content/posts/${f.name}`)) // 파일마다 1회씩
  );
}
```

포스트가 100개면 페이지 로드 한 번에 API 101번 호출. 여기에 문제가 숨어 있었다.

---

## 어떻게 5,000번이 됐나

GitHub API 인증 요청 한도는 **시간당 5,000회**다.

스크린샷을 한 장씩 커밋했더니 이런 일이 벌어졌다:

```
이미지 커밋 1개
  → Vercel 빌드 트리거
  → 빌드 중 content/posts/ 전체 읽기
  → GitHub API 약 100회 호출
```

이게 50번 반복됐다.

```
50번 빌드 × 100 API 호출 = 5,000회 → 한도 초과 ❌
```

한도를 넘어서는 순간, 모든 API 호출이 `403 rate limit exceeded`를 반환한다. `listGitHubDir`은 실패 시 빈 배열을 반환하도록 짜여 있어서, 에러 없이 그냥 포스트가 0개인 것처럼 보였다.

---

## 원인 파악 과정

### Step 1 — 로컬에서 재현

로컬 빌드(`npm run build`)는 파일시스템을 직접 읽기 때문에 잘 된다. Vercel 환경을 흉내 내려면 환경변수를 하나 넣으면 된다:

```bash
VERCEL=1 npm run build
```

실행하니 바로 에러가 났다. 재현 성공.

### Step 2 — GitHub API 직접 확인

```bash
curl -s "https://api.github.com/repos/{owner}/{repo}/contents/content/posts" \
  -H "Authorization: Bearer {TOKEN}" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('message',''))"
```

결과:

```
API rate limit exceeded for user ID 264085388.
```

원인 확정.

---

## 임시 해결 — 캐시 추가

`cache: "no-store"`로 설정돼 있던 API 호출에 5분 캐시를 추가했다.

```typescript
// 변경 전
const res = await fetch(url, {
  headers: ghHeaders,
  cache: "no-store", // 매번 새로 호출
});

// 변경 후
const res = await fetch(url, {
  headers: ghHeaders,
  next: { revalidate: 300 }, // 5분 캐시
});
```

이렇게 하면 같은 파일을 5분 안에 여러 번 요청해도 API는 1회만 호출된다. 일반적인 블로그 트래픽에서는 시간당 1,200회 정도로 한도 안에 들어온다.

---

## 근본적인 문제 — 이미지가 쌓일수록 나빠진다

지금 이미지를 `public/images/` 폴더에 저장하고 있는데, 이 방식은 두 가지 문제가 있다.

| 문제 | 설명 |
|------|------|
| Vercel 배포 용량 증가 | 이미지가 늘수록 매 배포에 포함되는 정적 파일이 커짐 |
| GitHub API 호출 증가 | 포스트 파일 수가 늘수록 빌드마다 API 소모량 증가 |

이미지를 많이 사용하는 포스트를 쓸 계획이라면, 외부 스토리지 연결을 고민해야 한다.

### 고려할 수 있는 옵션

**Cloudinary**
- 무료 플랜 25GB 스토리지
- 이미지 업로드하면 CDN URL을 반환 → 마크다운에 URL만 삽입
- 자동 리사이즈, WebP 변환 지원
- 블로그 이미지 용도로 가장 널리 쓰이는 선택지

**Supabase Storage**
- 무료 1GB, 이미 Supabase를 쓰고 있다면 추가 설정 없이 바로 사용 가능
- S3 호환 API

**Vercel Blob**
- Vercel 서비스라 설정이 가장 간단
- 무료 플랜 500MB

어느 쪽이든 방식은 동일하다. 이미지를 스토리지에 올리고, 반환된 URL을 마크다운에 붙여 넣는다.

```markdown
<!-- 변경 전: repo에 직접 저장 -->
![스크린샷](/images/screenshot.png)

<!-- 변경 후: 외부 스토리지 URL -->
![스크린샷](https://res.cloudinary.com/my-blog/image/upload/screenshot.png)
```

---

## 아예 GitHub API를 안 쓰는 방법도 있다

지금 GitHub API를 쓰는 이유는 "Vercel 서버리스 환경에서 파일을 읽을 수 없다"는 가정 때문이다.

그런데 Next.js의 `outputFileTracingIncludes` 설정을 쓰면 배포 번들에 `content/posts/` 를 포함시킬 수 있다. 그러면 파일시스템에서 직접 읽으면 되고, API 호출이 아예 없어진다.

```typescript
// next.config.ts
experimental: {
  outputFileTracingIncludes: {
    '/': ['./content/**/*'],
  },
}
```

GitHub Actions가 새 포스트를 push할 때마다 Vercel이 자동으로 재배포하기 때문에, 배포 시점에 모든 파일이 번들에 포함된다.

---

## 정리

```
이미지 50개 커밋 (1장씩)
  → Vercel 빌드 50번
  → 빌드마다 GitHub API 100회
  → 5,000회 = 시간당 한도 초과
  → 포스트 목록 빈 배열 반환
  → 사이트에서 글이 전부 사라짐

진단: VERCEL=1 npm run build
확인: curl로 API 직접 호출 → rate limit exceeded 메시지

즉각 조치: next: { revalidate: 300 } 캐시 추가
장기 대책: 이미지 외부 스토리지 이전 또는 파일시스템 직접 읽기 방식 전환
```

이미지를 올릴 때는 한 번에 모아서 커밋하는 게 좋다. 50번 따로 커밋하는 것과 1번에 50개 커밋하는 것은 Vercel 빌드 횟수에서 50배 차이가 난다.
