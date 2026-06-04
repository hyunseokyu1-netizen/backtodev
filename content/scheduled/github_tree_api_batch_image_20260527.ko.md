---
title: '이미지 10장 올려도 커밋 1개 — GitHub Tree API로 배치 업로드 구현'
date: '2026-05-27'
publish_date: '2026-06-17'
description: Next.js 어드민에서 이미지를 여러 장 선택해도 커밋 1개만 생기도록 GitHub Tree API로 개선한 과정
tags:
  - GitHub API
  - Next.js
  - Tree API
  - 트러블슈팅
---

## 이미지 올릴 때마다 커밋이 생긴다

블로그 어드민에서 글을 쓰면서 스크린샷을 여러 장 넣을 일이 생겼다.

그런데 이미지를 하나 올릴 때마다 GitHub에 커밋이 하나씩 쌓였다.

```
image: screenshot_01_1748380000000.png 추가
image: screenshot_02_1748380001000.png 추가
image: screenshot_03_1748380002000.png 추가
image: screenshot_04_1748380003000.png 추가
```

사진 4장 올리면 커밋 4개. 10장이면 10개. git log가 이미지 커밋으로 뒤덮인다.

이유는 간단했다. 기존 구현이 GitHub Contents API(`PUT /contents/{path}`)를 쓰고 있었는데, 이 API는 **파일 1개 = 요청 1번 = 커밋 1개** 구조다.

```typescript
// 기존 방식 — 파일마다 따로 호출
await putFileBinary(githubPath, base64, `image: ${filename} 추가`, sha);
```

파일이 여러 개면 루프를 돌면서 N번 호출 → N개 커밋.

---

## Contents API vs Tree API

GitHub API에는 파일을 올리는 방법이 두 가지 있다.

### Contents API (기존)

```
PUT /repos/{owner}/{repo}/contents/{path}
```

- 파일 1개만 처리
- 호출 1번 = 커밋 1개 자동 생성
- 간단하지만 배치 처리 불가

### Tree API (변경 후)

Git의 내부 구조를 직접 다루는 API. 커밋을 직접 조립할 수 있다.

```
1. POST /git/blobs        → 파일 내용을 blob으로 저장
2. GET  /git/refs/heads/main → 현재 HEAD 커밋 SHA 조회
3. GET  /git/commits/{sha}   → 현재 트리 SHA 조회
4. POST /git/trees        → 새 트리 생성 (N개 blob 한번에)
5. POST /git/commits      → 커밋 생성 (트리 + 부모 커밋 연결)
6. PATCH /git/refs/heads/main → HEAD 업데이트
```

복잡해 보이지만 흐름은 단순하다. **blob을 먼저 다 만들어 놓고, 트리 하나에 묶어서, 커밋 1개로 마무리.**

| | Contents API | Tree API |
|---|---|---|
| 파일 N개 업로드 | 커밋 N개 | 커밋 1개 |
| 구현 난이도 | 쉬움 | 중간 |
| 병렬 처리 | 불가 | blob 생성은 병렬 가능 |

---

## 구현

### Step 1 — lib/github.ts에 Tree API 함수 추가

기존 파일에 아래 함수들을 추가했다.

```typescript
const GIT_BASE = `https://api.github.com/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/git`;

// 현재 HEAD 커밋 SHA와 트리 SHA 조회
async function getHeadRef(): Promise<{ commitSha: string; treeSha: string }> {
  const refRes = await fetch(`${GIT_BASE}/refs/heads/main`, {
    headers: headers(),
    cache: "no-store",
  });
  const { object } = await refRes.json();
  const commitSha: string = object.sha;

  const commitRes = await fetch(`${GIT_BASE}/commits/${commitSha}`, {
    headers: headers(),
    cache: "no-store",
  });
  const { tree } = await commitRes.json();
  return { commitSha, treeSha: tree.sha };
}

// 파일 내용을 blob으로 저장 (SHA 반환)
async function createBlob(base64Content: string): Promise<string> {
  const res = await fetch(`${GIT_BASE}/blobs`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ content: base64Content, encoding: "base64" }),
  });
  const data = await res.json();
  return data.sha as string;
}

// blob들을 묶어 새 트리 생성
async function createTree(
  baseTreeSha: string,
  items: { path: string; sha: string }[]
): Promise<string> {
  const res = await fetch(`${GIT_BASE}/trees`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: items.map((item) => ({
        path: item.path,
        mode: "100644",
        type: "blob",
        sha: item.sha,
      })),
    }),
  });
  const data = await res.json();
  return data.sha as string;
}

// 커밋 생성
async function createCommit(
  message: string,
  treeSha: string,
  parentSha: string
): Promise<string> {
  const res = await fetch(`${GIT_BASE}/commits`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ message, tree: treeSha, parents: [parentSha] }),
  });
  const data = await res.json();
  return data.sha as string;
}

// HEAD 포인터 업데이트
async function updateRef(commitSha: string): Promise<void> {
  await fetch(`${GIT_BASE}/refs/heads/main`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ sha: commitSha }),
  });
}

