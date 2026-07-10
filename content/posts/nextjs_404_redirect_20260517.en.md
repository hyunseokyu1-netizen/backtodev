---
title: 'The Day Google Crawled a Code Example on My Blog as an Actual Link'
date: '2026-05-17'
publish_date: '2026-06-07'
description: Tracing a 404 error in Search Console led to discovering Google had interpreted a filename inside a post's code example as a real URL — fixed with redirects in next.config.ts
tags:
  - NextJS
  - SEO
  - GoogleSearchConsole
  - Debugging
---

Opening Google Search Console, the **Page indexing → Not found (404)** section had 4 URLs piled up.

```
https://backtodev.com/posts/hello-world
https://backtodev.com/ko/posts/hello-world
https://backtodev.com/ko/posts/ai-개발시작001-클로드-코드-시작
https://backtodev.com/posts/ai-개발시작001-클로드-코드-시작
```

Odd. I've never written a post called `hello-world`.

---

## Tracing the cause

### `ai-개발시작001-클로드-코드-시작` — an old slug

Early on, this blog went through a phase where post filenames were in Korean.

```
# old filename
ai-개발시작001-클로드-코드-시작.ko.md

# current filename
ai_coding_start_001_20260327.ko.md
```

Since the filename directly becomes the slug, the URL changed when I switched filenames to English. Google had already crawled the old URL and had it in its index, and it still periodically comes back to check that URL. Every time, it hits a 404.

### `hello-world` — mistaking a code example for a link

This one was even more absurd. There's no `hello-world` post. Digging into where this URL came from, I found it — inside a **code example** in another post's body.

```markdown
<!-- from the ai_coding_start_003 post body -->
Example file structure:
  hello-world.ko.md   ← Korean version
  hello-world.en.md   ← English version
```

It looks like Google's crawler, reading the rendered HTML from the markdown, spotted the text `hello-world` and, based on the current URL (`/ko/posts/ai_coding_start_003_...`), guessed a relative path and visited `/ko/posts/hello-world`.

It was never actually made into a link — plain text inside a code block got interpreted as a URL hint.

---

## Fix: adding redirects to next.config.ts

In Next.js, URL redirects are handled through the `redirects()` function in `next.config.ts`.

```ts
// next.config.ts
const nextConfig: NextConfig = {
  pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdx"],
  async redirects() {
    return [
      // old Korean slug → current slug (301 permanent)
      {
        source: "/:locale(ko|en)/posts/ai-%EA%B0%9C%EB%B0%9C%EC%8B%9C%EC%9E%91001-%ED%81%B4%EB%A1%9C%EB%93%9C-%EC%BD%94%EB%93%9C-%EC%8B%9C%EC%9E%91",
        destination: "/:locale/posts/ai_coding_start_001_20260327",
        permanent: true,
      },
      // handle the locale-less version too
      {
        source: "/posts/ai-%EA%B0%9C%EB%B0%9C%EC%8B%9C%EC%9E%91001-...",
        destination: "/ko/posts/ai_coding_start_001_20260327",
        permanent: true,
      },
      // hello-world → post list (302 temporary)
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

**Watch out**: URLs containing Korean characters must be written URL-encoded. `ai-개발시작001` becomes `ai-%EA%B0%9C%EB%B0%9C%EC%8B%9C%EC%9E%91001`. Paste the Korean URL into your browser's address bar, check the actual request URL in DevTools' Network tab, and you'll get the encoded value.

---

## 301 vs. 302 — which one, when

| | 301 (Permanent) | 302 (Temporary) |
|--|-----------|-----------|
| `permanent` | `true` | `false` |
| How Google treats it | drops the old URL from its index, transfers SEO value to the new URL | keeps the old URL, treats the new one as temporary |
| When to use | content genuinely moved | temporary maintenance, handling an unclear 404 |

For this case:
- **Old slug (`ai-개발시작001-...`)** — content genuinely exists, only the URL changed → **301**
- **`hello-world`** — never existed to begin with, unclear what it should point to → **302**

---

## Verifying the redirect works

After deploying, you can confirm the redirect works with `curl`.

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

A `location` header in the response means the redirect is working correctly.

---

## Troubleshooting

**Using a Korean URL directly in source causes a build error**

Next.js redirects' `source` needs to be a URL-encoded string. Using Korean text directly causes a parsing error.

```ts
// Wrong — using Korean directly
source: "/posts/ai-개발시작001-클로드-코드-시작"

// Correct — URL-encoded
source: "/posts/ai-%EA%B0%9C%EB%B0%9C%EC%8B%9C%EC%9E%91001-..."
```

How to encode: paste the URL into your browser's address bar → Network tab → check the Request URL. Or use JavaScript's `encodeURIComponent()`.

```js
encodeURIComponent("개발시작001")
// → "%EA%B0%9C%EB%B0%9C%EC%8B%9C%EC%9E%91001"
```

**Reusing the same captured value in destination for a `/:locale(ko|en)` pattern**

A value captured with `:locale(ko|en)` in `source` can be reused as `:locale` in `destination`.

```ts
source: "/:locale(ko|en)/posts/old-slug",
destination: "/:locale/posts/new-slug",  // :locale carries over as ko or en
```

---

## Wrapping up in Search Console

Deploying the redirect doesn't make the Search Console error disappear instantly. Google needs to re-crawl the URL for the error status to update.

Search Console → URL Inspection → enter the URL → clicking **Request Indexing** bumps up the priority for a re-crawl. It usually reflects within a few days.

---

## Summary

```
Two causes of 404s:

1. Old slug
   Filename changed → URL changed → Google still remembers the old URL
   → Guide it to the new URL with a 301 redirect

2. Code example text
   Writing "hello-world.md" in the body
   led Google to visit /posts/hello-world
   → Send it to the post list with a 302 redirect
```

Change a filename, and the URL changes. A URL once indexed by Google doesn't just disappear — it lingers as a 404. Whenever you rename a file, get in the habit of setting up a redirect alongside it.
