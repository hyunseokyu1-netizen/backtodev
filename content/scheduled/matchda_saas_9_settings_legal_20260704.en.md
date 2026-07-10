---
title: 'Building a SaaS With an AI Coding Assistant (9): The "Grown-Up" Parts of a SaaS — Settings and Legal Documents'
date: '2026-07-04'
publish_date: '2026-08-08'
description: How I wired up a settings page, password change, terms of service, privacy policy, and support page in a single day for an app where clicking the avatar in the top-right corner did nothing — including a two-step pattern (anon client + admin API) for "verifying the current password," something Supabase has no API for
tags:
  - Next.js
  - Supabase
  - SaaS
  - Authentication
  - AI Coding Assistant
---

## Starting off

Once Part 8 fixed every dead link on the landing page, the same kind of feedback surfaced from inside the app. The product owner (me) clicked the avatar with my initial in the top-right corner of the dashboard — and **nothing happened.**

Thinking about it, a whole set of obviously-necessary things were simply missing. Matching, tailored resumes, cover letters, billing, a chatbot — all there. But:

- No settings page — nowhere to see my own email, or how I signed up
- No way to change a password
- The footer's "Terms of Service," "Privacy Policy," and "Support" were dead links
- Handling sensitive data like resumes, with no document telling users where that data goes

Features get applause in a demo; these things only get noticed by their absence. This part is about the two commits (`f3ac45e`, `c505ca7`) that wired up the "grown-up" parts of a SaaS — settings, password change, terms, privacy policy, and support — in a single day.

## Step 1. Building the settings page (/settings)

### Starting with the entry points: turning 2 dead avatars into Links

Following the lesson from Part 8, I wired the entry points before the page itself. Anything that looks clickable needs to be clickable. The avatar in the top-right Topbar, and the profile chip at the bottom of the sidebar — both had just been decoration up to this point.

```tsx
// Topbar.tsx — wrapping the avatar in a Link
-  <Avatar initial={initial} size={36} fontSize={14} />
+  <Link href="/settings" title="Settings" className="rounded-full transition-opacity hover:opacity-80">
+    <Avatar initial={initial} size={36} fontSize={14} />
+  </Link>
```

For the sidebar profile chip, I turned the `<div>` into a `<Link>` and added active-state handling so it highlights while on `/settings`.

```tsx
// Sidebar.tsx
-  <div className="flex items-center gap-[10px] p-2">
+  <Link
+    href="/settings"
+    title="Settings"
+    className={`flex items-center gap-[10px] rounded-[9px] p-2 transition-colors hover:bg-[#F4F6F8] ${
+      activeKey === 'settings' ? 'bg-[#ECFDF3]' : ''
+    }`}
+  >
```

At this point I also extended the `activeKey` union type on `AppShell` and `Sidebar`.

```tsx
-  activeKey: 'dashboard' | 'discover' | 'profile'
+  activeKey: 'dashboard' | 'applications' | 'discover' | 'profile' | 'settings'
```

`'settings'` isn't a key in the sidebar's nav list. It still goes into the type — even if something isn't a nav item, "which screen is this right now" still needs to be expressible, and highlighting the profile chip is exactly what consumes it. It's more extensible to keep the union type open as a **list of screens**, not a list of menu items.

### The login info card — automatic provider detection

The first card in settings shows login info (email, sign-up method, join date). Supabase stores the signup path in `user.app_metadata.provider`, so reading that and mapping it to a Korean label is all that's needed.

```tsx
// src/app/settings/page.tsx
const PROVIDER_LABEL: Record<string, string> = {
  email: 'Email & Password',
  google: 'Google Social Login',
  github: 'GitHub Social Login',
  kakao: 'Kakao Social Login',
}

const provider = (user.app_metadata?.provider as string) ?? 'email'
const providerLabel = PROVIDER_LABEL[provider] ?? provider
const joinedAt = user.created_at
  ? new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  : '-'
```

`PROVIDER_LABEL[provider] ?? provider` — even a provider not in the mapping still shows something, even if it's just the raw value. The settings page won't break even if Apple sign-in gets added later.

