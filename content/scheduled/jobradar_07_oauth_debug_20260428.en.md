---
title: '[JobRadar Part 7] Google OAuth "Database error" — Down the Supabase Trigger Rabbit Hole'
date: '2026-04-28'
publish_date: '2026-05-24'
description: Google login kept failing with "Database error saving new user" — I dug all the way to creating a new Supabase project before finding the fix was one line in a trigger function
tags:
  - JobRadar
  - Supabase
  - OAuth
  - Debugging
  - SideProject
---

I added login and deployed. Email worked. But clicking the Google button kept bouncing back to the login page.

No error message on the page. Just `#error=server_error&error_description=Database+error+saving+new+user` in the URL. And since the page refreshed, even `console.log` was gone.

This is the story of how chasing that one error led me to create a new Supabase project, install psql, poke at the Management API — and ultimately end with a one-line fix in a trigger function.

---

## Full Debugging Timeline

```
Email login → hasSession: false
  → Turn off Confirm email → fixed

Google login → "Database error saving new user"
  → Suspected confirmation_token bug
  → SQL Editor: permission denied (auth.users owned by supabase_admin)
  → psql / CLI / Management API: permission denied or IPv6 failure
  → Created new Supabase project → same error
  → Checked column state via Management API → confirmation_token is fine
  → Found trigger function → SET search_path missing → fixed
```

---

## Step 1 — Logging to localStorage

Since `console.log` disappears with page navigation, I wrote results to localStorage instead:

```typescript
const { data, error } = await supabase.auth.signInWithPassword({ email, password })
localStorage.setItem('__login_debug__', JSON.stringify({
  error: error?.message ?? null,
  hasSession: !!data.session,
  userEmail: data.user?.email ?? null,
}))
```

Found `hasSession: false` for email login. Login succeeded but there was no session, so the middleware sent it back to `/login`.

**Symptom**: Login succeeds but session is null  
**Cause**: Account hasn't completed email verification → `signInWithPassword` succeeds but returns null session  
**Fix**: Supabase → Authentication → Email → turn off "Confirm email"

Email fixed. But Google still got `Database error saving new user`. Different problem.

---

## Step 2 — Suspecting the confirmation_token Bug

My first guess was the well-known Supabase `confirmation_token` bug. The `confirmation_token` column in `auth.users` has a NOT NULL constraint but no DEFAULT, so when OAuth tries to insert a new user with NULL, it fails.

The fix would be:

```sql
ALTER TABLE auth.users ALTER COLUMN confirmation_token SET DEFAULT '';
```

But running this in Supabase SQL Editor:

```
ERROR: 42501: must be owner of table users
```

`auth.users` is owned by `supabase_admin` — `postgres` can't touch it.

---

## Step 3 — Trying Every Connection Method

| Method | Result |
|--------|--------|
| Supabase SQL Editor | Permission denied |
| psql direct connection | IPv6 only, No route to host |
| Supabase CLI `db query` | Same IPv6 connection failure |
| Session Pooler (IPv4) | Connected but permission denied |
| Management API (`api.supabase.com`) | Permission denied |

Learned here that `supabase_admin` permissions are only accessible at the Supabase infrastructure level.

---

## Step 4 — Creating a New Supabase Project

Thought maybe the existing project's schema was corrupted. Created a fresh project, consolidated all the migration files, and ran them at once in SQL Editor.

```sql
-- merged schema.sql + migration files
CREATE TABLE profiles ( ... );
CREATE TABLE jobs ( id UUID, ..., memo TEXT, ... );
CREATE TABLE matches ( ... );
CREATE TABLE cover_letters ( ... );
-- RLS policies...
```

Updated `.env.local` and Vercel env vars to the new project keys and redeployed.

But **same error**. New project, same problem. That's when I started to think `confirmation_token` might not be the actual cause.

---

## Step 5 — Checking Column State via Management API

Verified whether `confirmation_token` was actually the issue:

```bash
curl -X POST "https://api.supabase.com/v1/projects/{ref}/database/query" \
  -H "Authorization: Bearer {PAT}" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT column_name, is_nullable FROM information_schema.columns WHERE table_schema = '\''auth'\'' AND table_name = '\''users'\'' AND column_name = '\''confirmation_token'\''"}'
```

