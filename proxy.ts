import { NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { verifyToken } from "./lib/auth";

const intlMiddleware = createIntlMiddleware(routing);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /admin 경로 보호
  if (pathname.startsWith("/admin")) {
    if (pathname.startsWith("/admin/login")) return NextResponse.next();
    if (pathname.startsWith("/api/admin/auth")) return NextResponse.next();

    const token = request.cookies.get("admin_token")?.value;
    const valid = token ? await verifyToken(token) : false;

    if (!valid) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  // /api/admin 경로 보호
  if (pathname.startsWith("/api/admin")) {
    const token = request.cookies.get("admin_token")?.value;
    const valid = token ? await verifyToken(token) : false;
    if (!valid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // 나머지는 next-intl 처리
  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/api/admin/:path*"],
};
