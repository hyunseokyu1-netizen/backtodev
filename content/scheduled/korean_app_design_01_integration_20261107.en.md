---
title: "Merging Insurance, Card, Investment, and Pension into One App Just Made the Call Center Busier (1/2)"
date: '2026-11-07'
publish_date: '2027-01-09'
description: Korean financial groups keep merging their subsidiary apps into one trendy-looking super-app, but the specialized menus vanish in the process — and customers end up stuck on hold with a support agent instead
tags:
  - Essay
  - UX
  - Dark Patterns
  - Finance Apps
  - Design
---

## It Got Prettier, and Harder to Use

Lately I keep noticing the same pattern across Korean financial apps. Insurance, cards, investments, pensions — services that used to run as separate apps under separate subsidiaries — are getting merged into a single app. The stated reason is always "customer convenience," but it looks a lot more like making it easier to cross-reference customer data across affiliates in one place. And while they're at it, they redo the whole design too — big card-style layouts, smooth animations, minimal icons, the whole trendy design language you'd expect from a slick international app. On the surface, it genuinely looks better.

The problem shows up right after that. The detailed menu I used to rely on in the standalone insurance app has quietly disappeared. To keep the merged app's design system consistent, the deep, subsidiary-specific features got pruned in the name of "overall unity." I know exactly which menu I used to use, and I can't find it anywhere, no matter what I tap.

## Searching Doesn't Help, So You End Up Calling

When I can't find a menu, I search for it. But the merged app's search rarely surfaces that kind of deep feature. I try a few different queries, get the same handful of results every time, and the screen I actually want never shows up. At that point there's exactly one option left — call customer support.

Even then, you don't get connected to an agent right away. The ARS system leads with "you can actually do that in the app," nudging you back toward self-service. Once would be tolerable, but it usually happens two or three times in a row. And if you fat-finger a button during one of those prompts, the call just drops — all you get afterward is a text message with an app link. Whatever time you'd already spent waiting is gone. It takes surviving that loop a few times before you finally reach the point where you're routed to an actual agent.

Then comes the hold. Thirty minutes is the default, more or less. By the time you've already burned energy fighting through the app-redirect gauntlet and then waited another thirty minutes on top of that, you're fully worked up by the time someone picks up. Which is rough for the agent — none of this was their decision, and they're the one who has to absorb the customer's frustration anyway.

## Laid Out as a Table

Lining up before-and-after makes the shift easier to see.

| | Before (separate apps per subsidiary) | After (one merged app) |
|---|---|---|
| Design | Inconsistent across subsidiaries, dated feel | Unified, trendy design language |
| Deep features | Kept, specialized per business line | Partially cut for "overall consistency" |
| Finding what you need | Found directly inside that business's app | Often doesn't surface even through search |
| Path to resolution | Straight to that subsidiary's support line | 2-3 rounds of ARS app-redirect, then an agent |
| Net feeling | Clunky, but it got the job done | Pretty, but it all funnels back to a phone call |

## Consolidation Itself Isn't the Problem

I don't want this to come across as "merging apps is inherently bad." It isn't. Being able to check insurance, cards, investments, and pensions from one login, in one place, is a genuine convenience. The problem is how the merge gets executed. Done right, consolidation would unify the shared skeleton — login, notifications, payments — while keeping each business line's deep functionality intact and simply redesigning the entry points into it. What actually happens looks closer to the opposite. Energy goes into unifying the visible design system first, and the functionality underneath gets dropped one piece at a time because "there's nowhere obvious to put it right now." Fixing the surface first and deferring the actual functionality seems to be exactly the sequence that causes the menus people actually used to vanish.

## The Menus That Disappear Follow a Pattern

After going through this a few times, I started noticing what the vanishing menus had in common.

1. **Low-frequency features that are critical in a specific situation** — something like re-issuing an insurance claim document in a particular format: rarely used day-to-day, but essential exactly when you need it
2. **Screens built around terminology unique to that one business line** — things that don't map cleanly onto the merged design system's shared components, so they get left out
3. **Settings buried deep in the old UI** — cut along with the overall effort to flatten menu depth during the merge

All three share the same trait: "invisible most of the time, but indispensable when it matters." If you prioritize purely by usage logs, these features naturally sink to the bottom of the list — but for the one user who needs that feature at that moment, it's the only thing that matters.

## The Cost Went Up While the Business Nuances Disappeared

What's even more frustrating is that these consolidation projects are never cheap. Merging systems that were scattered across different subsidiaries takes serious technical and organizational effort. And after all that time and money, the result still feels like it never accounted for what makes each business line different. Insurance, card, and investment customers need fundamentally different information structures — cramming all of it into one design system and one information architecture ends up satisfying none of them particularly well.

The end result: the money gets spent, the customer experience gets worse, and the fallout lands entirely on the support agents. The people who made the consolidation call will likely never personally sit through that one phone call, that thirty-minute hold — which might be exactly why this cycle keeps going unnoticed. The metrics decision-makers see are usually things like "percentage of consolidation complete" or "how many services got merged into one app." Those numbers get neatly filled in the moment the project wraps, while every support call that happens afterward, day after day, gets logged against a completely different department's KPIs. The fact that the people who designed the merger and the people who field the resulting flood of calls sit in entirely different reporting lines is, I think, exactly why this problem doesn't get fixed easily. In the next post, I want to talk about something else these apps have far too much of — popups. I think it comes from the same root cause: features built to be shown off to someone, rather than built for the customer.
