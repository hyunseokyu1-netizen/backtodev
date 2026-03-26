const BASE = `https://api.github.com/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/contents`;

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

export async function putFile(path: string, content: string, message: string, sha?: string): Promise<void> {
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
}

export async function deleteFile(path: string, sha: string, message: string): Promise<void> {
  const res = await fetch(`${BASE}/${path}`, {
    method: "DELETE",
    headers: headers(),
    body: JSON.stringify({ message, sha }),
  });
  if (!res.ok) throw new Error(`GitHub DELETE failed: ${res.status}`);
}
