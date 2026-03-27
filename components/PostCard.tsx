import { Link } from "@/i18n/navigation";
import type { PostMeta } from "@/lib/posts";

interface Props {
  post: PostMeta;
  minReadLabel?: string;
  readLabel?: string;
}

export default function PostCard({ post, minReadLabel = "min read", readLabel = "Read →" }: Props) {
  const tags = post.tags ?? [];

  const formattedDate = post.date
    ? new Date(post.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : post.date;

  return (
    <Link
      href={`/posts/${post.slug}`}
      className="post-card group"
      style={{
        padding: "1.5rem 2rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "space-between",
        boxShadow: "0 4px 24px rgba(0,0,0,0.05)",
        textDecoration: "none",
      }}
    >
      {/* Meta row */}
      <div
        className="flex items-center"
        style={{
          gap: "1rem",
          fontSize: "0.75rem",
          color: "hsl(var(--muted-foreground))",
          fontFamily: "var(--font-mono), monospace",
          marginBottom: "1rem",
        }}
      >
        <time dateTime={post.date} className="flex items-center" style={{ gap: "0.375rem" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          {formattedDate}
        </time>
        <span className="flex items-center" style={{ gap: "0.375rem" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          1 {minReadLabel}
        </span>
      </div>

      {/* Title + description */}
      <div style={{ width: "100%" }}>
        <h3
          className="post-card-title"
          style={{
            marginTop: "0.75rem",
            fontSize: "1.25rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.3,
          }}
        >
          {post.title}
        </h3>

        {post.description && (
          <p
            style={{
              marginTop: "1rem",
              fontSize: "0.875rem",
              lineHeight: 1.65,
              color: "hsl(var(--muted-foreground))",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical" as const,
              overflow: "hidden",
            }}
          >
            {post.description}
          </p>
        )}
      </div>

      {/* Tags + read indicator */}
      <div
        className="flex items-center w-full"
        style={{ marginTop: "1.5rem", gap: "1rem" }}
      >
        <div className="flex flex-wrap" style={{ gap: "0.5rem", flex: 1 }}>
          {tags.map((tag) => (
            <span
              key={tag}
              style={{
                borderRadius: 999,
                background: "hsl(var(--secondary))",
                padding: "0.2em 0.75em",
                fontSize: "0.75rem",
                fontWeight: 500,
                color: "hsl(var(--secondary-foreground))",
              }}
            >
              #{tag}
            </span>
          ))}
        </div>

        <div
          className="flex items-center gap-1 text-sm font-medium transition-all duration-300 opacity-0 group-hover:opacity-100"
          style={{
            color: "hsl(var(--primary))",
            whiteSpace: "nowrap",
          }}
        >
          {readLabel}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>
    </Link>
  );
}
