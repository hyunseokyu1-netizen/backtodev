---
title: 'When Your GitHub Grass Has Gaps, How to Fill Them With Backdated Commits (Honestly)'
date: '2026-07-01'
publish_date: '2026-07-19'
description: How to create past-dated commits with GIT_AUTHOR_DATE and GIT_COMMITTER_DATE to fill in grass gaps, and what actually counts as a contribution
tags:
  - Git
  - GitHub
  - Contribution Graph
  - Productivity
---

## Why one or two blank squares of grass bother you so much

The GitHub profile contribution graph — commonly called "the grass" — those green squares. Commit consistently, and one day you spot **a couple of blank white squares** in the middle. I found June 28th and 29th blank myself while working on my blog (backtodev).

I definitely worked on those two days, so why were they blank? Checking, it turned out the only thing that happened in the repo that day was **automatic commits made by a GitHub Actions bot.** Bot commits don't count toward my grass. The actual work I did (writing blog drafts) never left a git commit behind.

So I looked for a way to "record work I'd already done, dated to that day." Short answer: git lets you set a commit's date to whatever you want. But depending on how you use it, this can either be "an honest record" or "grass manipulation." Let me lay out that boundary too.

## First: how is the grass actually calculated

Before learning how to fill it in, you need to know why it's empty in the first place. GitHub's conditions for counting a commit as "my contribution" are clear-cut.

| Condition | Description |
|------|------|
| **Commit email** | the commit's author email must be **an email registered to my GitHub account** |
| **Branch** | the default branch (`main`, etc.) or `gh-pages` |
| **Repository** | a repo I have permission on, **not a fork** |
| **Date** | not too far in the past or future |

A blank square is almost always caused by one of these being off. My case was "the bot committed, and it wasn't my email," so it didn't count.

> 💡 A common mistake: having a different `git config user.email` on your work laptop vs. personal laptop. If one email isn't registered on GitHub, commits made on that machine won't show up on the grass. Check with `git config user.email` first.

## Step 1. Check your commit email first

Whether you backdate or not, it's pointless if the email doesn't match. Check it first.

```bash
git config user.email
```

The email shown here needs to be registered to your GitHub account (Settings → Emails). Fix it if it isn't.

```bash
git config user.email "you@example.com"
```

## Step 2. Creating a commit with a past date

Git has **two kinds** of dates. This is the key part.

- **Author date**: the date the code was "written"
- **Committer date**: the date the commit was "recorded"

The grass looks at both. So you need to set **both** to land on the date you want. Pass them as environment variables.

```bash
GIT_AUTHOR_DATE="2026-06-28T14:20:00" \
GIT_COMMITTER_DATE="2026-06-28T14:20:00" \
git commit -m "post: register scheduled posts"
```

Skip `GIT_COMMITTER_DATE`, and it stamps today's date, landing the grass in the wrong square. The trick is matching both to the same value.

Push, and you're done.

```bash
git push origin main
```

Wait a bit (usually a few minutes), and that day's square on your profile turns green.

## Step 3. What I actually did — recording real work on that date

This is the part I most want to say in this post. I didn't create **meaningless empty commits** to fill the gaps. Instead, I split up real work I'd done on the 28th and 29th and recorded it under those actual dates.

What I'd done on those two days was **registering 19 blog drafts into the scheduled-publishing folder.** So I split this into two batches, committing one under the 28th and one under the 29th.

```bash
# 28th: register the first batch
git add content/scheduled/post-a.md content/scheduled/post-b.md ...
GIT_AUTHOR_DATE="2026-06-28T14:20:00" \
GIT_COMMITTER_DATE="2026-06-28T14:20:00" \
git commit -m "post: register 10 scheduled posts"

# 29th: register the second batch
git add content/scheduled/post-k.md ...
GIT_AUTHOR_DATE="2026-06-29T15:40:00" \
GIT_COMMITTER_DATE="2026-06-29T15:40:00" \
git commit -m "post: register 9 scheduled posts"
```

The grass ended up filled, but that's because **I recorded real work in git belatedly, not because I invented activity that never happened.** This distinction matters.

## Filling it with empty commits (for reference only)

Of course, technically, you can fill in a square with an empty commit that has no content at all.

```bash
GIT_AUTHOR_DATE="2026-06-28T12:00:00" \
GIT_COMMITTER_DATE="2026-06-28T12:00:00" \
git commit --allow-empty -m "chore: keep streak"
```

`--allow-empty` lets you create a commit even with no changes. But I **don't recommend this.** It piles up meaningless commits in the repo's history, and more importantly, it's undermining the grass's actual purpose (a record of real activity) yourself.

## Stepping back: does it even need filling in

Honestly, one or two blank grass squares are **not a problem at all.** A profile that's spotlessly green every single day even looks a bit unnatural. Recruiters look at "what you actually built," not how densely colored your grass is.

So here's how my own standard shook out.

| Situation | Judgment |
|------|------|
| Real work I did that day never made it into git | backdating to **record** it is reasonable |
| I genuinely did no work that day | filling it with an empty commit is **self-deception** |
| It's just that the streak number bugs me | better to leave it unfilled |

The technique is the same, but the fork in the road is whether the motive is "recording" or "manipulating."

## Troubleshooting

| Symptom | Cause | Fix |
|------|------|------|
| Backdated, but it's not showing on the grass | commit email isn't registered on GitHub | `git config user.email` → register it under GitHub Emails |
| Stamped with today's date | `GIT_COMMITTER_DATE` was missing | set both author and committer |
| Not counted because it's a fork repo | commits on a fork don't count as contributions | commit on the upstream repo or your own repo |
| Bot/Actions commits aren't on the grass | the author isn't my email | expected behavior — bot commits never count |
| Still not reflected after a few days | delayed propagation or email mismatch | check that commit's author on your profile |

## Summary

- Grass-counting conditions: **my email + the default branch + not a fork**
- Past-dated commit: set **both** `GIT_AUTHOR_DATE` and `GIT_COMMITTER_DATE`
- GitHub Actions bot commits **don't count** toward my grass (the author isn't me)
- You can fill it with an empty commit (`--allow-empty`) too, but it's **not recommended**
- The best approach is **recording real work under its actual date**

I decided to treat the grass not as a tool for "decorating," but for "recording accurately." Rather than getting anxious over a blank square, it's ultimately more honest to make sure the work you actually did that day made it into git properly.
