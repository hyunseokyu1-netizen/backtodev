---
title: 'Getting an Expo app to the Play Store - From building AAB to creating store assets'
date: '2026-05-10'
publish_date: '2026-05-31'
description: A walkthrough of the build, asset creation, and bug fixing process we went through to get our React Native (Expo) game app to the Google Play Store for the first time.
tags:
  - Expo
  - ReactNative
  - Android
  - GooglePlayStore
  - Supabase
---]

## Time to finally get your app out into the world

When you're working on a side project, there's always the question of "when can I actually release it?". You've got the features in place, you've tested them, but when it comes time to submit them to the Play Store, you suddenly realize you have a lot of unknowns.

This article summarizes the process of publishing my puzzle game app called TILT on the Google Play Store for the first time. It's a React Native app based on Expo, and it's a game where you tilt your device to solve a maze. The leaderboards are posted in Supabase.

We had a bug right before launch, had to tweak the ranking system, and created our own store assets. I've documented the shoveling process step by step.

---

## Pre-launch bug: The loading spinner wouldn't go away.

### Symptoms

The leaderboard loading spinner was constantly spinning on the score screen at the end of a game. This was especially bad in environments with no Supabase connection (early development, no DB configured).

### Cause

In the existing code, the conditions for displaying the spinner were as follows.

```typescript
// Existing code - problematic
if (!topRankings.length && !rankInfo && score > 0) {
  return <LoadingSpinner />;
}
```

Even if the DB request fails or times out, the spinner condition still evaluates to true because `topRankings` remains an empty array and `rankInfo` remains null. There's no way to know if it's finished loading.

### Resolved

It's good practice to manage the `isLoadingRankings` state separately. We added a flag to the GameContext.

```typescript
// GameContext.tsx
const [isLoadingRankings, setIsLoadingRankings] = useState(false);

const fetchRankings = async () => {
  setIsLoadingRankings(true);
  try {
    const data = await getRankings(); // call Supabase
    setTopRankings(data.top);
    setRankInfo(data.myRank);
  } catch (error) {
    console.error('Rankings fetch failed:', error);
    // keep the state quietly empty on failure
  } finally {
    setIsLoadingRankings(false); // always false, regardless of success/failure
  }
};
```

We also changed the conditions for displaying the spinner.

```typescript
// after modifying
if (isLoadingRankings) {
  return <LoadingSpinner />;
}
```

It's a simple but easy pattern to miss. Judging asynchronous state by the presence or absence of data always leads to this trap. It's better to explicitly manage "loading" as a separate flag.

---]

## Ranking system fix: tiebreaker handling

### Problem

We were originally using PostgreSQL's `DENSE_RANK()`. This is how tied players share the same rank. If 100 people played the game, the top 50 players could all be #1. We decided to change it because "rank your own" is more meaningful for the game.

### Designing the sorting criteria

We decided on three levels of ranking criteria

| Prioritization | Criteria | Direction |
|---|---|---|---|
| 1 | Score | Higher the better (DESC) |
| 2 | Total Play Time | Shorter is better (ASC) |
| 3 | Registration time | First to register has an advantage (ASC) |

### Add a total_play_time column

To record the play time, we need to have a column in the DB. Note that it "does not include the time of unsuccessful rounds". It only writes the cumulative time of successful rounds.

```sql
ALTER TABLE rankings ADD COLUMN total_play_time INTEGER DEFAULT 0;
```sql

Send it along with the score when the client posts it.

```typescript
await supabase.from('rankings').upsert({
  user_id: userId,
  score: currentScore,
  total_play_time: successfulRoundsTime, // exclude failed rounds
  created_at: new Date().toISOString(),
});
```

### applyRank utility function

We've separated the rank calculation logic to make it reusable. The `startOffset` is used to specify the starting rank during pagination.

```typescript
// utils/ranking.ts
export function applyRank<T>(
  entries: T[],
  startOffset: number = 0
): (T & { rank: number })[] {
  return entries.map((entry, index) => ({
    ...entry,
    rank: startOffset + index + 1,
  }));
}
```

If the results are already sorted in the DB, the client just needs to number them in the same order. The key is to get the ORDER BY right in SQL.

```sql
SELECT * * from
FROM rankings
ORDER BY score DESC, total_play_time ASC, created_at ASC;
```

---]

## Create a Play Store asset

This is a bit more involved than I expected. Here's a list of the files you'll need

| Asset | Size | Format |
|---|---|---|---|
| App icon | 512×512 | PNG (32bit) |
| Feature Graphics | 1024 × 500 | PNG or JPG
| Screenshots | 2 minimum, 8 maximum | PNG or JPG
| Privacy Policy | - | URL (external link) |

### Create as SVG first, then convert to PNG

Since I don't have a design tool, I created it directly in SVG. You don't need Figma or Illustrator to create it.

I created the icon and feature graphics in SVG, then converted them to PNG with Chrome headless.

```bash
# convert SVG to PNG (Chrome headless)
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --headless \
  --screenshot=icon_512.png \
  --window-size=512,512 \
  icon.svg

# HTML mockup → PNG
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --headless \
  --screenshot=screenshot_gameplay.png \
  --window-size=1080,1920 \
  screenshot_gameplay.html
```

For screenshots, I found it much easier to create a mockup in HTML and convert it than to capture the actual device screen. You can resize them to whatever size you want, and you can add text and backgrounds.

