import { getTranslations } from "next-intl/server";

export default async function AboutPage() {
  const t = await getTranslations("about");

  const stack = [
    { icon: ">_", label: "TypeScript / Node.js", color: "hsl(var(--primary))" },
    { icon: "</>", label: "React / Next.js", color: "#3b82f6" },
    { icon: "⊕", label: "AI Agents / LLMs", color: "#a855f7" },
    { icon: "☕", label: "Lots of Caffeine", color: "#f97316" },
  ];

  return (
    <div className="flex flex-col md:flex-row items-start" style={{ gap: "3rem", maxWidth: "56rem" }}>

      {/* ── Left column ── */}
      <div className="flex flex-col" style={{ gap: "1rem", width: "100%", maxWidth: 280, flexShrink: 0 }}>

        {/* Profile card */}
        <div
          style={{
            borderRadius: 20,
            overflow: "hidden",
            border: "1px solid hsl(var(--border))",
          }}
        >
          <div
            style={{
              position: "relative",
              height: 260,
              background: "linear-gradient(135deg, hsl(240 10% 8%) 0%, hsl(225 20% 12%) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 110,
                height: 110,
                borderRadius: "50%",
                background: "linear-gradient(135deg, hsl(175 80% 20% / 0.4), hsl(217 91% 30% / 0.4))",
                border: "2px solid hsl(var(--border))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "2rem",
                fontWeight: 700,
                color: "hsl(var(--primary))",
                fontFamily: "var(--font-mono), monospace",
              }}
            >
              PM
            </div>
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: 80,
                background: "linear-gradient(to top, hsl(240 10% 6%), transparent)",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 16,
                left: 20,
                fontFamily: "var(--font-mono), monospace",
                fontSize: "0.875rem",
                fontWeight: 700,
                color: "hsl(var(--primary))",
              }}
            >
              &gt; whoami
            </div>
          </div>
        </div>

        {/* Tech stack card */}
        <div
          style={{
            borderRadius: 16,
            padding: "1.25rem",
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "hsl(var(--muted-foreground))",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: "1rem",
            }}
          >
            {t("techStack")}
          </p>
          <ul style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {stack.map(({ icon, label, color }) => (
              <li key={label} className="flex items-center" style={{ gap: "0.75rem", fontSize: "0.875rem" }}>
                <span
                  style={{
                    color,
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: "0.8rem",
                    width: 24,
                    flexShrink: 0,
                  }}
                >
                  {icon}
                </span>
                <span style={{ color: "hsl(var(--foreground) / 0.85)" }}>{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Right column ── */}
      <div style={{ flex: 1, paddingTop: "0.5rem" }}>
        <h1
          style={{
            fontSize: "clamp(2rem, 4vw, 2.75rem)",
            fontWeight: 700,
            letterSpacing: "-0.04em",
            color: "hsl(var(--foreground))",
            marginBottom: "0.5rem",
          }}
        >
          {t("hello")}
        </h1>
        <p
          style={{
            fontSize: "1rem",
            color: "hsl(var(--primary))",
            fontFamily: "var(--font-mono), monospace",
            marginBottom: "2.5rem",
          }}
        >
          {t("tagline")}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <p style={{ color: "hsl(var(--muted-foreground))", lineHeight: 1.8 }}>
            {t("para1")}
          </p>
          <p style={{ color: "hsl(var(--muted-foreground))", lineHeight: 1.8 }}>
            {t.rich("para2", {
              strong: (chunks) => (
                <strong style={{ color: "hsl(var(--foreground))" }}>{chunks}</strong>
              ),
            })}
          </p>
        </div>

        <div style={{ marginTop: "3rem" }}>
          <h2
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "hsl(var(--foreground))",
              marginBottom: "1rem",
            }}
          >
            {t("whyTitle")}
          </h2>
          <p style={{ color: "hsl(var(--muted-foreground))", lineHeight: 1.8 }}>
            {t("whyContent")}
          </p>
        </div>
      </div>
    </div>
  );
}
