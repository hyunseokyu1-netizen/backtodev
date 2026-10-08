---
title: 'I Pushed to Git but Nothing Deployed — How to Actually Verify a Vercel Deploy'
date: '2026-07-17'
publish_date: '2026-12-15'
description: A production site was still 7 hours behind after a push because the project had no Git integration at all — a 3-step Vercel CLI checklist for verifying a deploy, and the habit of writing down each project's own pitfalls
tags:
  - Vercel
  - Deployment
  - Next.js
  - CLI
  - DevOps
---

I committed a one-line copy fix and ran `git push origin main`. I'm on Vercel, so I just assumed an
automatic deploy would kick off, and when I opened the production site to check — **nothing had
changed.**

Cache issue? Opened it in an incognito window too, still the same. That kicked off a 30-minute rabbit
hole, and the conclusion turned out to be anticlimactic. **This project never had Vercel Git integration
set up in the first place.** Pushing meant Vercel had no idea anything had happened at all.

Today I'm sharing the "how to actually verify a deploy went through" checklist I pulled together from
this rabbit hole. It's Vercel-specific, but the principle holds for any deploy pipeline.

## Background: What Was I Trying to Deploy

It was a tiny commit — changing the region label on the landing search bar.

```diff
-    searchCountry: '호주 · 뉴질랜드',
+    searchCountry: '전 세계',
```

The service's positioning was shifting from a specific region toward global, and the "Australia · New
Zealand" label pinned in the hero search bar kept bugging me. I could have removed the label entirely,
but that would leave the search bar layout feeling empty. Changing it to "Worldwide" **keeps the layout
intact while actually making the positioning message stronger.** I matched the English locale too,
`Australia · NZ` → `Worldwide`.

One bonus: changing the UI copy wasn't the whole story. This service has an AI support chatbot, and the
knowledge document it references still had region/role-biased phrasing in it.

```diff
-... 호주·뉴질랜드 등 해외 IT 채용에 특히 유용합니다.
+... 국가·직군에 관계없이 해외 취업 전반에 활용할 수 있습니다.
```

It would be strange for the UI to say "Worldwide" while the chatbot answers "this is especially useful
for Australia/New Zealand IT hiring." **An AI chatbot's knowledge document is part of the service's
copy too.** Changing positioning means grepping not just the text visible on screen, but the text the AI
reads as well.

Up to this point everything went smoothly. The trouble started with the deploy.

## Step 1: Question the Assumption "It's Probably Deployed" — `vercel ls`

When the site doesn't change after a push, the first thing to check is **when the latest deployment was
actually created.**

```bash
vercel ls
```

The output made it obvious right away.

```
Age     Deployment                              Status    Environment
7h      https://jobradar-xxxx.vercel.app        ● Ready   Production
9h      https://jobradar-yyyy.vercel.app        ● Ready   Production
...
```

I'd just pushed, but **the latest deployment was from 7 hours ago.** My push had triggered no deployment
at all.

Looking through the deployment history, every single one had been pushed up via the CLI. This project had
been first set up by deploying with the `vercel` CLI directly, and the step of connecting a GitHub repo to
the Vercel project had gotten skipped. Without Git integration, a push is just code landing on GitHub and
nothing more. Vercel never receives a webhook for it, so it does nothing.

The fix is simple. Just run the production deploy directly.

```bash
vercel --prod
```

> **Lesson 1**: "I pushed = it's deployed" is only true when the pipeline is **configured** that way.
> Automatic deployment is a result of configuration, not a default.

## Step 2: Confirm the Deploy "Actually" Went Through — `vercel inspect`

`vercel --prod` printing a success message isn't the end of it. Two more things need checking.

1. Is the deployment status **Ready** (did the build actually succeed)
2. Does the custom domain's **alias point at this deployment**

```bash
vercel inspect https://jobradar-zzzz.vercel.app
```

Two lines in the output matter.

```
status      ● Ready
aliases     matchda.com, www.matchda.com
```

