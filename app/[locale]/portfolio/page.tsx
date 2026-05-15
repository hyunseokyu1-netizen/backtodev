import { getLocale } from "next-intl/server";
import type { Metadata } from "next";
import Image from "next/image";

const BASE_URL = "https://backtodev.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isKo = locale === "ko";
  return {
    title: isKo ? "포트폴리오" : "Portfolio",
    description: isKo
      ? "직접 만든 사이드 프로젝트들"
      : "Side projects I've built",
    alternates: {
      canonical: `${BASE_URL}/${locale}/portfolio`,
      languages: {
        ko: `${BASE_URL}/ko/portfolio`,
        en: `${BASE_URL}/en/portfolio`,
      },
    },
  };
}

interface Project {
  name: string;
  tagline: string;
  description: string;
  tech: string[];
  links: { label: string; href: string; primary?: boolean }[];
  status: "live" | "wip";
  statusLabel: string;
  period: string;
  image?: string;
  screenshots?: { src: string; alt: string; caption: string }[];
}

export default async function PortfolioPage() {
  const locale = await getLocale();
  const isKo = locale === "ko";

  const projects: Project[] = isKo
    ? [
        {
          name: "TILT — The Maze Puzzle",
          tagline: "기울여서 탈출, 시각장애인도 음성만으로 완전히 플레이 가능",
          description:
            "가속도계로 스마트폰을 기울여 3×3 그리드에서 마커를 목표 칸으로 이동시키는 반응 속도 퍼즐 게임입니다. 라운드마다 타이머가 짧아져 긴장감이 높아집니다. 시각장애인을 포함한 모든 사용자가 동등하게 플레이할 수 있도록 설계했습니다. TTS 음성 안내, 남은 시간에 따라 60–180 BPM으로 변하는 메트로놈, 햅틱 피드백으로 화면 없이도 플레이 가능합니다. Supabase 실시간 글로벌 리더보드와 3단계 인터랙티브 온보딩 튜토리얼을 포함합니다.",
          tech: [
            "React Native",
            "TypeScript",
            "Expo",
            "Supabase",
            "expo-sensors",
            "expo-speech",
            "expo-audio",
            "expo-haptics",
          ],
          links: [
            { label: "→ GitHub", href: "https://github.com/hyunseokyu1-netizen/Tilt", primary: true },
          ],
          status: "live",
          statusLabel: "출시 완료",
          period: "2026.05",
          image: "/portfolio/tilt-feature.png",
          screenshots: [
            {
              src: "/portfolio/tilt-screen-menu.png",
              alt: "TILT 메인 메뉴 화면",
              caption: "메인 메뉴",
            },
            {
              src: "/portfolio/tilt-screen-gameplay.png",
              alt: "TILT 게임플레이 화면",
              caption: "게임플레이",
            },
            {
              src: "/portfolio/tilt-screen-gameover.png",
              alt: "TILT 게임오버 / 리더보드 화면",
              caption: "게임오버 / 리더보드",
            },
          ],
        },
        {
          name: "ChainPlay",
          tagline: "알고리즘이 아닌, 내가 만든 순서대로 자동 재생",
          description:
            "원하는 유튜브 영상만 골라 내 순서대로 이어 보기 위해 만든 안드로이드 앱입니다. youtube.com/watch, youtu.be, Shorts, embed URL을 붙여넣으면 플레이리스트에 추가되고, 한 영상이 끝나면 다음 영상으로 자동 이동합니다. 별도 로그인 없이 YouTube 공식 플레이어를 사용하며, 이전/다음 이동, ▲▼ 순서 변경, 개별 삭제, 로컬 저장을 지원합니다.",
          tech: [
            "React Native",
            "TypeScript",
            "Expo SDK 54",
            "react-native-youtube-iframe",
            "AsyncStorage",
            "Intl API",
          ],
          links: [
            { label: "→ GitHub", href: "https://github.com/hyunseokyu1-netizen/yt-player", primary: true },
            { label: "개인정보처리방침", href: "https://hyunseokyu1-netizen.github.io/chain-play-privacy/" },
          ],
          status: "wip",
          statusLabel: "출시 준비 중",
          period: "2026.04 ~ 2026.05",
          image: "/portfolio/chainplay-feature.png",
          screenshots: [
            {
              src: "/portfolio/chainplay-screen-ko-main.png",
              alt: "ChainPlay 메인 화면 한국어",
              caption: "메인 화면",
            },
            {
              src: "/portfolio/chainplay-screen-ko-add.png",
              alt: "ChainPlay URL 추가 화면 한국어",
              caption: "URL 추가",
            },
          ],
        },
        {
          name: "Cassette Music Player",
          tagline: "스킵 버튼 없는 레트로 카세트 뮤직 플레이어",
          description:
            "1980년대 카세트 테이프 경험을 안드로이드 폰에 옮긴 음악 플레이어입니다. 요즘 스트리밍 앱처럼 바로 스킵하지 못하고, FF 버튼을 꾹 눌러야 다음 곡으로 넘어갑니다. Side A/B에 각각 30분씩만 담을 수 있고, 트랙 사이에는 테이프 노이즈가 재생됩니다. 로컬 음악 파일만 사용하므로 인터넷과 알고리즘 없이 내가 고른 곡을 끝까지 듣는 경험에 집중했습니다.",
          tech: [
            "React Native",
            "TypeScript",
            "Expo SDK 54",
            "expo-router",
            "expo-av",
            "react-native-reanimated",
            "react-native-svg",
            "AsyncStorage",
          ],
          links: [
            {
              label: "→ Play Store",
              href: "https://play.google.com/store/apps/details?id=com.hyunseokyu.cassetteplayer",
              primary: true,
            },
            {
              label: "GitHub",
              href: "https://github.com/hyunseokyu1-netizen/cassette-music-player",
            },
          ],
          status: "live",
          statusLabel: "운영 중",
          period: "2025.05",
          image: "/portfolio/cassette-feature.png",
          screenshots: [
            {
              src: "/portfolio/cassette-screen-player-a.png",
              alt: "Cassette Music Player Side A 플레이어 화면",
              caption: "Player Side A",
            },
            {
              src: "/portfolio/cassette-screen-library.png",
              alt: "Cassette Music Player 트랙 관리 화면",
              caption: "Library",
            },
            {
              src: "/portfolio/cassette-screen-player-b.png",
              alt: "Cassette Music Player Side B 재생 화면",
              caption: "Player Side B",
            },
          ],
        },
        {
          name: "WiFi QR 코드 생성기",
          tagline: "손님한테 비밀번호 받아 적는 거 이제 그만",
          description:
            "카페, 식당, 소상공인 공간에서 손님이 WiFi 비밀번호를 직접 받아 적는 불편함을 없애기 위해 만들었습니다. SSID와 비밀번호를 입력하면 즉시 QR 코드가 생성되고, 카드 형태로 인쇄해 벽에 붙여두면 손님이 카메라로 스캔해 바로 연결할 수 있습니다. 한국어·영어·중국어·독일어 4개 언어를 지원합니다.",
          tech: ["React", "TypeScript", "Vite", "qrcode.react", "Zod", "i18n"],
          links: [
            { label: "→ wi-fi-qr.xyz", href: "https://wi-fi-qr.xyz", primary: true },
            { label: "Vercel", href: "https://wifi-qr-print-etkz434gl-hyunseokyu1-netizens-projects.vercel.app/" },
            { label: "GitHub", href: "https://github.com/hyunseokyu1-netizen/wifi-qr-print" },
            { label: "개발 이야기", href: "/ko/posts/adsense_content_expansion_20260505" },
          ],
          status: "live",
          statusLabel: "운영 중",
          period: "2026.05",
          image: "/portfolio/wifi-qr-preview.png",
        },
      ]
    : [
        {
          name: "TILT — The Maze Puzzle",
          tagline: "Tilt to escape — fully playable by blind users via voice alone",
          description:
            "A reaction-speed puzzle game where you tilt your phone to move a marker across a 3×3 grid to the target cell. The timer shortens each round, keeping pressure constant. Designed from the ground up for equal access: TTS announces your position and target each round, a metronome shifts from 60 to 180 BPM as time runs out, and haptic feedback marks every move and collision — so the game is fully playable without looking at the screen. Includes a real-time Supabase global leaderboard and a 3-step interactive onboarding tutorial.",
          tech: [
            "React Native",
            "TypeScript",
            "Expo",
            "Supabase",
            "expo-sensors",
            "expo-speech",
            "expo-audio",
            "expo-haptics",
          ],
          links: [
            { label: "→ GitHub", href: "https://github.com/hyunseokyu1-netizen/Tilt", primary: true },
          ],
          status: "live",
          statusLabel: "Released",
          period: "May 2026",
          image: "/portfolio/tilt-feature.png",
          screenshots: [
            {
              src: "/portfolio/tilt-screen-menu.png",
              alt: "TILT main menu screen",
              caption: "Main menu",
            },
            {
              src: "/portfolio/tilt-screen-gameplay.png",
              alt: "TILT gameplay screen",
              caption: "Gameplay",
            },
            {
              src: "/portfolio/tilt-screen-gameover.png",
              alt: "TILT game over and leaderboard screen",
              caption: "Game Over / Leaderboard",
            },
          ],
        },
        {
          name: "ChainPlay",
          tagline: "Autoplay YouTube videos in the order you choose",
          description:
            "An Android app for watching only the YouTube videos you picked, in your own sequence. Paste youtube.com/watch, youtu.be, Shorts, or embed URLs to add videos to a local playlist, then ChainPlay automatically moves to the next item when one ends. It uses the official YouTube player without login and supports previous/next controls, ▲▼ reordering, deleting videos, local persistence, and Korean/English auto-detection.",
          tech: [
            "React Native",
            "TypeScript",
            "Expo SDK 54",
            "react-native-youtube-iframe",
            "AsyncStorage",
            "Intl API",
          ],
          links: [
            { label: "→ GitHub", href: "https://github.com/hyunseokyu1-netizen/yt-player", primary: true },
            { label: "Privacy Policy", href: "https://hyunseokyu1-netizen.github.io/chain-play-privacy/" },
          ],
          status: "wip",
          statusLabel: "Coming to Play Store",
          period: "Apr ~ May 2026",
          image: "/portfolio/chainplay-feature.png",
          screenshots: [
            {
              src: "/portfolio/chainplay-screen-en-main.png",
              alt: "ChainPlay main screen in English",
              caption: "Main screen",
            },
            {
              src: "/portfolio/chainplay-screen-en-add.png",
              alt: "ChainPlay add URL screen in English",
              caption: "Add URL",
            },
          ],
        },
        {
          name: "Cassette Music Player",
          tagline: "A retro cassette music player with no skip button",
          description:
            "An Android music player that brings the 1980s cassette tape experience to a modern phone. Instead of instant skipping, you have to press and hold FF to move to the next track. Each cassette has Side A and Side B with a 30-minute limit per side, and tape noise plays between tracks. It uses local music files only, with no internet and no algorithm, so the experience stays focused on the songs you chose.",
          tech: [
            "React Native",
            "TypeScript",
            "Expo SDK 54",
            "expo-router",
            "expo-av",
            "react-native-reanimated",
            "react-native-svg",
            "AsyncStorage",
          ],
          links: [
            {
              label: "→ Play Store",
              href: "https://play.google.com/store/apps/details?id=com.hyunseokyu.cassetteplayer",
              primary: true,
            },
            {
              label: "GitHub",
              href: "https://github.com/hyunseokyu1-netizen/cassette-music-player",
            },
          ],
          status: "live",
          statusLabel: "Live",
          period: "May 2025",
          image: "/portfolio/cassette-feature.png",
          screenshots: [
            {
              src: "/portfolio/cassette-screen-player-a.png",
              alt: "Cassette Music Player Side A player screen",
              caption: "Player Side A",
            },
            {
              src: "/portfolio/cassette-screen-library.png",
              alt: "Cassette Music Player library screen",
              caption: "Library",
            },
            {
              src: "/portfolio/cassette-screen-player-b.png",
              alt: "Cassette Music Player Side B playing screen",
              caption: "Player Side B",
            },
          ],
        },
        {
          name: "WiFi QR Code Generator",
          tagline: "No more reading out WiFi passwords to guests",
          description:
            "Built to eliminate the awkward WiFi password exchange at cafés, restaurants, and small businesses. Enter your SSID and password, get a QR code instantly. Print it as a card, stick it on the wall — guests scan with their camera and connect. Supports Korean, English, Chinese, and German.",
          tech: ["React", "TypeScript", "Vite", "qrcode.react", "Zod", "i18n"],
          links: [
            { label: "→ wi-fi-qr.xyz", href: "https://wi-fi-qr.xyz", primary: true },
            { label: "Vercel", href: "https://wifi-qr-print-etkz434gl-hyunseokyu1-netizens-projects.vercel.app/" },
            { label: "GitHub", href: "https://github.com/hyunseokyu1-netizen/wifi-qr-print" },
            { label: "Dev story", href: "/en/posts/adsense_content_expansion_20260505" },
          ],
          status: "live",
          statusLabel: "Live",
          period: "May 2026",
          image: "/portfolio/wifi-qr-preview.png",
        },
      ];

  return (
    <div style={{ maxWidth: "52rem" }}>
      {/* Page header */}
      <div style={{ marginBottom: "3rem" }}>
        <h1
          style={{
            fontSize: "clamp(1.6rem, 3.5vw, 2.25rem)",
            fontWeight: 700,
            letterSpacing: "-0.04em",
            color: "hsl(var(--foreground))",
            marginBottom: "0.75rem",
            lineHeight: 1.2,
          }}
        >
          {isKo ? "직접 만든 것들" : "Things I've built"}
        </h1>
        <p style={{ color: "hsl(var(--muted-foreground))", lineHeight: 1.8 }}>
          {isKo
            ? "글로만 배우지 않고, 직접 만들어보는 것들을 여기에 기록합니다."
            : "Not just learning by reading — shipping things and logging them here."}
        </p>
      </div>

      {/* Project cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {projects.map((project) => (
          <article
            key={project.name}
            style={{
              borderRadius: 20,
              padding: "1.75rem",
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              position: "relative",
            }}
          >
            {/* Top row: name + status */}
            <div
              className="flex items-start justify-between"
              style={{ marginBottom: "0.75rem", gap: "1rem" }}
            >
              <div>
                <h2
                  style={{
                    fontSize: "1.15rem",
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    color: "hsl(var(--foreground))",
                    marginBottom: "0.2rem",
                  }}
                >
                  {project.name}
                </h2>
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
              <div className="flex items-center gap-2 shrink-0">
                <span
                  style={{
                    fontSize: "0.7rem",
                    padding: "0.25rem 0.6rem",
                    borderRadius: 99,
                    fontWeight: 700,
                    fontFamily: "var(--font-mono), monospace",
                    background:
                      project.status === "live"
                        ? "hsl(160 40% 12%)"
                        : "hsl(40 40% 12%)",
                    color:
                      project.status === "live"
                        ? "hsl(160 70% 55%)"
                        : "hsl(40 90% 60%)",
                    border: `1px solid ${
                      project.status === "live"
                        ? "hsl(160 40% 22%)"
                        : "hsl(40 40% 24%)"
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
                  }}
                >
                  {project.period}
                </span>
              </div>
            </div>

            {/* Description */}
            <p
              style={{
                color: "hsl(var(--muted-foreground))",
                lineHeight: 1.85,
                fontSize: "0.9rem",
                marginBottom: "1.25rem",
              }}
            >
              {project.description}
            </p>

            {/* Tech tags */}
            <div
              className="flex flex-wrap"
              style={{ gap: "0.4rem", marginBottom: "1.25rem" }}
            >
              {project.tech.map((t) => (
                <span
                  key={t}
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
                  {t}
                </span>
              ))}
            </div>

            {/* Links */}
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
                    color: link.primary
                      ? "hsl(var(--primary))"
                      : "hsl(var(--muted-foreground))",
                    textDecoration: "none",
                    fontFamily: "var(--font-mono), monospace",
                    borderBottom: `1px solid ${
                      link.primary
                        ? "hsl(var(--primary) / 0.4)"
                        : "hsl(var(--border))"
                    }`,
                    paddingBottom: "1px",
                  }}
                >
                  {link.label}
                </a>
              ))}
            </div>

            {/* Preview image */}
            {project.image && (
              <a
                href={project.links.find((l) => l.primary)?.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block",
                  marginTop: "1.25rem",
                  borderRadius: 10,
                  overflow: "hidden",
                  border: "1px solid hsl(var(--border))",
                }}
              >
                <Image
                  src={project.image}
                  alt={project.name}
                  width={1280}
                  height={800}
                  style={{
                    width: "100%",
                    height: "auto",
                    display: "block",
                  }}
                  priority
                />
              </a>
            )}

            {/* Screenshots */}
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
                    <Image
                      src={screenshot.src}
                      alt={screenshot.alt}
                      width={1080}
                      height={2340}
                      style={{
                        width: "100%",
                        height: "auto",
                        display: "block",
                      }}
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
          </article>
        ))}
      </div>

      {/* Footer note */}
      <p
        style={{
          marginTop: "2.5rem",
          fontSize: "0.82rem",
          color: "hsl(var(--muted-foreground) / 0.6)",
          fontFamily: "var(--font-mono), monospace",
          textAlign: "center",
        }}
      >
        {isKo ? "// 계속 추가 중입니다." : "// more coming soon."}
      </p>
    </div>
  );
}
