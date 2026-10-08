---
title: "Adding a Turn Timer UI to a Flutter Mahjong Game — an Invisible Time Limit Doesn't Exist"
date: '2026-07-17'
publish_date: '2026-12-09'
description: Making the 15-second online-match time limit visible as an on-screen countdown, with the last 5 seconds shown as big red numbers for tension (Mahjong Round 1.1.0)
tags:
  - Flutter
  - Dart
  - Game Development
  - Widget Testing
  - LAN Multiplayer
---

## The Problem: There's a Time Limit, But Nobody Knows About It

My simple mahjong game "Mahjong Round" has LAN multiplayer. If one person sits on a tile without acting, the whole room freezes — so I'd already built logic where the host auto-discards the tile you just drew after 15 seconds.

But once I actually playtested it on three phones, this feedback came back:

> "I can't see any timer, and then suddenly my tile just gets discarded automatically. I thought I'd pressed something wrong."

Fair point. **The fact that a time limit even existed wasn't shown anywhere on screen.** From the player's side, it feels like a bug, not a rule. Flip that around, though: if the time is *visible*, the auto-discard turns from a "penalty" into "tension." So for 1.1.0, I decided to change this:

- Show the remaining time on screen once it's my turn
- For the last 5 seconds, count down with **big red numbers** dead center on screen (for tension)

Skipping to the result: the logic barely changed at all — it got solved with **a single display-only widget.** But along the way I picked up a design principle and dug out a hidden bug, and that's what this post is about.

## Design Principle: Truth Lives on the Host, the UI Only Displays

This game's network architecture has "the host is the one and only referee." The game engine only runs on the host; clients just send actions and draw whatever state (view) they receive for their own perspective. The 15-second forced discard is handled by a `Timer` on the host too.

```dart
// host_session.dart — 진짜 시간제한은 여기 있다
void _armDiscardTimer() {
  final key = (game.current, game.wallCount);
  if (_discardWaitKey == key) return; // 같은 턴에 중복으로 걸지 않기
  _discardWaitKey = key;
  _discardTimer?.cancel();
  _discardTimer = Timer(discardTimeout, () => _onDiscardTimeout(key));
}
```

There's a tempting idea here: "should the client also auto-discard once its own UI timer hits zero?" But then **truth would live in two places.** If network latency throws the two timers out of sync, the host and the client could end up discarding different tiles — a race.

So I made the new timer widget strictly **display-only.** When it hits zero, it just stops and waits for the host to act. Once the host force-discards, state updates and the widget naturally disappears.

## Step 1: Exposing a "Time Limit" on the Controller Interface

The UI uses the same `TableController` interface for local AI matches, the LAN host, and LAN clients. I added one getter to it.

```dart
// table_controller.dart
/// 내 버리기 차례의 제한시간 (초과하면 호스트가 자동으로 버린다).
/// UI가 카운트다운을 띄우는 데 쓴다. null = 제한 없음 (로컬 AI 대전).
Duration? get discardTimeLimit => null;
```

The key point is that the **default is `null` (no limit).** A relaxed solo match against AI shouldn't have a timer, so only the networked controllers override it.

```dart
// host_session.dart
@override
Duration? get discardTimeLimit => discardTimeout;
```

The client side was trickier, since the protocol (the view message) doesn't carry a time-limit value. Changing the protocol would mean reinstalling on every test phone, so I solved it with a constant shared by both sides.

```dart
// protocol.dart — 호스트 강제 타이머와 클라이언트 카운트다운이 같은 값을 쓴다
const Duration turnTimeLimit = Duration(seconds: 15);
```

On the UI side, a single condition covers all three modes.

```dart
// game_screen.dart — Stack 안에
if (gc.isHumanDiscardTurn && gc.discardTimeLimit != null)
  _TurnTimer(
    key: ValueKey('turn-timer-${gc.game.wallCount}'),
    limit: gc.discardTimeLimit!,
  ),
```

## Step 2: The Timer Widget — A Badge Normally, Big Red Numbers for the Last 5 Seconds

The countdown itself is a plain `StatefulWidget` plus `Timer.periodic`. What's fun is how the display mode switches.

```dart
class _TurnTimerState extends State<_TurnTimer> {
  static const _urgentSeconds = 5;

  late int _remaining = widget.limit.inSeconds;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (_remaining <= 0) return; // 0에서 멈춤 — 강제 버리기는 호스트 몫
      setState(() => _remaining--);
    });
  }
  // ...
}
```

**15 to 6 seconds**: a small badge at the top center. Gives information without blocking the view.

```dart
Container(
  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
  decoration: BoxDecoration(
    color: Colors.white.withValues(alpha: 0.85),
    borderRadius: BorderRadius.circular(20),
    border: Border.all(color: Palette.mint, width: 1.5),
  ),
  child: Text('⏱ $_remaining', /* ... */),
)
```

**The last 5 seconds**: a 110pt red number dead-center on the table, "popping" once every second. I keyed `TweenAnimationBuilder` on the remaining seconds so the animation restarts from scratch every time the number changes.

```dart
TweenAnimationBuilder<double>(
  key: ValueKey(_remaining),          // 매 초 애니메이션 리셋
  tween: Tween(begin: 1.6, end: 1.0), // 크게 등장했다가 제자리로
  duration: const Duration(milliseconds: 250),
  curve: Curves.easeOutBack,
  builder: (context, scale, child) =>
      Transform.scale(scale: scale, child: child),
  child: Text(
    '$_remaining',
    style: const TextStyle(
      fontSize: 110,
      fontWeight: FontWeight.w900,
      color: Color(0xFFE53935),
      shadows: [ // 초록 테이블 위에서도 잘 보이게 흰 글로우
        Shadow(color: Colors.white, blurRadius: 24),
        Shadow(color: Colors.white, blurRadius: 48),
      ],
    ),
  ),
)
```

