---
title: "Building Dynamic OG Images in Next.js — Korean Font Subsetting and Satori's Pitfalls"
date: '2026-07-13'
publish_date: '2026-11-24'
description: Pretty share links bring people in — generating per-page OG images with ImageResponse and shrinking multi-MB Korean fonts down with the Google Fonts text= subset trick
tags:
  - Next.js
  - OG Image
  - ImageResponse
  - Web Share API
  - Satori
---

Once I connected a custom domain to my side project, the next question came up: **where do I even share this link now?** But when I actually went to share it, I ran into a more basic problem. Pasting the link into KakaoTalk produced a flat preview card with no image at all.

For a community service, link sharing is basically the whole acquisition funnel. If you drop a link saying "just trash-talk anonymously in this room," the click-through rate is completely different depending on whether the preview card that pops up has the room's name front and center or is just an empty gray box. So today I worked on **dynamically generating a different OG image for every page**, and here I'm writing up the Korean font problem and the Satori renderer pitfalls I ran into along the way.

## What Even Is an OG Image

`og:image` is the preview image that KakaoTalk, Twitter, Slack, and the like show when you share a link. For a static site, you'd just make one image, stick it in a meta tag, and be done — but my service has **rooms (boards) that users keep creating**, so every room needed its own image. If you share the "Stanley Tumbler" room, the card should show "Stanley Tumbler," not something generic.

Next.js solves this with a single file convention. Drop an `opengraph-image.tsx` into a route folder, and the OG image for that route gets **rendered from JSX to PNG at request time**.

## Step 1 — Setting Up Root Metadata

Before getting to images, the basics first. I set `metadataBase` and a title template on the root layout's `metadata`:

```tsx
// app/layout.tsx
export const metadata: Metadata = {
  metadataBase: new URL("https://nogari.org"),  // 상대 URL의 기준
  title: {
    default: "노가리 — 익명 커뮤니티",
    template: "%s | 노가리",   // 하위 페이지 title이 자동으로 "○○ | 노가리"
  },
  openGraph: { siteName: "노가리", type: "website", locale: "ko_KR" },
  twitter: { card: "summary_large_image" },
};
```

Setting `metadataBase` means that even if the OG image URL is a relative path, it still gets resolved into an absolute URL. Deploying without this is the number one reason previews don't show up.

## Step 2 — Metadata for Dynamic Routes: generateMetadata

The room detail page (`app/topics/[id]/page.tsx`) needs a different title and description per room, so I used `generateMetadata`:

```tsx
export async function generateMetadata({ params }) {
  const { id } = await params;          // Next.js 16: params는 Promise
  const topic = await getTopic(id);
  if (!topic) return { title: "노가리방" };

  const title = `${topic.title} 노가리방`;
  const description = topic.description ??
    `${topic.title}에 대해 익명으로 노가리 까는 방. 가입 없이 바로 참여하세요.`;

  return { title, description, openGraph: { title, description } };
}
```

Now when you paste the link, the preview text shows something like "Stanley Tumbler Nogari Room — everyone's carrying one of these these days."

## Step 3 — Drawing the Image with ImageResponse

I created `opengraph-image.tsx` in the same folder, and passing JSX to `next/og`'s `ImageResponse` turns it into a PNG. I can read the room info straight from the DB and drop it onto the canvas:

```tsx
// app/topics/[id]/opengraph-image.tsx
import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }) {
  const { id } = await params;
  const topic = await getTopic(id);   // Supabase에서 방 이름·유형 조회
  const title = topic?.title ?? "노가리방";

  return new ImageResponse(
    (
      <div style={{ /* 배경·테두리·패딩 — 브랜드 스타일 */ }}>
        <div style={{ fontSize: title.length > 12 ? 72 : 96 }}>{title}</div>
        {/* 로고 SVG, 유형 태그, 도메인 라벨... */}
      </div>
    ),
    { ...size, fonts: [{ name: "IBMPlexSansKR", data: font, weight: 700 }] },
  );
}
```

A few points worth noting:

- The renderer isn't a browser — it's a separate engine called **Satori**. It only supports a subset of CSS (more on the pitfalls below)
- Conditionally shrinking the font size based on title length keeps long room names from getting cut off
- The brand SVG logo renders fine if you just inline it inside the JSX

## Step 4 — The Korean Font Problem: the text= Subset Trick

Here's today's highlight. `ImageResponse` requires you to pass in the font data directly, but **a Korean font has over 10,000 glyphs, so a single TTF file runs several megabytes.** Bundling that into the repo is heavy, and loading the whole thing on every render is slow.

The solution is the `text=` parameter on the Google Fonts css2 API. It **builds a subset font that only contains the characters you specify**:

```ts
export async function loadKoreanFont(text: string): Promise<ArrayBuffer> {
  const unique = Array.from(new Set(text)).join("");   // 중복 글자 제거
  const cssRes = await fetch(
    `https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@700&text=${encodeURIComponent(unique)}`,
  );
  const css = await cssRes.text();
  const url = css.match(/src:\s*url\((.+?)\)/)?.[1];   // css 안의 실제 폰트 URL
  const fontRes = await fetch(url!);
  return fontRes.arrayBuffer();
}
```

How it works:

1. Gather all the text that'll go into the image (room name + fixed copy) and dedupe the characters
2. Call the css2 API with the `text=` parameter → it returns CSS pointing to a font that only contains those characters
3. Pull the font URL out of the CSS with a regex and download it

This shrinks the font data from several megabytes down to **a few kilobytes**. A nice side effect: if you don't attach a browser User-Agent to the fetch, Google returns a TTF that Satori can actually read instead of a woff2.

## Step 5 — Share Button: Web Share API with a Clipboard Fallback

Now that the image looks good, I needed a share entry point too. I added a "Share" button to the room's title bar:

```tsx
"use client";

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {                    // 모바일: 시스템 공유 시트
      try { await navigator.share({ title, url }); } catch { /* 취소 */ }
      return;
    }
    await navigator.clipboard.writeText(url); // 데스크톱: 클립보드 복사
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button onClick={handleShare}>{copied ? "복사됨!" : "공유"}</button>
  );
}
```

- On mobile (iOS/Android), `navigator.share` exists, so the system share sheet opens up — KakaoTalk, Messages, and so on
- Most desktop browsers don't support it, so it falls back to copying the link to the clipboard and showing "Copied!" for two seconds
- A rejected `navigator.share` call almost always just means "the user closed the sheet," so it's correct to silently ignore it

I tested both paths with Playwright. For the fallback path, you can force a desktop-like environment by overwriting `navigator.share` to `undefined` with `page.addInitScript`.

## Step 6 — A Use Case: Turning "Not-Yet-Open Pages" into a Sharing Weapon

The real fun of this infrastructure showed up in how I applied it. My service opens a room (board) once 30 users agree to it, and **a pending room is exactly the moment that needs sharing the most** — because you have to send your friends something like "I want to open this room, come agree with me."

So I made the OG image and landing different for pending rooms:

- Instead of a "Item Nogari Room" tag pill, the OG card shows **"Pending · 3/30 agreed,"** with the subcopy "Agree together and the room opens"
- Someone clicking the link doesn't land on an explainer page — they land **right on a page where they can agree on the spot**

All it took was branching on the DB's `status` and `votes_count` inside the same `opengraph-image.tsx`. The share card stops saying "come take a look" and becomes **a request to take action**. What I learned from this: the value of dynamic OG images isn't a pretty preview — it's being able to send a message that matches the page's current state along with the link.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| OG image 500 error: `Expected <div> to have explicit "display: flex"` | Satori requires an explicit flex declaration on any `div` with 2+ children. Something like `{typeLabel} 노가리방` — **a mix of expression + text also counts as 2 children** | Merge them with a template literal: `` {`${typeLabel} 노가리방`} `` |
| Korean text renders as □□□ | The font data doesn't contain the matching glyphs | Check whether the `text=` subset includes all the text being rendered |
| Preview doesn't show up after deploy | `metadataBase` isn't set, so the image URL stays a relative path | Add `metadataBase` to the root metadata |
| The old image keeps showing up when sharing | KakaoTalk/Twitter cache the OG data | Reset the cache in the Kakao sharing debugger |

The first one is especially nasty. In JSX, `{variable} text` looks like a single chunk to the eye, but to Satori it's two child nodes. The error message alone doesn't tell you where it's coming from, so I only caught it by looking at the dev server logs.

## Wrap-Up

1. **Root metadata** — `metadataBase` + title template + OG/Twitter defaults
2. **Dynamic routes** — per-page title/description via `generateMetadata`
3. **`opengraph-image.tsx`** — generates a PNG at request time with nothing but a file convention, and it can query the DB too
4. **Korean fonts** — shrinking several megabytes down to a few kilobytes with the Google Fonts `text=` subset
5. **Watch out for Satori** — divs with multiple children need an explicit flex, and expression+text mixes count as multiple children too
6. **Share button** — `navigator.share` first, with a clipboard fallback
7. **Branching OG by state** — serving a card that matches the page's state (pending, etc.) even on the same route

It might seem like overkill to go this far just to make one link look nice, but for a community service, the share card is effectively the first screen. It's the only UI a visitor sees before they even reach the site.
