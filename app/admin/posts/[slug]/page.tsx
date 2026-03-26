"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PostEditor from "../../_components/PostEditor";

export default function EditPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<{ frontmatter: Record<string, unknown>; content: string; sha: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/posts/${slug}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, [slug]);

  const handleSave = async ({ frontmatter, content, sha }: {
    slug: string;
    frontmatter: { title: string; date: string; description: string; tags: string; lang: "ko" | "en" };
    content: string;
    sha?: string;
  }) => {
    const tags = frontmatter.tags
      ? frontmatter.tags.split(",").map((t) => t.trim()).filter(Boolean)
      : [];

    const res = await fetch(`/api/admin/posts/${slug}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...frontmatter, tags, content, sha }),
    });

    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.error ?? "저장 실패");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ color: "var(--text-muted)" }}>
        불러오는 중...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ color: "hsl(340 95% 60%)" }}>
        글을 찾을 수 없습니다.
      </div>
    );
  }

  const fm = data.frontmatter as { title?: string; date?: string; description?: string; tags?: string[]; lang?: string };

  return (
    <PostEditor
      slug={slug}
      initialFrontmatter={{
        title: fm.title,
        date: fm.date,
        description: fm.description,
        tags: Array.isArray(fm.tags) ? fm.tags : [],
        lang: fm.lang as "ko" | "en",
      }}
      initialContent={data.content}
      sha={data.sha}
      onSave={handleSave}
    />
  );
}
