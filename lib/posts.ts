import fs from "fs";
import path from "path";
import matter from "gray-matter";

const postsDir = path.join(process.cwd(), "content", "posts");

export interface PostMeta {
  slug: string;
  title: string;
  date: string;
  description?: string;
  tags?: string[];
  lang?: string;
  /** 해당 locale 버전이 없어서 fallback된 경우 true */
  isFallback?: boolean;
  /** frontmatter에 noindex: true — 사이트에는 노출하되 검색엔진 색인 제외 */
  noindex?: boolean;
}

export interface Post extends PostMeta {
  content: string;
  sha?: string;
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
    noindex: data.noindex === true,
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

  if (!fs.existsSync(postsDir)) return [];
  fs.readdirSync(postsDir)
    .filter((f) => f.endsWith(".md") || f.endsWith(".mdx"))
    .forEach((file) => {
      const raw = fs.readFileSync(path.join(postsDir, file), "utf-8");
      processFile(file, raw);
    });

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
  if (!/^[\p{L}\p{N}_-]+$/u.test(slug)) return null;

  const otherLocale = locale === "ko" ? "en" : "ko";

  // 우선순위: locale 버전 → 레거시(.md) → 다른 언어 버전
  const candidates: Array<{ fileName: string; lang: string; isFallback: boolean }> = [
    { fileName: `${slug}.${locale}.md`, lang: locale, isFallback: false },
    { fileName: `${slug}.${locale}.mdx`, lang: locale, isFallback: false },
    { fileName: `${slug}.md`, lang: locale, isFallback: false },
    { fileName: `${slug}.mdx`, lang: locale, isFallback: false },
    { fileName: `${slug}.${otherLocale}.md`, lang: otherLocale, isFallback: true },
    { fileName: `${slug}.${otherLocale}.mdx`, lang: otherLocale, isFallback: true },
  ];

  for (const candidate of candidates) {
    const filePath = path.join(postsDir, candidate.fileName);
    if (!fs.existsSync(filePath)) continue;
    const raw = fs.readFileSync(filePath, "utf-8");

    const { data, content } = matter(raw);
    return {
      slug,
      title: data.title ?? slug,
      date: data.date ?? "",
      description: data.description ?? "",
      tags: data.tags ?? [],
      lang: candidate.lang,
      isFallback: candidate.isFallback,
      noindex: data.noindex === true,
      content,
    };
  }

  return null;
}
