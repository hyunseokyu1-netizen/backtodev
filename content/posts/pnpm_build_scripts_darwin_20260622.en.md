---
title: 'When pnpm install Dies With Exit 1: Build Script Approval and the Per-Platform Native Binary Trap'
date: '2026-06-22'
publish_date: '2026-07-10'
description: A record of fixing pnpm install exit 1 while moving an Expo monorepo configured for Replit (linux-x64) over to an Apple Silicon Mac, resolved via onlyBuiltDependencies and allowBuilds
tags:
  - pnpm
  - Expo
  - React Native
  - Monorepo
  - Apple Silicon
---

## Intro: "it's just an install, why is it dying?"

I moved `Tilt`, an Expo (React Native) game app I'd been working on from another laptop, over to a new MacBook (Apple Silicon, `darwin-arm64`). Since `node_modules` is huge, I left it out of the copy, figuring a single `pnpm install` on the new Mac would just handle everything.

Instead, install died like this.

```
 ERR_PNPM_IGNORED_BUILDS  Ignored build scripts: esbuild@0.27.3.
```

And the process exited with **exit 1**. What made it more baffling was that esbuild was clearly already listed under `onlyBuiltDependencies`. The build was supposedly allowed, yet it "ignored" it anyway and exited with a non-zero code — which then blocked the dependency-check gate in the subsequent `expo run:android` step entirely.

This post is a record of **the traps that show up when bringing a pnpm monorepo config optimized for Replit (linux-x64) over to a different OS/architecture**, and how I untangled them. Coming at pnpm monorepos properly for the first time as I got back into development, I've written this as approachably as I can for anyone hitting the same wall.

> This post focuses on "why did install die." A gradle build and Android signing issue I ran into the same day is covered in a separate post.

---

## Background: pnpm's build script security policy

There's a concept worth knowing first. npm packages can run **lifecycle scripts** like `postinstall` during installation. Packages that fetch native binaries, like esbuild, typically use this script to download the binary.

The problem is this is a common vector for supply-chain attacks. So modern pnpm **doesn't run build scripts by default.** Only explicitly allowed packages get to run theirs. There are two ways to allow them.

| Key | Location | Role |
| --- | --- | --- |
| `onlyBuiltDependencies` | `pnpm-workspace.yaml` | **the list** of packages allowed to run build scripts |
| `allowBuilds` | `pnpm-workspace.yaml` | per-package `true`/`false` build permission |

Approving interactively with the `pnpm approve-builds` command writes the result into `allowBuilds`. How these two conflicted was the crux of this whole incident.

---

## Prerequisites

- Node.js + pnpm (I use pnpm for the monorepo)
- Apple Silicon Mac (`darwin-arm64`)
- An existing `pnpm-workspace.yaml`, brought over as-is from a different platform

---

## Step 1. Don't take the error message at face value

At first, seeing just `ERR_PNPM_IGNORED_BUILDS`, I figured "just add esbuild to the allowed list." Opening it up, it was already there.

```yaml
onlyBuiltDependencies:
  - '@swc/core'
  - esbuild        # ← definitely there
  - msw
  - unrs-resolver
```

Being on the list and still "ignored" was a sign that **some other setting was blocking the build more strongly than the list itself.** Reading all the way to the end of the file turned out to be the decisive move here.

---

## Step 2. The real culprit — a broken `allowBuilds` placeholder

At the very bottom of `pnpm-workspace.yaml`, there was this.

```yaml
allowBuilds:
  esbuild: set this to true or false
```

A placeholder left behind by `pnpm approve-builds`. Someone (or some tool) had generated this line for someone to fill in with `true`/`false`, but the value was still sitting there as the literal **string** `set this to true or false`.

From pnpm's perspective, since this isn't `true`, it blocks the esbuild build. So having it in `onlyBuiltDependencies` didn't do anything at all. The list is a "candidate," and `allowBuilds` is the "final decision."

The fix was simple. I could've edited it by hand, but I had pnpm fill it in directly instead.

```bash
pnpm approve-builds --all
```

The line got corrected to this.

```diff
-allowBuilds:
-  esbuild: set this to true or false
+allowBuilds:
+  esbuild: true
```

Once fixed, esbuild's postinstall ran normally, and `pnpm install` finally finished with **exit 0.**

> **Lesson:** if you're still seeing "ignored builds" despite adding something to `onlyBuiltDependencies`, check all the way to the bottom of the file for a broken value or `false` sitting in `allowBuilds`. It's surprisingly common for an auto-generated placeholder to get committed unfilled.

