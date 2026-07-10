---
title: "What You Actually Need to Save When Switching MacBooks Isn't Code — It's Keys"
date: '2026-06-22'
publish_date: '2026-07-11'
description: How to safely move signing keys, environment variables, and credentials that git clone doesn't bring along, over to a new MacBook
tags:
  - git
  - macOS
  - Android
  - Secrets Management
  - Dev Environment
---

Got a new MacBook. Exciting. I casually thought, "all my code's on GitHub, so a `git clone` is all I need."

But once I actually moved everything over, the app's release build wouldn't run. No signing key. Turned out that key file was gitignored — a file that **absolutely never comes along with a clone.**

When moving a dev environment, the real danger isn't the code. It's **everything that never makes it into git.** Here's the list of "you must grab these separately" items I put together after living through this firsthand.

## Core principle: split into "in git" vs. "not in git"

Splitting what you're moving into exactly two categories clears things up.

| Category | Examples | How to move it |
|------|------|-----------|
| **In git** | source code, committed config files | `git clone` and you're done |
| **Not in git** | signing keys, `.env`, credentials | **must be handled manually** ← this is the trap |

Anyone who trusts clone alone gets burned by the second category. Let's go through them one by one.

## Step 1. The most dangerous one — the Android release signing key

Short answer first: this is the most dangerous. **Lose it, and even Google won't recover it for you.**

To publish an Android app to the Play Store, it needs to be signed with a release key (`.jks` or `.keystore`). For security, this key is almost always registered in `.gitignore`. In other words, **it's not in the git repo.** Let's confirm directly.

```bash
# Check whether this key is tracked by git
git check-ignore android/app/my-release-key.jks
# → if a path is printed = gitignored = won't come along with a clone!

git ls-files android/app/my-release-key.jks
# → if nothing shows up = not in git = manual backup is mandatory
```

In my case, `check-ignore` spat the path right back. If I'd moved things via clone, I would have lost this key entirely.

### Grabbing the key alone isn't enough — the password is part of the set

Having just the keystore file with no signing password means **that key is useless.** The password is usually inside `build.gradle` or `gradle.properties`.

```gradle
// android/app/build.gradle
signingConfigs {
    release {
        storeFile file('my-release-key.jks')
        storePassword "..."   // ← needs to be backed up too
        keyAlias "..."
        keyPassword "..."     // ← this too
    }
}
```

So when backing things up, I bundled **the key file + the config file holding the password** together as one set.

```bash
BK=~/Desktop/release-keys-backup
mkdir -p "$BK"
cp android/app/my-release-key.jks    "$BK/"
cp android/app/build.gradle          "$BK/"   # includes the password
cp android/gradle.properties         "$BK/"
```

> ⚠️ The standard practice for a signing key is to keep **2 or more copies**, physically separated — like on the laptop plus an external SSD. Since the password sits in plaintext, it's safer to put it inside a password-protected zip or something like 1Password.

### On the flip side, things you don't need to back up

Trying to grab everything just adds confusion. **Anything that regenerates automatically can just be left behind.**

| File | Back up? | Reason |
|------|:----:|------|
| `release.jks` / `.keystore` | ✅ Essential | unrecoverable if lost |
| `~/.android/debug.keystore` | ❌ Unnecessary | auto-generated on the first build (debug-only) |
| `~/.android/adbkey` | ❌ Unnecessary | adb device auth key, regenerates |
| `~/.android/avd`, `cache` | ❌ Unnecessary | emulator/cache |

Not moving the entire `~/.android/` folder doesn't hurt development at all. **Just worry about the release signing key.**

## Step 2. Environment variables — `.env.local`

The second trap is `.env` files. These are also almost always in `.gitignore`. API keys, DB passwords, tokens are all in there, and a clone leaves you empty-handed.

```bash
# find env files hiding in the project
ls -la | grep -E "\.env"
# if you see .env.local, .envrc, etc., these need to be moved separately
```

My project's `.env.local` had things like `GITHUB_TOKEN`, `JWT_SECRET`, `DEEPL_API_KEY`. Without these, half the app doesn't function.

An `.env` file is **a chunk of plaintext secrets**, so the transfer method matters. Move it directly via AirDrop or USB, and avoid messaging apps, email, or public cloud storage.

> 💡 AirDropping a whole folder brings hidden files like `.env.local` along too. If Finder isn't showing hidden files, press `Cmd + Shift + .` to reveal them.

## Step 3. git / GitHub auth — don't copy it, log back in instead

This is where a lot of confusion sets in. "Do I need to copy git auth info as a file too?" The answer is **mostly no.**

On macOS, git auth isn't stored as a file — it's stored in the **Keychain.** Open `~/.gitconfig`, and it looks like this.

```bash
git config --global --list | grep credential
# credential.helper=osxkeychain   ← means auth lives in the Keychain
```

The `gh` CLI token goes into the keyring (Keychain) too. So **rather than copying files over, logging in fresh on the new MacBook is simpler and safer.**

```bash
# On the new MacBook — basic git config (3 lines and done)
git config --global user.name "My Name"
git config --global user.email "my.email@example.com"

# GitHub auth: log in fresh (a new token gets issued)
gh auth login
```

To summarize, git-related things split up like this.

| Item | Location | How to move it |
|------|------|-----------|
| `~/.gitconfig` (name, email, settings) | file | copyable, or reconfigure in 3 lines |
| git/gh **auth tokens** | macOS Keychain | **don't copy → log in again** |
| SSH key `~/.ssh/id_rsa` | file | copy it, or generate a new one and register it with GitHub |

The SSH key is the only actual file here, so you can choose to copy it or generate and register a new one.

## Frequently used check commands

Commands to scan for "what's not in git" all at once before moving.

```bash
# 1. Find hidden env files inside the project
ls -la | grep -E "\.env"

# 2. Search for signing keys across the entire workspace
find ~/workspace -type f \( -name "*.keystore" -o -name "*.jks" \) | grep -v node_modules

# 3. Check whether a specific key is gitignored
git check-ignore path/to/my-key.jks

# 4. Check the git auth method
git config --global --list | grep credential
```

## Troubleshooting

**Q. I AirDropped an entire folder and it's way too slow.**
A. Nine times out of ten it's `node_modules`. Run `rm -rf node_modules` before sending, and reinstall with `npm install` on the new MacBook — much faster.

**Q. I definitely copied `.env.local`, but it's not showing up on the new MacBook.**
A. That's because it's a hidden file. Press `Cmd + Shift + .` in Finder to toggle hidden file visibility.

**Q. I have no idea where I wrote down the signing key password.**
A. Look for `storePassword` / `keyPassword` in `android/app/build.gradle` or `gradle.properties`. It's usually sitting there in plaintext.

## Summary

What you actually need to grab when replacing a MacBook isn't the code — it's **whatever never made it into git.**

1. **Android release signing key** (`.jks`/`.keystore`) — gitignored, so it won't come along with a clone. **Back it up as a set with its password.** Unrecoverable if lost
2. **`.env.local`** — plaintext secrets. Transfer directly via AirDrop/USB
3. **git/gh auth** — lives in the Keychain, so **log in again** instead of copying. Only the SSH key needs to be grabbed as a file
4. **Things like `~/.android/debug.keystore` don't need backing up** — they regenerate automatically

Clone only moves the code. Remember that everything else needs to be grabbed by hand, and you won't be caught off guard on a new MacBook wondering "why won't this build?"
