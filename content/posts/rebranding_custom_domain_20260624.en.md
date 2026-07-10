---
title: 'Renaming a Service: Custom Domain Setup and the OAuth Redirect Trap (Vercel + GoDaddy + Supabase)'
date: '2026-06-24'
publish_date: '2026-07-18'
description: A field report of rebranding from JobRadar to matchda.com — buying the domain, connecting it to Vercel, GoDaddy DNS, and Supabase Auth configuration
tags:
  - Vercel
  - GoDaddy
  - Supabase
  - DNS
  - OAuth
---

Building a side project, at some point the name stops sitting right with you. It happened to me too. I started out building an AI job-matching service under the name "JobRadar," but one day it hit me — **this product's core isn't "radar" (detecting), it's "matching."** The real value wasn't scraping job postings — it was scoring how well my background matched a posting.

So I decided to switch to `matchda.com`. A name combining "match" with the Korean "~다" (meaning "matches/fits"). Since Korean-speaking users (people prepping for jobs abroad) are the target audience, I figured this double meaning would land well.

This post is a record of what it took to go from **not just renaming, but actually buying a new domain and connecting it to the service.** There were more traps than expected — especially in the OAuth section at the end.

## Rebranding wraps up in 3–4 spots of code

Once I got started, code changes turned out surprisingly small. Searching the entire repo for "JobRadar" turned up 35 hits, but **only 4 files were actually user-facing.**

```bash
grep -rniI "jobradar" --exclude-dir=node_modules --exclude-dir=.next .
```

| Location | Nature |
|------|------|
| `layout.tsx` | browser tab title + header logo |
| `Landing.tsx` | landing page copy |
| `login/page.tsx` | login screen |
| `package.json` | project name |

The rest were README, planning docs, comments — things that could be cleaned up slowly. I also swapped the logo emoji from radar (📡) to something evoking matching, 🎯.

> Tip: it's better to do a rebrand **all at once, after finalizing the name.** Half-heartedly changing only half of it leaves you confused later about how far you got.

Everything up to here was easy. The real work started with connecting the domain.

## Step 1. Buy the domain, connect it to Vercel

