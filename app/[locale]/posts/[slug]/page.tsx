import { notFound } from "next/navigation";
import { getAllPosts, getPost } from "@/lib/posts";
import { Link } from "@/i18n/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import PostContent from "@/components/PostContent";

interface Props {
  params: Promise<{ slug: string; locale: string }>;
}

export async function generateStaticParams() {
  return getAllPosts().flatMap((p) => [
    { locale: "en", slug: p.slug },
    { locale: "ko", slug: p.slug },
  ]);
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  return {
    title: `${post.title} | backtodev`,
    description: post.description,
  };
}

function getTagStyle(tag: string) {
  const palette = [
    { bg: "hsl(160 40% 12%)", text: "hsl(160 100% 40%)", border: "hsl(160 40% 20%)" },
    { bg: "hsl(225 40% 16%)", text: "hsl(225 100% 75%)", border: "hsl(225 40% 26%)" },
    { bg: "hsl(50  40% 12%)", text: "hsl(50  100% 50%)", border: "hsl(50  40% 20%)" },
    { bg: "hsl(333 30% 14%)", text: "hsl(333 100% 65%)", border: "hsl(333 30% 24%)" },
  ];
  let hash = 0;
  for (const c of tag) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return palette[Math.abs(hash) % palette.length];
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const t = await getTranslations("post");
  const locale = await getLocale();
  const postLang = post.lang ?? "en";
  const needsTranslation = locale === "ko" && postLang === "en";

  return (
    <article className="mx-auto" style={{ maxWidth: "72ch" }}>
      {/* Back link */}
      <Link
        href="/posts"
        className="inline-flex items-center gap-1.5 text-sm font-medium mb-10 transition-colors group"
        style={{ color: "var(--text-muted)" }}
      >
        <span
          className="transition-transform group-hover:-translate-x-1"
          style={{ display: "inline-block" }}
        >
          ←
        </span>
        {t("backToList")}
      </Link>

      {/* Post header */}
      <header className="mb-12">
        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            {post.tags.map((tag) => {
              const s = getTagStyle(tag);
              return (
                <span
                  key={tag}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "0.25em 0.8em",
                    borderRadius: 999,
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    background: s.bg,
                    color: s.text,
                    border: `1px solid ${s.border}`,
                  }}
                >
                  {tag}
                </span>
              );
            })}
          </div>
        )}

        {/* Title */}
        <h1
          className="font-black leading-tight mb-4"
          style={{
            fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
            letterSpacing: "-0.04em",
            color: "hsl(210 10% 96%)",
          }}
        >
          {post.title}
        </h1>

        {/* Description */}
        {post.description && (
          <p
            className="text-lg leading-relaxed mb-5"
            style={{ color: "hsl(210 10% 65%)" }}
          >
            {post.description}
          </p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-3">
          <time
            className="text-sm font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            {post.date}
          </time>
          <span style={{ color: "var(--border)" }}>·</span>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded"
            style={{
              background: postLang === "en" ? "hsl(225 40% 16%)" : "hsl(160 40% 12%)",
              color: postLang === "en" ? "var(--blue)" : "var(--green)",
            }}
          >
            {postLang.toUpperCase()}
          </span>
        </div>

        <div
          className="mt-8"
          style={{ height: 2, background: "linear-gradient(90deg, var(--yellow), var(--blue), transparent)", borderRadius: 2 }}
        />
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
    </article>
  );
}
