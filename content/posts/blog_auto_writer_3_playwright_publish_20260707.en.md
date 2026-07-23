---
title: "Automating Blog Publishing (3): Auto-Publishing to Tistory With Playwright — A Story of Failing Three Times"
date: '2026-07-07'
publish_date: '2026-08-14'
description: A record of actually fixing a Tistory login session that kept disappearing, and a publish failure caused by grabbing the wrong markdown editor selector
tags:
  - Playwright
  - Browser Automation
  - Node.js
  - Troubleshooting
  - Tistory
---

The previous two parts covered topic registration and AI draft generation. In theory, this should now be a simple job — open a browser, paste in the content, and click publish. In reality, **I failed three times: twice on saving the login session, once on editor manipulation.** This part is closer to a troubleshooting log, recording those failures and how I fixed them, as they actually happened.

## Why Playwright

Both Tistory's Open API and Naver Blog's posting API have been discontinued. So publishing had no choice but to automate exactly what a human does in a browser — **log in → open the editor → enter content → click publish.** The reasons I picked Playwright are simple.

- It has auto-wait, automatically waiting for elements to load, which makes it reliable.
- Specifying a profile directory via `launchPersistentContext` lets you reuse a login session (at least in theory).

## Attempt 1: I assumed just closing the window would save the session

My first pass at login automation looked like this.

```typescript
export async function interactiveLogin(platform: Platform): Promise<void> {
  const context = await openContext(platform, false);
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(LOGIN_URLS[platform]);
  console.log('Close the browser window once you finish logging in.');
  await new Promise<void>((resolve) => context.on('close', () => resolve()));
}
```

The structure: launch the browser, let the user log in, and the process ends once the window is closed. Since it uses `launchPersistentContext`, I assumed cookies would naturally get saved to the profile directory.

After logging in and closing the window, I checked whether the session was valid in headless mode.

```
SESSION_INVALID: https://www.tistory.com/auth/login?redirectUrl=...
```

The session was gone. Tracing the cause, the problem was that I'd force-killed the process with `kill` during the login-verification procedure. **A force-kill lets the browser die before cookies get fully flushed to disk.** This is where I learned it needed to go through a proper shutdown path.

## Attempt 2: fixed it to detect login and shut down properly — still didn't work

So I changed it to automatically detect when login completed and shut down cleanly with `context.close()`.

```typescript
const poll = setInterval(async () => {
  const cookies = await context.cookies();
  if (cookies.some((c) => c.name === 'TSSESSION')) {
    clearInterval(poll);
    await context.close(); // clean shutdown
  }
}, 3000);
```

Once the `TSSESSION` cookie appeared, I treated login as complete and closed the context properly. I assumed this would work since it wasn't a force-kill this time, but checking again in headless mode, it still redirected to the login page.

There was something I learned here. **Tistory's (and Kakao's) login cookie is a session cookie.** A session cookie is designed to expire once the browser fully terminates, regardless of whether that termination was clean or not. `launchPersistentContext`'s profile directory reliably preserves only persistent cookies — session cookies vanishing whenever the browser closes and reopens was, in fact, the correct, expected behavior.

## The fix: explicitly saving cookies via storageState

Playwright has an API called `context.storageState()`. It snapshots the current context's cookies and local storage entirely into a JSON file. Using this, whether it's a session cookie or a persistent one, the state at that exact moment can be saved as-is.

```typescript
// save via storageState at the moment login is detected
if (cookies.some((c) => c.name === cookieName)) {
  await context.storageState({ path: stateFilePath(platform) });
  await context.close();
}
```

And the next time the browser opens, the saved cookies get explicitly injected.

```typescript
export async function openContext(platform: Platform, headless: boolean) {
  const context = await chromium.launchPersistentContext(profileDir, { headless, ... });

  const stateFile = stateFilePath(platform);
  if (fs.existsSync(stateFile)) {
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    if (state.cookies?.length) {
      await context.addCookies(state.cookies);
    }
  }
  return context;
}
```

Only after this change did `SESSION_OK` finally show up in headless mode too. I also attached `saveState()` to the end of the publish function so the session gets refreshed and re-saved after every publish, keeping it alive even over a long period.

