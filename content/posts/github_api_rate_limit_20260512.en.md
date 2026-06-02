---
title: '50 screenshots blew up my blog - debugging GitHub API limit exceedance'
date: '2026-05-12'
publish_date: '2026-06-02'
description: The story of how committing 50 images at once caused a Vercel build to spin 50 times and hit the GitHub API request limit.
tags:
  - Vercel
  - GitHub
  - NextJS
  - Debugging
---

I was posting a post summarizing the Google Play Store app registration process with images.

I was taking screenshots and committing them one by one. When I got to about 50, I went to the site and the list of posts was empty. All the posts that were visible until yesterday were gone.

The build log only said this

```
Error: Command "npm run build" exited with 1
```

---]

## Structure of this blog

First, let's explain the structure: this blog is a Next.js + Vercel combination, and posts are stored as markdown files in the `content/posts/` folder of the GitHub repository.

However, Vercel doesn't read the files directly. Instead, it calls the GitHub API to get the list of files and their contents.

```typescript
// In production, read with the GitHub API
const IS_PROD = !!process.env.VERCEL;

if (IS_PROD) {
  const files = await listGitHubDir("content/posts"); // make 1 API call
  await Promise.all(
    files.map(f => fetchFromGitHub(`content/posts/${f.name}`)) // once per file
  );
}
```

With 100 posts, that's 101 API calls per page load. This is where the problem was lurking.

---

## How did we get to 5,000?

The GitHub API authorization request limit is 5,000 requests per hour.

This is what happened when I committed each screenshot:

```
1 image commit
  → Triggered Vercel build
  → Read all content/posts/ during build
  → GitHub API calls about 100 times
```

This was repeated 50 times.

```
50 builds × 100 API calls = 5,000 calls → limit exceeded.
```

The moment the limit is exceeded, all API calls return `403 rate limit exceeded`. The `listGitHubDir` is structured to return an empty array on failure, so it looked like there were just 0 posts, no error.

---]

## Process to determine the cause

### Step 1 - Reproduce locally

Local builds (`npm run build`) work well because they read the filesystem directly. To mimic the Vercel environment, you can add one environment variable:

```bash
VERCEL=1 npm run build
```

I ran it and immediately got the error. Reproduced successfully.

### Step 2 - Check the GitHub API directly

```bash
curl -s "https://api.github.com/repos/{owner}/{repo}/contents/content/posts" \
  -H "Authorization: Bearer {TOKEN}" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('message',''))"
```

Result:

```
API rate limit exceeded for user ID 264085388.
```

Cause determined.

---]

## Workaround - Add cache

Added a 5-minute cache to API calls that were set to `cache: "no-store"`.

```typescript
// before the change
const res = await fetch(url, {
  headers: ghHeaders,
  cache: "no-store", // call fresh every time
});

// after changes
const res = await fetch(url, {
  headers: ghHeaders,
  next: { revalidate: 300 }, // 5 min cache
});
```

This way, even if the same file is requested multiple times within 5 minutes, the API will only be called once. With typical blog traffic, this is well within the limit of 1,200 requests per hour.

---]

## Fundamental problem - the more images you stack, the worse it gets

We're currently storing images in the `public/images/` folder, but there are two problems with this approach.

| Problem | Description |
|------|------|
| Increased Vercel deployment size | More images means more static files included in every deployment |
| Increased GitHub API calls | More post files means more API consumption per build |

If you plan to write image-heavy posts, you should consider connecting to external storage.

### Options to consider

**Cloudinary
- 25 GB storage on the free plan
- Returns CDN URL when you upload an image → Insert just the URL in markdown
- Auto-resize, WebP conversion support
- Most popular choice for blog images

**Supabase Storage
- 1 GB free, no additional setup required if you're already using Supabase
- S3-compatible API

**Vercel Blob
- The Vercel service is the simplest to set up
- Free plan 500 MB

Either way, the process is the same Upload the image to storage and paste the returned URL into your markdown.

```markdown
<!-- Before change: save directly to repo -->
![screenshot](/images/screenshot.png)

<!-- After change: external storage URL -->
![Screenshot](https://res.cloudinary.com/my-blog/image/upload/screenshot.png)
```

---

## You can also avoid using the GitHub API altogether

The reason we are using the GitHub API is because of the assumption that "files cannot be read in a Vercel serverless environment".

However, if you use the `outputFileTracingIncludes` setting in Next.js, you can include `content/posts/` in your deployment bundle. This will read directly from the filesystem and eliminate the API call altogether.

```typescript
// next.config.ts
experimental: {
  outputFileTracingIncludes: {
    '/': ['./content/**/*'],
  },
}
```

Vercel automatically redeploys every time GitHub Actions pushes a new post, so all files are included in the bundle at deployment time.

---]

## Cleanup

```
Commit 50 images (1 image each)
  → 50 Vercel builds
  → 100 GitHub API calls per build
  → 5,000 times = hourly limit exceeded
  → Returned empty array of post list
  → All posts disappeared from the site

Diagnosis: VERCEL=1 npm run build
Verification: direct API call with curl → rate limit exceeded message

Immediate action: next: { revalidate: 300 } Add cache
Long-term action: move image offsite storage or switch to direct filesystem reads
```

When uploading images, it's a good idea to commit them all at once. There is a 50x difference in the number of Vercel builds between 50 separate commits and 50 commits in one go.
