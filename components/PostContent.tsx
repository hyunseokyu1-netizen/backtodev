"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  content: string;
  needsTranslation: boolean;
  translationDirection: "en-ko" | "ko-en";
  translateLabel: string;
  writtenInLabel: string;
  translatingLabel: string;
  errorLabel: string;
  originalLabel: string;
  translatedBadge: string;
}

async function translateText(text: string, direction: "en-ko" | "ko-en"): Promise<string> {
  // MyMemory API: 무료, API 키 불필요 (일 500단어 제한)
  const langpair = direction === "en-ko" ? "en|ko" : "ko|en";
  const chunks = splitIntoChunks(text, 400);
  const translated: string[] = [];

  for (const chunk of chunks) {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${langpair}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    if (data.responseStatus !== 200) throw new Error(data.responseDetails);
    translated.push(data.responseData.translatedText);
  }

  return translated.join("\n\n");
}

function splitIntoChunks(text: string, maxWords: number): string[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";
  let wordCount = 0;

  for (const para of paragraphs) {
    const words = para.split(/\s+/).length;
    if (wordCount + words > maxWords && current) {
      chunks.push(current.trim());
      current = para;
      wordCount = words;
    } else {
      current = current ? `${current}\n\n${para}` : para;
      wordCount += words;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

export default function PostContent({
  content,
  needsTranslation,
  translationDirection,
  translateLabel,
  writtenInLabel,
  translatingLabel,
  errorLabel,
  originalLabel,
  translatedBadge,
}: Props) {
  const [translatedContent, setTranslatedContent] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const handleTranslate = async () => {
    setLoading(true);
    setError(false);
    try {
      const result = await translateText(content, translationDirection);
      setTranslatedContent(result);
      setShowOriginal(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const displayContent =
    translatedContent && !showOriginal ? translatedContent : content;

  return (
    <>
      {/* 번역 버튼 영역 */}
      {needsTranslation && (
        <div
          className="flex items-center gap-3 mb-10 p-4 rounded-2xl"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <span style={{ fontSize: "1.2rem" }}>🌐</span>
          {!translatedContent ? (
            <>
              <span className="text-sm flex-1" style={{ color: "var(--text-muted)" }}>
                {writtenInLabel}
              </span>
              <button
                onClick={handleTranslate}
                disabled={loading}
                className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl transition-all duration-200 disabled:opacity-50"
                style={{
                  background: "var(--yellow)",
                  color: "hsl(210 15% 6%)",
                  boxShadow: loading ? "none" : "0 2px 12px hsl(50 100% 50% / 0.25)",
                }}
              >
                {loading ? (
                  <>
                    <Spinner />
                    {translatingLabel}
                  </>
                ) : (
                  translateLabel
                )}
              </button>
            </>
          ) : (
            <>
              <span
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg"
                style={{ background: "hsl(160 40% 12%)", color: "var(--green)" }}
              >
                ✓ {translatedBadge}
              </span>
              <button
                onClick={() => setShowOriginal((v) => !v)}
                className="text-sm font-medium ml-auto transition-colors"
                style={{ color: "var(--blue)", textDecoration: "underline", textUnderlineOffset: 3 }}
              >
                {showOriginal ? translateLabel : originalLabel}
              </button>
            </>
          )}
          {error && (
            <p className="text-sm" style={{ color: "hsl(340 95% 60%)" }}>
              {errorLabel}
            </p>
          )}
        </div>
      )}

      {/* 마크다운 본문 */}
      <div className="prose">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayContent}</ReactMarkdown>
      </div>
    </>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
