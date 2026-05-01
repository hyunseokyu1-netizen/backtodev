import { getLocale } from "next-intl/server";
import type { Metadata } from "next";

const BASE_URL = "https://backtodev.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "Contact",
    description: "Get in touch with backtodev.",
    alternates: {
      canonical: `${BASE_URL}/${locale}/contact`,
      languages: {
        ko: `${BASE_URL}/ko/contact`,
        en: `${BASE_URL}/en/contact`,
      },
    },
  };
}

export default async function ContactPage() {
  const locale = await getLocale();
  const isKo = locale === "ko";

  return (
    <div style={{ maxWidth: "40rem" }}>
      <h1
        style={{
          fontSize: "clamp(1.75rem, 4vw, 2.25rem)",
          fontWeight: 700,
          letterSpacing: "-0.04em",
          color: "hsl(var(--foreground))",
          marginBottom: "0.5rem",
        }}
      >
        {isKo ? "연락하기" : "Contact"}
      </h1>
      <p style={{ fontSize: "0.875rem", color: "hsl(var(--muted-foreground))", marginBottom: "3rem" }}>
        {isKo
          ? "질문, 피드백, 협업 제안 모두 환영합니다."
          : "Questions, feedback, or collaboration — all welcome."}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>

        <section>
          <h2 style={h2Style}>{isKo ? "이메일" : "Email"}</h2>
          <p style={pStyle}>
            {isKo
              ? "아래 이메일로 직접 연락해 주세요."
              : "Feel free to reach out directly via email."}
          </p>
          <a
            href="mailto:hyunseok.yu1@gmail.com"
            style={linkStyle}
          >
            hyunseok.yu1@gmail.com
          </a>
        </section>

        <div style={{ width: "100%", height: 1, background: "hsl(var(--border))" }} />

        <section>
          <h2 style={h2Style}>GitHub</h2>
          <p style={pStyle}>
            {isKo
              ? "GitHub 이슈나 디스커션으로도 연락할 수 있습니다."
              : "You can also reach me via GitHub issues or discussions."}
          </p>
          <a
            href="https://github.com/hyunseokyu1-netizen"
            target="_blank"
            rel="noopener noreferrer"
            style={linkStyle}
          >
            github.com/hyunseokyu1-netizen
          </a>
        </section>

        <div style={{ width: "100%", height: 1, background: "hsl(var(--border))" }} />

        <section>
          <h2 style={h2Style}>{isKo ? "응답 시간" : "Response Time"}</h2>
          <p style={pStyle}>
            {isKo
              ? "보통 1~3일 이내에 답변드립니다. 스팸성 메시지는 답변하지 않습니다."
              : "I typically respond within 1–3 business days. Spam will be ignored."}
          </p>
        </section>

      </div>
    </div>
  );
}

const h2Style: React.CSSProperties = {
  fontSize: "1.1rem",
  fontWeight: 700,
  color: "hsl(var(--foreground))",
  marginBottom: "0.75rem",
  letterSpacing: "-0.02em",
};

const pStyle: React.CSSProperties = {
  color: "hsl(var(--muted-foreground))",
  lineHeight: 1.9,
  marginBottom: "0.5rem",
};

const linkStyle: React.CSSProperties = {
  color: "hsl(var(--primary))",
  textDecoration: "underline",
  textUnderlineOffset: 3,
  fontSize: "0.95rem",
};
