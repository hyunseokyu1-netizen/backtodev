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
    title: "Privacy Policy",
    description: "Privacy policy for backtodev.",
    alternates: {
      canonical: `${BASE_URL}/${locale}/privacy`,
      languages: {
        ko: `${BASE_URL}/ko/privacy`,
        en: `${BASE_URL}/en/privacy`,
      },
    },
  };
}

export default async function PrivacyPage() {
  const locale = await getLocale();
  const isKo = locale === "ko";

  return (
    <div style={{ maxWidth: "48rem" }}>
      <h1
        style={{
          fontSize: "clamp(1.75rem, 4vw, 2.25rem)",
          fontWeight: 700,
          letterSpacing: "-0.04em",
          color: "hsl(var(--foreground))",
          marginBottom: "0.5rem",
        }}
      >
        {isKo ? "개인정보처리방침" : "Privacy Policy"}
      </h1>
      <p style={{ fontSize: "0.875rem", color: "hsl(var(--muted-foreground))", marginBottom: "3rem" }}>
        {isKo ? "최종 업데이트: 2026년 4월 1일" : "Last updated: April 1, 2026"}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>

        {isKo ? (
          <>
            <section>
              <h2 style={h2Style}>1. 개요</h2>
              <p style={pStyle}>
                backtodev(이하 &quot;블로그&quot;)는 방문자의 개인정보를 소중히 여깁니다.
                이 개인정보처리방침은 본 블로그가 어떤 정보를 수집하고, 어떻게 사용하는지 설명합니다.
              </p>
            </section>

            <section>
              <h2 style={h2Style}>2. 수집하는 정보</h2>
              <p style={pStyle}>본 블로그는 다음과 같은 정보를 수집할 수 있습니다:</p>
              <ul style={ulStyle}>
                <li style={liStyle}>방문 페이지, 체류 시간 등 익명 사용 통계 (Vercel Analytics)</li>
                <li style={liStyle}>광고 표시를 위한 쿠키 및 유사 기술 (Google AdSense)</li>
                <li style={liStyle}>브라우저 종류, 운영체제 등 기기 정보</li>
              </ul>
              <p style={pStyle}>직접 입력하는 이름, 이메일 등의 개인정보는 수집하지 않습니다.</p>
            </section>

            <section>
              <h2 style={h2Style}>3. Google AdSense 및 쿠키</h2>
              <p style={pStyle}>
                본 블로그는 Google AdSense를 통해 광고를 제공합니다.
                Google은 쿠키를 사용하여 방문자의 관심사에 맞는 광고를 표시합니다.
              </p>
              <p style={pStyle}>
                Google의 광고 쿠키 사용에 대한 자세한 내용은{" "}
                <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer" style={linkStyle}>
                  Google 광고 정책
                </a>
                을 참고하세요.
              </p>
              <p style={pStyle}>
                브라우저 설정에서 쿠키를 비활성화할 수 있으나, 일부 기능이 제한될 수 있습니다.
              </p>
            </section>

            <section>
              <h2 style={h2Style}>4. Vercel Analytics</h2>
              <p style={pStyle}>
                본 블로그는 Vercel Analytics를 사용하여 페이지 조회수 등 익명 통계를 수집합니다.
                수집된 데이터는 개인을 식별하지 않으며, 블로그 개선 목적으로만 사용됩니다.
              </p>
            </section>

            <section>
              <h2 style={h2Style}>5. 외부 링크</h2>
              <p style={pStyle}>
                본 블로그는 외부 사이트로의 링크를 포함할 수 있습니다.
                외부 사이트의 개인정보 처리방침에 대해서는 책임지지 않습니다.
              </p>
            </section>

            <section>
              <h2 style={h2Style}>6. 방침 변경</h2>
              <p style={pStyle}>
                개인정보처리방침은 필요에 따라 변경될 수 있으며, 변경 시 이 페이지에 업데이트됩니다.
              </p>
            </section>

            <section>
              <h2 style={h2Style}>7. 문의</h2>
              <p style={pStyle}>
                개인정보 관련 문의사항이 있으시면 GitHub를 통해 연락해 주세요:{" "}
                <a href="https://github.com/hyunseokyu1-netizen" target="_blank" rel="noopener noreferrer" style={linkStyle}>
                  github.com/hyunseokyu1-netizen
                </a>
              </p>
            </section>
          </>
        ) : (
          <>
            <section>
              <h2 style={h2Style}>1. Overview</h2>
              <p style={pStyle}>
                backtodev (&quot;the blog&quot;) values the privacy of its visitors.
                This Privacy Policy explains what information we collect and how we use it.
              </p>
            </section>

            <section>
              <h2 style={h2Style}>2. Information We Collect</h2>
              <p style={pStyle}>This blog may collect the following information:</p>
              <ul style={ulStyle}>
                <li style={liStyle}>Anonymous usage statistics such as pages visited and time spent (Vercel Analytics)</li>
                <li style={liStyle}>Cookies and similar technologies for serving ads (Google AdSense)</li>
                <li style={liStyle}>Device information such as browser type and operating system</li>
              </ul>
              <p style={pStyle}>We do not collect personal information such as your name or email address.</p>
            </section>

            <section>
              <h2 style={h2Style}>3. Google AdSense &amp; Cookies</h2>
              <p style={pStyle}>
                This blog uses Google AdSense to serve advertisements.
                Google uses cookies to display ads based on your interests.
              </p>
              <p style={pStyle}>
                For more information about how Google uses cookies in advertising, please visit the{" "}
                <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer" style={linkStyle}>
                  Google Advertising Policies
                </a>.
              </p>
              <p style={pStyle}>
                You may disable cookies in your browser settings, though this may limit some functionality.
              </p>
            </section>

            <section>
              <h2 style={h2Style}>4. Vercel Analytics</h2>
              <p style={pStyle}>
                This blog uses Vercel Analytics to collect anonymous statistics such as page views.
                The data collected does not identify individuals and is used solely to improve the blog.
              </p>
            </section>

            <section>
              <h2 style={h2Style}>5. External Links</h2>
              <p style={pStyle}>
                This blog may contain links to external websites.
                We are not responsible for the privacy practices of those sites.
              </p>
            </section>

            <section>
              <h2 style={h2Style}>6. Changes to This Policy</h2>
              <p style={pStyle}>
                This Privacy Policy may be updated from time to time. Any changes will be reflected on this page.
              </p>
            </section>

            <section>
              <h2 style={h2Style}>7. Contact</h2>
              <p style={pStyle}>
                If you have any questions about this Privacy Policy, please reach out via GitHub:{" "}
                <a href="https://github.com/hyunseokyu1-netizen" target="_blank" rel="noopener noreferrer" style={linkStyle}>
                  github.com/hyunseokyu1-netizen
                </a>
              </p>
            </section>
          </>
        )}
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
  marginBottom: "0.75rem",
};

const ulStyle: React.CSSProperties = {
  margin: "0.5rem 0 0.75rem 0",
  display: "flex",
  flexDirection: "column",
  gap: "0.4rem",
};

const liStyle: React.CSSProperties = {
  color: "hsl(var(--muted-foreground))",
  lineHeight: 1.8,
  paddingLeft: "1rem",
  listStyleType: "disc",
  listStylePosition: "inside",
};

const linkStyle: React.CSSProperties = {
  color: "hsl(var(--primary))",
  textDecoration: "underline",
  textUnderlineOffset: 3,
};
