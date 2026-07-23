---
title: '[App] Cassette Player App Dev Log — From Day One to the First Week'
date: '2026-04-10'
description: A cassette player app born out of nostalgia for tape culture — the first week bouncing between Replit and Claude Code
tags:
  - React Native
  - Cassette App
---

I started building a cassette player app. Here's day one and one week later, merged into a single log.

---

## Log 01 — Why a Cassette Player? (April 9)

I skipped my YouTube Premium payment this month, and it turns out listening to music is even more annoying than the ads.

I listen to music occasionally, and lately doing it at the library has gotten inconvenient.

So I started copying old MP3 files onto my phone and playing them there...

Back in the day, you'd record what you wanted onto a tape and listen through until it ran out.

I missed that feeling of waiting.

Music today is all quick listens and skips, not the kind where you have to hear the whole track — hiss and all. I missed that era's player enough to just go build one.

### Replit vs Claude Code

I started by building it with both Replit and Claude Code, comparing the two platforms.

→ [Replit vs Claude Code](https://backtodev.com/en/posts/replit_vs_claudecode)

For app development, Replit felt better early on.

You get to see the app screen right away in the Preview pane,

whereas with Claude Code you have to spin up a simulator, which takes forever to load... and when a screen error shows up, debugging means capturing the screen and checking it manually. Kind of a hassle.

But Claude Code really shines during debugging.

The design, though — even when I gave it images, it never quite came out the way I imagined.

I described the design in painstaking detail and it still didn't land... I think I'll need an actual designer to get the quality up.

> What I learned developing with Claude Code: it's a huge help at the start and during debugging, but in the end a human still has to check it and push it forward.

---

## Log 02 — One Week In, Hitting the Design Wall (April 10)

It's been a week since I started building the cassette player app.

The design kept bugging me, so I tried switching AI tools, tried AI image generation for changes, tried this and that — and I feel stuck right at this spot.

AI tools I've used so far:

- Claude Code
- Replit
- Antigravity
- NanoBanana
- ChatGPT

I ran through every AI tool I had access to trying to improve the design and fix bugs, and it just wasn't working.

The version built from scratch with Claude Code had so many bugs that fixing them took longer than building the features in the first place.

In the end I decided to pull the version Replit had built early on into Claude Code, and just fix and develop features from there.

I'm on the default Sonnet model that comes with Pro, and my Replit paid usage ran out so I'm on the free tier now — and honestly, free Replit felt better in the early stages than default Sonnet.

So for now I'll spend this week improving features, and start on store registration next week.

> The more I develop, the more it becomes clear a human hand is required in the end.

When I first built a homepage with WordPress, I was thrilled at first — but as I kept adding detailed features, it kept taking longer and longer.

AI development feels the same. Thrilling at first, but increasingly in need of a human hand.

There's a lot left to learn — agents, harnesses, and more — but for now, I'll just take it one step at a time.

---

## What Happened Next — How the App Turned Out

I was stuck at the design wall when I wrote this log, but I eventually finished it and **shipped it to Google Play**. Then in July 2026, I rebuilt the app entirely from scratch as **v2.0.0 — a full relaunch that lets you put MP3s and YouTube links on a cassette and gift it with a single link**.

- Final result: [Portfolio — Cassette Music Player](/en/portfolio)
- Store: [Google Play — Cassette Player](https://play.google.com/store/apps/details?id=com.hscassette.player)

The first week's conclusion — "a human hand is required in the end" — still holds true today. The only thing that's changed is that human hand keeps getting faster.
