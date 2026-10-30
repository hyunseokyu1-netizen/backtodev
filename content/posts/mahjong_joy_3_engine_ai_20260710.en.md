---
title: 'Mahjong Joy Dev Log (3) — Building the Game Engine, the AI, and a 100-Game Auto-Play Test'
date: '2026-07-10'
publish_date: '2026-10-31'
description: Designing a 4-player mahjong turn loop as a state machine, attaching three heuristic AI opponents, and validating the whole thing with a 100-game auto-play simulation
tags:
  - Flutter
  - Dart
  - Game Development
  - AI
  - Testing
---

> **Mahjong Joy Series**
> 1. Planning Analysis and the Work Plan
> 2. Core Logic — The Win-Checking Algorithm
> 3. **Building the Game Engine and AI** ← this post
> 4. Pastel UI and Tile Animation
> 5. Score System and the Home Screen

## The Backbone of a Turn-Based Game Is a State Machine

The checking logic from part 2 was a function over "a single hand." Now it's time to build the **game flow** where four players take turns drawing, discarding, and claiming each other's discards.

A turn-based game engine ultimately comes down to a state machine. Mahjong Joy's states boil down to exactly three.

```dart
enum GamePhase {
  awaitingDiscard, // 현재 플레이어가 버릴 패를 고르는 중
  awaitingClaims,  // 방금 버려진 패에 대한 완성/뺏어오기 응답 대기
  finished,        // 승리 또는 유국
}
```

The flow cycles like this.

```
드로우 → [awaitingDiscard] → 버리기 → [awaitingClaims]
   ↑                                       │
   └── 아무도 안 가져감: 다음 사람 드로우 ──┘
        누가 가져감: 그 사람이 [awaitingDiscard]로
        누가 완성: [finished]
```

## Step 1: The Engine Is the Referee, the Controller Is the Facilitator

The part I was most careful about in this design is **separation of roles**.

- **The engine (`Game`)**: only validates rules. "Is this claim valid," "can tsumo happen right now." Invalid operations throw a `StateError`.
- **The controller**: decides the order of decision-making. Who gets to claim first, when the AI acts.

The reason for this split is the priority rule. When one player discards, several others might react at the same time. **A win (ron) always outranks a claim**, and among equal-priority claims, whoever comes first in turn order wins. If I baked this rule straight into the engine, it would become hard to later add "thinking time" for a human player. So the engine only hands back a list of opportunities.

```dart
class ClaimOpportunity {
  final int seat;
  final bool canWin;              // 이 패로 즉시 완성 가능?
  final List<ClaimOption> options; // 뺏어와서 만들 수 있는 몸통들
}
```

When a discard happens, the engine computes the remaining three players' opportunities ahead of time, and the controller calls one of `declareRon` / `applyClaim` / `passClaims`. Thanks to this split, tests can decide immediately while the UI waits for human input — two different usage patterns running on top of the same engine.

## Step 2: AI — A Potential Score Instead of Shanten Calculation

Building a proper mahjong AI calls for shanten calculation, but that's overkill for the first AI in a casual game. Instead I built a simple metric called **hand potential score**.

- A completed set (triplet/run): **100 points**
- A partial set (a pair, two consecutive tiles, two tiles with a one-gap): **20 points**
- A partial set is only valued up to "however many sets are still needed, plus one pair"

The score is computed by extending the recursive decomposition from part 2 to find the highest-scoring combination among the possible ones. This single metric solves two of the AI's decisions.

**Discarding**: try removing each tile one at a time, and discard whichever leaves the remaining hand with the highest score.

```dart
Tile chooseDiscard(List<Tile> hand, int meldCount) {
  Tile? best;
  var bestScore = -1;
  for (final tile in hand) {
    final rest = List.of(hand)..remove(tile);
    final score = _handPotential(rest, meldCount);
    if (score > bestScore) { bestScore = score; best = tile; }
  }
  return best!;
}
```

**Claiming**: only go through with it when the score after claiming (counting the extra set and the best resulting discard) is higher than it is now. "Claim anything claimable" often wrecks the hand instead — and a single score comparison filters that out.

Discard isolated honor tiles first, claim tiles that complete a set — an AI that genuinely looks like it's playing mahjong fell out of this one score.

## Step 3: 100 Auto-Played Games — Simulation Testing

The highlight of this post. How do you verify that the engine and the AI actually mesh correctly? **Have 4 AI players auto-play 100 games.**

```dart
test('100판이 모두 정상 종료된다 (승리 또는 유국)', () {
  for (var seed = 0; seed < 100; seed++) {
    final game = playFullGame(seed); // 시드 고정 → 재현 가능
    expect(game.phase, GamePhase.finished);
    if (game.winner != null) {
      // 승자의 손패는 실제로 승리 조건을 만족해야 한다
      expect(isWinningHand(game.winningHand!,
          meldCount: winner.meldCount), isTrue);
    }
  }
  expect(wins, greaterThan(50)); // 대부분은 승부가 나야 정상
});
```

It's not just checking "did it finish" — every step also checks **invariants**.

- Tile conservation: hand + revealed melds + river + wall must always add up to 136
- Hand size: `13 - 3 × number of revealed melds` while waiting, and only whoever's turn it is to discard gets +1

This simulation catches infinite loops, vanishing tiles, and hand-count mixups all by itself. Since the seed is fixed, a failure tells you exactly which run to reproduce, like `seed=17`.

## Troubleshooting: A Tsumo Winner Finishes Holding 14 Tiles

The first time I ran the simulation, it failed immediately.

```
Expected: <4>
  Actual: <5>
seed=0 seat=1
```

Tracing the cause, it wasn't an engine bug — **the test's invariant was wrong.** When you win by tsumo (completing with a tile you drew yourself), the game ends with the winner still holding the 14th tile. But the invariant assumed "everyone holds 13 tiles once the game ends."

```dart
// 츠모 승자는 14번째 패를 든 채 끝나므로 종료 후에는 승자만 +1 허용
final mayHoldExtra = game.phase == GamePhase.awaitingDiscard
    ? p.seat == game.current
    : game.phase == GamePhase.finished && p.seat == game.winner;
```

This was a good relearning: when a test fails, you should suspect "is the test's premise wrong?" just as much as "is the code wrong?" A domain rule (in mahjong, a tsumo winner's hand has 14 tiles) outranks the code.

## Summary

1. The game flow boils down to a 3-state machine (`awaitingDiscard` / `awaitingClaims` / `finished`)
2. The engine only validates rules; priority decisions go to the controller — so tests and the UI can share the same engine
3. Instead of shanten, the AI makes discard/claim decisions using a single potential score ("100 for a set, 20 for a partial")
4. 100 seeded auto-played games plus invariant checks validate the whole engine
5. A failing test's root cause can be the test's own premise, not the code

Next up is finally the screen. Pastel-toned UI, emoji tiles, and the real mahjong table layout built with `RotatedBox`, plus the animation of tiles flying around the table.
