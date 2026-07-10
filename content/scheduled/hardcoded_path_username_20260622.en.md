---
title: "Just One Username Changed — Tracking Down Hardcoded Absolute Paths"
date: '2026-06-22'
publish_date: '2026-07-17'
description: When my macOS username changed from hy to hs after switching laptops, I traced every /Users/hy absolute path across the project with grep and fixed them all — an experience and its lesson
tags:
  - macOS
  - grep
  - Absolute Paths
  - Dev Environment
  - Troubleshooting
---

## Switched laptops, and the build script drops files in the wrong place

Last time I moved my dev setup to a new Mac, I re-configured the build environment. That process wrapped up somehow, but a few days later I realized a quieter, sneakier problem had been left behind.

The fact that **my macOS username had changed.**

- Old laptop's home directory: `/Users/hy`
- New laptop's home directory: `/Users/hs`

Doesn't sound like much, right? But over time, I'd **hardcoded absolute paths** like `/Users/hy/...` scattered all over the project. Build artifact storage locations, docs, scripts, even editor/tool config files. The moment the username changed, all these paths started pointing to "a folder that doesn't exist."

The problem is that **this often doesn't throw an error.** For example, if a build script uses `mkdir -p` to create a folder and copies output there, it creates a **brand-new, wrong folder** called `/Users/hy` with no error, and files pile up there. Meanwhile I'm looking for that file in `/Users/hs`. It silently goes sideways.

So this time, I resolved to find and fix every path with the old username, across the entire project. Here's the process.

---

## Prep: what to search for

The goal is simple. Find **every place the old absolute path `/Users/hy` is baked in**, within the project. `grep` alone is enough as the core tool.