### Privacy Policy

The Play Store requires a privacy policy URL. Hosting it on GitHub Pages is a free solution.

```
https://<username>.github.io/<repo>/privacy-policy
```

Even if your app is in Korean, it's a good idea to provide an English version. Reviews are faster when you launch globally.

The file structure is like this.

```
docs/
  privacy-policy/
    index.html # English
    ko/index.html # Korean
```

Set up the `docs/` folder as a GitHub Pages source, and you'll be able to access it right away.

---]

## Build Android AAB

### Step 1: Generate native code

This is the step to transition from an Expo managed workflow to a bare workflow.

```bash
expo prebuild --platform android
```bash expo prebuild --platform android

This command creates the `android/` folder. From this point on, it will be a native Android project.

The package name must be preset in `app.json`.

```json
{
  "expo": {
    "android": {
      "package": "com.backdev.tilt"
    }
  }
}
```

Changing the package name later is very cumbersome. Choose carefully at the beginning.

### Step 2: Create a keystore

The APK/AAB you upload to the Play Store must be signed. Once you create a keystore, you need to use the same one for the lifetime of your app. If you lose it, you won't be able to push updates, so make sure you have a good backup.

```bash
keytool -genkey -v \\.
  -keystore tilt-release.keystore \
  -alias tilt \
  -keyalg RSA \ -keysize 2048
  -keysize 2048 \ -validity 10000
  -validity 10000
```

Put the created keystore information in `android/gradle.properties`.

```properties
MYAPP_UPLOAD_STORE_FILE=tilt-release.keystore
MYAPP_UPLOAD_KEY_ALIAS=tilt
MYAPP_UPLOAD_STORE_PASSWORD=your_store_password
MYAPP_UPLOAD_KEY_PASSWORD=your_key_password
```

You also need to connect the release signing settings in `android/app/build.gradle`.

``` `groovy
android {
    signingConfigs {
        release {
            storeFile file(MYAPP_UPLOAD_STORE_FILE)
            storePassword MYAPP_UPLOAD_STORE_PASSWORD
            keyAlias MYAPP_UPLOAD_KEY_ALIAS
            keyPassword MYAPP_UPLOAD_KEY_PASSWORD
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

### Step 3: Remove unnecessary permissions

The Expo default template has quite a few unnecessary permissions attached to it. Play Store reviewers may ask, "Why are you using these permissions?" so it's a good idea to clean them up beforehand.

In `android/app/src/main/AndroidManifest.xml`, add `tools:node="remove"` to the permissions you want to remove.

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <!-- Remove camera permission -->
    <uses-permission android:name="android.permission.CAMERA"
        tools:node="remove" />

    <!-- Remove recording permission -->
    <uses-permission android:name="android.permission.RECORD_AUDIO"
        tools:node="remove" />
</manifest>
```

Note that `tools:node="remove"` also removes inherited permissions. This is a more reliable removal than using `<uses-permission>` directly.

### Step 4: Build AAB

```bash
cd android
./gradlew bundleRelease
```

If the build is successful, you will have files in the following paths

```
android/app/build/outputs/bundle/release/app-release.aab
```

In this case, it came out to about 64MB. The Play Store upload file size limit is 150MB, so we have plenty of room.

The build time is quite long the first time. From the second time on, it's fast thanks to the cache.

---

## A collection of frequently used commands

```bash
# Generate native code (first time)
expo prebuild --platform android

# Build the release AAB
cd android && ./gradlew bundleRelease

# Initialize build cache (when things get weird)
cd android && ./gradlew clean

# Check keystore information
keytool -list -v -keystore tilt-release.keystore

# Screenshot of Chrome headless
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --headless --screenshot=output.png --window-size=WIDTH,HEIGHT input.html
```

---]

## Troubleshooting

### Errors related to `JAVA_HOME`

```
ERROR: JAVA_HOME is not set and no 'java' command could be found
```

Android builds require Java. Installing with Homebrew is faster.

```bash
brew install --cask temurin@17
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
```

### `gradlew` permission error

```
Permission denied: ./gradlew
```

```bash
chmod +x android/gradlew
```

### Signature verification failed

If the keystore is different from an app already on the Play Store, the upload will be rejected. With Play App Signing, Google takes care of the final signature, reducing the risk of losing your keystore. Enable it before your first upload.

### Existing changes will be lost after prebuild

The `expo prebuild` will overwrite the `android/` folder. If you've modified the native code by hand, you'll need to reapply it each time. It is recommended to automate repeated modifications with the Expo config plugin.

---]

## Wrapping up: the path to launch

```
1. bug fixes
   └─ Asynchronous state is managed by a dedicated flag instead of data presence/absence

2. feature improvements
   └─ Changed DB design → Simplified client logic

3. store asset preparation
   └─ Created in SVG → Converted PNG to Chrome headless
   └─ Privacy policy → Free hosting for GitHub Pages

4. build Android
   └─ expo prebuild → create keystore → clean up permissions → bundleRelease

5. Play Store Registration
   └─ upload AAB → upload assets → fill out store registration information → submit review
```

There will be stumbling blocks at each step, especially the keystore settings and organizing permissions, which are difficult to undo later, so it's best to take care of them before your first build.

It's a great feeling when your build passes and you have an AAB file. The Play Store review process takes a few days, but that can wait.
