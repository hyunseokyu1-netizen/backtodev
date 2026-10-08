---
title: 'Why I Replaced Community Voting With Admin Edits for Fixing Wrong Nogari Room Photos'
date: '2026-07-16'
publish_date: '2026-12-03'
description: Why letting majority vote decide corrections to real-person photos and descriptions is risky, and how I bolted an admin edit page onto the existing report-handling infrastructure instead of building a new voting system
tags:
  - Next.js
  - Supabase
  - Admin Panel
  - Moderation
---

Nogari is an anonymous community where rooms get opened around real people — politicians, idols, that kind of thing. Each room carries a representative photo and a short description (affiliation, title, that sort of thing), and since rooms are created by actual users, photos inevitably end up wrong or descriptions end up inaccurate sometimes.

While figuring out how to fix this, I asked myself:

> "There's probably going to be situations where an image or a person's description needs correcting. Feels like there should be a page where admins can edit it. Or should we do it by vote?"

Choosing between voting (majority rule) and direct admin edits is the core of this post.

## Why Admin, Not Voting

At first glance, voting looks more "community-like" and fairer. But thinking it through, there were two problems.

1. **Fact-checking isn't majority-rule territory.** "Is this photo actually that politician" isn't an opinion, it's a fact. Even if 100 people vote for the wrong photo, that doesn't make it the right photo.
2. **The abuse risk is significant.** If a small group piles onto a vote and manipulates it, swapping in a mocking image becomes possible. That's a particularly real threat in an anonymous community.

Meanwhile, the report-handling infrastructure already existed. Admin auth through `admin-auth.ts`, reviewing reports at `/admin/reports`, and taking action via `/api/admin/moderate` — that flow was already running. Adding just one "edit Nogari room info" feature on top of that required far less development and far less risk than designing a whole new voting system. So I went with the admin-page approach.

## Step 1 — Building a Room Search Page

First, I built a page at `/admin/topics` that searches rooms by title. I used Supabase's `ilike` for partial matching, but escaped wildcard characters so that a user typing `%` or `_` doesn't produce unintended matches.

```ts
async function searchTopics(q: string): Promise<Topic[]> {
  const admin = createAdminClient();
  let query = admin
    .from("topics")
    .select("*")
    .eq("status", "ACTIVE")
    .order("title", { ascending: true })
    .limit(30);

  if (q) {
    const escaped = q.replace(/[%_\\]/g, (ch) => `\\${ch}`);
    query = query.ilike("title", `%${escaped}%`);
  }

  const { data, error } = await query;
  if (error) return [];
  return data;
}
```

With no query, it doesn't run a query at all, so the admin page stays light even once active rooms grow into the thousands.

## Step 2 — The Edit API: Auth + Validation + an Image URL Allowlist

I built a new `PATCH /api/admin/topic`. The part I paid the most attention to here was image URL validation. Leaving it open for the client to pass any arbitrary URL would let someone inject an external image at will, so I only allowed URLs already uploaded to our own Storage.

```ts
export async function PATCH(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  // ...body 파싱, title 길이 검증(1~100자) 생략...

  // 이미지는 /api/upload로 올린 우리 Storage 공개 URL만 허용 (임의 URL 주입 방지)
  const imageUrl = body?.imageUrl?.trim() || null;
  const allowedImagePrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/topic-images/`;
  if (imageUrl && !imageUrl.startsWith(allowedImagePrefix)) {
    return NextResponse.json(
      { error: "이미지는 업로드 API를 통해 등록해주세요." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("topics")
    .update({ title, description, person_title: personTitle, image_url: imageUrl })
    .eq("id", topicId);

  // ...
}
```

I didn't build a new image upload path. I reused the existing `/api/upload` endpoint that users already use when creating a room. Since it ends up uploading to the same Storage bucket the same way regardless, there was no reason to build a separate admin upload API.

```ts
async function handleImagePick(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  const data = await res.json();
  if (res.ok) setImageUrl(data.url);
}
```

## Step 3 — The Edit Form: A Dirty Check to Prevent Mistakes

The `TopicEditForm` component lets you edit the photo (click the avatar to pick a file), the title, the one-line affiliation/title, and the description inline inside a single card. I added a `dirty` state so the save button only activates once at least one value has changed — a small thing, but it prevents the mistake of "thought I clicked save, but nothing actually changed."

```tsx
const dirty =
  title !== initialTitle ||
  description !== (initialDescription ?? "") ||
  personTitle !== (initialPersonTitle ?? "") ||
  imageUrl !== initialImageUrl;

<Button size="sm" disabled={!dirty || pending} onClick={handleSave}>
  {pending ? "저장 중..." : "저장"}
</Button>
```

I also added a "edit Nogari room info" link on the `/admin/reports` page, so that if I spot a photo error while reviewing a report, I can jump straight over to fix it.

## A Small Fix — Open the Room Shortcut in a New Tab

Once I started actually using this, one thing bugged me right away. Clicking the "go to room" link next to the room list would navigate the page I was editing in place, so after checking the photo and coming back, my search results were gone. A tiny fix, but just adding `target="_blank"` made the whole flow much smoother.

```tsx
<Link
  href={`/topics/${topic.id}`}
  target="_blank"
  rel="noopener noreferrer"
  className="text-sm underline underline-offset-2"
>
  방 바로가기
</Link>
```

## Pre-Deploy Verification

Since this feature touches production data directly, I ran the full flow end-to-end with Playwright before shipping.

1. Log in as admin locally
2. Search for a room on `/admin/topics`
3. Swap the photo and edit the description
4. Save, then confirm it reflects on the actual room page

After confirming the whole flow worked locally with no issues, I ran the same flow against the production DB as well, and restored the test data back to its original values afterward.

## Wrap-up

| Question | Decision |
|---|---|
| Who fixes photo/description errors | Direct admin edits instead of voting |
| Why rule out voting | Fact-checking isn't majority-rule territory, and a small group can manipulate it |
| Build a whole new system again? | No — build on top of existing report infrastructure (admin-auth, /admin/reports) |
| Build a new image upload path? | No — reuse the existing `/api/upload` |
| Image URL validation | Only allow URLs starting with our Storage prefix |

For a service dealing with real people, there's a temptation to hand "is this information correct" over to a community vote. But fact-checking and gathering opinions are different problems. And before building a new feature, asking "can this ride on infrastructure that already exists" cut down both the amount of code and the surface area I had to verify — a lesson I relearned here.
