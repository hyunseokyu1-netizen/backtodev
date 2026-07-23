---
title: 'Building a SaaS With an AI Coding Assistant (2): The Day the AI Deleted My Account'
date: '2026-07-04'
publish_date: '2026-08-01'
description: An incident where a hidden filter bug in the Supabase admin API led my AI coding assistant to delete a real user account, and the DB safety rules I put in place afterward
tags:
  - Supabase
  - Claude Code
  - Incident Response
  - DB Safety
  - SaaS
---

## Starting off

In the last part, I wrote about cleaning up MatchDa's URL structure and job-discovery flow. This part is a record of a far more harrowing incident that happened within the same session.

Short version — **a script my AI coding assistant ran to "clean up test accounts" deleted my actual account, entirely.** My profile, matching records (matches), registered career pages (job_sources), and every tailored resume I'd built up (tailored_resumes) — all gone. It was a Free-tier Supabase project, so backup restoration wasn't even an option.

I'm writing this up specifically because I want to answer "should you trust an AI with DB operations?" with a real case study. The answer is "yes, but how matters a lot."

## What happened

Partway through the session, I needed to clean up dummy test accounts. Temporary users created while testing the signup flow had piled up in Supabase Auth, and the goal was to remove them.

The method used here was the problem. It looked up a specific user by filtering on email through the Supabase (GoTrue) admin REST API, then deleted them.

```
GET /auth/v1/admin/users?email=testaccount@example.com
```

There was a fatal trap here. **This endpoint effectively ignores the `email` query parameter and just returns the full, paginated user list.** Query with an email that doesn't even exist, and you still get the first user in the list. It looks like a filtered result on the surface, but it isn't.

As a result, the user at index `[0]` in the list was mistaken for the "test account," and the delete API was called on it — and that `[0]` happened to be my own real, in-use account. When a user is deleted from Supabase Auth, every table wired to it via a foreign key — `profiles` first, then `matches`, `job_sources`, `tailored_resumes` — got cascade-deleted along with it.

The one saving grace was that the shared `jobs` table (company/posting data, not tied to any specific user) — 319 rows — survived. This later became the thread that recovery hung on.

## Digging into the cause

Right after the incident, I didn't jump straight into recovery — I first confirmed **why this was even possible.** Recovering without preventing a recurrence wouldn't have meant much.

Retesting Supabase's admin user-lookup API behavior made it obvious.

```
GET /auth/v1/admin/users?email=aaaaaaa-nonexistent-email@example.com
```

Even this request returned a 200 OK along with a list of users. The `email` parameter wasn't acting as a filter at all. In other words, there was no field in this API's response you could trust as "the user with this specific email" — the response was effectively "some page of the full user list."

The mistake was not knowing this and trusting `[0]` as "the account I was looking for." In code, the mistake looked like this.

```ts
// wrong assumption — believing the email filter actually works
const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${targetEmail}`, {
  headers: adminHeaders,
})
const { users } = await res.json()
await deleteUser(users[0].id) // since the filter didn't work, this was "some arbitrary user"
```

## The recovery process

Fortunately, there was a thread to pull.

1. **The shared `jobs` table wasn't tied to any user, so it survived.** All 319 rows of raw job-posting data — company names, titles, descriptions — remained intact.
2. What was deleted was "the link between my account and jobs" (`matches`, `job_sources`, `tailored_resumes`) and "my profile" (`profiles`).

The recovery strategy was:

- Log back in and let the profile get recreated (the existing `getOrCreateProfile` logic handled this automatically)
- Re-link the surviving `jobs` data to the account, so that at least "the posting pool" didn't need to be re-collected from scratch
- Accept that what's gone (previously built tailored resumes, application status history, personal profile info) can't be recovered, and refill it manually

So this wasn't a full recovery. **Only the read-only shared data was recovered; the user's personal data (resumes, application history) was permanently lost.** At this point, what mattered most wasn't recovery technique but **reporting the incident transparently**, without hiding it. Only after clearly establishing "what disappeared and why" and "what can and can't be recovered" was there any basis for trust to keep working with the AI going forward.

## Preventing a recurrence: the rules I set

After this incident, I explicitly established two rules and registered them in the AI assistant's memory as mandatory.

**Rule 1 — DB deletes are absolutely forbidden; all DB operations require prior approval.**

```
Regarding the production DB (Supabase):
1. Never perform a delete (DELETE) — forbidden even for the purpose of cleaning up test data.
2. Every DB-related operation (INSERT/UPDATE/DELETE, storage, admin API, etc.),
   even in bypass-permission mode, must always be run only after asking the user
   and getting explicit approval beforehand.
```

The key phrase is "even for the purpose of cleaning up test data." Because the incident started from exactly the judgment call of "this is just test data, so it's probably fine to delete." Even with the AI assistant granted bypass permission, I drew a hard line: delete and write operations require human confirmation with no exceptions.

**Rule 2 — Never trust the admin API's email filter.**

```
GET /auth/v1/admin/users?email=X ignores the email query filter and
returns the full, paginated user list.
```

When a specific user needs to be pinpointed exactly, the agreed order is:

```
1. Look up profiles?email=eq.X via REST → get the exact profile row
2. Grab that row's id (UUID)
3. From then on, target every operation by UUID only — never by email
```

## Troubleshooting checklist

For anyone who might run into a similar situation, here's a checklist worth going through when doing user-related admin operations on Supabase (or a similar BaaS).

| Item to check | How to verify |
|---|---|
| Does the admin API's query filter actually work? | Query with a nonexistent value and confirm you get an empty array back |
| Is the delete target specified by an exact PK (UUID, etc.)? | Never target by an imprecise key like email or name |
| Do you know the scope of cascade deletes? | Check ahead of time which tables have `ON DELETE CASCADE` on their foreign keys |
| Can you dry-run (query-only) before deleting? | Make delete scripts SELECT the target list first, for a human to confirm |
| Is backup/PITR enabled? | Recognize that Free-tier plans mostly have no backup, or a limited one |

## Summary

I took away one technical lesson and one attitude lesson from this incident.

1. **Never assume a BaaS admin API's filter "probably works" just from reading the docs.** You need the habit of actually testing with a nonexistent value to verify you get an empty result. As in this case, filters really can be silently ignored while a 200 OK returns the wrong data anyway.
2. **The more delegated permission you give an AI coding assistant, the stricter your prior-approval process needs to be for delete/write operations.** The judgment call "it's just test data, so it's probably fine" is exactly where the incident started. Setting a rule that clearly treats reads (SELECT) as a different tier from writes/deletes prevents the same mistake from repeating.

Above all, what mattered most at the moment of the incident wasn't fast recovery — it was **transparent reporting.** Clarifying up front what was lost and what could be recovered was the bare minimum condition for being able to keep working with the AI afterward.

Next up: the feature work that continued past this incident — automatic resume analysis and RAG-based tailored resume generation.
