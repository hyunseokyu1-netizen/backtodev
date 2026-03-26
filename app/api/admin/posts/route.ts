import { NextRequest, NextResponse } from "next/server";
import { listDir, getFile, putFile } from "@/lib/github";
import matter from "gray-matter";

export async function GET() {
  const files = await listDir("content/posts");
  const mdFiles = files.filter((f) => f.name.endsWith(".md") || f.name.endsWith(".mdx"));

  const posts = await Promise.all(
    mdFiles.map(async (f) => {
      const file = await getFile(f.path);
      if (!file) return null;
      const { data } = matter(file.content);
      const slug = f.name.replace(/\.(md|mdx)$/, "");
      return {
        slug,
        title: data.title ?? slug,
        date: data.date ?? "",
        description: data.description ?? "",
        tags: data.tags ?? [],
        lang: data.lang ?? "en",
        sha: f.sha,
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

  const frontmatter = matter.stringify(content ?? "", {
    title,
    date,
    description,
    tags,
    lang,
  });

  const path = `content/posts/${slug}.md`;

  // 이미 존재하는지 확인
  const existing = await getFile(path);
  if (existing) {
    return NextResponse.json({ error: "이미 같은 slug의 글이 존재합니다." }, { status: 409 });
  }

  await putFile(path, frontmatter, `post: ${title} 추가`);
  return NextResponse.json({ ok: true });
}
