export function HeroBlobs() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ zIndex: 0 }}
    >
      {/* Teal glow — top right */}
      <div
        style={{
          position: "absolute",
          top: "-80px",
          right: "-60px",
          width: "420px",
          height: "420px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(0,255,198,0.08) 0%, transparent 70%)",
          filter: "blur(1px)",
        }}
      />
      {/* Teal glow — bottom left */}
      <div
        style={{
          position: "absolute",
          bottom: "-60px",
          left: "-80px",
          width: "360px",
          height: "360px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(0,255,198,0.05) 0%, transparent 70%)",
          filter: "blur(1px)",
        }}
      />
    </div>
  );
}

export function WaveDivider({ flip = false }: { flip?: boolean }) {
  return (
    <div
      aria-hidden
      style={{
        transform: flip ? "scaleX(-1)" : undefined,
        lineHeight: 0,
        overflow: "hidden",
        margin: "0 -2rem",
      }}
    >
      <svg
        viewBox="0 0 1200 80"
        preserveAspectRatio="none"
        style={{ display: "block", width: "100%", height: "40px" }}
      >
        <path
          d="M0,40 C200,80 400,0 600,40 C800,80 1000,0 1200,40 L1200,80 L0,80 Z"
          fill="hsl(213 40% 12%)"
        />
      </svg>
    </div>
  );
}

export function SectionDots() {
  return (
    <div
      aria-hidden
      className="flex gap-1.5 mb-3"
    >
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--cyan)", display: "block" }} />
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--cyan)", opacity: 0.5, display: "block" }} />
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--cyan)", opacity: 0.25, display: "block" }} />
    </div>
  );
}
