---
title: 'Moving a React Native (Expo) Project to a New Computer — Copying Without node_modules, Then Restoring the Environment'
date: '2026-06-21'
publish_date: '2026-07-02'
description: The full process of restoring an Expo project moved without node_modules using npm ci, including catching a missing nvm shell load
tags:
  - React Native
  - Expo
  - npm
  - nvm
  - Node.js
---

## Why leave node_modules out when moving a project

I needed to move my dev environment to a new computer. My first instinct was to just copy the whole React Native (Expo) project folder as-is, but opening the folder reveals `node_modules` alone easily running past several hundred MB, even a full GB. Tens of thousands of files, too — the copy itself is slow and sometimes stalls mid-way.

So the usual move is to **copy everything except `node_modules`.** This folder is, after all, "a cache you can regenerate." What actually matters are two files that record exactly which packages at which versions you're using: `package.json` and `package-lock.json`. With just these two, you can regenerate an identical `node_modules` on the new computer.

This time, I copied my project over from the old computer with only `node_modules` left out. This post is a straightforward record of **actually restoring that moved project to a working state.** It's not just "run npm install and you're done" — it also covers an nvm trap I ran into along the way, and the steps to verify the restoration actually worked.

> 📌 This post is **Part 1 — Restoration.** The follow-up, covering reviving dependencies through Android native builds and installing on a real device, is in [Part 2 — Building an RN Project on a New Laptop](/posts/rn_new_laptop_build_20260622).

## Pre-check: what's here, what's missing

Before starting the restoration, it's worth assessing the current state. A step to visually confirm what's missing from the folder you moved over.

```bash
ls -la
```

My project looked like this.

| Item | Status | Meaning |
|---|---|---|
| `package.json` | Present | dependency list — the core of the restoration |
| `package-lock.json` | Present | locked version info — lets you reproduce identically |
| `android/` | Present | native project folder, copied as-is |
| `src/`, `App.tsx` | Present | source code, as-is |
| `node_modules/` | **Missing** | the target to restore |

The key detail is that `package-lock.json` came along too. With it, you can restore not just "similar versions" but **versions exactly identical to the old computer.** This is exactly why I use `npm ci` rather than `npm install` later.

## Step 1. Confirm Node is actually recognized (the first trap)

Installing dependencies obviously needs Node.js. So I checked the version first:

```bash
node -v
# zsh: command not found: node
```

`command not found`. I assumed the new computer had no Node at all, but actually, **nvm was installed — the shell just wasn't loading it.**

> **nvm (Node Version Manager)** is a tool that lets you install multiple Node.js versions and pick which one to use. But nvm needs to be "loaded" once from a shell config file like `~/.zshrc` when a terminal opens, for the `node` command to become active. Miss that load line, and even with Node installed via nvm, `node` can't be found.

I first checked which Node versions nvm actually had installed.

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"   # manually load nvm
nvm ls
```

`v24.17.0` was right there, properly installed. So it wasn't that Node was missing — **the shell just wasn't auto-loading nvm.** This gets permanently fixed in Step 4. For now, loading it manually like above makes `node`, `npm`, and `npx` all work within that same terminal session.

## Step 2. Restore dependencies with npm ci

Now the core part. Reviving `node_modules`.

```bash
npm ci
```

Why `npm ci` instead of `npm install`:

| | `npm install` | `npm ci` |
|---|---|---|
| Reference file | `package.json` | `package-lock.json` |
| Versions | can update to the latest within range | stays exactly at the locked versions |
| Existing node_modules | partial update | wiped entirely and reinstalled fresh |
| Reproducibility | relatively lower | **exactly identical reproduction** |

When restoring a moved project, the goal is "an identical state to the old computer," so `npm ci` is the right call. Since it follows the lock file exactly, it prevents subtle bugs from unintended version bumps.

Here's the result.

```
added 634 packages, and audited 635 packages in 29s
```

634 packages restored in 30 seconds. You might see a pile of `npm warn deprecated ...` or `N vulnerabilities` warnings along the way — that's common noise in the library ecosystem. **You can ignore these at the restoration stage.** If the project ran fine before you moved it, these warnings aren't new problems — they were already there.

## Step 3. Verify the restoration actually worked

`npm ci` finishing without an error isn't the end. Whether every package installed is a separate question from whether the code actually compiles. I checked two things.

### 3-1. TypeScript type check

```bash
npx tsc --noEmit
```

`--noEmit` means "just run the type check, don't actually emit any JS output." No output means no type errors. In my case, it passed cleanly. Passing this at least guarantees "the type-definition packages restored properly, and they line up with the source code's version."

### 3-2. Expo dependency compatibility check

For an Expo project, there's one more step. Expo has a recommended version per package for each SDK version — "this package needs to be this version to be compatible."

```bash
npx expo install --check
```

Result:

```
The following packages should be updated for best compatibility:
  expo@54.0.34 - expected version: ~54.0.35
  expo-localization@17.0.8 - expected version: ~17.0.9
