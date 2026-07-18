"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PortfolioProjectDetails, {
  type PortfolioProject,
} from "@/components/PortfolioProjectDetails";

interface Props {
  projects: PortfolioProject[];
  isKo: boolean;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export default function ExpandableProjectList({ projects, isKo }: Props) {
  const [selected, setSelected] = useState<PortfolioProject | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!selected) return;

    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      const dialog = dialogRef.current;
      if (!dialog || !dialog.contains(document.activeElement)) return;

      if (event.key === "Escape") {
        event.preventDefault();
        setSelected(null);
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [selected]);

  const openProject = (
    project: PortfolioProject,
    trigger: HTMLButtonElement
  ) => {
    triggerRef.current = trigger;
    setSelected(project);
  };

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
        {projects.map((project) => {
          const imageCount = (project.image ? 1 : 0) + (project.screenshots?.length ?? 0);

          return (
            <article
              key={project.name}
              className="more-project-card"
              style={{
                borderRadius: 20,
                padding: "1.25rem 1.5rem",
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
              }}
            >
              <div
                className="flex flex-col sm:flex-row sm:items-start sm:justify-between"
                style={{ gap: "0.5rem" }}
              >
                <div>
                  <h3
                    style={{
                      fontSize: "1.05rem",
                      fontWeight: 700,
                      letterSpacing: "-0.02em",
                      color: "hsl(var(--foreground))",
                      marginBottom: "0.2rem",
                    }}
                  >
                    {project.name}
                  </h3>
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

                <div className="flex items-center gap-2 flex-wrap sm:shrink-0">
                  <span
                    style={{
                      fontSize: "0.7rem",
                      padding: "0.25rem 0.6rem",
                      borderRadius: 99,
                      fontWeight: 700,
                      fontFamily: "var(--font-mono), monospace",
                      whiteSpace: "nowrap",
                      background: project.status === "live" ? "hsl(160 40% 12%)" : "hsl(40 40% 12%)",
                      color: project.status === "live" ? "hsl(160 70% 55%)" : "hsl(40 90% 60%)",
                      border: `1px solid ${
                        project.status === "live" ? "hsl(160 40% 22%)" : "hsl(40 40% 24%)"
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
                      whiteSpace: "nowrap",
                    }}
                  >
                    {project.period}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap" style={{ gap: "0.35rem", marginTop: "0.9rem" }}>
                {project.tech.slice(0, 6).map((tech) => (
                  <span
                    key={tech}
                    style={{
                      fontSize: "0.68rem",
                      padding: "0.16rem 0.5rem",
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

              <div
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between"
                style={{ gap: "0.9rem", marginTop: "1rem" }}
              >
                <div className="flex items-center flex-wrap" style={{ gap: "0.75rem" }}>
                  {project.links.map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      target={link.href.startsWith("http") ? "_blank" : undefined}
                      rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
                      style={{
                        color: link.primary ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                        fontFamily: "var(--font-mono), monospace",
                        fontSize: "0.75rem",
                        textDecoration: "underline",
                        textUnderlineOffset: 3,
                      }}
                    >
                      {link.label}
                    </a>
                  ))}
                </div>

                <button
                  type="button"
                  className="project-detail-button"
                  onClick={(event) => openProject(project, event.currentTarget)}
                  aria-haspopup="dialog"
                  style={{
                    alignSelf: "flex-start",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.45rem",
                    borderRadius: 8,
                    border: "1px solid hsl(var(--primary) / 0.45)",
                    background: "hsl(var(--primary) / 0.08)",
                    color: "hsl(var(--primary))",
                    padding: "0.45rem 0.7rem",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    fontFamily: "var(--font-mono), monospace",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {isKo ? "자세히 보기" : "View details"}
                  {imageCount > 0 && (
                    <span style={{ color: "hsl(var(--muted-foreground))", fontWeight: 500 }}>
                      {isKo ? `사진 ${imageCount}` : `${imageCount} images`}
                    </span>
                  )}
                  <span aria-hidden="true">↗</span>
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {selected &&
        createPortal(
          <div
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setSelected(null);
            }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 150,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "clamp(0.75rem, 3vw, 2rem)",
              background: "hsl(213 45% 4% / 0.88)",
              backdropFilter: "blur(10px)",
            }}
          >
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="portfolio-dialog-title"
              style={{
                width: "min(58rem, 100%)",
                maxHeight: "calc(100dvh - clamp(1.5rem, 6vw, 4rem))",
                overflowY: "auto",
                borderRadius: 18,
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--primary) / 0.32)",
                boxShadow: "0 24px 80px hsl(210 60% 2% / 0.7)",
              }}
            >
              <div
                className="flex items-start justify-between"
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 2,
                  gap: "1rem",
                  padding: "1.25rem clamp(1.1rem, 3vw, 1.75rem)",
                  background: "hsl(var(--card) / 0.96)",
                  borderBottom: "1px solid hsl(var(--border))",
                  backdropFilter: "blur(14px)",
                }}
              >
                <div>
                  <span
                    style={{
                      display: "block",
                      marginBottom: "0.3rem",
                      color: "hsl(var(--primary))",
                      fontFamily: "var(--font-mono), monospace",
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                    }}
                  >
                    {isKo ? "프로젝트 상세" : "PROJECT DETAILS"}
                  </span>
                  <h2
                    id="portfolio-dialog-title"
                    style={{
                      color: "hsl(var(--foreground))",
                      fontSize: "clamp(1.2rem, 3vw, 1.6rem)",
                      fontWeight: 800,
                      letterSpacing: "-0.03em",
                    }}
                  >
                    {selected.name}
                  </h2>
                  <p
                    style={{
                      marginTop: "0.25rem",
                      color: "hsl(var(--primary))",
                      fontFamily: "var(--font-mono), monospace",
                      fontSize: "0.78rem",
                    }}
                  >
                    {selected.tagline}
                  </p>
                </div>

                <button
                  ref={closeRef}
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label={isKo ? "프로젝트 상세 닫기" : "Close project details"}
                  style={{
                    flexShrink: 0,
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--background))",
                    color: "hsl(var(--foreground))",
                    fontSize: "1rem",
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </div>

              <div style={{ padding: "1.5rem clamp(1.1rem, 3vw, 1.75rem) 1.75rem" }}>
                <PortfolioProjectDetails project={selected} isKo={isKo} />
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
