import { Link } from "@/i18n/navigation";
import type { PostMeta } from "@/lib/posts";

interface Props {
  post: PostMeta;
  large?: boolean;
}

const TAG_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  default: {
    bg: "hsl(160 40% 12%)",
    text: "hsl(160 100% 40%)",
    border: "hsl(160 40% 22%)",
  },
};

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

function readingTime(content?: string) {
  if (!content) return null;
  const words = content.trim().split(/\s+/).length;
  const mins = Math.max(1, Math.round(words / 200));
  return mins;
}

export default function PostCard({ post, large = false }: Props) {
  const mins = readingTime(undefined); // content not passed at list level

  return (
    <Link href={`/posts/${post.slug}`} className="post-card group" style={{ padding: large ? "1.75rem" : "1.25rem 1.5rem" }}>
      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {post.tags.map((tag) => {
            const s = getTagStyle(tag);
            return (
              <span
                key={tag}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "0.18em 0.65em",
                  borderRadius: 999,
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  letterSpacing: "0.03em",
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
      <p
        className="font-bold leading-snug mb-2 group-hover:text-white transition-colors"
        style={{
          color: "hsl(210 10% 88%)",
          fontSize: large ? "1.25rem" : "1.05rem",
          letterSpacing: "-0.02em",
        }}
      >
        {post.title}
      </p>

      {/* Description */}
      {post.description && (
        <p
          className="text-sm line-clamp-2 mb-3"
          style={{ color: "var(--text-muted)", lineHeight: 1.65 }}
        >
          {post.description}
        </p>
      )}

      {/* Footer meta */}
      <div className="flex items-center gap-3 mt-auto">
        <time
          className="text-xs font-medium"
          style={{ color: "hsl(210 10% 45%)" }}
        >
          {post.date}
        </time>
        <span style={{ color: "hsl(210 10% 30%)", fontSize: "0.7rem" }}>·</span>
        <span
          className="text-xs"
          style={{ color: "hsl(210 10% 45%)" }}
        >
          {post.lang === "en" ? "EN" : "KO"}
        </span>
        <span
          className="ml-auto text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: "var(--yellow)" }}
        >
          읽기 →
        </span>
      </div>
    </Link>
  );
}
