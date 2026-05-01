import { getTranslations } from "next-intl/server";
import { getLocale } from "next-intl/server";
import { getAllPosts } from "@/lib/posts";
import PostsClient from "@/components/PostsClient";
import type { Metadata } from "next";

const BASE_URL = "https://backtodev.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    alternates: {
      canonical: `${BASE_URL}/${locale}/posts`,
      languages: {
        ko: `${BASE_URL}/ko/posts`,
        en: `${BASE_URL}/en/posts`,
      },
    },
  };
}

export default async function PostsPage() {
  const t = await getTranslations("posts");
  const tPost = await getTranslations("post");
  const locale = await getLocale();
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
        minReadLabel={tPost("minRead")}
        readLabel={tPost("read")}
      />
    </div>
  );
}
