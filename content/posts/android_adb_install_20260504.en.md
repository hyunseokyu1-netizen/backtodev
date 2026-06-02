---
title: 'How to Install Android Apps Directly - From APK to USB Debugging'
date: '2026-05-04'
publish_date: '2026-05-28'
description: How to install Android apps without Google Play and how to install them directly with ADB USB debugging.
tags:
  - Android
  - adb
  - React Native
  - development environment
  - app development
---

You've probably built an app and thought, "How do I get this on my phone?".

You put it on Google Play, but it takes a while to get approved for a developer account. It's too much of a hassle to go through for testing purposes, especially when you just want to start using your app right away.

In this article, I'll show you step-by-step how to install Android apps without the Play Store. I'll even show you how to install it directly from the terminal with USB debugging with a single line of `adb install`.

---

## Method 1: Direct APK file transfer and installation

This is the most basic method. Simply move the APK file to your phone and run it directly.

### What is an APK?

An APK (Android Package) is an installation file for an Android app. Think of it like an ".exe" on Windows or a ".dmg" on Mac.

For Expo or React Native projects, you can create an APK with the command below.

```bash
# create an Expo project → Native Android project
npx expo prebuild --platform android

# Build the APK with Gradle
cd android && ./gradlew assembleRelease
```

When the build is complete, you'll have an APK file here.

```
android/app/build/outputs/apk/release/app-release.apk
```

### How to move the APK to your phone

| How To | Description | Pros & Cons |
|---|---|---|---|
| KakaoTalk | Send files to me | Easy, but has limitations |
| Google Drive / iCloud | Upload and download to Drive | Upload takes time |
| AirDrop (Mac → Android) | Not direct, need intermediate app | Inconvenient
| USB File Transfer | Direct copy after connecting the cable | Fast and reliable
| **adb install** | One line of terminal command | Fastest (the point of this article) |

### Required settings before installation: Allow unknown apps

APKs from outside of Google Play are blocked from installing by default. You need to allow them in the path below.

For Android 12 and later:** **Android 12
```
Settings → Apps → Three dots at the top right → Access special apps → Install unknown apps
→ Select the app you want to install → Allow
```

**For Android 11 and earlier:** **For Android 11 and earlier
```
Settings → Security → Unknown sources → Allow
```

Once set up, you can tap the APK file to install it.

---

## Method 2: EAS Build (Expo Application Services)

For Expo projects, you can use EAS to build APKs in the cloud. You don't even need a local Android SDK.

```bash
# Install the EAS CLI
npm install -g eas-cli

# Log in to your Expo account
eas login

# Initialize the project
eas build:configure

# build APK (preview profile = APK, production = AAB)
eas build --platform android --profile preview
```

At the end of the build, you'll see the download URL. You can also download it directly from your phone with a QR code.

**Pros: Builds in the cloud without local configuration
**Cons: Build times can take 10-20 minutes, free plan has a limited number of builds per month

---

## Method 3: ADB (Android Debug Bridge) - USB Debugging

Here's where it gets tricky. ADB is a command-line tool included in the Android SDK that allows you to connect your PC and Android device to do a variety of things.

You can install APKs, check logs, transfer files, and even force close apps all from the terminal.

### Step 1: Verify Android SDK installation

If you've installed Android Studio, you already have the SDK.

```bash
# SDK location on Mac
ls ~/Library/Android/sdk/platform-tools/adb

# Check adb version
~/Library/Android/sdk/platform-tools/adb version
```

If not, you can install Android Studio, or download `sdk/platform-tools` alone.

**It's handy to add it to your PATH (add it to `~/.zshrc` or `~/.bashrc`):

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

```bash
source ~/.zshrc # Apply
adb version # Now you can type just adb
```

### Step 2: Enable developer options on your phone

USB debugging is located in the developer options. It's hidden by default, so you'll need to enable it first.

```
Quickly tap Settings → About phone → About software → Build number 7 times
```

Success when you see the "You are now a developer" message.

You now have developer options.

```
Settings → Developer options → USB debugging → Turn on
```

### Step 3: Connect via USB and verify your device

Connect your PC and phone with a cable. If you see a "Allow USB debugging?" pop-up on your phone, check it (or check "Always allow on this computer" and confirm).

Run ```bash
adb devices
```

Example output:
```
List of devices attached
R5KYA01JSXA device
```

If `device`, the connection is successful. If `unauthorized`, your phone does not allow pop-ups.

### Step 4: Install APK

Run ```bash
adb install app-name.apk

# Overwrite an existing app (-r option)
adb install -r appname.apk
```bash

Output:
```
Performing Streamed Install
Success
```

When `Success` appears, you can see it right away in your phone's app list.

---

## A collection of frequently used ADB commands

There are many things you can do with ADB besides installing APKs.

```bash
# List connected devices
adb devices

# Install the APK
adb install -r app.apk

# Uninstall the app (requires package name)
adb uninstall com.example.myapp

# Logcat (check app logs in real time)
adb logcat

# Filter only certain tags
adb logcat -s ReactNativeJS

# Take a screenshot and save it to your PC
adb exec-out screencap -p > screenshot.png

# Copy the file from PC to phone
adb push localfile.txt /sdcard/

# Copy file from phone to PC
adb pull /sdcard/somefile.txt ./

# Force stop the app
adb shell am force-stop com.example.myapp

# Restart the app
adb shell monkey -p com.example.myapp 1
```

---

## Troubleshooting

### adb devices not showing up in devices

1. plug the cable back in (if the cable is for charging only, data transfer will not work)
2. check the USB connection method on your phone → set to "File Transfer (MTP)" or "USB Debugging"
3. pop-up re-authorization: `adb kill-server && adb start-server` then reconnect

### unauthorized status

```bash
adb kill-server
adb start-server
adb devices
```

A popup will appear on your phone again. Check "Always allow on this computer" and confirm.

### Installation failed: INSTALL_FAILED_VERSION_DOWNGRADE

Occurs when you try to install a lower version of an already installed app.

```bash
# Uninstall the existing app first, then install
adb uninstall com.example.myapp
adb install app.apk
```

### Installation failed: INSTALL_PARSE_FAILED_NO_CERTIFICATES

The release APK needs to be signed. Occurs when built with `assembleRelease` and no signature is set.

If you build with the Expo prebuild default settings, it is automatically signed with the debug key. This is fine for testing purposes.

---

## Summary: Contextual recommendations

| Context | How to recommend |
|---|---|
| Quick test (with cable) | `adb install` |
| Forward to friends without cable | Send APK file via KakaoTalk/Drive
| No local Android SDK | EAS Build
| Deploy to multiple team members | Share EAS Build + download link
| Live deployment | Google Play Store |

Once you're comfortable with `adb install`, you can script Build → Install to run it all at once.

```bash
# build_and_install.sh
cd android && \
ANDROID_HOME=~/Library/Android/sdk ./gradlew assembleRelease && \
~/Library/Android/sdk/platform-tools/adb install -r \
  app/build/outputs/apk/release/app-release.apk && \
echo "✅ Installation complete"
```

End with `sh build_and_install.sh` one line.
