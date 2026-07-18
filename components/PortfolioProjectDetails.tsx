import LightboxImage from "@/components/LightboxImage";

export interface PortfolioProject {
  name: string;
  tagline: string;
  description: string;
  tech: string[];
  links: { label: string; href: string; primary?: boolean }[];
  status: "live" | "wip";
  statusLabel: string;
  period: string;
  featured?: boolean;
  image?: { src: string; alt: string; width: number; height: number };
  screenshots?: {
    src: string;
    alt: string;
    caption: string;
    width?: number;
    height?: number;
  }[];
}

export default function PortfolioProjectDetails({
  project,
  isKo,
}: {
  project: PortfolioProject;
  isKo: boolean;
}) {
  return (
    <>
      <p
        style={{
          color: "hsl(var(--muted-foreground))",
          lineHeight: 1.85,
          fontSize: "0.9rem",
          marginBottom: "1.25rem",
          whiteSpace: "pre-line",
        }}
      >
        {project.description}
      </p>

      <div className="flex flex-wrap" style={{ gap: "0.4rem", marginBottom: "1.25rem" }}>
        {project.tech.map((tech) => (
          <span
            key={tech}
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
            {tech}
          </span>
        ))}
      </div>

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
              color: link.primary ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
              textDecoration: "none",
              fontFamily: "var(--font-mono), monospace",
              borderBottom: `1px solid ${
                link.primary ? "hsl(var(--primary) / 0.4)" : "hsl(var(--border))"
              }`,
              paddingBottom: "1px",
            }}
          >
            {link.label}
          </a>
        ))}
      </div>

      {project.image && (
        <div
          style={{
            marginTop: "1.25rem",
            borderRadius: 10,
            overflow: "hidden",
            border: "1px solid hsl(var(--border))",
          }}
        >
          <LightboxImage
            src={project.image.src}
            alt={project.image.alt}
            width={project.image.width}
            height={project.image.height}
            isKo={isKo}
          />
        </div>
      )}

      {project.screenshots && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "0.9rem",
            marginTop: "1rem",
          }}
        >
          {project.screenshots.map((screenshot) => (
            <figure
              key={screenshot.src}
              style={{
                margin: 0,
                borderRadius: 10,
                overflow: "hidden",
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--background))",
              }}
            >
              <LightboxImage
                src={screenshot.src}
                alt={screenshot.alt}
                width={screenshot.width ?? 1080}
                height={screenshot.height ?? 2340}
                caption={screenshot.caption}
                isKo={isKo}
              />
              <figcaption
                style={{
                  padding: "0.55rem 0.7rem",
                  fontSize: "0.72rem",
                  color: "hsl(var(--muted-foreground))",
                  fontFamily: "var(--font-mono), monospace",
                  textAlign: "center",
                  borderTop: "1px solid hsl(var(--border))",
                }}
              >
                {screenshot.caption}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </>
  );
}
