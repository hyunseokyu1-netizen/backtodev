import { NextRequest, NextResponse } from "next/server";

const DEEPL_API_URL = "https://api-free.deepl.com/v2/translate";

export async function POST(req: NextRequest) {
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "DEEPL_API_KEY가 설정되지 않았습니다." }, { status: 500 });
  }

  const { text, direction } = await req.json() as { text: string; direction: "ko-en" | "en-ko" };

  const sourceLang = direction === "ko-en" ? "KO" : "EN";
  const targetLang = direction === "ko-en" ? "EN" : "KO";

  const res = await fetch(DEEPL_API_URL, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: [text],
      source_lang: sourceLang,
      target_lang: targetLang,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: `DeepL API 오류: ${err}` }, { status: res.status });
  }

  const data = await res.json();
  const translated = data.translations?.[0]?.text ?? "";
  return NextResponse.json({ translated });
}
