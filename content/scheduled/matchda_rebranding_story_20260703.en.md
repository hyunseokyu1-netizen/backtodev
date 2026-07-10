---
title: 'From JobRadar to Matchda — A Side Project Rebranding Story'
date: '2026-07-03'
publish_date: '2026-07-11'
description: The naming criteria and branding decisions behind renaming the feature-descriptive "JobRadar" to Matchda
tags:
  - Branding
  - Naming
  - SideProject
  - matchda
---

## I figured I'd just rename it later

Starting a side project, I picked the name without much thought. It's a tool that scrapes job postings and matches them, so **"JobRadar."** Intuitive, communicated the meaning instantly. I ran with that for months.

But as the project grew and the thought "should I actually launch this as a real service" crept in, the name kept bugging me. JobRadar was a **name that describes a function**, not a **brand.** Searching around, plenty of similar names existed, and no clean domain was left either.

Eventually I decided to rename it. JobRadar → **Matchda.** This post is a developer's record of agonizing over **a name, not code.** The technical domain-connection and OAuth redirect issues are covered in [a separate post](/posts/rebranding_custom_domain_20260624); here I'm focusing purely on "why and how I picked this name."

## The limits of the name "JobRadar"

First, why I wanted to change it. Picking apart JobRadar revealed these problems.

| Problem | Description |
|------|------|
| **Feature-descriptive** | "Job + Radar." Clear meaning, but that's as far as it goes. Doesn't extend into a brand |
| **Generic** | Way too many services start with "Job." Doesn't stick in memory |
| **Poor extensibility** | If features later expand into resumes/careers, "Job" actually becomes a liability |
| **Domain** | A clean `.com` was already long gone |

**Extensibility** was the big one. Right now it's job-posting matching, but the direction I wanted was broader — "connecting people with opportunities" overall. But with "Job" baked into the name, I'd be locked into that box.

## The meaning behind Matchda

The new name had exactly one condition. **Carry the core value of "matching," but be a brand, not a function description.**

That's where **Matchda** came from. I layered two meanings.

1. **match + da** — meaning "matching every job (opportunity) in the world." I attached "da" for the sense of encompassing everything.
2. **The Korean word "매치다" (maechida)** — carries the sense of the verb "to match." For Korean users, the name itself directly conveys what the service does.

Read in English, it's "match-da"; read in Korean, it's "매치다." I liked that **the same name reads naturally and makes sense in both language communities.** For a service aiming to go multilingual, this turned out to be a fairly significant advantage.

## The criteria for a good name — the checklist I built

While picking the name, I put together my own set of criteria. Worth referencing when naming a side project.

| Criterion | Question | How does Matchda hold up? |
|------|------|-----------|
| **Memorability** | Can you recall it after hearing it once? | ✅ 2–3 syllables, short |
| **Pronunciation** | Natural in both Korean and English? | ✅ 매치다 / match-da |
| **Domain availability** | Can you get the `.com`? | ✅ secured `matchda.com` |
| **Extensibility** | Does the name hold up as features grow? | ✅ centered on the value of matching |
| **Meaning** | Does the name alone give a sense of what it does? | ✅ inferable from "match" |
| **Uniqueness** | Are there a lot of services with the same name? | ✅ relatively rare |

Of these, the one an individual developer most easily overlooks is **domain availability.** No matter how good a name is, if the `.com` is already sold or priced absurdly, it's hard to use. So I flipped my order to **check the domain before settling on a name candidate.** This prevents falling in love with a name first, only to be crushed when there's no domain for it.

> 💡 Tip: the moment a name candidate comes to mind, immediately check `.com` availability on a domain registrar site. Searching for the same name in trademarks and app stores at the same time helps avoid problems down the road too.

## What needs touching when you rename

Renaming one thing turns out to be more work than expected. Here's the actual (or still-pending) list of what got touched.

1. **Domain connection** — registering `matchda.com` and wiring it to deployment *(technical details in a separate post)*
2. **In-service brand name** — logo, header, meta tags, OG image
3. **External-facing spots** — portfolio, about page, links
4. **OAuth redirect URI** — changing the domain also means updating the login callback *(separate post)*

This time, I first updated **my backtodev portfolio.** Changed the card title from JobRadar to Matchda, swapped the site link to the new domain, and added a line in both the Korean and English descriptions saying "originally launched as JobRadar, then rebranded to Matchda." It really hit me then that rebranding **doesn't end at "I changed the name" — it's the process of cleaning up every single touchpoint where the changed name shows up, one by one.**

## Troubleshooting — things I ran into while rebranding

| Situation | Concern/trap | Response |
|------|-----------|------|
| The old name was already baked in all over | GitHub repo name, image filenames, post slugs, etc. | Left anything with link-breaking risk (filenames, slugs) alone; prioritized swapping only the user-facing brand name |
| Users still arriving via the old domain | Links shouldn't suddenly die | Kept a redirect from the old domain to the new one |
| Traces of the old name showing up in search | Indexed under JobRadar on Google | Rather than rushing to erase it, let the transition happen naturally by accumulating new-name content |

The core lesson: **don't try to overhaul everything perfectly in one shot.** It was safer to change touchpoints sequentially, so users, search engines, and existing links weren't caught off guard.

## Summary

- JobRadar was a **feature-descriptive** name, making it hard to grow into a brand
- **Matchda** = "match + da" (matching every job) + the feel of the Korean word "매치다" → makes sense in both Korean and English
- Criteria for a good name: **memorability · pronunciation · domain availability · extensibility · meaning · avoiding duplication**
- For an individual developer, it's important to build the habit of **checking the domain before settling on a name**
- Rebranding isn't swapping a name — it's **the process of cleaning up touchpoints one at a time**

I thought writing good code was all that mattered, but making a service feel like an actual service turns out to start with "what do I even call this." This was the first time I'd agonized this long over a single name, but once I locked in Matchda, my own mindset toward the project shifted. I learned firsthand this time that a name really does set the direction.
