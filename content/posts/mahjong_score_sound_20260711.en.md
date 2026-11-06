---
title: 'Adding Scoring and Sound Effects to a Flutter Mahjong Game — a Receipt Animation and Hand-Synthesized WAVs'
date: '2026-07-11'
publish_date: '2026-11-07'
description: Designing a kid-friendly bonus scoring system for a simple mahjong game, then synthesizing sound effects in Python with no external assets and playing them back with audioplayers
tags:
  - Flutter
  - Dart
  - audioplayers
  - Game Development
---

# Adding Scoring and Sound Effects to a Flutter Mahjong Game

I added two things to "Mahjong Joy," the simple mahjong game I'm building as a hobby: a **scoring system** and **sound.** I'd already built win-checking, but winning just meant "you got 3,000 points" and that was it — kind of flat. Half the fun of mahjong comes from "how beautifully did my hand come together," and the game wasn't showing that off through scoring at all.

The catch is that real mahjong scoring (yaku, han, fu...) is hard even for adults. This game's whole concept is "simple mahjong that keeps only the fun of matching tiles," so the scoring system also had to be **understandable at a glance from a single receipt.**

## Scoring Design: Add First, Then Multiply

After some thought, I organized the rules into exactly two groups.

> **Final score = (base 100 points + additive bonuses) × multiplicative bonuses**

| Bonus | Condition | Reward |
|---|---|---|
| 🌈 Weather Set | A set of 3 weather tiles (sun·cloud·star...) | +50 points each |
| 💪 I Drew It Myself! | Completed with a self-drawn tile (tsumo) | +100 points |
| 📏 All Straights | All 4 sets are runs | +200 points |
| 🎣 Last Catch | Completed with 5 or fewer tiles left in the wall | +200 points |
| 🔒 On My Own | Completed with no claims at all | ×2 |
| 🌗 Half and Half | One number suit plus weather tiles | ×2 |
| 🎲 All Triples | All 4 sets are triplets | ×3 |
| 🎨 One Color | Completed using only one number suit | ×5 |

This swaps traditional mahjong yaku — chinitsu (one color), honitsu (half-and-half), toitoi (all triplets) — for intuitive names. Instead of hard-to-parse terminology, the name itself tells you why you got the points.

Splitting it into "easy things add, hard things multiply" means the explanation for the calculation order fits in one sentence: **add first, then multiply!**

## Step 1: The Receipt Data Structure

I designed the score result with the UI presentation already in mind. The key idea is that a `ScoreLine` holds exactly one of `plus` (additive) or `times` (multiplicative), never both.

```dart
/// 영수증 한 줄. plus와 times 중 정확히 하나만 갖는다.
class ScoreLine {
  final String emoji;
  final String name;
  final String detail; // 왜 받았는지 한 줄 설명
  final int? plus;
  final int? times;

  const ScoreLine.plus(this.emoji, this.name, this.detail, int score)
      : plus = score, times = null;

  const ScoreLine.times(this.emoji, this.name, this.detail, int multiplier)
      : plus = null, times = multiplier;
}

class ScoreResult {
  final List<ScoreLine> lines; // 더하기 → 곱하기 순서
  final int total;

  ScoreResult(this.lines) : total = _sumUp(lines);

  /// count번째 줄까지 반영한 소계 (영수증 연출용)
  int subtotal(int count) => _sumUp(lines.take(count).toList());
}
```

`subtotal()` is the key piece. To animate a receipt where the running total ticks up as each line appears one at a time, you need to be able to compute "the subtotal through line n."

## Step 2: Hand-Shape Checking Logic

"All Straights" and "All Triples" can only be determined by actually decomposing the completed 14 tiles. At first I set out to write a recursion enumerating every possible decomposition, then realized both checks have a much simpler path.

**All Triples** doesn't need recursion at all. The tile-count distribution alone tells you:

```dart
/// "머리 1쌍 + 나머지 전부 트리플"인지.
/// 조건: 모든 종류의 장수가 0/2/3장이고, 2장인 종류가 정확히 하나.
bool _isAllTripleHand(List<int> counts) {
  var pairs = 0;
  for (final c in counts) {
    if (c == 2) {
      pairs++;
    } else if (c != 0 && c != 3) {
      return false;
    }
  }
  return pairs == 1;
}
```

