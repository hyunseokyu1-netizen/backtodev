import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getAllPosts } from "@/lib/posts";
import PostCard from "@/components/PostCard";

export default async function Home() {
  const t = await getTranslations("home");
  const tPost = await getTranslations("post");
  const posts = (await getAllPosts()).slice(0, 6);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6rem", paddingBottom: "3rem" }}>

      {/* ── Hero ── */}
      <section className="relative" style={{ paddingTop: "3rem" }}>
        {/* Blur glow */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "100%",
            height: 300,
            background: "hsl(var(--primary) / 0.1)",
            filter: "blur(100px)",
            borderRadius: "50%",
            pointerEvents: "none",
          }}
        />

        <div
          className="flex flex-col items-start"
          style={{ gap: "1.5rem", maxWidth: "48rem", position: "relative" }}
        >
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm"
            style={{
              background: "hsl(var(--primary) / 0.1)",
              color: "hsl(var(--primary))",
              border: "1px solid hsl(var(--primary) / 0.2)",
              fontFamily: "var(--font-mono), monospace",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
            </svg>
            <span>Hello, World!</span>
          </div>

          {/* Heading */}
          <h1
            style={{
              fontSize: "clamp(2.5rem, 7vw, 4.5rem)",
              fontWeight: 700,
              letterSpacing: "-0.04em",
              lineHeight: 1.1,
              color: "hsl(var(--foreground))",
            }}
          >
            {t("heroLine1")}
            <br />
            <span
              style={{
                background: "linear-gradient(to right, hsl(var(--primary)), #3b82f6)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {t("heroLine2")}
            </span>
          </h1>

          {/* Tagline */}
          <p
            style={{
              fontSize: "1.1rem",
              color: "hsl(var(--muted-foreground))",
              lineHeight: 1.7,
              maxWidth: "36rem",
            }}
          >
            {t("tagline")}
          </p>

          {/* CTAs */}
          <div className="flex items-center" style={{ gap: "1rem", marginTop: "1rem" }}>
            <Link
              href="/posts"
              className="inline-flex items-center justify-center transition-all"
              style={{
                height: 48,
                padding: "0 2rem",
                borderRadius: 12,
                background: "hsl(var(--primary))",
                color: "hsl(var(--primary-foreground))",
                fontSize: "0.875rem",
                fontWeight: 600,
                boxShadow: "0 8px 24px hsl(var(--primary) / 0.25)",
                textDecoration: "none",
              }}
            >
              Read Posts
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center justify-center transition-all"
              style={{
                height: 48,
                padding: "0 2rem",
                borderRadius: 12,
                background: "transparent",
                color: "hsl(var(--foreground))",
                fontSize: "0.875rem",
                fontWeight: 600,
                border: "2px solid hsl(var(--border))",
                textDecoration: "none",
              }}
            >
              About Me
            </Link>
          </div>
        </div>
      </section>

      {/* ── Latest Notes ── */}
      <section style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        <div className="flex items-center justify-between">
          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "hsl(var(--foreground))",
            }}
          >
            Latest Notes
          </h2>
          <Link
            href="/posts"
            className="flex items-center gap-1 text-sm transition-colors"
            style={{
              color: "hsl(var(--muted-foreground))",
              fontFamily: "var(--font-mono), monospace",
              textDecoration: "none",
            }}
          >
            View all
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 2 }}>
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </Link>
        </div>

        {posts.length === 0 ? (
          <div
            style={{
              padding: "3rem",
              textAlign: "center",
              border: "2px dashed hsl(var(--border))",
              borderRadius: 16,
            }}
          >
            <p style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-mono), monospace" }}>
              {t("noPost")}
            </p>
          </div>
        ) : (
          <>
            {/* 2개씩 짝지어 표시, 마지막 홀수 1개는 전체 너비 */}
            {Array.from({ length: Math.ceil(posts.length / 2) }, (_, i) => {
              const pair = posts.slice(i * 2, i * 2 + 2);
              const isLastSingle = pair.length === 1;
              return isLastSingle ? (
                <div key={pair[0].slug} style={{ marginTop: i > 0 ? "1.5rem" : 0 }}>
                  <PostCard post={pair[0]} minReadLabel={tPost("minRead")} readLabel={tPost("read")} />
                </div>
              ) : (
                <div
                  key={pair[0].slug}
                  className="grid grid-cols-1 sm:grid-cols-2"
                  style={{ gap: "1.5rem", marginTop: i > 0 ? "1.5rem" : 0 }}
                >
                  {pair.map((post) => (
                    <PostCard key={post.slug} post={post} minReadLabel={tPost("minRead")} readLabel={tPost("read")} />
                  ))}
                </div>
              );
            })}
          </>
        )}
      </section>
    </div>
  );
}
