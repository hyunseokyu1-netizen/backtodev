---
title: 'Building a SaaS With an AI Coding Assistant (10): From Forgot Password to the Eye Icon — Closing Out Auth UX'
date: '2026-07-05'
publish_date: '2026-08-09'
description: The truth behind Supabase deliberately responding "as if successful" to a signUp for an already-registered email (an empty identities array), a one-line next-parameter design that blocks open redirects, and how I knowingly dodged this time the exact admin API trap that caused the data-loss incident in Part 2
tags:
  - Supabase
  - Next.js
  - Authentication
  - UX
  - AI Coding Assistant
---

## Starting off

Once Part 9 finished the settings page and password change, three holes still remained around authentication.

- Someone who **forgot** their password has no way out — only a logged-in person can change it
- Clicking sign-up with an already-registered email shows "Signup complete" (?!)
- The password fields have no eye icon — try to think of a modern service missing this one

None of these three are "core features." But authentication is a door every single user must pass through, and if someone gets stuck at the door, they never see what's behind it. This is the story of three commits (`6f0b067`, `46ab3f5`, `992365c`) that patched all three holes in a single day. Digging into the second hole in particular led to a spot where **Supabase deliberately lies**, and working around it led straight back into the exact same trap as Part 2's data-loss incident — this time with a very different outcome.

## Step 1. Forgot-password / reset flow (`6f0b067`)

### The full picture of the flow

Supabase's password reset is built from two pages and one callback.

```
Login form "Forgot your password?"
  → /forgot-password (enter email → resetPasswordForEmail)
  → click the reset link in the user's inbox
  → /auth/callback?code=...&next=/reset-password (exchange the code for a session)
  → /reset-password (enter new password → updateUser)
  → /dashboard
```

The sending side is just one call to `resetPasswordForEmail`, but the key detail is carrying the destination in `redirectTo`.

```tsx
// src/app/forgot-password/page.tsx
const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
  redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
})
```

There's a concept worth pausing on here. **The moment the user clicks the email link, they're already (temporarily) logged in.** Supabase exchanges the reset link's code for a session — this is called a recovery session. That's why the code that saves the new password on `/reset-password` is, surprisingly, just `updateUser` — the same API as the password change on Part 9's settings page, usable here **without confirming the current password**, exactly because of this recovery session. Access to the inbox itself already stood in for identity verification.

```tsx
// src/app/reset-password/page.tsx
const { error } = await supabase.auth.updateUser({ password })

if (error) {
  setError(
    error.message.includes('different from the old')
      ? 'Please use a password different from your previous one.'
      : "Couldn't update your password. The reset link may have expired — please request a new one."
  )
  return
}
setDone(true)
setTimeout(() => router.push('/dashboard'), 1500)
```

The second error-branch message also comes straight from real use. Reset links do expire, and a raw string like "AuthApiError: ..." is no help to a user at all. "The link may have expired — please request a new one" is an actual next action they can take.

### The auth callback's `next` parameter — one line that blocks open redirect

The existing auth callback unconditionally sent users to `/dashboard`. Since the reset flow needs to go to `/reset-password` instead, I changed it to accept the destination as a parameter — but just trusting `next` and redirecting to it becomes an **open redirect vulnerability.** If an attacker distributes a link with `?next=https://evil.com` baked in, a redirect that started from our own domain would carry the user off to a phishing site.

```ts
// src/app/auth/callback/route.ts
const next = searchParams.get('next')
// prevent open redirect: only allow internal paths
const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'

return NextResponse.redirect(`${origin}${target}`)
```

The defense is one line. `startsWith('/')` filters out absolute URLs (`https://...`), and `!startsWith('//')` filters out protocol-relative URLs too (`//evil.com` — which starts with `/`, so it passes the first condition). I could have built a whitelist array, but "allow every internal path" is exactly this service's requirement, so these two conditions are enough. The AI assistant added this defense in the same commit as adding the `next` parameter — having this kind of "security common sense that rides along with a feature" show up automatically is genuinely convenient. Of course, confirming it actually rode along is on me, at review time.

## Step 2. Blocking sign-up for an already-registered email — Supabase's "white lie" (`46ab3f5`)

### The symptom: an already-registered email, but "signup complete"

This is the highlight of this part. The product owner (me), testing things out, found something strange. **Clicking the sign-up button with an already-registered email shows "Signup complete."** No error, and of course nothing actually gets registered. From the user's side, this is the worst possible path — thinking they've signed up, then getting stuck in the mystery of "wrong password" when they try to log in.

Having the AI assistant investigate the cause, the first step was logging the actual `signUp` response.

