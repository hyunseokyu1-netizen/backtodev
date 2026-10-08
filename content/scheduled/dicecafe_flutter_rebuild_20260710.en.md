---
title: 'Reviving a 15-Year-Old Android Game (Part 2) — Hitting Three Walls and Deciding to Rebuild From Scratch'
date: '2026-07-10'
publish_date: '2026-10-28'
description: "I patched and re-signed a 2011 Unity game's license check, only to hit three layers of native walls on a modern phone — so I rebuilt Go-Stop from scratch in Flutter based on what I'd learned, and got it running on a Galaxy S24 FE"
tags:
  - Android
  - Flutter
  - apktool
  - Reverse Engineering
  - Unity
---

## Last Time's Recap, and This Episode's Twist

In [the previous post](/), I traced why an Android game from 2011 called `Dice Cafe` (a Unity game bundling 14 board games) crashes the instant it launches on a modern phone. The culprit turned out to be Google Play's **license check (LVL)**. If the app wasn't bought through the store, verification would fail and the app would shut itself down.

"So all I need to do is disable that check, right?" — this episode is about actually applying that patch, re-signing the APK, and installing it on a phone. And it's about **the three walls I ran into along the way**, and how I ended up turning away from reviving the original and **rebuilding it from scratch** instead.

Spoiler: I never managed to revive the original. But the game does run on the phone. Read on to see what that means.

## Step 1. Stripping Out the License Check and Re-signing

In the last post I used `apktool` to unpack the APK into smali. The license verification was hooked into two callbacks that Unity's `UnityPlayer` class hands off to the native engine.

- `showBuildSetup()` → returns whether the license passed (the `G` field)
- `showRuntimeSetup()` → returns whether the license check finished (the `H` field)

The native engine polls these two over JNI, and if it decides "the check finished but didn't pass," it kills the app. So I patched both methods to **always return 1 (pass/complete)**.

```smali
# 수정 전
.method protected showBuildSetup()Z
    .locals 1
    iget-boolean v0, p0, Lcom/unity3d/player/UnityPlayer;->G:Z
    return v0
.end method

# 수정 후 — 무조건 통과(1) 반환
.method protected showBuildSetup()Z
    .locals 1
    const/4 v0, 0x1
    return v0
.end method
```

On top of that, I made the setup code that reaches out to the Google Play Licensing service in the first place get skipped right at the start of `onDrawFrame`. Then: rebuild → align → sign.

```bash
# 스말리 → APK 재빌드
apktool b dicecafe_decoded -o patched_unsigned.apk

# zipalign(4바이트 정렬) 후 서명
zipalign -f -p 4 patched_unsigned.apk patched_aligned.apk

# 새 키스토어로 서명 (v1+v2+v3 스킴)
apksigner sign --ks dicecafe.keystore --ks-key-alias dicecafe \
  --min-sdk-version 7 --v1-signing-enabled true --v2-signing-enabled true \
  --out patched.apk patched_aligned.apk

# 검증
apksigner verify --print-certs -v patched.apk
```

This part went cleanly. Signature verification passed too. "Now I just plug it into the phone and install it," I thought. That turned out to be wrong.

## Step 2. The First Wall — Modern Phones Don't Have 32-Bit

I connected the phone over USB debugging and ran the install.

```bash
adb install -r patched.apk
# Failure [INSTALL_FAILED_NO_MATCHING_ABIS: ... res=-113]
```

The install itself was rejected. `NO_MATCHING_ABIS` means "there's no native library on this device that can run this app."

The cause was the CPU architecture. This game's engine libraries (`libunity.so`, `libmono.so`) are **32-bit ARM (armeabi-v7a) only**, but modern Samsung flagships — mine is a Galaxy S24 FE — are **64-bit (arm64-v8a) only**. 32-bit ARM execution has been dropped entirely at the hardware/OS level.

You can check which ABIs a device supports like this:

```bash
adb shell getprop ro.product.cpu.abilist
# arm64-v8a          ← 64비트 하나뿐. 32비트가 없다.
adb shell getprop ro.product.cpu.abilist32
# (빈 값)
```

An app that only ships 32-bit libraries can't be installed on a 64-bit-only phone. I'd gotten past the license, but I was blocked a layer further down than that.

## Step 3. The Second Wall — A Modern Loader Can't Load Old Libraries

Luckily I had an older phone sitting in a drawer (an LG V50, Android 12). Its `abilist` includes `armeabi-v7a`, so it supports 32-bit. The install succeeded. But when I launched it, it crashed again. This time I checked the logs.

```bash
adb logcat -d | grep -iE "unity|mono|linker|UnsatisfiedLink"
```

