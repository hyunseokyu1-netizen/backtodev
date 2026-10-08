---
title: 'Adding a Turn Timer to a Flutter Local Multiplayer Game — Football Dice Dev Log'
date: '2026-07-20'
publish_date: '2026-12-30'
description: Design decisions and release steps behind adding a 15-second turn limit with countdown, visual how-to-play examples, and a separate settings screen to a same-WiFi football board game app
tags:
  - Flutter
  - Dart
  - App Development
  - Solo Development
  - GooglePlay
---

## Why a Turn Limit Was Needed

`Football Dice`, the app I'm building, is a football board game played with dice and cards. There's a mode where you play against the AI, but the real fun comes from local multiplayer against a friend on the same WiFi — it's a kind of mind game where both sides secretly pick an offense card and a defense card, then reveal them at the same time.

But testing it myself, I ran into one problem. If the opponent took a long time deciding on a card, the game would just stall. The screen would just sit there saying "Waiting for opponent's card selection...," with no way to know when the next play would happen. When you play a board game sitting face to face, this kind of thing just moves along by unspoken agreement — but playing it through screens, this part felt like it dragged on noticeably.

So the core of this update was **putting a 15-second turn limit on network matches only, and showing a countdown once 5 seconds remain.** On top of that, I bundled in beefing up the how-to-play explanation and cleaning up a main screen that had been growing out of control.

This post covers three things.

1. Where and how I added the turn-limit timer (without touching the host/guest structure)
2. How I added visual examples to the how-to-play dialog by reusing actual widgets instead of text
3. The flow of splitting the growing main screen into a settings page, and shipping two version bumps

## The Existing Structure — The Host Judges, Clients Just Draw

I need to cover the existing structure first for the implementation choices here to make sense. This app's multiplayer is socket-based, with clearly separated roles.

| Role | Class | What it does |
|---|---|---|
| The one who created the room | `HostSession` | Runs the game engine directly, makes rulings, broadcasts state to guests |
| The one who joined | `GuestSession` | Sends choices to the host, draws whatever state it receives as-is |
| Screen | `MpGameScreen` | Draws the UI by looking only at the `MpSession` interface (no host/guest distinction) |

The important design point here is that **the authority to make rulings always belongs only to the host.** So when adding the turn-limit timer, I chose a direction that wouldn't break this principle. Instead of building a new protocol-level feature like "the server force-advances the turn after 15 seconds," I made **each client run its own timer on its own screen, and when time runs out, it just calls the existing choice function.** I didn't touch a single line of the protocol (`protocol.dart`), and there's no compatibility issue with older-version clients.

## Step 1. Determining Whether It's My Turn to Decide

Before running a timer, what you need first is a function that decides "am I in a situation where I need to make a decision right now?" This game has four decision points — kickoff, return, offense/defense card selection, and extra point — so I defined a different default action for timeout in each case.

```dart
VoidCallback? _pendingAutoAction() {
  if (session.error != null) return null;
  switch (s.phase) {
    case GamePhase.kickoff:
      if (s.kickingTeam != me) return null;
      return () => session.chooseKickoff(onside: false); // 일반 킥
    case GamePhase.returnChoice:
      if (s.possession != me) return null;
      return () => session.chooseReturn(touchback: true); // 터치백
    case GamePhase.play:
      if (session.iSubmitted) return null;
      return s.possession == me
          ? () => _autoPickOffense(false)
          : () => _autoPickDefense(false);
    case GamePhase.extraPoint:
      // ...추가 득점 처리
  }
}
```

Auto-selecting an offense/defense card isn't random — **if a card is already selected, it uses that; if not, it uses the first of the situation-specific recommended cards.** This game already had logic that shows 3 recommended cards based on down/distance, and I just reused that as-is.

```dart
void _autoPickOffense(bool twoPoint) {
  final id = selectedOffense ?? _suggestedOffense(twoPoint).first.id;
  session.chooseOffense(id);
}
```

## Step 2. Getting the Timer Start/Stop Timing Right

