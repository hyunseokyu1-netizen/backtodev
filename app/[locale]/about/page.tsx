import { getTranslations } from "next-intl/server";
import { SectionDots } from "@/components/DecorativeBlobs";

export default async function AboutPage() {
  const t = await getTranslations("about");
  const blogItems = t.raw("blogItems") as string[];

  const stack = [
    { name: "Next.js 15", color: "var(--text)" },
    { name: "TypeScript", color: "var(--blue)" },
    { name: "Tailwind CSS", color: "var(--green)" },
    { name: "MDX / Markdown", color: "var(--yellow)" },
    { name: "next-intl", color: "var(--magenta)" },
  ];

  return (
    <div style={{ maxWidth: "60ch" }}>
      <SectionDots />
      <h1
        className="font-black mb-3"
        style={{
          fontSize: "clamp(2rem, 5vw, 3rem)",
          letterSpacing: "-0.04em",
          color: "hsl(210 10% 95%)",
        }}
      >
        {t("title")}
      </h1>
      <p className="text-lg mb-12" style={{ color: "hsl(210 10% 65%)" }}>
        {t("intro")}
      </p>

      {/* Blog section */}
      <section className="mb-10">
        <h2
          className="font-bold text-base mb-4"
          style={{ color: "var(--yellow)", letterSpacing: "0.05em", textTransform: "uppercase", fontSize: "0.8rem" }}
        >
          {t("blogTitle")}
        </h2>
        <ul className="space-y-3">
          {blogItems.map((item, i) => (
            <li key={i} className="flex items-start gap-3">
              <span style={{ color: "var(--yellow)", marginTop: 2, flexShrink: 0 }}>✦</span>
              <span style={{ color: "hsl(210 10% 75%)" }}>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Stack section */}
      <section>
        <h2
          className="font-bold mb-4"
          style={{ color: "var(--yellow)", letterSpacing: "0.05em", textTransform: "uppercase", fontSize: "0.8rem" }}
        >
          {t("stackTitle")}
        </h2>
        <div className="flex flex-wrap gap-2">
          {stack.map(({ name, color }) => (
            <span
              key={name}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color,
              }}
            >
              {name}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
