---
title: 'Upload 10 Images, Get 1 Commit — Batch Uploads With the GitHub Tree API'
date: '2026-05-27'
publish_date: '2026-06-17'
description: How I improved a Next.js admin so that selecting multiple images produces only a single commit, using the GitHub Tree API
tags:
  - GitHub API
  - Next.js
  - Tree API
  - Troubleshooting
---

## Every image upload creates a commit

Writing a post in the blog admin, I needed to drop in several screenshots.

But every single image upload piled up one more commit on GitHub.

```
image: added screenshot_01_1748380000000.png
image: added screenshot_02_1748380001000.png
image: added screenshot_03_1748380002000.png
image: added screenshot_04_1748380003000.png
```

Upload 4 photos, get 4 commits. Upload 10, get 10. The git log gets buried in image commits.

The reason was simple. The existing implementation used the GitHub Contents API (`PUT /contents/{path}`), which is structured as **1 file = 1 request = 1 commit.**

```typescript
// Old approach — a separate call per file
await putFileBinary(githubPath, base64, `image: added ${filename}`, sha);
```

Loop over multiple files → N calls → N commits.

---

## Contents API vs. Tree API

GitHub's API offers two ways to upload files.

### Contents API (the old one)

```
PUT /repos/{owner}/{repo}/contents/{path}
```

- Handles exactly one file
- 1 call = 1 commit auto-generated
- Simple, but no batching possible

### Tree API (after switching)

An API that works directly with git's internal structure. Lets you assemble a commit yourself.

```
1. POST /git/blobs        → store the file content as a blob
2. GET  /git/refs/heads/main → look up the current HEAD commit SHA
3. GET  /git/commits/{sha}   → look up the current tree SHA
4. POST /git/trees        → create a new tree (N blobs at once)
5. POST /git/commits      → create the commit (linking the tree + parent commit)
6. PATCH /git/refs/heads/main → update HEAD
```

Looks complicated, but the flow is simple. **Make all the blobs first, bundle them into one tree, and wrap it up as a single commit.**

| | Contents API | Tree API |
|---|---|---|
| Uploading N files | N commits | 1 commit |
| Implementation difficulty | Easy | Medium |
| Parallelization | Not possible | Blob creation can be parallelized |

---

## Implementation

### Step 1 — Add Tree API functions to lib/github.ts

Added these functions to the existing file.

```typescript
const GIT_BASE = `https://api.github.com/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/git`;

// Look up the current HEAD commit SHA and tree SHA
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

// Save file content as a blob (returns its SHA)
async function createBlob(base64Content: string): Promise<string> {
  const res = await fetch(`${GIT_BASE}/blobs`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ content: base64Content, encoding: "base64" }),
  });
  const data = await res.json();
  return data.sha as string;
}

// Bundle blobs into a new tree
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

// Create the commit
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

// Update the HEAD pointer
async function updateRef(commitSha: string): Promise<void> {
  await fetch(`${GIT_BASE}/refs/heads/main`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ sha: commitSha }),
  });
}

// The function used externally — N files into 1 commit
export async function putFilesBatch(
  files: { path: string; base64: string }[],
  message: string
): Promise<void> {
  const { commitSha, treeSha } = await getHeadRef();

  // Blob creation can be parallelized
  const blobShas = await Promise.all(files.map((f) => createBlob(f.base64)));

  const items = files.map((f, i) => ({ path: f.path, sha: blobShas[i] }));
  const newTreeSha = await createTree(treeSha, items);
  const newCommitSha = await createCommit(message, newTreeSha, commitSha);
  await updateRef(newCommitSha);
}
```

Blob creation is parallelized with `Promise.all`. The remaining steps (tree → commit → ref update) have an inherent order, so they run sequentially.

---

### Step 2 — Update the API route

Modified `app/api/admin/images/route.ts` to accept multiple files at once.

```typescript
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const rawFiles = formData.getAll("file"); // getAll instead of a single get

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
    // Adding the index to the timestamp avoids filename collisions even if uploaded in the same ms
    const filename = `${safeName}_${now + i}.${ext}`;
    valid.push({ file: f, filename, githubPath: `public/images/${filename}` });
  }

  // Convert every file to base64
  const fileData = await Promise.all(
    valid.map(async (v) => {
      const base64 = Buffer.from(await v.file.arrayBuffer()).toString("base64");
      return { path: v.githubPath, base64, filename: v.filename, originalName: v.file.name };
    })
  );

  // Commit message — filename for 1, "added N images" for N
  const commitMessage =
    fileData.length === 1
      ? `image: added ${fileData[0].filename}`
      : `image: added ${fileData.length} images`;

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

### Step 3 — Update the editor UI

Two changes in `PostEditor.tsx`.

**Add `multiple` to the file input:**

```tsx
<input
  ref={fileInputRef}
  type="file"
  accept="image/jpeg,image/png,image/gif,image/webp"
  multiple   // ← just this one addition
  className="hidden"
  onChange={handleImageUpload}
/>
```

**Replace the handler to process multiple files:**

```typescript
const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(e.target.files ?? []);
  if (!files.length) return;
  e.target.value = "";

  // Different button text depending on the file count
  setUploading(files.length === 1 ? "Uploading..." : `Uploading ${files.length} files...`);
  setError("");

  try {
    const formData = new FormData();
    files.forEach((f) => formData.append("file", f)); // append all under the same key

    const res = await fetch("/api/admin/images", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Upload failed");

    // Join all image tags with a newline and insert at the cursor position
    const markdown = (data.urls as { url: string; name: string }[])
      .map((item) => `![${item.name}](${item.url.trim()})`)
      .join("\n");
    insertAtCursor(markdown);
  } catch (e) {
    setError(e instanceof Error ? e.message : "Image upload failed");
  } finally {
    setUploading(null);
  }
};
```

---

## Result

Select 5 images, and the button shows "Uploading 5 files...". Once it's done, the git log shows just this.

```
image: added 5 images
```

One commit. Clean.

The editor cursor position gets all the markdown image tags inserted at once.

```markdown
![screenshot_01](https://raw.githubusercontent.com/.../screenshot_01_1748380000000.png)
![screenshot_02](https://raw.githubusercontent.com/.../screenshot_02_1748380001000.png)
![screenshot_03](https://raw.githubusercontent.com/.../screenshot_03_1748380002000.png)
```

---

## Summary

| Step | Role |
|------|------|
| `createBlob` × N | Save the file content to GitHub (parallel) |
| `getHeadRef` | Look up the current HEAD and tree SHA |
| `createTree` | Bundle N blobs into a single tree |
| `createCommit` | Create a commit from the tree + parent commit |
| `updateRef` | Update HEAD to the new commit |

The Contents API is convenient for simple tasks, but the Tree API is far better when handling multiple files. Once you understand the structure, it's easy to apply elsewhere too.
