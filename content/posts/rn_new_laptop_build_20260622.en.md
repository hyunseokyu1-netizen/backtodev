---
title: 'Building a React Native (Expo) Project on a New Laptop — 4 Traps I Hit'
date: '2026-06-22'
publish_date: '2026-07-03'
description: A record of solving JDK, node, Gradle cache, and launcher issues in order while building and installing an RN app on a new Mac with copied node_modules and android folders
tags:
  - React Native
  - Expo
  - Android
  - Gradle
  - Troubleshooting
---

## Switched laptops, and now the build won't run

Eventually you hit the moment where you switch laptops while developing. I moved a React Native (Expo) app I'd been working on over to a new Mac. Usually in this situation, the heaviest thing, `node_modules`, can just be re-fetched, so you leave it out and copy everything else. That's what I did too. More precisely, I meant to leave `node_modules` out, but in the end, both `node_modules` and the native `android/` folder came along with it.

Running the build as usual, I hit four walls in a row.

1. No Java (JDK) exists
2. Gradle can't find `node`
3. A mysterious Gradle error: `No variants exist`
4. Install succeeded, but the app doesn't show up in the app list

Each one of these makes you go "what is this?" the first time you see it, so I wrote up the diagnosis-to-fix process in order for anyone hitting the same wall. The environment here is **macOS + Expo SDK 54 + React Native 0.81 + a real Android device (USB debugging)**.

> 📌 This post is **Part 2 — Building.** For the process of restoring JS dependencies for a project moved without `node_modules` first, see [Part 1 — Restoring a Project Moved Without node_modules](/posts/move_rn_project_20260621).

---

## The starting situation

Here's where I started.

- Copied the project folder over to the new Mac (including `node_modules`, `android/`)
- Android Studio already installed
- Android phone connected via USB (showing up fine in `adb devices`)
- The release-signing keystore (.jks) kept in a separate backup folder

The build command is simple — run Gradle from the project's `android/` folder.

```bash
cd android && ./gradlew assembleRelease
```
But this one line took a long time to get all the way through.

---

## Step 1. "Unable to locate a Java Runtime" — no JDK

The first error was this.

```
The operation couldn't be completed. Unable to locate a Java Runtime.
Please visit http://www.java.com for information on installing Java.
```

Being a new laptop, there was no JDK at all. But there's no need to fetch a separate JDK from java.com. **If Android Studio is installed, it already contains a JDK (JBR, JetBrains Runtime) inside it.**

On a Mac, it's usually at this path.

```bash
ls "/Applications/Android Studio.app/Contents/jbr/Contents/Home"
```

Point `JAVA_HOME` at this and run Gradle.

```bash
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
./gradlew assembleRelease
```

> 💡 To check at a glance whether a JDK exists on your system: look in `/Library/Java/JavaVirtualMachines/`, or check `/opt/homebrew/opt/openjdk*` if you installed one via Homebrew. If neither exists, Android Studio's JBR is the easiest answer.

---

## Step 2. "Cannot run program node" — Gradle can't find node

With JDK sorted, this error came up next.

```
Cannot run program "node" ... error=2 (No such file or directory)
```

What was baffling was that node was clearly installed on my laptop. `node -v` worked fine. So why couldn't Gradle find it?

The reason is **Expo's autolinking.** Open `android/settings.gradle` for RN 0.81 + Expo, and you'll find code like this.

```groovy
providers.exec {
  commandLine("node", "--print",
    "require.resolve('@react-native/gradle-plugin/...')")
}
```

During the build, Gradle directly executes `node` to figure out dependency paths. In other words, **node needs to be on the PATH of the shell running Gradle.**

My actual cause for node not being found was **nvm.** When you install node via nvm, the node executable lives inside `~/.nvm/versions/node/<version>/bin`, and this path only gets added to PATH once the nvm init script gets sourced from `~/.zshrc`. The new laptop's `.zshrc` was missing that init line.

As a quick fix, I just slotted node's path directly into PATH.

```bash
PATH="$HOME/.nvm/versions/node/v24.17.0/bin:$PATH" \
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
./gradlew assembleRelease
```

The permanent fix comes later, in the `.zshrc` section.

---

## Step 3. "No matching variant... No variants exist" — the real trap

Now the genuinely painful error showed up. Every single native module spat out a message like this.

```
> Could not resolve project :react-native-screens.
   > No matching variant of project :react-native-screens was found.
     ... No variants exist.
```

`react-native-gesture-handler`, `react-native-safe-area-context`, `react-native-webview`... almost every RN library reported "not a single variant exists." It looked like these libraries were being recognized as empty shell projects.

### First suspicion: is node_modules corrupted?

Wondering if the copied-over `node_modules` was incomplete, I first re-fetched it cleanly, based on `package-lock.json`.

```bash
npm ci
```

`npm ci` wipes the existing `node_modules` and installs exactly per the lock file, which fits perfectly with "something might've been dropped during the copy." But... rebuilding still produced **the exact same error.** node_modules wasn't the culprit.

### The real cause: a stale build cache that got copied over

The key clue was that the `android/` folder **wasn't tracked by Git.** `.gitignore` had `/android` in it.

```bash
git ls-files android/ | wc -l   # → 0
```

In other words, `android/` is a pure artifact generated by `expo prebuild`, and inside it, the **build cache folder** generated on the previous laptop had come along too.

```bash
ls -d android/.gradle android/build android/app/build
# all three exist → cache from the old environment, with hardcoded absolute paths
```

