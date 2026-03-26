import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getAllPosts } from "@/lib/posts";
import PostCard from "@/components/PostCard";
import { HeroBlobs, SectionDots } from "@/components/DecorativeBlobs";

export default async function Home() {
  const t = await getTranslations("home");
  const posts = (await getAllPosts()).slice(0, 6);

  return (
    <div>
      {/* ── Hero ── */}
      <section
        className="relative mb-20 py-16 px-10 rounded-3xl overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, hsl(213 40% 10%) 0%, hsl(225 30% 12%) 100%)",
          border: "1px solid hsl(210 10% 18%)",
        }}
      >
        <HeroBlobs />
        <div className="relative" style={{ zIndex: 1 }}>
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold mb-6"
            style={{
              background: "hsl(50 100% 50% / 0.12)",
              border: "1px solid hsl(50 100% 50% / 0.3)",
              color: "var(--yellow)",
            }}
          >
            <span>✦</span>
            {t("greeting")}
          </div>

          <h1
            className="font-black mb-5 leading-none"
            style={{
              fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
              letterSpacing: "-0.05em",
              background:
                "linear-gradient(135deg, hsl(210 10% 96%) 30%, hsl(225 100% 80%) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            backtodev
          </h1>

          <p
            className="text-lg max-w-lg leading-relaxed mb-8"
            style={{ color: "hsl(210 10% 70%)" }}
          >
            {t("tagline")}
          </p>

          <Link
            href="/posts"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all duration-200"
            style={{
              background: "var(--yellow)",
              color: "hsl(210 15% 6%)",
              boxShadow: "0 4px 20px hsl(50 100% 50% / 0.3)",
            }}
          >
            {t("viewAll")} <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      {/* ── Recent Posts ── */}
      <section>
        <div className="flex items-end justify-between mb-8">
          <div>
            <SectionDots />
            <h2
              className="font-black text-2xl"
              style={{ color: "hsl(210 10% 94%)", letterSpacing: "-0.03em" }}
            >
              {t("recentPosts")}
            </h2>
          </div>
          <Link
            href="/posts"
            className="text-sm font-semibold pb-0.5 transition-colors"
            style={{
              color: "var(--yellow)",
              borderBottom: "1.5px solid hsl(50 100% 50% / 0.4)",
            }}
          >
            {t("viewAll")}
          </Link>
        </div>

        {posts.length === 0 ? (
          <div
            className="rounded-2xl p-10 text-center"
            style={{ background: "var(--surface)", border: "1px dashed var(--border)" }}
          >
            <p className="text-2xl mb-3">✍️</p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {t("noPosts")}{" "}
              <code
                style={{
                  background: "var(--surface-2)",
                  padding: "2px 6px",
                  borderRadius: 4,
                  fontSize: "0.85em",
                  color: "var(--magenta)",
                }}
              >
                content/posts/
              </code>{" "}
              {t("noPostsEnd")}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {posts.map((post, i) => (
              <PostCard key={post.slug} post={post} large={i === 0} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
