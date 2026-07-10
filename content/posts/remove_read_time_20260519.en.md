---
title: 'Why I Removed "1 min read" From the Blog Post List'
date: '2026-05-19'
publish_date: '2026-06-09'
description: Why a read-time badge backfires on a young blog, and how I removed it from Next.js components
tags:
  - Next.js
  - UI
  - Blog
  - React
---

Looking at my blog's post list, something small kept catching my eye.

Next to the date, it showed **"⏱ 1 min read."**

It's the feature you see all over platforms like Medium — telling you upfront how long a post will take. I'd added it early on without much thought, but I started wondering whether it was actually needed.

---

## Why I removed it

Two reasons.

**First, it carries no information.**
Most of my posts are practical setup guides or short experience logs. Nearly all of them come out to "1–2 min read." If every single post says "1 min read," it tells the reader nothing. It's just text taking up space.

**Second, it was a hardcoded value.**
Looking at the code, it wasn't actually calculated from word count — it was just a fixed `1 {minReadLabel}`. That made it even more meaningless.

---

## "What about switching it to a view count?"

I considered this for a moment too. But the conclusion was **not yet.**

What happens if a young blog shows view counts? Numbers like "3 views," "7 views" show up. Instead of building trust, this can leave the impression of **"oh, nobody reads this blog."**

On top of that, implementing view counts properly needs a backend like Supabase. There's no reason to spend that resource right now.

**It's far more effective to add this once some real traffic has accumulated.**

So in the end, I decided to remove both, and keep just the date + tags.

---

## Where to fix this

First, I found where the read time was being rendered.

```bash
grep -r "min read\|readingTime\|minRead" . --include="*.tsx" -l
```

Result:
```
app/[locale]/page.tsx
app/[locale]/posts/page.tsx
app/[locale]/posts/[slug]/page.tsx
components/PostCard.tsx
components/PostsClient.tsx
```

It was duplicated in two places. `PostCard` is used on the homepage, `PostsClient` on the posts list page. Both needed fixing.

---

## Step 1 — Fix PostCard.tsx

Remove the read-time section from the homepage post card.

**before:**
```tsx
interface Props {
  post: PostMeta;
  minReadLabel?: string;  // remove
  readLabel?: string;
}

export default function PostCard({ post, minReadLabel = "min read", readLabel = "Read →" }: Props) {
  // ...
  <span className="flex items-center" style={{ gap: "0.375rem" }}>
    <svg ...> {/* clock icon */} </svg>
    1 {minReadLabel}
  </span>
}
```

**after:**
```tsx
interface Props {
  post: PostMeta;
  readLabel?: string;
}

export default function PostCard({ post, readLabel = "Read →" }: Props) {
  // ...
  // the entire read-time span, deleted
}
```

---

## Step 2 — Fix PostsClient.tsx

The component that renders posts alongside filter/search functionality on the posts list page.

**before:**
```tsx
interface Props {
  posts: PostMeta[];
  minReadLabel: string;  // remove
  readLabel: string;
}

export default function PostsClient({ posts, minReadLabel, readLabel }: Props) {
  // ...
  <span className="flex items-center" style={{ gap: "0.375rem" }}>
    <svg ...> {/* clock icon */} </svg>
    1 {minReadLabel}
  </span>
}
```

**after:**
```tsx
interface Props {
  posts: PostMeta[];
  readLabel: string;
}

export default function PostsClient({ posts, readLabel }: Props) {
  // read-time span removed
}
```

---

## Step 3 — Remove the prop from parent components

Wherever `PostCard` and `PostsClient` were called, they were also passing the `minReadLabel` prop. All of these needed to go too, or TypeScript would throw an error.

**app/[locale]/posts/page.tsx:**
```tsx
// before
<PostsClient
  posts={posts}
  minReadLabel={tPost("minRead")}
  readLabel={tPost("read")}
/>

// after
<PostsClient
  posts={posts}
  readLabel={tPost("read")}
/>
```

**app/[locale]/page.tsx (home):**
```tsx
// before
<PostCard post={post} minReadLabel={tPost("minRead")} readLabel={tPost("read")} />

// after
<PostCard post={post} readLabel={tPost("read")} />
```

---

## Step 4 — Type check, then deploy

```bash
npx tsc --noEmit
```

No errors, so commit & push.

```bash
git add components/PostCard.tsx components/PostsClient.tsx \
        'app/[locale]/posts/page.tsx' 'app/[locale]/page.tsx'
git commit -m "feat: remove read time display from post list"
git push origin main
```

> **Note:** in a Next.js project, paths containing brackets like `app/[locale]/` must always be quoted when running `git add`. Otherwise zsh interprets it as a glob pattern and throws a `no matches found` error.

---

## Summary

```
Problem identified: "1 min read" shows a fixed value on every post → no informational value
    ↓
Alternative considered: view count? → backfires on a young blog. Also has implementation cost
    ↓
Conclusion: remove both, keep just date + tags
    ↓
Code changes:
  PostCard.tsx → removed minReadLabel prop + the clock icon span
  PostsClient.tsx → removed the same way
  Parent pages → cleaned up the prop-passing code
    ↓
Verified with tsc --noEmit → committed & deployed
```

A small change, but stripping meaningless elements out of the UI one at a time eventually adds up to a cleaner design. I'll revisit the view-count feature once some real traffic has built up.
