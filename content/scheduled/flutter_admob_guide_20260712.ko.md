---
title: 'Flutter 앱에 구글 애드몹(AdMob) 붙이는 법 — 애드센스와 헷갈리지 않기'
date: '2026-07-12'
publish_date: '2026-08-11'
description: Flutter 앱에 google_mobile_ads로 배너·전면·보상형 광고를 연동하는 방법과, 붙이기 전에 반드시 점검해야 할 것들 정리
tags:
  - Flutter
  - AdMob
  - google_mobile_ads
  - 모바일 광고
  - 앱 수익화
---

# Flutter 앱에 구글 애드몹(AdMob) 붙이는 법

만들고 있는 마작 게임 앱("마작 조이")을 스토어에 올릴 준비를 하다가, "여기에 광고 넣을까?"라는 질문이 자연스럽게 나왔다. 그런데 검색을 시작하면서 바로 헷갈리는 지점이 하나 있었다. **애드센스(AdSense)와 애드몹(AdMob)은 다른 제품**이라는 것.

- **애드센스**: 웹사이트에 붙이는 광고. 블로그나 홈페이지에 코드 한 줄 넣으면 끝.
- **애드몹**: 모바일 앱(iOS/Android)에 붙이는 광고. SDK를 앱에 통합해야 한다.

둘 다 구글 광고 네트워크를 쓴다는 점은 같지만, 붙이는 방식도 심사 기준도 완전히 다르다. 내가 실제로 웹 블로그에는 애드센스를 써봤어서 "그거랑 비슷하겠지"라고 생각했다가, 전혀 다른 설정 과정이라는 걸 알게 됐다. 이 글은 그 과정을 정리한 것이다.

먼저 밝혀두면, 나는 아직 이 앱에 실제로 광고를 넣지 않았다. 초보자 모드까지 있어서 아이와 같이 하기 좋은 캐주얼 게임인데, 다운로드 하나 없는 신규 앱에 광고부터 붙이는 게 맞나 싶어서 방법만 정리해두고 보류 중이다. 그래도 "어떻게 붙이는지"는 미리 알아두면 나중에 결정이 빨라지니, 이번 기회에 전체 흐름을 훑어봤다.

## 사전에 반드시 점검할 것

코드보다 먼저 확인해야 하는 게 있다. 이걸 건너뛰고 바로 SDK부터 넣으면 나중에 심사에서 막힌다.

