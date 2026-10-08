---
title: 'Reviving a 15-Year-Old Android Game (Part 1) — Finding the Real Culprit Through APK Reverse Engineering'
date: '2026-07-10'
publish_date: '2026-10-27'
description: Tracking down why a Unity-based Android game from 2011 crashes the instant it launches on a modern phone, by tearing apart the APK with androguard and apktool until the Google Play license check turned out to be the culprit
tags:
  - Android
  - APK
  - Reverse Engineering
  - androguard
  - apktool
---

## An Old Game That Won't Turn On

I had an old Android game APK lying around that I used to play a lot. `Dice Cafe_v1.1.2.apk`, a game from 2011. It installs fine, but launching it, the screen shows up and immediately closes. I'd only guessed something like "maybe it needed a server connection and died when the service got shut down," but I couldn't be sure until I actually cracked it open.

In a situation like this, the answer is one of two things. Either the developer's server is gone and communication is blocked, or there's something (an old runtime, an outdated auth method, something like that) that no longer fits with modern Android. Since knowing which one it is decides how to fix it, I decided to start by looking inside the APK.

This post is a record of the process of tracking down that cause. I haven't fully revived the game yet — finding the cause is the scope of this post. (Patching it to run again is for the next one.)

## Prep — Installing the Tools

An APK is ultimately a ZIP file, so you can see the basic structure right away with `unzip -l`, but `AndroidManifest.xml` and `classes.dex` are binary formats that need dedicated tools. I used two this time.

- **androguard**: a Python-based library that can parse `AndroidManifest.xml` and even analyze `classes.dex` code (tracing which method calls which class)
- **apktool**: a tool that fully unpacks an APK into smali (an assembly-like representation of dex bytecode) source. Needed later when modifying the code and repackaging

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

## Step 1. First Pass Over the APK Structure

An APK is just a ZIP, so even without tools, `unzip -l` lets you see what's inside right away.

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

`Assembly-CSharp.dll`, `mscorlib.dll`, `libmono.so` — the moment I saw this combination, I knew. **This is a Unity engine game, and from the era when it used the Mono scripting backend rather than IL2CPP.** IL2CPP became the standard approach from around 2015 onward, which means this APK predates that by a good margin. `classes.dex` sits separately — this is the Android-side Java code (activities, ad SDKs, assorted Android API integrations) — while the actual game logic is the C# code inside `Assembly-CSharp.dll`.

## Step 2. Parsing the Manifest

`AndroidManifest.xml` sits inside the APK as binary XML, so opening it directly won't do. I parsed it with androguard.

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

`targetSdkVersion=10` is a standard from the Android 2.3.3 (Gingerbread) era. I noted that on a modern phone (the latest Android requires a target of 34 or higher), this value alone could be grounds for the install being rejected. And with the `INTERNET` permission present, I confirmed it does try to talk to something — the question was whether that something was "a game server" or not.

## Step 3. Digging Through Strings for a Server Address

The fastest approach is pulling every string out of the binary with `strings` and filtering for URL/domain patterns.

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

Every one of them is an ad network domain (Cauly, AdMob, Daum mobile ads). I checked the same way in the C# assembly holding the game logic (`Assembly-CSharp.dll`), and found no URL strings there at all.

```bash
strings assets/bin/Data/Managed/Assembly-CSharp.dll | grep -Eio 'https?://[^ "]+'
# (결과 없음)
```

One thing was confirmed here. **This game has no game server of its own.** It's not structured to check with a server for rankings or account systems. The only communication happening is the ad SDK, and an ad server being dead doesn't normally force-close an app. So the first hypothesis — "server problem" — is rejected. The cause lies elsewhere.

## Step 4. A Suspicious String Found in classes.dex

If it's not the server, then what is it? I widened my net beyond URLs and combed through `classes.dex` more broadly for strings this time. And something caught my eye.

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

`com.android.vending.licensing` is Google's old **Play Licensing library (LVL, License Verification Library)**. It's a feature that asks Google's servers, when the app launches, "did this device legitimately buy/install this app from the Play Store." Names with `native` attached, like `nativeGetLicenseKey`, are JNI callbacks into the native library (`libunity.so`) side — and sure enough, the same names showed up there too.