Don't forget to wrap the whole thing in `IgnorePointer` either. The centered number shouldn't block taps on your own hand — otherwise you get the even worse bug of "there's 5 seconds left and I can't tap my tiles."

## Step 3: A Real Bug I Found While Wiring Up the Timer

Adding UI exposes holes in the logic. Rereading the host's timeout handling:

```dart
// 수정 전
void _onDiscardTimeout((int, int) key) {
  // ...
  final drawn = game.drawnTile;
  if (drawn == null) return; // ← 뽑은 패가 없으면 그냥 포기?!
  game.discard(drawn);
}
```

In mahjong, when you claim a discarded tile to form a set, it becomes your turn to discard **without drawing a tile.** In that case `drawnTile` is `null`, and the timeout handler just returns, doing nothing. In other words, there was a hole where **sitting on your turn right after a claim would freeze the whole room forever.**

With the timer UI attached, this hole stands out even more — if the countdown hits zero and nothing happens, that's obviously broken. I fixed it to discard an AI-recommended tile instead.

```dart
// 수정 후 — 뽑은 패가 없으면(뺏어온 직후) AI 추천 패를 버린다
final p = game.players[game.current];
final tile = game.drawnTile ?? _ai.chooseDiscard(p.hand, p.meldCount);
_clearDiscardTimer();
game.discard(tile);
```

A "just attach the UI" task caught a game-freezing bug. That's what happens when you try to make the display and the actual behavior match up.

## Step 4: Widget Testing — Fast-Forwarding Time with a Fake Controller

The nice thing about Flutter widget tests is **fake time.** `tester.pump(Duration)` can wind the clock forward however far you want, so a test for a 15-second timer finishes in milliseconds in practice.

To verify just the timer without any networking, I made a test-only subclass that layers a time limit onto the local controller.

```dart
/// 네트워크 대전처럼 버리기 제한시간이 있는 컨트롤러 흉내
class _TimedController extends GameController {
  _TimedController({super.seed});

  @override
  Duration? get discardTimeLimit => const Duration(seconds: 15);
}

testWidgets('버리기 제한시간이 있으면 카운트다운이 보이고 마지막 5초는 크게 표시된다',
    (tester) async {
  final gc = _TimedController(seed: 7);
  await tester.pumpWidget(app(gc));

  expect(find.text('⏱ 15'), findsOneWidget);

  await tester.pump(const Duration(seconds: 10)); // 10초 순간이동
  expect(bigNumber('5'), findsOneWidget);         // 중앙 큰 숫자로 전환

  gc.humanDiscard(gc.human.hand.first);           // 버리면
  await tester.pump();
  expect(bigNumber('4'), findsNothing);           // 타이머도 사라진다
});
```

Adding that getter to the interface meant a single override line was enough to produce a test double.

## Troubleshooting

### 1. `find.text('5')` Matches 3 Widgets

I first wrote `expect(find.text('5'), findsOneWidget)` and it failed. The mahjong game screen has **tiles with the number 5 drawn on them.** Two 5-tiles in hand plus the timer number — 3 matches total.

Solved with a predicate finder that distinguishes by font size:

```dart
Finder bigNumber(String n) => find.byWidgetPredicate(
    (w) => w is Text && w.data == n && (w.style?.fontSize ?? 0) > 100);
```

### 2. `INSTALL_FAILED_UPDATE_INCOMPATIBLE`

Trying to build and install on the phone got rejected over a signature mismatch. A build installed under a different key had been left on there. While still in development, the answer is to uninstall and reinstall (app data gets wiped).

```bash
adb uninstall com.backdev.mahjonghanpan
adb install build/app/outputs/flutter-apk/app-release.apk
```

### 3. `INSTALL_FAILED_VERSION_DOWNGRADE`

A different error on the second phone. That phone had a build with versionCode 3, and the new build was 2. Fixed it by bumping the version in `pubspec.yaml` past the gap. **versionCode is allowed to skip ahead — it's just not allowed to go down.**

```yaml
# pubspec.yaml — 1.1.0+2가 아니라 +4로 (기존 최고 코드보다 크게)
version: 1.1.0+4
```

If the code is lower than what's already on Play Console, the store upload gets rejected too — so if you hit this error on a device, it's worth double-checking the store-side code as well.

## Summary

| What I did | File | Key point |
|---|---|---|
| Exposed the time limit | `table_controller.dart` | `Duration? get discardTimeLimit => null` — null means no timer |
| Shared the value | `protocol.dart` | The host's enforcement and the UI's display use the same constant |
| The timer widget | `game_screen.dart` | Display-only; the last 5 seconds show big red centered numbers with a scale animation |
| Fixed the freeze bug | `host_session.dart` | Discard an AI-recommended tile if there's no drawn tile |
| Tests | `app_smoke_test.dart` | Getter override for a test double, `pump` to fast-forward time |

Two lessons remain from this work.

1. **An invisible rule feels like a bug.** A time limit, an automatic action, a forced advance — any time the system does something on the player's behalf, it absolutely needs to be previewed first.
2. **In a distributed setup, there's only one timer.** Keep the truth (the forced discard) on the host, and keep the client timer strictly display-only. Let two clocks make the same decision, and sooner or later they'll disagree.

Next up, I might add a ticking sound effect for the last 5 seconds. Time to bring the tension to the ears too, not just the eyes. 🀄
