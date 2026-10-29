---
title: 'Mahjong Joy Dev Log (2) — Cracking the Win-Checking Algorithm with Recursion'
date: '2026-07-10'
publish_date: '2026-10-30'
description: Implementing a recursive Dart algorithm that checks whether 14 tiles decompose into four sets and a pair, with unit tests to catch the tricky edge cases
tags:
  - Flutter
  - Dart
  - Algorithms
  - Game Development
  - Recursion
---

> **Mahjong Joy Series**
> 1. Planning Analysis and the Work Plan
> 2. **Core Logic — The Win-Checking Algorithm** ← this post
> 3. Building the Game Engine and AI
> 4. Pastel UI and Tile Animation
> 5. Score System and the Home Screen

## Logic Before UI

Starting game development, the temptation is to draw the screen first. This time I flipped the order: **build the pure Dart logic with no UI at all, and get it fully nailed down with `flutter test`.** Thanks to that decision, I never had to second-guess "is the logic wrong?" during the entire UI phase that followed.

This post covers three things.

1. The tile model and deck (generating, shuffling, and dealing the 136 tiles)
2. **Win checking** — does a 14-tile hand split into 4 sets of 3 and a pair (3-3-3-3-2)?
3. Computing waiting tiles and claim eligibility

## Step 1: The Tile Model — 34 Kinds as a Single Integer

There are 34 kinds of mahjong tiles. 3 number suits (man/pin/sou) × 9 = 27 kinds, plus 7 honor tiles. 4 of each, 136 tiles total. The key move was **encoding each tile as an integer key from 0 to 33.**

```dart
enum Suit { man, pin, sou, honor }

class Tile implements Comparable<Tile> {
  final Suit suit;
  final int rank; // 수패 1~9, 자패 1~7

  /// 34종 타일을 0~33으로 인코딩. 정렬·판정 로직의 기본 키.
  int get key => suit.index * 9 + (rank - 1);

  static Tile fromKey(int key) =>
      Tile(Suit.values[key ~/ 9], (key % 9) + 1);

  @override
  int compareTo(Tile other) => key - other.key;
}
```

The nice part of this encoding: **checking for consecutive numbers comes down to comparing `key + 1`, `key + 2`.** If you also treat the hand as a count array shaped like `List<int> counts = List.filled(34, 0)`, the recursion only needs to increment/decrement — no copying.

Building and dealing the deck is straightforward.

```dart
List<Tile> buildDeck() {
  final deck = <Tile>[];
  for (var key = 0; key < Tile.kindCount; key++) {
    final tile = Tile.fromKey(key);
    for (var i = 0; i < 4; i++) {
      deck.add(tile);
    }
  }
  return deck;
}
```

I made the `deal()` function take an injected `Random`. Fixing the seed in tests, like `Random(42)`, gives you **reproducible games** — which became the foundation for the simulation tests later on.

## Step 2: Win Checking — Remove a Pair Candidate, Then Recursively Decompose

Problem definition: does a 14-tile hand decompose **completely** into "4 sets (three consecutive tiles, or three of a kind) + 1 pair"?

The algorithm has two stages.

1. Try removing each possible pair candidate (two of the same tile) one at a time
2. Recursively check whether the remaining 12 tiles split cleanly into 4 sets

```dart
bool isWinningHand(List<Tile> tiles, {int meldCount = 0}) {
  final setsNeeded = 4 - meldCount;
  if (setsNeeded < 0 || tiles.length != setsNeeded * 3 + 2) return false;

  final counts = List<int>.filled(Tile.kindCount, 0);
  for (final t in tiles) {
    counts[t.key]++;
    if (counts[t.key] > 4) return false; // 같은 패는 4장까지만
  }

  for (var key = 0; key < Tile.kindCount; key++) {
    if (counts[key] < 2) continue;
    counts[key] -= 2; // 머리 후보 제거
    if (_decomposeIntoSets(counts, setsNeeded)) {
      counts[key] += 2;
      return true;
    }
    counts[key] += 2; // 백트래킹
  }
  return false;
}
```

You'll notice the `meldCount` parameter — it's there to subtract, from the sets you still need to find in hand, however many sets you've already revealed by claiming. If you've revealed 2 sets, you only need to find 2 more sets plus the pair in the remaining 8 tiles.

