---
title: '4 Ways to Quickly Copy Just a File Path on a MacBook'
date: '2026-06-22'
publish_date: '2026-07-04'
description: How to copy the full path of a file or folder on macOS without installing any app — Option right-click, the ⌥⌘C shortcut, terminal drag-and-drop, and pbcopy
tags:
  - macOS
  - Finder
  - Terminal
  - Productivity
---

## "What was that file path again?"

Typing commands in the terminal, you constantly run into moments where you need a file or folder's **full path** — `cd`-ing somewhere, dropping a path into a script, telling someone "the file's right here."

But type a path out by hand, and nine times out of ten you'll typo it. Getting a long path like `/Users/hs/Documents/workspace/...` exactly right, character for character, is a chore.

Fortunately, macOS provides ways to copy a clean path **with zero extra app installs.** Here are the 4 I use every day, organized by situation.

## 1. Option right-click — "Copy as Pathname" (the most intuitive)

Right-clicking a file or folder in Finder usually shows a **"Copy"** menu item. Hold down `Option (⌥)` while that menu is open, and it changes slightly.

```
Right-click the file → while holding ⌥(Option) → click "Copy '<filename>' as Pathname"
```

- Normally: `Copy`
- With ⌥ held: **`Copy as Pathname`**

Click it, and the full path (`/Users/hs/Documents/...`) lands in your clipboard. Since you can watch the menu change with your own eyes before clicking, this is the most reassuring method if you're not yet comfortable with the shortcut.

## 2. The ⌥⌘C shortcut — fastest once your hands remember it

The exact same action, in one shortcut.

```
Select the file/folder → ⌥ + ⌘ + C
```

With an item selected in Finder, press `Option + Command + C`, and the full path is copied instantly. No need to even open the right-click menu. Once you're used to it, this is the fastest.

> Note: plain `⌘C` copies **the file itself** (pasting creates a copy of the file), while `⌥⌘C` copies **the path text.** One character's difference, completely different result — don't mix them up.

| Shortcut | What gets copied |
|--------|-------------|
| `⌘C` | The file/folder itself (pasting creates the file) |
| `⌥⌘C` | The file/folder's **path as text** |

## 3. Drag & drop into the terminal — not exactly copying, but "typing it in directly"

Not technically "copying," but the method I use most in practice.

**Drag a file or folder** onto an iTerm2 or default Terminal window, and its path gets typed automatically at the cursor position.

```bash
# Type "cd " in the terminal, then drag the folder into the window:
cd /Users/hs/Documents/workspace/claude_code/backtodev
```

Since spaces in the path get automatically escaped (`\ `), this is often more convenient than copy-paste when you're typing out a command.

## 4. pwd | pbcopy — send your current location straight to the clipboard

If you're already sitting inside a folder in the terminal, copying its path is a single line.

```bash
pwd | pbcopy
```

- `pwd`: prints the current working directory's path
- `pbcopy`: sends the output to **the clipboard** (a built-in macOS command)

Now you can paste it anywhere with `⌘V`. Worth knowing its counterpart too — `pbpaste`, which brings clipboard contents into the terminal.

You can extend this to copy a specific file's absolute path directly.

```bash
# Copy the absolute path of a specific file in the current folder
echo "$(pwd)/config.yaml" | pbcopy
```

## Summary by situation

| Situation | Recommended method |
|------|-----------|
| Need a file path from Finder | `⌥⌘C` (or Option + right-click) |
| Not yet comfortable with the shortcut | Hold Option and right-click |
| Typing a command in the terminal | **Drag & drop** into the window |
| Need the path of the folder you're currently in | `pwd \| pbcopy` |

## Common sticking points (troubleshooting)

**Q. I pressed ⌥⌘C and it copied the file instead.**
You likely didn't hold `Option (⌥)` at the same time. `⌘C` alone copies the file itself. You need to hold `⌥` firmly together with it to copy the path text.

**Q. It says pbcopy doesn't exist.**
`pbcopy`/`pbpaste` are built-in macOS commands and almost always exist. If it's really missing, your shell might be in a very unusual environment (some containers, etc.) — in that case, just copy the `pwd` output manually.

**Q. My command breaks because there's a space in the path.**
Drag & drop automatically escapes spaces as `\ `. If you pasted it manually instead, wrap the whole path in double quotes `"..."`.

## Summary

Path-copying on a Mac, boiled down:

1. **Finder** → `⌥⌘C`, or hold Option and right-click → "Copy as Pathname"
2. **Typing in the terminal** → drag & drop the file into the window
3. **Current folder** → `pwd | pbcopy`

All of it works with zero extra installs, using only built-in macOS features. Get these into muscle memory, and typo-ing paths becomes a lot less common. I personally reach for `⌥⌘C` and `pwd | pbcopy` the most.
