---
title: '[Pixel Village Part 2] Drawing Pixel Art in Code, With Zero Image Files'
date: '2026-07-10'
publish_date: '2026-09-03'
description: How to define sprites as ASCII strings, draw them onto a canvas, and use them as Three.js textures — NearestFilter, a 3x5 pixel font, and Y-sorting
tags:
  - ThreeJS
  - Canvas
  - PixelArt
  - PixelVillage
  - SideProject
---

[Part 1](/ko/posts/pixel_village_01_threejs_setup_20260710) built the skeleton of a red square walking around. Now it's time to build something visible — houses, a library, a workshop, trees, a character, and even signs.

The problem is that I can't draw. I could buy assets or generate them with AI, but managing files is a hassle, and changing even one color later means opening an image editor. So I decided to **define every sprite entirely in code.** In the end, this approach turned out far more convenient.

---

## Step 1 — An ASCII string is a sprite

The idea is simple. One character = one pixel. Draw a picture as an array of strings, and map characters to colors via a palette.

```ts
export interface SpriteDef {
  rows: string[];
  palette: Record<string, string>;
}

/** my house — a small house with a red roof, 22x16px */
export const HOME_SPRITE: SpriteDef = {
  palette: {
    R: "#c0503f", r: "#93392e",  // roof / roof shadow
    W: "#ead9b0", w: "#d6c290",  // wall / wall bottom band
    D: "#8a5a33", d: "#5f3b1e",  // door
    G: "#8fd3e8", g: "#3f3f46",  // window / window frame
  },
  rows: [
    ".....RRRRRRRRRRRR.....",
    "....RRRRRRRRRRRRRR....",
    // ... (the roof widens)
    "WWgGGgWWWWWWWWWWgGGgWW",
    "WWWWWWWWWdDDdWWWWWWWWW",
    // ... (walls, windows, door)
  ],
};
```

`.` is a transparent pixel. Looking at the string in a code editor, you can literally see the dot-art picture. Changing a color just means editing the palette's hex value, and the git diff shows "fixed 3 roof pixels" directly.

Stamping this onto a canvas 1:1 turns it into a texture.

```ts
export function createSpriteTexture(def: SpriteDef) {
  const pxHeight = def.rows.length;
  const pxWidth = Math.max(...def.rows.map((r) => r.length));
  const canvas = document.createElement("canvas");
  canvas.width = pxWidth;
  canvas.height = pxHeight;
  const ctx = canvas.getContext("2d")!;
  def.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = def.palette[row[x]];
      if (!color) continue; // a character not in the palette = transparent
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  return new THREE.CanvasTexture(canvas);
}
```

Notice the canvas size is tiny, like 22x16. Scaling up is handled by the GPU.

## Step 2 — NearestFilter: pixel art's lifeline

Scale a 22px texture up to hundreds of px on screen, and by default it comes out **blurry.** This is because the default texture filter, LinearFilter, smoothly interpolates neighboring pixels. This one setting alone ruins pixel art entirely.

```ts
texture.magFilter = THREE.NearestFilter; // nearest pixel with no interpolation when magnifying
texture.minFilter = THREE.NearestFilter; // same when minifying
texture.colorSpace = THREE.SRGBColorSpace; // makes the palette's hex colors come out as-is
```

These two lines produce razor-sharp, blocky dots. I consolidated every texture-creation function into one place and applied this uniformly there.

Sprite meshes are built as a cutout, discarding transparent pixels.

```ts
new THREE.MeshBasicMaterial({
  map: texture,
  transparent: true,
  alphaTest: 0.5,           // pixels with alpha below 0.5 are never drawn at all
  side: THREE.DoubleSide,   // prevents disappearing when flipped horizontally via scale.x = -1
});
```

`alphaTest` is directly tied to the Y-sorting covered later. Since it discards pixels entirely instead of using translucent blending, the depth buffer works correctly. `DoubleSide` prevents a bug where flipping a character horizontally (`scale.x = -1`) makes the entire sprite vanish due to backface culling. I actually got bitten by this.

