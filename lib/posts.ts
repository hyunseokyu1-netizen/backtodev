import fs from "fs";
import path from "path";
import matter from "gray-matter";

const postsDir = path.join(process.cwd(), "content/posts");
const IS_PROD = !!process.env.VERCEL;

export interface PostMeta {
  slug: string;
  title: string;
  date: string;
  description?: string;
  tags?: string[];
  lang?: string;
}

export interface Post extends PostMeta {
  content: string;
}

// ── GitHub API (프로덕션) ────────────────────────────────────────────────────

const GH_BASE = `https://api.github.com/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/contents`;
const ghHeaders = {
  Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

async function fetchFromGitHub(filePath: string): Promise<string | null> {
  const res = await fetch(`${GH_BASE}/${filePath}`, {
    headers: ghHeaders,
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = await res.json();
  return Buffer.from(data.content, "base64").toString("utf-8");
}

async function listGitHubDir(dirPath: string): Promise<{ name: string }[]> {
  const res = await fetch(`${GH_BASE}/${dirPath}`, {
    headers: ghHeaders,
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

function parsePost(slug: string, raw: string): PostMeta {
  const { data } = matter(raw);
  return {
    slug,
    title: data.title ?? slug,
    date: data.date ?? "",
    description: data.description ?? "",
    tags: data.tags ?? [],
    lang: data.lang ?? "en",
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function getAllPosts(): Promise<PostMeta[]> {
  if (IS_PROD) {
    const files = await listGitHubDir("content/posts");
    const mdFiles = files.filter(
      (f) => f.name.endsWith(".md") || f.name.endsWith(".mdx")
    );
    const posts = await Promise.all(
      mdFiles.map(async (f) => {
        const raw = await fetchFromGitHub(`content/posts/${f.name}`);
        if (!raw) return null;
        const slug = f.name.replace(/\.(md|mdx)$/, "");
        return parsePost(slug, raw);
      })
    );
    return posts
      .filter(Boolean)
      .sort((a, b) => (a!.date < b!.date ? 1 : -1)) as PostMeta[];
  }

  // 로컬: 파일시스템
  if (!fs.existsSync(postsDir)) return [];
  return fs
    .readdirSync(postsDir)
    .filter((f) => f.endsWith(".md") || f.endsWith(".mdx"))
    .map((file) => {
      const slug = file.replace(/\.(md|mdx)$/, "");
      const raw = fs.readFileSync(path.join(postsDir, file), "utf-8");
      return parsePost(slug, raw);
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function getPost(slug: string): Promise<Post | null> {
  let raw: string | null = null;

  if (IS_PROD) {
    raw =
      (await fetchFromGitHub(`content/posts/${slug}.mdx`)) ??
      (await fetchFromGitHub(`content/posts/${slug}.md`));
  } else {
    const mdxPath = path.join(postsDir, `${slug}.mdx`);
    const mdPath = path.join(postsDir, `${slug}.md`);
    const filePath = fs.existsSync(mdxPath) ? mdxPath : mdPath;
    if (fs.existsSync(filePath)) raw = fs.readFileSync(filePath, "utf-8");
  }

  if (!raw) return null;
  const { data, content } = matter(raw);
  return {
    slug,
    title: data.title ?? slug,
    date: data.date ?? "",
    description: data.description ?? "",
    tags: data.tags ?? [],
    lang: data.lang ?? "en",
    content,
  };
}
