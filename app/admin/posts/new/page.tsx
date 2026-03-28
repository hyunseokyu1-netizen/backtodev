"use client";

import PostEditor from "../../_components/PostEditor";
import { useRouter } from "next/navigation";

export default function NewPostPage() {
  const router = useRouter();

  const handleSave = async ({ slug, date, tags, lang, title, description, content }: {
    slug: string;
    date: string;
    tags: string;
    lang: "ko" | "en";
    title: string;
    description: string;
    content: string;
  }) => {
    const tagsArr = tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [];

    const res = await fetch("/api/admin/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, date, description, tags: tagsArr, lang, title, content }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "저장 실패");
    }

    setTimeout(() => router.push("/admin"), 1500);
  };

  return <PostEditor onSave={handleSave} />;
}
