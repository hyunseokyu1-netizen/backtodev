"use client";

import { usePathname as useRawPathname } from "next/navigation";
import { useRouter, Link } from "@/i18n/navigation";
import { useLocale } from "next-intl";

const TerminalIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5"/>
    <line x1="12" y1="19" x2="20" y2="19"/>
  </svg>
);

export default function Nav() {
  const locale = useLocale();
  const rawPathname = useRawPathname(); // /en/posts/foo 또는 /posts/foo 형태
  const router = useRouter();
  // locale prefix를 직접 제거해서 중복 방지
  const cleanPath = rawPathname.replace(/^\/(en|ko)(?=\/|$)/, "") || "/";

  const links = [
    { href: "/" as const, label: "Home" },
    { href: "/posts" as const, label: "Posts" },
    { href: "/about" as const, label: "About" },
  ];

  const toggleLocale = () => {
    const next = locale === "ko" ? "en" : "ko";
    router.replace(cleanPath, { locale: next });
  };

  return (
    <header
      className="sticky top-0 z-50 w-full"
      style={{
        borderBottom: "1px solid hsl(var(--border) / 0.4)",
        background: "hsl(var(--background) / 0.8)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      <div
        className="mx-auto flex items-center justify-between px-6"
        style={{ maxWidth: "64rem", height: 64 }}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div
            className="flex items-center justify-center rounded-lg transition-colors"
            style={{
              padding: "0.375rem",
              background: "hsl(var(--primary) / 0.1)",
              color: "hsl(var(--primary))",
            }}
          >
            <TerminalIcon />
          </div>
          <span
            style={{
              fontFamily: "var(--font-mono), 'Fira Code', monospace",
              fontWeight: 700,
              fontSize: "1.1rem",
              letterSpacing: "-0.02em",
              color: "hsl(var(--foreground))",
            }}
          >
            backtodev
            <span
              style={{
                color: "hsl(var(--primary))",
                animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
              }}
            >
              _
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {/* Nav links */}
          <nav className="flex items-center">
            {links.map(({ href, label }) => {
              const active = href === "/" ? cleanPath === "/" : cleanPath.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className="relative px-3 py-2 text-sm font-medium transition-colors"
                  style={{ color: active ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))" }}
                >
                  {label}
                  {active && (
                    <span
                      style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: 2,
                        background: "hsl(var(--primary))",
                        borderRadius: 2,
                      }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Language toggle */}
          <button
            onClick={toggleLocale}
            className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all ml-2"
            style={{
              background: "transparent",
              border: "1px solid hsl(var(--border))",
              color: "hsl(var(--muted-foreground))",
              fontFamily: "var(--font-mono), monospace",
            }}
            title={locale === "ko" ? "Switch to English" : "한국어로 보기"}
          >
            {locale === "ko" ? "EN" : "KO"}
          </button>
        </div>
      </div>
    </header>
  );
}
