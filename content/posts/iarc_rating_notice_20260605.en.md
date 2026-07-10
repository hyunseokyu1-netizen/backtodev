---
title: 'Got an IARC Email After Registering an App on Google Play — Just Ignore It'
date: '2026-06-05'
publish_date: '2026-06-26'
description: An IARC Live Rating Notice is just a notification that your app's age rating is now live on the store. Here's why you don't need to do anything about it
tags:
  - GooglePlay
  - Android
  - App Publishing
  - IARC
---

Just ignore it.

After registering an app on Google Play, I got an email from something called IARC. The subject was **"IARC Live Rating Notice: ChainPlay."** It looks like it demands some action the first time you see it, but the short answer is: there's nothing to do.

---

## What is IARC anyway

IARC (International Age Rating Coalition) is a body that manages app/game age ratings in an internationally unified way. Major digital stores — Google Play, Microsoft Store, Nintendo eShop — are all members.

When registering an app on Google Play, there's a step in Play Console where you fill out a "content rating" questionnaire. Checking boxes for violence, adult content, gambling elements — that process is the IARC questionnaire. Complete it, and IARC automatically generates regional ratings for you.

- North America: ESRB
- Europe: PEGI
- Korea: GRAC
- Other regional rating bodies

---

## Why does this email arrive

Fill out the questionnaire → ratings generated → app review completed → **officially live on the store**

Once this flow completes, IARC lets you know: "your app's rating is now live on the store." Nothing more, nothing less than a confirmation notice.

The email contains information like this.

| Item | Content |
|---|---|
| Global Rating ID | an ID reusable on other IARC-supported stores |
| Product Title | app name |
| Rating Date | date the rating went live |
| Storefront | Google Play |

---

## What to do after receiving this email

**Nothing.** In most cases, just read it and close it.

There are only a few exceptional situations where you need to actually do something.

| Situation | What to do |
|---|---|
| The rating seems wrong | dispute it via the "request a rating check" link in the email |
| An update changes the content nature (e.g. adds violence) | you need to redo the questionnaire in Play Console |
| You want to register on another store too (Amazon Appstore, etc.) | enter the Global Rating ID to reuse the rating |

For an ordinary utility app or game, the rating likely came out as something like "everyone" (E/3+), and there's no reason to dispute it.

---

## What's the Global Rating ID for

It's the long ID value in the email (something like `d5f24a30-5594-84c4-8ac0-3f3fffcf256f`).

When registering the same app on another IARC-supporting store, instead of filling out the questionnaire from scratch, you can enter this ID to reuse the existing rating. If you don't need it right now, feel free to ignore it.

---

## Summary

```
Fill out the content rating questionnaire in Google Play Console
        ↓
IARC auto-generates regional age ratings
        ↓
App review completed + live on the store
        ↓
IARC Live Rating Notice email arrives
        ↓
Just ignore it
```

Launching an app for the first time brings a bunch of unfamiliar emails, and the IARC one is among the most harmless of them. It's just a confirmation email that "you're registered" — read it, and move on.
