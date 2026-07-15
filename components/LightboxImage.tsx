"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";

interface Props {
  src: string;
  alt: string;
  width: number;
  height: number;
  caption?: string;
  priority?: boolean;
  isKo?: boolean;
}

/** 클릭하면 페이지 위 오버레이로 원본 크기에 가깝게 보여주는 썸네일 이미지 */
export default function LightboxImage({ src, alt, width, height, caption, priority, isKo = true }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={isKo ? `${alt} 크게 보기` : `View larger: ${alt}`}
        style={{
          display: "block",
          width: "100%",
          padding: 0,
          border: "none",
          background: "none",
          cursor: "zoom-in",
        }}
      >
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          style={{ width: "100%", height: "auto", display: "block" }}
          priority={priority}
        />
      </button>

      {open &&
        createPortal(
          <div
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 200,
              background: "rgba(6, 8, 5, 0.92)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "3rem 1.25rem",
              cursor: "zoom-out",
            }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
              aria-label={isKo ? "닫기" : "Close"}
              style={{
                position: "fixed",
                top: 18,
                right: 22,
                zIndex: 201,
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

            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.75rem",
                maxWidth: "94vw",
                maxHeight: "90vh",
              }}
            >
              {/* 원본 비율 유지가 우선이라 next/image 대신 일반 img 사용 */}
              <img
                src={src}
                alt={alt}
                style={{
                  maxWidth: "94vw",
                  maxHeight: caption ? "78vh" : "90vh",
                  width: "auto",
                  height: "auto",
                  objectFit: "contain",
                  borderRadius: 8,
                  border: "1px solid rgba(232, 228, 216, 0.25)",
                  cursor: "default",
                }}
              />
              {caption && (
                <span
                  style={{
                    color: "#e8e4d8",
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: "0.8rem",
                    textAlign: "center",
                  }}
                >
                  {caption}
                </span>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
