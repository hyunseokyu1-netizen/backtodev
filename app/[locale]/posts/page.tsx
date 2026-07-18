import { getTranslations } from "next-intl/server";
import { getAllPosts } from "@/lib/posts";
import PostsClient from "@/components/PostsClient";
import type { Metadata } from "next";
import { localizedPageMetadata } from "@/lib/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isKo = locale === "ko";
  return localizedPageMetadata({
    locale,
    path: "posts",
    title: isKo ? "개발 기록" : "Development Notes",
    description: isKo
      ? "AI 코딩, 사이드 프로젝트, 앱 출시 과정에서 직접 겪고 해결한 개발 기록"
      : "Hands-on notes about AI coding, side projects, debugging, and shipping apps",
  });
}

export default async function PostsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("posts");
  const tPost = await getTranslations("post");
  const posts = await getAllPosts(locale);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "2.5rem" }}>
        <h1
          style={{
            fontSize: "clamp(2rem, 5vw, 2.75rem)",
            fontWeight: 800,
            letterSpacing: "-0.04em",
            color: "hsl(var(--foreground))",
            marginBottom: "0.5rem",
          }}
        >
          All Posts
        </h1>
        <p style={{ color: "hsl(var(--muted-foreground))", fontSize: "1rem" }}>
          Thoughts, learnings, and snippets from the journey back to dev.
        </p>
      </div>

      <PostsClient
        posts={posts}
        readLabel={tPost("read")}
      />
    </div>
  );
}
