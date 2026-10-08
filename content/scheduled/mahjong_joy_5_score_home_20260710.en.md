---
title: 'Mahjong Joy Dev Log (5, Final) — Finishing the Game with a Scoring System and Home Screen'
date: '2026-07-10'
publish_date: '2026-11-02'
description: Porting mahjong's ron/tsumo payment structure over without any yaku, then finishing the game with a home screen and an in-app rulebook
tags:
  - Flutter
  - Dart
  - Game Development
  - Game Design
---

> **Mahjong Joy Series**
> 1. Planning Analysis and the Work Plan
> 2. Core Logic — The Win-Checking Algorithm
> 3. Building the Game Engine and AI
> 4. Pastel UI and Tile Animation
> 5. **Score System and the Home Screen** ← this post (final)

## "Win One Round and You're Done" Isn't a Game

Strictly speaking, what existed through part 4 was a "single-round demo." Win or lose, there was only a replay button. What creates tension in a game is **stakes.** So I brought over the real mahjong payment structure, and since there are no yaku, I used a fixed score value.

## Step 1: Scoring Design — Porting Only Mahjong's Payment Structure

The most fun tension in real mahjong comes from the rule that "if I win off a tile you discarded (ron), you pay for all of it." I only ported over that structure.

| Situation | Payment |
|---|---|
| **Ron** (completing off someone else's discard) | The discarder pays the **full amount** |
| **Tsumo** (completing by drawing it yourself) | The other 3 players **split it evenly** |
| **Menzen bonus** (completing with no claims at all) | **Double** score |
| Draw | No change |

I settled on these numbers: a win is worth a **fixed 3,000 points** (6,000 for a concealed/menzen hand), everyone **starts with 10,000 points**, a match is **8 rounds**, and it ends immediately if anyone drops to 0 or below.

The menzen double is a small rule but it has a big effect. It creates the choice of "claim and finish quickly, or hold out alone for double." A rule that hands back one axis of strategy to a game that stripped out all the yaku.

## Step 2: MatchState — Settlement Logic Lives Outside the Engine

Just like splitting the engine and controller apart in part 3, I split scoring into **the single-round engine (`Game`) and the match scoreboard (`MatchState`).** `Game` only gained a record of the win type (`WinType.tsumo / ron`) and who discarded the winning tile (`ronLoser`); `MatchState` handles the entire settlement.

```dart
void applyGame(Game game) {
  final deltas = List<int>.filled(playerCount, 0);
  final w = game.winner;
  if (w != null) {
    final solo = game.players[w].melds.isEmpty; // 뺏어오기 없이 완성?
    final value = baseWinValue * (solo ? soloMultiplier : 1);

    if (game.winType == WinType.ron) {
      deltas[game.ronLoser!] = -value;        // 방총자 전액
    } else {
      final share = value ~/ (playerCount - 1); // 츠모 분담
      for (var i = 0; i < playerCount; i++) {
        if (i != w) deltas[i] = -share;
      }
    }
    deltas[w] = value;
  }
  // scores 반영, roundsPlayed++, lastResult 기록
}
```

The key point is keeping the `deltas` (per-seat change) on the result object. Showing "who paid how much" on the results screen needs more than just the final scores.

### Preventing Double Settlement

A round can end through several paths (human tsumo, AI tsumo, human ron, AI ron...). If you put settlement code in each path, sooner or later you'll settle twice by accident. The fix is to handle it in **a single choke point that every state change passes through.**

```dart
void _notify() {
  if (_disposed) return;
  // 판이 끝나는 모든 경로는 _notify를 거치므로 여기서 한 번만 정산
  if (game.phase == GamePhase.finished && !_resultApplied) {
    match.applyGame(game);
    _resultApplied = true;
  }
  notifyListeners();
}
```

## Step 3: The Results Screen — The Settlement Breakdown Is the Story

When a round ends, an overlay shows the settlement breakdown. The wording changes depending on the win type.

- Ron: "🐰 Rabbit completed the hand off your discard — paying 3,000 points in full"
- Tsumo: "Completed by drawing it themselves — split 3,000 points between the three of you"
- Menzen: "💫 Finished solo with no claims at all! Double score"

Each seat shows `+3,000` / `-1,000` colored mint (gain) or pink (loss), alongside the current running total. Once 8 rounds are done or someone goes bankrupt, it switches over to a final 🥇🥈🥉 ranking screen.

Formatting numbers with thousands separators is a one-line regex.

```dart
String _fmt(int n) => n.toString()
    .replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+$)'), (m) => '${m[1]},');
```

## Step 4: Home Screen and the Rulebook

Up to this point, launching the app went straight into a game. Adding a home screen (title, start game, rulebook) meant also cleaning up the Provider structure. I made `GameController` **scoped to the game screen's route, instead of app-wide.**

```dart
Navigator.of(context).push(MaterialPageRoute(
  builder: (_) => ChangeNotifierProvider(
    create: (_) => GameController(),
    child: const GameScreen(),
  ),
));
```

This way the controller gets disposed automatically when you leave the game screen, and every time you tap "start game" you get a clean new match. If I'd kept it global, I would have run into a "the previous game is still hanging around" bug.

On the rulebook screen, I **reused the actual in-game tile widgets** for the rule explanations. Showing run/triplet/pair examples with real tiles instead of text makes the explanation dramatically shorter. The score numbers aren't hardcoded either — they reference the `MatchState.baseWinValue` constant, so the rulebook automatically stays correct even if I rebalance things later.

## Troubleshooting: A Test That Taught Me About Game Balance

I wrote a test asserting "a match ends after 8 rounds," and it kept failing. Looking into it, it wasn't a bug — **ending early from bankruptcy before round 8 was the correct behavior.** Losing 3,000–6,000 points at a time, 10,000 points runs out in three or four rounds.

```dart
// 수정된 테스트: 종료 사유는 둘 중 하나
expect(
  match.roundsPlayed == MatchState.totalRounds ||
      match.scores.any((s) => s <= 0),
  isTrue,
);
```

Fixing the test also gave me a feel for the balance. If bankruptcy-ending feels too frequent, bumping the starting score up to 20,000 fixes it — since I designed it so that's a single constant change. **A simulation test doesn't just catch bugs; it hands you game-balance data too.**

One more thing: a widget test on the rulebook screen had `find.text('💰 점수')` failing, because of `ListView`'s lazy rendering — it simply doesn't build items that are off-screen. Scrolling with `tester.scrollUntilVisible()` before asserting fixes it.

## Series Wrap-Up — The Whole Arc at a Glance

Summarizing the five-part journey:

1. **Planning**: the concept of mahjong with no yaku, resolving a document conflict, and defining completion criteria per phase
2. **Core logic**: win checking via 34-kind integer encoding plus recursive decomposition, trap cases locked down with unit tests
3. **Engine and AI**: a 3-state machine, engine/controller separation, a potential-score AI, a 100-game simulation
4. **UI**: emoji tiles, a RotatedBox mahjong table, the `TweenAnimationBuilder` plus key trick
5. **Finishing touches**: porting mahjong's payment structure, route-scoped state management, and the rulebook

The final result: 37 tests, a structure with pure Dart logic cleanly separated from the UI, zero image assets, and a single external package (provider). You can play it straight in the browser with `flutter run -d chrome`, and the same code builds for iOS/Android.

What's left on the roadmap (Phase 4) is sound effects and background music, a tutorial, collectible tile skins, and defensive AI logic (discarding away from tiles opponents might be waiting on). Defensive AI in particular now matters as a difficulty knob now that the scoring system is in place.

Even with every yaku stripped away, the feel of eyeing someone else's discard and shouting "complete!" stayed exactly the same. It turns out the fun of mahjong was never in the yaku — it was in the matching itself.
