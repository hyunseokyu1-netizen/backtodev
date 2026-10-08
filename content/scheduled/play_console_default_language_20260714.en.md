---
title: 'Why I Second-Guessed Setting English as My Play Store Default Language'
date: '2026-07-14'
publish_date: '2026-11-29'
description: Picking English as the default language for a mahjong game's Play Store listing, then reconsidering after wondering if Chinese-speaking markets are actually the bigger audience, and realizing distribution channel reach and genre popularity are different questions
tags:
  - App Store
  - Google Play Store
  - Globalization
  - i18n
  - Branding
---

# Why I Second-Guessed Setting English as My Play Store Default Language

While preparing to register the mahjong game I'm building on Play Console, I got stuck at the step where you choose a "default language." The options were English, Korean, Chinese (Simplified), and Chinese (Traditional). The app was already built to support three languages — Korean, English, and Chinese (Simplified) — but **which one to set as the default** turned out to be a separate problem.

The default language is what gets shown as a fallback when the store is accessed from a region outside the languages you've registered (say, Southeast Asia or Europe). So at first I thought about it simply: "English is the language the largest number of people can read at least a little, so English as the default should be fine." It didn't look like something worth agonizing over.

## "Wouldn't More Chinese People Play This Than Americans?"

What made me question this call was one very simple question: **wouldn't more Chinese people play this game than Americans?**

Thinking it through, that checked out. This game isn't a tile-matching solitaire — it's **real four-player mahjong**, where you draw and discard tiles and assemble sets. But in the US, "mahjong" mostly brings to mind a tile-matching puzzle game. Hong Kong and Taiwan, by contrast, have real mahjong embedded as an everyday entertainment culture — families playing mahjong when they gather for holidays is apparently a common sight. Looking purely at the genre, the user base this app is exactly aimed at is far bigger in the Chinese-speaking world than in the US.

So I started reconsidering: "should I switch the default language to Chinese, then?"

## The Deciding Factor: Google Play Doesn't Operate in Mainland China

This is where I hit a fact I'd overlooked at first. **Google Play isn't available in mainland China.** Because of Chinese government regulation, mainland Android users rely on their own channels — Huawei AppGallery, the Xiaomi Store, Oppo/Vivo stores. There's a tiny exception of people sideloading apps over a VPN, but it's small enough to ignore.

What this fact changes isn't "where is the genre popular" but **"who can this distribution channel actually reach."** The Chinese-speaking population Play Store can actually reach isn't the mainland, but:

- Taiwan, Hong Kong, Macau
- Overseas Chinese communities in Singapore and Malaysia
- Chinese immigrant communities elsewhere (the US, Canada, Australia, etc.)

That's about it. And within this list, the places with by far the strongest mahjong culture are **Hong Kong and Taiwan.**

## Treat Traditional and Simplified Chinese Like Different Languages

A second problem turned up here. The app's current Chinese translation is **Simplified only.** But Taiwan and Hong Kong, where mahjong culture is strongest, use **Traditional** Chinese. It's not just that the glyphs look different — even the word choices that show up prominently on screen vary subtly by region.

Summed up, the situation looked like this.

| Region | Mahjong culture | Play Store reach | App's translation support |
|---|---|---|---|
| Mainland China | Present | ❌ Effectively unreachable | Has Simplified (but unreachable) |
| Taiwan/Hong Kong | Very strong | ✅ Reachable | ❌ No Traditional (shown in Simplified) |
| Singapore/Malaysia overseas Chinese | Moderate | ✅ Reachable | ✅ Simplified is sufficient |
| US/Western markets | Weak (solitaire-dominated) | ✅ Reachable | ✅ English |

In effect, my core target — Taiwan/Hong Kong — was exactly the audience being shown an awkward Simplified translation. The bare fact of "supporting Chinese" wasn't enough on its own.

## So Did I Add Traditional Chinese Right Now? No.

It might look like the obvious next step, but I decided not to add Traditional Chinese right away. The reason is simple: **this is all still a hypothesis.** "There are probably a lot of Hong Kong/Taiwan users" is a reasonable guess, but pouring translation resources in first, with zero confirmation from actual download data, felt premature.

Instead, here's where I landed.

1. **Ship with Simplified Chinese first, for now.** Don't expand the translation work any further.
2. **Keep English as the default language.** I learned that the population Simplified Chinese actually reaches through Play Store is smaller than I'd assumed (mainland is unreachable, and the Traditional-Chinese market of Taiwan/Hong Kong still isn't covered). English remains the broadest fallback.
3. **Check Play Console's region/language stats after launch.** If I actually see meaningful inflow from Taiwan and Hong Kong, that's when I'll add `AppLang.zhHant` to the code and prepare separate Traditional-Chinese store copy in a `store/zh-TW` folder.

This confirmed a principle that sounds obvious once you say it: there has to be a "verify with data" step sitting between forming a hypothesis and pouring resources into that hypothesis.

## If I Add Traditional Chinese Later — a Checklist I've Prepared in Advance

So I can move immediately once Taiwan/Hong Kong traffic is confirmed after launch, I've listed out the work that adding Traditional Chinese requires, ahead of time. "Adding one translation" touches more places than you'd expect.

1. **Add an in-app locale** — add `AppLang.zhHant` to the language enum in the code, and write `zh_TW.arb` (or the equivalent locale file). I shouldn't just copy the Simplified file and machine-convert it — mahjong terminology (notation for 碰/槓-type terms) needs its regional conventional spelling checked separately.
2. **Add store listing translations** — add Chinese (Traditional) listing info in Play Console, and manage store copy (30-character title / 80-character short description / 4,000-character full description) separately in a `store/zh-TW` folder.
3. **Decide whether to localize screenshots** — judge whether screenshots with large on-screen text need to be recaptured in the Traditional-Chinese version. For a game, screenshots feed directly into conversion, so this is high priority.
4. **Re-examine the default language** — once Traditional Chinese is also in place, reconsider whether to keep English as the default. With the registered languages (Korean/English/Simplified/Traditional) directly covering each region, English's role as a fallback actually shrinks.

Conversely, the only thing I'm doing right now is watching Play Console stats — set up the user acquisition report filtered by region, and check weekly whether the Taiwan (TW) and Hong Kong (HK) numbers start to look meaningful.

## Wrap-Up

Summed up line by line, here's the decision process I went through this time.

1. **Initial call**: with a global release in mind, English is the safest choice for fallback coverage → decided on English as the default language.
2. **What triggered the reconsideration**: the question "isn't this genre more popular in the Chinese-speaking world than in the US?" — a fair point given the nature of the genre.
3. **The variable I'd missed**: Google Play isn't available in mainland China. "Where the genre is popular" and "where this channel can reach" are different questions.
4. **Re-confirmed target**: the Chinese-speaking population Play Store actually reaches is Taiwan, Hong Kong, Macau, and overseas Chinese communities, and among these, Taiwan and Hong Kong — where mahjong culture is strong — use Traditional Chinese.
5. **The gap I found**: the app's Chinese is Simplified only, so the core target region was actually being shown an awkward translation.
6. **Final decision**: don't add Traditional Chinese now. Ship with Simplified first, keep English as the default language, and decide whether to add Traditional Chinese only after looking at actual regional stats.

This time I really felt, firsthand, that "where this genre is popular" and "who this distribution channel can actually reach" are different questions. And also that no matter how plausible an answer looks, you shouldn't start pouring resources in to match a guess before the real data comes in.
