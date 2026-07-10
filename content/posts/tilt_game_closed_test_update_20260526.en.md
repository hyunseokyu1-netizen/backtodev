---
title: 'Google Play Closed Testing — the More Often You Update, the Faster Approval Comes'
date: '2026-05-26'
publish_date: '2026-06-13'
description: What I felt bumping the Tilt game version — update frequency directly affects review approval during closed testing
tags:
  - Android
  - GooglePlay
  - Private testing
  - App Publishing
  - Game Development
---

## I had no idea app publishing was this complicated

I used to think you just uploaded an APK file and it went straight up on the store. It's different now. Google Play pushes new apps through **Closed Testing** first, and only apps that've been sufficiently tested pass the review for a full public launch.

My own Tilt game is going through that process. Bumping the version recently, I learned something — **the more often you update during the closed testing period, the higher your odds of passing review.** Today I wrote up that experience.

---

## What is closed testing anyway

Google Play's testing stages break down into roughly three.

| Stage | Description | Characteristics |
|---|---|---|
| **Internal testing** | only team members, or just you | published instantly |
| **Closed testing** | only invited people | has review, the stage before general release |
| **Open testing** | anyone can join | the last stage before official launch |

For a new app, Google wants to confirm "does this app genuinely have the intent to be maintained." Closed testing is the stage that proves that. Here, **at least 12 testers need to use the app for 14+ days** to move on to the next stage.

---

## But why does update frequency matter

At first, I uploaded one build and waited 14 days. But even after 14 days passed, the "apply for production access" button didn't activate.

Digging around and experiencing it firsthand, here's what I found.

> **Google watches whether the app is being actively maintained throughout the closed testing period.**

Just meeting the "14 days + 12 people" condition isn't enough. You need to keep sending signals that the app is alive. One of those signals is **update frequency.**

It seemed like Google recognized the app as being actively maintained every time I bumped the version. In fact, after bumping the Tilt game's version a few times, the review flow noticeably changed.

---

## The actual Tilt game version-bump process

### Step 1. Apply changes, then bump the `versionCode`

Bump the version in `build.gradle` (or `app.json`). Since `versionCode` is what the Play Store uses to judge whether it's actually an update, it must always be higher than before.

```json
// app.json example
{
  "expo": {
    "version": "1.3.0",
    "android": {
      "versionCode": 5
    }
  }
}
```

### Step 2. Build the AAB

```bash
./build_aab.sh
# → automatically saved to /path/to/releases/tilt-v1.3.0.aab
```

### Step 3. Upload to Google Play Console

1. Go to [Google Play Console](https://play.google.com/console)
2. Select the app → **Testing > Closed testing**
3. Click **Create new release**
4. Upload the AAB file
5. Enter release notes, then click **Review release**

### Step 4. Wait for review

Closed testing has review too. Usually processed within a few hours to a day. Unlike internal testing, it isn't deployed instantly, so you have to wait.

---

## Things I keep in mind when updating

### Update even without changes

Even without bugs or new features, if there's a meaningful improvement, I bump the version. Text edits, performance improvements, minor UI tweaks are all reason enough.

### Write release notes conscientiously

```
v1.3.0
- Improved title screen animation
- Fixed a score display bug
- Adjusted vibration feedback intensity
```

Short is fine, but showing that something changes with every version is worthwhile.

### Incorporate tester feedback

The whole point of closed testing is testers using the app and giving feedback. Reflecting that feedback in the next version naturally creates an update cadence, and testers engage more actively too.

---

## Common mistakes

**❌ Upload one build and wait 2 weeks**
→ From Google's perspective, it starts to look like "is this app even being maintained right now?"

**❌ Forgetting to bump versionCode**
→ The upload itself fails. It absolutely must be higher than before.

**❌ Just hitting the tester count and leaving the app alone**
→ Even with 12 people installed, no actual usage data means the condition isn't met.

---

## Summary

Closed testing isn't just about filling out a duration. What Google looks at is:

- ✅ Are testers actually using the app
- ✅ Is the developer consistently maintaining the app
- ✅ Is there a response when problems come up

Version updates are the most direct way to demonstrate all of this. Publishing the Tilt game, I learned firsthand that **consistency** matters more than polish during the testing period.

Bumping the version for even a small fix, leaving release notes, and responding to tester feedback — that's the practical way to get through closed testing quickly.