Before searching, it's worth deciding one thing: **which folders to ignore.** `node_modules` and build caches are full of paths I don't need to (or shouldn't) touch, so excluding them keeps results clean.

---

## Step 1. A full grep sweep for hardcoded paths

First, find every file containing the old path, starting from the project root. Use `-r` (recursive), `-l` (filenames only), `-n` (line numbers) as needed.

```bash
# Which "files" contain /Users/hy (excluding node_modules)
grep -rln "/Users/hy" . | grep -v node_modules
```

My result looked like this.

```
BUILD.md
build_aab.sh
store/CHANGELOG.md
```

Docs, a shell script, a changelog — all different kinds. Next, check **which line number** in each file it's baked into.

```bash
grep -n "/Users/hy" BUILD.md build_aab.sh store/CHANGELOG.md
```

```
BUILD.md:7:| AAB deploy | `/Users/hy/Documents/workspace/apk_build_files/...` |
BUILD.md:23:... copied to `/Users/hy/Documents/workspace/apk_build_files/...`.
build_aab.sh:7:RELEASE_DIR="/Users/hy/Documents/workspace/apk_build_files/chainPlay"
store/CHANGELOG.md:4:> AAB file: `/Users/hy/Documents/workspace/apk_build_files/...`
store/CHANGELOG.md:106:- [ ] After building AAB, copy to ...
```

> 💡 If you want to narrow scope by extension, use `--include`.
> ```bash
> grep -rln "/Users/hy" . --include="*.md" --include="*.sh" --include="*.json" | grep -v node_modules
> ```

One important point here. **The doc (`BUILD.md`) and the actual script (`build_aab.sh`) are a pair.** Fix only the path written in the doc without fixing the script, and the build still drops files at the old path. The reverse is true too. You need to look at both together.

---

## Step 2. Bulk-replacing paths in docs and scripts

If the path is exactly the same string, replacing it is straightforward. If it shows up multiple times in one file, "replace all" handles it.

For the script, only the `RELEASE_DIR` line needs changing.

```bash
# build_aab.sh
RELEASE_DIR="/Users/hs/Documents/workspace/apk_build_files/chainPlay"
#                   ↑ hy → hs
```

Since this script later creates the folder itself via `mkdir -p "$RELEASE_DIR"`, just fixing the path string to the new username is enough for it to work as-is.

For bulk replacement from the command line, `sed` works well too. Note that **macOS's `sed` needs an empty extension (`''`) right after `-i`** (this differs from Linux and trips people up constantly).

```bash
# macOS: in-place replacement, no backup
sed -i '' 's#/Users/hy#/Users/hs#g' BUILD.md build_aab.sh store/CHANGELOG.md
```

> ⚠️ When using `sed` for path replacement, it's easier to use `#` instead of `/` as the delimiter. Paths are full of `/`, so a `s/.../.../ ` form drags you into escaping hell.

I wanted to review each change visually, so I edited files one by one myself. Bulk replacement is convenient, but it's worth double-checking whether it's semantically OK to touch **a document with a "historical record" nature, like a CHANGELOG.** In this case, since it was guidance on "where to find the AAB file," aligning it with the current environment was the right call.

---

## Step 3. Don't forget external tool configs either

Looking inside the project folder alone isn't the whole story. **Outside the project, in tool configurations,** the old path can be hiding too. I found the old `/Users/hy/...` save path baked into a custom skill's config file that stores blog post drafts.

So I swept the home directory's config folders one more time too.

```bash
# Check for leftover old paths in a tool's config folder
grep -rln "/Users/hy" ~/.claude 2>/dev/null
```

Configs like this are usually "written once and forgotten," so once the folder the old path points to disappears, you end up stuck for a while wondering **"why isn't this file saving?"** If you've changed your username, it's worth checking these too.

---

## Step 4. Final verification — did I really fix everything?

Once fixes are done, run the same grep from the start once more. Only feel safe once the result is empty.

```bash
grep -rln "/Users/hy" . | grep -v node_modules || echo "✅ All old paths cleaned up"
```

```
✅ All old paths cleaned up
```

Bookending it as **"grep before fixing → fix → the same grep after fixing"** lets you confirm with certainty that nothing was missed.

---

## Frequently used commands, summarized

| Purpose | Command |
|---|---|
| Find files containing the path | `grep -rln "/Users/hy" . \| grep -v node_modules` |
| See line numbers too | `grep -n "/Users/hy" <files>` |
| Narrow scope by extension | `grep -rln "..." . --include="*.sh" --include="*.md"` |
| In-place replace on macOS | `sed -i '' 's#/Users/hy#/Users/hs#g' <files>` |
| Check tool configs too | `grep -rln "/Users/hy" ~/.claude` |
| Final verification | `grep -rln "/Users/hy" . \| grep -v node_modules` (should be empty) |

---

## Troubleshooting: traps like these

- **More dangerous because there's no error**: a script with `mkdir -p` just creates a new folder at the old path. If you're thinking "build succeeded, but where did the output go?", suspect the path first.
- **`sed -i` errors on macOS**: doing it the Linux way with `sed -i 's/.../.../ '` throws an error like `command c expects \ followed by text`. macOS needs an **empty backup extension** like `sed -i ''`.
- **Fixed the doc but forgot the script**: the most common mistake. If grep results show both `.md` and `.sh`, both need fixing to stay in sync.
- **Missed configs outside the project**: worth grepping home-directory locations too — `~/.config`, `~/.claude`, editor workspace settings, etc.

---

## Summary — the core flow at a glance

1. **Full sweep with grep** — `grep -rln "old-path" . | grep -v node_modules`
2. **Check line numbers too** — figure out where and how many are baked in
3. **Fix docs and scripts as a pair** — fixing just one side leaves them out of sync
4. **Check tool configs outside the project** too
5. **Final verification with the same grep** — done once the result is empty

---

## The real lesson learned: keep your username consistent

After going through this, the conclusion I landed on was surprisingly simple.

> **Even when switching laptops, keeping the macOS username (home directory name) the same as before is by far the most convenient.**

Thinking about it, all this effort happened purely because `hy` became `hs`. If I'd set up the new Mac with **the exact same username as before**, the `/Users/hy/...` absolute paths would have stayed valid on the new laptop too, and the whole grep-and-replace exercise above would never have been necessary.

Of course, the more fundamental fix is "never hardcode absolute paths in the first place." For scripts, the standard practice is using relative references like `$HOME` or `$(cd "$(dirname "$0")" && pwd)`. But realistically, it's hard to 100% prevent absolute paths from seeping into docs, notes, and tool configs here and there.

So I'd recommend covering both bases.

1. **Keep the username consistent when setting up a new environment** — the easiest insurance
2. **Still, use relative references like `$HOME` in scripts** — code that's less tied to the environment

Because I ended up picking a new username this time, I had to do a full cleanup pass on paths — but it gave me the chance to fully map out "where exactly my project has absolute paths baked in." The next laptop move should go more smoothly. If you're headed down the same road, I hope this post comes to mind **the moment you're setting a username on a new Mac.**
