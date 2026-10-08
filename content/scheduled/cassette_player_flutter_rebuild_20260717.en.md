---
title: 'Rebuilding My React Native Cassette Player From Scratch in Flutter'
date: '2026-07-17'
publish_date: '2026-12-08'
description: "The full analysis-design-migration-real-device-troubleshooting journey of rebuilding a React Native cassette music player in Flutter because I couldn't stand the design anymore"
tags:
  - Flutter
  - React Native
  - Riverpod
  - drift
  - Migration
---

## Why I Rebuilt an App That Already Worked Fine

A few months ago I built a cassette-tape music player with React Native (Expo). The concept was Side A/B, 30 minutes each, holding onto FF/REW long-press for winding, and the ability to attach YouTube links too. The features all worked, but once I actually used it, the design kept bothering me. The neumorphic buttons felt off, and the cassette visual looked like a toy.

I only wanted to fix the design, but since I'd never properly used Flutter before, I decided to use this as an excuse to switch frameworks entirely and rebuild it. "Why not just rewrite it" sounds simple enough, but the problem was the data of people already using it. Tapes they'd made, songs they'd loaded, their last playback position — I couldn't just wipe all of that and ship a new app.

So this project ended up being less about "making a pretty UI" and more about "overhauling the framework without losing a single bit of existing functionality or data." This post is a record of the actual order I worked in, and where things got stuck along the way.

## Step 1. Don't Start Writing Code — Analyze First

The temptation I wanted to give in to the most was "I'm rebuilding it anyway, so let's just throw in everything good and rewrite from scratch." But doing that, nine times out of ten, means dropping a few things that already worked well. So I forced myself into an order.

1. Review the entire existing RN project structure
2. Run it and capture the screen flow
3. Read the playback engine code line by line
4. Check the data storage structure
5. Only then start designing the Flutter version

Reading the existing code (`useAudioPlayer.ts`), I found a single 1,450-line hook that held the playback engine, tape CRUD, and storage logic all together. The code itself was messy, but the **domain rules** buried inside it were surprisingly intricate.

- A 2-second "noise" item is automatically inserted between tracks (recreating the sound of an actual tape running between songs)
- Once a side finishes, it plays noise only until the 30 minutes fill up, then automatically flips to the other side
- Holding FF/REW moves the actual tape position at 1 second per second (10x speed), and releasing it calculates the exact track/offset at that position and lands there

These are details I never could have reproduced by guessing without reading the code. So I first wrote up the analysis into four markdown documents (`legacy-analysis.md`, `feature-mapping.md`, `data-migration-plan.md`, `flutter-architecture.md`), with a table splitting "features to keep" from "features to add," and only then started writing Flutter code.

## Step 2. Architecture: Feature-First + Riverpod + drift

The most confusing part of using Flutter for real for the first time was "what do I use for state management." Riverpod, Bloc, Provider... I ended up going with Riverpod, for a simple reason. Since the playback engine streams its state through a `Stream`, Riverpod's `Notifier` felt like the most natural way to subscribe to that stream and turn it into UI state.

I organized the directories feature-first.

```text
lib/
  app/            # 라우팅, 테마, 부트스트랩
  core/
    audio/        # 재생 엔진 (PlayerController)
    database/     # drift 스키마 + 레거시 마이그레이션
    sharing/      # 공유 코드 인코딩/디코딩
  features/
    player/       # 메인 데크 화면
    tapes/        # 테이프 목록
    tape_editor/  # Side A/B 편집
    youtube/
    settings/
```

I picked `drift` for the local DB. It's SQLite-based, and the deciding factor was that it meant I could directly open and read the existing RN app's SQLite file (`RKStorage`, which AsyncStorage uses internally) later.

```dart
class TapeItems extends Table {
  TextColumn get id => text()();
  TextColumn get tapeId => text().references(Tapes, #id, onDelete: KeyAction.cascade)();
  TextColumn get side => text().withLength(min: 1, max: 1)(); // 'A' or 'B'
  IntColumn get position => integer()();
  TextColumn get type => text()(); // 'track' or 'noise'
  IntColumn get durationMs => integer()();
  // ...
}
```

