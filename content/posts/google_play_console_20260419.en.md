---
title: 'I Built an App — Now How Do I Publish It? Google Play Console from Start to Finish'
date: '2026-04-19'
description: A step-by-step walkthrough of publishing an app on Google Play Console for the first time — from developer account registration to AAB upload and review submission.
tags:
  - Android
  - Google Play
  - App Publishing
  - React Native
---

You built an app. You tested it. Time to release it to the world — except when you actually go to put it on Google Play, there's way more to it than you expected.

If you've ever thought "Can't I just upload an APK?" only to freeze up when you see the Console dashboard — this guide is for you. Here's the full first-time app registration process, step by step.

---

## Before You Start

### 1. Register a Google Play Developer Account

If you don't have a developer account yet, create one first.

- URL: [play.google.com/console](https://play.google.com/console)
- **Registration fee**: $25 USD, one-time, non-refundable
- Log in with a regular Google account → agree to the developer agreement → pay

> You can register as an individual developer or as an organization/company. Switching later is a hassle, so choose the right option from the start.

### 2. Prepare an APK or AAB File

Google currently requires (effectively mandates) the **AAB (Android App Bundle)** format.

With Expo:

```bash
# Generate AAB with EAS Build
eas build --platform android --profile production
```

With React Native CLI:

```bash
cd android
./gradlew bundleRelease
# Output: android/app/build/outputs/bundle/release/app-release.aab
```

### 3. App Signing Key (Keystore)

Uploading an AAB requires signing. EAS Build handles this automatically, but if you're building manually, you'll need a keystore file.

> **Warning**: Never lose your keystore. Every update to the same app must be signed with the same key.

---

## Step 1. Create a New App

When you log into the Play Console, you'll see the dashboard.

1. Click **"Create app"** in the top right
2. Fill in the following:

| Field | Details |
|-------|---------|
| App name | The name shown on the store (can be changed later) |
| Default language | Default language for the store listing |
| App or game | Select App or Game |
| Free or paid | **Once set to free, you cannot change it to paid** |

> Think carefully about free/paid. Once it's free, you can't switch to paid. Monetizing via in-app purchases is the standard approach.

3. Agree to the Developer Program Policies and US export laws → click **"Create app"**

---

## Step 2. App Setup (Filling Out the Dashboard Checklist)

After creating the app, a checklist appears on the dashboard. Two main areas need to be completed:

- **App setup**: content rating, target audience, privacy policy, etc.
- **Production store listing**: screenshots, app description, icon, etc.

### App Content Setup

Left menu → **Policy** → **App content** — complete each item:

#### Privacy Policy
Whether or not your app collects personal data, you need a URL.  
Create a simple policy page or use a free generator like [privacypolicygenerator.info](https://privacypolicygenerator.info).

#### Ads
Select "Yes" if your app contains ads.

#### App access
If your app requires login, provide test account credentials. Google reviewers will test the app directly.

#### Content rating
A questionnaire-based flow. Your app is automatically rated based on its nature (violence, adult content, etc.).  
Most general apps will receive **EVERYONE** or the equivalent rating.

#### Target audience and content
Select the target age group. If the app is aimed at children, additional restrictions apply.

#### Data safety
Declare what data your app collects — location, contacts, usage history, etc.

> This section is more thorough than you might expect. If you use Firebase Analytics, "App interactions" is data you're collecting.

---

## Step 3. Write the Store Listing

Left menu → **Grow** → **Store listing**

### App Name & Description

| Field | Limit |
|-------|-------|
| App name | 30 characters max |
| Short description | 80 characters max |
| Full description | 4,000 characters max |

### Graphics Assets (Required)

| Asset | Specs |
|-------|-------|
| App icon | 512 × 512 px, PNG, max 1MB |
| Feature graphic | 1024 × 500 px, JPG or PNG |
| Phone screenshots | Minimum 2, maximum 8 |

Screenshot specs:
- 16:9 or 9:16 ratio
- Min 320px, max 3840px
- JPG or PNG

> Screenshot tip: Capture from a real device, or create mockup images in Figma. "Marketing screenshots" with added text and callouts are allowed.

---

## Step 4. Create a Release (Upload the AAB)

Left menu → **Production** → **Create new release**

### App Signing

When uploading for the first time, decide whether to use **Google Play App Signing**:

- **Recommended**: Use Google Play App Signing (Google manages the final signing key)
- Eliminates the risk of losing your key — most developers choose this

### Upload the AAB

```
Select file → upload app-release.aab
```

The version code and version name are automatically parsed after upload.

### Write the Version Name and Release Notes

```
Version name: 1.0.0
Release notes (English):
- Initial release
- Core features available
```

---

## Step 5. Country / Region Selection

**Production → Countries / regions** tab — select where your app will be available:

- **All countries** (recommended)
- Or select specific countries only

---

## Step 6. Submit for Review

Once all items are complete, the **"Roll out to production"** or **"Send for review"** button activates in the top right.

After submitting, Google's review begins:

| Type | Timeline |
|------|----------|
| First app | Typically **3–7 days** |
| Subsequent updates | Typically **a few hours to 1–2 days** |

> First apps take longer. Submit early.

---

## Common Mistakes and Troubleshooting

### "Your app violates policy" rejection

- Screenshots or description contain false or exaggerated claims
- Content rating doesn't match the actual app
- Privacy policy URL is missing or broken

### Version code error

If the AAB's `versionCode` is lower than the previous release, upload fails.

```json
// app.json (Expo)
{
  "android": {
    "versionCode": 2
  }
}
```

### Signing key mismatch

If a new version of the same app is signed with a different key, upload is blocked. If you're using Google Play App Signing, just match the upload keystore.

### Data safety section incomplete

Skipping this section keeps the submit button disabled. Even if you collect no data, mark "No data collected" to complete it.

---

## Summary — The Full Flow at a Glance

```
[Register developer account - $25]
        ↓
[Create new app]
        ↓
[App content setup]
  - Privacy policy URL
  - Content rating (questionnaire)
  - Target audience
  - Data safety
        ↓
[Write store listing]
  - App name, description
  - Icon, screenshots, feature graphic
        ↓
[Create release]
  - Upload AAB
  - Write release notes
        ↓
[Select countries / regions]
        ↓
[Submit for review → wait (3–7 days)]
        ↓
[Published]
```

The checklist feels long at first, but once you've done it, the next app goes much faster. The spots people most often miss: **the privacy policy** and **the data safety section**. Make sure you don't skip them.
