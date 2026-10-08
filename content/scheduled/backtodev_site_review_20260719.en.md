---
title: 'From Portfolio to Guestbook — A Full Audit of My DB-less Next.js Blog'
date: '2026-07-19'
publish_date: '2026-12-24'
description: A full review of my portfolio and blog, which had grown heavy as projects piled up — covering performance, SEO, accessibility, scheduled publishing, and the GitHub-based guestbook
tags:
  - Next.js
  - Portfolio
  - Performance Optimization
  - SEO
  - GitHub Actions
  - Accessibility
---

## The Site Ran Fine, But It Wasn't Great at Showing Off My Portfolio

This blog runs without a separate DB.

- Posts are Markdown files in `content/posts/`
- Scheduled posts go into `content/scheduled/` and get published by GitHub Actions
- The guestbook is stored in `content/guestbook.json`
- Deployment is Vercel, hooked up to the GitHub `main` branch

It started out as a simple dev blog, but as projects piled up one by one it also started doubling as a portfolio. As I kept adding things like RepoNote, Matchda, the blog auto-writer, and the pixel village, the portfolio page kept getting longer.

Showing every description and screenshot was thorough, and I liked that. But for a recruiter or a first-time visitor, it was **hard to tell which project was the flagship one**, and the first screen was loading way more images than it needed to.

So I opened the site intending to just lightly fix the portfolio — and ended up auditing the entire blog.

Here are the numbers that stood out before the audit.

| Item | Before |
|---|---:|
| Portfolio initial HTML | ~272KB |
| Portfolio image tags | ~50 |
| Home initial JavaScript | ~1.245MB |
| Post list response | ~1.2–2.4s |
| npm audit | vulnerabilities present |
| ESLint | errors and warnings present |

These numbers were measured on a local production build. They may differ from actual Vercel response times, but they were good enough as a baseline for comparing before and after.

---

## Step 1 — Separating Flagship Projects From the Rest

The old portfolio listed every project at roughly the same visual weight. That was fine when there were few projects, but as the count grew, the important work got buried further down the page.

First, I promoted three projects to flagship status.

1. RepoNote
2. Blog Auto-Publisher SaaS
3. Matchda

Flagship projects keep the long description and image gallery as before, while the rest get trimmed down to cards showing just a title, one-line intro, status, tech stack, and links.

```text
Portfolio
  ├─ 3 flagship projects
  │    └─ full description + tech stack + images
  └─ 12 other things I've built
       └─ summary cards
```

I added real width and height to the images, and specified `sizes` matched to screen size. I also removed priority preloading for images not strictly needed on the first screen.

The results of the first round of changes were clear.

| Item | Before | After round 1 |
|---|---:|---:|
| Initial HTML | ~272KB | ~189KB |
| Image tags | ~50 | 13 |
| Image preloads | 7 | 0 |

### But Hiding Content Entirely Wasn't Great Either

The page got lighter, but it created a new problem. The descriptions and screenshot data for the other projects still lived in the code, but users had no way to see them anymore.

A portfolio needs to be skimmable, but for someone who gets interested, it also needs to be able to **show why something was built and how it was implemented.** I didn't need to give up either one.

So I added a "View details · N photos" button to each summary card.

Clicking the button opens a detail modal for that one project.

- The full original description
- The full tech stack
- GitHub and live service links
- The hero image
- A screenshot gallery

The important part is **not rendering every detail image up front.** Only the modal for the selected project gets rendered, so the initial image tag count stays at 13. The final initial HTML measured about 167KB.

I also added accessibility handling to the modal.

- Close with ESC
- Supports clicking the backdrop and a close button
- Tab focus can't escape outside the modal
- Focus returns to the original "View details" button after closing
- Internal scroll on mobile that fits the screen height
- Clicking a detail image opens the existing lightbox to zoom in

The conclusion from the portfolio work was simple.

> Show a summary first, and only open the details once someone's actually interested.

Deleting information and simply not showing it upfront turned out to be completely different designs.

---

## Step 2 — Stopped Reading Public Posts From GitHub on Every Request

Because this blog has no DB, it relies heavily on the GitHub API. Committing to GitHub when saving a post or uploading an image from the admin panel makes sense.

The problem was that **even when a visitor opened the post list**, it was calling the GitHub GraphQL API.

```text
Visitor request
  → Vercel server function
  → GitHub GraphQL API
  → receive Markdown list
  → parse and respond with HTML
```

On top of that, it was `no-store`, so it re-fetched on every single request. If GitHub got slow for a moment or hit a rate limit, the public blog slowed down right along with it.

Thinking about it, a published post is already sitting in the repo's `content/posts/`. If Vercel includes those files in the deployment bundle when it builds the app, the public pages can just read straight from the filesystem.

```text
Before: visitor → Vercel → GitHub API → post list
After:  visitor → Vercel's build content → post list
```

Admin saves still use the GitHub API; only the public reads were split off to use local content.

This change took the post list response, measured on a warm local production request, from roughly 1.2–2.4s down to 0.03s. The file-tracing warnings that used to show up at build time also disappeared along with it.

What I learned here is that **not having a DB is not the same thing as having to call the GitHub API on every request.**

