---
title: '15년 된 안드로이드 게임을 되살려보기 (1) — APK 리버싱으로 진짜 범인 찾기'
date: '2026-07-10'
publish_date: '2026-07-27'
description: 2011년에 나온 유니티 기반 안드로이드 게임이 요즘 폰에서 실행되자마자 꺼지는 이유를, androguard와 apktool로 APK를 뜯어보며 추적해 Google Play 라이선스 체크가 범인이라는 걸 찾아낸 과정
tags:
  - Android
  - APK
  - 리버스엔지니어링
  - androguard
  - apktool
---

## 옛날 게임 하나가 안 켜진다

옛날에 즐겨 하던 안드로이드 게임 APK 파일이 하나 굴러다니고 있었다. `Dice Cafe_v1.1.2.apk`, 2011년에 나온 게임이다. 설치는 되는데 실행하면 화면이 뜨자마자 바로 꺼진다. "서버 접속이 필요한 게임이라 서비스 종료되면서 죽은 건가?" 정도로만 짐작하고 있었는데, 막상 뜯어보기 전까진 확신할 수 없었다.

이럴 때 답은 둘 중 하나다. 개발사 서버가 없어져서 통신이 막혔거나, 아니면 요즘 안드로이드와 안 맞는 뭔가(구버전 런타임, 오래된 인증 방식 같은 것)가 있거나. 둘 중 뭐가 문제인지 알아야 고칠 방법도 정해지니까, 일단 APK 안을 들여다보기로 했다.

이 글은 그 원인을 찾아낸 과정의 기록이다. 아직 게임을 완전히 되살리진 못했고, 원인 파악까지가 이번 편의 범위다. (패치해서 다시 돌리는 건 다음 편에서.)

## 사전 준비 — 도구 설치

APK는 결국 ZIP 파일이라 `unzip -l`로 구조 정도는 바로 볼 수 있지만, `AndroidManifest.xml`이나 `classes.dex`는 바이너리 포맷이라 전용 도구가 필요하다. 이번에 쓴 건 두 가지다.

- **androguard**: 파이썬 기반, `AndroidManifest.xml` 파싱과 `classes.dex` 코드 분석(어떤 메소드가 어떤 클래스를 호출하는지 추적)까지 되는 라이브러리
- **apktool**: APK를 스말리(smali, dex 바이트코드의 어셈블리 같은 표현) 소스로 통째로 풀어주는 도구. 나중에 코드를 수정하고 다시 패키징할 때 필요

```bash
# androguard - 그냥 pip install 하면 막힌다 (Homebrew Python은 PEP 668로 시스템 전역 설치를 막아놓음)
pip3 install androguard
# error: externally-managed-environment

# 가상환경을 만들어서 그 안에 설치
python3 -m venv ./venv
./venv/bin/pip install androguard
```

```bash
# apktool은 Homebrew로 바로 설치 가능
brew install apktool
```

## Step 1. APK 구조부터 훑어보기

APK는 그냥 ZIP이니까, 도구 없이도 `unzip -l`로 뭐가 들었는지 먼저 볼 수 있다.

```bash
unzip -l "Dice Cafe_v1.1.2.apk" | head -20
```

```
     6514  ...   META-INF/MANIFEST.MF
   406528  ...   assets/bin/Data/Managed/Assembly-CSharp-firstpass.dll
  1773568  ...   assets/bin/Data/Managed/Assembly-CSharp.dll
   292864  ...   assets/bin/Data/Managed/Mono.Security.dll
  ...
  2495488  ...   assets/bin/Data/Managed/mscorlib.dll
   291068  ...   classes.dex
  3731964  ...   assets/libs/armeabi-v7a/libmono.so
  5542220  ...   assets/libs/armeabi-v7a/libunity.so
```

