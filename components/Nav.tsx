"use client";

import { useState } from "react";
import { usePathname as useRawPathname } from "next/navigation";
import { useRouter, Link } from "@/i18n/navigation";
import { useLocale } from "next-intl";

const TerminalIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5"/>
    <line x1="12" y1="19" x2="20" y2="19"/>
  </svg>
);

const HamburgerIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

export default function Nav() {
  const locale = useLocale();
  const rawPathname = useRawPathname();
  const router = useRouter();
  const cleanPath = rawPathname.replace(/^\/(en|ko)(?=\/|$)/, "") || "/";
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { href: "/" as const, label: "Home" },
    { href: "/posts" as const, label: "Posts" },
    { href: "/portfolio" as const, label: "Portfolio" },
    { href: "/about" as const, label: "About" },
  ];

  const toggleLocale = () => {
    const next = locale === "ko" ? "en" : "ko";
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; SameSite=Lax`;
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
        <Link href="/" className="flex items-center gap-2 group" onClick={() => setMenuOpen(false)}>
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
            <span style={{ color: "hsl(var(--primary))", animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite" }}>
              _
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          {/* 데스크톱 nav links */}
          <nav className="hidden md:flex items-center">
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
            className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
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

          {/* 모바일 햄버거 버튼 */}
          <button
            className="flex md:hidden items-center justify-center rounded-lg transition-colors"
            style={{
              padding: "0.375rem",
              color: "hsl(var(--muted-foreground))",
              background: menuOpen ? "hsl(var(--primary) / 0.1)" : "transparent",
            }}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="메뉴 열기"
          >
            {menuOpen ? <CloseIcon /> : <HamburgerIcon />}
          </button>
        </div>
      </div>

      {/* 모바일 드롭다운 메뉴 */}
      {menuOpen && (
        <div
          className="md:hidden"
          style={{
            borderTop: "1px solid hsl(var(--border) / 0.4)",
            background: "hsl(var(--background) / 0.95)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          <nav className="flex flex-col px-6 py-4" style={{ gap: "0.25rem" }}>
            {links.map(({ href, label }) => {
              const active = href === "/" ? cleanPath === "/" : cleanPath.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center py-3 text-base font-medium transition-colors"
                  style={{
                    color: active ? "hsl(var(--primary))" : "hsl(var(--foreground))",
                    borderBottom: "1px solid hsl(var(--border) / 0.3)",
                    gap: "0.75rem",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono), monospace",
                      fontSize: "0.8rem",
                      color: active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                    }}
                  >
                    {active ? "▶" : "○"}
                  </span>
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
