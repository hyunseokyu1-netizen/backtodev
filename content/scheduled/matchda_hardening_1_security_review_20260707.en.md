---
title: 'Hardening MatchDa (1): The Audit That Started With "Check If There Are Any Security Problems"'
date: '2026-07-07'
publish_date: '2026-08-19'
description: A security audit log covering a missing-auth API route, a cross-user delete bug, and a plaintext password sitting in a public repo — all found by sweeping the whole service
tags:
  - Security Audit
  - Next.js
  - Supabase
  - RLS
  - Server Actions
---

## Why a security audit was needed now

While building a service, it's easy to get absorbed in "does the feature work" and let "have we actually blocked anyone from misusing this feature" slide. I was no exception. MatchDa handles resumes, cover letters, and job-posting data, so a fair amount of personal information moves through it. But while I'd always checked "did I add a login check?" whenever building each individual feature, I'd never stepped back to sweep the whole thing at once.

So I asked for a full sweep, all at once: "check if there are any security problems on the site." This isn't writing new code piece by piece — it's **the work of doubting what's already been built.** For someone getting back into development, this attitude matters more than it seems, because you only see the real problems once you drop the assumption of "I wrote it, so it must be right."

## Scope of the audit — where to look

For a Next.js App Router + Supabase combination, a security audit can be swept across these four areas.

1. **API routes** (`src/app/api/*/route.ts`) — do they properly check auth?
2. **Server actions** (`'use server'` files) — is there anywhere that touches the DB without a login/ownership check?
3. **RLS (Row Level Security) policies** — since `supabaseAdmin` (service role) bypasses RLS, is there anywhere a `user_id` filter got missed at the code level?
4. **git history and environment variables** — was a secret ever committed?

Sweeping these four catches most holes.

## Discovery 1 — the middleware excluded `/api` entirely

```ts
// src/middleware.ts
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|auth/callback).*)'],
}
```

The matcher excludes `api`. The middleware checks login status for page routes, but **API routes never pass through the middleware at all.** So auth has to be handled directly inside the API route itself — and `/api/scrape-url` had skipped it.

```ts
// Before
export async function POST(request: Request) {
  const { jobId } = await request.json()
  if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 })

  const { data: job } = await supabaseAdmin
    .from('jobs')
    .select('id, url, source, title, description')
    .eq('id', jobId)
    .single()
  // scraping runs immediately...
}
```

Anyone could call it with just a `jobId`, regardless of login status. Feeding it arbitrary `jobId`s could trigger scraping — a cost concern, and it also had an SSRF-like character, since the server would fetch an external URL on someone's behalf.

The fix matched the pattern used by other server actions.

```ts
// After
export async function POST(request: Request) {
  const email = await getAuthUserEmail()
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getOrCreateProfile(email)
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 401 })

  const { jobId } = await request.json()
  if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 })

  // only allow scraping for a posting that's in my own application list (matches)
  const { data: myMatch } = await supabaseAdmin
    .from('matches')
    .select('job_id')
    .eq('user_id', profile.id)
    .eq('job_id', jobId)
    .maybeSingle()
  if (!myMatch) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // ...scraping logic follows
}
```

What I learned here: checking login alone isn't enough. **Real security also has to block "logged in, but accessing someone else's data."** That's why it also checks the `matches` table for "has this user added this posting to their own list."

## Discovery 2 — `deleteJob` was deleting other users' data too

This was the most alarming part of this audit. Looking at the code, it seemed like just "no auth," but a far more serious design flaw was actually hiding underneath.

```ts
// Before
export async function deleteJob(jobId: string): Promise<{ error?: string }> {
  await supabaseAdmin.from('matches').delete().eq('job_id', jobId)
  const { error } = await supabaseAdmin.from('jobs').delete().eq('id', jobId)
  if (error) return { error: error.message }
  revalidatePath('/')
  return {}
}
```

`matches.delete().eq('job_id', jobId)` — there's no `user_id` condition here. MatchDa's `jobs` table is a pool shared across multiple users — a structure where multiple people can each add the same job posting to their own application list (`matches`). But this function **deletes every user's matches related to that posting, based on a single jobId.** In other words, if user A clicks "delete this posting," it disappears from B's and C's application tracking too, if they'd added the same posting.

