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
  /** 해당 locale 버전이 없어서 fallback된 경우 true */
  isFallback?: boolean;
}

export interface Post extends PostMeta {
  content: string;
  sha?: string;
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

// ── 파일명 파싱 ──────────────────────────────────────────────────────────────
// slug.ko.md → { slug: "slug", lang: "ko" }
// slug.en.md → { slug: "slug", lang: "en" }
// slug.md    → { slug: "slug", lang: "ko" } (레거시, 한국어 기본)

function parseFileName(name: string): { slug: string; lang: string } | null {
  const match = name.match(/^(.+)\.(ko|en)\.(md|mdx)$/);
  if (match) return { slug: match[1], lang: match[2] };

  // 레거시 형식 (.md만 있는 경우)
  const legacy = name.match(/^(.+)\.(md|mdx)$/);
  if (legacy) return { slug: legacy[1], lang: "ko" };

  return null;
}

function parseFrontmatter(slug: string, lang: string, raw: string): PostMeta {
  const { data } = matter(raw);
  return {
    slug,
    title: data.title ?? slug,
    date: data.date ?? "",
    description: data.description ?? "",
    tags: data.tags ?? [],
    lang,
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function getAllPosts(): Promise<PostMeta[]> {
  const slugMap = new Map<string, PostMeta>();

  if (IS_PROD) {
    const files = await listGitHubDir("content/posts");
    const mdFiles = files.filter(
      (f) => f.name.endsWith(".md") || f.name.endsWith(".mdx")
    );
    await Promise.all(
      mdFiles.map(async (f) => {
        const parsed = parseFileName(f.name);
        if (!parsed) return;
        const raw = await fetchFromGitHub(`content/posts/${f.name}`);
        if (!raw) return;
        const meta = parseFrontmatter(parsed.slug, parsed.lang, raw);
        // 같은 slug가 여러 언어로 있으면 ko 우선, 없으면 첫 번째
        if (!slugMap.has(parsed.slug) || parsed.lang === "ko") {
          slugMap.set(parsed.slug, meta);
        }
      })
    );
  } else {
    if (!fs.existsSync(postsDir)) return [];
    fs.readdirSync(postsDir)
      .filter((f) => f.endsWith(".md") || f.endsWith(".mdx"))
      .forEach((file) => {
        const parsed = parseFileName(file);
        if (!parsed) return;
        const raw = fs.readFileSync(path.join(postsDir, file), "utf-8");
        const meta = parseFrontmatter(parsed.slug, parsed.lang, raw);
        if (!slugMap.has(parsed.slug) || parsed.lang === "ko") {
          slugMap.set(parsed.slug, meta);
        }
      });
  }

  return Array.from(slugMap.values()).sort((a, b) =>
    a.date < b.date ? 1 : -1
  );
}

export async function getPost(slug: string, locale = "ko"): Promise<Post | null> {
  const otherLocale = locale === "ko" ? "en" : "ko";

  // 우선순위: locale 버전 → 레거시(.md) → 다른 언어 버전
  const candidates: Array<{ path: string; lang: string; isFallback: boolean }> = [
    { path: `content/posts/${slug}.${locale}.md`, lang: locale, isFallback: false },
    { path: `content/posts/${slug}.${locale}.mdx`, lang: locale, isFallback: false },
    { path: `content/posts/${slug}.md`, lang: locale, isFallback: false },
    { path: `content/posts/${slug}.mdx`, lang: locale, isFallback: false },
    { path: `content/posts/${slug}.${otherLocale}.md`, lang: otherLocale, isFallback: true },
    { path: `content/posts/${slug}.${otherLocale}.mdx`, lang: otherLocale, isFallback: true },
  ];

  for (const candidate of candidates) {
    let raw: string | null = null;

    if (IS_PROD) {
      raw = await fetchFromGitHub(candidate.path);
    } else {
      const filePath = path.join(process.cwd(), candidate.path);
      if (fs.existsSync(filePath)) raw = fs.readFileSync(filePath, "utf-8");
    }

    if (!raw) continue;

    const { data, content } = matter(raw);
    return {
      slug,
      title: data.title ?? slug,
      date: data.date ?? "",
      description: data.description ?? "",
      tags: data.tags ?? [],
      lang: candidate.lang,
      isFallback: candidate.isFallback,
      content,
    };
  }

  return null;
}
