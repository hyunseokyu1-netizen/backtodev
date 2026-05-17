import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import createNextIntlPlugin from "next-intl/plugin";

const withMDX = createMDX({});
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdx"],
  async redirects() {
    return [
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
        permanent: false,
      },
      {
        source: "/posts/hello-world",
        destination: "/ko/posts",
        permanent: false,
      },
    ];
  },
};

export default withNextIntl(withMDX(nextConfig));
