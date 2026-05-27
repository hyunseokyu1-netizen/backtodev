const BASE = `https://api.github.com/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/contents`;
const GIT_BASE = `https://api.github.com/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/git`;

const headers = () => ({
  Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "Content-Type": "application/json",
});

export interface GitHubFile {
  content: string;
  sha: string;
}

export async function getFileSha(path: string): Promise<string | null> {
  const res = await fetch(`${BASE}/${path}`, { headers: headers(), cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET failed: ${res.status}`);
  const data = await res.json();
  return data.sha ?? null;
}

export async function getFile(path: string): Promise<GitHubFile | null> {
  const res = await fetch(`${BASE}/${path}`, { headers: headers(), cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET failed: ${res.status}`);
  const data = await res.json();
  const content = Buffer.from(data.content, "base64").toString("utf-8");
  return { content, sha: data.sha };
}

export async function listDir(path: string): Promise<{ name: string; path: string; sha: string }[]> {
  const res = await fetch(`${BASE}/${path}`, { headers: headers(), cache: "no-store" });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`GitHub LIST failed: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data.map((f: { name: string; path: string; sha: string }) => ({ name: f.name, path: f.path, sha: f.sha })) : [];
}

export async function putFile(path: string, content: string, message: string, sha?: string): Promise<string> {
  const body: Record<string, string> = {
    message,
    content: Buffer.from(content, "utf-8").toString("base64"),
  };
  if (sha) body.sha = sha;

  const res = await fetch(`${BASE}/${path}`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub PUT failed: ${res.status} ${err}`);
  }
  const data = await res.json();
  return data.content?.sha ?? "";
}

export async function putFileBinary(path: string, base64Content: string, message: string, sha?: string): Promise<void> {
  const body: Record<string, string> = { message, content: base64Content };
  if (sha) body.sha = sha;

  const res = await fetch(`${BASE}/${path}`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub PUT failed: ${res.status} ${err}`);
  }
}

export async function deleteFile(path: string, sha: string, message: string): Promise<void> {
  const res = await fetch(`${BASE}/${path}`, {
    method: "DELETE",
    headers: headers(),
    body: JSON.stringify({ message, sha }),
  });
  if (!res.ok) throw new Error(`GitHub DELETE failed: ${res.status}`);
}

// ── Tree API (배치 커밋) ───────────────────────────────────────────────────────

async function getHeadRef(): Promise<{ commitSha: string; treeSha: string }> {
  const refRes = await fetch(`${GIT_BASE}/refs/heads/main`, { headers: headers(), cache: "no-store" });
  if (!refRes.ok) throw new Error(`getRef failed: ${refRes.status}`);
  const { object } = await refRes.json();
  const commitSha: string = object.sha;

  const commitRes = await fetch(`${GIT_BASE}/commits/${commitSha}`, { headers: headers(), cache: "no-store" });
  if (!commitRes.ok) throw new Error(`getCommit failed: ${commitRes.status}`);
  const { tree } = await commitRes.json();
  return { commitSha, treeSha: tree.sha };
}

async function createBlob(base64Content: string): Promise<string> {
  const res = await fetch(`${GIT_BASE}/blobs`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ content: base64Content, encoding: "base64" }),
  });
  if (!res.ok) throw new Error(`createBlob failed: ${res.status}`);
  const data = await res.json();
  return data.sha as string;
}

async function createTree(baseTreeSha: string, items: { path: string; sha: string }[]): Promise<string> {
  const res = await fetch(`${GIT_BASE}/trees`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: items.map((item) => ({ path: item.path, mode: "100644", type: "blob", sha: item.sha })),
    }),
  });
  if (!res.ok) throw new Error(`createTree failed: ${res.status}`);
  const data = await res.json();
  return data.sha as string;
}

async function createCommit(message: string, treeSha: string, parentSha: string): Promise<string> {
  const res = await fetch(`${GIT_BASE}/commits`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ message, tree: treeSha, parents: [parentSha] }),
  });
  if (!res.ok) throw new Error(`createCommit failed: ${res.status}`);
  const data = await res.json();
  return data.sha as string;
}

async function updateRef(commitSha: string): Promise<void> {
  const res = await fetch(`${GIT_BASE}/refs/heads/main`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ sha: commitSha }),
  });
  if (!res.ok) throw new Error(`updateRef failed: ${res.status}`);
}

/** 여러 파일을 커밋 1개로 묶어 업로드 */
export async function putFilesBatch(
  files: { path: string; base64: string }[],
  message: string
): Promise<void> {
  const { commitSha, treeSha } = await getHeadRef();
  const blobShas = await Promise.all(files.map((f) => createBlob(f.base64)));
  const items = files.map((f, i) => ({ path: f.path, sha: blobShas[i] }));
  const newTreeSha = await createTree(treeSha, items);
  const newCommitSha = await createCommit(message, newTreeSha, commitSha);
  await updateRef(newCommitSha);
}
