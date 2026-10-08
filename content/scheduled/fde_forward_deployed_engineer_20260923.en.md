---
title: 'What Is an FDE (Forward Deployed Engineer)? The Job Title Showing Up in Postings Lately'
date: '2026-09-23'
publish_date: '2027-01-02'
description: A rundown of the FDE role, which started at Palantir and is now being hired for by Korean AI companies too, covering how it differs from SI/consulting and what skills it actually requires
tags:
  - FDE
  - Career
  - AI
  - Developer
---

Browsing job boards, I ran into a title I'd never seen before.

**FDE (Forward Deployed Engineer).**

Translated literally, it's something like "a front-deployed engineer." At first I thought it was some kind of military term. Looking into it, the role actually started at Palantir, and lately Korean AI and data companies have started hiring under this same name too.

Reading through a posting, I stopped on one line.

> "Defines the customer's problem, and plans, proposes, and executes a feasible solution."

That's exactly what I'd been doing for 15 years. Every time I moved companies, I'd walk into a place where something had broken, figure out the root cause, build a system, and move on. But over that time my title was developer, then team lead, then PM. **The thing I actually did never had a name.**

I'm sharing what I put together while looking into this role. I hope it helps anyone who, like me, searched "what is this?" and landed here.

---

## 1. What Is an FDE — In One Sentence

**An engineer who goes directly into the customer's company, defines the problem, builds the solution, hands it off, and leaves.**

It's not just advising, and it's not just building what you're told. It's both. That's the key point.

That's exactly why Palantir created this role. They sold software to government agencies and large enterprises, but the customers didn't know how to apply it to their own problems. And building from requirements wasn't an option either, because the customers didn't know how to define requirements in the first place. So they sent engineers directly to the customer's site — go look for yourself, define it yourself, build it yourself.

That's where the term "Forward Deployed" comes from. It doesn't mean sitting at headquarters picking up tickets — it means being stationed at the front line, where the customer is.

---

## 2. How Is It Different From SI/Consulting

This is the question that comes up most. Here it is as a table.

| | What it does | Where it ends | Structural limit |
|---|---|---|---|
| **Consulting firm** | Diagnoses and hands over a strategy report | Submitting the report | The customer can't execute |
| **SI** | Takes requirements and builds | Delivery and acceptance | Can't start without requirements |
| **Solution company** | Sells a product and supports adoption | Adoption complete | Has to fit the customer to the product |
| **FDE** | Everything from diagnosis to build and handoff | **When the customer can run it themselves** | Headcount is the revenue ceiling |

Summed up in one line:

```
Consulting firms don't build
SI doesn't define
Solution companies fit the customer to the product

FDEs define, build, and hand off
```

### "So how's that different from an SI developer?"

Anyone looking into this role ends up asking this. So did I. And in practice, the Korean job market has postings mixed in that are **FDE in name only, with SI underneath.**

The way to tell them apart is to look at the actual wording of the posting.

| Phrasing closer to a real FDE | Likely FDE in name only |
|---|---|
| "**Defines** the customer's problem" | "Develops according to requirements" |
| "**Designs the right choice** from an ROI/TCO perspective" | "Implements based on a design document" |
| "**Defines their own** working environment and location" | "On-site residency required" |
| "Hands off so the customer can **operate it themselves**" | "Maintenance support" |

**The key is whether the word "define" shows up.** Without the authority to decide what to build, you're not an FDE — you're a dispatched developer.

---

## 3. What's Required of an FDE

Collecting postings from several companies, the common threads are clear.

### Required skills

| | Why it's needed |
|---|---|
| **3+ years of hands-on development** | Backend, data engineering, or BI — one of these. You need to be able to build it yourself |
| **SQL and DB understanding** | Shows up in nearly every FDE posting. Because you need to **dig into the customer's own data directly** |
| **Customer-facing comfort** | "Someone who isn't uncomfortable with direct communication" — half the job is dealing with people |
| **Using AI tools** | The assumption is that you can handle many tasks on your own with a coding agent |

### What the "nice to have"s reveal

- Experience **defining and solving a problem** in ERP, CRM, BI, cloud, or infrastructure
- Experience creating real change in how work gets done, **even if it was just with Excel or a SaaS tool**

That last line is interesting. It's not about some grand system — it's about whether you've changed how work gets done, even with Excel. What an FDE actually does is captured entirely in that one line. It's not the tech stack they're screening for — it's **experience creating change.**

---

## 4. Why Did This Role Emerge Now

FDE has existed as a concept at Palantir for over a decade, but its sudden rise in Korea is recent. I think there are two reasons.

### ① AI agents started taking over implementation

In the past, "building" itself was the bottleneck. Once requirements were set, implementing them took months.

