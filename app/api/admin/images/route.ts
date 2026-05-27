import { NextRequest, NextResponse } from "next/server";
import { putFilesBatch } from "@/lib/github";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const rawFiles = formData.getAll("file");

  if (!rawFiles.length) {
    return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  }

  const now = Date.now();
  const valid: { file: File; filename: string; githubPath: string }[] = [];

  for (let i = 0; i < rawFiles.length; i++) {
    const f = rawFiles[i];
    if (!(f instanceof File)) continue;
    const ext = ALLOWED_TYPES[f.type];
    if (!ext) continue;

    const safeName = f.name
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9가-힣_-]/g, "_")
      .slice(0, 40);
    const filename = `${safeName}_${now + i}.${ext}`;
    valid.push({ file: f, filename, githubPath: `public/images/${filename}` });
  }

  if (!valid.length) {
    return NextResponse.json({ error: "jpg, png, gif, webp만 업로드 가능합니다." }, { status: 400 });
  }

  const fileData = await Promise.all(
    valid.map(async (v) => {
      const base64 = Buffer.from(await v.file.arrayBuffer()).toString("base64");
      return { path: v.githubPath, base64, filename: v.filename, originalName: v.file.name };
    })
  );

  const commitMessage =
    fileData.length === 1
      ? `image: ${fileData[0].filename} 추가`
      : `image: 이미지 ${fileData.length}개 추가`;

  await putFilesBatch(
    fileData.map((f) => ({ path: f.path, base64: f.base64 })),
    commitMessage
  );

  const owner = process.env.GITHUB_OWNER ?? "hyunseokyu1-netizen";
  const repo = process.env.GITHUB_REPO ?? "backtodev";

  const urls = fileData.map((f) => ({
    url: `https://raw.githubusercontent.com/${owner}/${repo}/main/${f.path}`,
    name: f.originalName.replace(/\.[^.]+$/, ""),
  }));

  return NextResponse.json({ urls });
}
