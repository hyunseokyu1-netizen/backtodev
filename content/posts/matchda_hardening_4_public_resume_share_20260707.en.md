---
title: 'Hardening MatchDa (4): Designing a Viral Loop With a Public Resume-Sharing Link'
date: '2026-07-07'
publish_date: '2026-08-22'
description: Building a resume-sharing page viewable without login (/r/slug), designed with privacy protection and search-engine deindexing in mind from the start
tags:
  - Next.js
  - Supabase RLS
  - Viral Loop
  - Growth Strategy
  - Privacy
---

## Why this feature was needed

MatchDa is a service that polishes a Korean resume into English. Thinking through a marketing direction, I arrived at the conclusion that "getting users to naturally share what they've already made" is a far more efficient growth strategy than advertising. It's a structure commonly called a **viral loop,** and the principle is simple.

> A user shares their own result (a resume) on social media or a community → at the bottom of that page, a mark reading "this resume was made with MatchDa" → someone who sees it becomes a new user

Content marketing or ads require the creator to keep expending effort, but a loop like this means **the product itself generates advertising.** So this time, I actually implemented a "public resume-sharing link."

## Setting design principles first

Before writing the feature, I settled three things first. A resume is sensitive personal data, so it's safer to set principles from the start than to fix them later.

1. **Contact info (email, phone number) is never included on the public page.** Only name, experience, and skills are shown.
2. **It should never be indexed by search engines.** "Only someone with the share link can see it" and "anyone can find it via a Google search" are completely different privacy levels.
3. **It can be switched on and off with a single toggle, and turning it off must make it immediately inaccessible.**

## Step 1. Adding two columns to the DB

```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS public_slug            TEXT,
  ADD COLUMN IF NOT EXISTS public_resume_enabled  BOOLEAN NOT NULL DEFAULT false;

-- the slug must be globally unique so URLs never collide
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_public_slug
  ON profiles (public_slug)
  WHERE public_slug IS NOT NULL;
```

`public_slug` is the identifier for the public URL (`/r/<slug>`). The reason for the conditional unique index with `WHERE public_slug IS NOT NULL` is that most users won't use this feature, and `NULL` values don't collide against a unique constraint with each other (`NULL` is treated as different from `NULL`).

## Step 2. Generating a hard-to-guess slug

Exposing a user ID directly in the URL path risks it being sequentially guessed, so I used a random string instead.

```ts
function genSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(10))
  return Array.from(bytes, b => chars[b % chars.length]).join('')
}
```

The reason for using `crypto.getRandomValues` instead of `Math.random()` is that the latter isn't cryptographically secure, making it unsuitable for a value like a URL that shouldn't be guessable.

I also added retry logic accounting for the possibility of a unique-index collision (another user already having the same slug) when generating one.

```ts
if (enable && !slug) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = genSlug()
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ public_slug: candidate, public_resume_enabled: true })
      .eq('id', profile.id)
    if (!error) { slug = candidate; break }
    if (error.code !== '23505') return { error: error.message }  // 23505 = unique_violation; return any other error immediately
  }
}
```

The probability of a 10-character random string colliding is vanishingly small (36^10 combinations), but explicitly handling "what if it does collide" in code reduces mysterious-cause failures down the road.

## Step 3. Building the public page — reusing an existing component

There was a part here that turned out unexpectedly smooth. MatchDa already had a component called `ResumeDocument` for rendering resumes, and checking it, it turned out to be a pure server component with no `'use client'` directive. In other words, since it's a **pure presentational component that doesn't depend on login state or client hooks,** it could be reused as-is for the public page too.

```tsx
// src/app/r/[slug]/page.tsx
export default async function PublicResumePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const profile = await getPublicProfile(slug)
  if (!profile) notFound()

  const resume = toStudioResume(profile.onboarding_en)

  // never include contact info (email/phone) on the public resume — minimize personal data
  const doc = studioToDoc(resume, '')

  return (
    <div className="min-h-screen bg-[#F4F6F8] py-8 px-4 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <ResumeDocument doc={doc} labels={EN_LABELS} variant="original" />
        {/* watermark + CTA */}
        <div className="mt-6 flex flex-col items-center gap-3 text-center">
          <p className="text-[13px] text-[#98A2B3]">
            This resume was created with <span className="font-semibold">MatchDa</span>.
          </p>
          <Link href="/" className="rounded-[10px] bg-[#046C4E] px-5 py-2.5 text-white">
            Build your own English resume, free
          </Link>
        </div>
      </div>
    </div>
  )
}
```

