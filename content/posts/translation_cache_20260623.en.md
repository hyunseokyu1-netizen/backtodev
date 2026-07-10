---
title: "I Was Calling the Translation API Every Single Time — Caching Translations in the DB"
date: '2026-06-23'
publish_date: '2026-07-09'
description: Eliminating the waste of re-translating the same content every time a modal opens, by caching it in the DB — plus the pattern for invalidating the cache when the source text changes
tags:
  - Supabase
  - Next.js
  - PostgreSQL
  - Claude API
---

## Intro: "wait, isn't this translating every time?"

JobRadar, which I've been building lately, has a **tailored resume** feature. It generates an English resume matched to a job posting (JD), and shows a **Korean translation (for reference)** panel next to it. Since an English resume doesn't always click instantly, showing the Korean version alongside is meant as a reference.

But looking back over the code, a suspicion crossed my mind.

> "Isn't this translation getting re-fetched every time the modal opens?"

Checking confirmed exactly that. Clicking the translate button fetches a translation from the Claude API, but the result was **stored nowhere** — only held in screen state (`useState`). Close the modal and reopen it, and the translation is gone, requiring another button press to **translate the exact same content again.**

API calls aren't free. They cost money, take time, and force the user to click a button every single time. "If we've translated it once, save it" was such an obvious line that had simply been missed.

This post is a record of **caching that translation result to the DB.** It sounds like a minor task, but it captures the fundamental question at the heart of caching — "when do you invalidate it?"

## First, understanding the current structure

Before adding caching, I looked at the existing flow.

The server action handling translation looked like this.

```ts
// Only translates, never saves — just returns the result
export async function translateTailoredResume(content: string) {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 3000,
    messages: [{ role: 'user', content: `Translate the following English resume into Korean...\n\n${content}` }],
  })
  const translation = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  return { translation }   // ← returned directly, no DB save
}
```

Looking closely, the only argument is `content` (the English text). **It doesn't even take which job posting (jobId) this is a translation for.** Even if you wanted to save it, there was no way to specify where to save it to.

There was a separate table storing the resume body.

```sql
-- tailored_resumes: stores only the English resume
CREATE TABLE tailored_resumes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  job_id      UUID NOT NULL,
  content     TEXT,           -- the English resume
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, job_id)
);
```

This only had `content` (English), with no column to hold a translation. So it had no choice but to re-translate every time.

## Cache design: the key is "when do you throw it away"

Caching isn't done the moment you save something. **Knowing when a saved value is no longer valid and discarding it** is part of the same package. Otherwise, you edit the English resume, and the translation stays exactly as it was — the two panels start saying different things.

So I set the rule like this.

| Action | Translation cache handling |
|------|----------------|
| Click the translate button | call the API → **save to DB** |
| Reopen the modal | **load from DB** (no re-translation) |
| Generate / edit / save English content | **invalidate** the cache (set to `null`) → needs re-translation |

In other words, the core is clearing the translation cache at **every point where the English content changes.**

## Step 1. Making a column to hold the translation (migration)

First, add a `translation` column to the table.

```sql
-- 009_add_translation_to_tailored_resumes.sql
ALTER TABLE tailored_resumes
  ADD COLUMN IF NOT EXISTS translation TEXT;
```

Added `IF NOT EXISTS` to make it safely idempotent even if run multiple times. Migrations often end up running twice, so it's good habit to build in safeguards like this.

> If you're using Supabase, you can just paste this SQL into the dashboard's SQL Editor and run it. You could use the CLI (`supabase db push`) too, but for adding one column, the dashboard is faster.

## Step 2. Fixing the translation action to save

Now `translateTailoredResume` takes a `jobId` and saves the translation result to the DB.

```ts
export async function translateTailoredResume(jobId: string, content: string) {
  if (!content.trim()) return { error: 'There is nothing to translate.' }

  // Verify the logged-in user (always dynamically)
  const email = await getAuthUserEmail()
  if (!email) return { error: 'Login required.' }
  const profile = await getOrCreateProfile(email)
  if (!profile) return { error: 'Profile not found' }

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 3000,
    messages: [{ role: 'user', content: `Translate the following English resume into Korean...\n\n${content}` }],
  })
  const translation = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  if (!translation) return { error: 'Translation failed. Please try again.' }

  // Save the translation alongside the current English content → reused as-is on revisit
  const { error } = await supabaseAdmin
    .from('tailored_resumes')
    .upsert(
      { user_id: profile.id, job_id: jobId, content, translation, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,job_id' }
    )
  if (error) return { error: error.message }

  return { translation }
}
```

