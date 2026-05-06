---
title: 'Why GitHub Actions Commits Don't Show on Your Contribution Graph — Fix with KST Timezone'
date: '2026-05-04'
publish_date: '2026-05-10'
description: The timezone issue where GitHub Actions auto-commits don't appear on the contribution graph. One line — TZ=Asia/Seoul — fixes it.
tags:
  - GitHub
  - GitHubActions
  - ContributionGraph
  - Automation
---

After setting up automatic commits with GitHub Actions, I noticed something odd.

The commits were clearly there in the repository — but they weren't showing up on the contribution graph. Or they were showing up on the wrong date.

```
Commit list: April 26, 2026 — 2 commits  ✅
Graph:       April 26, 2026 — 1 commit   ❌ (one Actions commit missing)
```

Same day, same commits — so why was only one showing on the graph?

---

## The Cause — UTC vs KST Timestamp Difference

GitHub uses the **timezone offset** in the commit timestamp to determine which day to credit for the contribution graph.

When I commit locally, my Mac's system timezone (KST) stamps the commit:

```
Local commit (KST 01:00):  2026-04-26 01:00:00 +0900  → Graph: April 26 ✅
```

GitHub Actions, on the other hand, runs on Ubuntu runners whose default timezone is **UTC**.

```
Actions commit (KST 00:00): 2026-04-25 15:00:00 +0000  → Graph: April 25 ❌
```

When Actions runs at KST midnight (00:00), UTC sees it as 15:00 the previous day. So even though the commit appears as April 26 in the commit list, the graph records it on April 25.

---

## The Fix — `export TZ='Asia/Seoul'`

Set the timezone to KST before the git commit.

```yaml
- name: Publish scheduled posts
  shell: bash
  run: |
    # ...

    if [ "$PUBLISHED" -gt 0 ]; then
      export TZ='Asia/Seoul'          # ← add this one line
      git config user.name "your-name"
      git config user.email "your@email.com"
      git add ...
      git commit -m "..."
      git push
    fi
```

After this, the commit timestamp looks like:

```
2026-04-26 00:05:32 +0900  → Graph: April 26 ✅
```

Everything executed after the `export TZ` declaration runs in KST, so both the author date and committer date on the git commit get the `+0900` offset.

---

## Full Workflow Example

```yaml
name: Publish Scheduled Posts

on:
  schedule:
    - cron: '5 15 * * *'  # daily at 00:05 KST (= 15:05 UTC)
  workflow_dispatch:

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v4

      - name: Publish scheduled posts
        shell: bash
        run: |
          TODAY=$(TZ='Asia/Seoul' date '+%Y-%m-%d')
          PUBLISHED=0

          for file in content/scheduled/*.md; do
            [ -f "$file" ] || continue
            # ... date check logic ...
            mv "$file" "content/posts/$(basename $file)"
            PUBLISHED=$((PUBLISHED + 1))
          done

          if [ "$PUBLISHED" -gt 0 ]; then
            export TZ='Asia/Seoul'
            git config user.name "your-name"
            git config user.email "your@email.com"
            git add content/posts/ content/scheduled/
            git commit -m "post: publish $PUBLISHED scheduled post(s) ($TODAY)"
            git pull --rebase origin main
            git push
          fi
```

---

## Key Settings

| Setting | Value | Why |
|---------|-------|-----|
| cron | `5 15 * * *` | UTC 15:05 = KST 00:05 |
| `TODAY` variable | `TZ='Asia/Seoul' date` | Compute publish date in KST |
| git commit | `export TZ='Asia/Seoul'` | Stamp commit timestamp in KST |
| user.email | Your GitHub email | Required for graph to count it |

---

## Troubleshooting

### Email is correct but commits aren't showing on the graph

If `TZ` isn't set and commits are stamped in UTC, the date shifts by one day. Confirm that `export TZ='Asia/Seoul'` comes before `git config`.

### Commits exist but appear on the wrong date

The GitHub contribution graph has a cache. It typically updates within minutes to a few hours. If it's not reflected immediately, wait a bit before worrying.

### Checking contribution requirements

Three conditions must all be met for a commit to count on the GitHub contribution graph:

1. The commit's author email must be **registered and verified** on the GitHub account
2. The commit must be on the **default branch** (main)
3. The repo must **not be a fork**

---

## Summary — The Core Flow

```
Problem:
  Actions runner is in UTC timezone
  → KST midnight commit is stamped as the previous day in UTC
  → Shows up one day early on the contribution graph

Fix:
  Add export TZ='Asia/Seoul' before git commit
  → Commit timestamp gets +0900 suffix
  → GitHub reads it as the KST date
  → Contribution graph is accurate ✅
```

It's a one-line change — `export TZ='Asia/Seoul'` — but seeing the green squares land on the right days feels surprisingly satisfying.
