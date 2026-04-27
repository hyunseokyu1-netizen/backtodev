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
      });
    }

    if (enSlugs.has(slug)) {
      const post = enPosts.find((p) => p.slug === slug)!;
      entries.push({
        url: `${BASE_URL}/en/posts/${slug}`,
        lastModified: post.date ? new Date(post.date) : new Date(),
        changeFrequency: "monthly",
        priority: 0.8,
      });
    }

    return entries;
  });

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/ko`,        lastModified: new Date(), changeFrequency: "daily",   priority: 1.0 },
    { url: `${BASE_URL}/en`,        lastModified: new Date(), changeFrequency: "daily",   priority: 1.0 },
    { url: `${BASE_URL}/ko/posts`,  lastModified: new Date(), changeFrequency: "daily",   priority: 0.9 },
    { url: `${BASE_URL}/en/posts`,  lastModified: new Date(), changeFrequency: "daily",   priority: 0.9 },
    { url: `${BASE_URL}/ko/about`,   lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/en/about`,   lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/ko/contact`, lastModified: new Date(), changeFrequency: "yearly",  priority: 0.4 },
    { url: `${BASE_URL}/en/contact`, lastModified: new Date(), changeFrequency: "yearly",  priority: 0.4 },
    { url: `${BASE_URL}/ko/privacy`, lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3 },
    { url: `${BASE_URL}/en/privacy`, lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3 },
  ];

  return [...staticEntries, ...postEntries];
}
