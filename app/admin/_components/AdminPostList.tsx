"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Post {
  slug: string;
  title: string;
  date: string;
  description: string;
  tags: string[];
  lang: string;
}

export default function AdminPostList() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null); // "{slug}-{lang}"
  const [query, setQuery] = useState("");
  const [searchContent, setSearchContent] = useState(false);
  const router = useRouter();

  const filteredPosts = posts.filter((post) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    if (post.title.toLowerCase().includes(q)) return true;
    if (searchContent) {
      if (post.description?.toLowerCase().includes(q)) return true;
      if (post.tags?.some((t) => t.toLowerCase().includes(q))) return true;
    }
    return false;
  });

  const fetchPosts = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/posts");
    const data = await res.json();
    setPosts(data);
    setLoading(false);
  };

  useEffect(() => { fetchPosts(); }, []);

  const handleDelete = async (slug: string, lang: string, title: string) => {
    if (!confirm(`"${title}" (${lang.toUpperCase()}) 글을 삭제할까요?`)) return;
    setDeleting(`${slug}-${lang}`);
    await fetch(`/api/admin/posts/${slug}?lang=${lang}`, { method: "DELETE" });
    await fetchPosts();
    setDeleting(null);
  };

  const handleLogout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push("/admin/login");
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-8 py-4 border-b"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <span className="font-black text-lg" style={{ color: "var(--yellow)", letterSpacing: "-0.04em" }}>
            backtodev
          </span>
          <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ background: "var(--yellow-dim)", color: "var(--yellow)" }}>
            admin
          </span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/"
            target="_blank"
            className="text-sm transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            사이트 보기 →
          </a>
          <button
            onClick={handleLogout}
            className="text-sm px-4 py-2 rounded-lg transition-all"
            style={{ background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
          >
            로그아웃
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-black text-2xl" style={{ color: "hsl(210 10% 95%)", letterSpacing: "-0.03em" }}>
              글 관리
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              {query ? `${filteredPosts.length} / ${posts.length}개` : `총 ${posts.length}개의 글`}
            </p>
          </div>
          <a
            href="/admin/posts/new"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all"
            style={{ background: "var(--yellow)", color: "hsl(210 15% 6%)" }}
          >
            + 새 글 작성
          </a>
        </div>

        {/* 검색 */}
        <div className="mb-6 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: "var(--text-muted)" }}
              fill="none" stroke="currentColor" strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="제목으로 검색..."
              className="w-full pl-9 pr-9 py-2.5 rounded-xl text-sm outline-none transition-all"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "hsl(210 10% 90%)",
              }}
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                ✕
              </button>
            )}
          </div>
          <label
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm cursor-pointer select-none shrink-0"
            style={{
              background: searchContent ? "hsl(225 40% 16%)" : "var(--surface)",
              border: `1px solid ${searchContent ? "var(--blue)" : "var(--border)"}`,
              color: searchContent ? "var(--blue)" : "var(--text-muted)",
              transition: "all 0.15s",
            }}
          >
            <input
              type="checkbox"
              checked={searchContent}
              onChange={(e) => setSearchContent(e.target.checked)}
              className="hidden"
            />
            <span style={{ fontSize: "0.7rem" }}>{searchContent ? "✓" : "○"}</span>
            내용 검색 포함
          </label>
        </div>

        {loading ? (
          <div className="text-center py-20" style={{ color: "var(--text-muted)" }}>
            불러오는 중...
          </div>
        ) : posts.length === 0 ? (
          <div
            className="rounded-2xl p-12 text-center"
            style={{ background: "var(--surface)", border: "1px dashed var(--border)" }}
          >
            <p className="text-3xl mb-3">✍️</p>
            <p style={{ color: "var(--text-muted)" }}>아직 작성된 글이 없습니다.</p>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div
            className="rounded-2xl p-12 text-center"
            style={{ background: "var(--surface)", border: "1px dashed var(--border)" }}
          >
            <p className="text-3xl mb-3">🔍</p>
            <p style={{ color: "var(--text-muted)" }}>
              &ldquo;{query}&rdquo; 검색 결과가 없습니다.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPosts.map((post) => (
              <div
                key={`${post.slug}-${post.lang}`}
                className="flex items-center gap-4 p-4 rounded-2xl"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold truncate" style={{ color: "hsl(210 10% 90%)" }}>
                      {post.title}
                    </p>
                    <span
                      className="text-xs px-2 py-0.5 rounded font-bold shrink-0"
                      style={{
                        background: post.lang === "en" ? "hsl(225 40% 16%)" : "hsl(160 40% 12%)",
                        color: post.lang === "en" ? "var(--blue)" : "var(--green)",
                      }}
                    >
                      {post.lang?.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{post.date}</span>
                    <span className="text-xs font-mono" style={{ color: "hsl(210 10% 40%)" }}>/{post.slug}</span>
                    {post.tags?.length > 0 && (
                      <div className="flex gap-1">
                        {post.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="text-xs px-1.5 py-0.5 rounded"
                            style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={`/ko/posts/${post.slug}`}
                    target="_blank"
                    className="text-xs px-3 py-1.5 rounded-lg transition-all"
                    style={{ background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                  >
                    보기
                  </a>
                  <a
                    href={`/admin/posts/${post.slug}`}
                    className="text-xs px-3 py-1.5 rounded-lg transition-all"
                    style={{ background: "var(--surface-2)", color: "var(--blue)", border: "1px solid var(--border)" }}
                  >
                    수정
                  </a>
                  <button
                    onClick={() => handleDelete(post.slug, post.lang, post.title)}
                    disabled={deleting === `${post.slug}-${post.lang}`}
                    className="text-xs px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                    style={{ background: "hsl(340 30% 14%)", color: "hsl(340 95% 60%)", border: "1px solid hsl(340 30% 22%)" }}
                  >
                    {deleting === `${post.slug}-${post.lang}` ? "삭제 중..." : "삭제"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