## Step 3 — The floor: laying grass with a seeded random number generator

A 40x30-unit map floor is too big to build as a sprite. I drew it procedurally onto one large canvas (640x480, 16px per unit). Order: grass base → noise dots → grass tufts → flowers → dirt path → the plaza.

There's one trap here. Stamping noise with `Math.random()` means **the grass pattern changes every time the page refreshes.** It's a subtly unsettling feeling, like the world shifting underneath you. I fixed it with a seeded random number generator (mulberry32).

```ts
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260710); // seed = today's date. Same grass every time you look
```

The plaza's ellipse was drawn by checking the ellipse equation pixel-by-pixel, instead of using `ctx.ellipse()`. Canvas's shape APIs apply anti-aliasing, which breaks the pixel-art rules.

Finally, I carved the village name into the grass below the plaza, in a darker green than the base to give it a mowed-lawn feel.

## Step 4 — Making signs with a 3x5 pixel font

I wanted an English sign on each building (MY HOME, LIBRARY, WORKSHOP). Using a font file brings back the blur problem, so **I defined the font's glyphs directly, too.**

```ts
const PIXEL_FONT: Record<string, string[]> = {
  H: ["101", "101", "111", "101", "101"],
  O: ["111", "101", "101", "101", "111"],
  M: ["10001", "11011", "10101", "10001", "10001"], // M, W get a variable 5px width
  "'": ["1", "1", "0", "0", "0"],
  // ...
};
```

Fixed at 5px tall, variable width per character (1-5px). I initially made everything 3px wide, but M and W came out completely unreadable, so I widened them. Stamping the glyphs in order onto a canvas with 1px letter-spacing produces text, and adding a wood-plank background turns it into a sign. The village name carved into the grass also uses the same font, just scaled up.

Since only the characters actually needed have to be defined, there's no real burden. The font currently has about 14 letters out of A-Z defined.

## Step 5 — Y-sorting: getting hidden when walking behind a building

The core effect of a top-down RPG. **When the character is north (above) a building, they should be hidden behind the roof; when south (below), they should draw in front of the building.** The rule is "the lower something is on screen, the later (on top) it gets drawn."

There's a way to sort and draw sprites every frame, but Three.js has an easier path — **assigning a rule to the z-coordinate and letting the depth buffer handle it.**

```ts
/** the further south the foot's y-coordinate, the closer to the camera (larger z) */
export function zForFoot(footY: number): number {
  return 1 + (MAP_HEIGHT / 2 - footY) * 0.03;
}

// buildings, trees: set once, when placed
mesh.position.set(x, y, zForFoot(footY));

// the player: moves, so updated every frame
player.position.z = zForFoot(player.position.y - PLAYER_H / 2);
```

The key point is using **the feet,** not the sprite's center, as the reference. This matches the intuition that "whoever's feet are further south is in front" when a tall building and a character overlap. Thanks to Step 2's `alphaTest` cutout, transparent pixels never contaminate depth, so this formula alone finishes the job — no sorting code required.

This also ties back to Part 1, where the collision box only covered the feet. Since the building sprite's upper half (the roof) has no collision, the character naturally gets hidden the moment they "walk into" the roof's area.

---

## Summary

| Item | Approach | Key point |
|------|------|------|
| Sprites | ASCII matrix + palette | Zero image files, dot-art managed via git |
| Sharpness | NearestFilter + SRGBColorSpace | No blur even when scaled up |
| Transparency | alphaTest 0.5 cutout | Depth buffer works correctly |
| Floor | One large canvas + a seeded RNG | Same grass on every refresh |
| Text | A homemade 3x5 variable-width pixel font | Signs, the village name in the grass |
| Front/back sorting | Foot-y → z conversion (Y-sorting) | Gets hidden walking behind a building |

Now the village actually looks like a village. But you still can't enter any building. Next up, opening the doors — scene transitions, a fade effect, and stocking the library's bookshelf with real blog posts.