On Vercel, the deployment URL and the service's domain are separate things. The deployment can succeed
while the alias still points at an old one, and users will still see the old version. `vercel --prod`
usually moves the alias over too, but "usually does" and "confirmed it did" are different things.

## Step 3: Verify What's Actually Being Served — `curl`

The last step is to stop trusting what the deploy system says, and **directly check the HTML the real
domain is serving.** This particular change was a single line of text, so a single grep is enough.

```bash
curl -sL https://matchda.com/ | grep "전 세계"
```

A match means it's genuinely done. Here's why this beats a browser refresh:

- Unaffected by browser cache or service workers
- Checks the actual raw response the CDN is serving
- Leaves a record in the terminal as proof of "I verified this"

If the change isn't text, adapt accordingly — curl the relevant endpoint for an API change, or check
whether the build hash changed for a style change.

## The 3-Step Deploy Verification Checklist

| Step | Command | What to check |
|---|---|---|
| 1. Was a deployment created | `vercel ls` | Is the latest deployment's Age recent |
| 2. Is it alive and connected | `vercel inspect <url>` | `Ready` status + domain alias |
| 3. Is it actually being served | `curl -sL <domain> \| grep <changed content>` | Is the change present in the response |

All three are 10-second commands. Compared to the cost of finding out later that you skipped this and
assumed it worked, it's basically free.

## Troubleshooting: Common Points of Confusion

**Q. I pushed, but there's no new deployment in `vercel ls`**
→ This likely means the project has no Git integration. Check your project's Settings → Git on the
Vercel dashboard to see whether a repo is connected. Projects that have only ever been deployed via the
CLI can end up in this state. Either deploy directly with `vercel --prod`, or set up Git integration to
switch to automatic deploys.

**Q. The deployment is Ready, but the site hasn't changed**
→ Check with `vercel inspect` whether the domain alias is pointing at the latest deployment. If the
alias is correct, it might be a browser cache or ISR/revalidation issue — check the raw response with
`curl`.

**Q. I don't trust myself to remember all this every time**
→ Neither do I. Which leads to the final lesson.

## Project-Specific Pitfalls Have to Be Written Down, or You'll Repeat Them

The root cause of this whole rabbit hole wasn't technical — it was **memory.** The fact that "this
project has no Git integration, so you have to run `vercel --prod` directly" was almost certainly
something I knew a few months ago. Today's me didn't.

So the first thing I did after finishing the deploy wasn't writing code — it was **writing it down.** In
my project memory doc (I use CLAUDE.md and a memory folder; a deployment section in the README works
just as well), I added this:

```markdown
## 배포 주의
- 이 프로젝트는 Vercel Git 연동 없음 — push만으로 배포되지 않음
- 배포: `vercel --prod` 직접 실행
- 배포 후 확인: `vercel ls` → `vercel inspect` → `curl | grep`
```

Every project seems to have one of these "pitfalls unique to that project." For this one it was the
deploy method; for another project it might be a quirky environment-variable load order, or a migration
that has to be run manually. The common thread is **if it's not written down somewhere, you will
absolutely step on it again.**

## Wrap-Up

Today's flow at a glance:

1. A one-line text fix (region label 'Australia · New Zealand' → 'Worldwide' + cleaning up the chatbot knowledge doc)
2. `git push` — and the site didn't change
3. `vercel ls` reveals the latest deployment is 7 hours old → turns out this project has no Git integration
4. Deployed directly with `vercel --prod`
5. Confirmed Ready status and domain alias with `vercel inspect`
6. Verified the live served content with `curl -sL https://matchda.com/ | grep "전 세계"`
7. Wrote the deploy procedure down in the project docs

Boiled down to three lessons:

- **A push is not a deploy.** Automatic deployment is a result of configuration, not a default.
- **A deploy isn't done until you've verified it's actually being served.** `ls` → `inspect` → `curl` is
  enough.
- **Write down project-specific pitfalls the moment you find them.** Future-you has a worse memory than
  today's you.

Does your project really deploy when you push? If you're not sure, I'd recommend running `vercel ls`
right now.