The core idea behind the recursive decomposition is this: **once sorted, the tile with the smallest key must always be the "start" of some set.** So there are only ever two branches.

```dart
bool _decomposeIntoSets(List<int> counts, int setsNeeded) {
  if (setsNeeded == 0) return true;

  var key = 0;
  while (key < Tile.kindCount && counts[key] == 0) {
    key++;
  }
  if (key == Tile.kindCount) return false;

  // 경우 1: 트리플
  if (counts[key] >= 3) {
    counts[key] -= 3;
    if (_decomposeIntoSets(counts, setsNeeded - 1)) { /* 복원 후 */ return true; }
    counts[key] += 3;
  }

  // 경우 2: 스트레이트 (수패만, rank 7까지 시작 가능)
  final tile = Tile.fromKey(key);
  if (!tile.isHonor && tile.rank <= 7 &&
      counts[key + 1] > 0 && counts[key + 2] > 0) {
    // key, key+1, key+2를 하나씩 빼고 재귀 → 실패 시 복원
  }

  return false;
}
```

If the smallest tile in the hand can't be part of a triplet and can't start a run either, that hand can never be completed. This single observation shrinks the search space dramatically. Honor tiles are blocked from the run branch with the `isHonor` check, and since there's no run that starts on 8 or 9, the `rank <= 7` condition takes care of number tiles too.

## Step 3: Waiting Tiles — Reusing the Win-Checking Function

The feature that tells you "which tile would complete my hand?" (the plan's "remaining tile guide") turns out to be basically free. **Just try all 34 kinds.**

```dart
List<Tile> waitingTiles(List<Tile> hand, {int meldCount = 0}) {
  final waits = <Tile>[];
  for (var key = 0; key < Tile.kindCount; key++) {
    if (inHand[key] >= 4) continue; // 이미 4장 다 들고 있으면 불가능
    final candidate = Tile.fromKey(key);
    if (isWinningHand([...hand, candidate], meldCount: meldCount)) {
      waits.add(candidate);
    }
  }
  return waits;
}
```

34 checks is plenty cheap. Since the win-checking function is fast (count array plus pruning), calling it every single turn costs nothing.

Claim checking (`claimableSets`) uses a similar trick. For a discarded tile, you only need to check for a triplet (two matching tiles already in hand) and the three possible run positions (x-2·x-1, x-1·x+1, x+1·x+2).

## Step 4: Locking Down Trap Cases with Tests

With logic like this, "looks like it's working?" is the most dangerous state to be in. I pinned down the trap cases as unit tests.

```dart
test('자패는 스트레이트가 될 수 없다', () {
  // 동남서를 몸통으로 취급하면 안 됨
  expect(isWinningHand(hand('z123 m456 m789 p111 s99')), isFalse);
});

test('다중 해석 손패: 순정구련보등 + 9', () {
  // 1112345678999 + 9: 여러 분해 경로 중 하나만 성립해도 승리
  expect(isWinningHand(hand('m1112345678999 m9')), isTrue);
});

test('연속 쌍 함정: 22334455는 스트레이트 2개로 분해 가능', () {
  expect(isWinningHand(hand('m223344 m556677 s88')), isTrue);
});
```

The second case matters most. `1112345678999` decomposes into `123 456 789 999` if you pick `11` as the pair — but fails if you pick `99`. This case checks **whether the algorithm backtracks to try another pair candidate after the first attempt fails.** A sloppy greedy algorithm falls apart right here.

It also pays to build a notation just for tests. A single helper that builds a hand from a string, like `hand('m123 p456 z11')`, massively improves test readability.

## Summary

1. Encoding the 34 tile kinds as integer keys 0–33 makes both consecutive-tile checks and count arrays simple
2. Win checking = remove a pair candidate → recursively decompose the rest into triplets/runs starting from the smallest key
3. The observation "the smallest tile must always start a set" compresses the branching down to 2 options
4. Waiting-tile computation comes free by brute-forcing all 34 kinds
5. Trap hands that require backtracking are pinned down with unit tests (all 25 passing)

Next up, I'll layer a **4-player turn loop game engine and three AI opponents** on top of this logic. The highlight is a simulation test where 4 AI players auto-play 100 full games to validate the engine.