Result: `is_nullable: YES`

**The `confirmation_token` bug wasn't the issue.** New projects already have it nullable. Three hours wasted in the wrong direction.

---

## Step 6 — Finding the Trigger, Finding the Real Cause

Checked the triggers:

```sql
SELECT trigger_name FROM information_schema.triggers WHERE trigger_schema = 'auth';
-- result: on_auth_user_created
```

Looked at the trigger function:

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;
```

The problem: no `SET search_path`. A `SECURITY DEFINER` function runs with the function owner's privileges, but without `search_path` set, it doesn't know which schema to look for `profiles` in. This works locally because the default search_path happens to be right — but it breaks specifically in production OAuth flows.

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
```

Two changes:
1. `SET search_path = public` — explicitly find `profiles` in the public schema
2. `ON CONFLICT (id) DO NOTHING` — handle duplicate users gracefully

Updated the function via Management API → tried Google login → success.

---

## Also Fixed Mobile Responsive Layout

While debugging OAuth, I noticed the UI breaking on mobile and cleaned that up too.

**AddJobForm** — input + button overflowing horizontally on mobile

```tsx
// before: flex gap-2
// after: stack vertically on mobile
<form className="flex flex-col sm:flex-row gap-2">
```

**JobList cards** — action buttons overlapping with content on the left

```tsx
// group buttons below content
<div className="flex items-center gap-2 mt-2.5 flex-wrap">
  <button>JD Input</button>
  <button>Memo</button>
  <button>Cover Letter</button>
</div>
// only view/delete on the right
<div className="flex items-center gap-1.5 shrink-0">
  <a>View →</a>
  <button>✕</button>
</div>
```

**ProfileForm** — salary input field clipping with fixed width

```tsx
// before: className="input w-36"
// after: className="input flex-1 min-w-0"
```

---

## Troubleshooting

**"Database error saving new user" might be a trigger failure**

GoTrue returns this error in two cases: `auth.users` INSERT itself failing, or the trigger function that runs after it failing. Both produce the same message.

**Fix**: Check for trigger existence in `information_schema.triggers` first, then inspect the function body.

**Missing SET search_path in a SECURITY DEFINER function**

A `SECURITY DEFINER` function without `SET search_path` can fail to find the schema in production even when it works locally — because the default search_path happens to match locally but not in the production OAuth context.

**Fix**: Add `SET search_path = public` to the function declaration. Also explicitly schema-qualify table references like `public.profiles`.

**Can't modify the Supabase auth schema directly**

SQL Editor, psql, CLI, and Management API all lack DDL permissions on `auth.users` — it's owned by `supabase_admin`. Only the Supabase infrastructure level can touch it.

**Fix**: Stop trying to modify the `auth` schema directly. Validate first whether that's actually the cause.

---

## Summary — The Core Flow

```
Click Google login button
        ↓
Select Google account
        ↓
Supabase GoTrue: INSERT new user into auth.users
        ↓
on_auth_user_created trigger fires
  → handle_new_user() called
  → [before fix] no search_path → can't find profiles table → error
  → [after fix] SET search_path = public → profiles INSERT succeeds
        ↓
/auth/callback → session exchange → dashboard ✅
```

The root cause was one line in the trigger declaration. Three hours of `confirmation_token`, psql connections, new project creation — all of it. The lesson: don't take error messages at face value. "Database error saving new user" looked like a user save failure. It was actually the subsequent trigger failing.

Next post: building the job detail page (`/jobs/[id]`) — the full JD, match results, and cover letter all in one view.

---

*JobRadar series*
- [Part 1: Next.js + Supabase Project Setup](/posts/jobradar_01_setup_20260420)
- [Part 2: Supabase Schema + Playwright Scraper](/posts/jobradar_02_scraper_20260421)
- [Part 3: Deploying Playwright to Vercel Blew Up](/posts/jobradar_03_vercel_playwright_20260422)
- [Part 4: Ditched Playwright for cheerio](/posts/jobradar_04_url_scraper_20260423)
- [Part 5: On-demand Pipeline Complete](/posts/jobradar_05_coverletter_pipeline_20260424)
- [Part 6: Cover Letters + Auth](/posts/jobradar_06_auth_ux_20260427)
- **Part 7: Google OAuth Debugging (current)**
