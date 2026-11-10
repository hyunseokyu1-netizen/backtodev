---
title: 'How to Add Google AdMob to a Flutter App — and Not Confuse It With AdSense'
date: '2026-07-12'
publish_date: '2026-11-11'
description: How to wire up banner, interstitial, and rewarded ads in a Flutter app with google_mobile_ads, plus everything you need to check before you start
tags:
  - Flutter
  - AdMob
  - google_mobile_ads
  - Mobile Ads
  - App Monetization
---

# How to Add Google AdMob to a Flutter App

While getting the mahjong game app I'm building ("Mahjong Joy") ready for the store, the question "should I put ads in this?" came up naturally. But the moment I started searching, there was one thing that immediately confused me: **AdSense and AdMob are different products.**

- **AdSense**: ads for a website. Drop one line of code into a blog or homepage and you're done.
- **AdMob**: ads for a mobile app (iOS/Android). You need to integrate an SDK into the app.

Both use Google's ad network, but how you integrate them and how they're reviewed are completely different. I'd actually used AdSense on my web blog before, so I figured "it'll be similar" — only to find out it's a totally different setup process. This post is my writeup of that process.

Full disclosure up front: I haven't actually added ads to this app yet. It's a casual game with a beginner mode, good for playing with a kid, and I wasn't sure it made sense to slap ads onto a brand-new app with zero downloads — so I wrote up the method and put the decision on hold. Still, knowing "how to wire it up" ahead of time makes the eventual decision faster, so I used this as an opportunity to walk through the whole flow.

## What to Check Before You Even Start

There's stuff you need to confirm before writing any code. Skip this and drop the SDK straight in, and you'll get blocked in review later.