The more fundamental problem — more so than the missing auth — was that **the meaning of the "delete" action itself was designed wrong.** In the UI, "delete" is supposed to mean "remove from my list," but the code was behaving as "destroy the shared data itself."

Fixing it didn't stop at adding auth — I redefined the action itself.

```ts
// After — since the shared jobs pool is used by multiple users together,
// "delete" only removes it from my own list (matches).
export async function deleteJob(jobId: string): Promise<{ error?: string }> {
  const email = await getAuthUserEmail()
  if (!email) return { error: 'Login required.' }

  const profile = await getOrCreateProfile(email)
  if (!profile) return { error: 'Profile not found' }

  const { error } = await supabaseAdmin
    .from('matches')
    .delete()
    .eq('user_id', profile.id)
    .eq('job_id', jobId)
  if (error) return { error: error.message }
  revalidatePath('/')
  return {}
}
```

The shared `jobs` row and other users' `matches` are never touched. It only ever deletes the caller's own match.

> The lesson from this: **in a structure where shared data and per-user data are mixed together, every single verb — "delete," "update" — needs to be verified for exactly what it deletes.** Every time I now see a query with `.eq('job_id', jobId)` but no `.eq('user_id', ...)`, I've picked up the habit of instinctively wondering "doesn't this touch someone else's data too?"

With the same lens, I added an ownership check ("is this posting in my match list") to `updateJobDescription` (a function that let anyone edit a shared posting's fields), and added a missing login check to `translateCoverLetter`.

## Discovery 3 — a plaintext password sitting in a public GitHub repo

This wasn't a code-logic problem — just a plain mistake. A SQL file created early on to seed a specific account had the password baked directly into it.

```sql
-- supabase/migrations/002_seed_hyunseok_profile.sql (before the fix)
INSERT INTO auth.users (id, email, encrypted_password, ...)
VALUES (
  gen_random_uuid(),
  'user@example.com',
  crypt('MyPassword2026!', gen_salt('bf')),
  ...
);
```

And this repo was **public on GitHub.** Confirming with `gh repo view --json visibility` showed it immediately.

```bash
gh repo view <owner>/<repo> --json visibility -q .visibility
# PUBLIC
```

Fortunately this password wasn't in active use, so there was no real damage, but it was a moment that made "what happens if you commit a secret to a public repository" hit home. This gets covered in detail in the next part, along with cleaning up the git history.

## Commands I actually used during the audit

```bash
# 1. Check every API route
find src/app/api -name "route.ts" | xargs cat

# 2. Find missing auth checks in server actions (not the most intuitive, but fast)
grep -rn "'use server'" src/ --include="*.ts"
grep -L "getAuthUserEmail" src/app/**/actions.ts   # find files without an auth call

# 3. Cross-reference supabaseAdmin (RLS-bypassing) usage against user_id filters
grep -n "supabaseAdmin" src/app/actions.ts

# 4. Repo visibility
gh repo view <owner>/<repo> --json visibility -q .visibility

# 5. Scan git history for secret patterns
git grep -iE "sk-ant|sk_live|sk_test|eyJhbGciOi" $(git rev-list --all) -- . 2>/dev/null
```

Something like `grep -L "getAuthUserEmail"` — "find files without this pattern" — turned out quite useful for quickly sweeping server actions for missing auth.

## Summary

Two big things I learned from this audit.

- **More important than "is there auth, or isn't there" is "does an authenticated person touch only their own data, exactly."** As with `deleteJob`, a cross-user incident happens even with a login check in place, if the ownership filter (`user_id` matching) is missing.
- **For API routes, don't trust the middleware — authenticate directly inside the route.** Excluding `/api` from a Next.js middleware matcher is a common pattern, which means the route handler itself is the last line of defense for auth.

The problems found, summarized:

| Problem | Severity | Fix |
|---|---|---|
| `/api/scrape-url` had no auth | High | Added login + ownership check |
| `deleteJob` cross-user deletion | High | Redesigned to only delete the caller's own match |
| `updateJobDescription` had no ownership check | Medium | Added a matches ownership check |
| `translateCoverLetter` had no auth | Low (cost trigger) | Added a login check |
| Plaintext password in a public repo | Critical (public exposure) | History cleanup covered in the next part |

Next up: the process of completely erasing this password from git history — rewriting 174 commits with `git-filter-repo`, all the way to a force-push.
