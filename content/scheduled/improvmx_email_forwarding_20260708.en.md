---
title: 'Getting a Free support@yourdomain.com Email With ImprovMX'
date: '2026-07-08'
publish_date: '2026-07-12'
description: How to forward custom-domain email to a personal Gmail account for free, and even send from that address, without a paid mailbox
tags:
  - ImprovMX
  - Email
  - DNS
  - Gmail
  - Domain
---

## I needed `support@matchda.com`

After connecting a domain (`matchda.com`) to my personal project matchda, the next thing I ran into was email. To let users send inquiries, or to put a reply address in service announcement emails, I needed a domain email like **`support@matchda.com`.** Writing something like `matchda.official@gmail.com` just doesn't inspire the same trust.

The problem is cost. To properly run a domain mailbox like this, you'd usually attach **Google Workspace** or paid mail hosting, which charges a monthly fee per account. For a personal project with no revenue yet, paying every month just to receive a couple of inquiries felt like a burden.

That's when I found **ImprovMX.** Short answer: mail sent to `support@matchda.com` gets **forwarded to my personal Gmail for free**, and I can even **reply (send) from that address.** This post is a straightforward writeup of that setup process.

## What is ImprovMX

ImprovMX is a **custom-domain email forwarding** service. The core concept is simple.

```
Someone → sends mail to support@matchda.com
             ↓ (ImprovMX receives it)
        forwards to my personal Gmail
```

In other words, ImprovMX isn't **handing you a mailbox — it's a mail carrier that passes along mail addressed to your domain to a different address.** So all you need to do is point your domain's mail-receiving server (MX) at ImprovMX. Even the free plan covers 1 domain + a few aliases, which is plenty for a personal project.

## Prerequisites

- A domain you own (mine is `matchda.com`)
- **Permission to edit that domain's DNS** (your domain registrar, Cloudflare, etc.)
- A **personal email** to receive mail (mine is Gmail)

## Step 1. Register the domain with ImprovMX

Sign up at [improvmx.com](https://improvmx.com) and add your domain.

1. Enter the domain in the dashboard (`matchda.com`)
2. Specify the receiving address (alias) and destination
   - **Alias**: `support`
   - **Forward to**: `my.personal.email@gmail.com`

This creates the rule "anything sent to `support@matchda.com` goes to my Gmail." But it doesn't work yet. There's still a **DNS setting** left to point the domain's mail server at ImprovMX.

## Step 2. Add MX records to DNS (the key step)

Where mail should go is decided by a domain's **MX (Mail eXchange) records.** These need to point at ImprovMX's servers. The values ImprovMX provides usually look like this.

| Type | Name (Host) | Value (Server) | Priority |
|------|--------------|----------|----------|
| MX | `@` | `mx1.improvmx.com` | 10 |
| MX | `@` | `mx2.improvmx.com` | 20 |

Add these two lines in your DNS editor. A lower `priority` number means it's tried first, so with `mx1` at 10 and `mx2` at 20, mx1 is used first, falling back to mx2 on failure.

> ⚠️ If other MX records already exist (say, from a previous mail service), they need to be removed. If MX points to multiple places, mail can end up going somewhere it shouldn't.

## Step 3. Add an SPF (TXT) record

MX alone gets you receiving, but if you later want to **send from that address**, you need an **SPF** record. SPF is a TXT record specifying "which servers are allowed to send mail under this domain's name." Without it, mail you send is easily flagged as spam.

| Type | Name | Value |
|------|------|-----|
| TXT | `@` | `v=spf1 include:spf.improvmx.com ~all` |

If an SPF TXT already exists (because of another sending service), it needs to be **merged into one** — a domain can only have **one** SPF record. For example, to also allow sending via Gmail, combine them like this.

```
v=spf1 include:spf.improvmx.com include:_spf.google.com ~all
```

## Step 4. Verify — check for the green light

DNS takes time to propagate (usually a few minutes to tens of minutes, up to a few hours). Back on the ImprovMX dashboard, it automatically checks the MX and SPF status.

- 🟢 A green light means setup is complete
- 🔴 A red light means it either hasn't propagated yet, or a value is wrong

Once the green light showed, I sent a test email to `support@matchda.com` from a different email account. Shortly after, it landed in my Gmail inbox. Receiving ends here.

## Step 5. Sending too — "replying" from that address in Gmail

Receiving alone is only half the job. If the sending address goes out as my personal Gmail when replying to an inquiry, that's awkward. I wanted to **appear to send** from `support@matchda.com`. Solved via Gmail's **"Send mail as"** feature.

Gmail Settings → **Accounts and Import** → "Send mail as" → Add an address:

1. Enter a name and `support@matchda.com`
2. Enter SMTP server info — ImprovMX provides free SMTP

| Item | Value |
|------|-----|
| SMTP server | `smtp.improvmx.com` |
| Port | `587` (TLS) |
| Username | `support@matchda.com` |
| Password | the SMTP password issued by ImprovMX |

3. Gmail sends a confirmation email, which comes right back into my Gmail via forwarding. Verify with the link (or code), and that's it.

Now, when replying in Gmail, I can pick `support@matchda.com` as the sending address. From the recipient's perspective, it's a fully domain-based email exchange.

## Limits of the free plan

Being free, there are limits. Worth knowing before adopting it.

| Item | Free plan |
|------|-----------|
| Domain | 1 |
| Alias | limited count (a handful, like support, hello) |
| Sending volume | daily send cap (not suited for bulk sending) |
| Use case | good for **receiving inquiries, low-volume replies** |

The key is that ImprovMX is **forwarding, not a mailbox (storage).** Since mail piles up in my Gmail, if a team wants to use it like a shared inbox, or you need bulk marketing sends, a paid plan or a different solution is the right fit. For an individual project's `support@` front desk, free is more than enough.

## Troubleshooting

| Symptom | Cause | Fix |
|------|------|------|
| Test email doesn't arrive | MX hasn't propagated / typo in the value | wait for DNS propagation, check for the dashboard's green light |
| Dashboard keeps showing red | leftover existing MX record | delete the old MX, leave only ImprovMX's MX |
| Sent mail lands in spam | SPF missing/duplicated | register SPF TXT **merged into one** |
| Gmail send-as verification fails | SMTP password/port error | recheck port 587, the ImprovMX SMTP password |
| Warning that SPF has two lines | only 1 SPF record is allowed | merge the `include:`s into a single line |

## Summary

- Goal: receive **`support@yourdomain` on personal Gmail**, and send from that address too — no paid mailbox
- **Step 1** register the domain + alias with ImprovMX
- **Step 2** add **MX records** (mx1·mx2.improvmx.com) to DNS — the core of receiving
- **Step 3** add **SPF (TXT)** — prevents spam flagging on sends (merged into one per domain)
- **Step 4** check the dashboard's green light + test receiving
- **Step 5** set up Gmail's "send as" + ImprovMX SMTP for sending

Connecting one domain, I found myself wondering "do I have to pay monthly for email too?" — but thanks to ImprovMX, I got **a professional front desk for $0.** Among the small details that make a personal project look like a real service, this was the setup with by far the best cost-to-benefit ratio.
