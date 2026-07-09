"use client";

import { useEffect, useState } from "react";
import VillageGame, { type VillagePost } from "@/app/[locale]/village/VillageGame";
import type { GuestbookEntry } from "@/app/[locale]/village/world";

const SEEN_KEY = "pv-intro-seen";

/**
 * 홈 첫 진입 시 픽셀 마을을 전체 화면으로 보여주는 오버레이.
 * 오른쪽 위 X를 누르면 닫히고 블로그 홈이 보인다.
 * 같은 브라우저 세션에서는 다시 뜨지 않는다 (sessionStorage).
 */
export default function VillageIntroOverlay({
  locale,
  posts,
  guestbook,
}: {
  locale: string;
  posts: VillagePost[];
  guestbook: GuestbookEntry[];
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // SSR 하이드레이션 불일치 방지 — 마운트 후 세션 확인
    if (!sessionStorage.getItem(SEEN_KEY)) setOpen(true);
  }, []);

  // 오버레이가 떠 있는 동안 뒤 페이지 스크롤 잠금
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const close = () => {
    sessionStorage.setItem(SEEN_KEY, "1");
    setOpen(false);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "#0a0d08",
        overflowY: "auto",
        padding: "3.5rem 1.5rem 2rem",
      }}
    >
      {/* 닫기 버튼 — 레트로 모달과 같은 하드 섀도 스타일 */}
      <button
        onClick={close}
        aria-label={locale === "ko" ? "마을 닫기" : "Close village"}
        style={{
          position: "fixed",
          top: 18,
          right: 22,
          zIndex: 101,
          fontSize: "1rem",
          fontWeight: 700,
          lineHeight: 1,
          color: "#10140d",
          background: "#e8e4d8",
          border: "2px solid #10140d",
          padding: "0.5rem 0.75rem",
          cursor: "pointer",
          fontFamily: "var(--font-mono), monospace",
          boxShadow: "3px 3px 0 rgba(0, 0, 0, 0.6)",
        }}
      >
        X
      </button>

      <VillageGame locale={locale} posts={posts} guestbook={guestbook} />
    </div>
  );
}