---

## Step 3. Undoing per-platform native binary overrides

Separate from the build-blocking issue, this config file had originally been optimized **exclusively for Replit (linux-x64).** Packages like esbuild, lightningcss, and rollup ship separate binary packages per OS/architecture, and since Replit only needed linux-x64, everything else had been stripped out via `overrides`.

```yaml
overrides:
  # replit uses linux-x64 only, we can exclude all other platforms
  "esbuild>@esbuild/darwin-arm64": "-"   # ← the exact binary the Mac needs is excluded
  "esbuild>@esbuild/darwin-x64": "-"
  "esbuild>@esbuild/linux-arm64": "-"
  ...
```

`"-"` means "don't install this dependency." The problem: the new Mac is `darwin-arm64`. The very binary the Mac needed was sitting in the exclusion list — so even if install had luckily passed, the build step would've failed to find the binary and blown up.

So I selectively removed the exclusion just for the darwin-arm64 lines. 5 packages were affected.

| Package | Line unblocked |
| --- | --- |
| esbuild | `@esbuild/darwin-arm64` |
| lightningcss | `lightningcss-darwin-arm64` |
| @tailwindcss/oxide | `@tailwindcss/oxide-darwin-arm64` |
| rollup | `@rollup/rollup-darwin-arm64` |
| @expo/ngrok-bin | `@expo/ngrok-bin-darwin-arm64` |

As a diff, it's just removing one line at a time.

```diff
   "esbuild>@esbuild/android-x64": '-'
   "lightningcss>lightningcss-android-arm64": "-"
-  "lightningcss>lightningcss-darwin-arm64": "-"
   "lightningcss>lightningcss-darwin-x64": "-"
...
-  "rollup>@rollup/rollup-darwin-arm64": "-"
   "rollup>@rollup/rollup-darwin-x64": "-"
...
-  "@expo/ngrok-bin>@expo/ngrok-bin-darwin-arm64": "-"
   "@expo/ngrok-bin>@expo/ngrok-bin-darwin-x64": "-"
```

I left darwin-x64 (Intel Mac), win32, and other linux lines untouched. Since this one machine is a single Apple Silicon variant, unblocking just that was enough — no reason to also pull down unnecessary binaries and bloat the install.

---

## Frequently used commands, summarized

| Situation | Command |
| --- | --- |
| Check which builds got ignored | the `Ignored build scripts:` line in `pnpm install` output |
| Approve build scripts in bulk | `pnpm approve-builds --all` |
| Approve only a specific package | `pnpm approve-builds` (interactive selection) |
| Verify the install result | check the exit code (`echo $?`) |

Worth remembering the flow:

1. `onlyBuiltDependencies` = the **candidate list** for build approval
2. `allowBuilds` = the **final on/off** per package (takes priority)
3. `overrides` + `"-"` = **excludes installation** of a specific platform's binary

---

## Troubleshooting

**Q. I added it to `onlyBuiltDependencies`, but "Ignored build scripts" keeps showing up.**
Chances are the package is `false` in `allowBuilds`, or an auto-generated placeholder string was left unfilled. Check all the way to the bottom of the file, and fix it with `pnpm approve-builds --all`.

**Q. Install passed, but the build/run step can't find the native binary.**
Check whether the current platform's binary (find it via `node -p "process.platform + '-' + process.arch"`) is excluded with `"-"` in `overrides`. This commonly happens when bringing over a config written for a single platform like Replit or a specific CI.

**Q. Do I need to unblock binaries for every other platform too?**
No. Unblocking just the one architecture you're currently using is enough. If you'll be sharing across multiple machines, unblock only those machines' platforms as needed.

---

## Summary: the flow at a glance

At first this looked like "just one esbuild build issue," but it was actually **two independent traps layered on top of each other.**

1. **Build script approval conflict** — even listed in `onlyBuiltDependencies`, a broken placeholder in `allowBuilds` took priority and blocked it → fixed with `approve-builds --all` correcting it to `esbuild: true` → install exits 0.
2. **Per-platform binary exclusion** — Replit (linux-x64)-only `overrides` had blocked even the darwin-arm64 binary → unblocked the darwin-arm64 lines for the 5 packages the Mac needed.

The one thing worth taking away: **when moving a config file optimized for a specific platform (Replit, a specific CI) to a different OS/architecture, suspect "build approval state" and "platform overrides" before the dependency list itself.** The error message (`Ignored build scripts`) is just a symptom — the real switch is often hiding at the very bottom of the file.
