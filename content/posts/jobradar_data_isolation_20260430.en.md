---
title: 'Data isolation bugs exposed by creating multi-user apps with Supabase service role'
date: '2026-04-30'
publish_date: '2026-05-17'
description: 4 data isolation pitfalls and solutions when using only the service role client without RLS.
tags:
  - Supabase
  - Next.js
  - PostgreSQL
  - PostgREST
  - Multiuser
---]

## "Data that should be visible only to me is visible to others"

I'm working on a side project called JobRadar. It's an app that scrapes Australian and New Zealand job listings and matches them with AI, but I initially built it for myself, so I skipped Supabase's Row Level Security (RLS) and used a server-only `service role` client to handle everything.

But the moment I added a second user, things started to go wrong.

- My cover letter is visible on the other user's screen
- I save a note and both users share the same note
- I filtered the list of postings and the other user's postings still showed up.
- Saving a profile overwrites the wrong user data

You get the idea. Today, I'll document the process of fixing these bugs one by one. These are the pitfalls you need to know when building a multi-user app with service roles without RLS.

---

## Background: What is a service role?

There are two main types of Supabase clients.

| Client | Keys | RLS Enforcement | Primary Usage |
|---|------|---|---|---|
| `createClient` (anon key) | `SUPABASE_ANON_KEY` | Applied | Browser, client components |
| `createClient` (service role) | `SUPABASE_SERVICE_ROLE_KEY` | **Ignored** | Server-only, administrator actions |

With RLS, you can enforce policies like `auth.uid() = user_id` at the DB level, so that no matter how badly you structure your queries, you won't leak other user data. Service roles, on the other hand, completely bypass RLS, so the slightest mistake in the query will result in data being mixed.

When you write a server action in Next.js App Router, you naturally use a service role client, and there are more mistakes than you think when you omit the `user_id` filter or apply it incorrectly.

---]

## Pitfall 1: Missing the user_id filter in the cover_letters table

### Problem

The function that stores and retrieves cover letters was querying only `job_id`.

```typescript
// Bug: querying by job_id only → mixing cover letters of all users who applied for the same job
const { data } = await supabaseAdmin
  .from('cover_letters')
  .select('*')
  .eq('job_id', jobId)
  .single()
```

If user A writes a cover letter for a specific job, when user B opens the same job, A's cover letter is displayed.

### Resolved

Added the `user_id` filter to all cover letter related functions (`getCoverLetter`, `saveCoverLetter`, `reviewCoverLetter`).

```typescript
// Fix: lookup by user_id + job_id combination
const { data } = await supabaseAdmin
  .from('cover_letters')
  .select('*')
  .eq('user_id', profile.id)
  .eq('job_id', jobId)
  .single()
```

I also added a UNIQUE constraint to the DB. Without this, `upsert` will create duplicate rows.

```sql
-- Migration 003
ALTER TABLE cover_letters
  ADD CONSTRAINT cover_letters_user_id_job_id_key
  UNIQUE (user_id, job_id);
```

When upserting, this constraint must be specified as `onConflict` criteria.

```typescript
await supabaseAdmin
  .from('cover_letters')
  .upsert(
    { user_id: profile.id, job_id: jobId, content: text },
    { onConflict: 'user_id,job_id' }
  )
```

---]

## Pitfall 2: I had to move a shared column (jobs.memo) to a per-user table

### Problem

When I first created the memo feature, I attached the `memo` column to the `jobs` table. I thought it was okay because I was going to use it alone, but the moment I became a multi-user, I realized that `jobs` is a table shared by all users.

If A saved a memo, B would see the same memo.

### Solved

Move `jobs.memo` to `matches.memo`. The `matches` table is a per-user association table that stores `(user_id, job_id)` pairs anyway. This is the right place to put data that should be user-specific, like memos.

```sql
-- Add a memo column to matches
ALTER TABLE matches ADD COLUMN IF NOT EXISTS memo TEXT;

-- move existing jobs.memo data to matches
UPDATE matches m
SET memo = j.memo
FROM jobs j
WHERE m.job_id = j.id AND j.memo IS NOT NULL;

-- Remove jobs.memo
ALTER TABLE jobs DROP COLUMN IF EXISTS memo;
```

To summarize in terms of data design principles

| Nature of data | Where it's stored |
|---|---|
| Job text, company name, URL, and more | `jobs` (shared) |
| Match scores, application status, notes | `matches` (per user) |
| Cover letter content | `cover_letters` (per user) |

---]

## Pitfall 3: PostgREST INNER JOIN filter is ignored by service role

This one was the most ridiculous.

### Problem

I wanted to separate the list of postings by user, so I JOINed with `matches!inner` and filtered with `.eq('matches.user_id', profile.id)'.

```typescript
// Intent: only jobs in matches + only from that user
const { data: jobs } = await supabaseAdmin
  .from('jobs')
  .select(`
    id, title, company, url,
    matches!inner ( score, reason, status, memo )
  `)
  .eq('matches.user_id', profile.id)
  .order('scraped_at', { ascending: false })
