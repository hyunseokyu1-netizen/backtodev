---
title: '노가리방 사진이 잘못됐을 때, 투표 대신 관리자가 고치기로 한 이유'
date: '2026-07-16'
publish_date: '2026-09-02'
description: 실존 인물 사진·설명 오류를 다수결로 정하는 게 왜 위험한지, 그리고 새 투표 시스템을 만들지 않고 기존 신고 처리 인프라를 재활용해 관리자 수정 페이지를 붙인 과정
tags:
  - Next.js
  - Supabase
  - 관리자페이지
  - 모더레이션
---

노가리(Nogari)는 정치인·아이돌 같은 실존 인물을 주제로 방이 열리는 익명 커뮤니티입니다. 방마다 대표 사진과 짧은 설명(소속·직함 같은 것)이 붙는데, 사람이 만드는 방이다 보니 사진이 잘못 올라오거나 설명이 틀리는 일이 생길 수밖에 없습니다.

이 문제를 어떻게 고칠지 고민하다가 이런 질문을 던졌습니다.

> "이미지나 사람 설명을 수정해야 되는 상황이 생길 것 같은데, 관리자가 수정할 수 있는 페이지가 있어야 될 것 같아. 아니면 투표로 할까?"

투표(다수결)와 관리자 직접 수정, 둘 중 뭘 고를지가 이번 글의 핵심입니다.

## 왜 투표가 아니라 관리자인가

언뜻 보면 투표가 더 "커뮤니티스럽고" 공정해 보입니다. 하지만 곰곰이 따져보면 두 가지 문제가 있었습니다.

1. **사실 확인은 다수결의 영역이 아니다.** "이 사진이 진짜 그 정치인이 맞는가"는 의견이 아니라 사실입니다. 100명이 틀린 사진에 투표해도 그 사진이 맞는 사진이 되지는 않습니다.
2. **악용 리스크가 크다.** 소수 인원이 몰려서 투표를 조작하면 조롱성 이미지로 바꿔치기하는 것도 가능해집니다. 익명 커뮤니티에서는 특히 현실적인 위협입니다.

반면 이미 신고 처리 인프라가 있었습니다. `admin-auth.ts`로 관리자 인증을 하고, `/admin/reports`에서 신고를 검토하고, `/api/admin/moderate`로 조치하는 흐름이 이미 돌아가고 있었죠. 여기에 "노가리방 정보 수정" 기능 하나만 얹으면, 투표 시스템을 새로 설계하는 것보다 개발량도 훨씬 적고 리스크도 낮습니다. 그래서 관리자 페이지 방식으로 결정했습니다.

## Step 1 — 방 검색 페이지 만들기

먼저 `/admin/topics`에 제목으로 방을 검색하는 페이지를 만들었습니다. Supabase의 `ilike`로 부분 일치 검색을 하되, 와일드카드 문자를 이스케이프해서 사용자가 `%`나 `_`를 넣어도 의도치 않은 매칭이 안 나오게 했습니다.

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

검색어가 없으면 아예 쿼리를 안 날리게 해서, 활성 방이 수천 개로 늘어나도 관리자 페이지가 무거워지지 않게 했습니다.

## Step 2 — 수정 API: 인증 + 검증 + 이미지 URL 화이트리스트

`PATCH /api/admin/topic`을 새로 만들었습니다. 여기서 가장 신경 쓴 부분은 이미지 URL 검증입니다. 클라이언트가 아무 URL이나 넣을 수 있게 열어두면 외부 이미지를 임의로 주입할 수 있으니, 우리 Storage에 업로드된 URL만 허용했습니다.

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

이미지 업로드 자체는 새로 만들지 않았습니다. 유저가 방을 만들 때 쓰는 기존 `/api/upload` 엔드포인트를 그대로 재사용했어요. 어차피 같은 Storage 버킷에 같은 방식으로 올리면 되는데, 굳이 관리자용 업로드 API를 따로 만들 이유가 없었습니다.

```ts
async function handleImagePick(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  const data = await res.json();
  if (res.ok) setImageUrl(data.url);
}
```

## Step 3 — 수정 폼: dirty 체크로 실수 방지

`TopicEditForm` 컴포넌트는 사진(아바타 클릭 시 파일 선택), 제목, 한줄 소속/타이틀, 설명을 한 카드 안에서 인라인으로 수정하게 만들었습니다. 값이 하나라도 바뀌었을 때만 저장 버튼이 활성화되도록 `dirty` 상태를 뒀는데, 별거 아니지만 "누른 줄 알았는데 아무것도 안 바뀐" 실수를 막아줍니다.

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

`/admin/reports` 페이지에도 "노가리방 정보 수정" 링크를 하나 추가해서, 신고를 검토하다가 사진 오류를 발견하면 바로 넘어갈 수 있게 동선을 이어줬습니다.

## 소소한 수정 — 방 바로가기는 새 탭으로

만들고 나서 바로 쓰다 보니 불편한 점이 하나 있었습니다. 방 목록 옆에 있는 "방 바로가기" 링크를 누르면 수정 중이던 페이지가 그대로 이동해버려서, 사진을 확인하고 돌아오면 검색 결과가 날아가 있었습니다. 별거 아닌 수정이지만 `target="_blank"`만 붙여도 흐름이 훨씬 편해집니다.

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

## 배포 전 검증

바로 프로덕션 DB에 붙는 기능이라 배포 전에 Playwright로 실제 흐름을 끝까지 확인했습니다.

1. 로컬에서 관리자 로그인
2. `/admin/topics`에서 방 검색
3. 사진 교체 + 설명 수정
4. 저장 후 실제 방 페이지에서 반영 확인

전체 플로우가 로컬에서 문제없이 동작하는 걸 확인한 뒤 프로덕션 DB에도 같은 흐름으로 테스트했고, 테스트에 쓴 데이터는 원래 값으로 복구해뒀습니다.

## 정리

| 고민 | 결정 |
|---|---|
| 사진/설명 오류를 누가 고칠까 | 투표(다수결) 대신 관리자 직접 수정 |
| 왜 투표를 배제했나 | 사실 확인은 다수결의 영역이 아니고, 소수가 몰리면 악용 가능 |
| 새 시스템을 또 만들까 | 아니오 — 기존 신고 처리 인프라(admin-auth, /admin/reports)에 얹기 |
| 이미지 업로드는 새로 만들까 | 아니오 — 기존 `/api/upload` 재사용 |
| 이미지 URL 검증 | 우리 Storage prefix로 시작하는 URL만 허용 |

실존 인물을 다루는 서비스라면 "이 정보가 맞는가"를 커뮤니티 투표에 맡기고 싶은 유혹이 생길 수 있습니다. 하지만 사실 확인과 여론 수렴은 다른 문제입니다. 그리고 새 기능을 만들기 전에 "이미 있는 인프라에 얹을 수 있는가"를 먼저 물어보면, 개발량도 줄고 검증해야 할 표면적도 줄어든다는 걸 다시 한번 느꼈습니다.
