---
title: 'Building a Flutter Football Game from a Single Board Game Rulebook PDF'
date: '2026-07-11'
publish_date: '2026-11-09'
description: Turning Playbook Football's rulebook and cards into a dice-and-chart-driven AI opponent mobile game
tags:
  - Flutter
  - Dart
  - Game Development
  - Claude Code
  - Board Games
---

## I Wanted to Put a Board Game from My Drawer Into a Phone

I have fond memories of playing **Playbook Football**, a board game themed around American football, a while back. It's not a flashy graphics game — it's a thoroughly text-and-numbers game where the offense and defense each secretly play a card and roll dice to look up the outcome on a **chart** printed on the card.

- The offense has to advance 10 yards within 4 downs (offensive attempts)
- There are 9 offense cards total: 4 pass plays + 5 run plays
- There are 9 defense cards representing formations (4-3, nickel, blitz...), each giving die modifiers per type of offensive play
- The psychological battle of reading "will my opponent run a pass or a run?" is the heart of the game

The problem is that there isn't always someone around to play this with. So I decided to turn it into a **mobile game you can play solo against an AI opponent.** I had exactly two source materials: a Korean-translated rulebook PDF and a scanned PDF of the cards.

## Preparation

| Item | Content |
|---|---|
| Framework | Flutter 3.44 (Dart) |
| Input material | 1 rulebook PDF + a scanned card PDF (32 cards) |
| PDF processing | poppler (pdftoppm) + Python Pillow |
| Game mode | Single-player (vs. AI) |

The reason I chose Flutter is simple. It covers iOS/Android with one codebase, and for a UI like this game's, full of **custom drawing (the field, tactical diagrams)**, Flutter's `CustomPainter` fits well.

## Step 1. Transcribing the Card Charts into Data — the Most Tedious but Most Important Job

The real body of this game isn't actually the code — it's the **5×10 chart printed on the cards.** Every offense card has one of these tables attached.

- **Rows (5)**: the offense's ten-sided die result (9-10 / 7-8 / 5-6 / 3-4 / 1-2)
- **Columns (10)**: the sum of both teams' twelve-sided dice (2-3 / 4-5 / ... / 23-24)
- **Cell value**: yards gained (negative for a loss), or a special result — `I` (interception), `F` (fumble), `G` (successful goal), `X` (failure)

The resolution was too marginal to read the card scan PDF directly, so I converted it to 200dpi PNGs with poppler, cut it up into individual cards, and checked them one by one.

```bash
brew install poppler
pdftoppm -png -r 200 card_scan.pdf cards
```

```python
# Pillow로 3x3 그리드 크롭
from PIL import Image
im = Image.open('cards-1.png')
card = im.crop((x0, y0, x1, y1))  # 카드 한 장씩
card.save('def_1.png')
```

Data transcribed this way was carried over into Dart as a 2D array of strings. Since numbers and special characters are mixed together, keeping them as strings instead of forcing them into `int` and parsing only at lookup time ended up being the cleaner choice.

```dart
const shortPass = OffenseCard(
  id: 'short_pass',
  name: 'SHORT PASS',
  type: PlayType.pass,
  averageYards: 8.0,
  chart: [
    ['95', '59', '24', '21', '9', '8', '20', '24', '32', '86'],
    // ... 5행 10열
    ['9', '8', '0', 'F', '-1', '0', '-2', 'I', '-4', '5'],
  ],
);
```

**Lesson learned**: transcription work like this needs validation code built alongside it. Laying down unit tests up front — things like "every chart is 5 rows by 10 columns" or "cell values can only be a number or I/F/G/X/R" — caught any transcription mistakes immediately.

```dart
test('차트 셀은 숫자 또는 유효한 특수문자', () {
  final valid = RegExp(r'^(-?\d+|I|F|G|X|R)$');
  for (final c in offenseCards) {
    for (final row in c.chart) {
      for (final cell in row) {
        expect(valid.hasMatch(cell), true, reason: '${c.id}: $cell');
      }
    }
  }
});
```

## Step 2. The Game Engine — Pure Dart, No UI

I wrote the engine completely separate from Flutter widgets, in pure Dart. Representing the field as a 1D coordinate from 0 to 100 turned out to be enough.

```dart
enum Team { home, away }

extension TeamX on Team {
  /// 공격 진행 방향 (+1: 100쪽, -1: 0쪽)
  int get direction => this == Team.home ? 1 : -1;
}
```

The core resolution logic follows the rules exactly. The defense card applies a modifier to the offense die, the adjusted value finds the row, and the twelve-sided-die sum finds the column.

```dart
final mod = defenseCard.modifierFor(offenseCard.id); // 예: 니켈 vs 숏패스 = -2
final adjusted = (offD10 + mod).clamp(1, 10);
final row = rowIndex(adjusted);
final col = columnIndex(offD12 + defD12);
final cell = offenseCard.cell(row, col); // '9', '-1', 'I', 'F' ...
```

The tricky part was the **chain of handling for non-numeric special outcomes.** An interception rolls again on the turnover chart, and if that turns up another fumble, it rolls on the fumble chart too. I organized this by splitting it into phases with a state machine.

