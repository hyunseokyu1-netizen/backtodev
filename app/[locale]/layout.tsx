import type { Metadata } from "next";
import "../globals.css";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { routing } from "@/i18n/routing";
import Nav from "@/components/Nav";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "backtodev",
  description: "개발 기록과 포트폴리오",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "en" | "ko")) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <div className="min-h-screen flex flex-col relative" style={{ background: "hsl(var(--background))" }}>
            {/* Dot grid background */}
            <div
              className="bg-grid-pattern"
              style={{
                position: "fixed",
                inset: 0,
                opacity: 0.2,
                pointerEvents: "none",
                zIndex: 0,
              }}
            />

            <Nav />

            <main
              className="flex-1 relative"
              style={{
                maxWidth: "64rem",
                width: "100%",
                margin: "0 auto",
                padding: "2rem 1.5rem 3rem",
                zIndex: 10,
              }}
            >
              {children}
            </main>

            <footer
              style={{
                borderTop: "1px solid hsl(var(--border) / 0.4)",
                padding: "2rem 1.5rem",
                position: "relative",
                zIndex: 10,
                background: "hsl(var(--background))",
              }}
            >
              <div
                style={{
                  maxWidth: "64rem",
                  margin: "0 auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
                className="sm:flex-row"
              >
                <div
                  className="flex items-center gap-2 text-sm"
                  style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-mono), monospace" }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
                  </svg>
                  <span>© {new Date().getFullYear()} backtodev. Made with AI assistance.</span>
                </div>
                <div className="flex items-center gap-4" style={{ color: "hsl(var(--muted-foreground))" }}>
                  <a href="https://github.com/hyunseokyu1-netizen" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                  </a>
                </div>
              </div>
            </footer>
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
