import type { Metadata } from "next";

export const BASE_URL = "https://backtodev.com";

export function localizedPageMetadata({
  locale,
  path = "",
  title,
  description,
}: {
  locale: string;
  path?: string;
  title: string;
  description: string;
}): Metadata {
  const normalizedPath = path ? `/${path.replace(/^\//, "")}` : "";
  const canonical = `${BASE_URL}/${locale}${normalizedPath}`;

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        ko: `${BASE_URL}/ko${normalizedPath}`,
        en: `${BASE_URL}/en${normalizedPath}`,
      },
    },
    openGraph: {
      type: "website",
      siteName: "backtodev",
      title,
      description,
      url: canonical,
      locale: locale === "ko" ? "ko_KR" : "en_US",
      alternateLocale: locale === "ko" ? ["en_US"] : ["ko_KR"],
      images: [
        {
          url: `${BASE_URL}/og`,
          width: 1200,
          height: 630,
          alt: "backtodev — building products and returning to code",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${BASE_URL}/og`],
    },
  };
}
