---
title: 'Showing an English Page to Foreign Users — By Browser Language, Not IP'
date: '2026-06-02'
publish_date: '2026-06-19'
description: How I auto-detect language in Next.js 16 proxy.ts using the Accept-Language header, with a cookie to persist the user's choice
tags:
  - Next.js
  - i18n
  - next-intl
  - Multilingual
---

## Not every visitor to this blog is Korean

I added an English translation to this blog, but the default language was still hard-locked to Korean.

Anyone visiting from abroad would keep seeing Korean unless they manually rewrote the URL to `/en/`. That's a bad accessibility story.

"It'd be nice if visitors from outside Korea just automatically saw English."

There were two ways to approach this.

1. **IP-based detection** — infer the country from the visitor's IP address
2. **Browser language detection** — read the user's language preferences from the `Accept-Language` header

---

## Why I didn't go with IP-based detection

Determining a country from an IP is more complicated than it sounds.

| Problem | Explanation |
|------|------|
| Requires an external API | IP → country lookup is hard to build yourself; needs a service like MaxMind or ipapi |
| Potential cost | Free tiers usually cap the number of calls |
| VPN bypass | VPN users get flagged as whatever country the VPN exit node is in |
| Accuracy limits | Someone in Korea using an overseas server gets misclassified |
| Latency | An external API call adds overhead to every request |

And the decisive point — someone with a Korean IP might still want English if their browser is set to English. Conversely, a Korean living abroad likely still has their browser set to Korean.

**A user's language setting is more trustworthy than their location.**

---

## What the Accept-Language header is

Browsers automatically attach this header on every request to the server.

```
Accept-Language: ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7
```

- `ko-KR` — 1st priority: Korean (Korea)
- `ko` — 2nd priority: Korean
- `en-US;q=0.8` — 3rd priority: English (US), preference weight 0.8
- `en;q=0.7` — 4th priority: English, preference weight 0.7

An English-language browser sends something like this instead.

```
Accept-Language: en-US,en;q=0.9
```

No external API needed — one header tells you everything about the language environment. No cost, no added latency.

---

## Implementation

This blog runs on Next.js 16 + next-intl. In Next.js 16, `proxy.ts` intercepts server requests instead of `middleware.ts`.

### Step 1 — Write the language detection function

```typescript
const LOCALE_COOKIE = "NEXT_LOCALE";

function detectLocale(request: NextRequest): "en" | "ko" {
  // If the user already has a chosen language in a cookie, prefer that
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (cookie === "en" || cookie === "ko") return cookie;

  // If Accept-Language contains ko or ko-KR, treat it as Korean
  // Every other language (English, Japanese, French...) falls back to English
  const acceptLang = request.headers.get("accept-language") ?? "";
  return /\bko\b/.test(acceptLang) ? "ko" : "en";
}
```

Priority order:
1. **Cookie** — if the user has changed the language before, respect that choice
2. **Accept-Language** — for first-time visitors, decide based on browser language settings

The `\bko\b` regex matches `ko` at a word boundary. `ko-KR` and `ko` match, while other language codes that happen to contain "ko" as a substring get filtered out.

---

### Step 2 — Add redirect logic to proxy.ts

```typescript
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ... admin auth handling ...

  // Only requests without a locale prefix are subject to detection
  // If a locale is already present (/en/posts, /ko/posts), just pass through
  const hasLocalePrefix = /^\/(en|ko)(\/|$)/.test(pathname);

  if (!hasLocalePrefix) {
    const locale = detectLocale(request);
    if (locale === "en") {
      const target = new URL(request.url);
      target.pathname = `/en${pathname}`;
      return NextResponse.redirect(target);
    }
    // for ko, intlMiddleware handles routing to /ko/ automatically
  }

  return intlMiddleware(request);
}
```

The flow:

```
Visit /
├── Has a locale prefix? (/en/, /ko/) → handled by intlMiddleware
└── No prefix → run detectLocale
    ├── Cookie present → redirect based on cookie value
    ├── Accept-Language: ko* → /ko/ (handled by intlMiddleware)
    └── Anything else → redirect to /en/
```

Since Korean is the `defaultLocale`, leaving it to `intlMiddleware` automatically sends it to `/ko/`. Only English needs an explicit redirect.

---

### Step 3 — Save the user's choice to a cookie when they switch language

I added cookie-saving logic to the EN/KO toggle button in the Nav component.

```typescript
const toggleLocale = () => {
  const next = locale === "ko" ? "en" : "ko";
  // Set a cookie that lasts 1 year
  document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; SameSite=Lax`;
  router.replace(cleanPath, { locale: next });
};
```

Now, once a user manually changes the language, that setting persists on their next visit too. Since the cookie takes priority over Accept-Language, the user's choice always wins.

---

## How to test it

You don't need to change your system language. A quick curl check works fine.

```bash
# Simulate an English browser → verify redirect to /en/
curl -I -H "Accept-Language: en-US" http://localhost:3000/
# Should show: Location: http://localhost:3000/en

# Simulate a Korean browser → verify redirect to /ko/
curl -I -H "Accept-Language: ko-KR" http://localhost:3000/
# Should show: Location: http://localhost:3000/ko/

# Simulate a French browser → verify it falls back to English
curl -I -H "Accept-Language: fr-FR" http://localhost:3000/
# Should show: Location: http://localhost:3000/en
```

To test in Chrome DevTools instead:

1. Open DevTools → Network tab
2. Top-right ⋮ menu → **Network conditions**
3. Uncheck "Use browser default" under Accept-Language
4. Enter the value you want and refresh

---

## Summary

| | IP-based | Accept-Language |
|--|---------|-----------------|
| External API | Required | Not needed |
| Extra cost | Possible | None |
| VPN bypass | Vulnerable | Doesn't matter |
| Accuracy | Location-based | Based on user settings |
| Implementation difficulty | High | Low |

Accept-Language is more accurate, simpler to implement, and free. There was no real reason to pick IP-based detection.

```
Final language decision priority:

1. NEXT_LOCALE cookie (if the user explicitly chose one)
2. Accept-Language header (ko/ko-KR → Korean, everything else → English)
3. No further fallback needed (step 2 always resolves it)
```

Once a user changes the language themselves, it's saved to a cookie, so their choice persists across future visits too.