```dart
enum GamePhase {
  kickoff,      // 킥오프 or 온사이드 킥 선택
  returnChoice, // 엔드존 도달 시 리턴/터치백 선택
  play,         // 공격/수비 카드 선택
  extraPoint,   // 터치다운 후 추가득점 선택
  gameOver,
}
```

One design tip. Quarter-ending (16-play) timing is subtle: per the rules, "the down in progress gets fully resolved first" before the quarter rolls over. At first, I advanced the quarter the moment the play count incremented, and that tangled up resolutions that were still mid-flight. I ended up switching to a structure with a **"pending quarter transition" flag** that only takes effect after all resolution finishes.

## Step 3. The AI Opponent — Weighted Randomness Is Enough

There's nothing fancy about the "AI." It assigns weights to cards based on the situation (down, yards to go, field position, score gap) and draws from them.

```dart
String _weightedPick(Map<String, double> weights) {
  final total = weights.values.fold(0.0, (a, b) => a + b);
  var roll = _rng.nextDouble() * total;
  for (final e in weights.entries) {
    roll -= e.value;
    if (roll <= 0) return e.key;
  }
  return weights.keys.last;
}
```

Difficulty is implemented with nothing more than **raising the weights to an exponent.** Easy uses `w^0.35` (nearly random), Hard uses `w^1.6` (heavily weighted toward the optimal choice). On top of that, Hard difficulty adds a dash of "tendency learning" — remembering the human's recent pass/run ratio and lining the defense up to match it.

Validation was done through simulation. Building a test that **auto-plays 100 games of AI vs. AI** and checks for crashes, infinite loops, and whether average scores land in a sane range meant that every time I touched the engine, I could confirm there was no regression within seconds.

## Step 4. UI — Keeping the "Game Plan" Feel Even in a Text-Heavy Game

The first version showed all 9 offense cards laid out in a 3×3 grid, but actually playing it, scanning all 9 cards every single time got tiring. So I switched to the **game-plan style** football games use.

1. Automatically detect the current situation (short / medium / long distance, or goal line)
2. Prominently show only the **3 recommended plays** that fit the situation
3. If you want something else, open the full sheet via the [full playbook] button

I put an X/O tactical diagram, drawn with `CustomPainter`, on each card, following football playbook notation as-is — offense as O, defense as X, routes as arrows, fakes as dashed lines.

The ball-movement animation chains its trajectory through multiple stages with `TweenSequence`. Even something like a kickoff — going forward and then coming back on the return — flows naturally once you weight each segment by its distance.

```dart
items.add(TweenSequenceItem(
  tween: Tween(begin: from, end: to)
      .chain(CurveTween(curve: Curves.easeInOut)),
  weight: dist, // 이동 거리 비례로 시간 배분
));
```

## Troubleshooting

**1. Catching layout overflow with widget tests**

UI bugs only break in specific game situations (for example, the punt/FG button row that only appears on 4th down overflows the screen). Reproducing that situation on a real device takes forever, so a **random-progression smoke test** turned out to be a lifesaver. It advances the game for 60 steps, tapping whatever button happens to be on screen, and checks that `tester.takeException()` is null at every step. A layout exception like `RenderFlex overflowed` gets caught as a test failure.

**2. Cards stretching oddly on the web**

A layout built around a vertical phone screen, opened in a wide browser, stretched the cards horizontally until only their borders showed. The fix was one line — wrapping the whole game screen in `ConstrainedBox(maxWidth: 520)` so it keeps phone-like proportions no matter where it's opened.

**3. Old Android emulator**

An old arm32 AVD I'd made won't run at all on the latest emulator (`CPU Architecture 'arm' is not supported by the QEMU2 emulator`). You need to download a fresh arm64 system image. If you're in a hurry, spinning up a web build (`flutter build web`) on a local server and checking it in the browser is far faster.

```bash
cd build/web && python3 -m http.server 8765
# 폰에서도 http://<맥 IP>:8765 로 바로 접속 가능
```

**4. Installing on a real device**

I connected over USB and pushed the release APK straight in.

```bash
flutter build apk --release
adb install -r build/app/outputs/flutter-apk/app-release.apk
```

## Wrap-Up — The Flow of Digitizing a Board Game

1. **Turn the rulebook and cards into data**: transcribe every chart, and lay down integrity tests first
2. **Write the engine in pure Dart**: separating it from the UI makes simulation tests, like AI auto-matches, possible
3. **AI = weighted draw + exponent-based difficulty**: this is plenty fun for a board-game-level opponent
4. **UI = situation-based recommendations**: when there are a lot of cards, don't show them all — just a handful that fit the situation
5. **Random smoke tests**: the cheapest way to catch UI bugs in a probability-driven game is automated random progression

In turning one paper rulebook into a game inside a phone, the thing that took the longest wasn't coding — it was **transcribing and verifying the numbers off 32 cards.** Put another way, once the data is accurately transferred, digitizing a board game is a far more doable project than it sounds. If you've got a board game sleeping in a drawer somewhere, give it a shot.
