---
title: '15년 된 안드로이드 게임을 되살려보기 (2) — 세 겹의 벽을 만나고, 결국 새로 만들기로 했다'
date: '2026-07-10'
publish_date: '2026-07-28'
description: 2011년 유니티 게임의 라이선스 체크를 패치해 재서명까지 성공했지만 최신폰에서 세 겹의 네이티브 벽에 막혀 실행에 실패하고, 결국 분석한 게임 구성을 바탕으로 Flutter로 고스톱을 새로 만들어 갤럭시 S24 FE에서 구동에 성공한 기록
tags:
  - Android
  - Flutter
  - apktool
  - 리버스엔지니어링
  - Unity
---

## 지난 편 요약, 그리고 이번 편의 반전

[지난 편](/)에서 2011년에 나온 안드로이드 게임 `Dice Cafe`(보드게임 14종이 들어있는 유니티 게임)가 요즘 폰에서 실행되자마자 꺼지는 이유를 추적했다. 결론은 **Google Play 라이선스 체크(LVL)**가 범인이었다. 스토어에서 정식으로 산 게 아니면 인증에 실패하면서 앱이 스스로 종료되는 구조였다.

"그럼 그 체크만 무력화하면 되겠네?" — 이번 편은 그 패치를 실제로 해서, 재서명까지 마치고, 폰에 설치하는 이야기다. 그리고 **거기서 만난 세 겹의 벽**과, 결국 게임을 되살리는 대신 **새로 만들기로 방향을 튼** 과정까지다.

스포일러: 원본은 끝내 못 살렸다. 하지만 게임은 폰에서 돌아간다. 무슨 소리인지 끝까지 읽어보시라.

## Step 1. 라이선스 체크를 걷어내고 재서명하기

지난 편에서 `apktool`로 APK를 스말리(smali)로 풀어놨다. 라이선스 검증은 유니티의 `UnityPlayer` 클래스가 네이티브 엔진에 넘겨주는 두 개의 콜백에 걸려 있었다.

- `showBuildSetup()` → 라이선스 통과 여부(`G` 필드)를 반환
- `showRuntimeSetup()` → 라이선스 체크 완료 여부(`H` 필드)를 반환

네이티브 엔진이 이 둘을 JNI로 폴링하다가 "체크는 끝났는데 통과는 못 했다"고 판단하면 앱을 죽인다. 그래서 두 메소드가 **항상 1(통과/완료)을 반환**하도록 스말리를 고쳤다.

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

여기에 더해, 애초에 Google Play 라이선싱 서비스에 접근하는 셋업 코드 자체를 `onDrawFrame` 시작부에서 건너뛰게 만들었다. 그리고 다시 빌드 → 정렬 → 서명.

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

여기까지는 깔끔하게 됐다. 서명 검증도 통과. "이제 폰에 꽂고 설치만 하면 되겠다" 싶었다. 그게 착각이었다.

## Step 2. 첫 번째 벽 — 요즘 폰엔 32비트가 없다

USB 디버깅으로 폰을 연결하고 설치를 때렸다.

```bash
adb install -r patched.apk
# Failure [INSTALL_FAILED_NO_MATCHING_ABIS: ... res=-113]
```

설치 자체가 거부됐다. `NO_MATCHING_ABIS` — "이 기기에서 돌릴 수 있는 네이티브 라이브러리가 없다"는 뜻이다.

원인은 CPU 아키텍처였다. 이 게임의 엔진 라이브러리(`libunity.so`, `libmono.so`)는 **32비트 ARM(armeabi-v7a) 전용**인데, 요즘 삼성 플래그십(내 경우 갤럭시 S24 FE)은 **64비트(arm64-v8a) 전용**이다. 32비트 ARM 실행을 하드웨어/OS 레벨에서 아예 빼버렸다.

기기가 지원하는 ABI는 이렇게 확인한다.

