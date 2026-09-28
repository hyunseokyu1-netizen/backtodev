---
title: '앱 이름을 나라별로 다르게 보여주기 — 패키지명은 그대로 두고 표시 이름만 바꾸는 법'
date: '2026-08-07'
publish_date: '2026-10-15'
description: 부르기 어려운 앱 이름을 한국어 믹스테이프, 영어 Repo Tape로 바꾸면서 Android·iOS 로케일 리소스를 나누고, 패키지명을 건드리면 안 되는 이유를 확인한 기록
tags:
  - Flutter
  - Android
  - iOS
  - 다국어
  - 앱 배포
---

## "그 카세트 앱 뭐였지?"

카세트 테이프 음악 앱을 만들어서 스토어에 올려두고 지인들한테 뿌렸는데, 같은 반응이 반복됐다.

"그... 카세트 뭐시기 앱 이름이 뭐였더라?"

앱 이름이 `Cassette Player`였다. 뜻은 명확한데 아무도 기억을 못 했다. 일반명사 두 개를 붙여놓으니 부를 때마다 "카세트 플레이어"라고 또박또박 발음해야 하고, 그렇게 부르면 그냥 기기 이름 같아서 앱을 가리키는 말로 안 들린다. 스토어에서 검색해도 동명의 앱이 수십 개 나온다.

그래서 이름을 바꾸기로 했다. 조건은 하나, **부르기 편할 것**.

- 한국어: `믹스테이프` — 앱이 하는 일(내 노래 모아서 테이프 만들기)이 단어 하나에 다 들어간다
- 영어: `Repo Tape` — 짧고, 검색했을 때 겹치는 게 없다

여기서 바로 궁금해졌다. **하나의 앱이 나라별로 다른 이름을 가질 수 있나?** 결론부터 말하면 된다. 그리고 이미 스토어에 배포된 앱이라면 **절대 건드리면 안 되는 것**이 따로 있다. 그걸 모르고 이름을 바꾸면 기존 사용자 데이터가 통째로 날아간다.

## 먼저: 앱 "이름"은 한 곳이 아니다

작업을 시작하면서 앱 이름이 박힌 곳을 전부 찾아봤다. 생각보다 많았다.

```bash
grep -rn -i "cassette player" --include="*.dart" --include="*.xml" \
  --include="*.plist" --include="*.yaml" .
```

결과를 성격별로 나누니 이렇게 정리됐다.

| 구분 | 위치 | 바꿔도 되나 |
|---|---|---|
| 홈 화면 아이콘 이름 | `AndroidManifest.xml`의 `android:label` | ✅ 바꿔야 함 |
| 홈 화면 아이콘 이름 (iOS) | `Info.plist`의 `CFBundleDisplayName` | ✅ 바꿔야 함 |
| 앱 내부 UI 문구 | 스플래시, 헤더, 설정 화면, 미디어 알림 | ✅ 바꿔야 함 |
| 공유 텍스트 문구 | 테이프 공유 시 붙는 안내 문장 | ✅ 바꿔야 함 |
| **Dart 패키지명** | `pubspec.yaml`의 `name:` | ❌ **절대 금지** |
| **Android applicationId** | `build.gradle.kts` | ❌ **절대 금지** |
| 스토어에 보이는 이름 | Play Console 설정값 | ⚠️ 코드로 못 바꿈 |

아래 세 개가 이 작업의 핵심이다. 하나씩 보자.

## 절대 건드리면 안 되는 것 1: applicationId

`android/app/build.gradle.kts`에 이런 게 있었다.

```kotlin
android {
    namespace = "com.hscassette.cassette_player"
    defaultConfig {
        // 기존 앱과 동일한 applicationId — 업데이트 배포로 사용자 데이터 마이그레이션 전제
        applicationId = "com.hscassette.player"
    }
}
```

`applicationId`는 **Play Store가 앱을 식별하는 유일한 키**다. 이름이 아니라 주민등록번호에 가깝다.

이걸 바꾸면 어떻게 되냐면, 스토어는 그걸 "이름이 바뀐 같은 앱"으로 보지 않고 **완전히 다른 새 앱**으로 인식한다. 결과는 이렇다.

