---
title: "Getting Started with Next.js App Router"
date: "2026-03-25"
description: "A quick guide to building with Next.js 15 App Router."
tags: ["Next.js", "React"]
lang: "en"
---

## What is App Router?

Next.js 15 introduced the App Router, a new paradigm for building React applications. It is built on top of React Server Components and provides a more powerful and flexible way to structure your app.

## Key Concepts

### Server Components

By default, all components inside the `app/` directory are **React Server Components**. They run on the server and have direct access to backend resources like databases and file systems.

```tsx
// This runs on the server — no need for useEffect or fetch wrappers
export default async function Page() {
  const data = await fetch("https://api.example.com/data");
  const json = await data.json();
  return <div>{json.message}</div>;
}
```

### Client Components

When you need interactivity or browser APIs, mark the component with `"use client"`:

```tsx
"use client";

import { useState } from "react";

export default function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

## File-based Routing

Routes are defined by the folder structure inside `app/`:

| Path | Route |
|------|-------|
| `app/page.tsx` | `/` |
| `app/about/page.tsx` | `/about` |
| `app/posts/[slug]/page.tsx` | `/posts/:slug` |

## Why App Router?

> The App Router enables streaming, parallel data fetching, and layouts that persist across navigations — all with less boilerplate.

It takes a bit of adjustment coming from the Pages Router, but the benefits for large applications are significant.