```

When I tested it locally, it worked fine. But when I ran it in the real world, it showed all the other users' posts.

### Cause

The `.eq('matches.user_id', ...)` syntax, which uses a column from a relationship table as a filter in PostgREST, does not work correctly on service role clients. When RLS is on, it automatically attaches the `auth.uid()` context to enforce the filter, but service role doesn't have that context, so the relationship filter is silently ignored.

### Resolved: Separate into a two-step query.

Instead of relying on the relationship filter, we split the query into two steps.

```typescript
// Step 1: Retrieve this user's matches first
const { data: myMatches } = await supabaseAdmin
  .from('matches')
  .select('job_id, score, reason, status, memo')
  .eq('user_id', profile.id)

const matchMap = new Map(myMatches.map(m => [m.job_id, m]))
const jobIds = myMatches.map(m => m.job_id)

// Step 2: Retrieve jobs as a list of job_ids
const { data: jobs } = await supabaseAdmin
  .from('jobs')
  .select('id, title, company, location, salary, url, ...')
  .in('id', jobIds)
  .order('scraped_at', { ascending: false })
```

This ensures that the `user_id` filter on the `matches` lookup works because it's a simple `.eq()`. And by mapping it to a `matchMap`, it's simple to attach the match information to the second query result.

```typescript
const jobList = (jobs ?? []).map((j: any) => {
  const m = matchMap.get(j.id)
  return {
    ...j,
    match_score: m?.score ?? null,
    match_reason: m?.reason ?? null,
    match_status: m?.status ?? 'new',
    memo: m?.memo ?? null,
  }
})
```

Yes, it's one more query, but it's much better than mixing up the data.

---]

## Pitfall 4: Missing MATCHES auto-registration when adding new postings

### Problem

If the `addJobByUrl` function, which adds a job by URL, only upserts to the `jobs` table and does not register with `matches`, then the job will be completely invisible in the aforementioned two-step query.

### Solution.

We added code to register against `matches` immediately after the `jobs` upsert.

```typescript
// upsert to jobs
const { data } = await supabaseAdmin
  .from('jobs')
  .upsert({ url, title, company, ... }, { onConflict: 'url' })
  .select()
  .single()

// add the user to matches (ignore if they already exist)
await supabaseAdmin
  .from('matches')
  .upsert(
    { user_id: profile.id, job_id: data.id, status: 'new' },
    { onConflict: 'user_id,job_id' }
  )
```

Specifying `onConflict: 'user_id,job_id'` ensures that adding the same job again doesn't overwrite any existing application status or notes.

---]

## Pitfall 5: Hardcoding emails into server actions

This is a bit of an embarrassing bug.

### Problem

Early on in development, I set up my profile page like this because "I'm the only one using it anyway".

```typescript
// The actual code looked like this...
const { data: profile } = await supabaseAdmin
  .from('profiles')
  .select('*')
  .eq('email', 'hyunseok.yu1@gmail.com') // hardcoded
  .single()
```

The same was true for the profile save action.

```typescript
// Save also filters by email
.eq('email', email) // Even though email is fetched from the session
```

Filtering on the `email` column is also problematic: emails can change, and `id` (UUID) is a much more stable identifier.

### Solved

Modified to dynamically retrieve the email of the logged in user and filter by `id` instead of email.

```typescript
// profile/page.tsx
const email = await getAuthUserEmail()
if (!email) redirect('/login')

const profile = await getOrCreateProfile(email)
```

```typescript
// profile/actions.ts
const profile = await getOrCreateProfile(email)
if (!profile) return { error: 'Profile not found' }

await supabaseAdmin
  .from('profiles')
  .update({ ... })
  .eq('id', profile.id) // change to email → id
```

---]

## Summary: Checklist for isolating data in service role apps

If you are creating a multi-user app with a service role without using RLS, you must check the following items.

**DB design phase**.
- [ ] Store per-user data in a table with a `user_id` column (or a per-user association table)
- [ ] Never put user-specific data (`memo`, `status`, etc.) in a shared table (like `jobs`)
- [ ] Add a `UNIQUE(user_id, other_key)` constraint to the per-user table to make upsert safe

**Steps for writing queries
- [ ] Check `.eq('user_id', profile.id)` filter on all get/modify queries
- [ ] PostgREST relationship filter ( `.eq('relationship table.user_id', ...)` does not work for service role → replace with 2-step query
- [ ] also register with association tables (`matches`, etc.) when creating new data

**Code steps**.
- [ ] never hardcode email-username
- [ ] Always identify user by UUID `id` of session
- [ ] Handle `/login` redirect when not logged in

---]

In fact, it's a good idea to use RLS from the start. However, when you focus on server actions, it's easy to make mistakes like this because you're comfortable with service roles. I'm glad that I'm catching them one by one now.

Next time I start a new Supabase project, I'll probably start with RLS enabled from the beginning. Or at least I'll keep this checklist handy.