Passing an empty string as the second argument (contact info) in `studioToDoc(resume, '')` is the part that implements principle 1 (never expose contact info). Since the data is never even carried along in the first place, there's no risk of it accidentally rendering somewhere.

I made the lookup function only ever return a profile where `public_resume_enabled = true`, so that flipping the toggle off makes it 404 immediately.

```ts
async function getPublicProfile(slug: string) {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('onboarding_en, public_resume_enabled')
    .eq('public_slug', slug)
    .eq('public_resume_enabled', true)   // the lookup itself fails once this is off
    .maybeSingle()
  return data
}
```

## Step 4. Blocking search-engine indexing

This is handled simply via the `robots` field in Next.js's `generateMetadata`.

```ts
export async function generateMetadata({ params }): Promise<Metadata> {
  // ...
  return {
    title: `${name} — MatchDa`,
    robots: { index: false },  // exclude from search-engine indexing (personal resume)
  }
}
```

This maintains the line between "only someone with the link can view it" and "anyone can find it via Google."

## Step 5. Registering the public path in middleware

MatchDa's middleware checks login status to block page access, and since `/r/*` needs to be viewable without login, I added it to the public list.

```ts
// src/middleware.ts
if (pathname.startsWith('/r/')) {
  return supabaseResponse  // viewable without login
}
```

## Step 6. Actually turning it on to verify, then immediately reverting

After writing the whole feature, I didn't stop at "this should work" — I actually confirmed the behavior. I ran the local dev server, briefly turned on a slug for verification purposes, confirmed it, and immediately turned it back off.

```bash
# 1) a nonexistent slug → confirm 404
curl -s -o /dev/null -w "%{http_code}" http://localhost:3999/r/nonexistent
# → 404

# 2) temporarily make it public
curl -X PATCH ".../profiles?email=eq.my-email" -d '{"public_slug":"verifytest","public_resume_enabled":true}'

# 3) verify rendering — check via grep that the name shows and the email doesn't
curl -s http://localhost:3999/r/verifytest | grep -o "John Smith"       # should appear
curl -s http://localhost:3999/r/verifytest | grep -o "my@email.com" # should NOT appear

# 4) revert immediately
curl -X PATCH ".../profiles?email=eq.my-email" -d '{"public_slug":null,"public_resume_enabled":false}'
```

This verification step was exactly the part I cared about most in implementing this feature. Rather than assuming "the contact info wasn't included, so it probably won't show up" and moving on, I directly confirmed with `grep`, against the actual rendered output, that the email string was genuinely absent.

## Common patterns, summarized

| Purpose | Approach |
|---|---|
| Generating an unguessable URL slug | `crypto.getRandomValues()` (never `Math.random`) |
| Avoiding unique-constraint conflicts between NULLs | `CREATE UNIQUE INDEX ... WHERE col IS NOT NULL` |
| Rendering without leaking personal data | Never carry the data along in the first place (`studioToDoc(resume, '')`) |
| Blocking search-engine indexing | `robots: { index: false }` in Next.js's `generateMetadata` |
| Making a toggle-off immediately private | Include the `enabled = true` condition directly in the lookup query itself |

## Troubleshooting

**Q. What if the slug collides on the unique index and fails?**
A. Postgres's unique_violation error code is `23505`. I branched to retry only on this code, and return any other error as-is. Retrying on every error would hide a genuine problem (a permissions error, etc.).

**Q. How do you judge whether an existing component is safe to reuse?**
A. Check whether `'use client'` sits at the top of the component file first. If it's absent, it's likely a pure component that can render on the server just as well. This time too, `ResumeDocument` was exactly that case, so there was no need to build something new.

## Summary

```
Add the public-status column → generate a safe slug (+ retry on collision)
  → reuse the existing render component (never pass contact info at all)
  → block search engines via robots: noindex → register the public path in middleware
  → verify the actual rendered output via grep, then revert
```

What stuck with me more than the feature itself is that **a feature built on the assumption of being shared needs its privacy principles settled before the code, not after.** Excluding contact info, blocking indexing, immediate privacy toggling — if I'd tried adding these three afterward, something might already have leaked somewhere by then.

Next up (the last part), a change of direction — a type-design problem discovered while tracing a bug where "multiple education entries were registered, but only one showed up on screen."