1. **애드몹 계정 만들기** — [admob.google.com](https://admob.google.com)에서 앱 등록. 앱이 스토어에 이미 있어야 정식 앱 ID가 나오지만, 등록 초기에는 "게시되지 않은 앱"으로도 테스트용 ID를 받을 수 있다.
2. **아동/가족 대상 여부 확인** — 이게 제일 중요하다. Google Play는 [Families Policy](https://support.google.com/googleplay/android-developer/answer/9893335)라는 게 있어서, 앱이 아동을 주 타겟으로 하거나 아동도 이용할 걸로 판단되면 광고 콘텐츠 등급, 개인정보 수집 방식에 강한 제약이 걸린다. 내 마작 게임처럼 "가족이 같이 해도 좋은 캐주얼 게임"이면 애매한 경계에 걸치므로, Play Console의 **대상 연령층 설문**을 먼저 작성해보고 답이 나와야 한다.
3. **개인정보처리방침 URL 준비** — 광고 SDK는 광고 ID(IDFA/AAID) 등을 수집하므로, 이를 명시한 개인정보처리방침이 필수다. 스토어 등록 때 어차피 필요한 항목이니 미리 만들어두자.
4. **EU 사용자 대상이면 동의창(UMP SDK) 계획** — GDPR 때문에 유럽 사용자에게는 광고 추적 동의를 먼저 받아야 한다. 이것도 SDK로 처리하지만, 붙이는 순서에 영향을 준다(동의를 받은 후에만 광고 요청).

이 네 가지를 안 보고 코드부터 짜면, SDK 통합은 다 됐는데 스토어 심사에서 반려되는 상황이 생긴다.

## Step 1: 패키지 설치

Flutter 공식 패키지는 `google_mobile_ads`다.

```yaml
# pubspec.yaml
dependencies:
  google_mobile_ads: ^5.2.0
```

```bash
flutter pub get
```

## Step 2: 앱 ID를 네이티브 설정에 등록

애드몹은 **앱 단위 ID**와 **광고 유닛(배너/전면/보상형별) ID**를 따로 발급한다. 앱 ID는 네이티브 매니페스트에 박아 넣어야 한다.

**Android** — `android/app/src/main/AndroidManifest.xml`의 `<application>` 태그 안:

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

여기서 첫 번째 함정: **이 ID를 실제 발급받은 걸로 넣기 전까지는 반드시 구글이 공개한 테스트 앱 ID를 써야 한다.** 실제 ID로 개발 중에 광고를 계속 요청하면 "무효 트래픽"으로 잡혀서 계정이 정지될 수 있다.

```
Android 테스트 앱 ID: ca-app-pub-3940256099942544~3347511713
iOS 테스트 앱 ID:     ca-app-pub-3940256099942544~1458002511
```

## Step 3: SDK 초기화

`main()`에서 앱 시작 전에 초기화한다.

```dart
import 'package:flutter/material.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await MobileAds.instance.initialize();
  runApp(const MyApp());
}
```

## Step 4: 광고 유형별로 붙이기

애드몹은 광고 형태가 여러 개인데, 캐주얼 게임엔 보통 이 셋 중에서 고른다.

### 배너 광고 — 화면 한켠에 고정

가장 눈에 익은 형태. 화면 상/하단에 띠처럼 붙는다.

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

배너는 게임 화면 어딘가에 항상 떠 있어서 광고 단가는 낮지만, 게임 플레이를 방해한다는 게 단점이다. 마작 조이처럼 화면이 이미 꽉 찬 레이아웃이면 붙일 자리부터 고민이 된다.

### 전면 광고 — 화면 전체를 덮는 타이밍형

레벨 클리어, 판 종료 같은 자연스러운 전환 시점에 띄운다. 배너보다 단가가 높지만 너무 자주 띄우면 이탈률이 올라간다.

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

**미리 로드해두고 필요할 때 show()만 호출**하는 패턴이 핵심이다. 보여줄 타이밍에 load부터 하면 로딩 지연이 그대로 노출된다.

### 보상형 광고 — 사용자가 자발적으로 시청

"광고 보고 힌트 받기"처럼, 사용자가 버튼을 눌러야 재생되고 다 보면 보상을 준다. 강제성이 없어서 UX 반발이 제일 적다.

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

마작 조이에 뭔가 넣는다면 이 방식이 가장 마음에 든다. "새 대국을 시작하기 전에 광고 하나 보면 초보자 모드 힌트를 더 준다" 정도로, 원치 않으면 그냥 무시할 수 있는 선택지로 두는 것.

## 자주 쓰는 테스트 광고 유닛 ID 표

개발 중엔 아래 공식 테스트 ID로 항상 검증한다. 실제 ID는 심사 통과 후 스토어 배포 직전에만 바꿔 끼운다.

| 유형 | Android 테스트 ID |
|---|---|
| 배너 | `ca-app-pub-3940256099942544/6300978111` |
| 전면 | `ca-app-pub-3940256099942544/1033173712` |
| 보상형 | `ca-app-pub-3940256099942544/5224354917` |
| 앱 오프닝 | `ca-app-pub-3940256099942544/9257395921` |

플랫폼별(iOS)로 ID가 다르므로, 실제 프로젝트에선 `Platform.isAndroid` 분기로 관리하는 게 일반적이다.

## 트러블슈팅

**광고가 안 뜨는데 에러도 없다** — 테스트 기기 등록을 빼먹은 경우가 많다. 실제 앱 ID로 테스트하면서 구글 계정에 광고가 안 뜨면, 로그에 찍히는 기기 ID를 `RequestConfiguration`의 `testDeviceIds`에 등록해야 한다.

```dart
MobileAds.instance.updateRequestConfiguration(
  RequestConfiguration(testDeviceIds: ['본인_기기_ID']),
);
```

**배너 크기가 이상하게 잘린다** — `AdSize.banner`는 고정 크기(320×50)라, 화면 폭에 맞추려면 `AdSize.getAnchoredAdaptiveBannerAdSize()`로 적응형 크기를 받아와야 한다.

**앱이 아동 대상인지 애매하다** — Play Console의 대상 연령층 설문에서 "만 13세 미만도 이용 가능"에 해당하면, 애드몹 쪽에서도 해당 광고 요청에 `tagForChildDirectedTreatment` 플래그를 설정해야 한다. 이걸 빠뜨리면 심사에서 반려된다.

## 정리

Flutter에 애드몹 붙이는 흐름을 한 줄로 요약하면:

1. **애드센스 아니고 애드몹** — 웹이 아니라 SDK 통합
2. **정책 점검이 코드보다 먼저** — 특히 Families Policy, 개인정보처리방침
3. **네이티브 매니페스트에 앱 ID 등록** — Android/iOS 각각
4. **개발 중엔 무조건 테스트 ID** — 실제 ID로 미리 요청하면 계정 정지 위험
5. **광고 유형은 UX 침해 정도 순으로 고르기** — 배너(상시) < 전면(타이밍) < 보상형(자발적)

나는 결국 이번엔 광고를 넣지 않기로 했다. 다운로드가 아직 0인 신규 앱에서 얻을 수익보다, 공들여 만든 게임 화면에 배너가 끼어드는 손실이 더 크다고 판단해서다. 하지만 방법을 미리 정리해두니, 나중에 정말 필요할 때는 하루 안에 붙일 수 있겠다는 확신이 생겼다. 광고 수익화는 "언제 넣을지"가 "어떻게 넣을지"보다 훨씬 중요한 결정이라는 걸 이번에 배웠다.
