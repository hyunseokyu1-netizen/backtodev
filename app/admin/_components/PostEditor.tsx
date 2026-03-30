"use client";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface LangData {
  title: string;
  description: string;
  content: string;
  tags?: string;
  sha?: string;
  filePath?: string;
}

interface SavePayload {
  slug: string;
  date: string;
  tags: string;
  lang: "ko" | "en";
  title: string;
  description: string;
  content: string;
  sha?: string;
  filePath?: string;
}

interface Props {
  slug?: string;
  date?: string;
  tags?: string;
  initialKo?: Partial<LangData>;
  initialEn?: Partial<LangData>;
  onSave: (data: SavePayload) => Promise<void>;
}

const TRANSLATE_MAX_CHARS = 400; // MyMemory API: 500자 제한

function splitIntoChunks(text: string): string[] {
  const chunks: string[] = [];
  // 줄 단위로 나누고, 400자 초과 시 강제로 잘라서 청크 구성
  const lines = text.split("\n");
  let current = "";

  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const line of lines) {
    // 한 줄 자체가 400자 초과면 강제로 분리
    if (line.length > TRANSLATE_MAX_CHARS) {
      if (current) flush();
      let remaining = line;
      while (remaining.length > TRANSLATE_MAX_CHARS) {
        // 마지막 공백 위치에서 자르기 (단어 경계 우선)
        let cutAt = remaining.lastIndexOf(" ", TRANSLATE_MAX_CHARS);
        if (cutAt <= 0) cutAt = TRANSLATE_MAX_CHARS;
        chunks.push(remaining.slice(0, cutAt).trim());
        remaining = remaining.slice(cutAt).trim();
      }
      current = remaining;
      continue;
    }

    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length <= TRANSLATE_MAX_CHARS) {
      current = candidate;
    } else {
      flush();
      current = line;
    }
  }
  flush();
  return chunks.filter(Boolean);
}

