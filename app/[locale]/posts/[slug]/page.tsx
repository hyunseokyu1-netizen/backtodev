import { notFound } from "next/navigation";
import { getAllPosts, getPost } from "@/lib/posts";
import { Link } from "@/i18n/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import PostContent from "@/components/PostContent";

interface Props {
  params: Promise<{ slug: string; locale: string }>;
}

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.flatMap((p) => [
    { locale: "en", slug: p.slug },
    { locale: "ko", slug: p.slug },
  ]);
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return {};
  return {
    title: `${post.title} | backtodev`,
    description: post.description,
  };
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const t = await getTranslations("post");
  const locale = await getLocale();
  const postLang = post.lang ?? "en";
  const needsTranslation = locale === "ko" && postLang === "en";
  const tags = post.tags ?? [];

  const formattedDate = post.date
    ? new Date(post.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : post.date;

  return (
    <article style={{ maxWidth: "48rem", margin: "0 auto", width: "100%" }}>

      {/* Back link — terminal style */}
      <Link
        href="/posts"
        className="inline-flex items-center gap-2 text-sm transition-colors"
        style={{
          color: "hsl(var(--muted-foreground))",
          fontFamily: "var(--font-mono), monospace",
          marginBottom: "2.5rem",
          textDecoration: "none",
        }}
      >
        ← cd ..
      </Link>

      {/* Post header */}
      <header style={{ marginBottom: "2.5rem" }}>

        {/* Tags — outline style */}
        {tags.length > 0 && (
          <div className="flex flex-wrap" style={{ gap: "0.5rem", marginBottom: "1.5rem" }}>
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 text-xs font-medium"
                style={{
                  padding: "0.25em 0.75em",
                  borderRadius: 999,
                  color: "hsl(var(--primary))",
                  background: "hsl(var(--primary) / 0.1)",
                  border: "1px solid hsl(var(--primary) / 0.3)",
                  fontFamily: "var(--font-mono), monospace",
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                  <line x1="7" y1="7" x2="7.01" y2="7"/>
                </svg>
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Title */}
        <h1
          style={{
            fontSize: "clamp(1.8rem, 4vw, 3rem)",
            fontWeight: 700,
            letterSpacing: "-0.04em",
            lineHeight: 1.2,
            color: "hsl(var(--foreground))",
            marginBottom: "1.5rem",
          }}
        >
          {post.title}
        </h1>

        {/* Meta row */}
        <div
          className="flex items-center"
          style={{
            gap: "1rem",
            fontSize: "0.875rem",
            color: "hsl(var(--muted-foreground))",
            fontFamily: "var(--font-mono), monospace",
            paddingBottom: "2rem",
            borderBottom: "1px solid hsl(var(--border) / 0.5)",
          }}
        >
          <span className="flex items-center" style={{ gap: "0.375rem" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            {formattedDate}
          </span>
          <span className="flex items-center" style={{ gap: "0.375rem" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            1 min read
          </span>
        </div>
      </header>

      {/* Content */}
      <PostContent
        content={post.content}
        needsTranslation={needsTranslation}
        translateLabel={t("translateButton")}
        translatingLabel={t("translating")}
        errorLabel={t("translateError")}
        originalLabel={t("originalContent")}
        translatedBadge={t("translatedBadge")}
      />

      {/* Author bio */}
      <div
        className="flex items-center"
        style={{
          marginTop: "4rem",
          padding: "1.5rem",
          borderRadius: 16,
          background: "hsl(var(--card))",
          border: "1px solid hsl(var(--border))",
          gap: "1.5rem",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "linear-gradient(135deg, hsl(var(--primary)), #3b82f6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "hsl(var(--primary-foreground))",
            flexShrink: 0,
          }}
        >
          PM
        </div>
        <div>
          <p style={{ fontWeight: 700, fontSize: "1rem", color: "hsl(var(--foreground))" }}>
            backtodev
          </p>
          <p style={{ fontSize: "0.875rem", color: "hsl(var(--muted-foreground))", marginTop: "0.25rem" }}>
            {t("authorBio")}
          </p>
        </div>
      </div>
    </article>
  );
}
