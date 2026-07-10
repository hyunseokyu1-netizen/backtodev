---
title: "My Blog's Post List Vanished Because of a GitHub REST API Rate Limit"
date: '2026-05-27'
publish_date: '2026-06-16'
description: How I fixed a Next.js blog's post list disappearing after hitting the GitHub API rate limit, by switching to the GraphQL API
tags:
  - GitHub API
  - GraphQL
  - Next.js
  - Troubleshooting
---

## One day the post list just vanished

I opened the blog and there it was: "No posts yet."

But there were definitely posts. The push to GitHub had gone through fine too. So why?

## Root cause: exceeded the GitHub API rate limit

This blog is built with Next.js, and in production it reads post files via the **GitHub REST API** instead of local files. The structure looked like this.

```
IS_PROD = !!process.env.VERCEL

if (IS_PROD) {
  // Get the file list via the GitHub REST API
  const files = await listGitHubDir("content/posts")  // 1 call
  
  // Fetch each file's content → one call per file
  for (const file of files) {
    await fetchFromGitHub(`content/posts/${file.name}`)  // N calls
  }
}
```

The `content/posts` folder has 96 files. That means **every revalidation triggers 97 REST API calls.**

```
revalidate: 300 (revalidates every 5 minutes)
→ up to 12 revalidations per hour
→ 12 × 97 = 1,164 calls/hour
```

Under this setup, a traffic spike or a burst of deploys blows past the **5,000-calls-per-hour cap** in no time. Checking it directly confirmed `used: 5131 / limit: 5000`.

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
      "remaining": 5000   ← this one has room
    }
  }
}
```

Something jumps out here. **GraphQL has its own separate pool, with 5,000 remaining.**

---

## REST API vs. GraphQL API: what's the difference

### REST API (the old approach)

REST API works on a **one URL = one request** basis.

```
GET /repos/{owner}/{repo}/contents/content/posts    → 1 call for the list
GET /repos/{owner}/{repo}/contents/content/posts/file1.md  → 1 call for content
GET /repos/{owner}/{repo}/contents/content/posts/file2.md  → 1 call for content
... (up to the 96th)
```

96 files → 97 total requests. Requests grow proportionally as files pile up.

### GraphQL API (after switching)

GraphQL lets you **specify exactly the data you want in a single query.**

```graphql
query {
  repository(owner: "...", name: "...") {
    object(expression: "HEAD:content/posts") {
      ... on Tree {
        entries {          # directory listing
          name
          object {
            ... on Blob {
              text         # file content, all in one go
            }
          }
        }
      }
    }
  }
}
```

All 96 files come back in **a single request.**

| | REST API | GraphQL API |
|---|---|---|
| Fetching 96 files | 97 requests | 1 request |
| Rate limit pool | core (5,000/h) | graphql (5,000/h, independent) |
| Rate limit burn rate | proportional to file count | always constant |

---

## The code change

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

// Handle the entire directory in a single call
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

## Pitfall 1: a newline had snuck into a Vercel environment variable

I switched to GraphQL, and it still didn't work. Building a debug API to check revealed something jarring.

```json
{
  "gqlErrors": [{
    "message": "Could not resolve to a Repository with the name 'hyunseokyu1-netizen\n/backtodev\n'."
  }]
}
```

The `GITHUB_OWNER` value was `"hyunseokyu1-netizen\n"` — **a trailing newline character.**

The cause was setting Vercel's environment variable via `echo`.

```bash
# Wrong — echo automatically appends \n
echo "hyunseokyu1-netizen" | vercel env add GITHUB_OWNER production

# Correct — printf doesn't append \n
printf 'hyunseokyu1-netizen' | vercel env add GITHUB_OWNER production
```

When setting environment variables via the Vercel CLI, always use `printf`.

---

## Pitfall 2: getLocale() conflicts with static rendering

Using `getLocale()` on the posts list page produced a `DYNAMIC_SERVER_USAGE` error.

```typescript
// throws
const locale = await getLocale();
```

`getLocale()` is a dynamic function that internally calls `headers()`. It conflicts the moment Next.js tries to statically render the page.

In a `[locale]` route, pull it straight out of `params` instead.

```typescript
// correct approach
export default async function PostsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  ...
}
```

`params.locale` is already a static value known from the URL, so there's no conflict.

---

## How to check your current rate limit status

```bash
curl -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/rate_limit
```

Check `resources.core` and `resources.graphql` respectively in the response. The reset time comes back as a Unix timestamp, which you can convert like this.

```python
import datetime
reset_ts = 1779849216  # the reset value from the API response
dt = datetime.datetime.fromtimestamp(reset_ts, datetime.timezone.utc).astimezone()
print(dt)  # print the reset time
```

---

## Summary

| Problem | Cause | Fix |
|---|---|---|
| Post list vanished | Exceeded REST API rate limit | Switched to GraphQL API (N+1 → 1) |
| GraphQL couldn't find the repo | Environment variable contained `\n` | Changed from `echo` to `printf` |
| DYNAMIC_SERVER_USAGE | `getLocale()` dynamic function | Replaced with `params.locale` |

REST API needs proportionally more requests as your file count grows. GraphQL always needs just one. The more posts you have, the more GraphQL wins out.
