---
title: '[JobRadar Part 6] Cover Letters Done Right, UX Polish, and Adding Login'
date: '2026-04-27'
publish_date: '2026-05-23'
description: Cover letter save/download/AI review, memo and status management, direct JD input, and Supabase Auth — everything built in one day
tags:
  - JobRadar
  - Supabase
  - NextJS
  - TypeScript
  - SideProject
---

In Part 5, I built a pipeline where pasting a URL triggers JD scraping → AI matching automatically. This time it's about adding flesh to the bones.

From the critical bug where "cover letters disappear on refresh," to wanting meaningful application status tracking, to making this solo-use app feel like a real product with proper authentication. All of it in one day.

---

## What Got Built

| Feature | Description |
|---------|-------------|
| Persistent cover letters | Auto-loads existing content when modal opens, save after edits |
| Cover letter download | Client-side TXT / DOCX / PDF generation |
| AI review | Claude refines phrasing based on your edits |
| Direct JD input | For sites like Glassdoor where scraping doesn't work |
| Memos | Per-job memo input and save |
| Application status overhaul | Unsorted → Interested → Considering → Applied → Pass |
| Login / signup | Supabase Auth (email + Google OAuth) |
| Middleware route protection | Auto-redirect to /login when not logged in |

---

## Step 1 — Cover Letters: Survive a Page Refresh

The most urgent fix. Opening the modal always showed an empty screen, and generating a cover letter meant it vanished on refresh.

The `cover_letters` table already existed. The problem was the modal not loading existing data when it opened.

```typescript
// CoverLetterModal.tsx
useEffect(() => {
  getCoverLetter(jobId).then(res => {
    if (res.content) {
      setContent(res.content)
      setSavedContent(res.content)
    }
    setState('idle')
  })
}, [jobId])
```

The moment the modal opens, it pulls the existing cover letter from the DB. If there's content, it's immediately editable. If not, the generate button appears.

Needed a Save button for edits. But always showing it is noisy — so it only appears **when there are unsaved changes**.

```typescript
const isDirty = content !== savedContent

{isDirty && (
  <button onClick={handleSave}>Save</button>
)}
```

`savedContent` is the original from DB, `content` is the current textarea value. When they differ, the save button shows up.

---

## Step 2 — Cover Letter Download (TXT / DOCX / PDF)

All three formats generated entirely on the client side. No server API calls.

```bash
npm install docx jspdf
```

**TXT** — simplest. Create a Blob and trigger a link click.

```typescript
async function downloadTxt(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.txt`
  a.click()
  URL.revokeObjectURL(url)
}
```

**DOCX** — use the `docx` package to create paragraphs.

```typescript
async function downloadDocx(content: string, filename: string) {
  const { Document, Packer, Paragraph, TextRun } = await import('docx')
  const paragraphs = content.split('\n').map(line =>
    new Paragraph({ children: [new TextRun(line)] })
  )
  const doc = new Document({ sections: [{ children: paragraphs }] })
  const blob = await Packer.toBlob(doc)
  // ... download
}
```

**PDF** — use `jspdf` with automatic line splitting.

```typescript
async function downloadPdf(content: string, filename: string) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF()
  const lines = doc.splitTextToSize(content, 180) // auto line wrap
  doc.setFontSize(11)
  doc.text(lines, 15, 20)
  doc.save(`${filename}.pdf`)
}
```

All three use `await import()` for dynamic imports — keeps the bundle small and only loads when needed.

---

## Step 3 — AI Review Button

"Regenerate" starts over from scratch. "AI Review" has Claude refine only the phrasing based on what you've already edited.

```typescript
// actions.ts
export async function reviewCoverLetter(jobId: string, content: string) {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `Keep the content and structure of the cover letter below intact,
but refine any awkward phrasing, repetition, or grammatical errors.
Output only the improved version.

## Current Cover Letter
${content}`,
    }],
  })
  // ...
}
```

The key in the prompt is "keep content, improve phrasing." This way the work you put into editing doesn't get thrown away.

---

## Step 4 — Direct JD Input (Glassdoor Workaround)

Glassdoor is blocked by Cloudflare, so we can only get the title and company name from the URL slug — no actual JD.

Added a "JD Input" button. It shows as orange when the source is Glassdoor or the description is under 200 characters.

```typescript
{(job.source === 'glassdoor' || !job.description || job.description.length < 200) && (
  <button onClick={() => setShowJdInput(true)}
    className="text-xs border border-orange-200 text-orange-600 ...">
    JD Input
  </button>
)}
```

Click the button, a modal appears, paste the JD from the listing page, save — and AI matching runs automatically.

```typescript
// JdInputModal.tsx
async function handleSubmit() {
  await updateJobDescription(jobId, description) // 1. save JD
  const res = await matchSingleJob(jobId)        // 2. auto AI match
  onMatched(res.score)
}
```

---

## Step 5 — Memos + Application Status Overhaul

### Memos

To leave notes per job, the `jobs` table needed a column:

```sql
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS memo text;
```

Click "Memo" on the card and a textarea toggles. Save writes to DB.

When a memo exists, the button turns yellow as a visual indicator that there's content there.

```typescript
className={`... ${memo
  ? 'border-yellow-300 text-yellow-700 bg-yellow-50'
  : 'border-zinc-200'}`}