At this point there's a strong suspicion, but it's not yet confirmed that "this code is actually on the execution path." A string existing inside the dex doesn't mean that code actually gets called — it could still be dead code, and that possibility couldn't be ruled out yet.

## Step 5. Tracing Whether It's Actually Called, via XREF

Using androguard's `AnalyzeAPK`, you can analyze the entire dex and trace exactly which method calls which method/class (cross-reference, XREF). I used this to find out who actually calls the licensing classes.

My first attempt narrowed the scope down and came up empty.

```python
# 1차 시도: LicenseChecker.checkAccess를 부르는 곳을 바로 찾기
for m in dx.find_methods(classname='.*LicenseChecker.*', methodname='checkAccess'):
    for _, call, _ in m.get_xref_from():
        print(call)
# → 아무것도 안 나옴
```

Because the licensing class names were obfuscated (single-letter names like `Lcom/android/vending/licensing/a;`, `b;`, `c;`), looking it up precisely by method name didn't work. I changed approach, doing a **full sweep over every class and method in the whole dex, checking if anything calls into the licensing package.**

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

Found it. **`UnityPlayer`, the core class of the Unity Android player, directly holds onto the licensing check code inside both `onDrawFrame` (called every frame to draw) and `quit` (called on exit).** Not dead code — a path that keeps getting hit as long as the game is running.

## So, the Conclusion

The pieces fit together. Back in 2011, Unity's Android build settings had a "Use Google Play Licensing" option, and this game was built with that option turned on. When the app launches, it asks Google's license server "does this device legitimately own this app," and if it doesn't get a valid response (because the app was pulled from the store, or it was sideloaded, etc.), the library terminates the app itself.

To sum up:

| Hypothesis | Result |
|---|---|
| Won't launch because its own game server shut down | ❌ — there's no own server to begin with (only ad SDK communication exists) |
| Force-closed by a failed Google Play license check | ✅ — `UnityPlayer` calls into the licensing classes every frame |
| `targetSdkVersion=10` doesn't fit modern Android | ⚠️ — confirmed as a secondary issue, could be caught at install time |

The answer to the original question, "does this game need a server connection," turns out to be a bit nuanced. **It doesn't need the developer's server, but it was built to need Google's license server.** That looks like the real reason this app dies the instant it launches, at this point in time.

## Troubleshooting Notes

- **`ModuleNotFoundError: androguard.core.bytecodes`**: the import path changed in recent androguard versions (4.x). Instead of `androguard.core.bytecodes.apk`, which shows up a lot in older material, you need `androguard.core.apk`.
- **Logs flooding the screen**: androguard logs its parsing process in a lot of detail by default (built on `loguru`). Without `logging.disable(logging.CRITICAL)` at the top of the script, the `print` output you actually need gets buried under hundreds of lines of logs.
- **An XREF search comes back empty-handed**: if you narrow class/method names down with a regex and get nothing, it's often because the names themselves are meaningless due to obfuscation. In that case, it's more reliable to widen the scope and do a full sweep of "does anything in the whole dex call a class belonging to this package."

## Next Up

With the cause confirmed, the next step is actually fixing it to run again. I've already unpacked it down to smali source with `apktool`.

```bash
apktool d -f -o dicecafe_decoded "Dice Cafe_v1.1.2.apk"
```

What the next post will cover:

1. Finding where `UnityPlayer#onDrawFrame`/`#quit` call into the licensing classes in the smali code, and removing or bypassing it
2. Reviewing whether `targetSdkVersion` needs adjusting
3. Rebuilding with `apktool b` → re-signing with a new key → `zipalign`
4. Installing on a real phone to confirm it actually launches

Reviving an old game turned out to feel a lot like "an investigation gathering evidence for why it dies" rather than coding. What I came away with from this post is that string searches and XREF tracing alone were enough to pin down the culprit, before touching a single line of code.
