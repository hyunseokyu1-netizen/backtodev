import { NextRequest, NextResponse } from "next/server";
import { getFile, putFile, deleteFile } from "@/lib/github";
import matter from "gray-matter";

interface Params {
  params: Promise<{ slug: string }>;
}

// lang 쿼리파라미터로 언어 버전 특정. 기본값 ko
function getLang(request: NextRequest): string {
  return request.nextUrl.searchParams.get("lang") ?? "ko";
}

// 후보 파일 경로 목록 (우선순위 순)
function getCandidates(slug: string, lang: string): string[] {
  const other = lang === "ko" ? "en" : "ko";
  return [
    `content/posts/${slug}.${lang}.md`,
    `content/posts/${slug}.${lang}.mdx`,
    `content/posts/${slug}.md`,   // 레거시
    `content/posts/${slug}.mdx`,  // 레거시
    `content/posts/${slug}.${other}.md`,
    `content/posts/${slug}.${other}.mdx`,
  ];
}

export async function GET(request: NextRequest, { params }: Params) {
  const { slug } = await params;
  const lang = getLang(request);

  for (const filePath of getCandidates(slug, lang)) {
    const file = await getFile(filePath);
    if (!file) continue;
    const { data, content } = matter(file.content);
    // 실제 파일의 언어 추출
    const match = filePath.match(/\.(ko|en)\.(md|mdx)$/);
    const fileLang = match ? match[1] : "ko";
    return NextResponse.json({ slug, frontmatter: { ...data, lang: fileLang }, content, sha: file.sha, filePath });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { slug } = await params;
  const body = await request.json();
  const { title, date, description, tags, lang, content, sha, filePath } = body;

  // filePath가 명시되면 그 경로 사용, 없으면 slug.{lang}.md
  const targetPath = filePath ?? `content/posts/${slug}.${lang ?? "ko"}.md`;

  const fileContent = matter.stringify(content ?? "", {
    title,
    date,
    description,
    tags,
  });

  try {
    const newSha = await putFile(targetPath, fileContent, `post: ${title} 수정`, sha);
    return NextResponse.json({ ok: true, sha: newSha, filePath: targetPath });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "저장 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { slug } = await params;
  const lang = getLang(request);

  for (const filePath of getCandidates(slug, lang)) {
    const file = await getFile(filePath);
    if (!file) continue;
    await deleteFile(filePath, file.sha, `post: ${slug} (${lang}) 삭제`);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
