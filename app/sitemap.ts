import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/posts";

const BASE_URL = "https://backtodev.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [koPosts, enPosts] = await Promise.all([
    getAllPosts("ko"),
    getAllPosts("en"),
  ]);

  // 실제 해당 언어 콘텐츠가 있는 것만 (fallback 제외)
  const koSlugs = new Set(koPosts.filter((p) => !p.isFallback).map((p) => p.slug));
  const enSlugs = new Set(enPosts.filter((p) => !p.isFallback).map((p) => p.slug));

  const allSlugs = new Set([...koSlugs, ...enSlugs]);

  const postEntries: MetadataRoute.Sitemap = Array.from(allSlugs).flatMap((slug) => {
    const entries: MetadataRoute.Sitemap = [];

    if (koSlugs.has(slug)) {
      const post = koPosts.find((p) => p.slug === slug)!;
      entries.push({
        url: `${BASE_URL}/ko/posts/${slug}`,
        lastModified: post.date ? new Date(post.date) : new Date(),
        changeFrequency: "monthly",
        priority: 0.8,
        alternates: {
          languages: {
            ko: `${BASE_URL}/ko/posts/${slug}`,
            ...(enSlugs.has(slug) && { en: `${BASE_URL}/en/posts/${slug}` }),
            "x-default": `${BASE_URL}/ko/posts/${slug}`,
          },
        },
      });
    }

    if (enSlugs.has(slug)) {
      const post = enPosts.find((p) => p.slug === slug)!;
      entries.push({
        url: `${BASE_URL}/en/posts/${slug}`,
        lastModified: post.date ? new Date(post.date) : new Date(),
        changeFrequency: "monthly",
        priority: 0.8,
        alternates: {
          languages: {
            ...(koSlugs.has(slug) && { ko: `${BASE_URL}/ko/posts/${slug}` }),
            en: `${BASE_URL}/en/posts/${slug}`,
            "x-default": koSlugs.has(slug)
              ? `${BASE_URL}/ko/posts/${slug}`
              : `${BASE_URL}/en/posts/${slug}`,
          },
        },
      });
    }

    return entries;
  });

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

  const staticEntries: MetadataRoute.Sitemap = staticPages.flatMap((page) => {
    const languages = {
      ko: `${BASE_URL}/ko${page.path}`,
      en: `${BASE_URL}/en${page.path}`,
      "x-default": `${BASE_URL}/ko${page.path}`,
    };
    return (["ko", "en"] as const).map((locale) => ({
      url: languages[locale],
      changeFrequency: page.changeFrequency,
      priority: page.priority,
      alternates: { languages },
    }));
  });

  return [...staticEntries, ...postEntries];
}
