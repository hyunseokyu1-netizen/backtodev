---
title: '[Pixel Village Part 3] Opening the Library Door — Scene Transitions and Blog Data Integration'
date: '2026-07-10'
publish_date: '2026-09-04'
description: Fade transitions for entering buildings, preventing an infinite back-and-forth loop, and stocking the library bookshelf with real blog posts based on tags
tags:
  - ThreeJS
  - NextJS
  - React
  - PixelVillage
  - SideProject
---

By [Part 2](/ko/posts/pixel_village_02_pixelart_code_20260710), the village was done. But the buildings are still just pictures. This part's goals:

- Walking to the library door triggers **a fade-out → an interior scene → a fade-in**
- Standing at the interior bookshelf and pressing SPACE brings up **the real blog post list** in a retro modal
- My house (profile) and the workshop (portfolio) get the same structure

This is the moment the game connects to the blog.

---

## Step 1 — Turning scenes into data: the GameWorld structure

With just one scene, I got by roughly with global variables, but with 4 — village, library, house, workshop — a structure was needed. I defined "one place" like this.

```ts
interface GameWorld {
  scene: THREE.Scene;        // things to draw
  colliders: AABB[];         // places you can't pass through
  triggers: Trigger[];       // zones that move you to another scene when stepped on (doors, exit mats)
  zones: InteractZone[];     // SPACE-interaction zones (bookshelves, desks, workbenches)
  mapW: number;
  mapH: number;
}

interface Trigger {
  box: AABB;
  target: WorldId;                  // "village" | "library" | "home" | "lab"
  spawn: { x: number; y: number };  // the spawn position in the destination scene
}
```

Factory functions like `buildVillage()` and `buildLibrary()` each build their own GameWorld, and the game loop only ever looks at a single `active` one. Movement, collision, and trigger-check code work identically regardless of which scene it is.

One player mesh is shared across every scene. Since Three.js automatically removes an object from its previous scene when it's `add`ed to a different one, a scene transition is just one line: `newScene.add(player)`.

## Step 2 — Fade transitions: CSS instead of WebGL

A scene-transition fade could be done with a shader or Three.js post-processing, but there's a much easier way. **Lay a black div over the canvas and only toggle its opacity via a CSS transition.**

```tsx
<div
  ref={fadeRef}
  style={{
    position: "absolute",
    inset: 0,
    background: "#000",
    opacity: 0,
    transition: "opacity 380ms ease",
    pointerEvents: "none",
  }}
/>
```

The transition sequence is assembled from two setTimeouts. Fade out (380ms) → swap the scene + move to spawn → fade in.

```ts
function goToWorld(target: WorldId, spawn: { x: number; y: number }) {
  if (transitioning) return; // prevent re-entry mid-transition
  transitioning = true;
  fade.style.opacity = "1";
  setTimeout(() => {
    active = worlds[target];
    active.scene.add(player);
    player.position.set(spawn.x, spawn.y, zForFoot(spawn.y - PLAYER_H / 2));
    camera.position.set(spawn.x, spawn.y, camera.position.z); // snap the camera too
    fade.style.opacity = "0";
    setTimeout(() => { transitioning = false; }, FADE_MS);
  }, FADE_MS);
}
```

While the `transitioning` flag is set, the game loop skips input processing entirely — preventing the accident of the character moving while the screen is black.

### The trap: an infinite back-and-forth loop

In my first implementation, the moment you walked out of the library, **you'd get sucked right back into the library.** The cause was the spawn position. If the spawn coordinate for exiting into the village sits inside the library door's trigger box, the trigger fires again the instant you arrive.

The fix is simple. **Place the exit spawn position a few units south of the entrance trigger.** It's also more natural to start a step outside the door. This is a checklist item that absolutely has to be verified whenever building a scene transition.

## Step 3 — Putting blog posts into the game

This blog's post data is already abstracted behind a `getAllPosts()` function (fs locally, GitHub GraphQL in production). There's no need to build a separate API for the game — **reading it in a server component and passing it down as props is enough.**