**All Straights** works by trying each pair candidate in turn, then checking whether the rest can be exhausted using only runs. Thanks to the property that "the smallest number tile must always start a run," this resolves greedily with no backtracking needed:

```dart
bool _decomposeRunsOnly(List<int> counts) {
  for (var key = 0; key < 27; key++) {
    while (counts[key] > 0) {
      final rank = key % 9 + 1;
      if (rank > 7 || counts[key + 1] == 0 || counts[key + 2] == 0) {
        return false;
      }
      counts[key]--;
      counts[key + 1]--;
      counts[key + 2]--;
    }
  }
  // ...
}
```

Building the whole scoring logic as a pure function (`calculateScore`), separate from the UI, made it easy to attach unit tests. I pinned down cases like "an All-Weather Jackpot (every tile is a weather tile) scores (100+200)×2×3×5 = 9,000" as a test too.

## Step 3: Synthesizing Sound Effects Directly in Python

The first obstacle in sound work turns out to not be code at all — it's **sourcing assets.** Digging through free sound-effect sites, checking licenses, finding the tone doesn't match and starting over... it quietly eats a lot of time.

So this time I **synthesized the sound effects directly with Python's standard library.** The `wave` and `math` modules are enough. Layer an exponential decay envelope over a sine wave and you get something like a chime:

```python
def tone(freq, dur, vol=0.5, attack=0.005, decay=None, harmonics=(1.0, 0.25)):
    """부드러운 종소리 느낌: 기본파 + 약한 배음, 지수 감쇠."""
    n = int(SR * dur)
    out = []
    for i in range(n):
        t = i / SR
        env = min(1.0, t / attack) * math.exp(-3.5 * t / decay)
        s = sum(amp * math.sin(2 * math.pi * freq * h * t)
                for h, amp in enumerate(harmonics, start=1))
        out.append(vol * env * s)
    return out

# 영수증 항목 체크 '딩' — G6 음의 맑은 종소리
write_wav("ding", tone(1568.0, 0.28, vol=0.45, decay=0.25,
                       harmonics=(1.0, 0.35, 0.12)))
```

This produced 7 sound effects:

| File | Use | How it's made |
|---|---|---|
| tap.wav | Discard "tap" | Noise + 220Hz pulse, fast decay |
| draw.wav | Draw blip | 520→940Hz frequency sweep |
| claim.wav | Claim "chirp" | Two rising notes, E5→B5 |
| ding.wav | Receipt line check | G6 chime |
| total.wav | Total score reveal | C6-E6-G6-C7 rising 4-note run |
| win.wav | Victory fanfare | C5-E5-G5-C6 arpeggio plus a low chord |
| lose.wav | Loss/draw | Gentle descent, G4→Eb4 |

Picking pitches in a chord relationship (do-mi-sol) makes it sound far more like "game audio" than randomly-picked frequencies. The script lives in the project as `tool/gen_sfx.py`, so if a tone doesn't feel right, just tweak the numbers and regenerate. Zero license worries either.

## Step 4: Playback with audioplayers

For short sound-effect playback in Flutter, I used the `audioplayers` package.

```yaml
# pubspec.yaml
dependencies:
  audioplayers: ^6.1.0

flutter:
  assets:
    - assets/sfx/
```

Since sound effects can overlap (e.g. a claim notification right after a discard), I built a pool of 4 players and cycle through them:

```dart
class SoundService {
  SoundService._();
  static final SoundService instance = SoundService._();

  /// 음소거 토글. UI가 구독해 아이콘을 갱신한다.
  final ValueNotifier<bool> enabled = ValueNotifier(true);

  /// 첫 재생 시 생성 (음소거 상태나 테스트에서는 아예 만들지 않는다)
  List<AudioPlayer>? _pool;
  int _next = 0;

  Future<void> _play(String name, {double volume = 1.0}) async {
    if (!enabled.value) return;
    final pool = _pool ??= List.generate(4, (_) => _newPlayer());
    final player = pool[_next];
    _next = (_next + 1) % pool.length;
    try {
      await player.stop();
      await player.play(AssetSource('sfx/$name.wav'), volume: volume);
    } catch (_) {
      // 효과음은 실패해도 게임 진행에 영향 없음
    }
  }
}
```

Two details worth calling out:

