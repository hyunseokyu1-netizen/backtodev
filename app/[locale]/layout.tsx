import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { routing } from "@/i18n/routing";
import Nav from "@/components/Nav";
import { notFound } from "next/navigation";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
    <html lang={locale} className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <Nav />
          <main
            className="mx-auto px-8 py-14"
            style={{ maxWidth: "min(68.75rem, 100%)" }}
          >
            {children}
          </main>
          <footer
            className="text-center py-10 text-sm border-t"
            style={{ color: "var(--text-muted)", borderColor: "var(--border)" }}
          >
            <p>
              Built with{" "}
              <span style={{ color: "var(--yellow)" }}>♥</span> using Next.js
              &amp; Markdown
            </p>
            <p className="mt-1" style={{ color: "hsl(210 10% 35%)" }}>
              © {new Date().getFullYear()} backtodev
            </p>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
