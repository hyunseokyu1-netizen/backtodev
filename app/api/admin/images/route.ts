import { NextRequest, NextResponse } from "next/server";
import { putFileBinary, getFileSha } from "@/lib/github";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  }

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json({ error: "jpg, png, gif, webp만 업로드 가능합니다." }, { status: 400 });
  }

  const timestamp = Date.now();
  const safeName = file.name
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9가-힣_-]/g, "_")
    .slice(0, 40);
  const filename = `${safeName}_${timestamp}.${ext}`;
  const githubPath = `public/images/${filename}`;

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  // 혹시 같은 파일명 존재하면 sha 가져와서 덮어쓰기
  const sha = await getFileSha(githubPath);
  await putFileBinary(githubPath, base64, `image: ${filename} 추가`, sha ?? undefined);

  return NextResponse.json({ url: `/images/${filename}` });
}