### Password change — the "verify current password" step Supabase doesn't provide

This is the core dilemma of this part. The standard password-change form has 3 fields: "current password → new password → confirm." But **Supabase has no API to verify that the current password is correct.** `updateUser({ password })` changes it immediately, as long as there's a valid login session.

Why is that a problem? Say you leave your laptop unlocked for a moment at a coffee shop — someone could change your password using your active session, and the account is gone, fully handed over. Owning a session and knowing a password are different tiers of authentication, and a password change needs to require the latter.

The solution that came out of discussing this with the AI assistant was a two-step pattern. **① Verify the current password by calling `signInWithPassword` on a disposable anon client that doesn't touch the session**, and **② only after that passes, swap the password using the service-role admin API.**

```ts
// src/app/settings/actions.ts (Server Action)
export async function changePassword(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { error: 'Login required.' }

  const provider = user.app_metadata?.provider ?? 'email'
  if (provider !== 'email') {
    return { error: `Accounts signed in via ${provider} don't have a password. Manage it in your ${provider} account settings.` }
  }

  // ...length/match validation omitted...

  // ① Verify the current password (a disposable anon client that doesn't touch the session cookie)
  const verifier = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  })
  if (verifyError) return { error: 'The current password is incorrect.' }

  // ② Verification passed → swap it using the admin API
  const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    password: newPassword,
  })
  if (error) return { error: `Failed to change password: ${error.message}` }

  return {}
}
```

Three points worth noting.

1. **`persistSession: false`** — a successful verification `signInWithPassword` creates a new session; without this option, that session would try to get stored somewhere. The disposable client uses the login "attempt" purely as a password verifier and discards the resulting session. The user's actual session cookie is never touched.
2. **The admin API only runs after verification** — `supabaseAdmin` (service role) is a master key that bypasses RLS, so it's only ever called after passing code-level verification (confirming the current password, with `user.id` obtained from the session). This is also exactly why `user.id` is never accepted as form input.
3. **A design only possible because it's a Server Action** — since the logic requires the service-role key, it can't run on the client at all in the first place. Inside a `'use server'` action, verification and the swap are bound together atomically in one function.

### Branching for social-login users

Showing a password-change form to a user who signed up with Google just creates confusion — that account has no password. The page branches by provider to show a message instead of the form.

```tsx
{provider === 'email' ? (
  <PasswordForm />
) : (
  <p className="rounded-lg bg-[#F4F6F8] px-4 py-3 text-[13px] text-[#667085]">
    {providerLabel} accounts don't have a separate password. Manage it in that service's account settings.
  </p>
)}
```

The same branch exists on the server-action side too (the `provider !== 'email'` guard in the code above). The UI branch is for UX; the action branch is for defense — even bypassing the screen and calling the action directly still gets blocked.

Everything else is standard: a personal-info card for editing name/phone number (the `profiles` table, filtered by `.eq('id', profile.id)`), and a data-management card explaining account deletion and data export.

## Step 2. 3 legal documents — /terms, /privacy, /support

### StaticPageShell — a shared shell for policy documents

Terms, the privacy policy, and support all share the same structure: "landing chrome + a narrow content column + repeated sections." I unified the markup with one shared shell and one section component.

```tsx
// src/components/matchda/landing/StaticPageShell.tsx
export default async function StaticPageShell({ title, subtitle, children }) {
  const authed = !!(await getAuthUserEmail())
  const t = getMatchdaDict('ko')
  return (
    <div className="min-h-screen bg-white ...">
      <LandingHeader t={t} authed={authed} />
      <main className="mx-auto max-w-[760px] px-4 pb-24 pt-14 sm:px-8">
        <h1 className="text-[30px] font-bold ...">{title}</h1>
        {subtitle && <p className="mt-2 text-[14px] text-[#98A2B3]">{subtitle}</p>}
        <div className="mt-10">{children}</div>
      </main>
      <SiteFooter t={t} />
    </div>
  )
}