// 외부에서 쓰는 함수 — 파일 N개를 커밋 1개로
export async function putFilesBatch(
  files: { path: string; base64: string }[],
  message: string
): Promise<void> {
  const { commitSha, treeSha } = await getHeadRef();

  // blob은 병렬로 만들어도 됨
  const blobShas = await Promise.all(files.map((f) => createBlob(f.base64)));

  const items = files.map((f, i) => ({ path: f.path, sha: blobShas[i] }));
  const newTreeSha = await createTree(treeSha, items);
  const newCommitSha = await createCommit(message, newTreeSha, commitSha);
  await updateRef(newCommitSha);
}
```

blob 생성은 `Promise.all`로 병렬 처리한다. 나머지 단계(트리→커밋→ref 업데이트)는 순서가 있으니 순차적으로.

---

### Step 2 — API 라우트 수정

`app/api/admin/images/route.ts`를 수정해서 여러 파일을 한꺼번에 받도록 했다.

```typescript
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const rawFiles = formData.getAll("file"); // 단수 get → 복수 getAll

  const now = Date.now();
  const valid: { file: File; filename: string; githubPath: string }[] = [];

  for (let i = 0; i < rawFiles.length; i++) {
    const f = rawFiles[i];
    if (!(f instanceof File)) continue;
    const ext = ALLOWED_TYPES[f.type];
    if (!ext) continue;

    const safeName = f.name
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9가-힣_-]/g, "_")
      .slice(0, 40);
    // 타임스탬프에 인덱스를 더해 같은 ms에 업로드해도 파일명 충돌 없음
    const filename = `${safeName}_${now + i}.${ext}`;
    valid.push({ file: f, filename, githubPath: `public/images/${filename}` });
  }

  // 모든 파일을 base64로 변환
  const fileData = await Promise.all(
    valid.map(async (v) => {
      const base64 = Buffer.from(await v.file.arrayBuffer()).toString("base64");
      return { path: v.githubPath, base64, filename: v.filename, originalName: v.file.name };
    })
  );

  // 커밋 메시지 — 1개면 파일명, N개면 "N개 추가"
  const commitMessage =
    fileData.length === 1
      ? `image: ${fileData[0].filename} 추가`
      : `image: 이미지 ${fileData.length}개 추가`;

  await putFilesBatch(
    fileData.map((f) => ({ path: f.path, base64: f.base64 })),
    commitMessage
  );

  const urls = fileData.map((f) => ({
    url: `https://raw.githubusercontent.com/${owner}/${repo}/main/${f.path}`,
    name: f.originalName.replace(/\.[^.]+$/, ""),
  }));

  return NextResponse.json({ urls });
}
```

---

### Step 3 — 에디터 UI 수정

`PostEditor.tsx`에서 두 가지를 바꿨다.

**파일 input에 `multiple` 추가:**

```tsx
<input
  ref={fileInputRef}
  type="file"
  accept="image/jpeg,image/png,image/gif,image/webp"
  multiple   // ← 이거 하나 추가
  className="hidden"
  onChange={handleImageUpload}
/>
```

**핸들러를 다중 파일 처리로 교체:**

```typescript
const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(e.target.files ?? []);
  if (!files.length) return;
  e.target.value = "";

  // 파일 수에 따라 버튼 텍스트 다르게
  setUploading(files.length === 1 ? "업로드 중..." : `${files.length}개 업로드 중...`);
  setError("");

  try {
    const formData = new FormData();
    files.forEach((f) => formData.append("file", f)); // 모두 같은 키로 추가

    const res = await fetch("/api/admin/images", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "업로드 실패");

    // 모든 이미지 태그를 줄바꿈으로 이어서 커서 위치에 삽입
    const markdown = (data.urls as { url: string; name: string }[])
      .map((item) => `![${item.name}](${item.url.trim()})`)
      .join("\n");
    insertAtCursor(markdown);
  } catch (e) {
    setError(e instanceof Error ? e.message : "이미지 업로드 실패");
  } finally {
    setUploading(null);
  }
};
```

---

## 결과

이미지 5장을 선택하면 버튼에 "5개 업로드 중..."이 뜨고, 완료되면 git log는 이렇게 남는다.

```
image: 이미지 5개 추가
```

커밋 1개. 깔끔하다.

에디터 커서 위치에는 마크다운 이미지 태그가 한꺼번에 삽입된다.

```markdown
![screenshot_01](https://raw.githubusercontent.com/.../screenshot_01_1748380000000.png)
![screenshot_02](https://raw.githubusercontent.com/.../screenshot_02_1748380001000.png)
![screenshot_03](https://raw.githubusercontent.com/.../screenshot_03_1748380002000.png)
```

---

## 정리

| 단계 | 역할 |
|------|------|
| `createBlob` × N | 파일 내용을 GitHub에 저장 (병렬) |
| `getHeadRef` | 현재 HEAD와 트리 SHA 확인 |
| `createTree` | N개 blob을 하나의 트리로 묶음 |
| `createCommit` | 트리 + 부모 커밋으로 커밋 생성 |
| `updateRef` | HEAD를 새 커밋으로 업데이트 |

Contents API는 단순 작업엔 편하지만, 파일 여러 개를 다룰 때는 Tree API가 훨씬 낫다. 구조를 한 번 이해하면 이후엔 응용하기도 쉽다.
