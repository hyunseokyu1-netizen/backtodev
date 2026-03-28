import { NextRequest, NextResponse } from "next/server";
import { listDir, getFile, putFile } from "@/lib/github";
import matter from "gray-matter";

// slug.ko.md, slug.en.md, slug.md(레거시) 파싱
function parseFileName(name: string): { slug: string; lang: string } | null {
  const match = name.match(/^(.+)\.(ko|en)\.(md|mdx)$/);
  if (match) return { slug: match[1], lang: match[2] };
  const legacy = name.match(/^(.+)\.(md|mdx)$/);
  if (legacy) return { slug: legacy[1], lang: "ko" };
  return null;
}

export async function GET() {
  const files = await listDir("content/posts");
  const mdFiles = files.filter((f) => f.name.endsWith(".md") || f.name.endsWith(".mdx"));

  const posts = await Promise.all(
    mdFiles.map(async (f) => {
      const parsed = parseFileName(f.name);
      if (!parsed) return null;
      const file = await getFile(f.path);
      if (!file) return null;
      const { data } = matter(file.content);
      return {
        slug: parsed.slug,
        lang: parsed.lang,
        title: data.title ?? parsed.slug,
        date: data.date ?? "",
        description: data.description ?? "",
        tags: data.tags ?? [],
        sha: f.sha,
        fileName: f.name,
      };
    })
  );

  const sorted = posts
    .filter(Boolean)
    .sort((a, b) => (a!.date < b!.date ? 1 : -1));

  return NextResponse.json(sorted);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { slug, title, date, description, tags, lang, content } = body;

  if (!slug || !title) {
    return NextResponse.json({ error: "slug와 title은 필수입니다." }, { status: 400 });
  }

  const fileLang = lang ?? "ko";
  const filePath = `content/posts/${slug}.${fileLang}.md`;

  // 이미 존재하는지 확인
  const existing = await getFile(filePath);
  if (existing) {
    return NextResponse.json({ error: "이미 같은 slug/언어의 글이 존재합니다." }, { status: 409 });
  }

  const fileContent = matter.stringify(content ?? "", {
    title,
    date,
    description,
    tags,
  });

  await putFile(filePath, fileContent, `post: ${title} 추가`);
  return NextResponse.json({ ok: true });
}
