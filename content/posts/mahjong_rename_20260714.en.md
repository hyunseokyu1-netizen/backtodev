---
title: 'From Mahjong Joy to Mahjong Round — Why and How I Renamed My App'
date: '2026-07-14'
publish_date: '2026-11-28'
description: Discovering that store search results were flooded with tile-matching solitaire games under similar names, and reworking the app's name, copy, package ID, and code to avoid being mistaken for one
tags:
  - Flutter
  - Dart
  - App Stores
  - Branding
  - i18n
---

# From Mahjong Joy to Mahjong Round

The mahjong game I'm building was called "Mahjong Joy." Right before registering it on the store, I figured I'd do one last review pass, so I searched "mahjong" on the store — and found something not great. Most of the results were **tile-matching solitaire** games: the genre where you find and clear matching pairs of the same picture, commonly called "mahjong" in casual gaming.

The problem is that's not what I built. What I made is **real 4-player mahjong** — draw and discard tiles, complete your hand with 4 sets (runs/triplets) and 1 pair. The rules themselves are straight traditional mahjong; I only stripped out the complicated scoring math (yaku, han, fu) and simplified it to "base 100 points plus bonuses." But the name "Mahjong Joy" read as belonging to exactly that same family as the solitaire games. It wasn't just a matter of getting buried in search results — even a user who found it on purpose might glance at the name, assume "oh, a matching game," and move on.

I decided to rename it.

## Narrowing Down the Direction

At first I considered something blunt and direct, like "authentic mahjong" — real mahjong, orthodox mahjong, that sort of thing. But names like that felt too stiff, and clashed with the actual strength of this game (that it simplifies the rules enough for a kid to understand).

Next I tried turning the game's signature "score receipt" presentation into the brand itself — something like "mahjong receipt." Fun, but weak as a search keyword.

What I finally settled on was **a family/casual, inviting feel.** The phrase "let's play a round" was the hint. In Korean, it's the natural way to refer to **a real competitive traditional tabletop game** like go-stop, hwatu, or janggi — "한판 하자" (let's play a round). The phrase itself quietly signals "this is an actual contest, not a pair-matching puzzle." That's how I landed on **Mahjong Hanpan** (마작한판).

For the multilingual naming, I went with translating it rather than forcing a romanized form across the board. The game supports Korean/English/Chinese, and rather than insisting on a romanization like "Mahjong Hanpan" as the one true brand name, I decided it made more sense to use whatever name reads naturally in each language.

| Language | Name |
|---|---|
| Korean | 마작한판 |
| English | Mahjong Round |
| Chinese | 一局麻将 (yījú májiàng) |

The Chinese version landed especially well. "一局" maps almost directly onto "one round," so the same nuance came through naturally without forcing a translation.

## A Mistake I Found While Writing Store Copy

Once the name was set, I started writing the store listing copy (title, short description, full description). My first pass read:

```
마작한판 - 짝맞추기 아닌 진짜 마작
```

I figured that pinning down "this is NOT a matching game" with a negative statement would preempt the confusion before it started. But then, running the app with `flutter run -d chrome` and actually looking at the text on screen, something felt off. Right under the title, in large text, sat the word "matching game" (짝맞추기) — spelled out exactly.

Negation ("not") gets skimmed right past both by a human scanning the text and by a search engine indexing it. What's left as the impression is precisely the word I was trying to avoid — "matching game." I'd gone to the trouble of renaming the app, only to plant that very word right back in a highly visible spot.

So I set myself a rule: **in brand-facing copy (the title, tagline, or the first sentence of a description), don't mention that word at all — not even to negate it.** State everything positively from the start instead.

```diff
- 마작한판 - 짝맞추기 아닌 진짜 마작
+ 마작한판 - 진짜로 겨루는 4인 마작
```

```diff
- 一局麻将 - 不是配对游戏
+ 一局麻将 - 真正的4人麻将对局
```

I applied this rule across title.txt, the in-app tagline, and the opening sentence of the full description, in all three languages — Korean, English, Chinese. It really took seeing it rendered on an actual screen to internalize that if you want to avoid a word, you need a sentence where that word never needs to come up at all — not a sentence that merely denies it.

## Carrying It Through to the Code

Changing the name wasn't the end of it. I had to track down and clean up every trace of the old name scattered through the app.

### Adding a Field for the Multilingual App Name

This project keeps a per-language `Strings` object (`_ko`, `_en`, `_zh`) in `lib/i18n/strings.dart` to manage on-screen copy. But the app-name text on the home screen was hardcoded to `'Mahjong Joy'` regardless of language. While I was at it, I added a new `appTitle` field so it would display differently per language.

