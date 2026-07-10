---
title: "Job Sites Where Link Copying Doesn't Work? Solved With a Manual Card-Add Feature"
date: '2026-06-26'
publish_date: '2026-07-19'
description: A record of building a feature to manually enter and create a card for job postings blocked from URL scraping, using Next.js Server Actions
tags:
  - Next.js
  - Server Actions
  - Supabase
  - TypeScript
---

Building a side project (JobRadar) that collects and manages job postings, I initially thought "just paste in the URL and it scrapes automatically" was flow enough. Paste a posting page link into an input, and the scraper would grab the title, company, location, and immediately feed into AI matching.

But after using it for a few days, reality was a bit different.

## Why "manual add" turned out to be necessary

The problem was that surprisingly many sites **don't let you copy a link at all.**

- A company's own careers page has no unique URL per posting — content just swaps out on one page via JavaScript
- A posting only shows up after logging in, so pasting the URL in just gets the scraper a login page
- Sites like LinkedIn or Indeed have aggressive bot blocking, so scraping keeps failing
- Sometimes a recruiter just sends you the JD text directly, over email or a messaging app

Postings like these simply can't get registered through the URL-based flow at all. Clearly a posting I want to apply to, but no way to add it to my management board. So I decided to add a **"manual add" feature that creates a card by hand, without a URL.**

The core requirements were simple.

1. A card should be created even with just a job title, no URL
2. If a JD (job description body) is pasted in alongside it, AI matching should still run automatically, same as before
3. Touch the existing data structure as little as possible

## Prep: understanding the existing structure

Since the `addJobByUrl` server action for URL-based adding was already working fine, following the same pattern for the new feature seemed like the safe bet. The data flow looked like this.

- `jobs` table: the posting itself (title, company, location, url, source, description ...)
- `matches` table: the "this user saved this posting" link (user_id, job_id, status)

One thing tripped me up here. The `jobs.url` column was **unique and not null.** Naturally designed that way since it's a URL-based dedup structure, but trying to insert "a posting with no URL" ran straight into this constraint.

## Step 1. Getting around the constraint with a synthetic URL

Changing the table schema needs a migration, and it would affect the existing dedup logic too. So I chose to **leave the schema alone, and assign a fake (synthetic) URL to manually-added postings.**

```ts
// The url column is unique and required, so manually entered postings get a synthetic URL.
const syntheticUrl = `manual://${globalThis.crypto.randomUUID()}`
```

I attached the `manual://` scheme for two reasons.

- `crypto.randomUUID()` produces a different value every time, so it **naturally passes the unique constraint**
- Later, it's easy to **filter out manually-added postings specifically**, with something like `WHERE url LIKE 'manual://%'`

`globalThis.crypto` is directly usable with no separate import on Node 19+ / modern Next.js runtimes, which was convenient.

## Step 2. Writing the server action

Now the main piece — the `addJobManually` server action. Just add one function to a file with `'use server'` declared. Receives form data → validates → inserts into `jobs` → links via `matches` → runs matching if a JD is present.

