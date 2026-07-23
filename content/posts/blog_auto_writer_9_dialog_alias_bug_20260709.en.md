---
title: "Automating Blog Publishing (9): <dialog open> Isn't a Modal — And the Deploy URL That Wouldn't Update"
date: '2026-07-09'
publish_date: '2026-08-31'
description: Why a native dialog tag with only the open attribute doesn't become a real modal, and a deployment-alias problem where the same project showed an old screen depending on which URL you visited
tags:
  - React
  - CSS
  - Vercel
  - Troubleshooting
  - Next.js
---

The same day I was cleaning up the incident covered in the last part, I got two UI bug reports on the dashboard screen. One was buttons rendering broken vertically; the other was the draft-view modal showing up oddly at the very bottom of the page. Both turned out to be caused by misunderstanding basic CSS/HTML behavior.

## Buttons stacking vertically, one character at a time

The "Actions" column buttons in the table ("View/Generate Draft," "Publish," Delete) had a symptom where, as the screen narrowed, their text stacked vertically, one character per line. The cause was a missing `white-space: nowrap`.

```css
/* the problematic code */
.actions { display:flex; gap:6px; flex-wrap:wrap; }
```

With a width constraint (`width: 1%`) on the table cell, and no line-wrap prevention on the flex-item buttons, the browser wrapped the button text character by character, squeezing it in as narrow as it could. The fix is simple.

```css
.actions { display:flex; gap:6px; flex-wrap:nowrap; }
.actions button { white-space:nowrap; flex-shrink:0; }
td.col-actions { width:1%; white-space:nowrap; }
.table-wrap { overflow-x:auto; }
```

I gave the buttons themselves `white-space:nowrap`, and added a `.table-wrap` that lets the whole table scroll horizontally instead of buttons getting clipped when the table gets too narrow.

## `<dialog open>` was never a modal

The second one was a more fundamental misunderstanding. Clicking "view draft" ran code like this.

```jsx
{dlgOpen && (
  <dialog open>
    {/* draft content */}
  </dialog>
)}
```

I assumed that just adding the `open` attribute to a `<dialog>` tag would naturally make a modal pop up in the center of the screen with a darkened backdrop. In reality, it doesn't. A `<dialog>` with only the `open` attribute renders as **an ordinary block element sitting in the normal document flow.** Wherever it's placed on the page, it just shows up right there — it never gets promoted to the browser's "top layer," and `::backdrop` never applies. The actual bug — the modal awkwardly stuck at the very bottom of the page — was exactly this symptom.

To actually show it as a real modal, you have to call `showModal()` directly, via JavaScript.

```tsx
const dialogRef = useRef<HTMLDialogElement>(null);

useEffect(() => {
  if (dlgOpen) dialogRef.current?.showModal();
  else dialogRef.current?.close();
}, [dlgOpen]);

// always render it in JSX — leave showing/hiding entirely to showModal()/close()
<dialog ref={dialogRef} onClose={() => setDlgOpen(false)}>
  {/* ... */}
</dialog>
```

One more thing I was careful about here: instead of conditionally mounting/unmounting the `<dialog>`, I made it **always exist in the DOM,** and controlled visibility only through `showModal()`/`close()`. With conditional mounting, `ref` only gets attached the moment `dlgOpen` becomes `true`, which makes calling `showModal()` at that exact first-render timing prone to race conditions. Always mounting it eliminates this problem entirely.

Closing via a click on the backdrop (`::backdrop`) also isn't provided by a native `<dialog>` by default, so I added it myself, by checking whether the click target is the dialog element itself.

```tsx
onClick={(e) => { if (e.target === dialogRef.current) setDlgOpen(false); }}
```

Clicking the dialog's own area (which I set to `padding: 0`) means the click landed on the backdrop margin, not the inner content — this condition is enough to distinguish a backdrop click.

## Why it looked unfixed even after being fixed

After fixing both bugs and deploying, I asked for confirmation and got back "doesn't look like it changed." The cause wasn't the code — it was **the URL.** The Vercel project had multiple alias domains attached to the production deployment, and running `vercel deploy --prod` **only automatically updates one primary alias to point to the latest deployment — the other, previously attached aliases stayed bound to the old deployment.**

```bash
vercel alias ls
# dashboard-xxxx...vercel.app  →  dashboard-hyunseokyu1-netizens-projects.vercel.app  (latest)
# dashboard-yyyy...vercel.app  →  dashboard-delta-one-uv1f81wsqi.vercel.app          (still the old one!)
```

This was the first time I properly understood that the same project can show a different deployment moment depending on the URL visited. The address I'd been asked to check happened to be exactly the alias that didn't auto-follow. Manually reconnecting it fixed it immediately.

```bash
vercel alias set <latest-deploy-URL> dashboard-delta-one-uv1f81wsqi.vercel.app
```

## Summary

| Bug | Visible symptom | Actual cause |
|---|---|---|
| Buttons wrapping vertically | Button text stacks one character at a time as the table narrows | Missing `white-space:nowrap` |
| Modal showing at the bottom of the page | `<dialog open>` rendering as a plain block element | `showModal()` never called |
| "I fixed it but it's not showing" | The URL the user was viewing pointed to a different deployment | A secondary alias didn't auto-update |

All three had a fairly wide gap between "the visible symptom" and "the real cause." The last one especially — the alias problem — is the kind of bug you'll never find no matter how hard you stare at the code; it only got caught once I directly checked the actual deployment state with `vercel alias ls`. This is a lesson that keeps recurring throughout this series, but it was a day that reconfirmed, once again, that "don't guess — check the actual state directly" applies equally to UI bugs and deployment infrastructure alike.
