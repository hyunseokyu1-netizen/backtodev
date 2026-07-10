---
title: "Building a React Autocomplete Chip Input From Scratch — Catching the Click Before the Blur"
date: '2026-07-03'
publish_date: '2026-07-28'
description: Notes from building an autocomplete chip input without a library — the mousedown-vs-blur ordering trap and preventing uncommitted text from getting lost
tags:
  - React
  - TypeScript
  - UI Components
  - Tailwind CSS
---

> **MatchDa Build Log Series (2/3)**
> Part 1: The three-tier fallback for bot-blocked scraping · **Part 2: Building a React autocomplete chip input from scratch (this post)** · Part 3: Finding a screen that quietly went missing during the rebranding migration

## The limits of comma-separated skill input

In MatchDa, a user's profile skills directly affect matching quality. But the original input looked like this.

```
Skills: [ React, TypeScript, AWS____________ ]  ← a plain text input
```

And the problems pile up.

- `React` / `ReactJS` / `react.js` — inconsistent spelling tanks matching accuracy
- Typos (`Typescirpt`) get saved as-is
- No visual way to tell what's already been entered

What I wanted was a UI like an email-recipient field — **type and get autocomplete suggestions, select and it drops in as a chip.** I could've reached for a library (react-select, etc.), but the requirements were clear and the two places it's used — onboarding chat and the profile form — needed slightly different behavior, so I built it myself. **183 lines** gets the job done.

## Design: one component, two modes

It's used in two places.

| Location | What it needs |
|---|---|
| Onboarding chat | Chip input + a **send button** (sends the skill list as a chat reply) |
| Profile form | A plain controlled field (form submission happens elsewhere) |

The mode is decided by whether the `onSend` prop is present.

```tsx
export default function SkillChipInput({
  value,          // string[] — selected skills (controlled)
  onChange,       // (skills: string[]) => void
  onSend,         // if present, renders a send button (onboarding); if not, a plain field (profile)
  placeholder = 'e.g. React, TypeScript, AWS',
  disabled = false,
}: Props) {
```

There are only three pieces of internal state: the text being typed (`text`), the dropdown highlight index (`highlight`), and whether it's focused (`focused`).

## Step 1: Autocomplete matching — prefix matches first

It matches against a skill catalog (a constant array of ~200 entries), but **puts prefix matches ahead of substring matches.** Type `re` and `React` should appear before `Firebase`.

```tsx
const matches = useMemo(() => {
  const q = text.trim().toLowerCase()
  if (!q) return []
  const starts: string[] = []
  const includes: string[] = []
  for (const s of SKILL_SUGGESTIONS) {
    const l = s.toLowerCase()
    if (lowerSelected.has(l)) continue   // exclude already-selected
    if (l.startsWith(q)) starts.push(s)
    else if (l.includes(q)) includes.push(s)
  }
  return [...starts, ...includes].slice(0, 8)
}, [text, lowerSelected])
```

Already-selected skills get filtered out via a `Set`, cutting off duplicate chips at the source. Skills not in the catalog can still be freely entered with Enter or a comma — autocomplete is strictly an "assist," not a gate.

## Step 2: Keyboard interaction

How polished a component like this feels comes down to keyboard handling.

```tsx
function handleKeyDown(e: React.KeyboardEvent) {
  if (e.key === 'ArrowDown' && matches.length) {
    e.preventDefault()
    setHighlight(h => (h + 1) % matches.length)        // wraps around
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (matches.length && text.trim()) {
      addSkill(matches[highlight])                     // pick the autocomplete suggestion
    } else if (text.trim()) {
      addSkill(text)                                   // commit the free-typed text
    } else if (onSend && value.length) {
      onSend(value)                                    // empty input + Enter = send
    }
  } else if (e.key === ',') {
    e.preventDefault()
    if (text.trim()) addSkill(text)                    // comma also commits
  } else if (e.key === 'Backspace' && !text && value.length) {
    removeSkill(value[value.length - 1])               // backspace on empty input = delete the last chip
  }
}
```

The key idea is that Enter does one of three things depending on context — select if autocomplete is showing, commit if there's just text, send if there's neither. In practice this feels the most natural.

## Troubleshooting 1: Clicking the dropdown does nothing

In my first implementation, I put an `onClick` on the dropdown items, but clicking did nothing. The cause was event ordering.

```
Mouse click → ① mousedown → ② (blur fires on the input) → ③ mouseup → ④ click
```

The dropdown only renders while `focused` is true, but **at ② the blur fires, `focused` flips to false, and the dropdown unmounts before ④'s click ever arrives.** The click target is gone, so the click handler never fires.

The fix is to use `mousedown` instead of `click`, and block the blur itself with `preventDefault`.

```tsx
<button
  type="button"
  // use mousedown so selection happens before blur
  onMouseDown={e => { e.preventDefault(); addSkill(s) }}
  onMouseEnter={() => setHighlight(i)}
>
  {s}
</button>
```

`e.preventDefault()` stops the input from losing focus, so you can keep typing right after a selection. This is a problem you'll run into almost every time you build an autocomplete dropdown — worth remembering.

## Troubleshooting 2: Half-typed text evaporates

In onboarding chat, say you type `React, Type` (no Enter) and immediately hit the **send button.** What happens? Only the committed chip `React` gets sent, and `Type` disappears. From the user's perspective, they clearly typed something and it vanished.

I guarded against this in two places.

**On send**: build the final list by merging in whatever text is still sitting in the input.

```tsx
// build the final skill list including whatever's still in the input (prevents loss on send)
function commitAll(): string[] {
  const pending = text.split(',').map(s => s.trim())
    .filter(s => s && !lowerSelected.has(s.toLowerCase()))
  const all = [...value, ...pending]
  if (pending.length) onChange(all)
  setText('')
  return all
}

// send button
onClick={() => {
  const all = commitAll()
  if (all.length) onSend(all)
}}
```

The key detail is that `commitAll` **returns** the list. If you call `onChange` to lift state up and then read `value`, it's still the old value (setState is async). So I pass the return value straight to `onSend` instead.

**On blur**: in the profile form, moving to another field could leave text behind, so it commits on blur too.

```tsx
onBlur={() => {
  setFocused(false)
  if (text.trim()) addSkill(text)  // commit leftover text as a chip too
}}
```

## Common patterns, summarized

| Problem | Fix |
|---|---|
| Dropdown click gets eaten by blur | `onMouseDown` + `preventDefault()` |
| Uncommitted text lost on send/submit | Have the commit function **return** the final list and use that |
| Duplicate chips | Pre-filter with a lowercase `Set` |
| Autocomplete ordering | Prefix matches, then substring matches |
| Empty input + Backspace | Delete the last chip |

## Summary

- When the required behavior is well-defined, a chip input is well worth **building yourself in under 200 lines.** I saved a dependency, and the two screens' differing needs were absorbed by a single `onSend?`
- Bugs in components like this almost always come from **event ordering** (mousedown → blur → click) and **state timing** (stale values right after setState)
- Guaranteeing "never silently discard what the user typed" at both the blur and send points is what actually makes the quality feel right

Next up: the rebranding migration that ripped out the Tailwind zinc palette for brand tokens, and the story of the screen that quietly went missing along the way.
