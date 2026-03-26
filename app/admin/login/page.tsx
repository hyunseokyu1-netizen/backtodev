"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/admin");
    } else {
      const data = await res.json();
      setError(data.error ?? "로그인 실패");
    }
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div
        className="w-full max-w-sm p-8 rounded-2xl"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="mb-8 text-center">
          <span
            className="text-2xl font-black"
            style={{ color: "var(--yellow)", letterSpacing: "-0.04em" }}
          >
            backtodev
          </span>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            관리자 로그인
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            required
            autoFocus
            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
          />

          {error && (
            <p className="text-sm" style={{ color: "hsl(340 95% 60%)" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-60"
            style={{
              background: "var(--yellow)",
              color: "hsl(210 15% 6%)",
            }}
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}
