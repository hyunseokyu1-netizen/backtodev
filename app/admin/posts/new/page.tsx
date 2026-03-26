"use client";

import PostEditor from "../../_components/PostEditor";
import { useRouter } from "next/navigation";

export default function NewPostPage() {
  const router = useRouter();

  const handleSave = async ({ slug, frontmatter, content }: {
    slug: string;
    frontmatter: { title: string; date: string; description: string; tags: string; lang: "ko" | "en" };
    content: string;
  }) => {
    const tags = frontmatter.tags
      ? frontmatter.tags.split(",").map((t) => t.trim()).filter(Boolean)
      : [];

    const res = await fetch("/api/admin/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, content, ...frontmatter, tags }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "저장 실패");
    }

    setTimeout(() => router.push("/admin"), 1500);
  };

  return <PostEditor onSave={handleSave} />;
}