```
[Signup] result - error: null | user: hyunseok.yu1@gmail.com | confirmed: undefined
[Signup] user.identities: []
```

`error: null`. The user object comes back looking totally normal. But `identities` is an **empty array.** For a genuine signup, this is exactly where one email identity should sit.

### The cause: an email-enumeration prevention policy

This isn't a bug — it's **Supabase's intended behavior.** In an environment with email confirmation turned on, calling `signUp` with an already-registered email gets a deliberately success-shaped response from Supabase. If it honestly replied "this email is already registered," an attacker could figure out "this email belongs to a member of this service" just by trying arbitrary emails — this is email enumeration. Instead, it leaves only a trace — `identities: []` — inside the fake success response.

From a security standpoint, this is an excellent policy. The problem is **our service doesn't need this protection.** For a dating app or an anonymous community, "is this person a member" is itself sensitive information — but for a job-matching SaaS, there's essentially no risk from exposing whether an email is registered. Meanwhile, the UX cost of "an already-registered email showing signup complete" is very real. Which side to pick when a security policy and UX conflict isn't for the framework to decide — it's a **product decision**, and here I chose explicit disclosure.

### The fix: dual defense — and a reunion with Part 2's trap

The primary defense is an `emailExists` server action that checks directly on the server before signUp. But here — and anyone who's read this series from the start should feel a chill — comes "look up an email via the admin API." That's **the exact trap that wiped out my account in Part 2.** The GoTrue admin API silently ignores the email query filter and returns the full user list. Back then, not knowing this, I deleted user `[0]`, and that `[0]` was my own real account.

This time, I knew. The rule registered in the AI assistant's memory right after the incident ("never trust the admin API's email filter") showed up directly in this code's comments and implementation.

```ts
// src/app/auth-actions.ts
/**
 * Duplicate-email check before signup.
 * Caution: the GoTrue admin API's email query filter is ignored (returns everything),
 * so always paginate through the full list and match exactly on the client side.
 */
export async function emailExists(email: string): Promise<boolean> {
  const { supabaseAdmin } = await import('@/lib/supabase-admin')
  const target = email.trim().toLowerCase()
  if (!target) return false

  let page = 1
  while (page <= 20) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) return false // if verification isn't possible, don't block signup (the identities fallback is the 2nd line of defense)
    if (data.users.some(u => u.email?.toLowerCase() === target)) return true
    if (data.users.length < 200) return false
    page++
  }
  return false
}
```

Rather than trusting the server's filter, it **paginates through the list and matches exactly, locally.** Same trap, different outcome. In Part 2, this trap became a data-loss incident; this time, it became one comment's worth of defensive knowledge. This is exactly how leaving an incident behind as a memory rule gets cashed in later.

Two design details are worth noting too.

- **Return `false` on error** — a failed duplicate check must never block signup outright. When it can't be determined, let it through and hand it off to the second line of defense.
- **The second defense detects an empty identities array** — even if the pre-check misses (a race condition, an admin API outage), it still catches the trace left in Supabase's fake success response.

```tsx
// src/app/login/LoginForm.tsx
// 1st: check on the server for an already-registered email
if (await emailExists(email)) {
  setError('This email is already registered. Please log in or use forgot password.')
  setLoading(false)
  return
}

const { data, error } = await supabase.auth.signUp({ email, password })
// ...
} else if (data.user && (data.user.identities?.length ?? 0) === 0) {
  // 2nd defense: for an already-registered email, Supabase sends back an empty identities array
  setError('This email is already registered. Please log in or use forgot password.')
}
```

### An error message needs an exit

Stopping at "this email is already registered" leaves the user at another dead end. What they need to do next is one of two things — log in, or recover their password. I put both exits as buttons right inside the error box.

```tsx
{error.includes('already registered') && (
  <span className="mt-1 flex gap-3">
    <button type="button" onClick={() => { setMode('login'); setError(''); setMessage('') }}
      className="font-semibold text-[#046C4E] hover:underline">
      Log in
    </button>
    <Link href="/forgot-password" className="font-semibold text-[#046C4E] hover:underline">
      Forgot password
    </Link>
  </span>
)}
```

`/forgot-password`, built in Step 1, gets used right here as an exit. This is the moment where features built the same day become each other's wiring.

As a bonus, I also corrected the signup-success message this time. The existing "Signup complete. Please log in." is a lie in the current environment, where email confirmation is mandatory — you can't log in before verifying your email. I changed it to "We've sent a confirmation email. Please check your inbox (including spam) to complete verification."

## Step 3. A password-visibility toggle — a shared PasswordInput (`992365c`)

