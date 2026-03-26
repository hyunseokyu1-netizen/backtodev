import { useTranslations } from "next-intl";
import { getAllPosts } from "@/lib/posts";
import PostCard from "@/components/PostCard";
import { SectionDots } from "@/components/DecorativeBlobs";

export default function PostsPage() {
  const t = useTranslations("posts");
  const posts = getAllPosts();

  return (
    <div>
      {/* Header */}
      <div className="mb-12">
        <SectionDots />
        <h1
          className="font-black mb-2"
          style={{
            fontSize: "clamp(2rem, 5vw, 3rem)",
            letterSpacing: "-0.04em",
            color: "hsl(210 10% 95%)",
          }}
        >
          {t("title")}
        </h1>
        <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
          {t("count", { count: posts.length })}
        </p>
      </div>

      {/* Post grid */}
      {posts.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ background: "var(--surface)", border: "1px dashed var(--border)" }}
        >
          <p className="text-3xl mb-3">✍️</p>
          <p style={{ color: "var(--text-muted)" }}>{t("noPost")}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