`Assembly-CSharp.dll`, `mscorlib.dll`, `libmono.so` — 이 조합을 보자마자 감이 왔다. **유니티(Unity) 엔진으로 만든 게임인데, 그것도 IL2CPP가 아니라 Mono 스크립팅 백엔드를 쓰던 시절 빌드**다. IL2CPP는 2015년 이후에 자리잡은 방식이니, 이 APK는 그보다 한참 전 것이라는 뜻이다. `classes.dex`는 따로 있는데, 이건 안드로이드 쪽 자바 코드(액티비티, 광고 SDK, 각종 안드로이드 API 연동)가 들어있는 부분이고, 실제 게임 로직은 `Assembly-CSharp.dll` 안의 C# 코드다.

## Step 2. 매니페스트부터 파싱해보기

`AndroidManifest.xml`은 APK 안에 바이너리 XML 형태로 들어있어서 그냥 열어보면 못 읽는다. androguard로 파싱했다.

```python
import logging
logging.disable(logging.CRITICAL)  # 안 끄면 디버그 로그가 화면을 뒤덮는다
from androguard.core.apk import APK

apk = APK("Dice Cafe_v1.1.2.apk")
print("Package:", apk.get_package())
print("Version:", apk.get_androidversion_name(), apk.get_androidversion_code())
print("Min/Target SDK:", apk.get_min_sdk_version(), apk.get_target_sdk_version())
print("Permissions:", apk.get_permissions())
print("Main activity:", apk.get_main_activity())
```

```
Package: com.lixsoft.DiceCafe
Version: 1.1.2 19
Min/Target SDK: 7 10
Permissions: ['android.permission.INTERNET', 'android.permission.ACCESS_NETWORK_STATE',
              'android.permission.WRITE_EXTERNAL_STORAGE', 'android.permission.READ_EXTERNAL_STORAGE']
Main activity: com.lixsoft.DiceCafe.DiceCafeActivity
```

`targetSdkVersion=10`은 안드로이드 2.3.3(진저브레드) 시절 기준이다. 요즘 폰(최신 안드로이드는 target 34 이상을 요구)에서는 이 값 자체가 설치 거부 사유가 될 수 있다는 걸 일단 메모해뒀다. 그리고 `INTERNET` 권한이 있으니 뭔가와는 통신을 시도한다는 것도 확인했다 — 문제는 그게 "게임 서버"인지 아닌지다.

## Step 3. 문자열 뒤져서 서버 주소 찾기

가장 빠른 방법은 `strings`로 바이너리 안의 텍스트를 다 뽑아서 URL/도메인 패턴만 걸러보는 것이다.

```bash
unzip -oq "Dice Cafe_v1.1.2.apk" -d apk_extract
cd apk_extract

strings classes.dex | grep -Eio '([a-z0-9.-]+\.(com|net|co\.kr|kr|io))[^"]*' | sort -u
```

```
ad.cauly.co.kr
click.cauly.co.kr
csi.cauly.co.kr:1109/csi?
downinfo.cauly.co.kr:1130/...
m.adtc.daum.net
mobileads.google.com
www.cauly.net
xconf.cauly.co.kr
```

전부 광고 네트워크(Cauly, AdMob, 다음 모바일광고) 도메인이다. 게임 로직이 들어있는 C# 어셈블리(`Assembly-CSharp.dll`)에도 같은 방식으로 찾아봤는데, 여긴 아예 URL 문자열이 하나도 없었다.

```bash
strings assets/bin/Data/Managed/Assembly-CSharp.dll | grep -Eio 'https?://[^ "]+'
# (결과 없음)
```

여기서 하나 확정됐다. **이 게임엔 자체 게임 서버가 없다.** 랭킹이나 계정 시스템을 서버에 물어보는 구조가 아니라는 뜻이다. 통신하는 건 광고 SDK뿐이고, 광고 서버가 죽었다고 앱 자체가 강제 종료되는 일은 보통 없다. 그러니 "서버 문제"라는 첫 가설은 기각. 원인은 다른 데 있다.

