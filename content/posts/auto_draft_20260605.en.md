---
title: 'Managing My Application History in Code — Storing Submitted Resumes + Auto-Logging Application Dates'
date: '2026-06-05'
publish_date: '2026-06-21'
description: How I used Next.js Server Actions and Supabase to attach a submitted resume and application date directly to each job card
tags:
  - Next.js
  - Supabase
  - Server Actions
  - TypeScript
  - SideProject
---

## "Wait, which resume did I send for this one?"

Applying to jobs abroad means ending up with several resume versions — a backend-focused one, a fullstack one, one that leans into seniority... and each job posting gets a slightly different version.

The problem shows up a month later when an interview request lands. You definitely applied to this posting, but which version did you send? Digging through local folders, searching email... a genuine waste of time.

[JobRadar](https://github.com/your-repo) is a side project that scrapes job postings, runs AI matching, and generates cover letters. Today I added two features to it.

1. **Upload and store the resume you actually submitted, attached to the job card**
2. **Automatically log the application date and show it as days elapsed**

---

## The overall flow

Before wiring up the feature, I sorted out the data structure first. The `matches` table already stored the job-user relationship, so I just added two columns.

```sql
-- 006: submitted resume
ALTER TABLE matches
  ADD COLUMN applied_resume_text    TEXT,
  ADD COLUMN applied_resume_filename TEXT;

-- 007: application date
ALTER TABLE matches
  ADD COLUMN applied_at TIMESTAMPTZ;
```

Simple. I don't store the original resume file — only the **extracted text**. Being able to answer "which skills did I emphasize for this one?" later is enough; the raw file isn't necessary.

---

## Step 1. Resume upload — writing the Server Action

A Server Action that takes a file, converts it to text, and saves it to the DB.

```ts
// src/app/actions.ts

export async function uploadAppliedResume(
  formData: FormData
): Promise<{ text?: string; error?: string }> {
  const email = await getAuthUserEmail()
  if (!email) return { error: 'Login required.' }

  const file = formData.get('resume') as File | null
  const jobId = formData.get('jobId') as string

  if (!file || file.size === 0) return { error: 'Please select a file.' }
  if (file.size > 5 * 1024 * 1024) return { error: 'File size must be 5MB or less.' }

  const profile = await getOrCreateProfile(email)
  if (!profile) return { error: 'Profile not found' }

  const text = await parseResumeFile(file)   // PDF/DOCX → text
  if (!text) return { error: 'Could not extract text from the file.' }

  const { error } = await supabaseAdmin
    .from('matches')
    .update({
      applied_resume_text: text,
      applied_resume_filename: file.name,
    })
    .eq('user_id', profile.id)
    .eq('job_id', jobId)

  if (error) return { error: error.message }

  revalidatePath('/')
  return { text }
}
```

The core is that one line, `parseResumeFile(file)`. PDFs go through `pdf-parse`, DOCX through `mammoth`, to extract text. I reused this parser from an earlier feature that auto-extracts a profile from a resume.

> **Watch out:** `supabaseAdmin` bypasses RLS, so you must explicitly add `.eq('user_id', profile.id)`. Skip it, and you risk overwriting another user's data.

---

## Step 2. The upload modal — the AppliedResumeModal component

The UI has three states.

| State | Shown |
|------|-----------|
| No resume | "Choose file" button + hint text |
| Uploaded | Filename + "Replace file" button + "View text" toggle |
| Uploading | Disabled "Uploading..." state |

```tsx
// src/components/AppliedResumeModal.tsx (core logic)

async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0]
  if (!file) return

  setUploading(true)
  const fd = new FormData()
  fd.append('resume', file)
  fd.append('jobId', jobId)

  const result = await uploadAppliedResume(fd)
  setUploading(false)

  if (result.error) {
    setError(result.error)
  } else {
    setFilename(file.name)
    setText(result.text ?? '')
    onUploaded(file.name, result.text ?? '')  // reflect immediately in the parent component
  }
}
```

The text view is handled with a collapse/expand toggle, since keeping the full resume text always expanded would make the card way too tall.

```tsx
{text && (
  <>
    <button onClick={() => setShowText(p => !p)}>
      {showText ? '▲ Hide text' : '▼ View text'}
    </button>
    {showText && (
      <textarea readOnly value={text} className="..." />
    )}
  </>
)}
```

---

## Step 3. Auto-logging the application date

When the status flips to `applied`, the date gets stamped automatically. If `applied_at` already exists, it's not overwritten — this preserves any manual date edits.

```ts
// src/app/actions.ts

export async function updateMatchStatus(
  jobId: string,
  status: string
): Promise<{ error?: string; applied_at?: string }> {
  // ... auth handling ...

  const patch: Record<string, unknown> = { status }

  if (status === 'applied') {
    const { data: existing } = await supabaseAdmin
      .from('matches')
      .select('applied_at')
      .eq('job_id', jobId)
      .eq('user_id', profile.id)
      .single()

    if (!existing?.applied_at) {
      patch.applied_at = new Date().toISOString()  // only recorded the first time
    }
  }

  await supabaseAdmin.from('matches').update(patch)...

  return { applied_at: patch.applied_at as string | undefined }
}
```

The saved date is returned as `applied_at`, so the client reflects it on screen immediately — no page refresh needed.

---

## Step 4. Showing elapsed days + manual date editing

Instead of a raw date, cards show "Applied N days ago." It's more intuitive, and it's also a decent way to feel "still no word back, huh."

```ts
function daysElapsed(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}
```

Clicking the button switches it into a date input field — an editing UI for when the auto-logged date is wrong (say, you accidentally flipped a status and reverted it).

```tsx
{appliedAt && !editingDate && (
  <button onClick={startEditDate} className="text-xs text-zinc-400 hover:text-zinc-600">
    Applied {daysElapsed(appliedAt)} days ago
  </button>
)}

{editingDate && (
  <span className="flex items-center gap-1">
    <input type="date" value={dateInput} onChange={e => setDateInput(e.target.value)} autoFocus />
    <button onClick={handleSaveDate}>Save</button>
    <button onClick={() => setEditingDate(false)}>Cancel</button>
  </span>
)}
```

---

## Step 5. Wiring state between components

When `StatusButton` changes the status, its result (`applied_at`) needs to reach the parent `JobList`. Handled with a props callback.

```ts
// StatusButton.tsx — expanded props
export default function StatusButton({
  jobId,
  initialStatus,
  onAppliedAt,      // added
}: {
  jobId: string
  initialStatus: string
  onAppliedAt?: (appliedAt: string) => void
}) {
  async function handleSelect(next: Status) {
    const res = await updateMatchStatus(jobId, next)
    if (!res.error) {
      setStatus(next)
      if (res.applied_at && onAppliedAt) onAppliedAt(res.applied_at)  // pass up to the parent
    }
  }
}
```

```tsx
// JobList.tsx — instant status update via the callback
<StatusButton
  jobId={job.id}
  initialStatus={job.match_status}
  onAppliedAt={date => setAppliedAt(date)}
/>
```

---

## Troubleshooting

### applied_at isn't updating

I ran into a case where the `patch` object only ended up with `status`, and `applied_at` was missing. `patch.applied_at` gets assigned inside the `if (status === 'applied')` block, but without typing it as `Record<string, unknown>`, TypeScript throws an error.

```ts
// This is a type error
const patch = { status }
patch.applied_at = new Date().toISOString()  // Property 'applied_at' does not exist

// This is correct
const patch: Record<string, unknown> = { status }
patch.applied_at = new Date().toISOString()  // OK
```

### Clicking outside the modal also triggers a click on the background

I attached `onClick={onClose}` to the modal backdrop (`div.fixed.inset-0`) and `onClick={e => e.stopPropagation()}` to the modal body, to stop event propagation. Skip this pattern, and clicking inside the modal closes it too.

---

## Summary — the core flow

```
[Resume upload]
Choose a file (PDF/DOCX)
  → create FormData
  → call the uploadAppliedResume() Server Action
  → extract text via parseResumeFile()
  → supabaseAdmin.update (applied_resume_text, applied_resume_filename)
  → reflect immediately in client state (onUploaded callback)

[Application date logging]
status → transitions to 'applied'
  → call updateMatchStatus()
  → if applied_at is missing, auto-log the current timestamp
  → return applied_at
  → StatusButton → onAppliedAt callback → JobList state update
  → card immediately shows "Applied Nd ago"
```

Now, when an interview request comes in, opening the card immediately shows the full submitted resume and "Applied 23 days ago." It seems minor, but I think these small details are exactly what add up to a tool that's actually worth using.