```

It flags a slight patch-version mismatch. This kind of gap barely affects actual usage, but if you want it perfectly aligned, sync it to Expo's recommended versions like this.

```bash
npx expo install expo expo-localization
```

> **Tip:** when adding packages to an Expo project, it's worth building the habit of using `npx expo install` instead of `npm install`. It automatically picks the version compatible with your current SDK.

## Step 4. Permanently fixing nvm's auto-load

Back to the "can't find node" issue from Step 1. Manually loading nvm every single terminal session is tedious. Check whether these two lines exist in `~/.zshrc`, and add them if not.

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
```

Once added, reload the config.

```bash
source ~/.zshrc
node -v   # now v24.17.0 shows up right away
```

Do this, and `node`, `npm`, `npx`, `npx expo start` all work immediately even in a fresh terminal. This is a commonly missed step right after setting up a new computer, so it's worth flagging.

## Frequently used restoration commands, summarized

```bash
# 0) (on a new computer) confirm nvm is loaded
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
node -v

# 1) restore all dependencies exactly, based on the lock file
npm ci

# 2) verify code consistency via type check
npx tsc --noEmit

# 3) (Expo) check / align SDK-compatible versions
npx expo install --check
npx expo install <package-name>
```

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `node: command not found` | nvm not loaded into the shell | add the nvm load lines to `~/.zshrc`, then `source ~/.zshrc` |
| `npm ci` fails, says no lock file | `package-lock.json` is missing | fall back to `npm install` (versions may update, unfortunately) |
| Version mismatch error during `npm ci` | `package.json` and the lock file are out of sync | reconcile them, or regenerate the lock file with `npm install` |
| deprecated / vulnerabilities warnings | ecosystem noise | ignore at the restoration stage — unrelated to functionality |
| Expo package version warning | slight mismatch from the SDK's recommended version | align it with `npx expo install <package>` |

## Summary — the restoration flow at a glance

Here's the whole flow of reviving a React Native (Expo) project moved to a new computer without `node_modules`, summarized.

1. **Assess the current state** — confirm `package.json` and `package-lock.json` both came along (these two are the prerequisite for restoration)
2. **Check Node** — if `node -v` fails, suspect an nvm-loading issue first
3. **`npm ci`** — restore dependencies exactly identical to the old environment, based on the lock file
4. **Verify** — check types with `npx tsc --noEmit`, check SDK compatibility with `npx expo install --check`
5. **Wrap up** — permanently fix the terminal environment by adding the nvm-loading lines to `~/.zshrc`

The key mindset is that **`node_modules` is a cache, not baggage.** No need to lug it around heavily — as long as you keep the `lock` file safe, you can restore an identical environment on any computer in about 30 seconds. It's tempting to just install and call it done right after moving, but adding one type check and one compatibility check clears out the common trap of "I definitely installed it, but it won't run" ahead of time.
