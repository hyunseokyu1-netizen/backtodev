---
title: 'Hardening MatchDa (2): Completely Erasing a Password From History With git-filter-repo'
date: '2026-07-07'
publish_date: '2026-08-20'
description: A record of using git-filter-repo to substitute a plaintext password out of an entire commit history in a public GitHub repo, all the way through to a force-push
tags:
  - git
  - git-filter-repo
  - GitHub
  - Security
  - History Rewriting
---

## Recap of the last part — why this work was needed

In the last part, while doing a security audit, I found a plaintext password baked into a seed SQL file committed to a public GitHub repo.

```sql
crypt('MyPassword2026!', gen_salt('bf')),
```

The first thought was, "can't I just delete this line and commit again?" But that's completely wrong. **Git doesn't just store a file's current state — it permanently keeps a snapshot of every commit.** Even after deleting the password from the file now, opening a past commit via `git log` shows that line sitting there unchanged. On a public repo, anyone can view the file at that point in time with `git checkout <old-commit>`.

In other words, "edit the file + new commit" can never solve this — **the history itself has to be rewritten.** This part is the record of that process.

## Prep — this is irreversible, so back up first

Rewriting history changes every single commit's hash, making it a practically very hard operation to undo. Before starting, I made sure to back up the entire history as a bundle.

```bash
# back up the full history, including branches/tags, into a single file
git bundle create backup-$(date +%Y%m%d-%H%M%S).bundle --all

# verify it
git bundle verify backup-20260705-095702.bundle
```

Having one `.bundle` file meant I could restore everything as-is later with `git clone backup.bundle`, so I could proceed with peace of mind.

## Step 1. Installing `git-filter-repo`

Git has a built-in `git filter-branch`, but even the official docs recommend "it's slow and dangerous, use `git-filter-repo` instead." It installs directly via Homebrew.

```bash
brew install git-filter-repo
git filter-repo --version
```

## Step 2. Writing the substitution rules file

`git-filter-repo` can substitute a specific string across the entire history via the `--replace-text` option. Rules are defined in a single text file.

```
# replacements.txt
MyPassword2026!==>REDACTED_SEED_PASSWORD
```

The format is `string-to-find==>replacement-string`, split around `==>`.

## Step 3. Cleaning the working tree

`filter-repo` refuses to run if there are uncommitted changes (a safety measure). Before running it, I temporarily stashed away my uncommitted changes.

```bash
git stash push -u -m "pre-filter-repo"
git status --short   # confirm it's clean
```

## Step 4. Running it

```bash
git filter-repo --replace-text replacements.txt --force
```

`--force` is needed because `git-filter-repo` enforces, by default, "only run this on a freshly cloned repo." To run it directly in an existing working directory, this flag is required. (It's exactly because this is such a dangerous operation that `--force` should never be attached without a backup.)

Running it produces a log like this.

```
NOTICE: Removing 'origin' remote; see 'Why is my origin removed?'
        in the manual if you want to push back there.
Parsed 174 commits
New history written in 0.54 seconds; now repacking/cleaning...
Completely finished after 0.95 seconds.
```

Something worth noting here — **the `origin` remote gets removed automatically.** This is a safety measure to prevent accidentally pushing to origin with a rewritten history. To push again, you have to manually re-add the remote.

## Step 5. Verification — confirming it's actually gone

Rather than just believing "it's gone" from the log alone, I re-swept the entire history to confirm.

```bash
# search every commit for the original password → should return nothing if successful
git grep -c "MyPassword2026" $(git rev-list --all) 2>/dev/null

# confirm the substituted string went in correctly
git grep -c "REDACTED_SEED_PASSWORD" $(git rev-list --all) 2>/dev/null | head -3
```

If the first command returns no results, it succeeded. I confirmed that the original string had actually disappeared from all 174 commits, and that the substituted string remained in those same commits.

## Step 6. Pushing it to the remote — force-push

```bash
git remote add origin https://github.com/<owner>/<repo>.git
git push origin main --force
```

A regular push won't do — `--force` is required. The remote's commit hashes and the local machine's new hashes represent a completely different history. After force-pushing, I rescanned even the remote history for a final confirmation.

```bash
git fetch origin
git grep -c "MyPassword2026" $(git rev-list origin/main) 2>/dev/null
# → no results (the remote is clean too)
```

## Wrapping up — restoring the stash

I pulled back out the uncommitted changes I'd stashed away before starting.

```bash
git stash pop
```

## Common patterns, summarized

| Purpose | Command |
|---|---|
| Backing up the full history | `git bundle create backup.bundle --all` |
| Global string substitution | `git filter-repo --replace-text rules.txt --force` |
| Searching for a string across the entire history | `git grep -c "pattern" $(git rev-list --all)` |
| Pushing the rewrite to the remote | `git remote add origin <url>` → `git push origin main --force` |

## Troubleshooting

**Q. `git filter-repo: command not found`**
A. I ran into an "externally-managed-environment" error trying to install it via pip (common on recent macOS/Homebrew Python setups). Working around it with `brew install git-filter-repo` is the cleanest fix.

**Q. Pushing got rejected**
A. Once history has been rewritten, a regular `git push` will get rejected 100% of the time (since the remote's and the local's commit graphs no longer match). `--force` is required. That said, a force-push on a branch others are collaborating on can wipe out someone else's work, so on a team repo this absolutely needs advance notice.

**Q. Is this fully safe even then?**
A. No. GitHub may cache old commit objects for some time, and if anyone had already forked or cloned the repo, the old data still exists there. To be truly certain, you can request cache cleanup from GitHub support, or as a last resort, delete and recreate the repo. This all circles back to the same conclusion: **the best move is to never commit a secret in the first place.**

## Summary

The core flow of this work:

```
Backup (bundle) → clean the working tree (stash) → substitute via git-filter-repo
  → re-verify across the entire history (grep) → force-push → re-verify the remote too
```

If I had to leave just one lesson: **"deleting a commit" and "erasing it from history" are completely different operations.** And while the best move is never creating a secret in the first place, once one exists, I learned firsthand that the response has to be rewriting history — not just editing the file.

Next up, a bit of a change of direction — the story of consolidating a DB schema that had been fragmented across 15 migration files into one, and automatically cross-checking it against the actual production database.