This cache had the old laptop's absolute paths baked right into it. On the new laptop, the paths don't line up, so Gradle couldn't properly configure the library projects and spat out "no variants exist."

There's one more trap here. **`./gradlew clean` doesn't clear the `.gradle` cache.** `clean` only cleans up `build/` output. So I deleted it directly.

```bash
rm -rf android/.gradle android/build android/app/build android/.cxx
```

Then rebuilt.

```bash
cd android && ./gradlew assembleRelease
```

```
BUILD SUCCESSFUL in 3m 13s
```

Finally, success. The built APK lands here.

```
android/app/build/outputs/apk/release/app-release.apk
```

Next, I installed it on the USB-connected device.

```bash
adb install -r app/build/outputs/apk/release/app-release.apk
# → Success
```

> ✅ Lesson: **when copying a project over, don't bring along `android/.gradle`, `android/build`, `android/app/build`.** They're just artifacts anyway, and they end up tripping you up exactly like this. For a truly clean setup, you can also regenerate the android folder from scratch with `npx expo prebuild --clean` (in that case, you'll need to re-add the keystore and signing config).

---

## Step 4. Installed, but not showing up in the app list

Seeing `Success`, I figured it was done — but no matter how much I dug through the phone's app drawer, the app icon was nowhere to be found. It had clearly installed, though.

First I checked whether it had really installed.

```bash
adb shell pm list packages | grep chainplay
# → package:com.backdev.chainplay  (installed)
```

Installation was confirmed. Wondering if the main activity for the launcher just wasn't registered, I checked, and got a strange result.

```bash
adb shell cmd package resolve-activity --brief \
  -c android.intent.category.LAUNCHER com.backdev.chainplay
# → No activity found
```

But looking closer with `dumpsys`, `MainActivity` had its `MAIN` + `LAUNCHER` intent filters registered just fine. Registered, but the launcher can't find it? The decisive clue was this line.

```bash
adb shell dumpsys package com.backdev.chainplay | grep -i enabled
# ... enabled=3 ...
# lastDisabledCaller: com.lge.launcher3
```

`enabled=3` means **`DISABLED_USER`** on Android — "disabled by the user." And `lastDisabledCaller` was `com.lge.launcher3` — **the LG launcher had disabled this app.** It seems like an old version of the app had once been set to "disabled" at some point, and that state stuck around even after reinstalling.

The fix is simple — just re-enable the app.

```bash
adb shell pm enable com.backdev.chainplay
# → new state: enabled
```

After this, the launcher activity resolved correctly, and the icon showed up in the app drawer. Confirmed it launches directly with `monkey` too.

```bash
adb shell monkey -p com.backdev.chainplay \
  -c android.intent.category.LAUNCHER 1
```

> For reference, Android's `enabled` status values break down like this.
>
> | Value | Meaning |
> |---|---|
> | 0 | DEFAULT |
> | 1 | ENABLED |
> | 2 | DISABLED |
> | 3 | DISABLED_USER (disabled by user/launcher) |
> | 4 | DISABLED_UNTIL_USED |

---

## To avoid going through this again: baking the environment into `.zshrc`

Manually appending `JAVA_HOME=...`, `PATH=...` every single time is a chore. If you're settling into a new laptop, it's cleaner to add these to your shell config once. I added this to `~/.zshrc`.

```bash
# --- Android / React Native build environment ---
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

# JDK for Gradle (Android Studio's bundled JBR)
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"

# nvm (puts node on PATH — Gradle autolinking needs node)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
```

Open a new terminal and verify (or `source ~/.zshrc`):

```bash
node -v       # v24.17.0
which adb      # .../platform-tools/adb
java -version  # openjdk 21
```

Now the build finishes with just this one line, no environment variables needed.

```bash
cd android && ./gradlew assembleRelease && \
  adb install -r app/build/outputs/apk/release/app-release.apk
```

---

## Frequently used diagnostic commands

Here's a collection of `adb`/Gradle commands that were useful during this troubleshooting.

| Purpose | Command |
|---|---|
| Check connected devices | `adb devices` |
| Search installed packages | `adb shell pm list packages \| grep <keyword>` |
| Check install path | `adb shell pm path <package-name>` |
| Query the launcher activity | `adb shell cmd package resolve-activity --brief -c android.intent.category.LAUNCHER <package-name>` |
| Check enabled/status | `adb shell dumpsys package <package-name> \| grep -i enabled` |
| Enable the app | `adb shell pm enable <package-name>` |
| Launch the app | `adb shell monkey -p <package-name> -c android.intent.category.LAUNCHER 1` |
| Fully clear the Gradle cache | `rm -rf android/.gradle android/build android/app/build android/.cxx` |

---

## Summary — the core flow at a glance

Here's what I learned building an RN/Expo project on a new laptop, in order.

1. **Android Studio's bundled JBR is enough for a JDK** — just point `JAVA_HOME` at it
2. **Gradle directly executes `node` during the build** — fails without node on the shell's PATH. If you use nvm, its `.zshrc` init is mandatory
3. **`No variants exist` can be caused by a stale, copied-over build cache** — deleting `android/.gradle`/`build`/`app/build` entirely fixes it. `gradlew clean` isn't enough
4. **If it's installed but the app doesn't show up, suspect the `enabled` state** — revive it with `adb shell pm enable`

In the end, all four problems boiled down to "traces of the old environment lingering in a new one." When moving a project, remembering the principle of **regenerating artifacts (build cache) and environment-dependent settings (PATH, JAVA_HOME) fresh for the new environment** should save a lot of wandering next time.
