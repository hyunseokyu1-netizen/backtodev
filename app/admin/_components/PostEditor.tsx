"use client";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Frontmatter {
  title: string;
  date: string;
  description: string;
  tags: string;
  lang: "ko" | "en";
}

interface Props {
  slug?: string;
  initialFrontmatter?: Partial<Omit<Frontmatter, "tags">> & { tags?: string | string[] };
  initialContent?: string;
  sha?: string;
  onSave: (data: { slug: string; frontmatter: Frontmatter; content: string; sha?: string }) => Promise<void>;
}

export default function PostEditor({ slug: initSlug, initialFrontmatter, initialContent, sha, onSave }: Props) {
  const [slug, setSlug] = useState(initSlug ?? "");
  const [fm, setFm] = useState<Frontmatter>({
    title: initialFrontmatter?.title ?? "",
    date: initialFrontmatter?.date ?? new Date().toISOString().slice(0, 10),
    description: initialFrontmatter?.description ?? "",
    tags: Array.isArray(initialFrontmatter?.tags) ? initialFrontmatter.tags.join(", ") : (initialFrontmatter?.tags ?? ""),
    lang: (initialFrontmatter?.lang as "ko" | "en") ?? "ko",
  });
  const [content, setContent] = useState(initialContent ?? "");
  const [mode, setMode] = useState<"edit" | "split" | "preview">("split");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const isEdit = !!initSlug;

  // 자동 slug 생성 (새 글)
  useEffect(() => {
    if (!isEdit && fm.title && !slug) {
      const generated = fm.title
        .toLowerCase()
        .replace(/[^a-z0-9가-힣\s-]/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 60);
      setSlug(generated);
    }
  }, [fm.title, isEdit, slug]);

  const handleSave = async () => {
    if (!slug || !fm.title) {
      setError("slug와 제목은 필수입니다.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        slug,
        frontmatter: fm,
        content,
        sha,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const insertAtCursor = (text: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = content.slice(0, start) + text + content.slice(end);
    setContent(next);
    // 커서를 삽입 텍스트 뒤로 이동
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
      insertAtCursor(`![${file.name.replace(/\.[^.]+$/, "")}](${data.url})`);
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

  return (
    <div className="flex flex-col h-screen">
      {/* 상단 툴바 */}
      <div
        className="flex items-center gap-3 px-6 py-3 border-b shrink-0"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <a
          href="/admin"
          className="text-sm font-medium mr-2"
          style={{ color: "var(--text-muted)" }}
        >
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
            title="이미지 업로드"
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
          {saving ? "저장 중..." : "저장 & 배포"}
        </button>
      </div>

      {/* Frontmatter 입력 */}
      <div
        className="grid grid-cols-2 gap-3 px-6 py-4 border-b shrink-0"
        style={{ background: "hsl(213 40% 9%)", borderColor: "var(--border)" }}
      >
        <div className="col-span-2 flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>제목 *</label>
            <input
              value={fm.title}
              onChange={(e) => setFm({ ...fm, title: e.target.value })}
              placeholder="글 제목"
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
            value={fm.date}
            onChange={(e) => setFm({ ...fm, date: e.target.value })}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>언어</label>
          <select
            value={fm.lang}
            onChange={(e) => setFm({ ...fm, lang: e.target.value as "ko" | "en" })}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
          >
            <option value="ko">한국어 (ko)</option>
            <option value="en">English (en)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>설명</label>
          <input
            value={fm.description}
            onChange={(e) => setFm({ ...fm, description: e.target.value })}
            placeholder="짧은 설명"
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>태그 (쉼표 구분)</label>
          <input
            value={fm.tags}
            onChange={(e) => setFm({ ...fm, tags: e.target.value })}
            placeholder="Next.js, React, 개발"
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
          />
        </div>
      </div>

      {/* 에디터 / 미리보기 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 마크다운 에디터 */}
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
              마크다운
            </div>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="마크다운으로 글을 작성하세요..."
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

        {/* 미리보기 */}
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
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || "_미리보기가 여기에 표시됩니다._"}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