```dart
class Strings {
  final String appTitle;   // 신규 추가
  final String tagline;
  // ...

  const Strings({
    required this.appTitle,
    required this.tagline,
    // ...
  });
}

const _ko = Strings(appTitle: '마작한판', tagline: '마작한판 — 진짜로 겨루는 4인 마작', /* ... */);
const _en = Strings(appTitle: 'Mahjong Round', tagline: 'Mahjong Round — real 4-player mahjong, simple scoring', /* ... */);
const _zh = Strings(appTitle: '一局麻将', tagline: '一局麻将 — 真正的4人麻将对局', /* ... */);
```

I replaced `MaterialApp(title: ...)` in `main.dart` and the `Text('Mahjong Joy')` on the home screen's splash with `settings.strings.appTitle` throughout. `settings` was already being passed in as a constructor argument to the `MahjongJoyApp` widget, so I could reach it directly without `context.watch`.

### The Launcher Display Name

Android and iOS each keep their own separate "name shown on the launcher." Both were simple string swaps.

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
android:label="마작한판"
```

```xml
<!-- ios/Runner/Info.plist -->
<key>CFBundleDisplayName</key>
<string>마작한판</string>
```

### Changing the Package ID Too

Here I made a slightly bigger call. I decided to also change the `mahjongjoy` name left in the Android package ID (`applicationId`) to `mahjonghanpan`. The package ID is invisible to users, but once an app has shipped to the store it's effectively permanent — so it was better to clean it up now.

```kotlin
// android/app/build.gradle.kts
namespace = "com.backdev.mahjonghanpan"
applicationId = "com.backdev.mahjonghanpan"
```

Changing the package ID means the Kotlin source folder path (`com/backdev/mahjongjoy/`) has to follow along with it. Android ties the package path to the folder structure 1:1, so I created a new folder, moved `MainActivity.kt` into it, and deleted the old folder.

```bash
mkdir -p android/app/src/main/kotlin/com/backdev/mahjonghanpan
# MainActivity.kt의 package 선언도 com.backdev.mahjonghanpan으로 수정
rm -rf android/app/src/main/kotlin/com/backdev/mahjongjoy
```

I matched `PRODUCT_BUNDLE_IDENTIFIER` on the iOS side (`ios/Runner.xcodeproj/project.pbxproj`) to the same value too. I don't have Xcode yet, so I can't actually build for iOS, but I wanted it consistent ahead of time so nothing's mismatched when I do build it later.

### 9 Store Listing Files

This project manages title.txt, short_description.txt, and full_description.txt separately under `store/{ko,en,zh}/`, set up so pasting them into Play Console later is just a copy-paste. This time I rewrote all 9 of those files with the new name and the new positioning ("real, competitive 4-player mahjong, not a matching game").

## Resetting the Version and Rebuilding

Once the package ID changes, as far as the store is concerned it's **a completely new app.** I happened to have already created test versions 1.0.0, 1.0.1, 1.0.2 earlier (meant to roll out in sequence during the test period to give a sense of "actively in development"), and decided to repeat the same sequence under the new package, so I reset the version.

```yaml
# pubspec.yaml
version: 1.0.0+1   # 1.0.2+3 이었던 것을 되돌림
```

```bash
flutter build appbundle --release
```

Once the build was done, I removed the app that was already installed under the old package (`com.backdev.mahjongjoy`) from the test phone and installed fresh under the new package (`com.backdev.mahjonghanpan`). Since a different package ID makes Android treat them as two completely separate apps, just installing the new one doesn't overwrite the old — only its icon stays behind. I had to clean it up manually with `adb uninstall`.

## Summary

To recap the flow of this work:

1. **Finding the problem**: searching "mahjong" on the store turned up mostly tile-matching solitaire games, and "Mahjong Joy" carried a real risk of being mistaken for one of them.
2. **Narrowing down the name**: from blunt "authentic/real" framing → to a feature-driven ("receipt") framing → narrowed down to a **family/casual, inviting framing ("let's play a round")**, landing on "Mahjong Hanpan."
3. **Multilingual naming**: rather than insisting on a romanized form, I translated naturally per language (Mahjong Hanpan / Mahjong Round / 一局麻将).
4. **Catching a copy mistake**: I only realized, after actually putting it on screen, that re-mentioning the word you're trying to avoid — even in negated form, like "not a matching game" — backfires. From then on, the rule became: never use that word at all in brand-facing copy.
5. **Carrying it into the code**: added a multilingual `appTitle` field to `strings.dart`, updated the launcher name in AndroidManifest/Info.plist, changed the package ID (and the Kotlin source path), and rewrote all 9 store listing files.
6. **Resetting the version and redeploying**: since a changed package ID means a new app to the store, I rolled the test version number back to 1.0.0, rebuilt, and installed it fresh on the test phone.

I expected changing a brand name to mean editing a few text files. In practice, it turned out to be chained all the way through the app's code, platform configuration, store copy, and package ID. And more than anything, I confirmed again that whether a name actually works shows up far more clearly **once it's rendered on an actual screen** than it ever does on paper.
