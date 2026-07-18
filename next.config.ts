import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import createNextIntlPlugin from "next-intl/plugin";

const withMDX = createMDX({});
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdx"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // trailing slash → 슬래시 없는 버전으로 정규화 (middleware 루프 방지)
      { source: "/ko/", destination: "/ko", permanent: true },
      { source: "/en/", destination: "/en", permanent: true },
      // 구 한국어 슬러그 → 현재 슬러그
      {
        source: "/:locale(ko|en)/posts/ai-%EA%B0%9C%EB%B0%9C%EC%8B%9C%EC%9E%91001-%ED%81%B4%EB%A1%9C%EB%93%9C-%EC%BD%94%EB%93%9C-%EC%8B%9C%EC%9E%91",
        destination: "/:locale/posts/ai_coding_start_001_20260327",
        permanent: true,
      },
      // locale 없는 구 한국어 슬러그
      {
        source: "/posts/ai-%EA%B0%9C%EB%B0%9C%EC%8B%9C%EC%9E%91001-%ED%81%B4%EB%A1%9C%EB%93%9C-%EC%BD%94%EB%93%9C-%EC%8B%9C%EC%9E%91",
        destination: "/ko/posts/ai_coding_start_001_20260327",
        permanent: true,
      },
      // 예시 파일명을 Google이 링크로 인식한 hello-world
      {
        source: "/:locale(ko|en)/posts/hello-world",
        destination: "/:locale/posts",
        permanent: true,
      },
      {
        source: "/posts/hello-world",
        destination: "/ko/posts",
        permanent: true,
      },
    ];
  },
};

export default withNextIntl(withMDX(nextConfig));
