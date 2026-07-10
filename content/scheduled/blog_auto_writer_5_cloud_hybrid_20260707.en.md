---
title: 'Automating Blog Publishing (5): Taking a Local Tool to the Cloud — Vercel Blob Betrayed Me'
date: '2026-07-07'
publish_date: '2026-08-16'
description: The story of eventually putting a tool on Vercel that I had concluded a local dashboard was good enough for, and switching to Upstash Redis after running into Vercel Blob eventual-consistency problems
tags:
  - Vercel
  - Redis
  - Upstash
  - Serverless
  - Architecture
---

Last time, I concluded that "publishing requires a local session, so cloud deployment is impossible — a local dashboard is good enough." But actually using it changed my mind. Registering topics and reviewing drafts weren't things I only did while sitting in front of my Mac. Out and about, I wanted to be able to just throw a topic in from my phone, and check drafts too. So I actually built the hybrid structure of "publish locally, everything else in the cloud."

## What moved to the cloud, and what stayed

Part 4 already had the answer. Only publishing (browser automation + login session) was tied to the local machine — there was no reason topic registration and AI draft generation couldn't run in the cloud.

```
[Vercel dashboard] register topics, generate/edit drafts, a publish button
      → records a "publish request" in Redis
      → [worker on my Mac] checks for requests every 15 seconds
      → publishes for real using the login session → writes the result back to Redis
      → the dashboard auto-refreshes
```

The key is that **the cloud never touches a browser directly when the publish button is clicked.** The cloud only leaves a "please publish this" request in a queue; actual execution is always handled by the local worker.

## The Next.js dashboard was no big deal

Writing the API with Next.js App Router + Route Handlers was the one part of this series that went smoothly, no complications.

```typescript
// app/api/publish/route.ts
export async function POST(req: Request) {
  const { date, platform, topic } = await req.json();
  const topics = await getTopics();
  const entry = topics.find((t) => t.date === date && t.topic === topic);
  entry.requestedPlatforms = [...new Set([...(entry.requestedPlatforms ?? []), platform])];
  entry.status = 'publish_requested';
  await saveTopics(topics);
  return Response.json({ ok: true });
}
```

All the publish API does is **"record the request"** — not actually publish. This asymmetry is simple enough that it's practically the entire hybrid architecture.

## I stored it in Vercel Blob, and the data started jumping around

I initially, without much thought, kept a single JSON file (`topics.json`) in Vercel Blob and did read → modify → write again. But something strange happened. Refreshing the list right after registering a topic would show the just-registered item missing, only to reappear a few seconds later after another refresh.

```typescript
// writing it this way creates a read-modify-write pattern
const topics = await getTopics();      // read from Blob
topics.push(newEntry);
await saveTopics(topics);              // write to Blob
// → immediately calling getTopics() right after can return the old data
```

The cause was that **Vercel Blob is eventually-consistent storage.** Even after getting a response saying the write finished, an immediately following read isn't guaranteed to return the latest value. I'd picked a storage type fundamentally unsuited for a read-modify-write pattern that keeps overwriting one file. It's fine for storing static assets, but it was the wrong tool to use as state storage where "I need to read what just changed, immediately."

## Fully switching to Upstash Redis

Since strong consistency was needed, I attached Upstash Redis fresh via the Vercel Marketplace.

```bash
vercel integration add upstash/upstash-kv
```

Once attached, environment variables (`KV_REST_API_URL`, `KV_REST_API_TOKEN`) got automatically injected into the project, and the code actually ended up simpler than the Blob version.

```typescript
// lib/store.ts
const redis = Redis.fromEnv();

export async function getTopics(): Promise<TopicEntry[]> {
  return (await redis.get<TopicEntry[]>('topics')) ?? [];
}

export async function saveTopics(topics: TopicEntry[]): Promise<void> {
  await redis.set('topics', topics);
}
```

After switching, I repeatedly tested "write then immediately read" in both local and production to confirm values no longer jumped around. I deleted the Blob store and removed the `@vercel/blob` dependency too.

> **Lesson**: whenever you see the combination "serverless + state in a single file," check the consistency model first. Serving static assets and storing state are problems with different requirements.

## The local worker — the side that receives cloud requests and actually publishes

There's nothing special about the worker. It scans Redis every 15 seconds, processes any entry with `requestedPlatforms`, and writes the result back once done.

```typescript
export function startWorker(): void {
  const tick = async () => {
    if (processing) return; // avoid overlapping before a prior publish finishes
    processing = true;
    try {
      await pollOnce();
    } finally {
      processing = false;
    }
  };
  void tick();
  setInterval(tick, 15_000);
}
```

The reason overlap is blocked with a `processing` flag is that publishing itself — launching a browser and navigating between pages — takes anywhere from a few seconds to several dozen seconds, and might not finish before the second polling timer fires. Saving to Redis immediately as each item finishes processing lets the dashboard show "publishing → done/failed" changing in real time.

## The moment I actually connected it and confirmed it worked

Clicking the publish button in the dashboard and watching the worker's terminal running on my Mac, within 15 seconds a log appeared, a browser popped up, and the post actually went live. Watching a button clicked in the cloud remotely control the Mac sitting at home was a more satisfying experience than I'd expected.

```
▶ [worker] 2026-07-07 / tistory / "Managing food during monsoon season"
  Using cloud draft: Managing food during monsoon season, why you can't just trust the fridge
  [tistory] Published: https://my-blog.tistory.com/manage/posts/
```

But trusting this log as "publish succeeded" turns into a problem again in the next part. The mere fact of being redirected to the management page didn't actually confirm that the body content had gone up correctly.

## Summary

| Step | Location | Reason |
|---|---|---|
| Topic registration / draft generation | Cloud (Vercel + Redis) | Doesn't require a login session |
| Recording the publish request | Cloud (Redis) | A lightweight task that just needs to leave state |
| Actual publishing (browser automation) | Local (worker on my Mac) | The login session only exists locally |

Part 4's conclusion of "cloud deployment is impossible" wasn't wrong. I'd just been missing the fact that **separating publishing from everything else** turns "impossible" into "possible via a hybrid." Next up: the slightly embarrassing bug I ran into after happily mashing the publish button with this new structure.
