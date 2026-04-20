---
title: 'Scheduled Blog Post Publishing with GitHub Actions'
date: '2026-04-17'
description: How to set up a GitHub Actions workflow that automatically publishes blog posts on a specified date — based on a real implementation experience.
tags:
  - GitHub Actions
  - Automation
  - CI/CD
  - Vercel
  - Blog
---

## "I wrote the post, but now I have to remember to publish it today…"

This is a real situation when running a blog. The post is done, but you have to manually go in and publish it every day. You write several posts at once and want to release one per day — but there's no built-in way to do that.

So I built a scheduled publishing feature myself.

**GitHub Actions** lets you automatically commit and deploy a post on a specified date, even if your Mac is turned off. It works by leveraging the existing Vercel auto-deploy that triggers on every push to the GitHub main branch.

---

## What Is GitHub Actions?

An **automation tool** provided by GitHub. It runs specified tasks automatically when code is pushed, a PR is opened, or a specific time is reached. Because it runs on GitHub's servers, **it works even when your computer is off**.

The free plan includes 2,000 minutes of run time per month — effectively unlimited for blog automation.

---

## Prerequisites

- A project hosted on GitHub (public or private)
- Vercel auto-deploy connected (Vercel detects GitHub push → auto-deploys)
- Blog posts that include a `date` field in their markdown frontmatter

```yaml
---
title: 'Post Title'
date: '2026-04-20'   ← the date you want to publish
description: 'Description'
---
```

---

## Step 1. Create the Folder Structure

Two folders are needed:

```
content/
├── posts/       ← published posts (current)
└── scheduled/   ← scheduled posts (create this)
```

Create `scheduled/` and add a `.gitkeep` file so the empty folder is tracked by Git:

```bash
mkdir content/scheduled
touch content/scheduled/.gitkeep
```

---

## Step 2. Create the Workflow File

Create the `.github/workflows/` folder and add `scheduled-post.yml`:

```bash
mkdir -p .github/workflows
```

**`.github/workflows/scheduled-post.yml`:**

```yaml
name: Publish Scheduled Posts

on:
  schedule:
    - cron: '0 15 * * *'  # Every day at 00:00 KST (= UTC 15:00)
  workflow_dispatch:        # Also allows manual triggering

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: write       # Permission to commit

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Publish scheduled posts
        shell: bash
        run: |
          TODAY=$(TZ='Asia/Seoul' date '+%Y-%m-%d')
          echo "Today: $TODAY"
          PUBLISHED=0

          for file in content/scheduled/*.md content/scheduled/*.mdx; do
            [ -f "$file" ] || continue

            # Extract date from frontmatter
            POST_DATE=$(grep -m1 '^date:' "$file" | sed "s/date: *['\"]//;s/['\"].*//;s/ *//")

            if [ -z "$POST_DATE" ]; then
              echo "No date found, skipping: $file"
              continue
            fi

            echo "Checking: $file → date: $POST_DATE"

            # Publish if date <= today (compare as integers)
            POST_NUM=$(echo "$POST_DATE" | tr -d '-')
            TODAY_NUM=$(echo "$TODAY" | tr -d '-')
            if [ "$POST_NUM" -le "$TODAY_NUM" ]; then
              FILENAME=$(basename "$file")
              mv "$file" "content/posts/$FILENAME"
              echo "Published: $FILENAME"
              PUBLISHED=$((PUBLISHED + 1))
            fi
          done

          if [ "$PUBLISHED" -gt 0 ]; then
            git config user.name "github-actions[bot]"
            git config user.email "github-actions[bot]@users.noreply.github.com"
            git add content/posts/ content/scheduled/
            git commit -m "post: published ${PUBLISHED} scheduled post(s) ($TODAY)"
            git pull --rebase origin main
            git push
            echo "✅ $PUBLISHED post(s) published"
          else
            echo "No posts scheduled for today"
          fi
```

---

## Step 3. Register a Scheduled Post

From now on, save posts you want to schedule in `content/scheduled/` instead of `content/posts/`:

```bash
# Schedule a post
cp new-post.en.md content/scheduled/new-post.en.md
git add content/scheduled/new-post.en.md
git commit -m "post: schedule new-post for 2026-04-20"
git push
```

The frontmatter `date` field determines the publish date. Set it to `2026-04-20` and it will automatically move to `content/posts/` at midnight on that day, triggering Vercel to deploy.

---

## Step 4. Manual Testing

To verify the workflow runs correctly before waiting for the scheduled time:

1. GitHub → your project → **Actions** tab
2. Select `Publish Scheduled Posts` on the left
3. Click **Run workflow**
4. Check the logs → confirm the file moved to `content/posts/`
5. Verify deployment completion in the Vercel dashboard

---

## Understanding the Cron Expression

`'0 15 * * *'` might look confusing at first:

```
min  hr  day  month  weekday
0    15   *     *       *
```

| Field | Value | Meaning |
|-------|-------|---------|
| Minute | `0` | at :00 (top of the hour) |
| Hour | `15` | UTC 15:00 = KST 00:00 |
| Day | `*` | every day |
| Month | `*` | every month |
| Weekday | `*` | every weekday |

**Common KST patterns:**

| Desired time | Cron expression |
|---|---|
| Every day at midnight (00:00 KST) | `0 15 * * *` |
| Every day at 9 AM (KST) | `0 0 * * *` |
| Every Monday at 9 AM (KST) | `0 0 * * 1` |
| 1st of every month at midnight (KST) | `0 15 1 * *` |

---

## Troubleshooting

### Workflow ran but no commit was made

```yaml
permissions:
  contents: write   ← without this, there's no push permission
```

Check that the `permissions` block is present under `jobs:`.

### Date looks right but post wasn't published

GitHub Actions cron uses UTC. KST April 18 00:00 = UTC April 17 15:00.

Since we use `TZ='Asia/Seoul' date` to get the KST date, a post with `date: 2026-04-18` will publish at KST April 18 00:00. That's the intended behavior.

### `content/scheduled/` folder isn't tracked by Git

Git doesn't track empty folders. Put a `.gitkeep` file inside and push it:

```bash
touch content/scheduled/.gitkeep
git add content/scheduled/.gitkeep
```

---

## Summary — The Core Flow

```
1. Create the folder
   content/scheduled/   ← holds scheduled posts

2. Create the workflow file
   .github/workflows/scheduled-post.yml
   → cron: '0 15 * * *' (every day at 00:00 KST)
   → files with date <= today → move to content/posts/ → commit → push

3. Schedule a post
   Set date in frontmatter → save to content/scheduled/ → git push

4. Auto-publish
   GitHub Actions → moves to content/posts/ → Vercel auto-deploys
```

Once set up, scheduling a post is as simple as putting it in `content/scheduled/` and pushing. Writing several posts at once and releasing one per day becomes completely effortless.