- Writes: commit via the GitHub API
- Reading published content: files included in the build
- Only query the API for parts that genuinely need live data

Splitting the nature of reads from writes made the structure far simpler.

---

## Step 3 — Stopped Auto-Opening Three.js on the Home Page

The blog has an RPG-style pixel village — a page where you walk a character around town finding posts and projects, and plant a tree in the guestbook at a hidden spot.

The problem was that this village auto-launched as a full-screen overlay the moment you landed on the home page.

It was fun, but not every visitor comes to play a game. For someone who just wants to read a post or check a portfolio link, I was shipping Three.js plus world data plus guestbook data to them from the very start.

So I reordered the home page's priorities.

```text
Primary CTA    → Portfolio
Secondary CTA  → Post list
Separate link  → Enter the pixel village
```

I didn't remove the pixel village — I turned it into **an experience you opt into.**

| Item | Before | After |
|---|---:|---:|
| Home initial JavaScript | ~1.245MB | ~685KB |
| Home HTML | ~106KB | ~76KB |

The more fun a feature is, the more tempting it is to shove it onto the first screen unconditionally. But it didn't need to auto-run at the cost of blocking the core user flow.

---

## Step 4 — SEO Needed to Be About the Whole URL, Not Just a Few Meta Tags

Looking the pages over, I found that sub-pages were partially inheriting the Open Graph info from the root. Sharing a portfolio link could show a title or URL based on the home page instead.

I consolidated the SEO-related changes into a shared metadata helper.

- canonical per locale
- Korean/English hreflang
- Open Graph title, description, URL
- Twitter card
- 1200×630 share image
- Alternate-language URLs in the sitemap

I also added the portfolio, pixel village, and app privacy policy pages that had been missing from the sitemap. Admin and API routes are blocked in robots, and the admin screens get `noindex`.

Requests coming in through `www.backtodev.com` now get a 308 redirect to the root domain, cleaning up duplicate URLs too.

```text
www.backtodev.com/ko/portfolio
  → 308
backtodev.com/ko/portfolio
```

I also cleaned up leftover hardcoded English text in the multilingual screens. Navigation, search, Topics, empty results, and dates now display per locale, and the reading time — which used to always show up as 1 minute — now gets calculated from the actual body length.

---

## Step 5 — Made the Site Usable Entirely by Keyboard

I never noticed this when using the mouse, but tabbing through the site revealed a lot of gaps.

- Screen readers had no way to know whether the mobile menu was open
- No current-page link info
- Focus disappeared after closing the lightbox
- ESC handling and focus locking were insufficient
- Reduced-motion settings were ignored

I added the following.

```text
Skip-to-content link
Global focus-visible styling
aria-current / aria-expanded / aria-controls
Lightbox dialog + focus trap + ESC
Focus returns to the trigger after closing
prefers-reduced-motion support
```

I also changed plain `<a>` links inside the admin screens to Next.js `Link`, and cleaned up code that was unnecessarily updating synchronous state inside an effect. As a result, all the remaining ESLint errors and warnings went away.

---

## Step 6 — Added Baseline Security Headers

Security headers are applied to every path through `headers()` in `next.config.ts`.

| Header | Purpose |
|---|---|
| `Strict-Transport-Security` | Force HTTPS usage |
| `X-Content-Type-Options: nosniff` | Prevent MIME type sniffing |
| `X-Frame-Options: SAMEORIGIN` | Restrict embedding in external iframes |
| `Referrer-Policy` | Limit referrer info sent to external sites |
| `Permissions-Policy` | Disable camera, microphone, and location permissions |

I also removed Next.js's `X-Powered-By` response header.

I didn't add a Content Security Policy this time. The blog uses Google AdSense, and without carefully inventorying the script, frame, and connect domains first, forcing a CSP right away could break ads or analytics.

If I apply one later, I plan to start with `Content-Security-Policy-Report-Only` to collect violation reports before blocking anything.

---

## Step 7 — Scheduled Publishing Cared More About Not Mispublishing Than About Succeeding

Once a scheduled post's `publish_date` arrives, GitHub Actions moves the file.

```text
content/scheduled/
  → publish_date reached
content/posts/
  → Git commit & push
  → Vercel deploy
```

The existing workflow worked for the basic case, but there were a few things that could become problems in production.

- A scheduled run and a manual run could overlap
- An invalid date could cause the numeric comparison to fail
- A file with the same name already in posts could get overwritten
- Someone could manually run it on a branch other than main
- A push could conflict if main changed mid-run

So I added the following safeguards.

1. Serialize publishing jobs with a concurrency group
2. Only run on the main branch
3. 10-minute timeout
4. Validate the date as `YYYY-MM-DD`
5. Abort the move if a published file with the same name already exists
6. `git pull --ff-only` before starting work
7. Rebase after committing and push explicitly to `HEAD:main`
8. Standardize the commit author as `github-actions[bot]`

Automation needs to think about failure paths before success paths. Publishing a post a day late can just be re-run, but overwriting an existing post is far more expensive to recover from.

---

## Step 8 — Concurrent Writes to the GitHub JSON Guestbook