/** A section for policy documents (numbered title + body) */
export function PolicySection({ title, children }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-[17px] font-bold text-[#1F2A37]">{title}</h2>
      <div className="space-y-2 text-[14px] leading-[1.75] text-[#475467]">{children}</div>
    </section>
  )
}
```

Thanks to this, the terms page became a list of `<PolicySection title="Article 1 (Purpose)">...`. Adding or editing a clause is now completely separate from the layout. Same principle as the `STEPS` array in Part 8 — separate copy edits from code edits.

### The clause every AI SaaS absolutely needs in its terms

Most of the 11 clauses in the terms are boilerplate you'd find in any SaaS. But Article 5 is specific to an AI service, so I handled it myself, directly.

```tsx
<PolicySection title="Article 5 (Notice Regarding AI-Generated Output)">
  <p>1. Translations, resumes, cover letters, and match scores generated by the Service are outputs of an AI model, and their accuracy or completeness is not guaranteed.</p>
  <p>2. Members must personally review any generated output before submitting it, and the Company bears no responsibility for outcomes (such as hiring decisions) arising from the use of that output.</p>
  <p>3. Tailored resumes are designed to reconstruct only factual information from the member's original resume, but final fact-checking remains the member's responsibility.</p>
</PolicySection>
```

Clause 3 is the interesting part. When building tailored resumes in Part 3, "don't add facts not present in the original" was designed as a prompt-level constraint — and that **exact product design became a sentence in the terms of service, verbatim.** A good constraint ends up in the same words whether it's in code or in a legal document.

### The privacy policy — the decision not to hide anything

The part of the policy I agonized over most was Article 3 (processing outsourced to third parties). For a service handling resumes, the thing users are most curious about (and most anxious about) is "where does my resume actually go." Instead of glossing over it, I named all 5 companies explicitly.

```tsx
<PolicySection title="3. Outsourcing of Personal Data Processing">
  <p>· <b>Supabase</b> — database and authentication (storing account, profile, and resume data)</p>
  <p>· <b>Anthropic</b> — AI processing (resume and job posting content is sent to the Claude API during translation, analysis, and matching)</p>
  <p>· <b>Stripe</b> — payment processing</p>
  <p>· <b>Vercel</b> — service hosting</p>
  <p>· <b>Resend</b> — email delivery</p>