```
E linker: ... "libmono.so" has text relocations ...
         (allowing for now because this app's target API level is still 22)
E linker: ERROR: OOPS: cannot map library 'libmono.so'. no vspace available.
E AndroidRuntime: java.lang.UnsatisfiedLinkError:
         Bad JNI version returned from JNI_OnLoad in "libmono.so": 0
```

Two things were tangled together here.

1. **Text relocation**: `libmono.so`, built in 2011, uses an old-school approach called "text relocation," and Android **forcibly blocks** loading such libraries once an app's `targetSdkVersion` is 23 or higher. (I'd bumped targetSdk to 24 earlier just to get the install to go through, and that's exactly what triggered this block. So I reverted it to 22.)
2. Once I lowered targetSdk to 22, text relocation only produced a warning and passed — but then came **`no vspace available`**, meaning the linker couldn't reserve a chunk of virtual address space to map this library into.

`libmono.so` is only 108KB. This isn't a size problem — it's a fundamental compatibility problem: **the way a modern Android (64-bit kernel) linker maps memory doesn't fit an 11-year-old library.** This isn't something smali or manifest edits can fix.

> Side note: lowering `targetSdk` below 23 makes Android pop up a one-time "permission review" dialog. You have to tap it once directly on the phone before the app will launch. I mistook this for a crash at first too.

## Step 4. The Third Wall — Even the Emulator Can't Run 32-Bit ARM

"Then what if I spin up an old Android emulator and run it there?" This was my last hope. My Mac is Apple silicon (arm64). I tried two directions.

| System Image | Boots | Installs 32-bit App | Result |
|---|---|---|---|
| arm64-v8a (Android 5.0) | ✅ | ❌ | `abilist32` is empty — **64-bit only**, rejected just like the Samsung phone |
| armeabi-v7a (Android 4.4) | ❌ | — | `FATAL: CPU Architecture 'arm' is not supported by the QEMU2 emulator` |

It was a dilemma. The image that accepts a 32-bit app won't boot at all on the modern emulator (support for running a 32-bit ARM guest has been removed), and the arm64 image that does boot has no 32-bit support. **There's no emulator on an Apple silicon Mac that can run this game.**

## Why "Just Rebuild It" Doesn't Work Either

The obvious next thought: "Can't I just rebuild it for arm64 from the original Unity project?" Two reasons made that impossible.

1. **There's no original source.** All that can be pulled out of the APK is the .NET assembly containing the game logic (`Assembly-CSharp.dll`) and the assets. Without the scenes, prefabs, and project settings, there's no way to rebuild it in Unity.
2. **Unity 3.3 can't produce 64-bit builds.** Checking the game data header showed `3.3.0f4` (January 2011). Unity didn't support arm64 until 5.x (2015). Even with the original source, this version simply cannot output a 64-bit build.

```bash
# 유니티 버전은 mainData 헤더에서 확인된다
strings assets/bin/Data/mainData | grep -E "^[0-9]+\.[0-9]+\.[0-9]"
# 3.3.0f4
```

To sum up: the license patch succeeded, but underneath it were three layers of native walls — **CPU, loader, and emulator** — and rebuilding was blocked on both the source and the engine-version front. The road to reviving the original ended here.

## Changing Direction — Instead of Reviving It, Rebuild It

But in the process of digging into the cause, I'd picked up one useful piece of information. Dissecting `Assembly-CSharp.dll` showed that the **game logic (chess, Omok, Go-Stop, mahjong, janggi, and the rest — 14 games total) is plain C# code with no architecture dependency.** The only thing that had been holding things back was the 2011 Unity engine itself.

In other words: **the substance — "the game rules and screen layout" — was already understood through analysis, so all I needed to do was build a modern container (engine) to hold it.** Rather than copying the original assets, the plan was to rebuild from scratch using the rules I'd already analyzed as reference. I picked **Flutter** for the stack (one codebase for Android, iOS, and web), and chose **Go-Stop**, with its famously fiddly rules, as the first game.

```bash
# Flutter 설치 (Homebrew)
brew install --cask flutter

# 프로젝트 생성 (웹 + 안드로이드)
flutter create --platforms=web,android --org com.lixsoft --project-name dicecafe_app dicecafe_app
```

The key was **separating pure logic from the UI**. The 48-card hwatu deck and score calculation were built in pure Dart with no dependency on Flutter, and verified with unit tests.

```dart
// 화투 48장: 광 5 · 열끗 9 · 띠 10 · 피 24(쌍피 2장 포함)
test('광 5장, 열끗 9장, 띠 10장', () {
  final deck = buildDeck();
  expect(deck.where((c) => c.type == CardType.gwang).length, 5);
  expect(deck.where((c) => c.type == CardType.animal).length, 9);
  expect(deck.where((c) => c.type == CardType.ribbon).length, 10);
});

// 고도리 = 2·4·8월 열끗 3장 = 5점
test('고도리 5점', () {
  final godori = buildDeck().where((c) => c.isGodori).toList();
  expect(computeScore(godori).godori, 5);
});
```

