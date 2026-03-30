"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PostEditor from "../../_components/PostEditor";

interface LangData {
  title: string;
  description: string;
  content: string;
  tags?: string;
  sha?: string;
  filePath?: string;
}

export default function EditPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [koData, setKoData] = useState<LangData | undefined>();
  const [enData, setEnData] = useState<LangData | undefined>();
  const [sharedDate, setSharedDate] = useState<string | undefined>();
  const [sharedTags, setSharedTags] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [koRes, enRes] = await Promise.all([
        fetch(`/api/admin/posts/${slug}?lang=ko`),
        fetch(`/api/admin/posts/${slug}?lang=en`),
      ]);

      let date = "";
      let tags = "";

      if (koRes.ok) {
        const d = await koRes.json();
        const fm = d.frontmatter ?? {};
        const koTags = Array.isArray(fm.tags) ? fm.tags.join(", ") : (fm.tags ?? "");
        setKoData({ title: fm.title ?? "", description: fm.description ?? "", content: d.content ?? "", tags: koTags, sha: d.sha, filePath: d.filePath });
        date = fm.date ?? "";
        tags = koTags;
      }

      if (enRes.ok) {
        const d = await enRes.json();
        const fm = d.frontmatter ?? {};
        // en 버전이 실제로 다른 파일인지 확인 (fallback이 아닌 경우)
        if (d.filePath?.includes(".en.")) {
          const enTags = Array.isArray(fm.tags) ? fm.tags.join(", ") : (fm.tags ?? "");
          setEnData({ title: fm.title ?? "", description: fm.description ?? "", content: d.content ?? "", tags: enTags, sha: d.sha, filePath: d.filePath });
        }
        if (!date) {
          date = fm.date ?? "";
          tags = Array.isArray(fm.tags) ? fm.tags.join(", ") : (fm.tags ?? "");
        }
      }

      setSharedDate(date);
      setSharedTags(tags);
      setLoading(false);
    }
    load();
  }, [slug]);

  const handleSave = async ({ lang, title, description, content, sha, filePath, date, tags }: {
    slug: string;
    date: string;
    tags: string;
    lang: "ko" | "en";
    title: string;
    description: string;
    content: string;
    sha?: string;
    filePath?: string;
  }) => {
    const tagsArr = tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [];

    const res = await fetch(`/api/admin/posts/${slug}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, date, description, tags: tagsArr, lang, content, sha, filePath }),
    });

    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(d.error ?? "저장 실패");
    }

    // 저장 성공 후 새 SHA를 state에 반영 (다음 저장에 사용)
    if (d.sha) {
      const updater = (prev: LangData | undefined) =>
        prev ? { ...prev, sha: d.sha, filePath: d.filePath ?? prev.filePath } : prev;
      if (lang === "ko") setKoData(updater);
      else setEnData(updater);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ color: "var(--text-muted)" }}>
        불러오는 중...
      </div>
    );
  }

  if (!koData && !enData) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ color: "hsl(340 95% 60%)" }}>
        글을 찾을 수 없습니다.
      </div>
    );
  }

  return (
    <PostEditor
      slug={slug}
      date={sharedDate}
      tags={sharedTags}
      initialKo={koData}
      initialEn={enData}
      onSave={handleSave}
    />
  );
}
