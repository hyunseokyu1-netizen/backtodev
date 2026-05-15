"use client";

import { useRouter } from "next/navigation";

export default function BackButton({ label = "← cd .." }: { label?: string }) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className="inline-flex items-center gap-2 text-sm transition-colors"
      style={{
        color: "hsl(var(--muted-foreground))",
        fontFamily: "var(--font-mono), monospace",
        marginBottom: "2.5rem",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
      }}
    >
      {label}
    </button>
  );
}
