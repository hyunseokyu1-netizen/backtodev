---
title: 'Recreating American Football with Four Dice — The Playbook Football Board Game'
date: '2026-07-11'
publish_date: '2026-11-08'
description: Introducing the board game Playbook Football and breaking down the four-dice, card-chart resolution system that drives it
tags:
  - Board Games
  - Game Development
  - Flutter
  - Probability
---

Lately, as a side project, I've been porting an American football board game into a Flutter app. While writing the code, a thought struck me: before talking about the app, I should talk about **how well-designed the original board game itself is.** It's a system that recreates an entire football game with four dice and a handful of cards, and the more I dig into it, the more impressed I get with the structure.

This post introduces the original board game Playbook Football and breaks down how its heart — the **four-dice resolution system** — actually works. I wrote it so it's readable even if you don't know anything about American football. In fact, it might be even more fun for developers, viewed through the lens of "how to design a rule-based simulation as a data table."

## The Game Called Playbook Football

Playbook Football is a two-player board game designed by Kevin Barrett and published by Bucephalus Games. The tagline on the box reads "A hard-hitting game for two players." It's built on the premise of following standard NFL rules, and it's so committed to faithfully recreating the real sport that the rulebook even tells you to refer to actual American football rules for anything it doesn't cover.

What I referenced was a Korean fan-translated rulebook. The translator wrote in the preface, "this is a somewhat unfamiliar sport and board game in Korea, but this gave me a chance to learn about American football and discover a new sport I found appealing" — and I ended up on exactly the same path. I'm a case of getting into American football by reading a rulebook in order to implement the game.

The game's components are modest:

| Component | Role |
|---|---|
| Field board | The football field. Two magnetically joined panels |
| Ball marker | Shows the ball's current position |
| Yard marker | The goal line — "advance 10 yards to here for a first down" |
| Down/Play/Quarter counters | Track progress through downs (1-4), plays (1-16), and quarters (1-4) |
| 9 offense cards | 4 pass plays + 5 run plays. A result chart printed on the back |
| 9 defense cards | Defensive formations. A list of modifiers for each offensive play |
| Special teams / shared cards | Kickoff, punt, field goal, turnover, fumble, etc. |
| Dice | 1 ten-sided die + 1 twelve-sided die per team (4 total) |

For anyone meeting American football for the first time, here's the core rule in a nutshell: the offense must **advance 10 yards within 4 attempts (downs).** Succeed, and they get 4 more attempts; fail, and possession flips to the opponent. Repeat this, and moving the ball all the way to the far end of the opponent's territory (the end zone) scores a touchdown (6 points).

## How a Single Turn of the Game Plays Out

Here's how one play unfolds. I've carried the sequence over directly from the rulebook.

1. The offense and defense each place one card **face-down**
2. Both sides roll their own dice set (1 ten-sided die + 1 twelve-sided die)
3. The play marker advances by one (16 plays per quarter)
4. **Penalty check**: if the two teams' ten-sided dice sum to 6 or 16, a penalty occurs
5. Cards are revealed, and the offense's ten-sided die value, adjusted by the defense card's modifier, determines the **chart row**
6. The sum of both teams' twelve-sided dice determines the **chart column**
7. The ball moves by the number sitting at the intersection of that row and column
8. The down counter advances by one

The key is step 1. Because both sides play their cards **secretly**, half of this game is a psychological battle. Reading your opponent — "they look like they're setting up a long pass, so let's bring in a pass defense" — matters just as much as the roll of the dice.

## Four Dice, Each with a Different Job

The first time you play this game, you wonder "why roll four whole dice?" I got asked this myself — a friend saw the dice animation I added to the app and asked, "what are these four numbers?" Here's the breakdown.

### Offense D10 (Red) — Determines the Chart Row

The ten-sided die rolled by the offense. This value sets the **row (vertical position)** on the chart printed on the back of the offense card. The chart's rows split into 5 bands (9-10 / 7-8 / 5-6 / 3-4 / 1-2), and **the higher the row, the more good outcomes cluster there.**

What matters is that this die **gets adjusted by the defense card.** Each defense card lists a modifier (-3 to +3) for each of the 9 offensive plays. For example, the GOAL LINE defense applies -2 or -3 to run plays but actually grants a +1 against long passes — the numbers expressing that a defense hunkering down to hold the line is strong against short-yardage pushes but weak against anything sailing over its head.

```text
예시: 공격이 PITCH OUT, 수비가 GOAL LINE을 낸 경우

공격 D10 = 9
GOAL LINE의 PITCH OUT 보정 = -2
조정값 = 9 - 2 = 7  →  차트의 "7-8" 행
```

So choosing the right defense really means **shaving down your opponent's die and pushing it into a bad row on the chart.** That's the heart of this game's strategy.

### Defense D10 (Blue) — Dedicated to Penalty Calls

The defense also rolls a ten-sided die, but this value is **never used in chart resolution at all.** It exists purely for the penalty check.

- A penalty occurs if the two teams' D10s **sum to 6 or 16**
- However, if the two dice show the same face (3-3, 8-8), the penalty cancels out and the play proceeds normally
- When a penalty occurs, the cards played on that down are voided, the penalty card chart determines the yardage, and the same down is replayed
- Whichever side rolled the lower die is the team charged with the penalty

At first I thought "dedicating a whole die just to penalties seems wasteful," but the math turns out to be pretty precise. The odds of two D10s summing to 6 or 16 are 10 out of 100 combinations — exactly 10%. Subtract the matching-face cases (3-3, 8-8) and you get **8%**, roughly matching the actual per-play penalty frequency in real NFL games. What dedicating a whole die to this buys you is the tension that "a penalty can hit either side, offense or defense, at any time."

### Two D12s (Purple) — Determine the Chart Column