```bash
adb shell getprop ro.product.cpu.abilist
# arm64-v8a          ← 64비트 하나뿐. 32비트가 없다.
adb shell getprop ro.product.cpu.abilist32
# (빈 값)
```

32비트 라이브러리밖에 없는 앱은 64비트 전용 폰에 설치될 수가 없다. 라이선스는 뚫었는데, 그보다 더 아래 단계에서 막힌 것이다.

## Step 3. 두 번째 벽 — 구형 라이브러리를 최신 로더가 못 올린다

다행히 서랍에 조금 오래된 폰(LG V50, 안드로이드 12)이 있었다. 이건 `abilist`에 `armeabi-v7a`가 있어서 32비트를 지원한다. 설치는 성공. 그런데 실행하면 또 꺼진다. 이번엔 로그를 봤다.

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

두 가지가 얽혀 있었다.

1. **text relocation**: 2011년에 빌드된 `libmono.so`는 "텍스트 재배치"라는 옛날 방식을 쓰는데, 안드로이드는 앱의 `targetSdkVersion`이 23 이상이면 이런 라이브러리 로딩을 **강제로 막는다**. (설치가 되게 하려고 targetSdk를 24로 올렸던 게 오히려 이 차단을 불렀다. 그래서 22로 되돌렸다.)
2. targetSdk를 22로 낮추니 text relocation은 경고만 하고 통과했는데, 그다음에 **`no vspace available`** — 링커가 이 라이브러리를 메모리에 올릴 가상 주소 공간을 확보하지 못했다.

`libmono.so`는 108KB밖에 안 된다. 크기 문제가 아니라, **11년 전 라이브러리를 최신 안드로이드(64비트 커널)의 링커가 매핑하는 방식이 안 맞는** 근본적인 호환성 문제다. 이건 스말리나 매니페스트를 고쳐서 될 일이 아니다.

> 참고로 `targetSdk`를 23 미만으로 낮추면 안드로이드가 "권한 검토" 다이얼로그를 한 번 띄운다. 폰에서 직접 한 번 눌러줘야 앱이 뜬다. 이것도 처음엔 크래시로 오해했다.

## Step 4. 세 번째 벽 — 에뮬레이터도 32비트 ARM을 못 돌린다

"그럼 옛날 안드로이드 에뮬레이터를 만들어서 거기서 돌리면 되지 않을까?" 이게 마지막 희망이었다. 내 맥은 애플 실리콘(arm64)이다. 두 방향으로 시도했다.

| 시스템 이미지 | 부팅 | 32비트 앱 설치 | 결과 |
|---|---|---|---|
| arm64-v8a (Android 5.0) | ✅ | ❌ | `abilist32`가 비어있는 **64비트 전용** → 삼성폰과 동일하게 거부 |
| armeabi-v7a (Android 4.4) | ❌ | — | `FATAL: CPU Architecture 'arm' is not supported by the QEMU2 emulator` |

딜레마였다. 32비트 앱을 받아주는 이미지는 최신 에뮬레이터가 아예 부팅을 안 하고(32비트 ARM 게스트 구동 기능이 삭제됨), 부팅되는 arm64 이미지는 32비트 지원이 빠져있다. **애플 실리콘 맥에서는 이 게임을 돌릴 에뮬레이터가 없다.**

## 왜 "그냥 다시 빌드"도 안 되나

여기서 자연스럽게 드는 생각. "원본 유니티 프로젝트로 arm64로 다시 빌드하면 되잖아?" 두 가지 이유로 불가능했다.

1. **원본 소스가 없다.** APK에서 뽑아낼 수 있는 건 게임 로직이 담긴 .NET 어셈블리(`Assembly-CSharp.dll`)와 에셋뿐이다. 씬·프리팹·프로젝트 세팅이 없으면 유니티에서 다시 빌드할 수 없다.
2. **유니티 3.3은 64비트를 못 만든다.** 게임 데이터 헤더를 뜯어보니 `3.3.0f4`(2011년 1월)였다. 유니티가 arm64를 지원한 건 5.x(2015년)부터다. 설령 원본이 있어도 이 버전으로는 64비트 빌드가 원천적으로 안 나온다.