## Step 4. classes.dex에서 수상한 문자열 발견

서버가 원인이 아니라면 뭘까 싶어서, 이번엔 `classes.dex`에서 URL 말고 좀 더 넓게 문자열을 훑어봤다. 그러다 눈에 띄는 게 나왔다.

```bash
strings classes.dex | grep -iE 'license|checkLicense'
```

```
Calling checkLicense on service for
Error while determining license validity :
License retry timestamp (GT) missing, grace period disabled
LicenseChecker
LicenseValidator
RemoteException in checkLicense call.
com.android.vending.licensing.ILicenseResultListener
nativeGetLicenseDeviceId
nativeGetLicenseKey
nativeGetLicensePolicy
```

`com.android.vending.licensing`는 구글이 예전에 제공하던 **Google Play 라이선싱 라이브러리(LVL, License Verification Library)**다. 앱이 실행될 때 "이 기기가 이 앱을 플레이스토어에서 정식으로 구매/설치했는지"를 구글 서버에 물어보는 기능이다. `nativeGetLicenseKey`처럼 `native`가 붙은 이름들은 네이티브 라이브러리(`libunity.so`) 쪽 JNI 콜백인데, 실제로 거기서도 같은 이름이 나왔다.

여기까지 보면 심증은 가는데, 아직 "이 코드가 실제로 실행 경로에 있는가"는 확인이 안 됐다. dex 안에 문자열이 있다고 그 코드가 실제로 호출되는 건 아니니까, 죽은 코드(dead code)일 가능성도 배제할 수 없다.

## Step 5. 실제로 호출되는지 XREF로 추적

androguard의 `AnalyzeAPK`를 쓰면 dex 전체를 분석해서 "어느 메소드가 어느 메소드/클래스를 호출하는지"(cross-reference, XREF)까지 추적할 수 있다. 이걸로 라이선싱 클래스들을 실제로 누가 부르는지 찾아봤다.

처음엔 범위를 좁혀서 찾아봤는데 허탕이었다.

```python
# 1차 시도: LicenseChecker.checkAccess를 부르는 곳을 바로 찾기
for m in dx.find_methods(classname='.*LicenseChecker.*', methodname='checkAccess'):
    for _, call, _ in m.get_xref_from():
        print(call)
# → 아무것도 안 나옴
```

라이선싱 클래스 이름이 난독화(obfuscation)돼 있어서(`Lcom/android/vending/licensing/a;`, `b;`, `c;` 식으로 알파벳 한 글자) 메소드 이름으로 정확히 찍어서 찾는 방식이 안 먹힌 것이다. 방법을 바꿔서, **전체 dex의 모든 클래스·메소드를 순회하면서 라이선싱 패키지를 호출하는 게 있는지 전수조사**했다.

```python
license_classes = {c.name for c in dx.get_classes() if 'vending/licensing' in c.name}

for c in dx.get_classes():
    if c.name in license_classes:
        continue
    for m in c.get_methods():
        ma = dx.get_method_analysis(m.get_method())
        for _, callee, _ in ma.get_xref_to():
            if callee.class_name in license_classes:
                print(f"{c.name}#{m.name}  ->  {callee.class_name}#{callee.name}")
```

```
Lcom/unity3d/player/UnityPlayer;#onDrawFrame  ->  Lcom/android/vending/licensing/k;#<init>
Lcom/unity3d/player/UnityPlayer;#onDrawFrame  ->  Lcom/android/vending/licensing/d;#<init>
Lcom/unity3d/player/UnityPlayer;#onDrawFrame  ->  Lcom/android/vending/licensing/l;#<init>
Lcom/unity3d/player/UnityPlayer;#onDrawFrame  ->  Lcom/android/vending/licensing/a;#<init>
Lcom/unity3d/player/UnityPlayer;#quit  ->  Lcom/android/vending/licensing/d;#a
```

