export default function OpenGraphImage() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        background: "#0a0f14",
        color: "#e5e7eb",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", color: "#00ffc6", fontSize: 30 }}>
        <span style={{ marginRight: 16 }}>&gt;_</span>
        <span>backtodev</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 78, fontWeight: 700, letterSpacing: "-3px", lineHeight: 1.05 }}>
          Build. Ship. Learn.
        </div>
        <div style={{ marginTop: 24, color: "#9ca3af", fontSize: 32 }}>
          Product thinking × AI-assisted development
        </div>
      </div>
      <div style={{ display: "flex", color: "#00ffc6", fontSize: 24 }}>
        git checkout -b comeback
      </div>
    </div>
  );
}
