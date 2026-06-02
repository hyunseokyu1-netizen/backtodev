---
title: "One apostrophe broke my Vercel build — the YAML frontmatter trap"
date: '2026-05-10'
publish_date: '2026-06-01'
description: When local builds were fine but only Vercel failed, the culprit was a single line of YAML title with English abbreviations.
tags:
  - Vercel
  - YAML
  - NextJS
  - Debugging
  - GitHubActions
---

Deployment is suddenly not working. It was working fine until yesterday.

A scheduled post was automatically published with GitHub Actions, Vercel detected the commit and started the build, but the build failed. The error message was just this:

```
Error: Command "npm run build" exited with 1
```

You ran `npm run build` locally. It succeeds. What's different?

---

## Why local but not Vercel?

This blog uses the GitHub API to read posts in production builds. While local development reads the filesystem directly, Vercel builds call the GitHub REST API to get the list of `content/posts/` files and their contents.

```typescript
const IS_PROD = !!process.env.VERCEL;

// In production (Vercel), use the GitHub API to retrieve the ```typescript''
if (IS_PROD) {
  const files = await listGitHubDir("content/posts");
  // ...
} else {
  // Locally, read the filesystem directly
  fs.readdirSync(postsDir)...
}
```

So **local `npm run build** succeeds because it reads the file directly, while **Vercel goes through the GitHub API, which can lead to different results**.

There are ways to recreate the Vercel environment locally:

```bash
VERCEL=1 npm run build
```

I ran this and immediately got an error.

---

## Full error message

```
YAMLException: can not read a block mapping entry;
a multiline key may not be an implicit key at line 3, column 5:
    date: '2026-05-04'
        ^
```

Following the stack trace, we see the contents of the offending file:

```
title: "Why GitHub Actions Commits Don't Show on Your Contribution Graph"
```

right here. **That's another single quote inside a string enclosed in single quotes (`'`).** **That's another single quote inside a string enclosed in single quotes.

The `'` in `Don't` is interpreted by the YAML parser as the end of the string, and the `t Show...` after it is an unknown string. Parsing failure.

---

## Why was this not caught in the local build?

Local builds read the file directly into Node.js `fs` because `IS_PROD = false`. Isn't it strange that the `gray-matter` library is parsing the same thing, but it succeeds locally and fails in production?

I checked and found that the files in my local `content/posts/` were slightly different from the ones on GitHub. This is because I ran a build right after GitHub Actions moved the file to scheduled → posts, but before I did a local `git pull`. The file didn't exist locally yet, and Vercel was already reading the error file from GitHub.

Anyway, the gist of it is **YAML parsing error**.

---

## How to fix it

Just wrap it in double quotes instead of single quotes and you're done.

```yaml
# error - YAML parsing fails if '(apostrophe)' is inside single quotes
title: 'Why GitHub Actions Commits Don't Show on Your Contribution Graph'

# normal - if wrapped in double quotes, the inner ' is treated as just a character
title: "Why GitHub Actions Commits Don't Show on Your Contribution Graph"
```

Make the fix, commit the changes locally, and push.

And **important order**: when you run `VERCEL=1 npm run build` again after making your changes, even if you fix the file locally, Vercel reads it with the GitHub API, so you **must push first** to get your changes reflected.

```bash
# 1. modify file
# 2. commit & push
git add content/posts/thatfile.en.md
git commit -m "fix: fix YAML title quotes"
git push origin main

# 3. then verify with a VERCEL=1 build
VERCEL=1 npm run build
```

---

## Common cases

Common expressions with apostrophes in English post titles:

| expressions | examples |
|------|------|
| don't / doesn't / didn't | `Don't Use This Pattern` |
| it's / that's / what's | `It's Not a Bug` |
| I've / you've / we've | `I've Been Doing It Wrong` |
| you're / they're | `You're Probably Overthinking This` |
| won't / can't / couldn't | `Why It Won't Work` |

If any of these are in the title, use **unconditional double quotes**.

---

## Cleanup

```
Publishing scheduled posts with GitHub Actions
        ↓
Trigger a Vercel build
        ↓
posts.ts → IS_PROD=true → Read the file with the GitHub API
        ↓
Parse frontmatter with gray-matter
        ↓
title: '...Don't...' → YAMLException thrown
        ↓
Failed to collect page data for /[locale]/posts/[slug]
        ↓
Build failed ❌
```

**Representation command**: `VERCEL=1 npm run build`

**Modification rule: if an English title has an apostrophe, use `"..."` double quotes

---

*One single-letter quotation mark can stop the entire build pipeline. YAML is stricter than you think.