The **sum (2-24)** of one twelve-sided die rolled by each team sets the **column (horizontal position)** on the chart. There are 10 column bands:

```text
2-3 | 4-5 | 6-7 | 8-9 | 10-12 | 13-15 | 16-18 | 19-20 | 21-22 | 23-24
```

Notice the band widths aren't uniform? The sum of two dice traces a bell-shaped distribution that peaks right around the median (13). So the frequently-rolled middle bands (10-12, 13-15) get a wide span of 3, while the rarely-rolled extremes (2-3, 23-24) get a narrow span of 2. And looking at the card charts, **the explosive outcomes (big gains, interceptions) sit in the outer columns, while the ordinary outcomes sit in the middle columns.** The probability distribution is baked directly into the chart's design.

### Summed Up in One Table

| Die | Who rolls it | Role | Notable detail |
|---|---|---|---|
| Offense D10 (Red) | Offense | Determines the chart row | Gets a defense-card modifier (-3 to +3). Higher is better |
| Defense D10 (Blue) | Defense | Dedicated to penalty calls | Penalty if the combined sum is 6/16; cancels on matching faces |
| D12 (Purple) ×2 | One each side | Sum determines the chart column | The sum's bell-shaped distribution makes extreme outcomes rare |

## Let's Walk Through One Actual Resolution

Here's a real situation that came up while testing the app.

```text
상황: AI가 PITCH OUT(러닝) 공격, 나는 GOAL LINE 수비 선택
주사위: 공격 D10 = 9, 수비 D10 = 10, D12 = 4와 10

1) 반칙 체크: 9 + 10 = 19 → 6도 16도 아님, 통과
2) 행 결정:  9 + (GOAL LINE의 PITCH OUT 보정 -2) = 7 → "7-8" 행
3) 열 결정:  4 + 10 = 14 → "13-15" 열
4) PITCH OUT 차트의 (7-8행, 13-15열) = 6 → 6야드 전진!
```

Without the -2 defense modifier, it would've landed on the "9-10" row, and that row's value in the same column is 8. One defense card ended up blocking 2 yards. This is how, on every single play, card choice meaningfully steers the outcome.

## A Probability Table Called "Chart"

The back of each offense card has a 5-row × 10-column = 50-cell chart. The cells hold either gain/loss yardage numbers or special outcomes (I = interception, F = fumble). This chart is, in effect, **a lookup table that hardcodes the probability distribution for each play.**

Comparing two cards reveals the design intent:

- **DIVE/PLUNGE** (a run up the middle): averages 2.7 yards. Most of the chart is small numbers in the 1-6 yard range. In exchange, even failure costs little, and its success rate (effectiveness) is the highest at 74.1%. A "short but reliable" play
- **LONG BOMB** (a deep pass): averages 14.7 yards, with huge numbers like 96 and 71 on the chart, but it also carries 2 interception (I) cells and a pile of 0-yard cells. Success rate: 44.5%. "All or nothing"

From a developer's perspective, this game's balancing lives not in code logic but in **data.** Even when porting it to the app, the resolution engine code amounts to roughly three lines — "compute the row, compute the column, look up the table" — and the chart data is entirely what makes the game fun. Sports board games from the 1970s through the 2000s were already practicing this design of separating rules (code) from balance (data).

```dart
// 앱 구현에서 판정의 뼈대. 이게 거의 전부다.
final mod = defenseCard.modifierFor(offenseCard.id); // 수비 보정
final row = rowIndex((offD10 + mod).clamp(1, 10));   // 행
final col = columnIndex(offD12 + defD12);            // 열
final cell = offenseCard.chart[row][col];            // 결과
```

## What's Not on the Chart: Special Situations

Situations outside normal offense/defense plays are handled by dedicated cards. The difference is that these cards resolve on their own, with no defense card involved.

- **Kickoff / Kickoff Return**: at the start of each half and after scores. One side kicks, the other returns it. A ball landing in the end zone can be downed for a touchback, starting from the 20-yard line instead of returning it
- **Punt**: when advancing 10 yards on 4th down looks unlikely, instead of just handing over possession, you kick the ball far downfield to put the opponent in a worse starting spot. Two types: Long/Short
- **Field Goal**: a separate card exists for each distance band to the goalposts (1-19 / 20-29 / 30-39 / 40-49 / 50-59 yards), and the farther out, the more failure (X) cells there are. Worth 3 points on success
- **Turnover / Fumble**: an interception or fumble flips possession, and a turnover card resolves how far the defense ran the ball back after recovering it. If another fumble happens during that turnover return, a fumble card decides who ends up with the ball. For reference, the fumble card's recovery probability is 48.3% — designed to land just a hair below a coin flip

After a touchdown, you choose a bonus score: the safe **extra-point kick (+1, 98.7% success rate)** or the gamble of a **2-point conversion (+2, one offense/defense card play from the 2-yard line).**

## Wrap-Up

Playbook Football's resolution system, summed up in one sentence:

> **The offense D10 (with the defense modifier applied) sets the row, the D12 sum sets the column, and their intersection is the outcome. The defense D10 stands guard over penalties.**

Taking in the whole system:

1. A **psychological battle** of playing cards in secret — a successful read can shave your opponent's die down by as much as -3
2. The **row**, set by the D10 — the success or failure of the play
3. The **column**, set by the D12 sum — a bell-shaped distribution that keeps extreme outcomes rare
4. The chart = **a data table holding the probability distribution** — separating rules from balance
5. A dedicated penalty die — a random variable sitting at roughly an 8% chance

The appeal of this game is that it manages this much simulation depth out of four dice and some paper cards. In the next post, I'll cover what I ran into while porting this system to Flutter — modeling the chart data, the AI opponent's card-selection logic, and the dice-rolling animation.
