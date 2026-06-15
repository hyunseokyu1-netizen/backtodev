---
title: 'GitHub REST API Rate Limit 때문에 블로그 글 목록이 사라졌다'
date: '2026-05-27'
publish_date: '2026-06-16'
description: Next.js 블로그에서 GitHub API Rate Limit을 초과해 글 목록이 사라진 문제를 GraphQL API로 해결한 과정
tags:
  - GitHub API
  - GraphQL
  - Next.js
  - 트러블슈팅
---

## 어느 날 갑자기 글 목록이 사라졌다

블로그를 열었더니 "아직 작성된 글이 없습니다"라는 메시지가 떡하니 보였다.

분명히 글이 있는데. GitHub에 push도 잘 됐는데. 왜?

## 원인 파악: GitHub API Rate Limit 초과

이 블로그는 Next.js로 만들었고, 프로덕션에서는 로컬 파일 대신 **GitHub REST API**로 포스트 파일을 읽어온다. 구조는 이랬다.

```
IS_PROD = !!process.env.VERCEL

if (IS_PROD) {
  // GitHub REST API로 파일 목록 가져오기
  const files = await listGitHubDir("content/posts")  // 1번 호출
  
  // 각 파일 내용 가져오기 → 파일 수만큼 호출
  for (const file of files) {
    await fetchFromGitHub(`content/posts/${file.name}`)  // N번 호출
  }
}
```

`content/posts` 폴더에 파일이 96개다. 즉 **매 재검증마다 97번의 REST API 호출**이 발생한다.

```
revalidate: 300 (5분마다 재검증)
→ 시간당 최대 12번 재검증
→ 12 × 97 = 1,164번/시간
```

이 상태에서 트래픽이 몰리거나 배포가 반복되면 순식간에 **시간당 5,000번 한도**를 초과한다. 실제로 확인해봤더니 `used: 5131 / limit: 5000`이었다.

```bash
curl -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/rate_limit
```

```json
{
  "resources": {
    "core": {
      "limit": 5000,
      "used": 5131,
      "remaining": 0,
      "reset": 1779849216
    },
    "graphql": {
      "limit": 5000,
      "used": 0,
      "remaining": 5000   ← 이쪽은 여유 있음
    }
  }
}
```

여기서 눈에 띄는 게 있다. **GraphQL은 별도 풀로 5,000 remaining이 남아있다.**

---

## REST API vs GraphQL API: 뭐가 다른가

### REST API (기존 방식)

REST API는 **URL 하나 = 요청 1번** 구조다.

```
GET /repos/{owner}/{repo}/contents/content/posts    → 목록 1번
GET /repos/{owner}/{repo}/contents/content/posts/파일1.md  → 내용 1번
GET /repos/{owner}/{repo}/contents/content/posts/파일2.md  → 내용 1번
... (96번째까지)
```

파일 96개 → 총 97번 요청. 파일이 늘어날수록 비례해서 요청도 늘어난다.

### GraphQL API (변경 후)

GraphQL은 **한 번의 쿼리로 원하는 데이터를 전부 명세**한다.

```graphql
query {
  repository(owner: "...", name: "...") {
    object(expression: "HEAD:content/posts") {
      ... on Tree {
        entries {          # 디렉토리 목록
          name
          object {
            ... on Blob {
              text         # 파일 내용까지 한 번에
            }
          }
        }
      }
    }
  }
}
```

96개 파일을 **1번 요청으로** 전부 가져온다.

| | REST API | GraphQL API |
|---|---|---|
| 파일 96개 조회 | 97번 요청 | 1번 요청 |
| Rate Limit 풀 | core (5,000/h) | graphql (5,000/h, 독립) |
| Rate Limit 소진 속도 | 파일 수에 비례 | 항상 일정 |

---

## 코드 변경

### Before

```typescript
const GH_BASE = `https://api.github.com/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/contents`;

async function listGitHubDir(dirPath: string): Promise<{ name: string }[]> {
  const res = await fetch(`${GH_BASE}/${dirPath}`, {
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, ... },
    next: { revalidate: 300 },
  });
  return res.json();
}