I learned something here. SQLite **ignores foreign key constraints by default.** I ran into a bug where deleting a tape didn't delete its child tracks, and the cause was that I hadn't turned on `PRAGMA foreign_keys = ON`.

```dart
@override
MigrationStrategy get migration => MigrationStrategy(
  onCreate: (m) => m.createAll(),
  beforeOpen: (details) => customStatement('PRAGMA foreign_keys = ON'),
);
```

I caught this — a single missing line silently breaking cascade deletes — while writing tests. Worth remembering if it's your first time touching SQLite.

## Step 3. The Playback Engine — Unifying Everything Around One Concept: "Tape Position"

In Flutter, I used `just_audio` for audio and `audio_service` for background playback and lock-screen controls. But what was actually hard wasn't learning the libraries — it was **modeling the state.**

The old RN code had a value called `tapePosition`. What this is, is not the position within the currently playing track, but **the absolute position across the entire side, noise included.** With just this one value, you can calculate:

- How much of the reel has wound (for the radius calculation)
- What minutes:seconds to show on the digital counter
- How far FF/REW moved
- Where to start playing from on the flipped side (`30 minutes − current position`)

Everything falls out of it. I carried this idea straight over into Dart.

```dart
/// 절대 테이프 위치(targetMs)가 어느 아이템의 어느 오프셋에 해당하는지 계산
TapeLanding findItemAtTapePosition(List<SideItem> items, int targetMs) {
  var elapsed = 0;
  for (var i = 0; i < items.length; i++) {
    final dur = items[i].durationMs;
    if (elapsed + dur > targetMs) {
      return (itemIdx: i, offsetMs: targetMs - elapsed);
    }
    elapsed += dur;
  }
  // 범위 초과 시 첫 트랙부터
  final firstTrack = items.indexWhere((it) => it is TrackItem);
  return firstTrack != -1 ? (itemIdx: firstTrack, offsetMs: 0) : (itemIdx: 0, offsetMs: 0);
}
```

This one function gets reused for FF, REW, flipping sides, and restoring playback position. Having the logic centralized in one place also made it easy to attach unit tests — since it's a pure function with no UI involved, `flutter test` could verify all the edge cases (track boundaries, exceeding content range, and so on).

## Step 4. The Cassette Visual — Drawing Analog Texture for the First Time With CustomPainter

This was the first time I'd used Flutter's `CustomPainter` for real. To recreate the vintage cassette from the reference image (cream shell + orange band + black gear reels), I calculated the coordinates myself to draw gradients, shadows, and rotating gears.

The key is that the two reels' radii change in opposite directions as playback progresses.

```dart
final leftRadius = minR + (1 - progress) * (maxR - minR);
final rightRadius = minR + progress * (maxR - minR);
```

And the rotation speed isn't fixed either — it varies on a 3-to-18-second cycle depending on how much tape is wound. The less tape that's wound (the smaller the radius), the faster it spins — mimicking the actual angular-velocity physics of a cassette tape. At first I thought "do I really need to go this far," but once it was in, this one detail made all the difference between "it's just an image spinning" and "it actually feels like tape winding."

```dart
double periodFor(double ratio) =>
    fast ? 250.0 : 3000.0 + ratio * ratio * 15000.0;
```

## Step 5. Protecting Existing User Data

This was the part I was most nervous about in the whole project. The React Native app uses `AsyncStorage`, which on Android internally stores key-value pairs in a SQLite file called `RKStorage`. If the Flutter app gets installed as an update **under the same package name**, the app's data directory stays intact, which means this file can be opened and read directly.

```dart
final rows = db.select(
  'SELECT key, value FROM catalystLocalStorage WHERE key IN (?, ?, ?, ?, ?)',
  [keyTapes, keyCurrentTape, keySide, keyA, keyB],
);
```

