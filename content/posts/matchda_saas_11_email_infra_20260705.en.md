---
title: 'Building a SaaS With an AI Coding Assistant (11): "Confirm Your Signup" Is Too Bland — Branded Emails and Resend SMTP'
date: '2026-07-05'
publish_date: '2026-08-10'
description: Two email HTML templates built back in table-layout-and-inline-styles style, an unexpected Mailgun MX record discovered via dig, a 401 scare from a send-only restricted key — the story of replacing Supabase's default auth emails with branded ones and wiring up Resend SMTP
tags:
  - Resend
  - Supabase
  - Email
  - DNS
  - AI Coding Assistant
---

## Starting off

The moment I built the forgot-password flow in Part 10 and actually received an email, a different kind of problem became obvious. The email that arrived looked like this.

- Subject: **"Confirm your signup"** — an English subject line on a Korean service
- Body: a single unstyled link
- Sender: **noreply@mail.app.supabase.io** — not our domain
- And, critically, Supabase's default SMTP is **rate-limited to 2-4 sends per hour** — even a handful of signups in one day would stop emails from going out

The first three are branding problems, but the last one is a service-outage-level issue. On a service where signup requires email verification, if the verification email doesn't go out, signup itself is blocked. This part is the record of solving this problem in two layers — **templates** (commits `58121ce`, `c74b78a`) and **sending infrastructure** (wiring up Resend SMTP). The latter lives in the world of dashboards and DNS rather than code, so collaboration with the AI assistant took a different shape than it had so far.

## Step 1. Two branded email templates (`58121ce`, `c74b78a`)

### Email HTML is the web circa 2005

I built two templates: signup confirmation and password reset. But email HTML isn't the web we know. Gmail, Outlook, and Naver Mail's renderers each strip out CSS in their own arbitrary ways, so there's a fixed set of techniques that actually survives.

- **Layout via `<table>`** — you can't trust flexbox or grid. Nested tables with `role="presentation"` are the standard
- **All styles inline** — a `<style>` block gets stripped entirely depending on the client
- **No web fonts** — fall back to a system Korean-font stack

```html
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
  style="background-color:#F4F6F8;padding:40px 16px;
         font-family:'Apple SD Gothic Neo','Malgun Gothic','Segoe UI',Helvetica,Arial,sans-serif;">
```

There's a reason for the font-stack order too. macOS/iOS pick up Apple SD Gothic Neo, Windows picks up Malgun Gothic, and everything else falls to Segoe UI → Helvetica. If a Korean email's font stack starts with a Latin font, you get the disaster of Korean text rendering in the system default serif font — so I put the Korean fonts first.

### The signup-confirmation email — bundling onboarding in with the verify button

The signup-confirmation template's structure is: a green (#046C4E) header + logo, body copy, a CTA button, and a tip box. I dropped Supabase's substitution variable `{{ .ConfirmationURL }}` into both the button and a fallback link.

```html
<a href="{{ .ConfirmationURL }}" target="_blank"
   style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:700;
          color:#ffffff;text-decoration:none;border-radius:10px;">
  Verify My Email
</a>
```

My favorite part of this email is the tip box under the CTA.

```html
<td style="background-color:#ECFDF3;border:1px solid #CEEBDC;border-radius:10px;padding:14px 16px;">
  <p style="margin:0;font-size:12.5px;line-height:1.6;color:#046C4E;">
    💡 After signing up, <b>just upload a resume file (PDF/DOCX)</b> and AI will
    automatically analyze it and build you an English resume in under a minute.
  </p>
</td>
```

The signup-confirmation email is **the one email with a near-100% open rate.** Stopping at just a verify button would be a waste. Planting one line about "what to do once you're verified" turns the email into onboarding's first page. The automatic resume analysis feature built in Part 3 is this service's "aha moment in under a minute," so I put exactly that here.

### The reset email — same skeleton, different tone

The password-reset template clones the same skeleton as the confirmation email, but swaps the tip box's spot for an **orange security-notice box.**

```html
<td style="background-color:#FEF3E2;border:1px solid #F5DDB8;border-radius:10px;padding:14px 16px;">
  <p style="margin:0;font-size:12.5px;line-height:1.6;color:#B45309;">
    🔒 This link will <b>expire after a certain time</b> for security.
    If you didn't request this, you can safely ignore this email — your password will not be changed.
  </p>
</td>
```

Two mandatory lines for a reset email — that the link expires, and that **it's safe to ignore if you didn't request it.** The latter matters especially. If someone requests a reset using my email, I get the email — and without the note that "ignoring it means your password stays unchanged," a user would panic thinking their account had been compromised. Switching from the same green box to orange was also deliberate — the signup email's box is "try this" (a suggestion), and the reset email's box is "be careful" (a warning).

### Verification: sed variable substitution, then Playwright screenshots

Opening an email template in a browser shows `{{ .ConfirmationURL }}` as plain text, making it hard to see what it actually looks like. The AI assistant made a copy with the variable substituted for a dummy URL via sed, then took Playwright screenshots.