</PolicySection>
```

In particular, I wrote "resume and job posting content is sent to the Claude API" exactly as it is. If an AI SaaS hides this, it's guaranteed to become a problem eventually; disclosing it, instead, builds trust. Since the tech-stack documentation is essentially the same list as the outsourcing vendors, this clause could be written straight from CLAUDE.md.

### Support — a 0-byte-JS accordion

`/support` has 2 contact channels (chatbot as the primary, email as a backup) and 7 FAQ items. I built the FAQ accordion with HTML `details/summary`, with no `useState` at all.

```tsx
{FAQS.map(f => (
  <details key={f.q} className="group rounded-[14px] border border-[#ECEEF0] bg-white px-5 py-4 open:border-[#CEEBDC]">
    <summary className="flex cursor-pointer list-none items-center justify-between ... [&::-webkit-details-marker]:hidden">
      {f.q}
      <span className="ml-3 text-[#98A2B3] transition-transform group-open:rotate-180">⌄</span>
    </summary>
    <p className="mt-3 text-[13.5px] leading-[1.7] text-[#667085]">{f.a}</p>
  </details>
))}
```

The open/closed state is managed by the browser, and Tailwind's `open:`/`group-open:` variants handle even the border color and arrow rotation with pure CSS. There's zero reason to make this a client component. This is a pattern I expect to reuse often for policy/FAQ-type pages.

There's intent behind the channel layout too. The chatbot card comes first, on a green background with a "Fastest" label; email is scoped to things that genuinely need a human — "account deletion, refunds, data export," and so on. The chatbot built in Part 4 has effectively been promoted to the primary support channel.

### Middleware — from an if-chain to an array

With 3 more public pages added, the middleware whitelist if-statement built in Part 8 hit its limit. I refactored it into an array.

```ts
// src/middleware.ts
-  if (pathname === '/' || pathname === '/about' || pathname === '/pricing') {
+  const PUBLIC_PATHS = ['/', '/about', '/pricing', '/terms', '/privacy', '/support']
+  if (PUBLIC_PATHS.includes(pathname)) {
     return supabaseResponse
   }
```

`||` is fine up to 2 conditions; from 3 onward, an array is better. Every future public page is now just adding one string. And of course, the same 3-piece set from Part 8 (middleware + AppChrome path list + link wiring) got walked through again this time — the footer's 3 dead links finally led somewhere real.

## Step 3. The self-service loop — making docs, chatbot, and settings point at each other

The last piece of wiring isn't code — it's knowledge. I added settings-page usage info to the chatbot's knowledge base (`src/lib/support/knowledge.ts`).

```ts
+## Settings (/settings)
+- Clicking the profile icon (your name's initial) in the top-right corner, or the profile at the bottom of the sidebar, takes you to settings.
+- If you signed up with email, you can change your password after verifying your current one. Social-login accounts (Google, etc.) manage passwords through that service.
+- Account deletion and data export are handled by requesting them via the support chatbot or support@matchda.com.
```

This closes the loop.

- A user asks the chatbot "how do I change my password?" → the chatbot points them to the settings page
- The `/support` FAQ "I want to change my password" → points to the settings page
- The settings page's data-management card → points to the chatbot and the support email

Documentation (FAQ), the chatbot, and the settings page all reference each other — a self-service loop. The habit of updating the knowledge base in the same commit as a feature has continued since Part 4, because the moment a feature and "the answer about that feature" drift apart, the chatbot becomes a liar.

## Common patterns, summarized

| Situation | Pattern |
|---|---|
| Verifying the current password on Supabase | `signInWithPassword` on a disposable `persistSession: false` anon client → `admin.updateUserById` only on success |
| Using the service-role (admin) API | Always call it only after code-level verification; get the target ID from the session, never from form input |
| Distinguishing email vs. social signup | `user.app_metadata.provider` + a `PROVIDER_LABEL[provider] ?? provider` fallback |
| A password form for social-login users | Branch both the UI (a message) and the server action (a guard), doubly |
| The activeKey union type | Add it to the type even if it's not a nav item, as long as it's a screen — a list of screens, not a menu list |
| Policy document markup | `StaticPageShell` + `PolicySection` — separates clause edits from layout |
| FAQ accordion | `details/summary` + Tailwind `open:`/`group-open:` — 0 bytes of JS |
| Public path whitelisting | An array of `PUBLIC_PATHS` + `includes` once you have 3+ conditions |
| When adding a feature | Update the chatbot's knowledge base in the same commit — docs, chatbot, and screens reference each other |

## Summary

1. **The grown-up parts are only visible by their absence.** Having matching, billing, and a chatbot but no settings page is invisible to the person who built it. Feedback like "clicking the avatar does nothing" only ever comes from **someone who actually clicked it** — exactly the same lesson from Part 8's dead links, repeated inside the app.
2. **Password change is knowledge authentication, not session authentication.** Supabase not providing a current-password-verification API is a trap. The two-step pattern — verify with a disposable anon client, then swap via the admin API — is the bare minimum defense against an account getting handed over from nothing more than a stolen session.
3. **Hand off the boundary between what AI is good at and what a human has to decide.** AI assistants draft terms/privacy boilerplate in minutes. But the refund policy ("within 7 days, substantially unused"), whether support@matchda.com is actually a monitored inbox, and when to fill in business registration info — these are **business decisions** AI can't make. I explicitly took this list over while receiving the draft, and left it as the owner's homework, not a code review.
4. **Transparency is a decision, not a clause.** Writing "resumes get sent to the Claude API" directly into the policy was a trust issue before it was a legal requirement. An AI SaaS's data-processing clause should match its tech-stack documentation — if it doesn't, one of the two is lying.

Now, clicking the avatar on matchda.com opens settings, the footer's terms/privacy/support links lead to real documents, and the chatbot can answer "how do I change my password?" Not a single flashy feature shipped this day, but it was only after this day that MatchDa started to look like a service instead of a toy.