I wrote the migration procedure in this order.

1. Check a flag for whether migration has already run (prevent duplicate runs)
2. Check whether the old SQLite file exists → if not, treat it as a new user
3. Back up the original file
4. Read the key-values, parse the JSON, convert to the new domain models
5. Bulk-insert in a drift transaction
6. On success, save the flag — **on failure, don't save the flag, so it retries on the next run**

Step 5 matters because `importTape` is an upsert, so retrying doesn't duplicate data. If I'd made a failure just "start with an empty state and save the flag anyway," I could permanently lose user data, so I deliberately kept this part conservative.

## Step 6. Real Problems I Ran Into Installing on a Real Device

From here on, it's more of a troubleshooting log than code.

### A Different Signing Key Means an Update Install Fails

```bash
adb install -r app-release.apk
# Failure [INSTALL_FAILED_UPDATE_INCOMPATIBLE:
#  Existing package com.hscassette.player signatures do not match newer version; ignoring!]
```

Obvious in hindsight, but creating a new Flutter project also generates a new signing key. During real-device testing, the only option was to uninstall the existing app and install fresh (naturally losing the test data on that phone). This was a good reminder that, for an actual release, you have to make sure to use the exact same keystore file that was used to build the original RN app.

### An Old `file_picker` Version Breaks the Build on the Latest Gradle

```text
Could not find method jcenter() for arguments [] on repository container
```

I started with `file_picker: ^3.0.4`, and this error only showed up in the release build. The cause was that that version's Android build script referenced the now-removed `jcenter()` repository. Bumping `file_picker` to 10.x fixed it, but that in turn caused a version conflict with the `win32` version `share_plus` required, so I had to drop `share_plus` down a notch to 12.x. It drove home that the newest version of a Flutter package isn't always the right answer — you need to find a combination where the dependency graphs actually fit together.

### Text Shared via KakaoTalk Gets Cut Off Mid-Way

The tape sharing feature works server-free, by base64-encoding the entire tape info into text sent through a messenger. But when a real user copy-pasted text they'd received over KakaoTalk, it showed "Couldn't find a tape code."

Digging into it, the cause was that **KakaoTalk truncates the tail end of long messages when you copy them.** If the code gets cut mid-way, base64 decoding fails outright. To fix this, I added recovery logic that salvages what it can even from a truncated code.

```dart
/// 잘린 JSON에서 파싱 가능한 최대 앞부분을 복구.
/// 값 경계(',', '}', ']') 지점마다 미완성 꼬리를 잘라내고
/// 열린 괄호를 자동으로 닫아 시도한다.
Map<String, dynamic>? salvageTruncatedJson(String s) {
  // 문자열 안이 아닌 위치의 콤마/닫는 괄호를 전부 찾아서
  // 뒤에서부터 순서대로 "여기서 자르면 유효한 JSON이 되는지" 시도
}
```

This is a bug you'd never run into through a normal sharing flow — it only showed up in the specific combination of a real user using a real messenger. A textbook case of "works fine on my machine," and it reminded me all over again why testing on a real device with real usage scenarios matters.

## Wrap-Up

Looking back, 80% of this project wasn't "building new features" — it was "moving what already existed without losing any of it."

| Stage | Key point |
|---|---|
| Analysis | Documented existing logic and data structure first instead of jumping into code |
| Architecture | Riverpod (state) + drift (storage) + feature-first directories |
| Playback engine | Modeled reel/counter/FF-REW/side-flip all around one concept: "tape position" |
| Visual | Reproduced rotation speed and radius with real physical feel using CustomPainter |
| Migration | Kept the same package name + made the process retry-safe even on failure |
| Real-device verification | Found signing keys, package version conflicts, and messenger text truncation only by actually using it |

A rewrite that switches frameworks always comes with the temptation to "throw in everything I know now and build it from scratch." But if even one person is already using the thing, resisting that temptation and reading the existing code first turned out, in the end, to be the faster path.
