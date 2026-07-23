---
title: "Automating Blog Publishing (6): Why Only the Title Went Up and the Body Vanished — The Trap CodeMirror Was Hiding"
date: '2026-07-07'
publish_date: '2026-08-17'
description: Tracing and fixing a bug where the publish log looked fine and the RSS title looked fine, but the actual post body kept coming out empty — viewed through the lens of CodeMirror and React state synchronization
tags:
  - Playwright
  - CodeMirror
  - React
  - Troubleshooting
  - Tistory
---

In Part 3, I wrote that I'd solved "body input failing." I fixed the unclickable-element problem with a selector, injected the value directly with `CodeMirror.setValue()`, and got publishing working. The problem is that both then and now, there was exactly one verification method — I only checked **whether the title showed up in the RSS feed.** I had never properly confirmed the body content, not once.

## The user sent me a single screenshot

A few days after clicking the publish button through the cloud dashboard, a message came in — "only the blog title went up on Tistory" — along with a screenshot. The title and tags had gone up cleanly, but the space where the body should be was completely empty.

The first thing I suspected was the draft data itself. I pulled the draft stored in Redis directly.

```typescript
const draft = await redis.get('blog-auto-writer:draft:2026-07-07_tistory_장마철-음식관리');
console.log(draft.title, draft.body.length);
// "Managing food during monsoon season, why you can't just trust the fridge" 1621
```

The body was 1621 characters, and the content looked fine. The data was fine — the problem was **at the point where the publish script pushes that data into Tistory.**

## The suspect: the code from Part 3 I'd believed was "solved"

```typescript
await page.waitForSelector('.CodeMirror.cm-s-tistory-markdown', { timeout: 15000 });
await page.evaluate((text) => {
  const cmEl = document.querySelector('.CodeMirror.cm-s-tistory-markdown') as any;
  cmEl.CodeMirror.setValue(text);
}, draft.body);
```

This code definitely fills text into the CodeMirror editor **as displayed on screen.** Run it non-headless while watching, and the body visibly fills in. But when you click publish, the value that made it to the server was empty. What's visible on screen differing from what actually gets submitted was the crux of this bug.

## The cause: setValue only tells CodeMirror — React never finds out

Tistory's editor is implemented as a wrapper component called `ReactCodemirror`, wrapping CodeMirror. A wrapper like this typically behaves like this.

```jsx
// A typical structure for a React wrapper component (a conceptual example)
function ReactCodemirror({ onChange }) {
  useEffect(() => {
    const cm = CodeMirror(el, options);
    cm.on('change', () => onChange(cm.getValue())); // only reacts to user-input events
  }, []);
}
```

`cm.on('change', ...)` only fires through CodeMirror's internal **input-event pipeline.** But `CodeMirror.setValue()` is a low-level API that bypasses this pipeline and swaps the document content directly. The screen (CodeMirror's own rendering) changes, but the `change` event might not fire in exactly the same way it would when a user types, and the chain from React's `onChange` → parent state → the value actually sent to the server at publish time gets severed. The end result: a situation where it's visible on screen, but the "real" body state React is holding onto stays an empty string.

In Part 3, this code did genuinely solve the selector problem (grabbing the wrong, hidden HTML editor). But because the verification for that was only "does publishing finish with no error, and does the title show up in RSS," a far quieter failure — the body not making it in — went unnoticed for weeks.

## The fix: injecting via real input events

The solution was to input via **the same path a human typing would use,** rather than bypassing the CodeMirror API. Playwright's `keyboard.insertText` fires actual input events.

```typescript
const cmScroll = page.locator('.CodeMirror.cm-s-tistory-markdown .CodeMirror-scroll').first();
await cmScroll.click();                      // real focus
await page.keyboard.press('ControlOrMeta+a'); // select all existing content
await page.keyboard.press('Delete');
await page.keyboard.insertText(draft.body);   // inject via real input events
```

I also added one more thing — a verification step that **directly checks, in code, whether the injected value actually made it into the CodeMirror document.**

```typescript
const injectedLen = await page.evaluate(() => {
  const cmEl = document.querySelector('.CodeMirror.cm-s-tistory-markdown') as any;
  return cmEl?.CodeMirror?.getValue()?.length ?? -1;
});
if (injectedLen <= 0) {
  throw new Error('Failed to inject the Tistory body content (CodeMirror is empty).');
}
```

Without this verification, the next time the editor's structure changed again, I could easily have ended up in the exact same "publish succeeded, body is missing" situation, only finding out weeks later via a screenshot. Now, if the body comes out empty, it throws an error right there and stops.

## How I verified it after the fix

This time I didn't just look at the RSS title. After an actual publish, I parsed RSS's `description` field to check **the body text's length and content** too.

```bash
curl -s "https://my-blog.tistory.com/rss" | python3 -c "
import sys, re, html
data = sys.stdin.read()
desc = re.search(r'<description>(.*?)</description>', data, re.S).group(1)
text = re.sub(r'<[^>]+>', '', html.unescape(desc))
print('Body length:', len(text.strip()))
print('Body preview:', text.strip()[:100])
"
```

```
Body length: 1537
Body preview: Last monsoon season, I once ate side dishes I'd stored in the fridge without much thought, and paid for it with an awful day...
```

This time, I confirmed not just the title, but the body content actually going up.

## Summary — a "success log" and "actually succeeding" are different things

| What was checked | What it actually guarantees |
|---|---|
| The publish function returns with no error | Only that navigation to the page succeeded |
| The title shows up in RSS | Only that the post was registered in the list |
| The body length in RSS's `description` | **Whether the content a user would actually see made it in** |

What made this particular bug sting was not knowing, for weeks, that the code I'd written up as "solved" in Part 3 had actually only solved half the problem. In browser automation, "pushing" a value in via a low-level API can look convincing on screen, but whether that value actually reaches the application's real state (React state, in this case) is a completely separate question. From here on, I changed the success criterion for publish automation from "no error" to "does the injected value match what actually got reflected."

## The full picture, across six parts

```
Register a topic (local YAML or the cloud dashboard)
   → generate a draft via the Claude API (style guide + prompt caching)
      → record a publish request in Redis (if clicked from the cloud)
         → the local worker detects it → publishes via Playwright, reusing the login session
            → verify the input value was actually reflected before finishing
```

Looking back at the problems hit across these six parts, they were all the same pattern. **The next bug was always hiding at the exact spot I'd waved off as "good enough."** I thought the session was saved, but it was a session cookie; I thought I'd fixed the selector, but the value-injection method was the actual problem; I thought I'd attached storage, but the consistency model didn't fit. In the end, I relearned that for this kind of automation, everything comes down to how tightly you verify the gap between "looks like it's working" and "actually works, all the way through."
