import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getAllPosts } from "@/lib/posts";
import PostCard from "@/components/PostCard";
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
    title: isKo ? "backtodev — 다시 개발자로" : "backtodev — Back to Dev",
    description: isKo
      ? "40대 PM이 다시 개발자로 돌아오는 기록. 실패하고 배우며 성장하는 이야기."
      : "A 40-something PM returning to development. Notes on learning, building, and shipping.",
  });
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("home");
  const tPost = await getTranslations("post");
  const allPosts = await getAllPosts(locale);
  const posts = allPosts.slice(0, 6);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6rem", paddingBottom: "3rem" }}>
      {/* ── Hero ── */}
      <section className="relative" style={{ paddingTop: "3rem" }}>
        {/* Dot grid */}
        <div
          className="bg-grid-pattern"
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.35,
            maskImage: "radial-gradient(ellipse 75% 85% at 50% 50%, black 20%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(ellipse 75% 85% at 50% 50%, black 20%, transparent 100%)",
            pointerEvents: "none",
          }}
        />

        {/* Blur glow */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "30%",
            transform: "translate(-50%, -50%)",
            width: 500,
            height: 300,
            background: "hsl(var(--primary) / 0.08)",
            filter: "blur(100px)",
            borderRadius: "50%",
            pointerEvents: "none",
          }}
        />

        <div
          className="flex flex-col lg:flex-row lg:items-center"
          style={{ gap: "3rem", position: "relative" }}
        >
          {/* Left: text */}
          <div
            className="flex flex-col items-start"
            style={{ gap: "1.5rem", flex: "1 1 0", minWidth: 0 }}
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
              <span>git checkout -b comeback</span>
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
              <span style={{ color: "hsl(var(--primary))" }}>
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
              {t("description")}
            </p>

            {/* CTAs */}
            <div className="flex items-center flex-wrap" style={{ gap: "1rem", marginTop: "1rem" }}>
              <Link
                href="/portfolio"
                className="inline-flex items-center justify-center transition-all"
                style={{
                  height: 48,
                  padding: "0 2rem",
                  borderRadius: 12,
                  background: "#00FFC6",
                  color: "#000",
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                {t("viewPortfolio")}
              </Link>
              <Link
                href="/posts"
                className="inline-flex items-center justify-center transition-all"
                style={{
                  height: 48,
                  padding: "0 2rem",
                  borderRadius: 12,
                  background: "transparent",
                  color: "hsl(var(--foreground))",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  border: "1px solid rgba(255,255,255,0.1)",
                  textDecoration: "none",
                }}
              >
                {t("readPosts")}
              </Link>
              <Link
                href="/village"
                className="inline-flex items-center justify-center text-sm transition-colors"
                style={{
                  height: 48,
                  color: "hsl(var(--muted-foreground))",
                  fontFamily: "var(--font-mono), monospace",
                  textDecoration: "none",
                }}
              >
                {t("enterVillage")} →
              </Link>
            </div>
          </div>

          {/* Right: Terminal decoration */}
          <div className="hidden lg:block" style={{ flex: "0 0 360px" }}>
            <div
              style={{
                background: "hsl(var(--card) / 0.8)",
                border: "1px solid hsl(var(--primary) / 0.2)",
                borderRadius: 14,
                overflow: "hidden",
                fontFamily: "var(--font-mono), monospace",
                fontSize: "0.8rem",
                backdropFilter: "blur(12px)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px hsl(var(--primary) / 0.05)",
              }}
            >
              {/* Title bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 14px",
                  borderBottom: "1px solid hsl(var(--primary) / 0.1)",
                  background: "hsl(var(--primary) / 0.04)",
                }}
              >
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57", display: "inline-block" }} />
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ffbd2e", display: "inline-block" }} />
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#28ca41", display: "inline-block" }} />
                <span style={{ marginLeft: 8, color: "hsl(var(--muted-foreground))", fontSize: "0.72rem" }}>comeback.sh</span>
              </div>
              {/* Body */}
              <div
                style={{
                  padding: "1.1rem 1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.35rem",
                  lineHeight: 1.7,
                }}
              >
                <div>
                  <span style={{ color: "hsl(var(--primary) / 0.5)" }}>$ </span>
                  <span style={{ color: "hsl(var(--primary))" }}>git log --oneline</span>
                </div>
                <div style={{ paddingLeft: "1rem" }}>
                  <div>
                    <span style={{ color: "hsl(var(--muted-foreground) / 0.55)", marginRight: 8 }}>a3f2b1c</span>
                    <span style={{ color: "hsl(var(--muted-foreground))" }}>{t("terminalLog1")}</span>
                  </div>
                  <div>
                    <span style={{ color: "hsl(var(--muted-foreground) / 0.55)", marginRight: 8 }}>8d4e9f2</span>
                    <span style={{ color: "hsl(var(--muted-foreground))" }}>{t("terminalLog2")}</span>
                  </div>
                  <div>
                    <span style={{ color: "hsl(var(--muted-foreground) / 0.55)", marginRight: 8 }}>c7b3a1e</span>
                    <span style={{ color: "hsl(var(--muted-foreground))" }}>{t("terminalLog3")}</span>
                  </div>
                  <div>
                    <span style={{ color: "hsl(var(--muted-foreground) / 0.55)", marginRight: 8 }}>f1e2d3a</span>
                    <span style={{ color: "hsl(var(--muted-foreground))" }}>{t("terminalLog4")}</span>
                  </div>
                </div>
                <div style={{ marginTop: "0.5rem" }}>
                  <span style={{ color: "hsl(var(--primary) / 0.5)" }}>$ </span>
                  <span style={{ color: "hsl(var(--primary))" }}>git checkout -b comeback</span>
                </div>
                <div>
                  <span style={{ color: "#28ca41" }}>Switched to a new branch </span>
                  <span style={{ color: "hsl(var(--primary))" }}>&apos;comeback&apos;</span>
                </div>
                <div style={{ marginTop: "0.25rem", display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ color: "hsl(var(--primary) / 0.5)" }}>$ </span>
                  <span
                    className="cursor-blink"
                    style={{
                      width: 8,
                      height: "1em",
                      background: "hsl(var(--primary))",
                      display: "inline-block",
                      verticalAlign: "middle",
                    }}
                  />
                </div>
              </div>
            </div>
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
            {t("latestNotes")}
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
            {t("viewAll")}
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
                  <PostCard post={pair[0]} locale={locale} readLabel={tPost("read")} />
                </div>
              ) : (
                <div
                  key={pair[0].slug}
                  className="grid grid-cols-1 sm:grid-cols-2"
                  style={{ gap: "1.5rem", marginTop: i > 0 ? "1.5rem" : 0 }}
                >
                  {pair.map((post) => (
                    <PostCard key={post.slug} post={post} locale={locale} readLabel={tPost("read")} />
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
