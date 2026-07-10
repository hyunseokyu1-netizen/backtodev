---
title: 'Renaming a Core App Concept — From Folder to Chain, Front to Back'
date: '2026-05-27'
publish_date: '2026-06-14'
description: What it took to rename the Folder concept to Chain across the ChainPlay app, and how a type-driven TypeScript refactor made it manageable
tags:
  - React Native
  - TypeScript
  - Refactoring
  - ChainPlay
---

# Renaming a Core App Concept — From Folder to Chain, Front to Back

> ChainPlay v3.0 work log. The word "folder" kept bugging me.

---

## Why I renamed it

When I first built the playlist grouping feature, I picked the most intuitive word available: "Folder." It's not wrong — it's a container that holds a bunch of videos.

But the longer I used it, the more it felt off. ChainPlay's core UX is "play videos back-to-back in order," and a folder just feels like a bucket you toss things into. A chain is different. It evokes linked rings — one video connecting into the next, in a flow. That's a chain.

The app itself is called **ChainPlay**, but the internal concept was "folder" — no consistency there. So today I replaced folder with chain, top to bottom.

---

## What the work actually involved

A rename like this touches more than you'd expect. It's not just a few UI strings — type definitions, hooks, components, filenames, and i18n text all need attention.

Here's the list of files that changed:

| Before | After |
|---|---|
| `src/hooks/useFolders.ts` | `src/hooks/useChains.ts` |
| `src/components/FolderNameModal.tsx` | `src/components/ChainNameModal.tsx` |
| `src/components/MoveToFolderModal.tsx` | `src/components/MoveToChainModal.tsx` |
| `src/screens/FolderListScreen.tsx` | `src/screens/ChainListScreen.tsx` |
| `interface Folder` | `interface Chain` |

12 files total, +424 / -352 lines.

---

## The renaming workflow

### Step 1: Change the types first

The first thing to touch is `src/types/index.ts`. Once the interface name changes here, the TypeScript compiler will point out every other place that's now broken.

```ts
// Before
export interface Folder {
  id: string;
  name: string;
  items: PlaylistItem[];
  createdAt: number;
}

// After
export interface Chain {
  id: string;
  name: string;
  items: PlaylistItem[];
  createdAt: number;
}
```

Renaming one type turns the whole project red. Don't panic — this is actually a good sign. The compiler is showing you exactly what needs fixing.

### Step 2: Rebuild the hook file

`useFolders.ts` became `useChains.ts`. The internal logic is identical, only the name changed.

```ts
// useChains.ts — core structure
export function useChains() {
  const [chains, setChains] = useState<Chain[]>([]);

  // create a chain
  const createChain = useCallback((name: string) => { ... }, [save]);

  // move a video between chains
  const moveItemBetweenChains = useCallback(
    (itemId: string, fromChainId: string, toChainId: string) => { ... },
    [save]
  );

  return {
    chains,
    createChain,
    renameChain,
    deleteChain,
    addUrlToChain,
    removeItemFromChain,
    moveItemInChain,
    moveItemBetweenChains,
  };
}
```

I chose to create a new file and delete the old one. Git tracks this as a rename (`similarity index 100%`).

### Step 3: Swap the i18n strings

Since the app supports Korean/English, every UI string needs both versions updated.

```ts
// Before
folderListTitle: isKorean ? '폴더' : 'Folders',
newFolder: isKorean ? '+ 새 폴더' : '+ New Folder',
noFolders: isKorean ? '폴더가 없습니다' : 'No folders yet',

// After
chainListTitle: isKorean ? '체인' : 'Chains',
newChain: isKorean ? '+ 새 체인' : '+ New Chain',
noChains: isKorean ? '체인이 없습니다' : 'No chains yet',
```

### Step 4: Components and screens, in order

Once i18n is done, the rest is mechanical. Sweep through components and screen files replacing `folder` → `chain`, `Folder` → `Chain`. I also made sure to catch every StyleSheet key name (`folderRow` → `chainRow`, etc.).

---

## What I also added today — a first-visit intro banner

I didn't just rename things — I added a new UX element too: a first-visit banner for users who have no idea what a "chain" is.

The first time the app launches, a one-line description shows above the chain list.

```
Chain — a list of videos linked together to play back-to-back  [✕]
```

Tapping ✕ stores a flag in `AsyncStorage` so it never shows again.

```tsx
// ChainListScreen.tsx — banner visibility logic
const INTRO_SEEN_KEY = '@chain_intro_seen';

useEffect(() => {
  AsyncStorage.getItem(INTRO_SEEN_KEY).then((val) => {
    if (!val) setShowIntro(true);
  });
}, []);

const dismissIntro = () => {
  setShowIntro(false);
  AsyncStorage.setItem(INTRO_SEEN_KEY, '1');
};
```

Simple, but practical. No need to pull in an onboarding library — AsyncStorage alone is enough.

The banner UI didn't need its own component either — just inline StyleSheet.

```tsx
{showIntro && (
  <View style={styles.introBanner}>
    <Text style={styles.introText}>{t.chainIntroDesc}</Text>
    <TouchableOpacity onPress={dismissIntro} hitSlop={8}>
      <Text style={styles.introClose}>✕</Text>
    </TouchableOpacity>
  </View>
)}
```

---

## Things easy to miss during a rename like this

Doing a full rename like this reveals a surprising number of easy-to-miss spots. Worth keeping a checklist for next time.

- **StyleSheet keys**: it's easy to update the logic code but forget the key names inside `StyleSheet.create({})`. TypeScript won't catch these, so you have to check manually.
- **i18n function-style keys**: things like `folderVideoCount: (n: number) => ...` are functions, not plain strings — they need swapping too.
- **AsyncStorage key constants**: `CHAINS_KEY = '@yt_folders'` — I deliberately left the storage key itself unchanged this time, since changing it would require migrating data already stored on users' devices. Renaming the concept while keeping the storage key for backward compatibility is a valid strategy.
- **Comments**: don't forget to update terminology inside code comments either.

---

## Summary

If I had to sum up today's work in one line: **cleaning up your concept names makes the code easier to read.**

The vagueness that "Folder" carried — "just a container you throw things into" — became clearer once it turned into "Chain." What the app is actually doing is now obvious: videos linked together like a chain, playing in sequence.

The rename itself is simple work, but following the layer order — type → hook → component → screen → i18n — means nothing gets missed. If you're using TypeScript, changing the type first is the fastest path: the compiler finds the rest for you.

---

**What I shipped today**
- Full `Folder` → `Chain` rename (types, hooks, components, screens, i18n, filenames)
- Added a first-visit intro banner (permanently dismissible via AsyncStorage)
- Updated the ChainPlay v3.0 CHANGELOG
