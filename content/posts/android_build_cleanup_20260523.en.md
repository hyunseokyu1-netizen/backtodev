---
title: 'How to Clean Up Android Build Files — Reclaim Several GB in One Shot'
date: '2026-05-23'
publish_date: '2026-06-12'
description: A complete rundown of how to safely clean up Android build files once they start eating your disk space
tags:
  - Android
  - Gradle
  - Dev Environment
  - Disk Management
---

## One day, the disk was full

At some point while developing, your Mac starts crying "storage almost full." Digging through files doesn't reveal an obvious culprit, but running a disk analyzer tool exposes it fast.

```
~/.gradle/caches    →  8.3 GB
~/AndroidStudioProjects/appA/build  →  1.2 GB
~/AndroidStudioProjects/appB/build  →  900 MB
~/AndroidStudioProjects/appC/build  →  700 MB
```

It's common for Gradle caches and each project's build folder to pile up to 10GB+ combined. Even projects you haven't touched in months are still quietly taking up space.

Is it safe to delete everything? What should you leave alone? Let's sort it out.

---

## Why are build files even this big?

Building an Android project makes Gradle accumulate files in two main places.

| Location | Role | Size |
|------|------|------|
| `~/.gradle/caches/` | Global Gradle cache (libraries, plugins) | ★★★ biggest |
| `project/build/` | Project-root build output | ★★ |
| `project/app/build/` | APK, DEX, intermediate compiled files | ★★ |
| `project/.gradle/` | Per-project Gradle wrapper cache | ★ |
| `~/.gradle/wrapper/dists/` | Gradle binaries per version | ★ |

`~/.gradle/caches/` is usually the main offender. Libraries and build metadata downloaded across every project you've ever built accumulate here, and none of it gets cleaned up automatically.

---

## Step 1: Check how much has piled up first

Before deleting anything blindly, get a sense of scale.

```bash
# Global Gradle cache size
du -sh ~/.gradle/caches

# Entire Gradle folder (cache + wrapper included)
du -sh ~/.gradle

# Size of every build folder under a given directory
find ~/AndroidStudioProjects -name "build" -type d 2>/dev/null \
  | xargs du -sh 2>/dev/null \
  | sort -h
```

The results make it obvious what's taking up how much space.

---

## Step 2: Clean up per-project build files

### Option A — Gradle's clean command

Run this from inside a project folder.

```bash
cd ~/AndroidStudioProjects/my-project
./gradlew clean
```

Deletes build output in `app/build/` and `build/`. Source code is untouched. It'll regenerate on the next build.

### Option B — From Android Studio

**Build > Clean Project** does the same thing. Only applies to the currently open project.

### Option C — Clean up every project at once

When you want to clean multiple projects in one pass:

```bash
# Check which folders exist first
find ~/AndroidStudioProjects -name "build" -type d 2>/dev/null

# Once confirmed, delete them all
find ~/AndroidStudioProjects -name "build" -type d -exec rm -rf {} + 2>/dev/null
```

> **Note**: `2>/dev/null` just suppresses error messages that come from nested folders already having been deleted. It's expected behavior, nothing to worry about.

---

## Step 3: Clean the global Gradle cache (the big one)

This is where most of the disk space gets reclaimed.

```bash
rm -rf ~/.gradle/caches
```

Deleting this means the next build re-downloads libraries from the internet. That first build will be slow, but everything gets cached again afterward and speeds back up. **No effect on your source code or configuration.**

---

## Safe to delete vs. handle with care

| Path | Delete? | Reason |
|------|----------|------|
| `~/.gradle/caches/` | ✅ Safe | Regenerated on next build |
| `project/build/` | ✅ Safe | Regenerated on next build |
| `project/app/build/` | ✅ Safe | Regenerated on next build |
| `project/.gradle/` | ✅ Safe | Wrapper cache, regenerable |
| `~/.gradle/wrapper/dists/` | ⚠️ Careful | Requires re-downloading Gradle binaries |
| `~/.android/avd/` | ❌ Dangerous | Wipes emulator configurations |
| `~/.android/sdk/` | ❌ Dangerous | Deletes the entire SDK |

Never touch `avd` or `sdk`. Emulator settings or the entire SDK will be gone.

---

## A one-shot cleanup script

If you'll be doing this often, a shell function is worth setting up. Add this to `~/.zshrc` or `~/.bashrc`:

```bash
android-clean() {
  echo "🧹 Cleaning Gradle cache..."
  rm -rf ~/.gradle/caches
  echo "🧹 Cleaning project build folders..."
  find ~/AndroidStudioProjects -name "build" -type d -exec rm -rf {} + 2>/dev/null
  echo "✅ Done! Current free disk space:"
  df -h /
}
```

After saving, run `source ~/.zshrc` and you can use the `android-clean` command directly.

---

## Verify after cleanup

```bash
df -h /
```

You'll see several GB freed up. In my case, just clearing `.gradle/caches` alone, combined with a 392MB `.next` cache, took my free disk space from 150MB to 540MB.

---

## Summary

```
Build file cleanup order:

1. Assess the scale     → du -sh ~/.gradle/caches
2. Clean per project    → ./gradlew clean (per project)
3. Clear global cache   → rm -rf ~/.gradle/caches
4. Verify               → df -h /

Never touch: ~/.android/avd/, ~/.android/sdk/
```

Development environments inevitably pile up like this over time. A quarterly check-in on disk usage is good for your peace of mind.