The slightly tricky part here was **when exactly to restart the timer and when to stop it.** Obviously it needs to reset once a ruling finishes and the game moves to the next play, and it shouldn't be touched just because news arrives that the opponent played their card first. To distinguish these, I made a "key that identifies the current decision situation," and made the timer restart only when that key changes.

```dart
void _syncTurnTimer() {
  final pending = _pendingAutoAction() != null;
  final key = pending
      ? '${session.version}:${s.phase.name}:${session.awaiting2pt}'
      : null;
  if (key == _decisionKey) return; // 같은 결정 상황이면 그대로 둔다
  _decisionKey = key;
  _turnTicker?.cancel();
  if (key == null) return; // 결정할 게 없으면 타이머 없음

  _remaining = 15;
  _turnTicker = Timer.periodic(const Duration(seconds: 1), (_) {
    setState(() => _remaining--);
    if (_remaining <= 0) {
      _turnTicker?.cancel();
      _pendingAutoAction()?.call(); // 시간 초과 → 자동 진행
    }
  });
}
```

Including `session.version` in the key is the key point. This value gets bumped by the host and broadcast every time a new ruling comes out, so a version change means a new play has started. With `_syncTurnTimer()` called every time the `updates` stream refreshes, the timer automatically turns off during the opponent's turn and automatically turns on when my turn arrives.

## Step 3. Countdown UI — Only Show It From 5 Seconds

Showing a number for the whole 15 seconds seemed like it'd be more distracting than helpful, so I decided to show the countdown as a red circular badge next to the panel title **only when 5 seconds or less remain.**

```dart
bool get _countdownVisible =>
    _turnTicker != null && _remaining <= 5;
```

And when time runs out and a selection auto-proceeds, I show a snackbar message ("시간 초과! 자동으로 선택했습니다") so the user doesn't get confused wondering "wait, why did this go out instead of my card?" It's a small detail, but skipping something like this makes it easy to feel like a bug.

## Step 4. "Actually Show It" Instead of "Explain It in Words" in the How-to-Play

Separately from the turn limit, I also touched up the how-to-play dialog. Originally it was just text explanations like this.

> 예) 공격 D10이 9인데 수비 보정 -2를 받으면 7 → "7-8" 행, D12 합이 14면 "13-15" 열. 그 교차점의 숫자만큼 전진합니다.

Honestly, reading just the text doesn't really paint the picture. So I built a new widget to replace this explanation — and instead of drawing a new image file, I chose to **reuse the exact same dice widget and chart widget the game already uses.**

```dart
final card = offenseById('short_pass');
ChartTable(
  chart: card.chart,
  highlightRow: rowIndex(9 - 2),   // 실제 게임 로직으로 계산
  highlightCol: columnIndex(6 + 8), // 하드코딩 좌표 아님
)
```

`rowIndex()` and `columnIndex()` are the exact same functions the actual ruling engine (`engine.dart`) uses to convert dice values into chart rows/columns. The reason I had the example coordinates computed with these functions instead of hardcoded numbers is so the example never drifts out of sync with reality even if the card chart data changes later. With a static image, I'd have had to recapture it every time the data changed — reusing the widget means that never happens.

As a result, the dialog shows 4 dice chips in the exact same colors as the real game (offense D10, defense D10, two D12s), with the correct cell highlighted in gold in the chart below. Far more intuitive than reading a block of text.

## Step 5. Splitting the Growing Main Screen Into a Settings Page

As features piled up one by one, the main screen ended up cramming in language selection, difficulty selection, new game/multiplayer/how-to-play buttons, dice/card animation toggles, and a sound effects toggle — to the point you had to scroll to see it all. So I moved **language, animations, and sound effects into a separate `SettingsScreen`**, leaving just a single gear icon in the top-right corner of the main screen.

```dart
Future<void> _openSettings() async {
  await Navigator.of(context).push(
    MaterialPageRoute<void>(builder: (_) => const SettingsScreen()),
  );
  if (mounted) setState(() {}); // 언어가 바뀌었을 수 있으니 다시 그린다
}
```