I bought the domain on GoDaddy (doesn't matter where). The first step after purchase is **attaching this domain to a Vercel project.**

Just use the Vercel CLI.

```bash
vercel domains add matchda.com
vercel domains add www.matchda.com
```

Running this shows a warning like this.

```
WARNING! This domain is not configured properly.
  a) Set the following record on your DNS provider: A matchda.com 76.76.21.21 [recommended]
  b) Change your Domain's nameservers to: ns1.vercel-dns.com / ns2.vercel-dns.com
```

Here's the important part: **"connected to the project" and "DNS configured" are separate things.** Adding a domain to Vercel isn't the end — where you bought the domain (GoDaddy) also needs a DNS record set saying "this domain points to Vercel."

For reference, `vercel domains inspect` shows the current nameservers, which also tells you where you bought it from. In my case, `domaincontrol.com` showed up, confirming it was GoDaddy.

## Step 2. Setting GoDaddy DNS records (and a CNAME conflict)

Go into GoDaddy's domain management → DNS records. Two things need setting.

| Type | Name(Host) | Value |
|------|-----------|-------|
| **A** | `@` (apex) | `76.76.21.21` |
| **CNAME** | `www` | `cname.vercel-dns.com` |

`76.76.21.21` is Vercel's static IP. An apex domain (`matchda.com` with no www) can't use CNAME, so it points to this IP via an A record instead.

But here's where I hit **the first trap.** Trying to add an A record for `www` threw this error:

> Record name www conflicts with another record.

The reason was simple. **GoDaddy sets up a `CNAME www → @` by default.** And by DNS rules, **you can't have both a CNAME and an A record for the same name (www) simultaneously.** Hence the conflict.

The fix is to not create a new record, but **just edit the existing CNAME's value**:

- ❌ add a new `A www 76.76.21.21` → conflict
- ✅ **edit** the existing `CNAME www`'s value to `cname.vercel-dns.com`

This cleared without issue. (Actually, leaving GoDaddy's default `CNAME www → @` alone would technically work too, since www eventually routes through apex to the same IP. But Vercel might show a "not configured" warning, so explicitly changing it is better.)

## Step 3. SSL gets issued automatically

Save the DNS and wait a bit (under an hour typically), and Vercel **automatically issues an SSL certificate.** A free Let's Encrypt certificate. Nothing else to do.

I checked propagation status like this.

```bash
# Is DNS pointing to Vercel
dig +short matchda.com A          # → 76.76.21.21
dig +short www.matchda.com CNAME  # → cname.vercel-dns.com

# HTTPS response + certificate
curl -s -o /dev/null -w "%{http_code}" https://matchda.com   # → 200
echo | openssl s_client -servername matchda.com -connect matchda.com:443 2>/dev/null \
  | openssl x509 -noout -issuer -dates
# issuer=Let's Encrypt ... notAfter=...
```

`matchda.com` returned 200 and even the branding showed up correctly. At this point it feels like 90% done — but **the last 10% was the most painful part.**

## Step 4. The domain changes after logging in? (The OAuth redirect trap)

I tried logging in on the new domain. Login worked. But **right after login, the address bar switched back to the old domain (`...vercel.app`).** This was the most confusing bug.

Tracing the cause, it was in the **OAuth/magic link auth flow.** My app handles login via Supabase Auth, and the flow looks like this.

```
matchda.com → Google login → Supabase callback → (where does it send us back?) → back to the app
```

In the code, I'd clearly written it to return based on the current address.

```ts
// The code is origin-based, so it shouldn't be tied to a domain
options: { redirectTo: `${window.location.origin}/auth/callback` }
```

The problem is that **Supabase doesn't redirect back to just any address.** For security, it only redirects to an address on **an allowlist of approved URLs.** And **if it's not on the allowlist, it ignores the request and falls back to the Site URL (the default address).**

So my situation was:
1. I asked to return to `matchda.com/auth/callback`
2. That address wasn't on Supabase's allowlist
3. Supabase **fell back to the Site URL (still the old domain)** → hence the domain switching back

**The fix** is in Supabase's dashboard → Authentication → URL Configuration:

- **Site URL**: change to `https://matchda.com` ← this is the key part
- Add to **Redirect URLs**:
  - `https://matchda.com/**`
  - `https://www.matchda.com/**`

This setting is **on Supabase's server side, not in the code**, so deploying alone will never fix it. This is the easiest part to miss when moving to a new domain.

## Bonus: "redirecting to supabase.co" is normal

After finishing the config and logging in with Google, the consent screen showed this text.

> Redirecting to wezyyzxsczhosqdboamh.supabase.co

I was confused thinking "why is it showing supabase.co instead of my domain?" but **this is normal.** The Google consent screen displays the OAuth **callback destination** (= the Supabase project address). Every app using an auth-broker service like Supabase or Auth0 shows the exact same thing.

To make it show your own domain:
- **Free**: brand just the app name/logo in Google Cloud Console → OAuth consent screen (the "...redirecting to supabase.co" host line stays, though)
- **Paid**: connect a custom auth domain like `auth.matchda.com` via Supabase's Custom Domain add-on

For an early-stage service, leaving it as-is has zero impact on functionality or security.

## Frequently used commands, summarized

```bash
# Connect a domain to a Vercel project
vercel domains add matchda.com
vercel domains add www.matchda.com

# Check domain config/nameservers
vercel domains inspect matchda.com
vercel certs ls                       # confirm SSL cert issuance

# Check DNS propagation
dig +short matchda.com A
dig +short www.matchda.com CNAME

# Check HTTPS + certificate
curl -s -o /dev/null -w "%{http_code}" https://matchda.com
echo | openssl s_client -servername matchda.com -connect matchda.com:443 2>/dev/null \
  | openssl x509 -noout -issuer -dates
```

## Summary

The full flow of rebranding onto a new domain, at a glance:

1. **Code**: swap only user-facing strings (surprisingly, just 3–4 spots)
2. **Vercel**: connect the domain to the project via `vercel domains add`
3. **DNS (GoDaddy)**: apex gets `A → 76.76.21.21`, www gets `CNAME → cname.vercel-dns.com` (watch for the existing CNAME conflict)
4. **SSL**: auto-issued by Vercel (nothing to do)
5. **Supabase Auth**: change Site URL + Redirect URLs to the new domain ← **the easiest thing to miss**

The biggest lesson is that last one. **"I deployed the code, why isn't this working?" can have an answer outside the code.** Places where auth, DNS, and SSL tangle with external service settings never show up no matter how hard you stare at the code. When moving a domain, think through "every external service that knows about this address." In my case, that was Supabase.