```ts
'use server'

export async function addJobManually(
  formData: FormData
): Promise<{ jobId?: string; matched?: boolean; score?: number; error?: string }> {
  const email = await getAuthUserEmail()
  if (!email) return { error: 'Login required.' }

  const title = (formData.get('title') as string)?.trim()
  const company = (formData.get('company') as string)?.trim() ?? ''
  const location = (formData.get('location') as string)?.trim() ?? ''
  const description = (formData.get('description') as string)?.trim() ?? ''

  if (!title) return { error: 'Please enter a job title.' }

  const profile = await getOrCreateProfile(email)
  if (!profile) return { error: 'Profile not found' }

  // The url column is unique and required, so manually entered postings get a synthetic URL.
  const syntheticUrl = `manual://${globalThis.crypto.randomUUID()}`

  const { data, error } = await supabaseAdmin
    .from('jobs')
    .insert({
      url: syntheticUrl,
      source: 'other',
      title,
      company,
      location,
      description: description || null,
      scraped_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  // Link it to this user's board
  await supabaseAdmin
    .from('matches')
    .upsert(
      { user_id: profile.id, job_id: data.id, status: 'new' },
      { onConflict: 'user_id,job_id' }
    )

  // Match immediately if a JD is present
  let matched = false
  let score: number | undefined
  if (description) {
    const matchRes = await matchSingleJob(data.id)
    if (!matchRes.error && matchRes.score !== undefined) {
      matched = true
      score = matchRes.score
    }
  }

  revalidatePath('/')
  return { jobId: data.id, matched, score }
}
```

A few points worth noting.

| Part | Intent |
|---|---|
| Starts with `getAuthUserEmail()` | dynamically verifies the logged-in user. No email/ID baked into the code |
| Only `title` is required | company, location, JD can be left blank and still create a card |
| `description \|\| null` | stores an empty string as null instead, clearly signaling "no JD" |
| `matches` uses `upsert` | safe even if the same user-posting combination is duplicated |
| Matching only if `description` exists | avoids wastefully calling AI with an empty JD |
| `revalidatePath('/')` | refreshes the list page cache right after adding |

I included `matched` and `score` in the return type too, so the frontend can tell "did matching also finish."

## Step 3. Building the input modal

With the server ready, next is the input UI. There was already a modal for pasting in a JD (`JdInputModal`), so I built `AddJobManualModal` in the same tone. As a client component, it just manages form state and calls the server action on submit.

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addJobManually } from '@/app/actions'

export default function AddJobManualModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'matching'>('idle')
  const [error, setError] = useState('')

  const busy = status !== 'idle'

  async function handleSubmit() {
    if (!title.trim() || busy) return
    setError('')
    setStatus('saving')

    const fd = new FormData()
    fd.append('title', title.trim())
    fd.append('company', company.trim())
    fd.append('location', location.trim())
    fd.append('description', description.trim())

    if (description.trim()) setStatus('matching')
    const res = await addJobManually(fd)
    setStatus('idle')

    if (res.error) { setError(res.error); return }

    router.refresh()  // re-render the server-component list
    onClose()
  }

  // ...renders input fields (title/company/location/JD) + buttons
}
```

The reason for bundling values with `FormData` was to match the existing convention where the server action reads values via `formData.get(...)`. Calling `router.refresh()` after a successful submit re-renders the server-component job list to include the new card.

One small detail — I changed the button label depending on whether a JD is present.

```tsx
<button onClick={handleSubmit} disabled={!title.trim() || busy}>
  {description.trim() ? 'Add & Match' : 'Add Card'}
</button>
```

If a JD is entered, it shows "Add & Match"; if not, "Add Card" — so users know upfront what's about to happen.

## Step 4. Adding the entry-point button

Finally, I put a "Manual Add" button next to the existing URL input form (`AddJobForm`), which opens the modal on click.

```tsx
<button
  type="button"
  onClick={() => setManualOpen(true)}
  className="text-sm border border-zinc-200 text-zinc-600 px-4 py-2.5 rounded-lg ..."
>
  Manual Add
</button>

<p className="text-xs text-zinc-400 mt-1.5">
  If you can't copy a link from a site,{' '}
  <button onClick={() => setManualOpen(true)} className="underline">add it manually</button>
  {' '}instead.
</p>

{manualOpen && <AddJobManualModal onClose={() => setManualOpen(false)} />}
```

I added a short hint below the button too. A feature the user never discovers is as good as not existing. A single line pointing straight at context — "use this if you can't copy a link" — turned out more important than expected.

## The full flow at a glance

```
Click [Manual Add]
        │
        ▼
[Modal] enter title (required) / company / location / JD
        │
        ▼  handleSubmit → FormData
[addJobManually] server action
        │
        ├─ verify login + validate title
        ├─ assign a manual://<uuid> synthetic URL
        ├─ INSERT into jobs
        ├─ UPSERT into matches (link to my board)
        └─ if JD present → matchSingleJob (AI matching)
        │
        ▼
router.refresh() → new card appears in the list
```

## Troubleshooting: what I ran into

- **`url` unique constraint collision**: inserting an empty string or fixed value collides starting from the second posting. Solved by generating a different value every time with `crypto.randomUUID()`.
- **Wasted AI calls on an empty JD**: I originally ran matching unconditionally, but with no JD there's no basis for matching — just burning cost. Branched with an `if (description)` condition.
- **List doesn't update after adding**: a list rendered as a server component doesn't see client state, so you need both `revalidatePath` (server) and `router.refresh()` (client) for the new card to show up immediately.
- **Empty string vs. null**: storing `company` or `description` as an empty string makes "does it have a value" ambiguous later. I explicitly nulled the JD with `description || null`.

## Summary

Relying too heavily on the "automation" of URL scraping created a blind spot — postings automation just couldn't handle, with no way to save them. In the end, it got solved by **opening up one escape hatch for humans to enter data manually.**

Things reconfirmed by this work:

1. **Cloning an existing, well-working pattern** cuts risk dramatically (`addJobByUrl` → `addJobManually`).
2. **Work around a schema constraint if you can** — one line of synthetic URL avoided a migration entirely.
3. The **Server Action + `FormData`** combo handles form processing with no bloat.
4. As much as the feature itself, **a one-line hint saying "it's here"** matters.

Somewhere automation doesn't reach, a manual-input safety net turns out to be necessary — a lesson that might sound obvious in hindsight, but this was a piece of work that carved it into code once more.