```

### Application Status Overhaul

The original statuses (`new / bookmarked / applied / pass`) were too vague. Replaced with something that reflects the actual application workflow.

| Before | After |
|--------|-------|
| new | Unsorted |
| bookmarked | ⭐ Interested |
| (none) | 🤔 Considering |
| applied | ✓ Applied |
| pass | ✕ Pass |

The DB column is text, so no migration needed — just start writing the new values.

### Bug: Re-matching Resets Status to 'new'

When re-scoring a listing, the `matches` table gets upserted with `status: 'new'` hardcoded.

```typescript
// before — always overwrites to 'new'
await supabaseAdmin.from('matches').upsert({
  ...result,
  status: 'new', // 💀
})

// after — preserve existing status
const { data: existing } = await supabaseAdmin
  .from('matches').select('status')
  .eq('user_id', profile.id).eq('job_id', job.id).single()

await supabaseAdmin.from('matches').upsert({
  ...result,
  status: existing?.status ?? 'new', // ✅ keep existing status
})
```

A job I'd marked "Applied" was resetting to "Unsorted" on every re-match. Fixed.

---

## Step 6 — Supabase Auth Login / Signup

I'd hardcoded my email during MVP and used it solo. Time to add real authentication.

### Install @supabase/ssr

```bash
npm install @supabase/ssr
```

For cookie-based session handling in App Router, `@supabase/ssr` is needed instead of `@supabase/supabase-js`. It lets server components read sessions.

### Two Clients

```typescript
// supabase-server.ts — for server components / Server Actions
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options))
      },
    },
  })
}

// supabase-browser.ts — for client components
export function createSupabaseBrowserClient() {
  return createBrowserClient(url, key)
}
```

### Middleware Route Protection

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user && !pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|auth/callback).*)'],
}
```

Excluding `auth/callback` from the matcher is critical. If the Google OAuth callback hits the middleware, the session exchange fails. I left this out at first and got a bug where logging in just bounced you back to the login page.

### Google OAuth + Callback Handling

```typescript
// LoginForm.tsx
async function handleGoogleLogin() {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  })
}

// app/auth/callback/route.ts
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get('code')
  if (code) {
    const supabase = await createSupabaseServerClient()
    await supabase.auth.exchangeCodeForSession(code)
  }
  return NextResponse.redirect(new URL('/', request.url))
}
```

### Remove Hardcoded Email

Replaced hardcoded emails scattered across `actions.ts`, `matching.ts`, `profile/actions.ts`:

```typescript
// auth-helpers.ts
export async function getAuthUserEmail() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email ?? null
}

export async function getOrCreateProfile(email: string) {
  const { data: existing } = await supabaseAdmin
    .from('profiles').select('*').eq('email', email).single()

  if (existing) return existing

  // auto-create blank profile on first login
  const { data: created } = await supabaseAdmin
    .from('profiles').insert({ email, name: '' }).select().single()

  return created
}
```

Every Server Action now starts with this:

```typescript
const email = await getAuthUserEmail()
if (!email) return { error: 'Login required.' }
const profile = await getOrCreateProfile(email)
```

---

## Troubleshooting

**Google OAuth redirects to localhost**

The Supabase Dashboard Site URL defaults to `localhost:3000`.

**Fix**: Authentication → URL Configuration → change Site URL to the Vercel deployment URL.

**After Google login, bounces back to login page**

Happens when `auth/callback` isn't excluded from the middleware matcher. The middleware sees no session cookie and redirects to `/login`.

**Fix**: Add `auth/callback` exclusion to matcher pattern.

```typescript
matcher: ['/((?!_next/static|_next/image|favicon.ico|api|auth/callback).*)'],
```

**`redirect_uri_mismatch` (Google OAuth)**

The Supabase callback URL is missing from the Google Cloud Console authorized redirect URIs.

**Fix**: Add `https://<project-id>.supabase.co/auth/v1/callback`.

---

## Summary — The Core Flow

```
Login (/login)
  ├── Email/password
  └── Google OAuth → /auth/callback → session exchange → /

Middleware: not logged in → redirect to /login (except auth/callback)

Dashboard (/)
  └── Job card
        ├── JD Input button (when no description)
        ├── Memo button → textarea toggle → save
        ├── Status button (click to cycle)
        └── Cover Letter button
              ├── Auto-loads existing content
              ├── Edit → save
              ├── AI Review (refine phrasing of current content)
              ├── Regenerate (write from scratch)
              └── Download (TXT / DOCX / PDF)
```

Two things drove this session: first, **UX details** — cover letters that disappear on refresh, meaningless status labels, status resetting on re-match. These accumulate into a tool you don't actually want to use. Second, **auth architecture** — Supabase Auth + `@supabase/ssr` fits well with Next.js App Router. One middleware protects all routes, and server components can read sessions.

Next post: a "Database error saving new user" error that appeared right after OAuth login.

---

*JobRadar series*
- [Part 1: Next.js + Supabase Project Setup](/posts/jobradar_01_setup_20260420)
- [Part 2: Supabase Schema + Playwright Scraper](/posts/jobradar_02_scraper_20260421)
- [Part 3: Deploying Playwright to Vercel Blew Up](/posts/jobradar_03_vercel_playwright_20260422)
- [Part 4: Ditched Playwright for cheerio](/posts/jobradar_04_url_scraper_20260423)
- [Part 5: On-demand Pipeline Complete](/posts/jobradar_05_coverletter_pipeline_20260424)
- **Part 6: Cover Letters + Auth (current)**
