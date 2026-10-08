---
title: 'Mahjong Joy Dev Log (4) — Pastel UI, a RotatedBox Mahjong Table, and Tile Animation'
date: '2026-07-10'
publish_date: '2026-11-01'
description: Building a pastel-toned mahjong UI with pure Flutter widgets (no Flame), including a four-way RotatedBox table layout and TweenAnimationBuilder tile animations
tags:
  - Flutter
  - UI
  - Animation
  - Game Development
---

> **Mahjong Joy Series**
> 1. Planning Analysis and the Work Plan
> 2. Core Logic — The Win-Checking Algorithm
> 3. Building the Game Engine and AI
> 4. **Pastel UI and Tile Animation** ← this post
> 5. Score System and the Home Screen

## It Looks Like a Game Engine, But It's All Stock Widgets

The conclusion of this post upfront: **a turn-based board game UI doesn't need a game engine (Flame).** Everything, down to the tiles flying around in animation, was built with plain Flutter widgets. `Container`, `Stack`, `RotatedBox`, `TweenAnimationBuilder`. That's the whole list.

## Step 1: A Pastel Theme and Emoji Tiles

The plan's concept was "warm and cute visuals." I started by defining the mint/pink/cream palette as constants.

```dart
class Palette {
  static const mint = Color(0xFFA8E6CF);
  static const pink = Color(0xFFFFB3C1);
  static const cream = Color(0xFFFFF6E9);
  static const tableGreen = Color(0xFFD3F0E4);
  static const textBrown = Color(0xFF6B5B4D);
}
```

Instead of Chinese characters, tiles are a combination of **numbers plus emoji symbols.** I didn't make a single image asset.

| Traditional mahjong | Mahjong Joy | Symbol |
|---|---|---|
| Man (characters) | Tangerine | 🍊 |
| Pin (circles) | Bear | 🐻 |
| Sou (bamboo) | Flower | 🌸 |
| 7 honor tiles | Weather | ☀️ ☁️ 🌧️ ❄️ 🌙 ⭐ 🌈 |

The advantage of emoji tiles is clear: no asset pipeline, renders on every platform, and sizing is a single `fontSize` away. For the prototype stage, it's the best possible choice. The opposing players are also emoji avatars — 🐰 rabbit, 🧸 teddy bear, 🐱 kitty.

## Step 2: The Controller — An Auto-Advancing Loop and a Generation Token

Between the UI and the engine sits a `ChangeNotifier` controller. The core of it is an auto-advancing loop called `_drive()`. AI turns run forward automatically with a delay, but **at the point where human input is needed, the loop stops and returns.**

```dart
Future<void> _drive() async {
  final gen = _generation; // 세대 토큰
  while (!_disposed && gen == _generation && !isFinished) {
    if (game.phase == GamePhase.awaitingDiscard) {
      if (game.current == humanSeat) return; // 사람 입력 대기

      await Future.delayed(_aiDelay);
      if (_disposed || gen != _generation) return; // 그 사이 새 판 시작?

      // AI 턴 진행...
    }
  }
}
```

`_generation` is an integer that increments every time a new game starts. If the generation has changed after an `await`, that stops **a zombie loop from the previous game reaching in and manipulating a new game.** For any combination of async loop plus restartable state, this pattern (a generation token) is close to mandatory.

## Step 3: Building a Real Mahjong Table with RotatedBox

The first version's center table just listed discarded tiles in a plain vertical list, but looking at the screenshot, it felt bare and not very mahjong-like. I changed it so that, like a real mahjong table, **each player's river (discard area) sits in front of their own seat, and opponents' tiles are rotated to face their direction.**

```dart
Stack(children: [
  Align(alignment: Alignment.topCenter,
      child: RotatedBox(quarterTurns: 2, child: _River(seat: 2))), // 맞은편: 180도
  Align(alignment: Alignment.centerLeft,
      child: RotatedBox(quarterTurns: 1, child: _River(seat: 3))), // 왼쪽: 90도
  Align(alignment: Alignment.centerRight,
      child: RotatedBox(quarterTurns: 3, child: _River(seat: 1))), // 오른쪽: -90도
  Align(alignment: Alignment.bottomCenter, child: _River(seat: 0)), // 나
  Center(child: /* 남은 패 수 칩 */),
])
```

Two tricks I picked up here.

