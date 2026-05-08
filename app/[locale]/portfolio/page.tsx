import { getLocale } from "next-intl/server";
import type { Metadata } from "next";
import Link from "next/link";

const BASE_URL = "https://backtodev.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isKo = locale === "ko";
  return {
    title: isKo ? "포트폴리오" : "Portfolio",
    description: isKo
      ? "직접 만든 사이드 프로젝트들"
      : "Side projects I've built",
    alternates: {
      canonical: `${BASE_URL}/${locale}/portfolio`,
      languages: {
        ko: `${BASE_URL}/ko/portfolio`,
        en: `${BASE_URL}/en/portfolio`,
      },
    },
  };
}

interface Project {
  name: string;
  tagline: string;
  description: string;
  tech: string[];
  links: { label: string; href: string; primary?: boolean }[];
  status: "live" | "wip";
  statusLabel: string;
  period: string;
}

export default async function PortfolioPage() {
  const locale = await getLocale();
  const isKo = locale === "ko";

  const projects: Project[] = isKo
    ? [
        {
          name: "WiFi QR 코드 생성기",
          tagline: "손님한테 비밀번호 받아 적는 거 이제 그만",
          description:
            "카페, 식당, 소상공인 공간에서 손님이 WiFi 비밀번호를 직접 받아 적는 불편함을 없애기 위해 만들었습니다. SSID와 비밀번호를 입력하면 즉시 QR 코드가 생성되고, 카드 형태로 인쇄해 벽에 붙여두면 손님이 카메라로 스캔해 바로 연결할 수 있습니다. 한국어·영어·중국어·독일어 4개 언어를 지원합니다.",
          tech: ["React", "TypeScript", "Vite", "qrcode.react", "Zod", "i18n"],
          links: [
            { label: "→ wi-fi-qr.xyz", href: "https://wi-fi-qr.xyz", primary: true },
            { label: "개발 이야기", href: "/ko/posts/adsense_content_expansion_20260505" },
          ],
          status: "live",
          statusLabel: "운영 중",
          period: "2026.05",
        },
      ]
    : [
        {
          name: "WiFi QR Code Generator",
          tagline: "No more reading out WiFi passwords to guests",
          description:
            "Built to eliminate the awkward WiFi password exchange at cafés, restaurants, and small businesses. Enter your SSID and password, get a QR code instantly. Print it as a card, stick it on the wall — guests scan with their camera and connect. Supports Korean, English, Chinese, and German.",
          tech: ["React", "TypeScript", "Vite", "qrcode.react", "Zod", "i18n"],
          links: [
            { label: "→ wi-fi-qr.xyz", href: "https://wi-fi-qr.xyz", primary: true },
            { label: "Dev story", href: "/en/posts/adsense_content_expansion_20260505" },
          ],
          status: "live",
          statusLabel: "Live",
          period: "May 2026",
        },
      ];

  return (
    <div style={{ maxWidth: "52rem" }}>
      {/* Page header */}
      <div style={{ marginBottom: "3rem" }}>
        <h1
          style={{
            fontSize: "clamp(1.6rem, 3.5vw, 2.25rem)",
            fontWeight: 700,
            letterSpacing: "-0.04em",
            color: "hsl(var(--foreground))",
            marginBottom: "0.75rem",
            lineHeight: 1.2,
          }}
        >
          {isKo ? "직접 만든 것들" : "Things I've built"}
        </h1>
        <p style={{ color: "hsl(var(--muted-foreground))", lineHeight: 1.8 }}>
          {isKo
            ? "글로만 배우지 않고, 직접 만들어보는 것들을 여기에 기록합니다."
            : "Not just learning by reading — shipping things and logging them here."}
        </p>
      </div>

      {/* Project cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {projects.map((project) => (
          <article
            key={project.name}
            style={{
              borderRadius: 20,
              padding: "1.75rem",
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              position: "relative",
            }}
          >
            {/* Top row: name + status */}
            <div
              className="flex items-start justify-between"
              style={{ marginBottom: "0.75rem", gap: "1rem" }}
            >
              <div>
                <h2
                  style={{
                    fontSize: "1.15rem",
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    color: "hsl(var(--foreground))",
                    marginBottom: "0.2rem",
                  }}
                >
                  {project.name}
                </h2>
                <p
                  style={{
                    fontSize: "0.82rem",
                    color: "hsl(var(--primary))",
                    fontFamily: "var(--font-mono), monospace",
                  }}
                >
                  {project.tagline}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  style={{
                    fontSize: "0.7rem",
                    padding: "0.25rem 0.6rem",
                    borderRadius: 99,
                    fontWeight: 700,
                    fontFamily: "var(--font-mono), monospace",
                    background:
                      project.status === "live"
                        ? "hsl(160 40% 12%)"
                        : "hsl(40 40% 12%)",
                    color:
                      project.status === "live"
                        ? "hsl(160 70% 55%)"
                        : "hsl(40 90% 60%)",
                    border: `1px solid ${
                      project.status === "live"
                        ? "hsl(160 40% 22%)"
                        : "hsl(40 40% 24%)"
                    }`,
                  }}
                >
                  {project.status === "live" ? "● " : "○ "}
                  {project.statusLabel}
                </span>
                <span
                  style={{
                    fontSize: "0.7rem",
                    color: "hsl(var(--muted-foreground))",
                    fontFamily: "var(--font-mono), monospace",
                  }}
                >
                  {project.period}
                </span>
              </div>
            </div>

            {/* Description */}
            <p
              style={{
                color: "hsl(var(--muted-foreground))",
                lineHeight: 1.85,
                fontSize: "0.9rem",
                marginBottom: "1.25rem",
              }}
            >
              {project.description}
            </p>

            {/* Tech tags */}
            <div
              className="flex flex-wrap"
              style={{ gap: "0.4rem", marginBottom: "1.25rem" }}
            >
              {project.tech.map((t) => (
                <span
                  key={t}
                  style={{
                    fontSize: "0.72rem",
                    padding: "0.2rem 0.6rem",
                    borderRadius: 6,
                    background: "hsl(var(--background))",
                    color: "hsl(var(--muted-foreground))",
                    border: "1px solid hsl(var(--border))",
                    fontFamily: "var(--font-mono), monospace",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>

            {/* Links */}
            <div className="flex items-center flex-wrap" style={{ gap: "0.75rem" }}>
              {project.links.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target={link.href.startsWith("http") ? "_blank" : undefined}
                  rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: link.primary ? 700 : 500,
                    color: link.primary
                      ? "hsl(var(--primary))"
                      : "hsl(var(--muted-foreground))",
                    textDecoration: "none",
                    fontFamily: "var(--font-mono), monospace",
                    borderBottom: `1px solid ${
                      link.primary
                        ? "hsl(var(--primary) / 0.4)"
                        : "hsl(var(--border))"
                    }`,
                    paddingBottom: "1px",
                  }}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </article>
        ))}
      </div>

      {/* Footer note */}
      <p
        style={{
          marginTop: "2.5rem",
          fontSize: "0.82rem",
          color: "hsl(var(--muted-foreground) / 0.6)",
          fontFamily: "var(--font-mono), monospace",
          textAlign: "center",
        }}
      >
        {isKo ? "// 계속 추가 중입니다." : "// more coming soon."}
      </p>
    </div>
  );
}