```bash
sed 's|{{ .ConfirmationURL }}|https://matchda.com/auth/callback?code=DUMMY|g' \
  docs/email-templates/confirm-signup.html > /tmp/preview.html
# → open with Playwright and check a desktop-width screenshot
```

Only after visually confirming the rendering did I commit it. For email HTML, the gap between "the code looks right" and "it actually renders that way" is much wider than on the regular web.

### Why commit something that isn't code

These templates aren't code the app imports. They're assets **a human copies and pastes** into Supabase's dashboard, under Auth → Email Templates. Even so, the reason for committing them to `docs/email-templates/` is clear — the moment you paste it into the dashboard, the HTML's source of truth exists only in the dashboard, and the next time even one line needs fixing, it has to be pulled back out of there. An asset outside version control is guaranteed to get lost eventually. Keeping the source in the repo and treating the dashboard as a "deploy target" preserves edit history and makes review possible. Same principle as the terms document in Part 9: the more an asset is managed by a human, the more it needs to live in git.

## Step 2. Wiring up Resend SMTP — a configuration collaboration story

No matter how pretty the templates got, the 2-4/hour rate limit and the supabase.io sender remained. Custom SMTP was needed, and CLAUDE.md had said "Email: Resend" since day one, so Resend it was. …or so I thought — from here on it was one discovery after another.

### Discovery 1: RESEND_API_KEY was empty

The AI assistant checked the connection status first, and found `RESEND_API_KEY` in `.env.local` was an **empty string.** CLAUDE.md had said "Email: Resend" for months, but it had never actually been connected, not once. As the email digest feature got deprioritized, it had become a ghost dependency existing only in the stack documentation.

This is exactly how a gap between documentation and reality quietly builds up. In Part 9, I'd explicitly named Resend as a data processor in the privacy policy — while the actual Resend account was never even connected. Whether "the documentation is reality" needs periodic verification against the real thing (environment variables, API responses).

### Discovery 2: an unexpected roommate revealed by dig

Attaching a domain to Resend means touching DNS records. Before that, checking the current state — the AI assistant investigated matchda.com's DNS with dig.

```bash
$ dig NS matchda.com +short
ns51.domaincontrol.com.        # GoDaddy nameservers
ns52.domaincontrol.com.

$ dig MX matchda.com +short
10 mxa.mailgun.org.            # ...Mailgun?
10 mxb.mailgun.org.
```

Nameservers: GoDaddy — as expected. But the MX record pointed to **Mailgun.** A trace of having attached Mailgun at some point, meaning to build a receiving inbox (like support@). Even I had forgotten about it.

This called for a moment of judgment. Would attaching Resend conflict with Mailgun? The conclusion: **they can coexist.** The MX record decides "who receives mail arriving at this domain" (receiving), while Resend, for sending authentication, creates its own records (SPF/DKIM) on a `send.matchda.com` **subdomain.** Receiving on the root domain is Mailgun; sending on the subdomain is Resend — they touch different records entirely. The habit of taking a dig snapshot of the current state before touching DNS at all is what prevents a secondary incident like "existing mail receiving broke while configuring something else."

### Discovery 3: a key that returns 401 but still sends fine