There's an easy-to-miss detail here — the main screen not refreshing when you change the language on the settings screen and come back. You need to call `setState` once more at the point the `Future` returned by `Navigator.push` completes (i.e., when you hit back on the settings screen), so the changed language is immediately reflected in the main screen's title and button text. Difficulty selection, since it's something you pick fresh every time right before starting a game, I left on the main screen as-is — shoving everything into settings isn't always the right call.

## Bumping the Version and Shipping

Once the feature work is done, next comes version management and building. This project is still in the early stage of going through Play Console review, so I keep each version's Android App Bundle (AAB) stored separately by version locally too.

```bash
# pubspec.yaml: version: 1.1.0+2 → 1.2.0+3 로 수정 후
flutter analyze          # 정적 분석
flutter test             # 회귀 테스트
flutter build appbundle --release
```

The number after the `+` is Android's `versionCode`, which has to strictly increase on every Play Console upload — an easy place to slip up. Here are the two versions I shipped this time.

| 버전 | versionCode | AAB 용량 | 핵심 변경 |
|---|---|---|---|
| v1.0.0 | 1 | 약 52.1MB | Initial release |
| v1.1.0 | 2 | 약 52.2MB | 15-second turn limit for network matches, visual how-to-play examples |
| v1.2.0 | 3 | 약 52.2MB | Split out the settings screen |

I copy the built AAB into a version-specific folder like `apk_build_files/football_dice/v1.2.0/`. Since there might be a need to roll back to a specific version later, or compare sizes against a previous version, I keep each version separately rather than overwriting.

And I write the Play Console release notes text in both Korean and English ahead of time in `store/CHANGELOG.md`. That way, uploading is just copy-pasting straight into the "What's new" field, so there's no last-minute scramble to come up with wording right before submitting for review.

```markdown
## v1.2.0 (2026-07-20)

### Play Console 릴리즈 노트 (What's new)

**한국어 (500자 이하)**
​```
설정 화면이 새로 생겼습니다!
- 언어, 주사위・카드 연출, 효과음 설정을 별도 설정 페이지로 이동
- 메인 화면 우상단 톱니바퀴 아이콘으로 접근
​```
```

## Commands I Used a Lot

| 명령어 | 용도 |
|---|---|
| `flutter analyze` | Static analysis, mandatory check before every commit |
| `flutter test` | Run widget/engine/network tests (13 in this project) |
| `flutter build apk --release` | APK for installing on a real device |
| `flutter install -d <device-id>` | Install directly on a connected device |
| `flutter build appbundle --release` | AAB for Play Console upload |
| `flutter devices` | List connected devices (to find device IDs) |

## Troubleshooting Notes

Just two things I actually got tripped up on while working on this.

**1) The already-selected card got ignored on auto-advance**
At first I wrote it so a timeout always played the first recommended card, but that meant a user who'd already picked a card and just hadn't pressed "submit" yet would end up having the wrong card go out. I fixed it with a **null-coalescing operator that prioritizes the already-selected value**, like `selectedOffense ?? _suggestedOffense(...).first.id`.

**2) `flutter install` not picking up the latest build**
Running `flutter build apk` and `flutter install` separately, there was a time an old, previously built APK got installed as-is. `flutter install` installs whatever's at `build/app/outputs/flutter-apk/app-release.apk` by default, so after changing code you **always need to rerun `flutter build` first before installing.** Obvious once you say it, but easy to skip the order when testing in a hurry.

## Wrap-Up

Summed up in one sentence, this update was **"two minor releases that polished the user experience without touching the existing structure."**

- Network matches dragging on → solved with a client-side timer + auto-advance (no protocol change)
- Game rules that were only ever explained in text → replaced with visual examples that reuse actual game widgets
- A main screen that had grown too big → split into a settings page to keep the first screen simple
- Bumped the version twice, from 1.1.0 to 1.2.0, keeping each version's AAB and release notes stored separately

Developing solo, UX details you put off with "it works, so let's move on" tend to pile up quite a bit, and this reminded me again that you need time to batch-clean them up like this once in a while. Next time, I plan to write up the iOS build setup and review-prep process.
