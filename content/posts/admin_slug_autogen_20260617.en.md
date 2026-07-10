---
title: "Auto-Generating Slugs in the Admin Editor — DeepL + camelCase + Date"
date: '2026-06-17'
publish_date: '2026-06-20'
description: How I improved slug auto-generation from Korean titles by adding English translation, camelCase conversion, and a date suffix
tags:
  - NextJS
  - Admin
  - UX
  - DeepL
---

Typing a slug by hand every time I wrote a new post in the blog admin got old fast.

The title already auto-generated a slug, but the result looked like `나의-첫-번째-글` (the Korean title, slugified as-is). Having Korean characters in the URL isn't technically broken, but an English slug is cleaner and easier to share. And having the date baked in makes managing posts a lot easier.

---

## The problem with the old approach

The old code was dead simple: lowercase the Korean title, strip special characters, replace spaces with `-`.

```typescript
const generated = ko.title
  .toLowerCase()
  .replace(/[^a-z0-9가-힣\s-]/g, "")
  .replace(/\s+/g, "-")
  .slice(0, 60);
```

Result: `나의-첫-번째-글`

Two things bothered me about this.

1. **Korean characters pass through untouched** — a slug like `나의-첫-번째-글` gets URL-encoded into something like `%EB%82%98%EC%9D%98-...`
2. **No date** — posts on similar topics can collide on slug, and you can't tell from the filename alone when something was written

---

## What I wanted instead

The target output: `youAndMe_20260617`

Three changes:

- Korean title → translated to English via DeepL
- English words → joined into camelCase
- Date (`YYYYMMDD`) → appended as an underscore suffix

---

## Implementation

The admin already had a DeepL translation API (`/api/admin/translate`), originally built for translating post bodies. I just reused it.

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
        // Fall back to Korean if DeepL fails
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

Three parts do the heavy lifting.

**1. Debounce (800ms)**
Calling the API on every keystroke would be wasteful. It fires once, 800ms after typing stops. Standard `useEffect` cleanup pattern — `clearTimeout` cancels the previous timer.

**2. camelCase conversion**
`"you and me"` → `["you", "and", "me"]` → keep the first word as-is, capitalize the first letter of the rest → `"youAndMe"`.

**3. Date wiring**
When the `date` field changes, the slug's date suffix updates automatically too. The translated base is cached in `slugBaseRef` and reused.

```typescript
// Update the slug's date suffix whenever the date field changes
useEffect(() => {
  if (!isEdit && !slugManual && slugBaseRef.current) {
    setSlug(`${slugBaseRef.current}_${date.replace(/-/g, "")}`);
  }
}, [date, isEdit, slugManual]);
```

---

## Results

| Korean title | Old slug | New slug |
|---|---|---|
| 너와 나의 이야기 | `너와-나의-이야기` | `youAndMyStory_20260617` |
| 클로드 코드 사용법 | `클로드-코드-사용법` | `howToUseClaudeCode_20260617` |
| Next.js 배포 삽질 | `nextjs-배포-삽질` | `nextjsDeploymentStruggles_20260617` |

DeepL's translation quality turned out to be good enough to produce usable slugs directly. It occasionally tacks on an article (a, the, an) or an extra word that I'd rather not have, but it's still much faster than typing one by hand.

---

## One thing to watch out for

Changing the slug of an already-published post breaks its URL and returns a 404. The slug field is disabled in edit mode (`isEdit = true`) to prevent accidental changes, but posts already published with Korean slugs stay as they are.

---

*Waiting one second after you stop typing for the slug to finish generating turns out to feel a lot more comfortable than expected.*