```bash
# 유니티 버전은 mainData 헤더에서 확인된다
strings assets/bin/Data/mainData | grep -E "^[0-9]+\.[0-9]+\.[0-9]"
# 3.3.0f4
```

정리하면, 라이선스 패치는 성공했지만 그 아래에 **CPU · 로더 · 에뮬레이터**라는 세 겹의 네이티브 벽이 있었고, 재빌드는 소스와 엔진 버전 양쪽에서 막혔다. 원본을 살리는 길은 여기서 끝났다.

## 방향 전환 — 살리는 대신, 새로 만든다

그런데 원인을 파는 과정에서 확보한 정보가 하나 있었다. `Assembly-CSharp.dll`을 뜯어보니 **게임 로직(체스, 오목, 고스톱, 마작, 장기 등 14종)은 아키텍처와 무관한 C# 코드**였다. 발목을 잡은 건 오직 2011년 유니티 엔진뿐이었다.

즉, **"게임 규칙과 화면 구성"이라는 알맹이는 이미 분석으로 파악됐으니, 그걸 담을 그릇(엔진)만 최신 것으로 새로 만들면 된다.** 원본 에셋을 베끼는 게 아니라, 분석한 규칙을 참고해 처음부터 다시 만드는 방향이다. 스택은 **Flutter**(하나의 코드로 안드로이드·iOS·웹), 첫 게임은 규칙이 까다로운 **고스톱**으로 잡았다.

```bash
# Flutter 설치 (Homebrew)
brew install --cask flutter

# 프로젝트 생성 (웹 + 안드로이드)
flutter create --platforms=web,android --org com.lixsoft --project-name dicecafe_app dicecafe_app
```

핵심은 **순수 로직과 UI를 분리**한 것이다. 화투 48장 덱과 점수 계산은 Flutter에 의존하지 않는 순수 Dart로 만들어서 유닛 테스트로 규칙을 검증했다.

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

점수 규칙은 헷갈리기 쉬워서(고도리가 몇 월인지, 비광 포함 삼광이 2점인지 등) 위키피디아의 Go-Stop 문서로 카드 구성과 족보를 한 번 정확히 확인한 뒤 코드에 박았다. 이렇게 하면 나중에 규칙을 추가해도 테스트가 지켜준다. 유닛 테스트 13개(덱 구성, 점수, 한 판 완주 시 카드 48장 보존)를 통과시켰다.

UI는 이미지 에셋이 없으니 카드를 색과 텍스트로 그렸다. 홍단은 빨강, 청단은 파랑, 광은 금색, 쌍피는 남색 식으로. 로비(14개 게임 그리드, 지금은 고스톱만 활성)와 고스톱 보드 두 화면을 만들었다.

빌드 전에 눈으로 확인하고 싶으면 웹으로 띄우는 게 제일 빠르다.

```bash
# 웹으로 빌드해서 정적 서버로 띄우고, headless 크롬으로 스크린샷
flutter build web
cd build/web && python3 -m http.server 8791 &
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --screenshot=out.png --window-size=760,1200 \
  --virtual-time-budget=10000 http://localhost:8791
```

## 결과 — 원본을 거부했던 그 폰에서 돌아간다

안드로이드 APK로 빌드했다.

```bash
flutter build apk --release
# ✓ Built build/app/outputs/flutter-apk/app-release.apk (45.0MB)
```

이 APK는 arm64를 포함한다. 그리고 **맨 처음 원본 32비트 게임을 `NO_MATCHING_ABIS`로 거부했던 바로 그 갤럭시 S24 FE**에 설치했다.

```bash
adb install -r app-release.apk
# Success
```