The pixel village's guestbook uses `content/guestbook.json` instead of a DB. When a visitor plants a tree, the API reads the JSON, appends an entry, and commits it via the GitHub Contents API.

```text
Read guestbook (SHA: A)
  → add new tree
  → PUT based on SHA A
  → GitHub commit
```

If two visitors save at almost the same time, both can end up reading the same SHA A.

```text
Visitor 1: read SHA A → save succeeds → SHA B
Visitor 2: read SHA A → attempt save → 409 Conflict
```

Instead of just failing the second visitor's post, I handled it like this.

```text
409 Conflict
  → re-read the latest guestbook.json
  → recompute empty tree coordinates
  → re-add the entry
  → retry up to 3 times
```

There was a more dangerous issue too. When JSON parsing failed, the code returned an empty array — and if a new entry was saved in that state, it could **overwrite a corrupted existing file with a brand-new array containing just one guestbook entry.**

So I changed it to abort the save entirely if the JSON isn't an array or fails to parse.

I also tightened request validation.

- Only allow `application/json`
- Max body size of 2KB
- Length limits on name and message
- Strip control characters
- Keep the honeypot
- UUID-based IDs
- Only record the IP throttle after a successful save
- Korean/English error messages

That said, there's still a problem left in this structure. Since guestbook commits also go to main, every single tree planted can trigger a Vercel deployment.

To keep this running without a DB, the next step should be splitting the guestbook JSON out to a dedicated branch or a separate repo.

---

## Step 9 — Cleaning Up Unused Images and Broken Links

I searched the code and Markdown for every image in `public` by filename. I removed 9 images with zero references, about 4.37MB.

During the cleanup I also found one broken image in the Korean/English Google Play posts. The actual file existed, but a single digit in the timestamp in the Markdown URL was off.

```text
Post URL:       ...1778551636467.png
Actual filename: ...1778555636467.png
```

It was just a job of deleting unused files, but re-checking references across every tracked file before deleting let me catch and fix an existing broken link along the way.

---

## Every Change Was Split Into Small Commits

Fixing the entire site at once makes it hard to tell which change caused a problem when something goes wrong. I committed this work feature by feature.

| Area | Commit |
|---|---|
| Dependency security update | `6639443` |
| Portfolio structure improvement | `d538e02` |
| Local lookup for public posts | `6f1cda0` |
| Opt-in loading for home Three.js | `2de6d4a` |
| SEO and share images | `1101968` |
| i18n and reading time | `f6099ab` |
| Accessibility and ESLint | `d5bc52f` |
| Security response headers | `e49d7a8` |
| Scheduled publish stabilization | `d29f30b` |
| Guestbook conflict handling | `a45b7f3` |
| Post image recovery | `a7d5c5c` |
| Unused image cleanup | `bdfc1ee` |
| Project detail modal | `d5a73df` |

If something goes wrong after deploy, I can revert just the work I need to.

```bash
# e.g. revert just the project detail modal
git revert d5a73df
git push origin main
```

When reverting multiple commits, it's safer to revert in reverse order, starting from the most recent.

---

## Final Results

| Item | Before | After |
|---|---:|---:|
| Portfolio initial HTML | ~272KB | ~167KB |
| Portfolio initial image tags | ~50 | 13 |
| Home initial JavaScript | ~1.245MB | ~685KB |
| Home HTML | ~106KB | ~76KB |
| Post list response | ~1.2–2.4s | ~0.03s |
| ESLint | errors/warnings present | 0 |
| npm audit | vulnerabilities present | 0 |

Finally, I ran the following checks.

```bash
npm run lint
npm run build
npm audit --audit-level=moderate
git diff --check
```

The Next.js production build finished generating all 300 pages, and the file-tracing warnings no longer showed up. I also confirmed the guestbook API returns 415 for an invalid Content-Type, 400 for invalid JSON, and 413 for an oversized request.

I couldn't run automated visual regression tests on the detail modal since I don't have access to an automated browser connection. I plan to double-check that part with real mobile screens and keyboard navigation.

---

## Wrap-Up — Deciding When to Load Something Matters as Much as Adding a Feature

Five lessons came out of this audit.

1. **A portfolio doesn't need to show everything up front.** It's better to build interest with a summary and reveal detail only on request.
2. **Not having a DB doesn't mean public reads need to depend on an API either.** Writes can go through the GitHub API while reads of published content come from build files.
3. **Even a fun feature should be demoted to opt-in if it blocks the core entry point.** The pixel village can still have plenty of presence without auto-launching.
4. **Automation should guard against conflicts and overwrites before it worries about the success path.** Scheduled publishing and the JSON guestbook were the same problem in two places.
5. **The bigger the refactor, the smaller the commits should be.** Being able to revert performance, SEO, accessibility, and ops changes independently is what let me deploy with confidence.

I only meant to tidy up the portfolio page a little at first. But once I actually followed the whole flow, the slow post list, the auto-loading Three.js, the missing SEO metadata, and the guestbook's conflict risk all turned out to be connected.

As a site grows, it seems like what matters more than bolting on one more new feature is **revisiting when, why, and at what cost the features you already have are running.**