async function fetchFromGitHub(filePath: string): Promise<string | null> {
  const res = await fetch(`${GH_BASE}/${filePath}`, {
    headers: { ... },
    next: { revalidate: 300 },
  });
  const data = await res.json();
  return Buffer.from(data.content, "base64").toString("utf-8");
}
```

### After

```typescript
const GH_GRAPHQL = "https://api.github.com/graphql";

// 디렉토리 전체를 1번 호출로 처리
async function listGitHubDirWithContent(
  dirPath: string
): Promise<{ name: string; text: string }[]> {
  const query = `
    query($owner: String!, $repo: String!, $expr: String!) {
      repository(owner: $owner, name: $repo) {
        object(expression: $expr) {
          ... on Tree {
            entries {
              name
              object {
                ... on Blob { text }
              }
            }
          }
        }
      }
    }
  `;
  const res = await fetch(GH_GRAPHQL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables: {
        owner: process.env.GITHUB_OWNER,
        repo: process.env.GITHUB_REPO,
        expr: `HEAD:${dirPath}`,
      },
    }),
    cache: "no-store",
  });

  const json = await res.json();
  const entries = json?.data?.repository?.object?.entries ?? [];
  return entries
    .filter((e) => e.object?.text != null)
    .map((e) => ({ name: e.name, text: e.object.text }));
}
```

---

## 함정 1: Vercel 환경변수에 개행 문자가 끼어들었다

GraphQL로 바꿨는데 여전히 동작하지 않았다. 디버그 API를 만들어서 확인해봤더니 충격적인 결과가 나왔다.

```json
{
  "gqlErrors": [{
    "message": "Could not resolve to a Repository with the name 'hyunseokyu1-netizen\n/backtodev\n'."
  }]
}
```

`GITHUB_OWNER` 값이 `"hyunseokyu1-netizen\n"` — **끝에 개행 문자가 붙어있었다.**

원인은 Vercel 환경변수를 `echo`로 설정했기 때문이다.

```bash
# 잘못된 방법 — echo는 자동으로 \n을 추가한다
echo "hyunseokyu1-netizen" | vercel env add GITHUB_OWNER production

# 올바른 방법 — printf는 \n을 추가하지 않는다
printf 'hyunseokyu1-netizen' | vercel env add GITHUB_OWNER production
```

Vercel CLI로 환경변수를 설정할 때는 반드시 `printf`를 써야 한다.

---

## 함정 2: getLocale()은 정적 렌더링과 충돌한다

글 목록 페이지에서 `getLocale()`을 사용했더니 `DYNAMIC_SERVER_USAGE` 에러가 발생했다.

```typescript
// 에러 발생
const locale = await getLocale();
```

`getLocale()`은 내부적으로 `headers()`를 호출하는 동적 함수다. Next.js가 페이지를 정적으로 렌더링하려는 순간 충돌이 난다.

`[locale]` 라우트에서는 `params`에서 바로 꺼내면 된다.

```typescript
// 올바른 방법
export default async function PostsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  ...
}
```

`params.locale`은 URL에서 이미 알고 있는 정적 값이라 충돌이 없다.

---

## Rate Limit 현재 상태 확인하는 법

```bash
curl -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/rate_limit
```

응답에서 `resources.core`와 `resources.graphql`을 각각 확인하면 된다. Reset 시각은 Unix timestamp로 나오는데, 이렇게 변환할 수 있다.

```python
import datetime
reset_ts = 1779849216  # API 응답의 reset 값
dt = datetime.datetime.fromtimestamp(reset_ts, datetime.timezone.utc).astimezone()
print(dt)  # 리셋 시각 출력
```

---

## 정리

| 문제 | 원인 | 해결 |
|---|---|---|
| 글 목록 사라짐 | REST API Rate Limit 초과 | GraphQL API로 전환 (N+1 → 1) |
| GraphQL 레포 못 찾음 | 환경변수에 `\n` 포함 | `echo` → `printf`로 변경 |
| DYNAMIC_SERVER_USAGE | `getLocale()` 동적 함수 | `params.locale`로 교체 |

파일이 늘어날수록 REST API는 점점 더 많은 요청이 필요하다. GraphQL은 항상 1번. 포스트 수가 많아질수록 GraphQL이 유리해지는 구조다.
