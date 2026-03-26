import { NextRequest, NextResponse } from "next/server";
import { getFile, putFile, deleteFile } from "@/lib/github";
import matter from "gray-matter";

interface Params {
  params: Promise<{ slug: string }>;
}

export async function GET(_: NextRequest, { params }: Params) {
  const { slug } = await params;
  const path = `content/posts/${slug}.md`;
  const file = await getFile(path);
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, content } = matter(file.content);
  return NextResponse.json({ slug, frontmatter: data, content, sha: file.sha });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { slug } = await params;
  const body = await request.json();
  const { title, date, description, tags, lang, content, sha } = body;

  const path = `content/posts/${slug}.md`;
  const fileContent = matter.stringify(content ?? "", {
    title,
    date,
    description,
    tags,
    lang,
  });

  await putFile(path, fileContent, `post: ${title} 수정`, sha);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { slug } = await params;
  const path = `content/posts/${slug}.md`;

  const file = await getFile(path);
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deleteFile(path, file.sha, `post: ${slug} 삭제`);
  return NextResponse.json({ ok: true });
}
