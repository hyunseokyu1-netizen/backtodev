---
title: 'After GitHub Warned Me About a Huge AAB File — Moving Build Artifacts to Local Version Control'
date: '2026-05-13'
publish_date: '2026-06-04'
description: Why you shouldn't commit Android release build files (AAB/APK) to GitHub, and how to version them in a local folder instead
tags:
  - Android
  - AAB
  - GitHub
  - Git
  - ReactNative
---

## Why I'm writing this

I built an AAB file to upload to the Play Store. Then, thinking "version control means git!", I committed `store/v1.0/app-release.aab` and pushed it to GitHub.

The moment I pushed, this warning showed up.

```
remote: warning: File store/v2.0/app-release.aab is 63.80 MB;
remote: this is larger than GitHub's recommended maximum file size of 50.00 MB
remote: warning: GH001: Large files detected.
remote: You may want to try Git Large File Storage - https://git-lfs.github.com.
```

Two 64MB files were enough to light up a warning on GitHub.

AAB/APK files are **build artifacts** — compiled binaries, not source code. These shouldn't go into git at all. This is the textbook case for `.gitignore`.

---

## Why build artifacts don't belong in git

| Reason | Explanation |
|------|------|
| Size | AABs are typically 50–100MB. Repo size balloons fast as versions accumulate |
| Useless diffs | Binary files produce meaningless git diffs |
| Reproducible | You can always rebuild from source |
| GitHub limits | Pushes are outright rejected past 100MB |

---

## The fix: version control in a local-only folder

I chose to keep these out of GitHub entirely, organizing them by version in a separate local folder instead.

### Folder structure

```
~/Documents/workspace/apk_build_files/
└── tilt/
    ├── v1.0/
    │   └── app-release.aab   ← initial release
    └── v2.0/
        └── app-release.aab   ← version with the tutorial added
```

One folder per project, version folders inside it. Simple, but sufficient.

---

## What I actually did, step by step

### Step 1 — Create the local storage folder and move the files

```bash
# Create the folders
mkdir -p ~/Documents/workspace/apk_build_files/tilt/v1.0
mkdir -p ~/Documents/workspace/apk_build_files/tilt/v2.0

# Move the AAB files out of the git repo into the local folder
mv store/v1.0/app-release.aab ~/Documents/workspace/apk_build_files/tilt/v1.0/
mv store/v2.0/app-release.aab ~/Documents/workspace/apk_build_files/tilt/v2.0/
```

### Step 2 — Remove the files from git

Files already committed need `git rm` to stop tracking them. This doesn't delete the local file — it only removes it from git's tracking list.

```bash
git rm -r store/v1.0/ store/v2.0/
```

### Step 3 — Add to .gitignore

Register these paths in `.gitignore` so they can't accidentally be re-added.

```bash
echo "store/v1.0/" >> .gitignore
echo "store/v2.0/" >> .gitignore

# Or as a single pattern
echo "store/v*/" >> .gitignore
```

### Step 4 — Commit & push

```bash
git add .gitignore
git commit -m "chore: remove AAB build files from git, switch to local management"
git push origin main
```

---

## Building a new version going forward

```bash
# Build
./gradlew bundleRelease

# Copy the output
mkdir -p ~/Documents/workspace/apk_build_files/tilt/v3.0
cp android/app/build/outputs/bundle/release/app-release.aab \
   ~/Documents/workspace/apk_build_files/tilt/v3.0/
```

When uploading to the Play Store, use `apk_build_files/tilt/v3.0/app-release.aab`.

---

## Worth adding to .gitignore up front (Android/Expo)

```gitignore
# Build artifacts
android/app/build/
*.apk
*.aab
*.keystore   # Signing keys should never be committed either

# Local version control folder
store/v*/
```

`.keystore` files in particular can turn into a real security incident if pushed to GitHub. Make sure they're gitignored right alongside your build artifacts.

---

## Summary

| Item | Approach |
|------|------|
| Storing build files | Local-only folder (`apk_build_files/`) |
| Version distinction | By folder name (`v1.0/`, `v2.0/`) |
| Removing from git tracking | `git rm -r` |
| Preventing recurrence | Add the pattern to `.gitignore` |

Source code goes in git. Build artifacts stay local. That's the basic principle.