1. **Create an AdMob account** — register the app at [admob.google.com](https://admob.google.com). You need the app already live on the store to get an official app ID, but early in registration you can still get a test ID even while the app is listed as "unpublished."
2. **Check whether it targets children/families** — this is the most important one. Google Play has a [Families Policy](https://support.google.com/googleplay/android-developer/answer/9893335), and if your app primarily targets children, or is judged likely to be used by children, strong restrictions kick in around ad content ratings and how you collect personal data. A game like mine — a "casual game families can play together" — sits right on that ambiguous boundary, so you need to fill out Play Console's **target audience survey** first to see where you land.
3. **Prepare a privacy policy URL** — ad SDKs collect things like the advertising ID (IDFA/AAID), so a privacy policy that discloses this is mandatory. You'll need this for the store listing anyway, so just build it ahead of time.
4. **Plan for a consent dialog (UMP SDK) if targeting EU users** — because of GDPR, you need to get ad-tracking consent from European users first. This is also handled via SDK, but it affects integration order (ad requests should only go out after consent is obtained).

Skip these four and jump straight into code, and you can end up with a fully integrated SDK that still gets rejected in store review.

## Step 1: Install the Package

The official Flutter package is `google_mobile_ads`.

```yaml
# pubspec.yaml
dependencies:
  google_mobile_ads: ^5.2.0
```

```bash
flutter pub get
```

## Step 2: Register the App ID in Native Config

AdMob issues an **app-level ID** and a separate **ad unit ID** for each type (banner/interstitial/rewarded). The app ID needs to be baked into the native manifest.

**Android** — inside the `<application>` tag of `android/app/src/main/AndroidManifest.xml`:

```xml
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy"/>
```

**iOS** — `ios/Runner/Info.plist`:

```xml
<key>GADApplicationIdentifier</key>
<string>ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy</string>
```

First trap here: **until you drop in your actual issued ID, you must use Google's published test app ID.** Keep requesting ads with your real ID during development and it can get flagged as "invalid traffic," which can get your account suspended.

```
Android 테스트 앱 ID: ca-app-pub-3940256099942544~3347511713
iOS 테스트 앱 ID:     ca-app-pub-3940256099942544~1458002511
```

## Step 3: Initialize the SDK

Initialize it in `main()` before the app starts.

```dart
import 'package:flutter/material.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await MobileAds.instance.initialize();
  runApp(const MyApp());
}
```

## Step 4: Wiring Up Each Ad Type

AdMob offers several ad formats, and for a casual game you usually pick from these three.

### Banner Ads — Fixed to a Corner of the Screen

The most familiar format. Sticks like a strip to the top or bottom of the screen.

```dart
class BannerAdWidget extends StatefulWidget {
  const BannerAdWidget({super.key});
  @override
  State<BannerAdWidget> createState() => _BannerAdWidgetState();
}

class _BannerAdWidgetState extends State<BannerAdWidget> {
  BannerAd? _banner;

  @override
  void initState() {
    super.initState();
    _banner = BannerAd(
      // 테스트 광고 유닛 ID (배너용)
      adUnitId: 'ca-app-pub-3940256099942544/6300978111',
      size: AdSize.banner,
      request: const AdRequest(),
      listener: BannerAdListener(
        onAdLoaded: (_) => setState(() {}),
        onAdFailedToLoad: (ad, error) => ad.dispose(),
      ),
    )..load();
  }

  @override
  void dispose() {
    _banner?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_banner == null) return const SizedBox.shrink();
    return SizedBox(
      width: _banner!.size.width.toDouble(),
      height: _banner!.size.height.toDouble(),
      child: AdWidget(ad: _banner!),
    );
  }
}
```

A banner is always visible somewhere on the game screen, so it pays less per impression, but its downside is that it gets in the way of gameplay. For a layout that's already packed, like Mahjong Joy's, just finding a place to put it becomes its own headache.

### Interstitial Ads — Full-Screen, Timing-Based

Shown at natural transition points, like clearing a level or ending a round. Pays more than a banner, but show it too often and churn goes up.

```dart
InterstitialAd? _interstitial;

void _loadInterstitial() {
  InterstitialAd.load(
    adUnitId: 'ca-app-pub-3940256099942544/1033173712', // 테스트 ID
    request: const AdRequest(),
    adLoadCallback: InterstitialAdLoadCallback(
      onAdLoaded: (ad) => _interstitial = ad,
      onAdFailedToLoad: (error) => _interstitial = null,
    ),
  );
}

void _showInterstitial() {
  _interstitial?.show();
  _interstitial = null;
  _loadInterstitial(); // 다음 번을 위해 미리 로드
}
```

The key pattern is to **preload it and only call `show()` when it's needed.** If you start loading right at the moment you want to show it, the loading delay is fully visible to the user.

### Rewarded Ads — Voluntarily Watched by the User

Like "watch an ad to get a hint" — the user has to tap a button to play it, and gets a reward once they finish watching. Since there's no coercion, it generates the least UX pushback.

```dart
RewardedAd? _rewarded;

void _loadRewarded() {
  RewardedAd.load(
    adUnitId: 'ca-app-pub-3940256099942544/5224354917', // 테스트 ID
    request: const AdRequest(),
    rewardedAdLoadCallback: RewardedAdLoadCallback(
      onAdLoaded: (ad) => _rewarded = ad,
      onAdFailedToLoad: (error) => _rewarded = null,
    ),
  );
}

void _showRewarded(void Function(int amount) onReward) {
  _rewarded?.show(
    onUserEarnedReward: (ad, reward) => onReward(reward.amount.toInt()),
  );
  _rewarded = null;
  _loadRewarded();
}
```

If I ever add anything to Mahjong Joy, this is the approach I like best — something like "watch one ad before starting a new game and get extra beginner-mode hints," kept as an option you can simply ignore if you don't want it.

## Common Test Ad Unit IDs

During development, always verify with the official test IDs below. Swap in the real IDs only right before store release, after passing review.

| Type | Android Test ID |
|---|---|
| Banner | `ca-app-pub-3940256099942544/6300978111` |
| Interstitial | `ca-app-pub-3940256099942544/1033173712` |
| Rewarded | `ca-app-pub-3940256099942544/5224354917` |
| App Open | `ca-app-pub-3940256099942544/9257395921` |

IDs differ per platform (iOS has its own), so in a real project it's common to manage this with a `Platform.isAndroid` branch.

## Troubleshooting

**Ads don't show, and there's no error** — often you forgot to register a test device. If you're testing with the real app ID and ads just don't show on your Google account, register the device ID that shows up in the logs into `RequestConfiguration`'s `testDeviceIds`.

```dart
MobileAds.instance.updateRequestConfiguration(
  RequestConfiguration(testDeviceIds: ['본인_기기_ID']),
);
```

**The banner size looks weirdly cut off** — `AdSize.banner` is a fixed size (320×50), so to fit the screen width you need to get an adaptive size via `AdSize.getAnchoredAdaptiveBannerAdSize()`.

**It's ambiguous whether the app targets children** — if Play Console's target audience survey marks "usable by under 13 as well," you also need to set the `tagForChildDirectedTreatment` flag on the corresponding AdMob ad requests. Miss this and review will reject it.

## Wrap-Up

Summed up, the flow for adding AdMob to Flutter is:

1. **It's AdMob, not AdSense** — SDK integration, not a web snippet
2. **Policy review comes before code** — especially the Families Policy and privacy policy
3. **Register the app ID in the native manifest** — for Android and iOS separately
4. **Always use test IDs during development** — requesting with the real ID too early risks account suspension
5. **Pick an ad type by how much it intrudes on UX** — banner (always-on) < interstitial (timed) < rewarded (voluntary)

In the end, I decided not to add ads this time. I judged that the revenue from a brand-new app with zero downloads would be smaller than the loss from a banner intruding on a game screen I'd put real effort into. But having mapped out the method ahead of time, I'm now confident I could wire it in within a day whenever it's actually needed. What I learned this time is that for ad monetization, **"when to add it" is a far more important decision than "how to add it."**
