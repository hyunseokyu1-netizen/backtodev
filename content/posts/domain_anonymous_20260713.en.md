---
title: 'How to Keep Your Domain as Anonymous as Possible — An Anonymization Guide for Side Project Owners'
date: '2026-07-13'
publish_date: '2026-11-20'
description: What WHOIS privacy actually means and where its limits are, from choosing a registrar to actually buying a domain on Cloudflare, connecting it to Vercel, and verifying anonymity with whois
tags:
  - Domain
  - WHOIS
  - Cloudflare
  - Privacy
  - DNS
---

I'm running an anonymous community side project. Users post without signing up, completely anonymously — but when it came time to actually connect a domain, a thought hit me: **"My users are anonymous, but couldn't I, the operator, get fully exposed by a single WHOIS lookup?"**

Before buying the domain, I researched ways to keep the operator as hidden as possible, and ended up buying `nogari.org` through Cloudflare Registrar and connecting it to Vercel. This is the record of that whole process — research through to the actual connection and verification. Here's the conclusion up front:

> **You can easily get to a level where "no ordinary person, however hard they dig, can find you." But a complete anonymity where "not even legal process can find you" is impossible.**

Understanding that difference is half of what this post is about.

## What WHOIS Privacy Actually Means

When you register a domain, your name, email, address, and phone number go into the registration record. In the old days, all of that was fully exposed to anyone doing a WHOIS lookup. Now, post-GDPR, most registrars provide **WHOIS privacy** (privacy protection) by default, so a lookup returns the registrar's proxy information instead.

One important thing here:

> WHOIS privacy **hides your info from public lookups** — it doesn't mean the registrar itself doesn't know who you are.

Under ICANN rules, registrars are obligated to keep the real registrant's information on file. So anonymity splits into layers like this:

| Layer | Who can find you | How to get there |
|---|---|---|
| 0. Wide open | Anyone (WHOIS lookup) | Registering without privacy protection |
| 1. Public anonymity | Registrar, payment processor, courts | WHOIS privacy |
| 2. Strong anonymity | Proxy registration service, courts (to a limited extent) | Proxy ownership + crypto payment |
| 3. Full anonymity | — | **Impossible** (payment/account trails always remain) |

For a side project operator, realistically the target is **Layer 1**, or **Layer 2** if the subject matter is sensitive.

## Before You Start — .kr Is Out From the Beginning

Korea's country-code domains (.kr, .co.kr) run on KISA's real-name registration system, which makes anonymization structurally difficult. If anonymity is the goal, you need to go with a gTLD (.com, .net, .xyz, .chat, .club, etc.) from the start.

In exchange for giving up the trust that a .kr domain conveys, you get more than just anonymity — cheaper pricing from overseas registrars and freedom to transfer the domain.

## Step 1 — Choosing a Registrar: Practical vs. Anonymous

### The Practical Camp: Cloudflare Registrar / Porkbun (Layer 1)

- **WHOIS privacy is free by default.** A lookup won't return your name, email, or address.
- Cloudflare Registrar sells **at cost (zero margin)**, so renewal fees are among the industry's lowest, and you get DNS management in the same place.
- Porkbun also offers free privacy and a wide selection of gTLDs.
- Limitation: your real name stays on file with the registrar and your card company. A court order will reveal your identity.

### The Anonymous Camp: Njalla (Layer 2)

A Swedish privacy-focused service with a unique structure: **Njalla registers the domain under its own name and grants you a license to use it.**

- Your info doesn't appear anywhere in WHOIS. It's not being hidden behind a proxy — you simply aren't the registrant to begin with.
- It supports crypto payment, so you can minimize the payment trail too.
- **The trade-off is significant**: since Njalla is the legal owner, if a dispute arises it's hard to assert ownership of the domain, and pricing runs 1.5-2x a regular registrar. The moment your service grows and the domain becomes a real asset, this structure becomes a liability.

| | Cloudflare / Porkbun | Njalla |
|---|---|---|
| WHOIS public info | Hidden behind a proxy | None at all (proxy ownership) |
| Registrar holds your identity | Yes | Just an email, roughly (if paying with crypto) |
| Legal domain ownership | You | Njalla |
| Price | At cost to cheap | Expensive ($15+/year) |
| Best for | Most side projects | Cases where identity exposure itself is the risk |

For my own personal side project, I concluded that Cloudflare Registrar + WHOIS privacy is enough. The goal is keeping users, reporters, or curious people from finding me — not evading law enforcement.

## Step 2 — Plugging the Leaks Outside the Domain Itself

Hiding just the domain is pointless if you're leaking everywhere else. Here are the exposure points that made me go "oh, I didn't know about that" while researching this.

### 1. Account Email — Actually a Bigger Hole Than the Domain

If your Vercel, Supabase, and registrar accounts are all tied to your personal Gmail, hiding the domain's WHOIS is worthless the moment that email leaks somewhere in the service. (Even a masked email on a password-reset screen can be enough of a hint.)

- Create a new project-only email — a Proton Mail address or a SimpleLogin alias.
- Unify domain registration, hosting, and DB accounts all under this one email.

### 2. DNS Records — Exposing the Origin Server's IP

If an A record points directly at your hosting server's IP, tracing that IP back reveals your infrastructure. **Turning on Cloudflare DNS's proxy (the orange cloud)** means only Cloudflare's IP is visible externally. A PaaS like Vercel already uses shared IPs so the exposure risk is lower anyway, but adding one more layer of proxy definitely makes tracing harder.

### 3. GitHub Commit Author — Your Real Name Leaks the Moment You Go Public

This one was an unexpected trap. The moment you flip a repository to public, **every commit's author name and email gets exposed as-is.** If `git log` has your real name and personal email baked in, a single GitHub link in your site's footer is enough to blow your anonymity.

