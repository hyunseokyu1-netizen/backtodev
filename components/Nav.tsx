"use client";

import { usePathname, useRouter, Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";

export default function Nav() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const links = [
    { href: "/" as const, label: t("home") },
    { href: "/posts" as const, label: t("posts") },
    { href: "/about" as const, label: t("about") },
  ];

  const toggleLocale = () => {
    const next = locale === "ko" ? "en" : "ko";
    router.replace(pathname, { locale: next });
  };

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: "hsl(210 15% 6% / 0.88)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid hsl(210 10% 14%)",
      }}
    >
      <div
        className="mx-auto flex items-center justify-between px-8 py-4"
        style={{ maxWidth: "min(68.75rem, 100%)" }}
      >
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 font-black text-xl tracking-tight"
          style={{ color: "var(--yellow)", letterSpacing: "-0.04em" }}
        >
          <span
            style={{
              background: "var(--yellow)",
              color: "hsl(210 15% 6%)",
              borderRadius: 6,
              padding: "0px 6px",
              fontSize: "0.85em",
              fontWeight: 900,
            }}
          >
            B
          </span>
          backtodev
        </Link>

        <div className="flex items-center gap-2">
          {/* Nav links */}
          <nav className="flex items-center mr-3">
            {links.map(({ href, label }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className="relative px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-150"
                  style={{ color: active ? "#fff" : "var(--text-muted)" }}
                >
                  {label}
                  {active && (
                    <span
                      style={{
                        position: "absolute",
                        bottom: 4,
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: 18,
                        height: 2,
                        borderRadius: 2,
                        background: "var(--yellow)",
                        display: "block",
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
            className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all duration-150"
            style={{
              background: "transparent",
              border: "1.5px solid var(--yellow)",
              color: "var(--yellow)",
              letterSpacing: "0.05em",
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
