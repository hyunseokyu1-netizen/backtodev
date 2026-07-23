import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/posts";

const BASE_URL = "https://backtodev.com";

// 영어 페이지는 자동 번역(검수 없음)이라 noindex 처리와 함께 사이트맵에서도 제외한다.
// 사이트맵에는 색인 대상인 한국어 페이지만 노출.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const koPosts = await getAllPosts("ko");

  const postEntries: MetadataRoute.Sitemap = koPosts
    .filter((p) => !p.isFallback && !p.noindex)
    .map((post) => ({
      url: `${BASE_URL}/ko/posts/${post.slug}`,
      lastModified: post.date ? new Date(post.date) : new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    }));

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

  const staticEntries: MetadataRoute.Sitemap = staticPages.map((page) => ({
    url: `${BASE_URL}/ko${page.path}`,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));

  return [...staticEntries, ...postEntries];
}