The last piece is small but touches the whole app. At this point, how many password fields were there? 1 for login/signup, 2 for reset (new password, confirm), 3 for password change in settings (current, new, confirm). **A total of 5 fields, and not one of them had an eye icon.**

Instead of planting a `useState` into each form individually, I built a shared component.

```tsx
// src/components/ui/PasswordInput.tsx
export default function PasswordInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false)

  return (
    <div className="relative">
      <input {...props} type={show ? 'text' : 'password'} className={`${className ?? ''} pr-10`} />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow(s => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#98A2B3] hover:text-[#475467]"
      >
        {/* eye / eye-off SVG */}
      </button>
    </div>
  )
}
```

It's a 44-line component, but a few design decisions are baked into it.

1. **`{...props}` spread + a `type` override** — it accepts the entire `InputHTMLAttributes` and passes it through to the `input`, but places `type` **after** the spread so the toggle state always wins. Every existing form's `value`, `onChange`, `required`, `minLength`, and `placeholder` stayed untouched — all that changed was the tag name, from `input` to `PasswordInput`. The actual applied diff really was 1-3 lines per form.
2. **`className` passes through too** — each form keeps its existing input styling, with only `pr-10` (room for the icon) tacked on. Since the shared component doesn't own styling, there was no need to forcibly unify the different looks of the login form and the settings form.
3. **`tabIndex={-1}`** — if the eye icon sits inside the tab flow between email → password → submit button, a keyboard user has to tab through it every single time. The toggle is a mouse/touch convenience, so I excluded it from tab order. Its identity is still announced to screen readers via `aria-label`, though.

### Automatically verifying the toggle with Playwright too

Verification after applying this was also run directly by the AI assistant with Playwright. It opened the login page, typed a password, clicked the eye icon, and confirmed that **the input's type attribute actually changed from `password` to `text`.**

```
✓ /login: eye icon shown, click → input[type=text], click again → input[type=password]
✓ /reset-password: both fields toggle independently and correctly
✓ /settings: all 3 password-change fields toggle correctly
```

The point is verifying "clicking changes the type," not just "the icon shows up on screen." UI verification tends to stop at confirming rendering, but for state-toggle behavior, you've only really verified it once you check the DOM attribute after the action.

## Common patterns, summarized

| Situation | Pattern |
|---|---|
| Sending a password reset | `resetPasswordForEmail(email, { redirectTo: origin + '/auth/callback?next=/reset-password' })` |
| Saving on the reset page | Just `updateUser({ password })` on top of the recovery session — clicking the email link already stood in for identity verification |
| Callback redirect destination | `next.startsWith('/') && !next.startsWith('//')` — blocks both absolute URLs and `//host` |
| Detecting signup for an already-registered email | ① server pre-check (`emailExists`) ② `identities.length === 0` fallback — dual defense |
| Looking up a user's email via the admin API | Never trust the email filter — paginate `listUsers` + match exactly on the client |
| When the pre-check fails | Let signup through rather than blocking it → delegate to the second defense |
| Error messages | Never a dead end — put the next action (log in / forgot password) as a button |
| A password toggle component | `{...props}` spread + a `type` override, `className` passthrough, `tabIndex={-1}` + `aria-label` |
| Verifying toggle UI | Check the DOM attribute (`input[type]`) after the action via Playwright, not just rendering |

## Summary

1. **A framework's "white lie" needs to be reversible by a product decision.** Supabase responding as if successful to a signup for an already-registered email is a reasonable email-enumeration-prevention policy. But whether that protection is actually needed for our service is for the product owner to judge, not Supabase — and if you decide to reverse it, finding a trace like `identities: []` starts with actually logging the response. The response is the truth, more than the docs are.
2. **An incident becomes a rule, and a rule becomes code.** The "admin API ignores the email filter" trap that wiped out an account in Part 2 got dodged head-on this time, via a comment and a pagination implementation. Running into the same trap twice may be unavoidable, but whether you pay the same price the second time depends on how well you recorded the first incident. Watching a rule I'd left in the AI assistant's memory get cashed in, weeks later, in a commit, was the most rewarding moment in this whole series.
3. **The polish of auth UX shows up in the exception paths.** Anyone can build normal signup and normal login. Someone who forgot their password, someone who forgot they'd already signed up, someone who wants to double-check the password they just typed — these exception paths need to be smooth, or people drop off right at the door. And an error message on an exception path always needs an exit — a button for the next action.

The next part is the other half of this flow — the actual email that lands in a user's inbox. It covers replacing Supabase's bland default "Confirm your signup" email with a branded template, and the configuration back-and-forth of wiring up Resend SMTP.
