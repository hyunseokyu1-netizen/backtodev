---
title: '[Pixel Village Part 4] A Guestbook That Grows Into Trees — a GitHub JSON Store and 288 Faces'
date: '2026-07-10'
publish_date: '2026-09-05'
description: A guestbook easter egg where writing on a stone tablet plants a tree with a face somewhere in the grass. Storing it via GitHub commits with no DB, blocking spam, and giving each tree a random face
tags:
  - NextJS
  - GitHub
  - API
  - PixelVillage
  - SideProject
---

By [Part 3](/ko/posts/pixel_village_03_scenes_data_20260710), every planned feature of Pixel Village was done. But walking around the village, something felt missing. Visitors just look around and leave. No trace gets left behind.

So I planted an easter egg. There's a stone tablet in the bottom-right corner of the village, and walking up to it shows `[SPACE] Plant a tree`. Type a nickname and a message, hit plant, and **a tree grows somewhere in the grass.** Walk up to that tree, and the message shows. The guestbook accumulates not as a list, but as a forest.

After planting, it shows this guidance: *"Now go find your own tree 🌱"*

---

## Step 1 — Choosing storage: GitHub commits, no DB

Since this is a guestbook, every visitor needs to see everyone else's trees. Server-side storage is required. I compared the options.

| Approach | Pros | Cons |
|------|------|------|
| localStorage | 5-minute implementation | Only shows your own tree — not a guestbook at all |
| A DB like Supabase | Real-time, the standard approach | Adds new infrastructure to this blog |
| **A JSON file in the GitHub repo** | Zero added infrastructure, automatic history | 1 commit + redeploy per entry |

I chose **GitHub JSON.** This blog already reads and writes posts via the GitHub API, so I could just reuse the existing `putFile()` wrapper as-is. Everything piles up as an array in a single `content/guestbook.json` file.

```ts
// lib/guestbook.ts
const FILE = "content/guestbook.json";
const IS_PROD = !!process.env.VERCEL;

export async function readGuestbook() {
  if (IS_PROD) {
    const file = await getFile(FILE); // GitHub Contents API
    return { entries: JSON.parse(file?.content ?? "[]"), sha: file?.sha };
  }
  // just fs for local dev
  return { entries: JSON.parse(fs.readFileSync(FILE, "utf-8")) };
}

export async function saveGuestbook(entries, sha, visitorName) {
  const json = JSON.stringify(entries, null, 2) + "\n";
  if (IS_PROD) {
    await putFile(FILE, json, `guestbook: ${visitorName} planted a tree 🌳`, sha);
  } else {
    fs.writeFileSync(FILE, json);
  }
}
```

There's a fun side effect. **One tree equals one git commit.** Commits like `guestbook: Raon planted a tree 🌳` pile up in the repo's history. The guestbook is, quite literally, the commit log.

There's a trade-off, of course. Every single entry triggers a Vercel redeploy. This is a complete non-issue at the frequency of a personal blog's guestbook, but this approach should never be used for a service with real traffic.

## Step 2 — Finding a spot to plant: rejection sampling

The tree's position is decided by the server. It should land anywhere in the grass, but must avoid buildings, paths, the plaza, the village name carved into the grass, and existing trees. Instead of a complex algorithm, I used **rejection sampling** — pick a random spot, and if it's a forbidden zone, pick again.

```ts
const NO_PLANT_ZONES: AABB[] = [
  { minX: -15.5, maxX: -8.5, minY: 0.4, maxY: 6.6 },  // my house + front of the door
  { minX: -13.6, maxX: 13.6, minY: -3.4, maxY: -0.6 }, // the central path
  { minX: -8.0, maxX: 8.0, minY: -8.0, maxY: -6.2 },   // the village-name text
  // ...
];

export function findPlantingSpot(taken: { x: number; y: number }[]) {
  for (let i = 0; i < 300; i++) {
    const x = -18 + Math.random() * 36;
    const y = -13 + Math.random() * 25.5;
    if (NO_PLANT_ZONES.some((b) => x > b.minX && x < b.maxX && y > b.minY && y < b.maxY)) continue;
    if (taken.some((t) => Math.hypot(t.x - x, t.y - y) < 1.8)) continue; // distance from existing trees
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  }
  return null; // failing 300 times = the forest is full
}
```

Failing after 300 attempts returns "the forest is full." Not elegant, but plenty for a single map holding hundreds of trees.

## Step 3 — A minimal defense for a public API

An unauthenticated public write API is easy pickings for spam. I added a triple defense at a personal-blog scale.

