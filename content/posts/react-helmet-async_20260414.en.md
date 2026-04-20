---
title: Changing Page Title and Meta Tags per Page in React SPA — react-helmet-async
date: '2026-04-14'
description: How to dynamically control title and meta tags per page in a React SPA using react-helmet-async for better SEO.
tags:
  - React
  - SEO
  - react-helmet-async
  - SPA
---

Have you deployed a React site and run into something like this?

No matter which page you visit, the browser tab always shows the same title. Share a link on Slack or social media and there's no thumbnail, no description — just a bare URL. SEO score: rock bottom.

I hit exactly this issue while building a WiFi QR code generator. The `/` home page and `/privacy` page both showed up in the browser tab as "WiFi QR Print". Fixing it is how I discovered **react-helmet-async**.

---

## Why Does This Happen?

A React SPA uses exactly **one** `index.html`:

```html
<!-- index.html -->
<head>
  <title>WiFi QR Print</title>
  <meta name="description" content="..." />
</head>
<body>
  <div id="root"></div>
</body>
```

When React Router (or wouter) navigates to `/privacy`, the browser doesn't request a new HTML file from the server — JavaScript updates the screen instead. The `<head>` stays untouched.

Result:

| Page | Expected title | Actual title |
|------|----------------|--------------|
| `/` | WiFi QR Print – Free Generator | WiFi QR Print |
| `/privacy` | Privacy Policy – WiFi QR Print | WiFi QR Print |

From an SEO standpoint, every page has the same title and description — Google can't index them properly.

---

## What is react-helmet-async?

A library that lets you **declaratively control `<head>` tags** from inside components.

```tsx
function Home() {
  return (
    <>
      <Helmet>
        <title>Home Page Title</title>
      </Helmet>
      <div>Page content</div>
    </>
  )
}
```

The moment this component renders, the browser's `<head>` is automatically updated.

> **Why react-helmet-async and not react-helmet?**  
> The original `react-helmet` is no longer maintained. `react-helmet-async` is the official successor that works safely in React 18's async rendering environment.

---

## Installation

```bash
npm install react-helmet-async
```

Version note: install **v1**. v3 has a completely redesigned API — using it with old documentation will give you a white screen. I installed the latest (`@3`) at first and experienced my entire deployed site going blank.

```bash
npm install react-helmet-async@1  # recommend pinning the version
```

---

## Step 1 — Wrap Your App with HelmetProvider

`Helmet` works through React Context. Set up `HelmetProvider` once at the top level:

```tsx
// App.tsx
import { HelmetProvider } from "react-helmet-async";

function App() {
  return (
    <HelmetProvider>
      {/* rest of the app */}
      <Router />
    </HelmetProvider>
  );
}
```

Using `Helmet` without `HelmetProvider` will produce warnings or simply not work.

---

## Step 2 — Use Helmet in Page Components

Now declare `<head>` content however you like inside each page component:

```tsx
// pages/Home.tsx
import { Helmet } from "react-helmet-async";

export default function Home() {
  return (
    <>
      <Helmet>
        <title>WiFi QR Print – Free WiFi QR Code Generator</title>
        <meta name="description" content="Generate a QR code in seconds." />
        <link rel="canonical" href="https://wi-fi-qr.xyz/" />
      </Helmet>

      <div>Page content...</div>
    </>
  );
}
```

```tsx
// pages/Privacy.tsx
import { Helmet } from "react-helmet-async";

export default function Privacy() {
  return (
    <>
      <Helmet>
        <title>Privacy Policy – WiFi QR Print</title>
        <meta name="description" content="Our privacy policy." />
        <meta name="robots" content="noindex, follow" />
        <link rel="canonical" href="https://wi-fi-qr.xyz/privacy" />
      </Helmet>

      <div>Page content...</div>
    </>
  );
}
```

Now navigating to `/privacy` changes the browser tab title to "Privacy Policy – WiFi QR Print".

---

## Step 3 — Dynamic Tags for Multi-Language Sites

My project supports Korean, English, Chinese, and German, so the title and description had to change per language:

```tsx
export default function Home() {
  const { lang } = useI18n();

  const pageTitles = {
    en: "WiFi QR Print – Free WiFi QR Code Generator",
    ko: "WiFi QR 프린트 – 무료 WiFi QR 코드 생성기",
    zh: "WiFi 二维码打印 – 免费WiFi二维码生成器",
    de: "WiFi QR Druck – Kostenloser WLAN QR-Code Generator",
  };

  const pageDescs = {
    en: "Generate a printable WiFi QR code in seconds.",
    ko: "몇 초 만에 인쇄 가능한 WiFi QR 코드를 생성하세요.",
    zh: "几秒钟内生成可打印的WiFi二维码。",
    de: "Erstellen Sie in Sekunden einen druckbaren WLAN-QR-Code.",
  };

  return (
    <>
      <Helmet htmlAttributes={{ lang }}>
        <title>{pageTitles[lang]}</title>
        <meta name="description" content={pageDescs[lang]} />
        <link rel="canonical" href="https://wi-fi-qr.xyz/" />
      </Helmet>
      ...
    </>
  );
}
```

`htmlAttributes={{ lang }}` sets attributes on the `<html>` tag — like `<html lang="ko">`.  
> ⚠️ Directly adding `<html lang="ko" />` as a Helmet child causes errors in v3. Always use the `htmlAttributes` prop.

---

## Common Patterns Reference

```tsx
<Helmet htmlAttributes={{ lang: "en" }}>
  {/* Browser tab title */}
  <title>Page Title</title>

  {/* Search result description */}
  <meta name="description" content="Page description" />

  {/* Prevent duplicate URL indexing */}
  <link rel="canonical" href="https://example.com/page" />

  {/* Exclude from Google indexing (privacy policy, etc.) */}
  <meta name="robots" content="noindex, follow" />

  {/* Social media share preview */}
  <meta property="og:title" content="Title shown when shared" />
  <meta property="og:description" content="Share description" />
  <meta property="og:image" content="https://example.com/og-image.png" />

  {/* Twitter card */}
  <meta name="twitter:card" content="summary_large_image" />
</Helmet>
```

---

## Troubleshooting

### White screen after deployment

**Cause**: `react-helmet-async@3` installed.  
v3 is a complete redesign — the `Helmet` / `HelmetProvider` pattern from existing documentation won't work.

```bash
# Fix: install v1 explicitly
npm install react-helmet-async@1
```

---

### Title isn't changing

Check that your app is wrapped with `HelmetProvider`. Without it, nothing works.

```tsx
// ❌ Won't work
<App />

// ✅ Works
<HelmetProvider>
  <App />
</HelmetProvider>
```

---

### SSR (Server-Side Rendering) environments

For Next.js or other SSR setups, Next.js's built-in `<Head>` component or `next/head` is a better fit than react-helmet-async. react-helmet-async is primarily for **pure client-side SPAs like Vite or CRA**.

---

## Summary

```
Problem: SPA has one index.html → every page shares the same title/meta
Solution: react-helmet-async controls <head> dynamically from inside components

Install: npm install react-helmet-async@1  ← pin the version

1. Wrap App.tsx with <HelmetProvider>
2. Add <Helmet> declarations in each page component
3. Set title, description, canonical, OG tags as needed
```

SEO isn't a one-time thing — it's built up through small improvements like this. Adding react-helmet-async alone gives each page an accurate title and canonical URL, making it much easier for Google to understand your site.
