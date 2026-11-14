---
title: 'How Not to Get Confused by Age Settings When Listing on Google Play'
date: '2026-07-12'
publish_date: '2026-11-15'
description: Learning the hard way that Play Console's content rating and target age group are two separate settings, and what actually happens when you target 13+
tags:
  - Google Play Console
  - App Store Listing
  - Flutter
  - App Deployment
---

# How Not to Get Confused by Age Settings When Listing on Google Play

While registering my mahjong game, "Mahjong Joy," on Play Console for the first time, one item held me up far longer than screenshots or description text ever did. That item is **age settings**.

This is a casual mahjong game with no hand rankings or yaku — you win just by matching tiles — and it even has a beginner mode for anyone who finds score-keeping stressful. It's a great game to play together with a kid, so while looking at the registration form I naturally ran into the question: "so how am I supposed to set the age rating here?"

But when you actually open Play Console, age-related settings aren't in one place — they're split across **two separate sections**. Skating past this without understanding it can land you in unexpected restrictions later when you add ads or new features, so I sat down and sorted it out properly this time.

## Why It's Confusing — There Are Two Separate Items

Play Console's "App content" section has two surveys about age whose names look like they're asking the same thing.

| Item | What it decides |
|---|---|
| **Content rating** (IARC questionnaire) | Asks about violence, sexual content, gambling-like mechanics, and so on, and assigns a rating badge like "Everyone / 12+ / 15+ / 18+" |
| **Target age group and content** | Declares "who this app was made for." Including children brings the Families policy into play |

Going by the names alone, it looks like the same thing asked twice, but they're entirely different questions. One evaluates "how intense is the content," the other declares "who is this app aimed at." The key is understanding that the two don't necessarily move together.

## Step 1: Content Rating (IARC Questionnaire) — Answer Honestly

Clicking "Start content rating questionnaire" in Play Console brings up the standard IARC (International Age Rating Coalition) survey. It asks category by category, and here's how I answered it for Mahjong Joy.

- **Violence / horror content**: None
- **Sexual content / profanity**: None
- **Controlled substances**: None
- **Gambling-like content**: **None** ← I paused here for a moment
- **User interaction**: Has LAN multiplayer, but no chat/messaging feature
- **Location sharing / personal data**: None

The reason I paused on the gambling-content item is that mahjong as a subject is culturally entangled with gambling — mahjong parlors, stakes, and so on. But what the survey is actually asking is "is there a mechanism that wagers real money or a substitute for it and decides win or loss by chance?" In Mahjong Joy, winning only raises a score (shown like a receipt-style bonus score) — there's no betting and nothing to cash out. It's no different from a puzzle game's scoreboard, so "None" was the correct answer.

Once the whole questionnaire is filled out, the rating gets calculated automatically. As expected, our game came out as **Everyone (3+).**

## Step 2: Target Age Group — This Is Where the Real Decision Happens

Don't relax just because the content rating is done. There's still a separate "Target age group and content" section waiting, and this is where you hit the fork in the road that actually matters.

This section has you pick age ranges with checkboxes.

```
□ 5세 이하
□ 6~8세
□ 9~12세
□ 13~15세
□ 16~17세
□ 18세 이상
```

If you check **even one of the under-13 ranges here** (5 and under / 6-8 / 9-12), the app gets classified as "aimed at children" and the **Families policy** kicks in. That's not just a label — it's a bundle of regulations that actually affects development.

- Personalized (targeted) ads are off the table — you can only use SDKs on the approved "Families self-certified ads SDK" list
- Collection of certain data, like location and advertising ID, is restricted
- Links or content inside the app that could be inappropriate for children are restricted

I've decided not to put ads in this game for now (that decision itself is something I weighed separately). Since there's no reason to take on the Families policy preemptively right now, **I unchecked every under-13 range and left only 13-15 / 16-17 / 18 and over selected.** This is what's commonly called "13+ targeting."

## What Actually Happens When You Choose 13+

This was the part that confused me the most, so I'm covering it separately. Choosing a 13+ target:

**What applies**
- The Families policy doesn't apply — you're not subject to the restrictions above on ads or data collection
- The content rating (Everyone) **stays exactly as it was.** Target age group and content rating are independent settings, so a combination like "targets 13 and up, but content rating is Everyone" isn't odd at all — it's actually common.

**Side effects that are easy to miss**
- You **don't get surfaced in the Play Store's Kids/Family tab curation.** A parent browsing that tab simply won't see it.
- On an **account for a child under 13 managed through Family Link**, the app itself can get filtered out of the catalog entirely. Even with an Everyone content rating, an app declared as "13+ target" may simply be invisible to a child-managed account.
- Conversely, on a **regular account** (say, a parent's own phone), anyone can download and install it normally. It's not a hard block — it's a difference in visibility and curation.

In other words, choosing 13+ doesn't mean "kids can't use it." It means "Google won't curate this app into the kids-only catalog, and won't apply the Families restrictions either." My own kid running Mahjong Joy on a parent's phone is completely unaffected — it just won't get filed into the store's "kids app" drawer.

## When Should You Include Under-13 Ranges?

Conversely, including under-13 ranges makes sense in cases like these.

- The app's **primary users genuinely are children**, and you plan to make that a marketing point (educational apps, content for young kids, etc.)
- Discovery advantages like Kids tab exposure or the "Teacher Approved" badge are core to your strategy
- You're firmly committed from the start to either skipping ads entirely or only using Families-certified SDKs

Mahjong Joy has a beginner mode that kids can enjoy too, but that's not the app's whole identity. The core of it is "casual mahjong anyone can enjoy," and kids are just one segment within that — so 13+ targeting was the better fit.

## Wrap-Up

Summing up Play Console's age settings in one pass:

1. **Content rating and target age group are two separate items** — one evaluates how intense the content is, the other declares the intended user base
2. Just answer the content rating questionnaire **honestly.** Don't let the mahjong subject matter spook you — if there's no actual betting/gambling mechanism, "None" is the correct answer
3. Including under-13 in the target age group automatically brings the **Families policy** (ad and data restrictions) along with it
4. Choosing a 13+ target doesn't change the content rating. It does, however, affect **Kids tab exposure** and **whether the app can even be installed on Family Link accounts**
5. If you have no immediate plans for ads or kids-only features, 13+ targeting is a safe default choice for most casual apps

Because the two surveys have similar-sounding names, I initially assumed I was confirming the same thing twice, but it turned out to be an entirely different decision. Just knowing this distinction ahead of time when filling out the store listing form should save a fair amount of time spent wandering around confused.