1. 기존 사용자에게 업데이트가 안 나간다
2. 새로 설치하면 기존 앱과 별개로 깔린다 (아이콘이 두 개)
3. **기존 앱에 저장된 데이터에 접근할 수 없다** — 안드로이드는 앱 데이터 디렉토리를 applicationId로 격리하기 때문
4. 기존 앱의 리뷰·다운로드 수를 못 이어받는다

내 앱은 사용자가 직접 만든 테이프 목록이 로컬 DB에 들어 있다. applicationId를 바꿨다면 사용자들이 몇 달 동안 모은 믹스테이프가 전부 사라지는 거다. 이름 좀 예쁘게 바꾸자고 할 짓이 아니다.

`namespace`(코드 패키지 경로)와 `applicationId`(스토어 식별자)가 다른 것도 눈여겨볼 만하다. 이 앱은 원래 React Native로 만들었다가 Flutter로 다시 만든 거라, 코드 경로는 새로 잡되 스토어 식별자는 옛날 것을 그대로 물려받은 상태였다.

## 절대 건드리면 안 되는 것 2: Dart 패키지명

`pubspec.yaml`의 `name: cassette_player`도 그대로 뒀다. 이건 스토어와는 무관하지만 바꾸면 다른 의미로 골치 아프다.

```dart
import 'package:cassette_player/app/app.dart';
import 'package:cassette_player/core/database/app_database.dart';
```

프로젝트 안의 모든 `import` 경로가 이 이름을 쓴다. 테스트 파일까지 포함하면 수십 군데다. 바꿔서 얻는 이득이 전혀 없다 — 이 이름은 사용자에게 절대 안 보인다. `description`만 새 이름으로 고쳤다.

```yaml
name: cassette_player                    # 그대로
description: "Repo Tape (믹스테이프) - cassette tape music player"   # 이것만 수정
version: 2.1.0+210
```

## Step 1. Android — 로케일별 문자열 리소스로 빼기

원래 매니페스트는 이름이 하드코딩되어 있었다.

```xml
<application
    android:label="Cassette Player"
    android:icon="@mipmap/ic_launcher">
```

이걸 문자열 리소스 참조로 바꾼다.

```xml
<application
    android:label="@string/app_name"
    android:icon="@mipmap/ic_launcher">
```

그리고 리소스 파일 두 개를 만든다. 안드로이드는 `values-<언어코드>` 폴더가 있으면 기기 언어에 맞춰 자동으로 골라준다.

`android/app/src/main/res/values/strings.xml` (기본값 = 한국어가 아닌 모든 기기)

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- 홈 화면 아이콘 이름 (기본: 영어) -->
    <string name="app_name">Repo Tape</string>
</resources>
```

`android/app/src/main/res/values-ko/strings.xml` (한국어 기기)

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- 홈 화면 아이콘 이름 (기기 언어가 한국어일 때) -->
    <string name="app_name">믹스테이프</string>
</resources>
```

폴더 이름의 `-ko`가 전부다. 코드는 한 줄도 안 짜도 된다. Flutter 프로젝트라도 이 부분은 순수 안드로이드 리소스 시스템이라 똑같이 동작한다.

## Step 2. iOS — 여기가 훨씬 까다롭다

iOS는 `Info.plist`의 `CFBundleDisplayName`을 기본값으로 두고, 언어별 값은 `<언어>.lproj/InfoPlist.strings`에 넣는다.

```xml
<key>CFBundleDisplayName</key>
<string>Repo Tape</string>
```

`ios/Runner/ko.lproj/InfoPlist.strings` 파일을 만들고:

```
/* 홈 화면 아이콘 이름 (한국어) */
"CFBundleDisplayName" = "믹스테이프";
"CFBundleName" = "믹스테이프";
```

여기까지는 쉬운데, **파일만 만들어서는 동작하지 않는다.** Xcode 프로젝트에 리소스로 등록되어 있지 않으면 빌드할 때 앱 번들에 안 들어간다. 보통은 Xcode를 열어서 GUI로 처리하지만, `project.pbxproj`를 직접 편집하려면 네 군데를 손봐야 한다.

1. `PBXFileReference` — 파일 자체 등록
2. `PBXVariantGroup` — 언어별 파일을 묶는 그룹 (`InfoPlist.strings`라는 논리적 이름 하나로 묶임)
3. `PBXBuildFile` + `PBXResourcesBuildPhase` — 리소스 복사 단계에 포함
4. `knownRegions` — 프로젝트가 아는 언어 목록에 `ko` 추가

