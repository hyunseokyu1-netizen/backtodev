---
title: "Building a Proper Next.js App Router Favicon: From an SVG Monogram to Shrinking a 285KB .ico Down to 2KB"
date: '2026-06-25'
publish_date: '2026-07-16'
description: The App Router icon conventions, sharp rendering, the png-to-ico size trap, and hand-rolling ICO encoding I ran into while replacing the default Next.js favicon with a brand monogram
tags:
  - Next.js
  - Favicon
  - sharp
  - SVG
  - Branding
---

After renaming the service to `MatchDa`, it bugged me that the browser tab still showed the **default Next.js favicon** (the black N-shaped circle). Sounds trivial, but with multiple tabs open, not being able to recognize my own service is a real loss. So I decided to make an "MD" monogram favicon (the initials of Match + Da).

I figured "how hard can making one favicon be," but doing it properly turned out to require knowing quite a bit. **Next.js App Router's icon conventions**, **how to bake an SVG into a PNG**, and even **shrinking a 285KB favicon a common tool (png-to-ico) produced down to 2KB.** This post is a record of that process.

## Step 1. First, learn Next.js App Router's icon conventions

In the old days, you'd drop a `<link rel="icon">` directly into `<head>`. But Next.js App Router (13+) **automatically recognizes files just by placing them in specific locations.** Drop these files in the `app/` folder, and you're done.

| File | Role | Note |
|------|------|------|
| `app/icon.svg` | favicon for modern browsers | vector, sharp at every size |
| `app/favicon.ico` | legacy fallback | served as `/favicon.ico` |
| `app/apple-icon.png` | iOS home screen icon | typically 180×180 |

Next.js automatically inserts tags like `<link rel="icon" type="image/svg+xml">` and `<link rel="apple-touch-icon">` into `<head>`. Build the project, and you'll see these routes registered.

```
├ ○ /apple-icon.png
├ ○ /icon.svg
```

> Key point: **modern browsers prefer `icon.svg`.** So getting the SVG right effectively covers most cases. `.ico` is just for legacy browsers and some fallback situations.

## Step 2. Designing the MD monogram as SVG

The advantage of an SVG favicon is that it's **vector, so it stays sharp whether it's 16px or 512px.** I kept the design simple — a dark rounded square (the same `zinc-900` as the header buttons), with a white "MD" on top.

```svg
<!-- src/app/icon.svg -->
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="15" fill="#18181b"/>
  <text x="32" y="33" text-anchor="middle" dominant-baseline="central"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
        font-size="29" font-weight="800" letter-spacing="-1.5" fill="#ffffff">MD</text>
</svg>
```

A few points:
- `text-anchor="middle"` + `dominant-baseline="central"` centers the text perfectly
- `font-weight="800"` (very bold) and `letter-spacing="-1.5"` keep "MD" legible even at small sizes
- The background `#18181b` is Tailwind's `zinc-900` — matching the header/button tone for brand consistency

That's it for the modern-browser favicon. The problem was `.ico` and `apple-icon.png`, which need **raster (PNG) images.**

## Step 3. Baking the SVG into PNG with sharp (and the trap where text disappears)

Since it's a Node environment, I did the image conversion with `sharp` (Next.js often already has it as a dependency). Baking an SVG into PNG is straightforward.

```js
const sharp = require('sharp')
const svg = require('fs').readFileSync('src/app/icon.svg')

// Raise density for rendering then downscale → stays sharp even at small sizes
await sharp(svg, { density: 512 }).resize(180, 180).png().toFile('apple-icon.png')
```

But there's a **trap** here. When `sharp` (internally librsvg/resvg) renders `<text>`, **if there's no font on the system, it just leaves the text blank.** Only the background square shows up, and "MD" vanishes. Behavior varies by environment, so **you must visually check the resulting PNG.**

I baked out one 256px PNG and opened it directly. Luckily my Mac had a font available, so "MD" rendered crisply. If the text had come out blank, you'd need an SVG with **the letters drawn as vector paths** instead of `<text>` (removing the font dependency, so it renders identically anywhere).