Two points here.

1. **Changed the signature to accept `jobId`.** You need to know "which row" to save into.
2. **Save `content` and `translation` together.** Storing the English text as of the translation moment too gives you something to judge "does this translation still match the current English content" against later.

## Step 3. Clearing the cache when English content changes

The most important part. There were three places where the English resume changes — **generation / AI revision / manual editing then saving.** All three now write `translation: null` alongside.

```ts
// On resume generation/revision/save — invalidate the translation cache since English changed
await supabaseAdmin.from('tailored_resumes').upsert({
  user_id: profile.id,
  job_id: jobId,
  content,
  translation: null,   // ← invalidate the cache
  updated_at: new Date().toISOString(),
}, { onConflict: 'user_id,job_id' })
```

This one line (`translation: null`) is the safety pin of the whole caching logic. Skip it, and you get the worst-case bug: "English is new content, translation is old content."

## Step 4. Fetching the translation alongside on read

The lookup function called when the modal opens now also returns `translation`.

```ts
export async function getTailoredResume(jobId: string) {
  // ... auth/profile check ...
  const { data } = await supabaseAdmin
    .from('tailored_resumes')
    .select('content, translation')   // ← added translation
    .eq('job_id', jobId)
    .eq('user_id', profile.id)
    .single()
  return {
    content: data?.content ?? undefined,
    translation: data?.translation ?? undefined,
  }
}
```

## Step 5. Frontend: loading it on open

Finally, when the modal first opens, if a saved translation exists, fill it into the screen right away.

```tsx
useEffect(() => {
  getTailoredResume(jobId).then(res => {
    if (res.content) {
      setContent(res.content)
      setSavedContent(res.content)
    }
    if (res.translation) setTranslation(res.translation)  // ← restore the cached translation
    setState('idle')
  })
}, [jobId])
```

And the translate button handler now passes `jobId` along too.

```tsx
const res = await translateTailoredResume(jobId, content)
```

The flow is now complete. **Translate once, it saves to the DB, and closing and reopening the modal shows the translation right away — no button press needed.**

## Troubleshooting: how I verified it

Assuming "this should just work" is exactly when things go wrong. So before deploying the code, I checked two things.

**1) Build/type check**

```bash
npx tsc --noEmit   # 0 type errors
npm run build      # compiled successfully
```

Since I changed the function signature (`content` → `jobId, content`), the type checker catches whether every call site was updated. This is exactly why TypeScript is worth using.

**2) DB-level round-trip test**

Instead of clicking through the UI, I queried the DB directly with the service role key to non-destructively confirm "save → read → invalidate" round-tripped correctly.

```
✅ 1) translation column exists and is queryable
✅ 2) translation save → read round-trip succeeded (caching works)
✅ 3) translation invalidation (null) works when English content changes
🧹 4) cleaned up the test row
```

The row inserted for testing was deleted afterward without fail, leaving no trace in the actual data.

## Summary: caching is "save + invalidate" as one package

This work at a glance:

1. **Made a column** — added a `translation TEXT` column (idempotent migration)
2. **Saved it** — the translation action takes `jobId` and upserts the result
3. **Discarded it** — invalidates to `translation: null` at every point where English content changes
4. **Fetched it** — returns the translation alongside on lookup, restored when the modal opens
5. **Verified it** — confirmed via type/build check + DB round-trip

The work itself was one column and a few lines of code, but the real core was **"when do you throw away the cache."** Save without ever invalidating, and caching stops being a performance improvement and becomes a bug instead. "Once English content changes, the translation is no longer valid" — turning that one sentence into code was the entirety of this task.

Noticing one small missing line and filling it in. Getting back into development, what I've noticed most is that reducing these small gaps, more than flashy features, is what real skill looks like.