> **Lesson**: when building login automation, don't assume "browser profile = session persistence." Behavior differs depending on whether it's a session cookie or a persistent one, and to be sure, explicitly snapshotting via `storageState` is the safe approach.

## Attempt 3: pasting into the editor doesn't work

Once the session problem was solved, the next gate was **entering the body content.** I initially used the approach of copying text to the clipboard and pasting with `Cmd+V`.

```typescript
const editor = page.locator('.CodeMirror textarea, .cm-content').first();
await editor.click();
await page.evaluate(async (text) => {
  await navigator.clipboard.writeText(text);
}, draft.body);
await page.keyboard.press('Meta+V');
```

Running it threw this error.

```
locator.click: Timeout 30000ms exceeded.
- element is not visible
```

Tistory's markdown editor is built on CodeMirror, and checking further, the page actually contained **two CodeMirror instances.** One for HTML mode (`cm-s-tistory-html`), one for markdown mode (`cm-s-tistory-markdown`). My selector, `.CodeMirror textarea`, couldn't distinguish between the two and was grabbing the first one (the hidden HTML mode) and trying to click it.

Only after actually dumping the real DOM via script did I confirm the cause.

```typescript
const info = await page.evaluate(() => {
  const cms = Array.from(document.querySelectorAll('.CodeMirror'));
  return cms.map((el) => ({
    className: el.className,
    visible: (el as HTMLElement).getBoundingClientRect().width > 0,
  }));
});
// → [{className: "... tistory-html", visible: false}, {className: "... tistory-markdown", visible: true}]
```

The fix applied two things together. First, precisely targeting the selector as `.CodeMirror.cm-s-tistory-markdown`. Second, instead of clipboard pasting, switching to **calling `setValue()` directly on the CodeMirror instance.**

```typescript
await page.waitForSelector('.CodeMirror.cm-s-tistory-markdown', { timeout: 15000 });
await page.evaluate((text) => {
  const cmEl = document.querySelector('.CodeMirror.cm-s-tistory-markdown') as any;
  cmEl.CodeMirror.setValue(text);
}, draft.body);
```

The clipboard approach only works if it can click a visible element, and combined with the hidden-element issue, that adds one more point of failure. Calling the CodeMirror API directly lets you set the value regardless of whether the element is visible on screen, making it far more robust.

## The confirm dialog that pops up when switching to markdown mode

One more thing. Switching Tistory's editor to markdown mode triggers a "Change writing mode?" confirmation dialog. This needs to be handled in Playwright via `page.on('dialog', ...)`, and the order mattered.

```typescript
await page.click('#editor-mode-layer-btn-open');
page.on('dialog', (dialog) => dialog.accept().catch(() => {})); // register before the click
await page.click('#editor-mode-markdown');
```

The dialog handler has to be registered **before** the click. Register it after clicking, and the dialog is already showing by the time the handler is attached, so it easily fails to catch up and times out.

## The final result

After fixing all three of these, actually running publishing completed successfully.

```
▶ 2026-07-06 / tistory / "Auto-publishing blog posts with Playwright..."
  [tistory] Published: https://my-blog.tistory.com/manage/posts/
```

Rather than the blog's management page, I confirmed the publish actually went through via the **RSS feed.**

```bash
curl -s "https://my-blog.tistory.com/rss" | grep -o "<title>[^<]*</title>"
```

Only once I saw the title of the just-published post sitting right at the top of the RSS feed could I actually relax. (The management page's DOM structure is different yet again, so for a verification script, RSS turned out to be the more reliable route.)

## Summary — lessons from browser automation

Summarized in one line each, the three failures from this part:

| Problem | Cause | Fix |
|---|---|---|
| Login session not saving (1st) | Cookie flush failed due to force-killing the process | Use a clean shutdown path |
| Login session not saving (2nd) | The login cookie is a session cookie, so a profile alone doesn't retain it | Explicit save/inject via `storageState` |
| Body input failing | Two CodeMirror instances existed, and it tried clicking the hidden one | The correct selector + calling `setValue()` directly |

Browser automation frequently has "what should work in theory" clash with "the specific reality of a real website's DOM." Rather than fixing things by staring at error messages alone, dumping the actual DOM structure directly via `page.evaluate()` was far faster.

Next up: the **local web dashboard** I built because registering topics and reviewing drafts via CLI commands alone got tedious.