1. **The player pool is lazily created.** The widget-test environment doesn't have an audio plugin, so just creating an `AudioPlayer` can itself be a problem. In tests, turning off `enabled` means the pool never gets created at all.
2. **Mute is a `ValueNotifier`,** so the game screen's 🔊 toggle button subscribes through `ValueListenableBuilder`. It becomes cleanly reactive without needing a state management library.

I kept sound code out of the game engine (pure Dart logic) entirely and only called it from the UI controller. Logic tests stay uncontaminated by sound.

## Step 5: The Receipt Animation

Throwing the score up as a bare number isn't fun. When a game ends, a 🧾 receipt appears, and every 0.55 seconds a new line slides in with a ding sound while the running subtotal rolls upward. At the end, the total appears with a fanfare, bouncing in with `Curves.elasticOut`.

The core structure is `Timer.periodic` plus `setState`:

```dart
void _tick() {
  if (_revealed < widget.score.lines.length) {
    setState(() {
      _revealed++;
      _prevSubtotal = _subtotal;
      _subtotal = widget.score.subtotal(_revealed);
    });
    SoundService.instance.ding();
  } else {
    _timer?.cancel();
    setState(() => _showTotal = true);
    SoundService.instance.total();
  }
}
```

The rolling subtotal number is just one `TweenAnimationBuilder`. Keying it on the subtotal value means the animation restarts from the old value to the new one every time the value changes:

```dart
TweenAnimationBuilder<double>(
  key: ValueKey(_subtotal),
  tween: Tween(begin: _prevSubtotal.toDouble(), end: _subtotal.toDouble()),
  duration: const Duration(milliseconds: 350),
  builder: (context, v, _) => Text('${v.round()}점', /* ... */),
)
```

The small discovery from this work: you don't need to manage an `AnimationController` by hand for an effect like this — `TweenAnimationBuilder` is plenty.

## Troubleshooting

### A "Timer is still pending" Error in Widget Tests

Adding `Timer.periodic` to the receipt risked breaking the existing smoke tests. `testWidgets` fails a test if a timer is still alive when it ends. The results overlay (= the receipt's timer) appears the instant a game ends, and if the test just ends right there, the timer is left pending.

The fix was simple: **swap in an empty widget at the end of the test** so `State.dispose()` gets called and the timer gets cleaned up:

```dart
Future<void> tearDownTree(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.pump();
}
```

### A Division Problem with Tsumo Payment Splits

Rescaling scores to units of 100 created a new problem. On a tsumo (self-drawn completion), the other 3 players split the payment — but 400 points ÷ 3 doesn't divide evenly. Rounding down with `value ~/ 3`, like before, breaks score conservation (everyone's deltas need to sum to zero).

I settled on **rounding up the split and having the winner receive the sum of what's paid**:

```dart
final share = (value / (playerCount - 1)).ceil();
// 승자는 share × 3을 받는다 → 합계 항상 0
```

The winner receives up to 2 extra points this way, but that's better than breaking total conservation. Pinning down a test (`deltas.reduce((a,b) => a+b) == 0`) for this gives peace of mind during future refactors.

### macOS Build Failure Without Xcode

`flutter build macos` failed with `xcrun: unable to find utility "xcodebuild"`. Without Xcode, a macOS/iOS build containing a native plugin (audioplayers) just isn't possible. I used `flutter build web` for integration checks instead, and did the actual install on an Android phone connected over USB:

```bash
flutter build apk --release
flutter install -d <기기ID> --release
```

## Summary

The flow of today's work at a glance:

1. **Scoring design** — simplified into two groups, "additive bonuses" and "multiplicative bonuses"
2. **Pure-function scoring logic** — hand-shape checks minimize recursion via count-distribution checks and a greedy algorithm
3. **Hand-synthesized sound effects** — sine waves plus exponential decay via Python's `wave` module, zero license worries
4. **audioplayers integration** — a lazily-created player pool, `ValueNotifier` mute toggle
5. **The receipt animation** — `Timer.periodic` plus `TweenAnimationBuilder` for sequential line reveals and a rolling subtotal

Adding score and sound changed how finished the game felt, dramatically. The "receipt sliding down line by line with dings" effect in particular had the biggest felt impact relative to the amount of code it took. If you're building a game, it's worth investing time in how you present scoring. When and how you reveal numbers is half the fun.