```
knownRegions = (
    en,
    Base,
    ko,          ← 추가
);
```

`pbxproj`는 문법이 조금만 깨져도 Xcode가 프로젝트를 아예 못 연다. 그래서 편집 후 검증을 걸었다. 이 파일은 옛날 형식 plist라 `plutil`로 문법 검사가 된다.

```bash
$ plutil -lint ios/Runner.xcodeproj/project.pbxproj
ios/Runner.xcodeproj/project.pbxproj: OK
```

다만 문법이 맞다고 Xcode가 정상으로 읽는다는 보장까지는 아니다. `xcodebuild -list`로 한 번 더 확인하면 좋은데, 내 맥에는 Command Line Tools만 깔려 있어서 이 검증은 못 했다. iOS 배포 계획이 있다면 Xcode에서 한 번 열어보는 게 안전하다.

## Step 3. 앱 내부 문구는 한 곳에서 관리

앱 안에서도 이름이 여기저기 하드코딩되어 있었다. 스플래시 화면, 플레이어 헤더, 설정의 앱 정보, 잠금화면 미디어 알림까지.

이미 언어 분기용 헬퍼가 있어서 거기에 접근자 하나를 추가했다.

```dart
/// 영문 앱 이름. 공유 텍스트처럼 받는 사람의 언어를 알 수 없는 곳에서도 쓰인다.
const kAppNameEn = 'Repo Tape';

class L10n {
  const L10n(this.isKo);
  final bool isKo;

  String t(String ko, String en) => isKo ? ko : en;

  /// 앱 표시 이름. 영어권에는 브랜드명 그대로, 한국어에는 의미가 바로 읽히는 이름.
  String get appName => isKo ? '믹스테이프' : kAppNameEn;
}
```

이제 하드코딩된 곳을 전부 이걸로 바꾼다.

```dart
// before
title: 'Cassette Player',
// after
title: ref.watch(l10nProvider).appName,
```

이름을 또 바꿀 일이 생겨도 이제 한 곳만 고치면 된다. 이런 작업은 처음부터 상수로 뺐어야 했는데, 급하게 만들 때는 늘 문자열을 그냥 박아넣게 된다.

## 하마터면 놓칠 뻔한 것: 공유 텍스트 호환성

이 앱에는 테이프를 텍스트로 공유하는 기능이 있다. 이런 형식이다.

```
📼 Cassette Player 2 — Mixtape
「사랑노래」 · Side A: 7 tracks / Side B: 7 tracks

Paste this whole message into [Import Tape] in Cassette Player 2.

CT2:eyJ2IjoxLCJuYW1lIjoi...
```

앱 이름이 문구에 들어 있으니 당연히 바꿔야 하는데, 여기서 멈칫했다. **이미 사용자들이 주고받은 공유 텍스트는 옛날 문구 그대로다.** 문구를 바꾸면 그 텍스트를 못 읽게 되는 거 아닌가?

파싱 코드를 확인해보니 다행히 문제없었다.

```dart
final strict = RegExp(r'CT2:([A-Za-z0-9+/=]+)').firstMatch(text)?.group(1);
```

파서는 `CT2:` 프리픽스 뒤의 base64만 읽는다. 위에 붙은 안내 문구는 사람이 읽으라고 있는 장식일 뿐 파싱에 관여하지 않는다. **`CT2:` 프리픽스만 그대로 두면** 안내 문구는 마음대로 바꿔도 예전 공유 텍스트가 계속 열린다.

이런 건 바꾸기 전에 반드시 파서를 열어보고 확인해야 한다. 만약 파서가 첫 줄의 앱 이름까지 검사하는 구조였다면, 문구를 바꾸는 순간 기존 사용자들의 공유 텍스트가 전부 깨졌을 것이다.

## 검증 — 빌드해서 실제로 확인하기

리소스 분기는 코드로는 확인이 안 되니 실제 빌드 산출물을 열어봐야 한다. Android SDK의 `aapt2`를 쓰면 APK 안의 라벨을 언어별로 다 볼 수 있다.

```bash
AAPT=$(ls ~/Library/Android/sdk/build-tools/*/aapt2 | tail -1)
$AAPT dump badging build/app/outputs/flutter-apk/app-release.apk \
  | grep -E "^package:|application-label"
```

결과:

```
package: name='com.hscassette.player' versionCode='210' versionName='2.1.0'
application-label:'Repo Tape'
application-label-af:'Repo Tape'
application-label-de:'Repo Tape'
application-label-ja:'Repo Tape'
application-label-ko:'믹스테이프'      ← 한국어만 다름
application-label-zh-CN:'Repo Tape'
...
```

`application-label-ko`만 `믹스테이프`이고 나머지 80여 개 로케일은 전부 `Repo Tape`. 의도한 대로다. `package: name`이 그대로인 것도 여기서 같이 확인된다.

## 트러블슈팅

**1. 위젯 테스트가 깨진다**

스플래시 문구를 검사하던 테스트가 실패했다.

```dart
expect(find.text('CASSETTE PLAYER'), findsOneWidget);
```

Flutter 테스트 환경의 기본 로케일은 `en_US`다. 그래서 영문 이름으로 고쳤다.

```dart
// 테스트 로케일은 en → 영문 앱 이름
expect(find.text('REPO TAPE'), findsOneWidget);
```

한국어 분기까지 테스트하려면 `PlatformDispatcher`의 로케일을 오버라이드해야 하는데, 거기까지는 안 했다.

**2. `const` 위젯이 걸린다**

하드코딩 문자열을 변수로 바꾸면 `const` 생성자를 쓸 수 없다.

```dart
// before
const Text('CASSETTE PLAYER', style: TextStyle(...))
// after — const를 Text에서 TextStyle로 옮긴다
Text(isKorean ? '믹스테이프' : 'REPO TAPE', style: const TextStyle(...))
```

**3. 설정 화면의 버전이 안 맞았다**

작업하다 발견한 건데, 설정의 앱 정보에 버전이 `2.0.0`으로 하드코딩되어 있었다. `pubspec.yaml`은 `2.1.0`인데. 이런 건 `package_info_plus`로 실제 빌드 버전을 읽어오는 게 맞지만, 일단은 문자열만 맞춰뒀다.

## 코드로 안 되는 마지막 한 조각

여기까지 하면 **홈 화면 아이콘 이름**은 기기 언어에 따라 바뀐다. 하지만 **스토어 목록에 보이는 앱 이름은 여전히 옛날 이름**이다.

이건 APK 안에 있는 값이 아니라 Play Console에 따로 저장된 설정값이라, 코드로는 절대 못 바꾼다. Play Console → 성장 → 스토어 등록정보에서 직접 수정해야 하고, 언어별로 따로 입력한다.

| 위치 | 어떻게 바뀌나 |
|---|---|
| 홈 화면 아이콘 | AAB에 포함 → 업데이트 설치하면 자동 |
| 스토어 목록 이름 | Play Console에서 **수동 입력** |
| 스토어 스크린샷·그래픽 | 이미지 안에 옛 이름이 찍혀 있으면 다시 만들어야 함 |

세 번째도 흔히 놓친다. 피처 그래픽에 앱 이름을 큼직하게 박아뒀다면, 스토어 이름만 바꿔봐야 이미지에는 옛날 이름이 그대로 남는다.

## 정리

이름 바꾸기는 단순해 보이는데 실제로는 "어디까지가 이름이고 어디부터가 식별자인가"를 구분하는 작업이었다.

1. **식별자는 절대 안 건드린다** — `applicationId`, Dart 패키지명. 바꾸면 기존 사용자 데이터가 날아간다
2. **표시 이름은 리소스로 뺀다** — Android는 `values/`·`values-ko/`, iOS는 `.lproj/InfoPlist.strings`
3. **앱 내부 문구는 한 곳에 모은다** — 다음에 또 바꿀 때를 위해
4. **기존 데이터와의 호환성을 먼저 확인한다** — 공유 텍스트 파서가 이름을 검사하는지
5. **빌드 산출물로 검증한다** — `aapt2 dump badging`의 `application-label-ko`
6. **스토어 등록정보는 별도로 손댄다** — 코드로는 안 된다

한국어와 영어 이름을 다르게 가져가는 게 처음엔 좀 이상하게 느껴졌는데, 실제로 써보니 자연스럽다. 한국 사용자에게는 "믹스테이프"라는 말이 앱이 하는 일을 그대로 설명해주고, 영어권에서는 `Repo Tape`가 검색으로 찾기 쉽다. 한 이름으로 두 마리 토끼를 잡으려다 아무도 못 부르는 이름이 되는 것보다는 낫다는 결론이다.
