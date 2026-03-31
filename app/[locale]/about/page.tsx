import { getLocale, getTranslations } from "next-intl/server";

export default async function AboutPage() {
  const t = await getTranslations("about");
  const locale = await getLocale();
  const isKo = locale === "ko";

  const stack = [
    { icon: ">_", label: "TypeScript / Node.js", color: "hsl(var(--primary))" },
    { icon: "</>", label: "React / Next.js", color: "hsl(var(--primary))" },
    { icon: "⊕", label: "AI Agents / LLMs", color: "hsl(var(--primary))" },
    { icon: "☕", label: "Lots of Caffeine", color: "hsl(var(--primary))" },
  ];

  const sections = isKo ? [
    {
      title: "왜 다시 시작했는가",
      content: [
        "좋은 제품이 무엇인지 아는 것과\n그걸 직접 만드는 것은 다르다고 느꼈습니다.",
        "그래서 선택했습니다.\n\n다시 배우는 길을.",
        "늦은 시작일 수도 있지만,\n지금이 가장 빠른 타이밍이라고 생각합니다.",
      ],
    },
    {
      title: "이 블로그에 대해",
      content: ["이곳은 저의 기록입니다."],
      list: ["만들고 있는 것", "실패한 것", "그 과정에서 배운 것들"],
      footer: "정리되지 않은 글도 많고, 완벽하지도 않습니다.\n\n하지만 전부 실제 경험입니다.",
    },
    {
      title: "지금의 방식",
      content: [
        "혼자 개발하지 않습니다.",
        "AI와 함께 배우고,\nAI와 함께 만들고 있습니다.",
        "속도를 높이기 위해서가 아니라,\n더 깊이 이해하기 위해서입니다.",
      ],
    },
    {
      title: "현재 집중하고 있는 것",
      list: ["개발 기초 다시 쌓기", "작은 프로젝트 직접 만들기", "AI 기반 개발 방식 실험", "꾸준히 기록하기"],
    },
    {
      title: "이 글을 보는 분들에게",
      content: [
        "혹시 지금 다시 시작하려고 한다면,",
        "늦은 게 아닙니다.\n단지 다른 타임라인에 있을 뿐입니다.",
      ],
    },
    {
      title: "링크",
      links: [
        { label: "GitHub", href: "https://github.com/hyunseokyu1-netizen" },
        { label: "블로그", href: "https://backtodev.com" },
      ],
    },
  ] : [
    {
      title: "Why I started over",
      content: [
        "After years as a product manager, I realized something:\n\nI understood what makes good products —\nbut I wasn't building them myself.",
        "So I decided to go back.\n\nBack to code.\nBack to fundamentals.\nBack to being uncomfortable again.",
      ],
    },
    {
      title: "What this blog is",
      content: ["This is my learning log.\n\nI document:"],
      list: ["What I build", "What breaks", "What I learn (sometimes the hard way)"],
      footer: "Most of it is messy.\nSome of it works.\n\nBut all of it is real.",
    },
    {
      title: "How I'm building now",
      content: [
        "I'm not doing it alone.",
        "I'm learning and building with AI —\nusing it as a tool, not a shortcut.",
        "The goal isn't to move fast.\nThe goal is to understand deeply.",
      ],
    },
    {
      title: "Current focus",
      list: [
        "Rebuilding development fundamentals",
        "Shipping small, real projects",
        "Exploring AI-assisted development",
        "Writing consistently",
      ],
    },
    {
      title: "A note to readers",
      content: [
        "If you're also starting over —\nor thinking about it —",
        "you're not late.\n\nYou're just early in a different timeline.",
      ],
    },
    {
      title: "Links",
      links: [
        { label: "GitHub", href: "https://github.com/hyunseokyu1-netizen" },
        { label: "Blog", href: "https://backtodev.com" },
      ],
    },
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
          <div style={{ position: "relative" }}>
            <img
              src="https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/avatar-004.png"
              alt="profile"
              style={{ width: "100%", display: "block", objectFit: "cover" }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: 80,
                background: "linear-gradient(to top, hsl(var(--card)), transparent)",
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
            border: "1px solid rgba(255,255,255,0.05)",
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

        {/* Hero heading */}
        <h1
          style={{
            fontSize: "clamp(1.6rem, 3.5vw, 2.25rem)",
            fontWeight: 700,
            letterSpacing: "-0.04em",
            color: "hsl(var(--foreground))",
            marginBottom: "2rem",
            lineHeight: 1.3,
          }}
        >
          {isKo ? "40대 PM, 다시 코드를 시작합니다." : "A 40-something PM returns to code."}
        </h1>

        {/* Intro */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2.5rem" }}>
          {isKo ? (
            <>
              <p style={{ color: "hsl(var(--muted-foreground))", lineHeight: 1.9 }}>
                기획자로 오랜 시간 제품을 만들어 왔습니다.<br />
                문제를 정의하고, 우선순위를 정하고, 결과를 만들어내는 일.
              </p>
              <p style={{ color: "hsl(var(--muted-foreground))", lineHeight: 1.9 }}>
                하지만 어느 순간 깨달았습니다.
              </p>
              <p style={{ color: "hsl(var(--muted-foreground))", lineHeight: 1.9 }}>
                나는 제품을 이해하고 있었지만,<br />
                직접 만들고 있지는 않았다는 것을.
              </p>
              <p style={{ color: "hsl(var(--muted-foreground))", lineHeight: 1.9 }}>
                그래서 다시 돌아왔습니다.
              </p>
              <p style={{ color: "hsl(var(--foreground))", fontWeight: 600, lineHeight: 2 }}>
                코드로.<br />
                기본으로.<br />
                불편함으로.
              </p>
              <p style={{ color: "hsl(var(--muted-foreground))", lineHeight: 1.9 }}>
                이건 성공 이야기가 아닙니다.<br />
                <span style={{ color: "hsl(var(--primary))" }}>진행 중인 이야기입니다.</span>
              </p>
            </>
          ) : (
            <>
              <p style={{ color: "hsl(var(--muted-foreground))", lineHeight: 1.9 }}>
                I spent years building products from the outside —<br />
                planning, prioritizing, and shipping.
              </p>
              <p style={{ color: "hsl(var(--muted-foreground))", lineHeight: 1.9 }}>
                Now, I&apos;m learning to build them from the inside.
              </p>
              <p style={{ color: "hsl(var(--muted-foreground))", lineHeight: 1.9 }}>
                Not as a beginner,<br />
                but not as an expert either.
              </p>
              <p style={{ color: "hsl(var(--muted-foreground))", lineHeight: 1.9 }}>
                This is not a success story.<br />
                <span style={{ color: "hsl(var(--primary))" }}>It&apos;s a work in progress.</span>
              </p>
            </>
          )}
        </div>

        {/* Dynamic sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
          {sections.map((section) => (
            <div key={section.title}>
              <div
                style={{
                  width: "100%",
                  height: 1,
                  background: "hsl(var(--border))",
                  marginBottom: "1.5rem",
                }}
              />
              <h2
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  color: "hsl(var(--foreground))",
                  marginBottom: "1rem",
                }}
              >
                {section.title}
              </h2>

              {section.content && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: section.list ? "1rem" : 0 }}>
                  {section.content.map((para, i) => (
                    <p key={i} style={{ color: "hsl(var(--muted-foreground))", lineHeight: 1.9, whiteSpace: "pre-line" }}>
                      {para}
                    </p>
                  ))}
                </div>
              )}

              {section.list && (
                <ul style={{ display: "flex", flexDirection: "column", gap: "0.5rem", margin: "0.5rem 0" }}>
                  {section.list.map((item) => (
                    <li
                      key={item}
                      className="flex items-center"
                      style={{ gap: "0.75rem", color: "hsl(var(--muted-foreground))", lineHeight: 1.7 }}
                    >
                      <span style={{ color: "hsl(var(--primary))", fontFamily: "var(--font-mono), monospace", fontSize: "0.75rem" }}>→</span>
                      {item}
                    </li>
                  ))}
                </ul>
              )}

              {"footer" in section && section.footer && (
                <p style={{ color: "hsl(var(--muted-foreground))", lineHeight: 1.9, whiteSpace: "pre-line", marginTop: "0.75rem" }}>
                  {section.footer}
                </p>
              )}

              {"links" in section && section.links && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {section.links.map(({ label, href }) => (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center"
                      style={{ gap: "0.5rem", color: "hsl(var(--primary))", fontSize: "0.9rem", textDecoration: "none" }}
                    >
                      <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.75rem" }}>→</span>
                      {label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
