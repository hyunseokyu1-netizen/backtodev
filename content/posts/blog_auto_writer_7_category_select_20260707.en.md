---
title: 'Automating Blog Publishing (7): Assigning a Category to Auto-Published Posts'
date: '2026-07-07'
publish_date: '2026-08-18'
description: How I dug into the actual structure of Tistory's category-selection dropdown and attached auto-selection logic, to fix posts that kept going up with no category assigned
tags:
  - Playwright
  - Tistory
  - Browser Automation
  - Troubleshooting
---

Across the six parts so far, I'd gotten publishing itself working well — but every single post that went up had no category assigned. Once I registered 30 topics at once, this problem became impossible to ignore. I decided to make every publish auto-classify into a specific category (this time, "Life Tips").

## The config field already existed

Looking at the account config type, the `category` field had existed from the start.

```typescript
export interface PlatformConfig {
  enabled: boolean;
  category?: string;
}
```

`config/accounts.json` already had a spot for it too — `"category": ""` — but nowhere in the publish script (`tistory.ts`) was there any code that actually used this value. It was a field that existed in name only, with nobody reading it.

## Checking the actual structure of the category dropdown

I first had to check how category selection works on Tistory's post-writing screen. Following Part 3's lesson again, instead of guessing, I dumped the actual DOM.

```typescript
const info = await page.evaluate(() => {
  const candidates = Array.from(
    document.querySelectorAll('[id*="categor" i], [class*="categor" i]'),
  );
  return candidates.map((el) => ({ tag: el.tagName, id: el.id, text: el.textContent?.slice(0, 60) }));
});
```

The result turned up a single button, `#category-btn`. Clicking this button expanded a category list into `<div>` elements with the class `.mce-menu-item`.

```json
{ "id": "category-item-957160", "text": "Tyson's Trivia" }
{ "id": "category-item-1543532", "text": "- Life Tips" }
```

There was something unusual here. **Sub-categories are displayed with "- " prepended to the name.** "Life Tips" was a sub-category nested under a parent category called "Tyson's Trivia," and it appeared in the list as the text "- Life Tips." Comparing the config value (`"Life Tips"`) directly against the actual DOM text (`"- Life Tips"`) would fail to match.

## Matching logic: strip the prefix, then compare

Instead of clicking a category by a hardcoded ID, I built it as **finding a match by comparing the name written in config against the list's displayed text.** Pinning to an ID would mean it breaks again every time categories get reorganized on Tistory (moving a sub-category, creating a new one), since the ID would change.

```typescript
if (config.category) {
  await page.click('#category-btn');
  await page.waitForSelector('.mce-menu-item:visible', { timeout: 5000 });
  const items = page.locator('.mce-menu-item:visible');
  const count = await items.count();
  let matched = false;
  for (let i = 0; i < count; i++) {
    const text = (await items.nth(i).textContent())?.trim().replace(/^-\s*/, '');
    if (text === config.category) {
      await items.nth(i).click();
      matched = true;
      break;
    }
  }
  if (!matched) {
    console.warn(`  [tistory] Category "${config.category}" not found, skipping.`);
    await page.keyboard.press('Escape').catch(() => {});
  }
}
```

Stripping the sub-category prefix with `.replace(/^-\s*/, '')` before comparing means the config file only ever needs the category name a user actually sees ("Life Tips"). Users never need to know the parent/child distinction syntax.

Filtering to `.mce-menu-item:visible` — **only items visible on screen** — was also deliberate. The same class (`mce-menu-item`) is shared by the markdown/HTML editor mode-switch menu too, so items from that other, invisible dropdown could otherwise leak in.

## One more thing: not finding a category shouldn't block publishing

If a category name changes later or has a typo, matching can fail. Rather than stopping publishing itself in that case, I made it log just a warning and continue without a category.

```typescript
if (!matched) {
  console.warn(`  [tistory] Category "${config.category}" not found, skipping.`);
  await page.keyboard.press('Escape').catch(() => {});
}
```

Having just been through Part 6's silent failure of "the body is empty but the publish log still shows success," this time I decided the opposite way — **a secondary feature (category) failing must not block the core feature (publishing).** I didn't lump these two features, whose failures carry very different weight, into the same exception handling.

## Verification: testing category selection alone, before publishing

This time, before actually publishing a post, I pulled out just the category-selection logic and verified it separately. I opened the write page with a logged-in session, selected a category, and checked only whether the button's text changed.

```typescript
console.log('Match succeeded:', matched);        // true
console.log('Final category button text:', btnText); // "Life Tips, and more"
```

Only after confirming the button text changed from "Select Category" to "Life Tips, and more" did I fold this into the actual publish code. This is a habit I picked up after Part 6 — **verifying, separately, that a value is reflected on screen versus that a selection is actually applied** is now something I do by default.

## Summary

| Item | Detail |
|---|---|
| Config | `config/accounts.json` → `tistory.category: "Life Tips"` |
| Matching approach | Compare against displayed text instead of hardcoding an ID (strip the sub-category `- ` prefix) |
| Failure handling | Publishing continues even if the category isn't found (only a warning is logged) |
| Scope | Both local publishing (`npm run publish`) and the cloud worker (`npm run worker`) share the same config |

This one was much lighter than the problems across the previous six parts, but the approach was identical. Instead of guessing, dump the actual DOM with `page.evaluate()`, directly confirm in code that the value is reflected on screen, and only then fold it into the publish pipeline. Now, the month's worth of life-tips topics registered earlier automatically get sorted into the "Life Tips" category every time they publish.
