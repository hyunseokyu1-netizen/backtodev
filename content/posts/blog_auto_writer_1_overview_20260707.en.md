---
title: 'Automating Blog Publishing — Building a Personal Automation Platform for Tistory and Naver (1) Overall Architecture'
date: '2026-07-07'
publish_date: '2026-08-12'
description: The story of designing, from scratch, a personal blog automation tool that writes an AI draft the moment you register a topic and publishes it via browser automation
tags:
  - Automation
  - Node.js
  - TypeScript
  - Claude API
  - Side Project
---

There's always something that trips me up whenever I decide to blog consistently. I have things to write about, but actually sitting down to draft it, polish it, and then log into Tistory and Naver separately to paste it in takes more effort than it sounds. "I'm a bit busy today" turns into a month with nothing posted before I know it.

So this time, I built a personal tool to automate this entire process. I'm calling it **blog-auto-writer.** The structure: register topics by date, and at a set time, AI writes a draft in my style and browser automation handles publishing to Tistory and Naver. This post is the first in that series, covering how I designed the overall architecture.

## Why I built it

"Blog automation" usually conjures up the image of "posting via a publish API." But checking, I found that **both Tistory's Open API and Naver Blog's posting API had been discontinued.** In other words, there's no official way for a program to post.

That left two options.

1. Switch to a different platform with an open API (Medium, Ghost, etc.)
2. Automate the exact actions a human takes in the browser

I didn't want to move away from the blog I'm already using, and I happened to be curious, from a recent session, how reliably session persistence and browser control could actually work — so I went with **option 2, browser automation.**

## The overall flow

I split the design into three big chunks.

```
topics/topics.yaml (topic registration)
        │
        ▼  daily at a set time (scheduler), or manual run
Claude API draft generation ──▶ drafts/*.md
        │
        ▼  Playwright (uses a saved login session)
Publish to Tistory / Naver Blog ──▶ moved to published/*.md
```

The core idea is that **each stage is linked by a single file.** Topics live in a YAML file, drafts in markdown files, and publish status is recorded in the same YAML's `status` field. No database, no separate server — the whole pipeline runs on a handful of local files.

## Why split it this way — separation of concerns

I initially considered cramming "register topic → generate draft → publish" into one function, but ended up splitting all three apart. The reasons are simple.

- **Draft generation and publishing fail at different points.** An AI response coming out weird, and a login session expiring, are completely different problems. Bundle them together, and it's hard to tell where something failed.
- **Review is necessary.** There are times I don't want to post what the AI wrote as-is. Separating draft generation from publishing leaves room for a human to step in and edit the content in between.
- **Retrying needs to be easy.** If only publishing fails, I shouldn't have to regenerate the draft — just retry publishing.

So I ended up splitting directories and responsibilities like this.

```
config/style.md              writing style guide (included in the AI prompt)
config/accounts.json         account and schedule settings
topics/topics.yaml           the topic queue, by date
drafts/                      generated drafts (reviewable before publishing)
published/                   archive of published posts
profiles/                    browser login sessions (cookies)
src/
  draft.ts                   AI draft generation
  publishers/tistory.ts      Tistory publish automation
  publishers/naver.ts        Naver publish automation
  scheduler.ts               daily auto-publish cron
  server.ts                  local web dashboard
```

## Designing the topic queue — state management with one YAML file

Topic management is handled by one very simple YAML file.

```yaml
topics:
  - date: "2026-07-07"
    platform: both        # tistory | naver | both
    topic: "Getting started with browser automation using Playwright"
    keywords: [Playwright, Automation]
    status: pending        # pending → drafted → published
```

There's one interesting design point here. Registering `platform: both` gets **expanded into two separate entries** — one for `tistory`, one for `naver` — internally in the pipeline. This lets a situation like "Tistory published but Naver failed" be handled as an independent `status` per platform. (In practice they share the same source entry, but processing logic branches by platform.)

`status` never needs to be touched by hand. The pipeline automatically updates it to `pending → drafted → published` as each stage completes. If an error occurs during publishing, it stays at `failed`, so I can immediately tell what went wrong next time.

## Account settings, also in one file

Things like the Tistory blog name, the Naver blog ID, and the auto-publish time all went into `config/accounts.json`.

```json
{
  "tistory": { "blogName": "my-blog", "enabled": true },
  "naver": { "blogId": "my_naver_id", "enabled": false },
  "schedule": { "publishTime": "09:00", "timezone": "Asia/Seoul" }
}
```

The reason for the `enabled` flag is that there was a real situation where I wanted to test Tistory first while Naver integration wasn't finished yet. Being able to turn a platform on and off through a config file, with no code changes, made it much easier to verify features incrementally.

## What's coming in the next part

This part covered "why I designed it this way." From the next part on, in the order I actually built things:

- **Part 2**: How to auto-generate drafts matching my writing style with the Claude API (including prompt caching)
- **Part 3**: The trial and error of keeping a login session alive with Playwright, all the way to actually publishing on Tistory
- **Part 4**: The local web dashboard I built because a CLI alone felt lacking

Part 3 especially should be the most fun, since it's a story of "this should work in theory, but it actually failed three times."