It's different now. I've felt this myself over the last few months, building several services with AI coding agents — **implementation speed has stopped being the problem.** And when that happens, the bottleneck shifts upstream.

```
예전 병목:  요구사항 → [구현] → 배포
지금 병목:  [무엇을 만들까] → 구현 → 배포
```

The person deciding what to build, the person judging when it's actually done — that person matters more now. That's the seat an FDE fills.

### ② Small and mid-sized companies want to adopt AI but don't know how

Large enterprises have an internal strategy team and an IT organization. Hand it to a consulting firm and you get a report; order it from an SI vendor and you get it built.

Small and mid-sized companies don't have that luxury.

- They want to "adopt AI," but can't define what to actually build
- With no requirements, a dev shop can't even quote a price
- Even once something is built, they can't judge whether it's any good

FDE is the role created to fill that gap — a structure where one person carries everything from diagnosis to build, through to handing off so the customer can run it themselves.

---

## 5. Who This Role Fits

Criteria I put together after going through a bunch of postings and case studies.

### Likely a good fit

- **A career that's bounced across domains.** Usually read as "no consistency," but since the customer changes every time with FDE, that's actually a requirement
- **Someone who's both developed and planned.** You need to be able to judge effort yourself, so you can say on the spot, "this is two weeks, that's two months"
- **A habit of digging into the raw data first.** The kind of person who checks the source data before the dashboard
- **Someone who's lived through "we built it and nobody used it."** Having that experience changes how you approach things

### Likely not a good fit

- **Someone who wants to go deep on one technology.** FDE spreads wide. Depth only goes as far as each domain needs
- **Someone uncomfortable facing customers.** Interviewing and persuading is half the job
- **Someone who wants to polish things to completion.** Here, "knowing when to stop" matters more

---

## 6. Five Things to Check When Reading an FDE Posting

Since the same title often hides very different content, here are the five things I check.

**① Is problem definition actually part of the job?**

If "defines the customer's problem" is there, it's closer to the real thing. If it's missing and all you see is implementation talk, it's SI.

**② What does the on-site arrangement look like?**

Is it getting a desk at the customer's office and sitting there for months, or interviewing, building internally, and visiting again? The former is closer to dispatch work. This is something you absolutely have to ask about in the interview.

**③ Who does the diagnosis?**

Depending on the company, a consultant or a separate team might handle the front end. In that case, the FDE could end up just being the one who builds what's handed over. Check **whether the FDE is involved at the diagnosis stage.**

**④ What's left after the project ends?**

If one FDE finishes one project, headcount directly caps revenue. So **how the company accumulates reusable assets for the next customer** shows you how mature it actually is.

**⑤ Compensation and growth path**

Whether compensation is decided by capability rather than tenure, and whether there's somewhere to grow into. Asking how far you can go starting as an FDE tells you whether the company actually takes this role seriously.

---

## 7. What Personally Stuck With Me

One sentence stuck with me more than anything else while researching this role.

> **If you build it and nobody uses it, none of it means anything.**

I've lived this myself. I'd build a good system for a site, and nobody would use it. They'd just keep using a program that was 20 years old. The reason is simple: it's comfortable. Because the cost of switching falls on the people on the ground.

So when I go into a site, I use an approach of **leaving what they already use exactly as it is.** People resist when you tell them to change their screens, but if you tell them they don't have to change anything, there's no reason to resist. I just pull the data in from behind the scenes and wire it together, and once that's accumulated, I design the structure. The system itself comes last.

I think this is exactly the kind of work that remains in an era where AI agents write the code. **Deciding what to build, and making sure it actually gets used.** I think that's exactly why this FDE role has emerged now.

---

## 8. Wrap-Up — FDE at a Glance

| | |
|---|---|
| **One-line definition** | An engineer who goes into the customer's company, defines the problem, builds it, hands it off, and leaves |
| **Origin** | Palantir. Korean AI/data companies have recently started adopting it |
| **Difference from SI** | SI takes requirements and builds; FDE **starts from defining the requirements themselves** |
| **Difference from consulting** | Consulting ends at the report; FDE **builds it and makes it actually run** |
| **Required skills** | 3+ years of hands-on development + SQL/DB + customer-facing ability + using AI tools |
| **Core attitude** | Decides **"what counts as done"** before "what to build" |
| **Most common failure** | Building something the site doesn't end up using |
| **What to check in postings** | Whether "defines the problem" is there, the residency arrangement, and whether they participate in diagnosis |

If you're looking into this role, check first whether a posting has a phrase like "defines the customer's problem" — before you even look at the tech stack. If it's missing and all you see is build talk, it might be FDE in name only.

And if you've bounced between domains enough to have been told your career "lacks consistency," that becomes a strength in this role. That's exactly why it caught my interest too.
