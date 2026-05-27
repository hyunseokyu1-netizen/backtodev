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

const GH_GRAPHQL = "https://api.github.com/graphql";
const ghHeaders = {
  Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
  "Content-Type": "application/json",
};

// GraphQL로 한 번에 디렉토리 내 모든 파일 이름+내용을 가져옴 (REST 대비 N+1 호출 → 1번)
async function listGitHubDirWithContent(
  dirPath: string
): Promise<{ name: string; text: string }[]> {
  const query = `
    query($owner: String!, $repo: String!, $expr: String!) {
      repository(owner: $owner, name: $repo) {
        object(expression: $expr) {
          ... on Tree {
            entries {
              name
              object {
                ... on Blob { text }
              }
            }
          }
        }
      }
    }
  `;
  const res = await fetch(GH_GRAPHQL, {
    method: "POST",
    headers: ghHeaders,
    body: JSON.stringify({
      query,
      variables: {
        owner: process.env.GITHUB_OWNER,
        repo: process.env.GITHUB_REPO,
        expr: `HEAD:${dirPath}`,
      },
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error("[posts] listGitHubDirWithContent HTTP error:", res.status, await res.text());
    return [];
  }
  const json = await res.json();
  if (json.errors) {
    console.error("GQL_ERR:" + json.errors[0]?.message);
    console.error("ENV:" + process.env.GITHUB_OWNER + "/" + process.env.GITHUB_REPO);
  }
  const entries: { name: string; object: { text?: string } }[] =
    json?.data?.repository?.object?.entries ?? [];
  console.log("GQL_OK entries=" + entries.length);
  return entries
    .filter((e) => e.object?.text !== undefined && e.object.text !== null)
    .map((e) => ({ name: e.name, text: e.object.text as string }));
}

// 단일 파일 조회 (getPost용) — GraphQL로 1번 호출
async function fetchFromGitHub(filePath: string): Promise<string | null> {
  const query = `
    query($owner: String!, $repo: String!, $expr: String!) {
      repository(owner: $owner, name: $repo) {
        object(expression: $expr) {
          ... on Blob { text }
        }
      }
    }
  `;
  const res = await fetch(GH_GRAPHQL, {
    method: "POST",
    headers: ghHeaders,
    body: JSON.stringify({
      query,
      variables: {
        owner: process.env.GITHUB_OWNER,
        repo: process.env.GITHUB_REPO,
        expr: `HEAD:${filePath}`,
      },
    }),
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data?.repository?.object?.text ?? null;
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

export async function getAllPosts(locale = "ko"): Promise<PostMeta[]> {
  // slug → { ko: PostMeta, en: PostMeta } 수집
  const slugMap = new Map<string, Partial<Record<string, PostMeta>>>();

  const processFile = (name: string, raw: string) => {
    const parsed = parseFileName(name);
    if (!parsed) return;
    const meta = parseFrontmatter(parsed.slug, parsed.lang, raw);
    const entry = slugMap.get(parsed.slug) ?? {};
    entry[parsed.lang] = meta;
    slugMap.set(parsed.slug, entry);
  };

  if (IS_PROD) {
    const files = await listGitHubDirWithContent("content/posts");
    files
      .filter((f) => f.name.endsWith(".md") || f.name.endsWith(".mdx"))
      .forEach((f) => processFile(f.name, f.text));
  } else {
    if (!fs.existsSync(postsDir)) return [];
    fs.readdirSync(postsDir)
      .filter((f) => f.endsWith(".md") || f.endsWith(".mdx"))
      .forEach((file) => {
        const raw = fs.readFileSync(path.join(postsDir, file), "utf-8");
        processFile(file, raw);
      });
  }

  const fallback = locale === "ko" ? "en" : "ko";
  const result: PostMeta[] = [];
  for (const entry of slugMap.values()) {
    const post = entry[locale] ?? entry[fallback];
    if (post) result.push({ ...post, isFallback: !entry[locale] });
  }

  return result.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    // 같은 날짜: slug 오름차순 (알파벳 앞 순서가 최상단)
    return a.slug < b.slug ? -1 : 1;
  });
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