설치 성공. 실행하니 로비가 뜨고, 고스톱에 들어가니 화투 카드가 깔리고 AI 상대와 판이 돌아간다. 원본은 설치조차 거부했던 폰에서, 새로 만든 앱은 멀쩡히 플레이된다.

> 삼성폰에서 Flutter 화면은 `adb screencap`으로 캡처하면 검게 나온다(GPU 서피스 캡처 제약). 앱이 검은 게 아니라 캡처가 안 되는 것. 폰 잠금을 풀고 실제 화면을 보면 정상이다. 이것도 한참 헤맸다.

## 자주 쓴 명령어 요약

| 목적 | 명령어 |
|---|---|
| 기기 지원 ABI 확인 | `adb shell getprop ro.product.cpu.abilist` |
| 32비트 지원 여부 | `adb shell getprop ro.product.cpu.abilist32` |
| 실행 로그에서 크래시 추적 | `adb logcat -d \| grep -iE "linker\|UnsatisfiedLink"` |
| .so 아키텍처 확인 | `readelf -h libmono.so` (또는 `file libmono.so`) |
| 유니티 버전 확인 | `strings assets/bin/Data/mainData \| grep -E "^[0-9]+\.[0-9]"` |
| APK 재빌드/서명 | `apktool b` → `zipalign` → `apksigner sign` |
| Flutter 빌드 | `flutter build apk --release` / `flutter build web` |

## 트러블슈팅 메모

| 증상 | 원인 | 대응 |
|---|---|---|
| `INSTALL_FAILED_NO_MATCHING_ABIS` | 32비트 라이브러리뿐인데 기기가 64비트 전용 | 32비트 지원 기기 필요 (근본 해결 불가) |
| `has text relocations` UnsatisfiedLinkError | targetSdk 23+ 에서 구형 .so 로딩 차단 | targetSdk를 22 이하로 낮춤 |
| `cannot map library. no vspace available` | 최신 링커가 구형 text-relocation .so를 매핑 실패 | 리패키징으로 해결 불가 |
| `INSTALL_FAILED_VERIFICATION_FAILURE` | Play Protect의 사이드로드 검증 | `adb shell settings put global verifier_verify_adb_installs 0` |
| 에뮬레이터 `CPU Architecture 'arm' is not supported` | 최신 에뮬레이터가 32비트 ARM 게스트 미지원 | arm64 이미지 사용(단 32비트 앱은 못 돌림) |
| Flutter 화면이 `screencap`에서 검게 나옴 | GPU 서피스 캡처 제약 | 실제 화면 확인 / 잠금 해제 후 캡처 |

## 정리 — 한눈에 보는 흐름

1. **라이선스 패치**: 스말리에서 `showBuildSetup`/`showRuntimeSetup`을 항상 통과로 고치고 재서명 → 성공
2. **첫 번째 벽**: 최신폰은 arm64 전용이라 32비트 게임 설치 불가
3. **두 번째 벽**: 32비트 지원 구형폰에서도 최신 링커가 2011년 라이브러리를 못 올림(`no vspace`)
4. **세 번째 벽**: 애플 실리콘 맥의 에뮬레이터는 32비트 ARM 게스트 미지원
5. **재빌드도 불가**: 원본 소스 없음 + 유니티 3.3은 64비트 빌드 자체가 안 됨
6. **방향 전환**: 게임 로직(C#)은 아키텍처 독립적 → Flutter로 그릇만 새로 만들기
7. **결과**: 고스톱을 새로 구현, 원본을 거부했던 갤럭시 S24 FE에서 구동 성공

오래된 앱을 살리는 작업은 종종 이렇게 끝난다. 원본을 그대로 되살리는 건 실패해도, 그 과정에서 얻은 이해(무엇이 문제였고, 알맹이가 어디에 있는지)가 "새로 만들기"라는 더 나은 길을 열어준다. 다음 편에서는 고스톱에 뻑·따닥·쪽 같은 특수 규칙을 붙이고, 두 번째 게임을 추가하는 이야기를 해볼 생각이다.
