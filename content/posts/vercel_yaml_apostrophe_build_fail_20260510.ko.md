---
title: "Don't 하나가 Vercel 빌드를 박살냈다 — YAML frontmatter 함정"
date: '2026-05-10'
publish_date: '2026-06-01'
description: 로컬 빌드는 멀쩡한데 Vercel만 실패할 때, 원인은 영어 축약어가 들어간 YAML title 한 줄이었다
tags:
  - Vercel
  - YAML
  - NextJS
  - Debugging
  - GitHubActions
---

배포가 갑자기 안 된다. 어제까지 잘 됐는데.

GitHub Actions로 예약 포스트가 자동 발행됐고, Vercel이 그 커밋을 감지해 빌드를 시작했다. 그런데 빌드가 실패했다. 에러 메시지는 딱 이것뿐:

```
Error: Command "npm run build" exited with 1
```

로컬에서 `npm run build`를 돌렸다. 성공한다. 뭐가 다른 거지?

---

## 왜 로컬은 되고 Vercel은 안 될까

이 블로그는 프로덕션 빌드 시 포스트를 **GitHub API**로 읽어온다. 로컬 개발에서는 파일시스템을 직접 읽지만, Vercel 빌드에서는 GitHub REST API를 호출해서 `content/posts/` 파일 목록과 내용을 가져온다.

```typescript
const IS_PROD = !!process.env.VERCEL;

// 프로덕션(Vercel)에서는 GitHub API로
if (IS_PROD) {
  const files = await listGitHubDir("content/posts");
  // ...
} else {
  // 로컬에서는 파일시스템 직접 읽기
  fs.readdirSync(postsDir)...
}
```

그래서 **로컬 `npm run build`는 파일을 직접 읽기 때문에 성공**하고, **Vercel은 GitHub API 경유라 다른 결과**가 나올 수 있다.

Vercel 환경을 로컬에서 재현하는 방법이 있다:

```bash
VERCEL=1 npm run build
```

이걸 돌리니 바로 에러가 터졌다.

---

## 에러 메시지 전문

```
YAMLException: can not read a block mapping entry;
a multiline key may not be an implicit key at line 3, column 5:
    date: '2026-05-04'
        ^
```

스택 트레이스를 따라가다 보니 문제가 된 파일의 내용이 보였다:

```
title: 'Why GitHub Actions Commits Don't Show on Your Contribution Graph'
```

바로 여기다. **작은따옴표(`'`)로 감싼 문자열 안에 또 작은따옴표가 들어갔다.**

`Don't`의 `'`가 YAML 파서 입장에서는 문자열의 끝으로 해석되고, 그 뒤의 `t Show...`는 뭔지 알 수 없는 문자열이 되어버린다. 파싱 실패.

---

## 왜 로컬 빌드에서는 잡히지 않았나

로컬 빌드는 `IS_PROD = false`라서 파일을 Node.js `fs`로 직접 읽는다. `gray-matter` 라이브러리가 파싱하는 건 똑같은데, 로컬에서는 성공하고 프로덕션에서만 실패한다는 게 이상하지 않나?

확인해보니 로컬 `content/posts/`에 있는 파일과 GitHub에 올라간 파일 내용이 잠깐 달랐다. GitHub Actions가 scheduled → posts로 파일을 이동시킨 직후, 내가 로컬에서 `git pull` 하기 전에 빌드를 돌렸기 때문이다. 로컬엔 아직 그 파일이 없었고, Vercel은 이미 GitHub에서 오류 파일을 읽고 있었다.

어쨌든 핵심은 **YAML 파싱 오류**다.

---

## 수정 방법

작은따옴표 대신 큰따옴표로 감싸면 끝이다.

```yaml
# 오류 — 작은따옴표 안에 '(apostrophe)가 있으면 YAML 파싱 실패
title: 'Why GitHub Actions Commits Don't Show on Your Contribution Graph'

# 정상 — 큰따옴표로 감싸면 내부 '는 그냥 문자로 처리됨
title: "Why GitHub Actions Commits Don't Show on Your Contribution Graph"
```

수정하고, 로컬에서 변경사항을 커밋 후 푸쉬.

그리고 **중요한 순서**: 수정 후 `VERCEL=1 npm run build`를 다시 돌려 확인할 때, 로컬에서 파일을 고쳐도 Vercel은 GitHub API로 읽기 때문에 **푸쉬를 먼저 해야** 수정이 반영된다.

```bash
# 1. 파일 수정
# 2. 커밋 & 푸쉬
git add content/posts/해당파일.en.md
git commit -m "fix: YAML title 따옴표 수정"
git push origin main

# 3. 그 다음에 VERCEL=1 빌드로 검증
VERCEL=1 npm run build
```

---

## 자주 걸리는 케이스

영어 포스트 title에서 apostrophe가 들어가는 흔한 표현들:

| 표현 | 예시 |
|------|------|
| don't / doesn't / didn't | `Don't Use This Pattern` |
| it's / that's / what's | `It's Not a Bug` |
| I've / you've / we've | `I've Been Doing It Wrong` |
| you're / they're | `You're Probably Overthinking This` |
| won't / can't / couldn't | `Why It Won't Work` |

이 중 하나라도 title에 들어가면 **무조건 큰따옴표**를 쓴다.

---

## 정리

```
GitHub Actions로 예약 포스트 발행
        ↓
Vercel 빌드 트리거
        ↓
posts.ts → IS_PROD=true → GitHub API로 파일 읽기
        ↓
gray-matter로 frontmatter 파싱
        ↓
title: '...Don't...' → YAMLException 발생
        ↓
Failed to collect page data for /[locale]/posts/[slug]
        ↓
빌드 실패 ❌
```

**재현 명령어**: `VERCEL=1 npm run build`

**수정 원칙**: 영어 title에 apostrophe가 있으면 `"..."` 큰따옴표 사용

---

*한 글자짜리 따옴표 하나가 빌드 파이프라인 전체를 멈춘다. YAML은 생각보다 엄격하다.*