```bash
# 내 저장소 커밋에 뭐가 박혀 있는지 확인
git log --format='%an <%ae>' | sort -u
```

- If the repo is going to be public, configure your commits to use GitHub's noreply email (`123456+username@users.noreply.github.com`) and an alias name.
- If real-name commits have already piled up: either keep the repo private, or rewrite history (`git filter-repo`).

### 4. The Site Content Itself

- Check whether the footer, about page, or contact email contain any personally identifying info
- Check places like OG meta tags, error pages, or a `humans.txt` for your name
- Image EXIF data (if you're uploading photos you took yourself, they may contain location data)

## Step 3 — In Practice: Buying on Cloudflare and Connecting to Vercel

I bought `nogari.org` through Cloudflare Registrar. I handled the connection with the Vercel CLI, and actually going through it, I ran into a trap the docs didn't mention.

### 3-1. Adding the Domain to Vercel

```bash
vercel domains add nogari.org           # 계정에 도메인 등록
vercel domains add nogari.org nogari    # 프로젝트에 연결
```

But the second command threw this error:

```
Your project's latest production deployment has errored.
Therefore, the domain cannot be assigned. (400)
```

**If the latest production deployment is in an errored state, you can't attach a domain.** As luck would have it, the commit I'd pushed right before (a type error in a seed script) had broken the build. I didn't expect that trying to connect a domain would turn into fixing a build first. Only after I pushed a commit that passed `tsc --noEmit` locally, and the deployment came back to Ready, did the connection go through.

### 3-2. Cloudflare DNS Records

Running `vercel domains verify nogari.org` tells you which records you need:

| Type | Name | Content | Proxy |
|---|---|---|---|
| CNAME | `@` | `xxxx.vercel-dns-017.com` (unique per domain) | **DNS only (grey cloud)** |
| A | `www` | `76.76.21.21` | **DNS only (grey cloud)** |

I need to correct a piece of advice from the earlier section here. I'd planned to turn on Cloudflare's proxy (the orange cloud) to hide the infrastructure IP, but **Vercel explicitly says to leave the proxy off for this record** (`disableProxy: true`). Turning it on messes up SSL certificate issuance. Vercel's IP is shared by a huge number of sites anyway, so there's effectively no anonymity cost to leaving the proxy off — the earlier proxy advice only applies to self-hosting, where the origin server's IP is actually exposed.

One more thing: Vercel also offers "switch your nameservers to Vercel" as a recommended option, but doing that would defeat the point of managing DNS through Cloudflare, so I went with **keeping the nameservers on Cloudflare and just adding the records.**

### 3-3. Verification — Seeing With My Own Eyes Whether I'm Really Anonymous

Within a few minutes of adding the records, verification passed, and Vercel auto-issued the HTTPS certificate. Last, the thing I was really curious about — does WHOIS show me:

```bash
whois nogari.org | grep -iE "registrant|email|phone|name"
```

Result: not a single line shows my name, email, address, or phone number. All that's visible is contact info for Cloudflare (the registrar) and the .org registry. Cloudflare Registrar applies WHOIS redaction **by default, for free, and without even an option to turn it off**, so I didn't even need to configure anything separately. That's a decisive difference from registrars that sell privacy protection as a paid add-on.

A bonus I picked up along the way: the old `projectname.vercel.app` address can expose your team/account slug in the URL (preview URLs carry the account name as-is), so switching to a custom domain adds a layer of anonymity all on its own.

## Troubleshooting Summary

| Symptom | Cause | Fix |
|---|---|---|
| `domain cannot be assigned (400)` | Latest production deployment is in an Error state | Fix the build to get it back to Ready, then retry |
| SSL error after connecting the domain | Cloudflare proxy (orange cloud) turned on | Set records intended for Vercel to DNS only |
| WHOIS still shows my info | Registrar without privacy protection applied | Cloudflare/Porkbun apply it by default — verify with a lookup |

## Legal Limits — Know This Going In

An anonymous community (especially one where the subject matter involves real people) is the kind of service that can draw defamation complaints. In that case, the other party doesn't go after your domain WHOIS — they pursue legal process against your hosting, DB, and payment records. In other words:

- Domain anonymization = **anonymity from the general public** (plenty valuable on its own)
- Domain anonymization ≠ anonymity from legal liability (impossible to begin with, and shouldn't be the goal)

Separate from anonymizing the operator, having solid operational machinery — handling reports, moderation, and so on — is the real safeguard that protects the service.

## Wrap-Up

Summarized as a checklist:

1. **gTLD instead of .kr** — avoid real-name registration systems
2. **A registrar with WHOIS privacy by default** — Cloudflare Registrar or Porkbun (Njalla if the subject is sensitive)
3. **Confirm the production deployment is Ready before connecting** — an Error state will get the domain connection itself rejected
4. **Keep the proxy off for Vercel's DNS records** — leave the nameservers on Cloudflare, just add the records
5. **Verify directly with `whois` after connecting** — you only feel safe once you've checked with your own eyes
6. **A project-only email** — keep domain, hosting, and DB accounts completely separate
7. **Check the GitHub commit author** — run `git log --format='%an <%ae>' | sort -u` before going public
8. **Check the site content** — footer, meta tags, EXIF, and any `*.vercel.app` links scattered through the copy
9. **Know the limits** — payment and account trails remain. The goal is "anonymity from the general public"

Looking back, the biggest takeaway was that the accounts and git history around the domain are a bigger hole than the domain itself. Just hiding WHOIS and feeling safe is like locking the front door while leaving every window wide open. And once I actually went through the connection process, even the advice from my own research phase (turn the proxy on) got overturned in practice (Vercel says turn it off) — which is a reminder that posts like this one are only as trustworthy as the amount you've actually done yourself.
