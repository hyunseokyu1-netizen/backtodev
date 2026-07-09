import type { Metadata } from "next";
import { getAllPosts } from "@/lib/posts";
import { readGuestbook } from "@/lib/guestbook";
import VillageGame, { type VillagePost } from "./VillageGame";

const BASE_URL = "https://backtodev.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isKo = locale === "ko";
  return {
    title: isKo ? "픽셀 마을" : "Pixel Village",
    description: isKo
      ? "블로그를 90년대 RPG 마을처럼 돌아다녀 보세요"
      : "Explore this blog as a 90s-style RPG village",
    alternates: {
      canonical: `${BASE_URL}/${locale}/village`,
      languages: {
        ko: `${BASE_URL}/ko/village`,
        en: `${BASE_URL}/en/village`,
      },
    },
  };
}

export default async function VillagePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const posts: VillagePost[] = (await getAllPosts(locale)).map((p) => ({
    slug: p.slug,
    title: p.title,
    date: p.date,
    tags: p.tags ?? [],
  }));
  const { entries: guestbook } = await readGuestbook();
  return <VillageGame locale={locale} posts={posts} guestbook={guestbook} />;
}
