export function HeroBlobs() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ zIndex: 0 }}
    >
      {/* Yellow glow — top right */}
      <div
        style={{
          position: "absolute",
          top: "-80px",
          right: "-60px",
          width: "420px",
          height: "420px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, hsl(50 100% 50% / 0.13) 0%, transparent 70%)",
          filter: "blur(1px)",
        }}
      />
      {/* Blue glow — bottom left */}
      <div
        style={{
          position: "absolute",
          bottom: "-60px",
          left: "-80px",
          width: "360px",
          height: "360px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, hsl(225 100% 75% / 0.1) 0%, transparent 70%)",
          filter: "blur(1px)",
        }}
      />
      {/* Magenta glow — center right */}
      <div
        style={{
          position: "absolute",
          top: "40%",
          right: "10%",
          width: "240px",
          height: "240px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, hsl(333 100% 55% / 0.08) 0%, transparent 70%)",
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
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--yellow)", display: "block" }} />
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--blue)", display: "block" }} />
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--magenta)", display: "block" }} />
    </div>
  );
}
