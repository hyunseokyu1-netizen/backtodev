---
title: "How a Signup-Free Anonymous Site Knows You Already Said 'I Agree'"
date: '2026-07-13'
publish_date: '2026-11-19'
description: How Supabase anonymous sessions plus an HMAC device_hash block duplicate votes without login — why IP addresses aren't used, the split between identifiability and identity, and the intentional limits of the approach
tags:
  - Supabase
  - Next.js
  - Anonymous Auth
  - HMAC
  - Middleware
---

While running my anonymous community side project, I use it myself as a regular user too, and one day I clicked "agree" again on a room-opening proposal I'd already agreed to yesterday, and got this back:

> You've already agreed.

For a second, even though I built the thing myself, I thought: **"Wait, it's anonymous... how does it know what I did? Is it the IP?"**

The answer isn't IP. This post walks through the actual implementation of how a site with no signup and no login can know "hey, you were here yesterday" — and still remain anonymous while doing it.

## Why This Problem Is Hard

Even an anonymous site eventually needs a constraint like "one person = one vote." In my project, opening a board (room) gets decided by 30 users agreeing, and if one person can click that 30 times, the whole mechanism means nothing.

But there's no signup, so there aren't many cards to play:

| Method | Problem |
|---|---|
| IP address | Everyone on the same Wi-Fi (office, cafe, family) counts as one person, while mobile IPs change constantly. On top of that, an IP is personal data in itself, so storing it already weakens anonymity |
| Browser fingerprinting | Privacy concerns, plus browsers are increasingly blocking it |
| Phone number verification | The moment you do this, it's no longer an anonymous site |

There's only one answer left. Create a state that's **"anonymous, but has a session."**

## Step 1 — Issue an Anonymous Session to Every Visitor

Supabase Auth has a feature called `signInAnonymously()`. With no email and no password, it creates a user with a single random UUID and issues a session cookie.

I put this into the Next.js middleware (`proxy.ts` in my project) so that **every visitor automatically gets a session on their very first request**:

```ts
// src/proxy.ts (핵심만 발췌)
export async function proxy(request: NextRequest) {
  const supabase = createServerClient(/* 쿠키 연동 설정 */);

  // 익명 세션이 없으면 발급 — device_hash 파생의 기반이 되는 세션 쿠키를 항상 보장
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    await supabase.auth.signInAnonymously();
  }

  return response;
}
```

From the user's side, nothing visibly happens. No signup screen, no terms-of-service checkbox. But the browser's cookies now hold one anonymous session representing "this browser."

## Step 2 — Hash auth.uid() Instead of Using It Raw

It seems like you could just filter duplicates using the session's `auth.uid()`, but there's one more step here. **Instead of storing the UUID in the DB as-is, I HMAC-hash it with a secret value only the server knows (a pepper):**

```ts
// src/lib/device-hash.ts
export function deriveDeviceHash(userId: string): string {
  const pepper = process.env.DEVICE_HASH_PEPPER;
  return createHmac("sha256", pepper).update(userId).digest("hex");
}
```

Why go this far:

- Even if the DB leaks, you can't reverse the original session ID from the device_hash (the pepper lives only in server environment variables, never in the DB)
- The device_hash is never sent down to the client
- And yet the server can still consistently tell "is this the same browser"

## Step 3 — Dedup via a DB Unique Constraint

The agreement (vote) record table looks like this:

```sql
create table topic_votes (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references topics(id) on delete cascade,
  device_hash text not null,
  created_at timestamptz not null default now(),
  unique (topic_id, device_hash)  -- ← 핵심
);
```

With a unique constraint on the `(room ID, device_hash)` pair, if the same browser tries to agree to the same room twice, **the DB itself rejects the INSERT.** The API catches that conflict and returns a 409 along with "you've already agreed." There's no need to write application-level logic like "check first, then insert if missing," which is prone to race conditions — integrity held by a DB constraint is the sturdiest option here.

Now it's clear why the site remembered that I'd agreed yesterday. **The cookie stays in the browser, so same session → same device_hash → unique conflict.** IP has nothing to do with it — and in fact, this project doesn't store IP anywhere at all.

## Bonus — Using the Same Material to Build "a Different Nickname Per Room"

This device_hash also gets recycled for generating nicknames. Using `(room ID + device_hash)` as a seed to deterministically pick an adjective and a noun:

```ts
// src/lib/nickname.ts
const digest = createHash("sha1").update(`${topicId}:${deviceHash}`).digest();
return `${ADJECTIVES[digest[0] % 12]} ${NOUNS[digest[1] % 12]}`;
// → "격분한 너구리", "수줍은 택시기사" ...
```

- Same nickname every time within the same room → keeps conversations feeling continuous
- Different seed in a different room → a completely different nickname → **impossible to track someone across rooms**

No need for a nickname mapping table in the DB either, since it can just be recomputed with the same formula whenever it's needed.

## So Is This Actually "Anonymous"?

Yes. The point is the split between **identifiable and identified.**

What the server knows: "hash `a3f9...` agreed in this room."
What the server doesn't know: who that hash **is** — no name, no email, no phone number, no IP at all.

In other words, the system only knows "same browser" — it can't know "which person." It's a compromise that holds anonymity and a minimum of order (dedup, spam prevention, enforcement on reports) at the same time.

## The Limitation — And Why That's Intentional

This structure has a clear weakness. **Since the session lives in a cookie, throw away the cookie and you become a new person.**

- Open an incognito window → new anonymous session
- Clear cookies → new anonymous session
- Use a different browser or device → new anonymous session

So someone determined enough can agree to the same proposal multiple times. Preventing that would need phone verification or fingerprinting, and the moment you do that, it's no longer an anonymous site. So in this project, "30 agreements" was designed not as an unforgeable vote but as **a light hurdle**, with a device_hash-based rate limit (5 actions per 60 seconds) acting as the first line of defense against mechanical spam instead.

Anonymity and fraud prevention are a trade-off relationship. How much of which side you give up is something the nature of the service decides, and for an anonymous community, I judged it right to put the weight on the anonymity side.

## Wrap-up

The whole structure at a glance:

```
Visit → middleware auto-issues an anonymous session (cookie)
     → on action, server computes device_hash = HMAC(pepper, auth.uid())
     → duplicates blocked via unique constraint on (room ID, device_hash)
     → same material generates a different deterministic nickname per room
```

1. **Anonymous sessions instead of IP** — accurate, and stores no personal data
2. **HMAC hash instead of the raw ID** — irreversible even if leaked, never sent to the client
3. **Dedup via a DB unique constraint** — the sturdiest method, with no race conditions
4. **Separating identification from identity** — knows "same browser," doesn't know "who"
5. **The cookie-based limitation is an intentional trade-off** — perfect fraud prevention isn't compatible with anonymity

The answer to "it's anonymous, so how does it know?" comes down to this — **it doesn't know who you are, but it's met your browser before.**