async function autoTranslate(text: string, direction: "ko-en" | "en-ko"): Promise<string> {
  const langpair = direction === "ko-en" ? "ko|en" : "en|ko";
  const chunks = splitIntoChunks(text);

  const results: string[] = [];
  for (const chunk of chunks) {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${langpair}`
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.responseStatus !== 200) throw new Error(data.responseDetails ?? "API error");
    if (data.quotaFinished) throw new Error("일일 번역 한도 초과. 내일 다시 시도해 주세요.");
    results.push(data.responseData.translatedText);
  }
  return results.join("\n\n");
}

export default function PostEditor({ slug: initSlug, date: initDate, tags: initTags, initialKo, initialEn, onSave }: Props) {
  const [slug, setSlug] = useState(initSlug ?? "");
  const [date, setDate] = useState(initDate ?? new Date().toISOString().slice(0, 10));
  const [activeLang, setActiveLang] = useState<"ko" | "en">("ko");
  const [ko, setKo] = useState<LangData>({
    title: initialKo?.title ?? "",
    description: initialKo?.description ?? "",
    content: initialKo?.content ?? "",
    tags: initialKo?.tags ?? initTags ?? "",
    sha: initialKo?.sha,
    filePath: initialKo?.filePath,
  });
  const [en, setEn] = useState<LangData>({
    title: initialEn?.title ?? "",
    description: initialEn?.description ?? "",
    content: initialEn?.content ?? "",
    tags: initialEn?.tags ?? "",
    sha: initialEn?.sha,
    filePath: initialEn?.filePath,
  });

  const [mode, setMode] = useState<"edit" | "split" | "preview">("split");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const isEdit = !!initSlug;

  const current = activeLang === "ko" ? ko : en;
  const setCurrent = activeLang === "ko" ? setKo : setEn;

  // 새 글: 제목으로 slug 자동 생성
  useEffect(() => {
    if (!isEdit && ko.title && !slug) {
      const generated = ko.title
        .toLowerCase()
        .replace(/[^a-z0-9가-힣\s-]/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 60);
      setSlug(generated);
    }
  }, [ko.title, isEdit, slug]);

  const handleSave = async () => {
    if (!slug || !current.title) {
      setError("slug와 제목은 필수입니다.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        slug,
        date,
        tags: current.tags ?? "",
        lang: activeLang,
        title: current.title,
        description: current.description,
        content: current.content,
        sha: current.sha,
        filePath: current.filePath,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleAutoTranslate = async () => {
    if (!current.content) {
      setTranslateError("번역할 내용이 없습니다.");
      return;
    }
    setTranslating(true);
    setTranslateError("");
    try {
      const direction = activeLang === "ko" ? "ko-en" : "en-ko";
      const translated = await autoTranslate(current.content, direction);
      const titleTranslated = current.title
        ? await autoTranslate(current.title, direction)
        : "";
      const descTranslated = current.description
        ? await autoTranslate(current.description, direction)
        : "";
      // 태그 각각 번역
      const currentTagList = (current.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean);
      const translatedTagList = await Promise.all(
        currentTagList.map((tag) => autoTranslate(tag, direction))
      );
      const tagsTranslated = translatedTagList.join(", ");

      const other = activeLang === "ko" ? en : ko;
      const setOther = activeLang === "ko" ? setEn : setKo;
      setOther({
        ...other,
        title: other.title || titleTranslated,
        description: other.description || descTranslated,
        content: translated,
        tags: other.tags || tagsTranslated,
      });
      // 번역 후 다른 탭으로 이동
      setActiveLang(activeLang === "ko" ? "en" : "ko");
    } catch (e) {
      setTranslateError(e instanceof Error ? e.message : "번역 실패. 다시 시도해 주세요.");
    } finally {
      setTranslating(false);
    }
  };

  const insertAtCursor = (text: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = current.content.slice(0, start) + text + current.content.slice(end);
    setCurrent((prev) => ({ ...prev, content: next }));
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + text.length;
      ta.focus();
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/images", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "업로드 실패");
      insertAtCursor(`![${file.name.replace(/\.[^.]+$/, "")}](${data.url.trim().replace(/\s+/g, "")})`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "이미지 업로드 실패");
    } finally {
      setUploading(false);
    }
  };

  const modeBtn = (m: typeof mode, label: string) => (
    <button
      onClick={() => setMode(m)}
      className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
      style={{
        background: mode === m ? "var(--yellow)" : "var(--surface-2)",
        color: mode === m ? "hsl(210 15% 6%)" : "var(--text-muted)",
      }}
    >
      {label}
    </button>
  );

  const langHasContent = (lang: "ko" | "en") =>
    (lang === "ko" ? ko : en).content.trim().length > 0;

  return (
    <div className="flex flex-col h-screen">
      {/* 상단 툴바 */}
      <div
        className="flex items-center gap-3 px-6 py-3 border-b shrink-0"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <a href="/admin" className="text-sm font-medium mr-2" style={{ color: "var(--text-muted)" }}>
          ← 목록
        </a>
        <span style={{ color: "var(--border)" }}>|</span>
        <span className="font-bold text-sm" style={{ color: "var(--yellow)" }}>
          {isEdit ? "글 수정" : "새 글 작성"}
        </span>

        <div className="flex items-center gap-2 ml-auto">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={handleImageUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-60"
            style={{ background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
          >
            {uploading ? "업로드 중..." : "이미지 삽입"}
          </button>
          <div style={{ width: 1, height: 16, background: "var(--border)" }} />
          {modeBtn("edit", "편집")}
          {modeBtn("split", "분할")}
          {modeBtn("preview", "미리보기")}
        </div>

        {error && <p className="text-xs" style={{ color: "hsl(340 95% 60%)" }}>{error}</p>}
        {saved && <p className="text-xs" style={{ color: "var(--green)" }}>✓ 저장 완료 (배포 중...)</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 rounded-xl font-bold text-sm transition-all disabled:opacity-60 ml-2"
          style={{ background: "var(--yellow)", color: "hsl(210 15% 6%)" }}
        >
          {saving ? "저장 중..." : `저장 & 배포 (${activeLang.toUpperCase()})`}
        </button>
      </div>

      {/* 언어 탭 */}
      <div
        className="flex items-center gap-3 px-6 py-3 border-b shrink-0"
        style={{ background: "hsl(213 40% 8%)", borderColor: "var(--border)" }}
      >
        {(["ko", "en"] as const).map((lang) => (
          <button
            key={lang}
            onClick={() => setActiveLang(lang)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: activeLang === lang ? "var(--yellow)" : "var(--surface-2)",
              color: activeLang === lang ? "hsl(210 15% 6%)" : "var(--text-muted)",
              border: `1px solid ${activeLang === lang ? "var(--yellow)" : "var(--border)"}`,
            }}
          >
            {lang === "ko" ? "🇰🇷 한국어" : "🇺🇸 English"}
            {langHasContent(lang) && (
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: activeLang === lang ? "hsl(210 15% 6%)" : "var(--green)" }}
              />
            )}
          </button>
        ))}

        <button
          onClick={handleAutoTranslate}
          disabled={translating || !current.content}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 ml-2"
          style={{ background: "hsl(225 40% 16%)", color: "var(--blue)", border: "1px solid hsl(225 40% 24%)" }}
        >
          {translating ? (
            <>
              <Spinner />
              번역 중...
            </>
          ) : (
            `↔ ${activeLang === "ko" ? "영어로 번역 초안" : "한국어로 번역 초안"}`
          )}
        </button>
        {translateError && (
          <span className="text-xs" style={{ color: "hsl(340 95% 60%)" }}>{translateError}</span>
        )}
      </div>

      {/* Frontmatter 입력 */}
      <div
        className="grid grid-cols-2 gap-3 px-6 py-4 border-b shrink-0"
        style={{ background: "hsl(213 40% 9%)", borderColor: "var(--border)" }}
      >
        <div className="col-span-2 flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>
              제목 * <span className="font-normal opacity-60">({activeLang === "ko" ? "한국어" : "English"})</span>
            </label>
            <input
              value={current.title}
              onChange={(e) => setCurrent((prev) => ({ ...prev, title: e.target.value }))}
              placeholder={activeLang === "ko" ? "글 제목" : "Post title"}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
            />
          </div>
          <div style={{ width: 180 }}>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>slug *</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="url-slug"
              disabled={isEdit}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono disabled:opacity-50"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>날짜</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>태그 (쉼표 구분)</label>
          <input
            value={current.tags ?? ""}
            onChange={(e) => setCurrent((prev) => ({ ...prev, tags: e.target.value }))}
            placeholder="Next.js, React, 개발"
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
          />
        </div>

        <div className="col-span-2">
          <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>
            설명 <span className="font-normal opacity-60">({activeLang === "ko" ? "한국어" : "English"})</span>
          </label>
          <input
            value={current.description}
            onChange={(e) => setCurrent((prev) => ({ ...prev, description: e.target.value }))}
            placeholder={activeLang === "ko" ? "짧은 설명" : "Short description"}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
          />
        </div>
      </div>

      {/* 에디터 / 미리보기 */}
      <div className="flex flex-1 overflow-hidden">
        {(mode === "edit" || mode === "split") && (
          <div
            className="flex flex-col overflow-hidden"
            style={{
              flex: mode === "split" ? "0 0 50%" : "1",
              borderRight: mode === "split" ? `1px solid var(--border)` : "none",
            }}
          >
            <div
              className="px-4 py-2 text-xs font-semibold border-b"
              style={{ color: "var(--text-muted)", borderColor: "var(--border)", background: "var(--surface)" }}
            >
              마크다운 ({activeLang === "ko" ? "한국어" : "English"})
            </div>
            <textarea
              ref={textareaRef}
              value={current.content}
              onChange={(e) => setCurrent((prev) => ({ ...prev, content: e.target.value }))}
              placeholder={activeLang === "ko" ? "마크다운으로 글을 작성하세요..." : "Write in Markdown..."}
              className="flex-1 w-full p-6 resize-none outline-none text-sm leading-relaxed"
              style={{
                background: "hsl(213 40% 8%)",
                color: "hsl(210 10% 82%)",
                fontFamily: "var(--font-mono), 'Fira Code', monospace",
                fontSize: "0.875rem",
              }}
            />
          </div>
        )}

        {(mode === "preview" || mode === "split") && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div
              className="px-4 py-2 text-xs font-semibold border-b"
              style={{ color: "var(--text-muted)", borderColor: "var(--border)", background: "var(--surface)" }}
            >
              미리보기
            </div>
            <div className="flex-1 overflow-y-auto p-8">
              <div className="prose">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {current.content || "_미리보기가 여기에 표시됩니다._"}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
