---
title: 'Can You Switch iTerm2s Menus to Korean? My Actual Findings'
date: '2026-06-22'
publish_date: '2026-07-07'
description: What I learned trying to switch iTerm2 to Korean via macOS's per-app language setting, and how that differs from the real problem — garbled non-ASCII text
tags:
  - iTerm2
  - macOS
  - Terminal
  - Localization
---

## "Can't this be switched to Korean?"

When you first start using the terminal seriously, having an all-English menu feels a little intimidating. `Profiles`, `Preferences`, `Split Vertically`... you get the meaning, but it'd be more comfortable in your own language.

So I dug into whether iTerm2's menus could actually be switched to Korean. **Short answer: macOS does have a feature to set language per app, but it just doesn't work for iTerm2.** Here's why, and how that's different from the "non-ASCII characters look garbled" problem — a surprising number of people mix these two up.

## First, let's separate two different problems

Search around, and you'll find two different kinds of articles mixed together under keywords like "iTerm Korean." You need to know which one you actually want, or you'll waste your time.

| What you want | The actual issue | Fixable? |
|-----------|-----------|-------------|
| **Menus in your language** | App UI language (localization) | Nearly impossible in iTerm2 |
| **Non-ASCII text rendering correctly** | Font / character-width rendering | Fixable via settings |

This post is a record of attempting the first (menu localization), with the second (garbled text) addressed separately at the end.

## Step 1. Trying macOS's per-app language setting

Separate from the system-wide language, macOS lets you **assign a language per app.** A feature meant for switching just one specific app you don't want in English into your own language.

```
System Settings
  → General
  → Language & Region
  → Scroll down to the "Applications" section
  → Click the + button
  → Select iTerm from the list
  → Set the language to "Korean"
```

Anyone can do this much. Apps like KakaoTalk switch languages just fine with this method.

## Step 2. But iTerm2 doesn't change

I finished the setting and relaunched iTerm2. The menu was **still in English.**

The reason is simple. macOS's per-app language assignment only works **"if the app itself ships a translation for that language."** In other words, the app needs to contain Korean-language resources (a translation file like `ko.lproj`) internally.

iTerm2 is an open-source project, and its translation is English-first with only partial support for a few other languages. **A Korean translation essentially doesn't exist.** So even setting the language to Korean has no translation to apply, and it falls back to English. Not a bug — it's simply "there is no translation."

You can confirm this yourself by peeking inside the app bundle.

```bash
ls /Applications/iTerm.app/Contents/Resources/ | grep lproj
```

If `ko.lproj` doesn't show up here, it means there's no Korean translation. (Usually you'll just see `English.lproj`.)

## Step 3. So what do you do — practical alternatives

If menu localization is a dead end, here are the practical alternatives.

1. **Get used to the English menus** — the ones you'll actually use often are things like `Preferences`, `Profiles`, `Split`. Memorize a handful, and you're set.
2. **Lean on keyboard shortcuts** — this reduces how often you even need to open the menu. New tab `⌘T`, split vertically `⌘D` / horizontally `⌘⇧D`, preferences `⌘,`.
3. **Non-ASCII text inside the terminal works freely regardless** — the menu being English is one thing; typing and displaying non-ASCII text *inside* the terminal works perfectly fine as long as the font is set up right. Which brings us to the next topic.

## The thing people actually ask about — "non-ASCII text is garbled"

Honestly, a good chunk of "iTerm Korean" searches aren't about the menu at all — they're about **non-ASCII text inside the terminal getting garbled or spaced out character by character.** This isn't localization — it's a **font/character-width** issue, and it's cleanly fixable through settings.

```
iTerm2 → Settings(⌘,) → Profiles → Text
  → ✅ Turn on "Use Unicode version 9+ widths"   ← the key fix for character spacing
  → Unicode normalization form → NFC
  → Change Font to a CJK-supporting coding font (D2Coding / Sarasa Term K)
```

Install a CJK font via Homebrew.

```bash
brew install --cask font-d2coding
# or
brew install --cask font-sarasa-gothic
```

Open a **new window** after configuring, and non-ASCII text displays normally. The menu stays in English, but what actually matters — "non-ASCII text inside the terminal" — gets resolved by this.

## Common sticking points (troubleshooting)

**Q. I picked iTerm in per-app language settings, but it's still in English.**
That's expected. iTerm2 has no Korean translation. Your settings aren't wrong.

**Q. Other apps switch to Korean with this same method, though?**
Those apps ship a Korean translation (`ko.lproj`). It comes down to whether the translation exists.

**Q. It's not the menu — the non-ASCII text inside the terminal is broken.**
That's solved by the last section of this post (font + Unicode 9 setting). A separate issue from menu language.

## Summary

- macOS **per-app language setting**: available via `System Settings → General → Language & Region → Applications`
- But **iTerm2 has no Korean translation**, so the menu stays in English (not a bug)
- Practical alternative: **memorize a few English menu items + lean on keyboard shortcuts**
- "Non-ASCII text is garbled" is a **different problem** → fixed with `Use Unicode version 9+ widths` + **a CJK coding font**

Menu localization is, unfortunately, a dead end. But once you actually use it, the menus you touch often are few, and as long as non-ASCII text inside the terminal isn't broken, there's hardly any real inconvenience. Shifting the ambition from "translate the menu" to "display non-ASCII text cleanly" turned out to be the actual answer.
