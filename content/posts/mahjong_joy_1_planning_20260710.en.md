---
title: "Mahjong Joy Dev Log (1) — What's Left of Mahjong If You Strip Out the Scoring Hands? Planning Analysis and a Work Plan"
date: '2026-07-10'
publish_date: '2026-10-29'
description: Building a casual game that strips out all of mahjong's scoring hands and keeps only 3-3-3-3-2 set-matching, starting with Claude Code analyzing the planning docs
tags:
  - Flutter
  - Claude Code
  - Game Development
  - Planning
---

> **Mahjong Joy Series**
> 1. **Planning Analysis and a Work Plan** ← this post
> 2. Core Logic — the Win-Detection Algorithm
> 3. Building the Game Engine and AI
> 4. Pastel UI and Tile Animations
> 5. Scoring System and Main Screen

## Mahjong Is Fun, But It's Really Hard

If you've ever tried to learn mahjong, you know the feeling. Matching tiles itself clicks pretty quickly — the trouble starts after that. Riichi, yaku, tanyao, pinfu... faced with hundreds of scoring hands and scoring formulas, most people just give up.

So I had a thought. **What if you got rid of all the scoring hands?** Keep only the essential fun of mahjong — the set-matching puzzle of completing four 3-tile melds plus one 2-tile pair (3-3-3-3-2). I named it **Mahjong Joy.**

This series is a record of actually turning that idea into a playable Flutter game together with Claude Code. Part 1 covers having the AI analyze the planning docs and putting together a work plan.

## What I Had Going In: Two Planning Documents

I had two documents in hand when I started.

| Document | Content |
|---|---|
| `simple_mahjong_game_work.md` | A work order to hand to the AI. Data structures, the win-detection algorithm, and the 3-stage turn-loop UI |
| `Mahjong Joy_ Development Plan.pdf` | The game concept plan. Pastel visuals, simplified terminology, and the development roadmap |

First tip here. **It's worth putting together even a rough planning doc before you start.** Starting from a single line like "build me a simple mahjong game" and starting from a document with the win conditions and concept already laid out produce completely different directions for the result.

I handed Claude Code both files and asked it to "analyze these and put together a work plan." The interesting part was how it handled the PDF — since the environment had no PDF rendering tool, it found a PPTX file with the same content, unzipped it, and pulled the text directly out of the slide XML. There's something fun about watching an AI find a workaround when it doesn't have the right tool.

## Step 1: Finding a Conflict Between the Documents — Deciding the Tech Stack

The analysis turned up something interesting — the two documents were saying different things.

- The work order: "web (React/Next.js) or mobile"
- The concept PDF: "Flutter-based" (mentioning the Flame engine and Rive animation)

Claude Code flagged this conflict and asked me to choose, along with a recommendation that React, being checkable right in the browser, would be faster for iteration. But I chose **Flutter.** Simultaneous iOS/Android launch was the end goal, and Flutter also supports web builds, so I could just check progress on web during development anyway.

> 💡 When you hand an AI multiple documents, have it check for conflicts between them first. Finding one later costs a lot more to undo.

I also settled the scope at this point. The original plan was "start with solo play," but since I wanted to keep the basic mahjong rule of 4-player matches, I settled on **a 4-player table: me plus 3 AIs.**

## Step 2: Locking Down the Game Rule Spec

I wrote the simplified mahjong rules down as a document — the baseline for everything implemented afterward.

- 136 tiles: 3 suits of number tiles (1–9) × 4 copies each + 7 honor tile types × 4 copies each
- 4-player table, everyone starts with 13 tiles
- My turn: draw 1 tile (14 total) → discard 1 tile (back to 13)
- **There's exactly one win condition**: 4 melds + 1 pair = 3-3-3-3-2
- **Claiming**: no distinction between chi/pung — whoever's set gets completed by any discard can claim it
- **Completing a hand**: no distinction between ron/tsumo — declared the instant a hand completes

Borrowing the plan's own phrase, this is "an 80% reduction in complexity." The core move was consolidating traditional mahjong's terminology (chi, pung, ron, tsumo) into just two concepts: "claiming" and "completing."

## Step 3: Splitting Into Phases — Along With Completion Criteria

I saved the work plan as `WORK_PLAN.md`. The important part was defining **completion criteria (how to verify it)** alongside every phase.

| Phase | Content | Completion Criteria |
|---|---|---|
| 0. Setup | `flutter create`, folder structure | Build succeeds |
| 1. Core | Tile generation, **win detection**, waiting-tile calculation | All `flutter test` pass |
| 2. Flow + AI | 4-player turn loop, 3 AIs, drawn-game handling | AI vs. AI auto-simulation finishes normally |
| 3. UI/UX | Pastel theme, tile widgets, layout | Verified visually on the simulator |
| 4. Polish | Sound, tutorial, skins | Ready for store submission |

One judgment call I made at the planning stage turned out to be a pretty good one later. The plan mentioned the Flame engine and Rive, but **I decided to use neither.** A turn-based board game UI is well served by plain Flutter widgets and built-in animation, and fewer dependencies means less fighting with them. In fact, even the tile animations I'll cover in Part 4 were all handled with plain widgets.

## Why I Kept the Planning Doc in the Repo

`WORK_PLAN.md` wasn't just a plan document — I kept updating it as a **running progress dashboard.** Even across different sessions, the AI could figure out exactly how far along things were just by reading this one file. The habit of leaving context behind in a file when collaborating with an AI turns out to be more powerful than you'd expect.

```markdown
## 진행 상황 (2026-07-10)
- [x] Phase 0 — 프로젝트 셋업
- [x] Phase 1 — Core 로직 + 단위 테스트 25개 통과
- [ ] Phase 2 — 게임 엔진・AI
...
```

## Wrap-Up

1. Prepared the planning docs first (a work order + a concept plan) and had the AI analyze them
2. Caught a conflict between the documents (React vs. Flutter) early and settled on Flutter
3. Locked the simplified rule set (3-3-3-3-2, merging claiming/completing) into a written spec
4. Built `WORK_PLAN.md` with completion criteria attached to every phase, and kept updating it
5. Boldly cut extra dependencies like Flame/Rive

Next time, I'll implement the heart of this game: the **win-detection algorithm.** How do you figure out whether 14 tiles split cleanly into 3-3-3-3-2? Recursion and backtracking make an appearance.
