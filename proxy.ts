import { NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { verifyToken } from "./lib/auth";

const intlMiddleware = createIntlMiddleware(routing);
const LOCALE_COOKIE = "NEXT_LOCALE";

function detectLocale(request: NextRequest): "en" | "ko" {
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (cookie === "en" || cookie === "ko") return cookie;
  // ko 또는 ko-KR이면 한국어, 그 외 모든 언어는 영어
  const acceptLang = request.headers.get("accept-language") ?? "";
  return /\bko\b/.test(acceptLang) ? "ko" : "en";
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 검색엔진과 공유 URL을 apex 도메인 하나로 통일
  if (request.headers.get("host")?.split(":")[0] === "www.backtodev.com") {
    const canonicalUrl = request.nextUrl.clone();
    canonicalUrl.hostname = "backtodev.com";
    canonicalUrl.port = "";
    return NextResponse.redirect(canonicalUrl, 308);
  }

  // 파일 기반 메타데이터 Route Handler는 locale 리디렉션 대상이 아니다.
  if (pathname === "/og") {
    return NextResponse.next();
  }

  // 인증 API는 항상 허용 (로그인/로그아웃)
  if (pathname.startsWith("/api/admin/auth")) return NextResponse.next();

  // /admin 페이지 보호
  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") return NextResponse.next();

    const token = request.cookies.get("admin_token")?.value;
    const valid = token ? await verifyToken(token) : false;
    if (!valid) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  // /api/admin 보호
  if (pathname.startsWith("/api/admin")) {
    const token = request.cookies.get("admin_token")?.value;
    const valid = token ? await verifyToken(token) : false;
    if (!valid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // 그 외 API 라우트는 locale 처리 없이 통과 (예: /api/guestbook)
  if (pathname.startsWith("/api")) return NextResponse.next();

  // locale 접두사가 없는 경로에서 브라우저 언어(또는 쿠키) 기반으로 자동 리디렉션
  const hasLocalePrefix = /^\/(en|ko)(\/|$)/.test(pathname);
  if (!hasLocalePrefix) {
    const locale = detectLocale(request);
    if (locale === "en") {
      const target = new URL(request.url);
      target.pathname = `/en${pathname}`;
      return NextResponse.redirect(target);
    }
    // ko: intlMiddleware가 /ko/로 리디렉션 처리
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/api/admin/:path*"],
};