찾았다. **유니티 안드로이드 플레이어의 핵심 클래스인 `UnityPlayer`가 `onDrawFrame`(매 프레임 그리기)과 `quit`(종료) 안에서 라이선싱 체크 코드를 직접 물고 있다.** 죽은 코드가 아니라 게임이 실행되는 한 계속 타는 경로다.

## 그래서 결론은

퍼즐이 맞춰졌다. 2011년 당시 유니티 안드로이드 빌드 설정에는 "Google Play Licensing 사용" 옵션이 있었고, 이 게임은 그 옵션을 켜고 빌드된 것이다. 앱을 켜면 구글 라이선스 서버에 "이 기기가 정식으로 이 앱을 소유했는지" 물어보고, 정상 응답을 못 받으면(스토어에서 앱이 내려갔거나, 사이드로드로 설치한 경우 등) 라이브러리가 스스로 앱을 종료시킨다.

정리하면:

| 가설 | 결과 |
|---|---|
| 자체 게임 서버가 종료돼서 안 켜진다 | ❌ — 자체 서버 자체가 없음(광고 SDK 통신만 존재) |
| Google Play 라이선스 체크 실패로 강제 종료 | ✅ — `UnityPlayer`가 프레임마다 라이선싱 클래스를 호출 |
| targetSdkVersion=10이 최신 안드로이드와 안 맞음 | ⚠️ — 부가 문제로 확인, 설치 단계에서 걸릴 수 있음 |

"서버 접속이 필요한 게임인가"라는 원래 질문에 대한 답은 좀 미묘하다. **개발사 서버는 필요 없지만, 구글 라이선스 서버는 필요하도록 만들어져 있다.** 이게 지금 시점에 이 앱이 뜨자마자 죽는 진짜 이유로 보인다.

## 트러블슈팅 메모

- **`ModuleNotFoundError: androguard.core.bytecodes`**: androguard 최신 버전(4.x)에서 임포트 경로가 바뀌었다. 예전 자료에 많이 나오는 `androguard.core.bytecodes.apk`가 아니라 `androguard.core.apk`를 써야 한다.
- **로그가 화면을 뒤덮는 문제**: androguard는 기본적으로 파싱 과정을 아주 상세하게 로깅한다(`loguru` 기반). `logging.disable(logging.CRITICAL)`을 스크립트 맨 위에 넣지 않으면 정작 필요한 `print` 결과가 로그 수백 줄에 파묻힌다.
- **XREF 검색이 빈 손으로 끝났을 때**: 클래스/메소드 이름을 정규식으로 좁혀서 찾았는데 결과가 없다면, 난독화 때문에 이름 자체가 의미 없는 경우가 많다. 이럴 땐 범위를 넓혀서 "이 패키지에 속한 클래스를 부르는 코드가 dex 전체에 있는가"로 전수조사하는 쪽이 확실하다.

## 다음 편 예고

원인은 확인했으니, 다음은 실제로 고쳐서 다시 실행되게 만드는 차례다. `apktool`로 이미 스말리 소스까지는 풀어놨다.

```bash
apktool d -f -o dicecafe_decoded "Dice Cafe_v1.1.2.apk"
```

다음 편에서 다룰 것들:

1. 스말리 코드에서 `UnityPlayer#onDrawFrame`/`#quit`이 라이선싱 클래스를 호출하는 부분을 찾아 제거하거나 우회
2. `targetSdkVersion` 조정이 필요한지 검토
3. `apktool b`로 재빌드 → 새 키로 재서명 → `zipalign`
4. 실제 폰에 설치해서 진짜로 켜지는지 확인

옛날 게임을 되살리는 작업이 결국 "왜 죽는지 증거를 모으는 수사"에 가깝다는 걸 이번에 새삼 느꼈다. 코드를 고치기 전에, 문자열 검색과 XREF 추적만으로 범인을 특정할 수 있었던 게 이번 편의 소득이다.
