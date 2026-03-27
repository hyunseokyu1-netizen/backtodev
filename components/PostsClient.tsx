"use client";

import { useState, useMemo } from "react";
import { Link } from "@/i18n/navigation";
import type { PostMeta } from "@/lib/posts";

interface Props {
  posts: PostMeta[];
  minReadLabel: string;
  readLabel: string;
}

export default function PostsClient({ posts, minReadLabel, readLabel }: Props) {
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // 전체 태그 + 카운트
  const tagCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const post of posts) {
      for (const tag of post.tags ?? []) {
        map[tag] = (map[tag] ?? 0) + 1;
      }
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [posts]);

  // 필터링
  const filtered = useMemo(() => {
    return posts.filter((post) => {
      const matchesTag = !activeTag || (post.tags ?? []).includes(activeTag);
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        post.title.toLowerCase().includes(q) ||
        (post.description ?? "").toLowerCase().includes(q) ||
        (post.tags ?? []).some((t) => t.toLowerCase().includes(q));
      return matchesTag && matchesSearch;
    });
  }, [posts, search, activeTag]);

  const formattedDate = (date: string) =>
    new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="flex flex-col lg:flex-row items-start" style={{ gap: "2rem" }}>

      {/* ── Left: Search + Posts ── */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "1.5rem" }}>

        {/* Search */}
        <div style={{ position: "relative" }}>
          <svg
            width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="hsl(var(--muted-foreground))" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
          >
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search posts ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "1rem 1rem 1rem 3rem",
              borderRadius: 12,
              background: "hsl(var(--card))",
              border: "2px solid hsl(var(--border))",
              color: "hsl(var(--foreground))",
              fontSize: "0.9rem",
              outline: "none",
              fontFamily: "var(--font-mono), monospace",
              transition: "border-color 150ms",
            }}
            onFocus={(e) => (e.target.style.borderColor = "hsl(var(--primary))")}
            onBlur={(e) => (e.target.style.borderColor = "hsl(var(--border))")}
          />
        </div>

        {/* Post list */}
        {filtered.length === 0 ? (
          <div
            style={{
              padding: "3rem",
              textAlign: "center",
              border: "2px dashed hsl(var(--border))",
              borderRadius: 16,
              color: "hsl(var(--muted-foreground))",
              fontFamily: "var(--font-mono), monospace",
            }}
          >
            No posts found.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {filtered.map((post) => {
              const tags = post.tags ?? [];
              return (
                <Link
                  key={post.slug}
                  href={`/posts/${post.slug}`}
                  className="post-card group"
                  style={{ padding: "1.5rem 2rem", textDecoration: "none", display: "block" }}
                >
                  {/* Meta */}
                  <div
                    className="flex items-center"
                    style={{ gap: "1rem", fontSize: "0.75rem", color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-mono), monospace", marginBottom: "1rem" }}
                  >
                    <time dateTime={post.date} className="flex items-center" style={{ gap: "0.375rem" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                      {formattedDate(post.date)}
                    </time>
                    <span className="flex items-center" style={{ gap: "0.375rem" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                      </svg>
                      1 {minReadLabel}
                    </span>
                  </div>

                  {/* Title */}
                  <h3
                    className="post-card-title"
                    style={{ fontSize: "1.2rem", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.35, marginBottom: "0.75rem" }}
                  >
                    {post.title}
                  </h3>

                  {/* Description */}
                  {post.description && (
                    <p style={{ fontSize: "0.875rem", color: "hsl(var(--muted-foreground))", lineHeight: 1.65, marginBottom: "1.25rem" }}>
                      {post.description}
                    </p>
                  )}

                  {/* Tags */}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap" style={{ gap: "0.5rem" }}>
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          style={{ borderRadius: 999, background: "hsl(var(--secondary))", padding: "0.2em 0.75em", fontSize: "0.75rem", fontWeight: 500, color: "hsl(var(--secondary-foreground))" }}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Right: Topics sidebar ── */}
      <div
        style={{
          width: "100%",
          maxWidth: 280,
          flexShrink: 0,
          borderRadius: 16,
          padding: "1.5rem",
          background: "hsl(var(--card))",
          border: "1px solid hsl(var(--border))",
          position: "sticky",
          top: 80,
        }}
        className="hidden lg:block"
      >
        <div className="flex items-center gap-2 mb-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
            <line x1="7" y1="7" x2="7.01" y2="7"/>
          </svg>
          <span style={{ fontWeight: 700, fontSize: "1rem", color: "hsl(var(--foreground))" }}>Topics</span>
        </div>

        <div className="flex flex-wrap" style={{ gap: "0.5rem" }}>
          {/* All Posts */}
          <button
            onClick={() => setActiveTag(null)}
            style={{
              borderRadius: 999,
              padding: "0.3em 0.85em",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              background: activeTag === null ? "hsl(var(--primary))" : "hsl(var(--secondary))",
              color: activeTag === null ? "hsl(var(--primary-foreground))" : "hsl(var(--secondary-foreground))",
              transition: "all 150ms",
            }}
          >
            All Posts
          </button>

          {tagCounts.map(([tag, count]) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              style={{
                borderRadius: 999,
                padding: "0.3em 0.85em",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
                border: "none",
                background: activeTag === tag ? "hsl(var(--primary))" : "hsl(var(--secondary))",
                color: activeTag === tag ? "hsl(var(--primary-foreground))" : "hsl(var(--secondary-foreground))",
                transition: "all 150ms",
              }}
            >
              #{tag} <span style={{ opacity: 0.7 }}>{count}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