The scoring rules are easy to get wrong (which months count as Godori, whether Samgwang including the rain-Gwang is worth 2 points, etc.), so I checked the card composition and scoring hands exactly once against Wikipedia's Go-Stop article and then locked it into code. That way, even if rules get added later, the tests will catch regressions. I passed 13 unit tests (deck composition, scoring, and verifying all 48 cards are conserved over a full round).

Since there were no image assets, the UI drew cards using color and text — red for Hongdan, blue for Cheongdan, gold for Gwang, navy for double-junk, and so on. I built two screens: the lobby (a grid of 14 games, with only Go-Stop active for now) and the Go-Stop board.

If you want to eyeball something before doing a full build, spinning it up on web is the fastest way.

```bash
# 웹으로 빌드해서 정적 서버로 띄우고, headless 크롬으로 스크린샷
flutter build web
cd build/web && python3 -m http.server 8791 &
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --screenshot=out.png --window-size=760,1200 \
  --virtual-time-budget=10000 http://localhost:8791
```

## The Result — Running on the Exact Phone That Rejected the Original

I built an Android APK.

```bash
flutter build apk --release
# ✓ Built build/app/outputs/flutter-apk/app-release.apk (45.0MB)
```

This APK includes arm64. And I installed it on **the exact same Galaxy S24 FE that had rejected the original 32-bit game with `NO_MATCHING_ABIS`.**

```bash
adb install -r app-release.apk
# Success
```

Install succeeded. Launching it brings up the lobby, and going into Go-Stop lays out the hwatu cards and starts a round against the AI. On the phone that outright refused to even install the original, the newly built app plays just fine.

> On Samsung phones, capturing a Flutter screen with `adb screencap` comes out pitch black (a GPU surface capture limitation). It's not that the app is black — it's that the capture fails. Unlock the phone and look at the actual screen and it's fine. This one also had me stuck for a while.

## Commands I Kept Reaching For

| Purpose | Command |
|---|---|
| Check which ABIs a device supports | `adb shell getprop ro.product.cpu.abilist` |
| Check for 32-bit support | `adb shell getprop ro.product.cpu.abilist32` |
| Trace a crash from runtime logs | `adb logcat -d \| grep -iE "linker\|UnsatisfiedLink"` |
| Check a .so's architecture | `readelf -h libmono.so` (or `file libmono.so`) |
| Check the Unity version | `strings assets/bin/Data/mainData \| grep -E "^[0-9]+\.[0-9]"` |
| Rebuild/sign the APK | `apktool b` → `zipalign` → `apksigner sign` |
| Flutter build | `flutter build apk --release` / `flutter build web` |

## Troubleshooting Notes

| Symptom | Cause | Response |
|---|---|---|
| `INSTALL_FAILED_NO_MATCHING_ABIS` | Only 32-bit libraries exist, but the device is 64-bit only | Needs a 32-bit-capable device (no fundamental fix) |
| `has text relocations` UnsatisfiedLinkError | targetSdk 23+ blocks loading old .so files | Lower targetSdk to 22 or below |
| `cannot map library. no vspace available` | A modern linker fails to map an old text-relocation .so | Can't be fixed by repackaging |
| `INSTALL_FAILED_VERIFICATION_FAILURE` | Play Protect's sideload verification | `adb shell settings put global verifier_verify_adb_installs 0` |
| Emulator `CPU Architecture 'arm' is not supported` | Modern emulators don't support a 32-bit ARM guest | Use an arm64 image (though it still can't run 32-bit apps) |
| Flutter screen shows black in `screencap` | GPU surface capture limitation | Check the actual screen / unlock before capturing |

## Summary — The Flow at a Glance

1. **License patch**: Patched `showBuildSetup`/`showRuntimeSetup` in smali to always pass, then re-signed → succeeded
2. **First wall**: Modern phones are arm64-only, so the 32-bit game can't be installed
3. **Second wall**: Even on an older phone with 32-bit support, a modern linker can't load a 2011-era library (`no vspace`)
4. **Third wall**: The emulator on an Apple silicon Mac doesn't support a 32-bit ARM guest
5. **Rebuilding also impossible**: No original source + Unity 3.3 simply can't produce a 64-bit build
6. **Direction change**: The game logic (C#) is architecture-independent → rebuild just the container in Flutter
7. **Result**: Reimplemented Go-Stop, got it running on the very Galaxy S24 FE that had rejected the original

Reviving an old app often ends up this way. Even when reviving the original outright fails, the understanding gained along the way — what the actual problem was, and where the substance really lives — opens up a better path: rebuilding. Next time, I'll add special rules like ppeok, ttadak, and jjok to Go-Stop, and talk about adding a second game.
