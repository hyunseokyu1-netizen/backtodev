---
title: 'Turning a Design Demo Into the Real App (3) — Unifying the App Shell and Bulk-Mapping the Color Tone'
date: '2026-07-02'
publish_date: '2026-07-27'
description: Wrapping the remaining pages in a shared app shell to unify the chrome, then bulk-replacing zinc colors with brand tones in one perl pass — including the trap I hit along the way
tags:
  - Next.js
  - Tailwind CSS
  - perl
  - Refactoring
---

In [Part 2](#), I swapped the logged-in home into the MatchDa dashboard. But click "Discover" or "Profile" in the sidebar, and — **the old zinc header with the old tone suddenly pops back up.** A green sidebar on the dashboard, a gray top bar right next door — it doesn't feel like the same app.

This final part is about **unifying that chrome and tone.**

## Step 1. Wrap everything in a shared AppShell

For `/discover` and `/profile` to have the same **left sidebar** as the dashboard, I needed a reusable shell. I built `AppShell`.

```tsx
// Unifies only the sidebar + content area (each page's own content stays untouched)
export default function AppShell({ activeKey, userName, userEmail, children }) {
  const t = getMatchdaDict('ko')
  return (
    <div className="flex min-h-screen bg-[#F7F8FA] font-[family-name:var(--font-plex-kr)]">
      <Sidebar t={t} userName={userName} userEmail={userEmail} activeKey={activeKey} />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1040px] px-4 py-8 sm:px-6 lg:px-9">{children}</div>
      </main>
    </div>
  )
}
```

Each page just wraps its content with this.

```tsx
// app/discover/page.tsx
return (
  <AppShell activeKey="discover" userName={profile.name} userEmail={email}>
    {/* existing content, unchanged */}
  </AppShell>
)
```

### An activeKey for the sidebar

With multiple pages sharing one sidebar, I needed a way to **highlight the current page.** I pulled the previously hardcoded active-state marker out into an `activeKey` prop.

```tsx
className={key === activeKey
  ? 'bg-[#ECFDF3] font-semibold text-[#046C4E]'   // active
  : 'font-medium text-[#475467] hover:bg-[#F4F6F8]'}
```

### Hiding the old chrome on these paths

Just add the paths to Part 2's `AppChrome`. Now the old global header only remains on pages outside auth, like `/login`.

```tsx
const usesMatchdaShell =
  pathname === '/' ||
  pathname?.startsWith('/matchda') ||
  pathname?.startsWith('/discover') ||
  pathname?.startsWith('/profile')
```

> I deliberately kept the scope clear here — **only unify the shell (chrome)**, and leave the internal forms/list content as-is. The color tone comes in the next step.

## Step 2. zinc → brand tone, in one perl pass

The internal content was drenched in `zinc-*` colors. Fixing them one by one by hand across 5 files and 880 lines is a recipe for typos. First I pulled **every zinc class in use.**

```bash
grep -ohE "(hover:|focus:)?(bg|text|border|ring)-zinc-[0-9]+(/[0-9]+)?" \
  src/components/discover/*.tsx src/app/profile/*.tsx | sort | uniq -c | sort -rn
#  14 text-zinc-400
#   9 border-zinc-200
#   8 bg-zinc-900   ← primary button
#   ...
```

I turned this list into a **semantic mapping table.** Two key ideas — neutral grays map to MatchDa neutrals, and **the primary button (zinc-900) maps to brand green.**

| zinc | MatchDa | meaning |
|---|---|---|
| `bg-zinc-900` | `bg-[#046C4E]` | primary button → green |
| `hover:bg-zinc-700` | `hover:bg-[#035A40]` | button hover |
| `border-zinc-200` | `border-[#ECEEF0]` | card/input border |
| `text-zinc-400` | `text-[#98A2B3]` | secondary text |
| `focus:border-zinc-400` | `focus:border-[#046C4E]` | input focus → green |

Then I bulk-replaced with `perl`. **Order matters here** — `border-zinc-900/70` (the opacity variant) has to be replaced **before** the base class `border-zinc-900`, to avoid a half-replaced mess.

```bash
perl -pi -e '
  s/\bborder-zinc-900\/70\b/border-[#046C4E]\/70/g;   # opacity variant first
  s/\bhover:bg-zinc-700\b/hover:bg-[#035A40]/g;
  s/\bbg-zinc-900\b/bg-[#046C4E]/g;                    # then the base
  s/\bborder-zinc-200\b/border-[#ECEEF0]/g;
  s/\btext-zinc-400\b/text-[#98A2B3]/g;
  # ...
' src/components/discover/*.tsx src/app/profile/ProfileForm.tsx ...
```

After the replacement, I immediately checked that **zero zinc classes remained** and that nothing got mangled.

```bash
grep -ohE "(bg|text|border)-zinc-[0-9]+" the-files | sort | uniq -c   # (no output = success)
```

### Leaving status colors untouched

Colors that carry **meaning** — match scores, error messages (green/red/blue/amber) — I deliberately left alone. Turning grays into brand colors is "tone unification," but if you also change status colors, **you lose information.** I explicitly excluded these from the mapping table.

## Troubleshooting — zsh won't split words

Passing a file list through a variable threw this error.

```bash
FILES="a.tsx b.tsx c.tsx"
perl -pi -e '...' $FILES
# Can't open 'a.tsx b.tsx c.tsx': No such file or directory
```

The whole set got treated as **one single filename.** The cause is a shell difference — **unlike bash, zsh doesn't word-split unquoted variables by default.** The fix is simple.

- Force splitting with `${=FILES}`, or
- Just **list the files directly**

I listed the files directly (the safest option). This is a landmine you commonly step on when running a bash-habit script under zsh.

## Summary

The key points of chrome/tone unification.

1. **A shared AppShell** unifies the sidebar across multiple pages (content stays as-is)
2. **activeKey** highlights the current page
3. **grep first to survey reality** → semantic mapping table → **bulk perl replacement**
4. Replace **opacity variants before the base class** (an ordering trap)
5. **Exclude status colors** — tone unification and information preservation are different things
6. In zsh, **variables don't word-split** — use `${=VAR}` or list files directly

## Wrapping up the series

It all started from one comment — "isn't the design just dropped into /matchda?" — and ended with merging two apps that had split into separate lives into one. Looking back, the secret to a lossless migration wasn't fancy technique but **boring diligence** — writing down every feature of what's being removed in a table, reusing as much as possible of what already exists, containing regressions within phases, and managing even individual colors through a mapping table. Building a pretty demo turned out to be easier than **actually getting that demo in front of users.**