```tsx
// page.tsx (server component)
export default async function VillagePage({ params }) {
  const { locale } = await params;
  const posts = (await getAllPosts(locale)).map((p) => ({
    slug: p.slug,
    title: p.title,
    date: p.date,
    tags: p.tags ?? [],
  }));
  return <VillageGame locale={locale} posts={posts} />;
}
```

The key point is stripping out the body and only extracting the metadata. Title, date, and tags for 100 posts' worth is only a few KB.

## Step 4 — Bookshelves as categories: the fight against inconsistent tag notation

I placed 4 bookshelves in the library, each assigned a category: **RECENT / WEB / APP / AI.** Classifying posts by tag ran into a very real problem — the tag notation across 2 years of posts was all over the place.

- `Next.js` vs `NextJS`
- `Claude Code` vs `ClaudeCode`
- `next-intl` vs `nextintl`

All the same topic, but different strings. Instead of bulk-cleaning the tags, I chose to **normalize at comparison time.** This meant not needing to touch any existing posts.

```ts
/** "Next.js" / "NextJS" → "nextjs", "Claude Code" → "claudecode" */
export function normalizeTag(tag: string): string {
  return tag.toLowerCase().replace(/[\s.\-_]/g, "");
}

const shelf = {
  id: "web",
  sign: "WEB",
  tags: ["nextjs", "react", "vercel", "seo", "i18n", "supabase", ...],
};

// classification: if a post's normalized tags overlap with the shelf's tag list even once, shelve it there
const normalized = post.tags.map(normalizeTag);
if (normalized.some((t) => shelf.tags.includes(t))) result[shelf.id].push(post);
```

A single post can end up on multiple shelves — not how a real library works, but actually better for discoverability.

## Step 5 — Interaction zones and the retro modal

I laid an invisible zone in front of the bookshelves, and when it overlaps the player's foot box, a `[SPACE] Read the Web Development Shelf` prompt appears at the bottom of the screen. The game loop only handles zone detection — the prompt/modal UI is handed off to React state. **Three.js handles only the world, React handles the UI** — this separation kept the code clean.

The modal is an HTML overlay. The retro feel comes from a few lines of CSS.

```css
border: 3px solid #e8e4d8;
box-shadow: 0 0 0 3px #10140d, 8px 8px 0 rgba(0, 0, 0, 0.6);
font-family: var(--font-mono), monospace;
```

Stacking `box-shadow` produces a double pixel border, and laying down a blur-free hard shadow gives it that 90s game dialogue-box feel. Clicking a post in the list opens the real post page in a new tab via `target="_blank"` — so the game state never gets lost.

### The trap: the modal and the game fighting over the keyboard

Even with the modal open, the window's key listeners stay alive. Left as-is, this causes two accidents.

1. WASD still moves the character around while the modal is open
2. Opening the modal with SPACE while a movement key is held down means the modal eats the keyup, so **the character keeps walking on its own after closing it**

The fix: while the modal is open, skip movement entirely in the game loop, and clear the set of pressed keys the moment the modal opens.

```ts
if (currentZone && !transitioning) {
  openModal(currentZone);
  pressed.clear(); // ← this one line stops the ghost-movement bug
}
```

My house (desk → profile) and the workshop (workbench → project list) are just further instances of this exact same zone + modal structure. Once the structure was set up, adding one more room became 30 minutes of work.

---

## Summary

| Item | Approach | Key point |
|------|------|------|
| Scene management | The GameWorld interface + factories | The loop's code is independent of scene count |
| Fade | An HTML div + CSS transition | No shader needed, a 380ms x 2 sequence |
| Preventing a back-and-forth loop | Placing the exit spawn outside the entrance trigger | A mandatory checklist item for scene transitions |
| Data integration | Server component → props | No separate API, reuses the existing pipeline |
| Tag classification | Normalize at comparison time | Zero edits to existing posts |
| UI | Three.js handles the world, React handles the modal | Key-input conflicts solved via pressed.clear() |

This was the end of the planned feature set. But once it was built, the village felt a bit quiet. What if a visitor could leave a trace? Next up is an easter egg that wasn't in the original plan — **a guestbook where a tree grows in the grass whenever someone writes a message.**