After adding records to GoDaddy DNS and finishing domain verification in the Resend dashboard (a human's job — more on that below), verifying the issued API key produced something strange.

```bash
$ curl -s https://api.resend.com/domains -H "Authorization: Bearer re_..."
{"statusCode":401,"name":"restricted_api_key","message":"This API key is restricted to only send emails"}
```

Querying the domain list gave a 401. I wondered if the key was wrong, but the error message has the answer right in it — **"a key restricted to send only."** Resend lets you pick a permission scope when creating a key, and a key granted only "Sending access" can call the send API but is blocked from the management API. So this 401 isn't a problem — it's **evidence the principle of least privilege is working correctly.** There's no reason a key meant for SMTP relay should also be able to touch domain configuration. If anything, this deserved praise, so I left the key as-is.

The lesson: don't rush to "the key is wrong" the moment you see a 401. Reading all the way to the error name, `restricted_api_key`, turns this into a confirmation instead of a debugging session.

### The verification chain: direct API send → an actual send routed through Supabase

Whether the connection actually worked was confirmed in two stages. First, sending directly via the Resend API —

```bash
$ curl -s https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" -H "Content-Type: application/json" \
  -d '{"from":"MatchDa <no-reply@matchda.com>","to":["..."],"subject":"[Test] Resend connection check","html":"<b>OK</b>"}'
{"id":"a1b2c3d4-..."}
```

Succeeded, sent from `no-reply@matchda.com`. This means domain verification and the key are both alive. But this only confirms things up to Resend — the actual path is **Supabase → Resend SMTP.** After entering the SMTP settings in the Supabase dashboard (host smtp.resend.com, user resend, password the API key), I reused the exact feature built in Part 10 as a way to fire off the full path at once.

```ts
// the easiest trigger to make Supabase actually send mail through SMTP
await supabase.auth.resetPasswordForEmail('my email', { redirectTo: ... })
```

A few seconds later, what arrived in the inbox was — sent from `no-reply@matchda.com`, a branded reset email with the orange box built in Step 1. This was the moment all three layers — template, SMTP, DNS — got verified at once. The 2-4/hour limit was also lifted at this point, up to Resend's own limit (100/day on the free tier).

### Dividing roles between human and AI — the AI can't click a dashboard

The collaboration structure of this task was noticeably different from every coding session so far. Summarized, it looks like this.

| Step | Owner | Why |
|---|---|---|
| Investigating current state (env, dig, API verification) | AI | Doable via CLI |
| Writing template HTML, verifying via screenshots | AI | The world of code and Playwright |
| Adding GoDaddy DNS records | Human | Dashboard clicks |
| Registering the domain and issuing a key on Resend | Human | Dashboard clicks |
| Configuring Supabase SMTP, pasting the templates | Human | Dashboard clicks |
| Verifying and debugging each step's result | AI | Confirmable via curl and actual sends |

Both Resend and Supabase have management APIs, but unless you issue and hand over that token, the AI can't click the dashboard on your behalf. So collaboration became a relay of **"AI prepares the exact values and order → human pastes them in → AI verifies immediately."** What's interesting is that this structure turns out safer than expected. After the Part 2 incident, I'd decided to require human confirmation for infrastructure-tier write operations — and dashboard configuration structurally has to go through human hands anyway, so that rule gets followed automatically. Meanwhile, typos that creep in while a human is pasting things get caught by the AI's verification step — if the actual-send test hadn't existed, an SMTP misconfiguration could have sat there silently until the next signup revealed it.

## An open item: does support@matchda.com actually receive mail?

One thing was left unverified. In Part 9, I listed `support@matchda.com` as a contact channel in the terms and support pages, but whether the Mailgun MX record seen via dig is actually routing mail to that address hasn't been verified yet. Resend is send-only, so this is unrelated to it — it's purely a question of Mailgun-side configuration. **If you send mail to the address written in the policy documents, does it actually reach someone** — this needs to be verified next session, the same way sending was verified (send from an external inbox → confirm receipt). Since the RESEND_API_KEY gap between documentation and reality turned up once already this time, it's safer to assume the same kind of gap exists on the receiving side too.

## Common patterns, summarized

| Situation | Pattern |
|---|---|
| Email HTML layout | Nested `<table role="presentation">` + everything inline, no `<style>` block |
| Korean email fonts | Put system Korean fonts first: `'Apple SD Gothic Neo','Malgun Gothic',...` |
| The signup-confirmation email | Verify CTA + an onboarding tip box leveraging the ~100% open rate |
| The reset email | Expiration notice + "safe to ignore if unrequested," a warning-tone (orange) box |
| Previewing a template | sed-substitute `{{ .variable }}` → Playwright screenshot |
| A dashboard-pasted asset | Keep the source in git (`docs/email-templates/`) — the dashboard is the deploy target |
| Before touching DNS | Snapshot current state with `dig NS`/`dig MX` — check for conflicts with existing mail receiving |
| Coexisting receive/send | Receiving (MX) on the root domain, sending (Resend) on a subdomain — records don't overlap |
| Resend restricted-key 401 | Read the error name (`restricted_api_key`) first — a least-privilege key behaving this way is normal |
| Verifying an SMTP connection | Direct API send → then trigger the app's own feature (resetPasswordForEmail) for a real, full-path send |
| Collaborating on dashboard configuration | AI prepares values/order → human pastes them → AI verifies immediately via curl and an actual send |

## Summary

1. **An auth email isn't a feature — it's a first impression.** A subject line of "Confirm your signup" and a supabase.io sender don't break anything functionally, but they mean the very first thing a user receives from the service arrives under someone else's brand. And the default SMTP's 2-4/hour limit is a seed for a service outage before it's even a branding issue — custom SMTP isn't a "do it later" item, it's mandatory at the point signup goes live.
2. **Periodically cross-check stack documentation against the real thing.** CLAUDE.md's "Email: Resend" had been wishful thinking for months, and in the meantime it had even made its way into the privacy policy. One empty environment variable exposed the gap between documentation, legal documents, and reality. A dependency written in documentation needs to mean "verified," not just "written down."
3. **In configuration collaboration, the AI's place is investigation and verification.** Clicking the dashboard is a human's job, but everything around it — snapshotting current DNS with dig, pinning down what a 401 actually means, verifying the whole path via an actual send — the AI does far faster and more thoroughly. The relay of "AI prepares → human executes → AI verifies" turned out to be a genuinely useful collaboration shape for infrastructure work outside of code.
4. **Always verify via the real path.** A successful direct send via the Resend API is only half the verification. The path an actual user rides is Supabase → SMTP → Resend, and that path is only verified by triggering the app's own feature (resetPasswordForEmail). Just as the feature built in Part 10 became Part 11's test tool, a well-built feature doubles as an infrastructure verification tool.

Now, signing up for MatchDa gets you a Korean-language email with a green header and the handshake-M logo, arriving from no-reply@matchda.com. Users won't notice a thing — and for infrastructure work, that's exactly the definition of success.