## Step 4. The 285KB favicon png-to-ico made (and shrinking it to 2KB by hand-encoding)

To make the `.ico`, I ran the popular `png-to-ico` package via npx.

```bash
npx png-to-ico md-16.png md-32.png md-48.png > favicon.ico
```

I was shocked looking at the result file.

```
favicon.ico ... 285,478 bytes  (≈ 278KB!)
```

The 16/32/48 PNGs combined should be around 2KB, yet the favicon was **278KB.** Peeking at the header revealed the cause. `png-to-ico` **always includes a 256×256 image regardless of input.** And it stores the small icons not as PNG, but as **uncompressed BMP.** A single 256×256, 32-bit BMP is `256 × 256 × 4 = 262,144` bytes — 256KB. That whole thing had been baked in.

A favicon gets requested on every page, so 278KB is hard to accept (and modern browsers use `icon.svg` anyway). So I decided to **encode the ICO container by hand.** The ICO format turns out to be surprisingly simple.

- **A 6-byte header**: reserved (2) + type (2, icon=1) + image count (2)
- **A 16-byte directory entry per image**: width (1) + height (1) + ... + data size (4) + offset (4)
- Followed by the actual image data

And ICO can **embed PNG directly** (supported since Windows Vista). Put PNG in instead of uncompressed BMP, and the size drops drastically.

```js
const sharp = require('sharp'); const fs = require('fs')
const svg = fs.readFileSync('src/app/icon.svg')
const sizes = [16, 32, 48]

const pngs = []
for (const s of sizes) {
  pngs.push(await sharp(svg, { density: 512 }).resize(s, s).png({ compressionLevel: 9 }).toBuffer())
}

const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0)            // reserved
header.writeUInt16LE(1, 2)            // type: icon
header.writeUInt16LE(sizes.length, 4) // image count

const entries = []
let offset = 6 + 16 * sizes.length
sizes.forEach((s, i) => {
  const e = Buffer.alloc(16)
  e.writeUInt8(s >= 256 ? 0 : s, 0)   // width  (0 == 256)
  e.writeUInt8(s >= 256 ? 0 : s, 1)   // height
  e.writeUInt16LE(1, 4)               // color planes
  e.writeUInt16LE(32, 6)              // bits per pixel
  e.writeUInt32LE(pngs[i].length, 8)  // size of image data
  e.writeUInt32LE(offset, 12)         // offset
  offset += pngs[i].length
  entries.push(e)
})

fs.writeFileSync('src/app/favicon.ico', Buffer.concat([header, ...entries, ...pngs]))
```

Result: **2,145 bytes.** 278KB → 2KB. A 130x reduction. The header (`00 00 01 00 03 00` = 3 icons) checks out too, and it displays correctly in the browser.

## Troubleshooting

- **Favicon isn't updating** → browser favicon caching is unusually stubborn. If a hard refresh (`Cmd+Shift+R`) doesn't work, close and reopen the tab, or check in an incognito window.
- **Text is missing in the sharp-rendered PNG** → a missing font issue. Use an SVG drawn with paths instead of `<text>`, or install a font in the rendering environment.
- **The `.ico` is abnormally large** → likely caused by a tool like png-to-ico embedding uncompressed BMP up to 256px. Hand-encode it, or only embed the sizes you actually need as PNG.

## Summary

The full process of building one brand favicon:

1. **Use the App Router conventions**: place `app/icon.svg` + `app/favicon.ico` + `app/apple-icon.png`, and Next.js auto-links them
2. **Design in SVG**: vector, so it's sharp at every size. Enough on its own for modern browsers
3. **Bake PNG with sharp**: but `<text>` can vanish without a font, so visually verify the result
4. **Keep `.ico` small**: don't just use a tool's bloated output — hand-encode the ICO container if needed

The lesson that stuck with me most is number 4. **"Question and verify even the output of a popular tool."** Had I just shipped that 278KB favicon, every single visitor would've downloaded that heavy file every time. Five minutes of peeking inside one file prevented that. And even a "complex-looking" binary format like ICO turns out to be quite manageable once you actually look at the spec.
