---
title: 'When Claude Code Breaks Into Dotted Lines in iTerm2: CJK Width Settings and Coding Fonts'
date: '2026-06-22'
publish_date: '2026-07-01'
description: A record of fixing horizontal lines breaking into dotted dashes and Korean characters spacing out oddly in iTerm2, using the Unicode 9 width option and D2Coding/Sarasa fonts
tags:
  - iTerm2
  - Terminal
  - Font
  - Claude Code
  - macOS
---

## The screen started looking wrong

I was using Claude Code in the terminal. It's supposed to be a clean box UI, but the screen looked like this.

```
H e l l o !  H o w  c a n  I  h e l p ?- - - - - - - - -
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
```

The horizontal divider line wasn't a solid line (`─`) but had **broken into dotted dashes (`- - - -`)**, and non-ASCII text was **oddly spaced out character by character.** Nothing was actually corrupted, so it wasn't a functional problem, but it was distracting every time I looked at it.

At first I assumed it was a Claude Code bug. Turns out, in short, it was **a terminal font and character-width handling issue.** I suspect a fair number of people run into the same symptom, so I'm writing down the cause and the fix.

## Why does this happen

There are two symptoms, but they both trace back to essentially one cause.

### 1. Why non-ASCII text spaces out character by character — East Asian Width

Characters like Korean, Chinese, and some emoji take up **two columns worth of a regular character's width** in a terminal. These are called "East Asian Wide" characters.

The problem is that this "2-column width" rule has shifted slightly across Unicode versions. If a terminal calculates width using an **older standard (Unicode 8 or earlier)**, the character width the program (Claude Code) assumes and the width the terminal actually renders **fall out of sync.** That mismatch shows up as gaps between characters.

### 2. Why horizontal lines break into dots — font glyphs

TUIs like Claude Code draw dividers using **box-drawing characters** — for example, `─` (U+2500). If the terminal font is missing this glyph, or the width calculation is off, a continuous solid line **fails to connect and breaks apart**, looking like a dotted line.

To summarize:

| Symptom | Cause | Fix keyword |
|------|------|-------------|
| Non-ASCII characters spaced out | Character width calculated using an old Unicode standard | Unicode 9+ widths option |
| Horizontal lines break into `- - -` dots | Font's box-drawing glyphs are weak | A CJK-supporting coding font |

Both can be fixed with **iTerm2 settings and a font swap.**

## Prerequisites

- macOS + iTerm2
- Homebrew (used to install fonts)

If you don't have Homebrew, install it first from [brew.sh](https://brew.sh).

## Step 1. Install a CJK-supporting coding font

The default font works to some degree, but if you want both box-drawing and non-ASCII text rendered cleanly, a dedicated font is the sure bet. I recommend two.

- **D2Coding** — a Korean coding font made by Naver. Great Korean readability, and solid box-drawing support too.
- **Sarasa Term K** — among the cleanest CJK width handling. English/Korean width ratio lands exactly at 1:2.

Install via Homebrew.

```bash
# D2Coding
brew install --cask font-d2coding

# Sarasa (includes Sarasa Term K)
brew install --cask font-sarasa-gothic
```

Feel free to install both and pick whichever you like. I settled on Sarasa Term K.

## Step 2. Change the font in iTerm2

Once installed, apply it in iTerm2.

1. Open `iTerm2 → Settings` (`⌘,`)
2. Go to the `Profiles → Text` tab
3. In the **Font** section, select the font you just installed
   - `D2Coding` or `Sarasa Term K`

This alone often fixes the dotted lines back into solid ones. But the non-ASCII spacing issue needs the next step to be fully resolved.

## Step 3. Turn on the Unicode 9+ widths option (the key fix)

This is the actual core fix. Further down the same `Profiles → Text` screen, adjust two options.

- ✅ **Use Unicode version 9+ widths** — turn on
- ✅ **Unicode normalization form** → `NFC` (or `None`)

`Use Unicode version 9+ widths` is exactly the switch that makes East Asian Width **calculated using the modern standard.** Turning this on aligns the width Claude Code assumes with the width iTerm2 actually renders, and the character-by-character spacing disappears.

Setting `Unicode normalization form` to NFC prevents a different kind of glitch caused by differences in how Korean characters are composed (decomposed jamo vs. precomposed form).

## Step 4. Verify in a new window

Setting changes apply only in a **new tab/window.** Quit any existing Claude Code session and launch it fresh in a new window.

```bash
# Open a new iTerm2 window (⌘N) and run it again
claude
```

Now horizontal lines should appear as a continuous solid `─`, and non-ASCII text should show normal spacing.

## Common sticking points (troubleshooting)

**Q. I installed the font, but it's not showing up in iTerm2's font list.**
Fully quit iTerm2 (`⌘Q`) and reopen it. The font cache refreshes and it'll show up in the list.

**Q. I turned on the Unicode 9 option, but text is still spaced out.**
Check whether you verified it in a **new window** after changing the setting — it doesn't apply to existing sessions. If it's still off, I'd recommend switching to Sarasa Term K. Sarasa's width ratio is a precise 1:2, making it the most stable option.

**Q. The dotted lines are gone, but emoji are still broken.**
Emoji width calculation is trickier still. Check the `Anti-aliased` setting and font fallback config under `Settings → Profiles → Text` in iTerm2, and if it's still distracting, switching to a font with better emoji width handling (like Sarasa) is the faster fix.

## Summary

When a terminal looks broken, the flow is this.

1. Identify the symptom — **non-ASCII spacing** (width issue) + **dotted horizontal lines** (font issue)
2. **Install a CJK coding font** — `brew install --cask font-d2coding` or `font-sarasa-gothic`
3. **Change the font** in iTerm2's `Profiles → Text`
4. Turn on **Use Unicode version 9+ widths** ← the key fix for non-ASCII spacing
5. Verify in a **new window**

The key takeaway: "it's not a Claude Code bug — it's a terminal rendering issue." Fix this once, and other TUI tools (vim, tmux, lazygit, etc.) get equally clean too, so it's well worth sorting out early in your dev environment setup.