**① Build every river from "my point of view" and rotate the whole thing.** The `_River` widget doesn't know about direction. It's built purely from the bottom player's perspective — rows of 6 tiles, with new rows growing upward (toward the center). `RotatedBox` handles direction on its own. No coordinate math needed.

**② `verticalDirection: VerticalDirection.up`.** To have the first row sit near the player and new rows stack toward the center, you just flip the Column. I learned this property exists for the first time while doing this.

```dart
Column(
  verticalDirection: VerticalDirection.up, // 첫 줄이 아래
  children: rows,
)
```

## Step 4: Tile Animation — TweenAnimationBuilder and the Key Trick

The requirement: "make it look like the tiles are moving." Before reaching for an `AnimationController`, I first tried **how far implicit animation could get me.** Conclusion: far enough.

```dart
class TileAppear extends StatelessWidget {
  final Widget child;
  final Offset from; // 시작 오프셋. Offset(0, 40) = 아래에서 날아옴

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOutCubic,
      child: child,
      builder: (context, t, child) => Opacity(
        opacity: t,
        child: Transform.translate(
          offset: Offset(from.dx * (1 - t), from.dy * (1 - t)),
          child: Transform.scale(scale: 1.25 - 0.25 * t, child: child),
        ),
      ),
    );
  }
}
```

`TweenAnimationBuilder` **automatically plays from 0 to 1 when the widget is mounted.** So how do you trigger the animation only for "a newly discarded tile"? That's where the **key trick** comes in.

```dart
TileAppear(
  key: ValueKey('river-$seat-${tiles.length}'), // 패 수가 바뀌면 새 위젯
  from: const Offset(0, 44), // 플레이어 쪽에서 날아온다
  child: tile,
)
```

When a discard is added, `tiles.length` changes → the key changes → Flutter treats it as a brand-new widget, so the animation plays again. If a rebuild happens with the same state, the key stays the same, so it doesn't replay. **A single key declaratively controls when the animation plays.**

As a bonus, because every river is built from my own point of view and then rotated, a single `from: Offset(0, 44)` (entering from below) means **tiles fly in from each player's own side, regardless of direction.** The rotation carries the offset direction along with it.

## Step 5: A Bug the Screenshot Caught — Separating the Just-Drawn Tile

While running the game, I noticed something odd in a screenshot. There's a feature that highlights the tile you just drew, but **two tiles of the same kind were being highlighted at once.** The cause was this code.

```dart
highlighted: myTurn && tile == gc.game.drawnTile // 같은 종류면 전부 true!
```

`Tile`'s `==` compares by kind, so if you draw a 7🌸 and already have a 7🌸 in hand, both get highlighted. The fix follows real mahjong convention: **show the drawn tile separated to the right of the hand.** Only one tile gets `remove`d from the hand list, and the highlight plus entry animation go on that separated slot instead. A case where fixing a bug actually made the UX more true to mahjong.

## Troubleshooting Notes

**① Pending timer errors in widget tests.** An app whose AI turns run on `Future.delayed` fails tests if a timer is still alive when the test ends. Fix: advance the test with a `tester.pump(duration)` loop up to "the point where it's waiting for human input" (a state with no timers), then end it.

**② Flutter web headless screenshots.** For layout verification I wanted headless Chrome screenshots, but the debug web server (`flutter run -d web-server`) produced only a blank screen. **Serving a release build (`flutter build web`) from a static server** fixed it.

```bash
flutter build web
python3 -m http.server 8124 -d build/web &
chrome --headless=new --window-size=1500,1000 \
  --virtual-time-budget=30000 --screenshot=game.png http://localhost:8124
```

`--virtual-time-budget` is an option that fast-forwards page loading with virtual time, but it was useless in debug mode, where CanvasKit loading is slow.

## Summary

1. A turn-based board game UI is fine with stock widgets — no Flame needed
2. Emoji tiles = zero-asset prototyping
3. For an async auto-advancing loop, a generation token prevents zombie loops
4. Direction-dependent UI: "build it from my point of view, then rotate with RotatedBox" — no coordinate math required
5. `TweenAnimationBuilder` plus the `ValueKey` trick declaratively controls entry animations
6. Verify headless screenshots against a release web build

The next post is the last one. I'll bolt on the scoring system (full payment for a ron, split payment for a tsumo, double for a concealed hand), the home screen, and the rulebook screen to finish "the game."
