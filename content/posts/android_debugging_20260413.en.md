---
title: Wireless ADB Debugging — Install APKs Without a Cable
date: '2026-04-13'
description: How to set up wireless ADB debugging between a MacBook and an Android device. Install APKs over Wi-Fi with a single command — no USB cable needed.
tags:
  - android
---

> Plugging and unplugging a USB cable every time you want to test an APK gets old fast.  
> With ADB wireless debugging, you can install directly from your MacBook with one command.

---

## What is ADB?

**ADB (Android Debug Bridge)** is a command-line tool that connects Android devices to a development machine.  
It typically works over USB, but **since Android 11, Wi-Fi connections are also supported**.

---

## Prerequisites

### MacBook

If you have Android Studio installed, ADB is already available. Verify in the terminal:

```bash
adb version
```

If you see `Android Debug Bridge version 1.x.x`, you're good.  
If not, install Android Studio or use Homebrew:

```bash
brew install android-platform-tools
```

### Android Phone — Enable Developer Options

Developer Options are hidden by default. Enable them as follows:

1. **Settings** → **About phone**
2. Tap **Build number** **7 times in a row**
3. Confirm the "You are now a developer!" message

---

## Wireless Debugging Setup

### Step 1 — Enable Wireless Debugging on Your Phone

**Settings → Developer Options → Wireless debugging** → turn **ON**

> ⚠️ Your MacBook and Android phone must be on the **same Wi-Fi network**.

### Step 2 — Find the IP Address and Port

After enabling wireless debugging, tap the menu item to open its details:

```
IP address & port
192.168.x.x:xxxxx
```

Make note of this address.

> 💡 The port number changes every time wireless debugging is toggled off and on.  
> If you can't connect, check the port again.

### Step 3 — Connect from the MacBook Terminal

```bash
adb connect 172.30.1.12:45831
```

On success:

```
connected to 172.30.1.12:45831
```

To verify the connected device:

```bash
adb devices
```

```
List of devices attached
172.30.1.12:45831    device
```

### Step 4 — Install the APK

```bash
adb -s 172.30.1.12:45831 install -r /path/to/app-release.apk
```

- `-s 172.30.1.12:45831` : specifies the target device when multiple are connected
- `-r` : overwrites the existing app (reinstall)

On success:

```
Performing Streamed Install
Success
```

The app installs on your phone instantly. 🎉

---

## Common ADB Commands

```bash
# List connected devices
adb devices

# Install APK
adb install -r app.apk

# View app logs (specific tag)
adb logcat -s "MyTag"

# Transfer file (phone → Mac)
adb pull /sdcard/file.txt ./

# Transfer file (Mac → phone)
adb push ./file.txt /sdcard/
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Connection refused` | Port changed | Check the IP:port in wireless debugging settings |
| `device offline` | Connection dropped | Re-run `adb connect IP:port` |
| `adb: not found` | ADB not installed | Run `brew install android-platform-tools` |
| Connected but install fails | USB debugging permission | Tap Allow on the permission popup on your phone |

---

## Summary

The wireless APK install flow:

```
Phone: Settings → Developer Options → Wireless Debugging ON → note IP:port
Mac:   adb connect IP:port
Mac:   adb install -r app.apk
```

Once set up, you only need the last two steps on the same Wi-Fi.  
Your build-and-test cycle gets significantly faster.

---

> **References**  
> - Android official docs: [Run apps on a hardware device](https://developer.android.com/studio/run/device)  
> - ADB is bundled with Android Studio at `~/Library/Android/sdk/platform-tools/`
