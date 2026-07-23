---
title: 'Automating Blog Publishing (4): Building a Local Web Dashboard With No Framework'
date: '2026-07-07'
publish_date: '2026-08-15'
description: Building a local dashboard that handles topic registration, draft review, and publishing using nothing but Node.js's built-in http module, and why I chose not to deploy it to the cloud
tags:
  - Node.js
  - Web Dashboard
  - Playwright
  - Vercel
  - Side Project
---

Across the last three parts, I built a pipeline that runs via CLI — topic registration → AI draft generation → Playwright publishing. It was usable enough with just a few commands, but using it for real, the flow of "open the YAML file in the terminal to add a topic, open the draft file to check the content" turned out to be quietly tedious. So as a final step, I bolted on a **local dashboard, manageable entirely with clicks in a browser.**

## Why I built it with no framework

I briefly considered React or Express, but ended up building it with nothing but Node.js's built-in `http` module. The reasons are simple.

- The functionality is just a handful of CRUD operations plus static file serving, so a framework offers almost no benefit.
- No added dependencies, so it runs immediately without even an `npm install`.
- I didn't want to add a build process (bundler, JSX compilation, etc.) to a personal tool.

```typescript
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const { pathname } = url;

  if (pathname === '/api/state' && req.method === 'GET') {
    return send(res, 200, { topics: topicsView(), ... });
  }
  // ...
});
```

The frontend, too, is built with no framework — plain HTML plus vanilla JS inside a `<script>` tag. It's just calling the API with `fetch` and rendering the result with template literals, nowhere near the scale that needs something like React's virtual DOM.

## API design — reusing the existing CLI logic as-is

The key point is that I didn't write new logic for the dashboard. I had the API handlers call the exact same functions the CLI commands (`draft`, `publish`, `list`) were already using.

```typescript
if (pathname === '/api/generate' && req.method === 'POST') {
  const b = await readBody(req);
  const entry = findEntry(String(b.date), String(b.groupPlatform), String(b.topic));
  const draft = await draftOne(entry, b.platform as Platform);
  return send(res, 200, { ok: true, title: draft.meta.title, body: draft.body });
}

if (pathname === '/api/publish' && req.method === 'POST') {
  const b = await readBody(req);
  const entry = findEntry(String(b.date), String(b.groupPlatform), String(b.topic));
  await publishOneTopic(entry, b.platform as Platform);
  return send(res, 200, { ok: true });
}
```

Having the CLI and the web UI share the same pipeline functions (`draftOne`, `publishOneTopic`) this way means the logic never splits into two places and becomes hard to maintain. The dashboard ends up being, essentially, "an already-existing feature with a clickable face attached."

## Opening a draft and editing it right there

The feature I put the most care into in the dashboard is **draft preview doubling as an editor.** If a draft doesn't exist yet, it generates one right there; if it does, it shows it immediately, and lets you edit and save it.

```javascript
async function openDraft(key) {
  const t = JSON.parse(decodeURIComponent(key));
  if (t.hasDraft) {
    const d = await api(`/api/draft?date=${t.date}&platform=${t.platform}&topic=...`);
    $('dlg-body').value = d.body;
  } else {
    $('dlg-body').value = 'AI is writing a draft... (up to 1-2 minutes)';
    draftDlg.showModal();
    const g = await api('/api/generate', { method:'POST', ... });
    $('dlg-body').value = g.body;
  }
  draftDlg.showModal();
}
```

When there's no draft yet, it shows a loading message first, then calls the generation API, and fills in the content once it's done. Explicitly showing that something is in progress, rather than letting the screen look frozen while waiting on the AI response, mattered a lot for usability.

Saving is handled by the server-side `saveDraftBody` function.

```typescript
export function saveDraftBody(date: string, platform: Platform, topic: string, body: string): Draft {
  const filePath = draftFilePath(date, platform, topic);
  const existing = findDraft(date, platform, topic);
  fs.writeFileSync(filePath, matter.stringify(body.trim(), existing.meta));
  return { meta: existing.meta, body: body.trim(), filePath };
}
```

The structure keeps the frontmatter (title, tags) untouched while swapping out just the body. Edits made in the dashboard get written straight to the file in the `drafts/` folder, so when the scheduler auto-publishes later, it's the edited version that goes out.

## What I was careful about building the state view

When rendering the topic list, a topic registered as `platform: both` needs to be shown on screen split into a Tistory row and a Naver row, so publish status can be tracked for each separately. This gets pre-expanded on the server side.

```typescript
function topicsView() {
  return loadTopics().flatMap((t) => {
    const platforms: Platform[] = t.platform === 'both' ? ['tistory', 'naver'] : [t.platform];
    return platforms.map((platform) => ({
      date: t.date,
      platform,
      groupPlatform: t.platform, // the key used to find the original entry again
      hasDraft: !!findDraft(t.date, platform, t.topic),
      enabled: platform === 'tistory' ? accounts.tistory.enabled : accounts.naver.enabled,
    }));
  });
}
```

There's a reason `groupPlatform` is kept around separately. The screen shows it expanded into `tistory` / `naver`, but actually deleting a topic or updating its status requires finding the original YAML entry again (the one entry registered as `both`). This clearly distinguishes between what's displayed expanded and what the actual data-manipulation target is.

I also sent the `enabled` flag down along with it, so that if Naver is disabled, the publish button gets automatically disabled (`disabled`). Rather than attempting to publish to a disabled platform and hitting some vague error, making the button simply not respond to a click in the first place is far clearer from the user's perspective.

## Why it shouldn't be deployed to Vercel

Once the dashboard was built, the natural next thought was "wouldn't putting this on Vercel let me use it from my phone too?" Short answer: **cloud deployment is impossible with this architecture.**

The reason is clear. The publish step isn't an API call — it's **manipulating an actual browser using a login session stored locally.**

- A serverless environment resets its execution context on every request, so a login cookie like `profiles/tistory-state.json` can't be persisted continuously.
- Putting Kakao/Naver login sessions on an external server is itself undesirable from a security standpoint.
- Automation that manipulates a real account via a headless browser also doesn't sit well with serverless's short execution-time constraints.

If I really wanted to use this remotely, the only realistic approach would be a hybrid structure — put "topic management, draft generation" in the cloud, and have only "actual publishing" handled by a worker on the home computer. But I judged this to be over-engineered for a personal tool, and concluded the local dashboard is sufficient for now. If I want to reach it from my phone on the same Wi-Fi, opening `http://<Mac's IP>:4700` does the job.

## Summary — the overall picture across these 4 parts

Summarized in one line, what got built across this series:

```
Register topics (YAML/dashboard)
   → generate a draft via the Claude API/CLI (style guide + prompt caching)
      → publish via Playwright, reusing the login session (storageState + precise selectors)
         → manage the entire process with clicks, via the local dashboard
```

Technically, none of this was difficult. Calling the Claude API, manipulating a browser with Playwright, Node's built-in http server — all familiar tools. But I spent a lot of time on details that documentation rarely covers, like **the different kinds of login cookies (session vs. persistent)** and **the actual structure of the editor's DOM.** Building browser automation reminded me, once again, that not trusting "this should work in theory" and instead actually dumping the real DOM is, in the end, the fastest path forward.