```ts
// ① a honeypot — a field invisible to human eyes. Reject instantly if a bot fills it in
if (body.website) return NextResponse.json({ error: "..." }, { status: 400 });

// ② length limits + stripping control characters
const name = sanitize(body.name, 20);      // nickname, 20 chars
const message = sanitize(body.message, 200); // message, 200 chars

// ③ 1 per minute, per IP
const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
if (lastPostByIp.get(ip) > Date.now() - 60_000) {
  return NextResponse.json({ error: "You can only plant one tree per minute." }, { status: 429 });
}
```

The throttle is `Map`-based, so it has the limitation of resetting whenever the serverless instance changes. A truly robust rate limit would need an external store like Upstash, but I judged this was enough for the purpose of "prevent accidental double-clicks + block simple bots." I also put a total cap (500 trees) in place, so the storage never grows unbounded even in the worst case.

Even the error messages fit the game's world — a 429 says "you can only plant one tree per minute," and exceeding the cap says "the forest is full. Please wait for next season 🌲."

## Step 4 — A different face on every tree: 6x6x8 = 288 combinations

The first trees planted all looked identical, which felt dull. So I added **facial expressions to the trees.** Eyes come in 6 varieties (`. > < - ^ _`), mouths in 8 (`- ㅠ ㅜ = + . ⏝ ⏜`). The left and right eyes are drawn **independently,** so mismatched eyes (`>` `<`) can show up too. Combinations: 6x6x8 = 288.

The key decision: **the expression is drawn by the server, not the client, and locked in the moment it's planted.**

```ts
const entry: GuestbookEntry = {
  id: `gb_${Date.now()}_...`,
  name, message, date,
  x: spot.x, y: spot.y,
  eyeL: GB_EYES[Math.floor(Math.random() * GB_EYES.length)],
  eyeR: GB_EYES[Math.floor(Math.random() * GB_EYES.length)],
  mouth: GB_MOUTHS[Math.floor(Math.random() * GB_MOUTHS.length)],
};
```

Rolling the random draw at render time would change the expression on every refresh. For any attachment to "my tree" to form, the expression needs to stay fixed. Just like its position, a tree's expression is a permanent property of that tree.

Drawing it follows the exact same ASCII sprite approach from Part 2. The eye/mouth glyphs get composited as pixels onto a tree trunk with a hollow center in its leaves.

```ts
const EYE_GLYPHS: Record<string, string[]> = {
  ".": ["11", "11"],
  ">": ["100", "010", "100"],
  "^": ["010", "101"],
  // ...
};

// stamping the face onto the tree's canvas
drawGlyph(ctx, EYE_GLYPHS[eyeL], 4, 5, FACE_COLOR);   // left eye
drawGlyph(ctx, EYE_GLYPHS[eyeR], 11, 5, FACE_COLOR);  // right eye
drawGlyph(ctx, MOUTH_GLYPHS[mouth], 7, 8, FACE_COLOR); // mouth
```

Get `^` `^` + `⏝` and you get a beaming, happy tree; get `>` `<` + `⏜` and you get a tree that looks vaguely wronged. Seeing a row of trees in the grass, each with its own different expression, makes even me — the one who built it — smile.

## Step 5 — Visible the instant it's planted

On a successful form submission, the server returns the finalized entry (including position and expression). Rather than refreshing the page, **the tree gets added to the current scene right away.**

```ts
const res = await fetch("/api/guestbook", { method: "POST", body: ... });
const { entry } = await res.json();
plantRef.current?.(entry); // adds a mesh + collision box + interaction zone to the village scene
```

Then it shows the "Now go find your own tree 🌱" modal. It never tells you where it landed. Wandering around to find it yourself is the whole point of this easter egg.

Not long after deploying, an unfamiliar commit showed up in the repo. `guestbook: Raon planted a tree 🌳`. The first visitor's tree had genuinely been planted. That commit notification popping up was the single most delightful moment in this entire project.

---

## Summary

| Item | Choice | Reason |
|------|------|------|
| Storage | A JSON file in the GitHub repo | Zero added infrastructure, reuses the existing wrapper, commits = the guestbook log |
| Deciding position | Server-side rejection sampling | Avoids forbidden zones, keeps minimum distance between trees |
| Spam defense | Honeypot + length limits + IP throttle + a total cap | A minimal defense for a public write API |
| Expression | Rolled and saved by the server at plant time | Fixed even on refresh, 288 combinations from independent left/right eyes |
| UX | Location kept private + "go find your tree" | The exploration itself is the reward |

That wraps up the Pixel Village series. In a single day, this went from Three.js's first setup all the way to a forest of guestbook trees. The finished village lives at [backtodev.com/ko/village](https://backtodev.com/ko/village). Come by and plant a tree — the expression's the luck of the draw.
