---
title: 'Building a SaaS With an AI Coding Assistant (12): Where Does support@matchda.com Actually Go? — Building Domain Email Receiving'
date: '2026-07-05'
publish_date: '2026-08-11'
description: A dead Mailgun MX record exposed by dig, the twist of "oh...no Mailgun...and it costs money...", ImprovMX forwarding wrapped up with zero lines of code — the infrastructure detective story of turning support@matchda.com, which had only ever existed in a policy document, into an address that actually receives mail
tags:
  - ImprovMX
  - DNS
  - MX Records
  - Email
  - AI Coding Assistant
---

## Starting off

Part 11 ended on this note — "if you send mail to the address written in the policy documents, does it actually reach someone." In Part 9, I'd written `support@matchda.com` as the contact channel on the terms and support pages, but left it unverified whether that address actually received anything.

Before I could even bring this item up next session, the product owner beat me to it.

> "I don't think support@matchda.com is the email address made in Resend..."

Exactly right. **Resend is a send-only service.** What got connected in Part 11 is infrastructure for *sending* mail from no-reply@matchda.com — not an inbox that *receives* mail at support@. And though these two often get lumped together, they're completely different layers.

- **Sending**: pushing mail out via SMTP/API. SPF/DKIM records are sender-reputation authentication saying "this server is allowed to send under this domain's name"
- **Receiving**: taking in mail addressed to the domain. The **MX record** is the routing itself — "deliver this domain's mail to this server"

Even with a domain attached to Resend and DKIM passing, not a single inbox exists yet. This part is the record of a pure DNS detective story with not one code commit.

## Step 1. The detective story — discovering a dead MX record

As always, the AI assistant snapshotted the current state first.

```bash
$ dig +short MX matchda.com
10 mxa.mailgun.org.
10 mxb.mailgun.org.
```

MX points to **Mailgun** — the same "unexpected roommate" already spotted once in Part 11. Since MX exists, receiving routing does exist in some form, so maybe all that was needed was checking the Mailgun dashboard for a Route forwarding support@ to gmail... or so it seemed.

> AI: "Do you have a Mailgun account? If so, we need to check whether support@ forwarding is configured in the Routes settings."
>
> Product owner: "Yes, I have one"
>
> (a moment later)
>
> Product owner: "Oh...no I don't have Mailgun...and it costs money..."

A twist. There was no account (or it was already dead). A trace of having pointed MX there once, meaning to build an inbox, and then forgetting about it. Spelling out what this actually means is fairly chilling.

1. An external user sends mail to support@matchda.com
2. The sending mail server looks up MX and tries delivering to mxa.mailgun.org
3. Mailgun has no active account willing to accept matchda.com → it bounces, or gets silently dropped
4. **We have no way of even knowing that mail ever arrived**

This is the scary part of a dead DNS record. No 500 error, no log, no alert. It just quietly evaporates. And the terms page proudly displayed "Contact: support@matchda.com" — that address was a one-way ticket into the void.

## Step 2. Weighing the options — don't write code to solve a problem that needs zero lines of it

I compared four ways to build an inbox.

| Option | Approach | Cost | Reason rejected/chosen |
|---|---|---|---|
| Mailgun Routes | Keep MX + forward via a Route | Paid | No account, and it's paid — rejected |
| Resend Inbound | Delivers incoming mail via **webhook (POST)** | Has a free tier | Requires writing and maintaining forwarder code — rejected |
| **ImprovMX** | **Alias forwarding (support@ → gmail)** | **Free** | **5-minute setup, zero lines of code — chosen** |
| Cloudflare Email Routing | Free forwarding via CF | Free | Requires migrating nameservers themselves from GoDaddy → CF — overkill |

Resend Inbound was tempting for a moment. Since it's a feature that only launched in 2025 (confirmed via web search), the picture of unifying send and receive under the single Resend already in use since Part 11 is appealing. But looking closer at how it works, Resend Inbound doesn't drop incoming mail into an inbox — it **POSTs it to a webhook endpoint.** In other words, building "support@ → gmail" would require:

1. Building an API route to receive the inbound webhook
2. Parsing the body and attachments out of the payload
3. Implementing a forwarder that re-sends it to gmail via the Resend send API, myself

That's an interesting toy project, but all that's actually needed right now is "customer inquiries land in gmail." Webhook-parsing code can have bugs, and if the deployment goes down, inquiry emails go down with it. ImprovMX, on the other hand, is done with signup → alias registration → MX swap, and its failure point sits entirely outside our own code.

I wrote the selection criterion down in one line: **don't write code to solve a problem that needs zero lines of it.** A feature being new and a feature being the right answer are two different things.

## Step 3. Configuration — ripping out the dead record and planting a live one

The division of roles was the exact same relay as Part 11. The AI prepares the precise record values and order, the human clicks the dashboard, and the AI verifies immediately.

What the human did:

1. **Sign up for ImprovMX** → register the domain matchda.com → set up an alias (`support@` → the product owner's gmail, or a catch-all `*@`)
2. In **GoDaddy DNS**:
   - Delete the 2 dead MX records: `mxa.mailgun.org`, `mxb.mailgun.org`
   - Add new MX records: `mx1.improvmx.com` (priority 10), `mx2.improvmx.com` (priority 20)
   - Replace the root domain's SPF TXT: `include:mailgun.org` → `include:spf.improvmx.com`

One thing that absolutely must not be touched here — **leave the Resend records (SPF/DKIM) on the `send.matchda.com` sending subdomain exactly as they are.** As confirmed in Part 11, sending and receiving are separated by subdomain so their records never overlap, and this task only touches the root domain's MX and SPF. Sketched out, the final structure looks like this.

```
matchda.com (GoDaddy DNS)
│
├── Root domain ──── handles receiving
│     MX  → mx1/mx2.improvmx.com     "route incoming mail to ImprovMX"
│     TXT → v=spf1 include:spf.improvmx.com ~all
│     → support@matchda.com ──(forwarding)──> product owner's gmail
│
└── send.matchda.com ──── handles sending (untouched)
      SPF/DKIM → Resend
      → sends from no-reply@matchda.com (including Supabase auth emails)
```

Within one domain, receiving (ImprovMX) and sending (Resend) coexist without knowing about each other. Concerns separated at the DNS level.

## Step 4. The verification chain — running one single email through the entire infrastructure

### 4-1. Confirming MX propagation

Right after swapping the records, the AI confirmed propagation — going as far as querying the authoritative nameserver (GoDaddy) directly, so cache couldn't lie.

```bash
$ dig +short MX matchda.com
10 mx1.improvmx.com.
20 mx2.improvmx.com.

# querying the authoritative nameserver directly — bypassing resolver cache
$ dig +short MX matchda.com @ns51.domaincontrol.com
10 mx1.improvmx.com.
20 mx2.improvmx.com.
```

Mailgun is gone, ImprovMX is alive. The domain status in the ImprovMX dashboard also flipped to green.

### 4-2. An actual-send test — hitting our own inbox with our own sender

This is the verification I liked most in this part. No need to send a test email from outside — **just fire one at support@matchda.com using the Resend send API already wired up in Part 11.**

```bash
$ curl -s https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" -H "Content-Type: application/json" \
  -d '{"from":"MatchDa <no-reply@matchda.com>","to":["support@matchda.com"],
       "subject":"[Test] Verifying support inbound","html":"<b>Success if this arrives in gmail</b>"}'
{"id":"e7f0a3b1-..."}
```

Tracing the path this one email travels — sent from no-reply@matchda.com (**our own sending infrastructure**, the Resend/send subdomain) → an MX lookup on the receiving side → mx1.improvmx.com (**our own receiving infrastructure**) → alias forwarding → **the product owner's gmail.** One single email runs through everything built this day and everything built in the prior part.

A few seconds later.

> Product owner: "The email arrived"

Done. Just as verifying sending ended with "the branded email arrived," verifying receiving ended in one sentence too.

### 4-3. Final confirmation of SPF

I also re-checked the swapped SPF with dig.

```bash
$ dig +short TXT matchda.com | grep spf
"v=spf1 include:spf.improvmx.com ~all"
```

Confirmed even the trace of `include:mailgun.org` was gone, and called it done. ImprovMX's SPF include also plays a role in keeping forwarded mail from getting flagged as spam by gmail.

## The final email infrastructure

Summarized in one table, the full MatchDa email stack at this point:

| Function | Service | Where the records live |
|---|---|---|
| Sending (no-reply@) | Resend | SPF/DKIM on the `send.matchda.com` subdomain |
| Receiving (support@ → gmail) | ImprovMX | Root domain MX + SPF |
| Supabase auth emails | Resend SMTP | (reuses the sending infrastructure) |
| Cost | **entirely free tier** | — |

Code changed: 0 lines. Commits: 0. And yet a hole directly tied to the service's credibility got closed.

## Common patterns, summarized

| Situation | Pattern |
|---|---|
| The question "does email work?" | Check sending (SPF/DKIM, SMTP) and receiving (MX) separately — Resend being connected ≠ an inbox existing |
| Diagnosing receiving status | Start with `dig +short MX domain` — then check whether the service MX points at even has an active account |
| Detecting a dead record | Even with an MX present, mail silently evaporates if the target service has no account — a record existing ≠ it working |
| When all that's needed is forwarding | ImprovMX's free alias — fewer failure points than hand-rolling a webhook forwarder (Resend Inbound) |
| When migrating nameservers is too costly | Cloudflare Email Routing requires an NS migration — ImprovMX is lighter if keeping the existing registrar |
| Coexisting send/receive | Receiving MX on the root domain, sending SPF/DKIM on a subdomain — kept separate so neither touches the other |
| Confirming DNS propagation | `dig +short MX domain @authoritative-nameserver` — bypasses resolver cache to check the source of truth |
| Verifying receiving | Send an actual email from your own sending infrastructure (Resend API) to your own receiving address → confirm it lands in the final inbox |
| After swapping SPF | Re-check with `dig +short TXT` that the old include is completely gone |
| Configuration collaboration | AI prepares record values/order → human clicks the dashboard → AI verifies immediately via dig/curl |

## Summary

1. **Sending and receiving are different infrastructure.** SPF/DKIM is sender reputation — "trust the mail I send" — while MX is receiving routing — "deliver mail addressed to me, here." Verifying a domain with Resend doesn't create an inbox. Hearing "I've got email wired up" should always prompt the question of which side that means.
2. **A dead DNS record fails silently, with no error.** The Mailgun MX had been soundlessly evaporating support@ mail for months, and we would have just assumed inquiries weren't coming in. Run dig before writing an email address into a policy document — following this order back in Part 9 would have meant this open item never existed in the first place.
3. **A feature being new doesn't make it the right answer.** Resend Inbound is an interesting new feature, but it comes with the cost of writing and maintaining webhook-receive → parse → re-send code. If a free forwarding service solves the problem with zero lines of code, that's the right answer. The criterion for choosing a tool isn't "is it new" — it's "how much maintenance burden is left over."
4. **The "AI prepares → human clicks → AI verifies" relay is a reproducible pattern.** The collaboration structure that worked once in Part 11 worked again here, unchanged. The AI handled investigation and verification via dig, curl, and web search; the human clicked the ImprovMX and GoDaddy dashboards. Especially the final actual-send test — hitting your own receiving infrastructure with your own sending infrastructure — was designed by the AI, but the final verdict of "the email arrived" came from a human's inbox.

Now, support@matchda.com on the terms page isn't decoration. If someone actually sends an inquiry, that mail passes through mx1.improvmx.com and lands in the product owner's gmail. Borrowing Part 11's closing line again — users won't notice a thing, and for infrastructure work, that's exactly the definition of success. Except this time there was one more lesson: not being noticed applies just as much to failure, which is exactly why the quieter the infrastructure, the more it needs one round of dig to verify.
