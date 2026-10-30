import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/posts";

const BASE_URL = "https://backtodev.com";

// ko/en 양쪽 다 색인 대상. isFallback(번역 없어 다른 언어로 대체 노출)과
// frontmatter noindex만 제외한다.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [koPosts, enPosts] = await Promise.all([getAllPosts("ko"), getAllPosts("en")]);

  const toEntries = (posts: Awaited<ReturnType<typeof getAllPosts>>, locale: "ko" | "en"): MetadataRoute.Sitemap =>
    posts
      .filter((p) => !p.isFallback && !p.noindex)
      .map((post) => ({
        url: `${BASE_URL}/${locale}/posts/${post.slug}`,
        lastModified: post.date ? new Date(post.date) : new Date(),
        changeFrequency: "monthly",
        priority: 0.8,
      }));

  const postEntries: MetadataRoute.Sitemap = [...toEntries(koPosts, "ko"), ...toEntries(enPosts, "en")];

  const staticPages = [
    { path: "", changeFrequency: "daily" as const, priority: 1.0 },
    { path: "/posts", changeFrequency: "daily" as const, priority: 0.9 },
    { path: "/portfolio", changeFrequency: "weekly" as const, priority: 0.9 },
    { path: "/about", changeFrequency: "monthly" as const, priority: 0.6 },
    { path: "/village", changeFrequency: "weekly" as const, priority: 0.6 },
    { path: "/contact", changeFrequency: "yearly" as const, priority: 0.4 },
    { path: "/privacy", changeFrequency: "yearly" as const, priority: 0.3 },
    { path: "/privacy/football-dice", changeFrequency: "yearly" as const, priority: 0.2 },
    { path: "/privacy/mahjong-hanpan", changeFrequency: "yearly" as const, priority: 0.2 },
    { path: "/privacy/repo-note", changeFrequency: "yearly" as const, priority: 0.2 },
  ];

  const staticEntries: MetadataRoute.Sitemap = staticPages.flatMap((page) => [
    { url: `${BASE_URL}/ko${page.path}`, changeFrequency: page.changeFrequency, priority: page.priority },
    { url: `${BASE_URL}/en${page.path}`, changeFrequency: page.changeFrequency, priority: page.priority },
  ]);

  return [...staticEntries, ...postEntries];
}
