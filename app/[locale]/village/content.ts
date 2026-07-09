// ─────────────────────────────────────────────
// 우리 집(프로필) / 공방(포트폴리오) 모달 콘텐츠
// 원본: app/[locale]/about/page.tsx, app/[locale]/portfolio/page.tsx 요약본
// href가 "/"로 시작하면 내부 링크 — 렌더링 시 locale 접두사를 붙임
// ─────────────────────────────────────────────

export interface ProfileContent {
  title: string;
  intro: string[];
  stackNow: string[];
  stackPast: string[];
  focus: string[];
  links: { label: string; href: string }[];
}

export function getProfile(isKo: boolean): ProfileContent {
  return isKo
    ? {
        title: "40대 PM, 다시 코드를 시작합니다.",
        intro: [
          "기획자로 오랜 시간 제품을 만들어 왔지만, 직접 만들고 있지는 않았습니다.",
          "그래서 다시 돌아왔습니다 — 코드로, 기본으로, 불편함으로.",
          "이건 성공 이야기가 아니라 진행 중인 이야기입니다.",
        ],
        stackNow: [
          "TypeScript / Node.js",
          "React / Next.js",
          "React Native / Expo",
          "Supabase / Vercel",
          "AI Agents / LLMs",
        ],
        stackPast: ["Java / Oracle", "Angular", "아키텍처 설계", "전략 / 기획"],
        focus: [
          "개발 기초 다시 쌓기",
          "작은 프로젝트 직접 만들기",
          "AI 기반 개발 방식 실험",
          "꾸준히 기록하기",
        ],
        links: [
          { label: "About 전체 보기", href: "/about" },
          { label: "GitHub", href: "https://github.com/hyunseokyu1-netizen" },
        ],
      }
    : {
        title: "A 40-something PM returns to code.",
        intro: [
          "I spent years building products from the outside — planning, prioritizing, shipping.",
          "Now I'm learning to build them from the inside.",
          "This is not a success story. It's a work in progress.",
        ],
        stackNow: [
          "TypeScript / Node.js",
          "React / Next.js",
          "React Native / Expo",
          "Supabase / Vercel",
          "AI Agents / LLMs",
        ],
        stackPast: ["Java / Oracle", "Angular", "System Architecture", "Strategy / Planning"],
        focus: [
          "Rebuilding development fundamentals",
          "Shipping small, real projects",
          "Exploring AI-assisted development",
          "Writing consistently",
        ],
        links: [
          { label: "Full About page", href: "/about" },
          { label: "GitHub", href: "https://github.com/hyunseokyu1-netizen" },
        ],
      };
}

export interface ProjectItem {
  name: string;
  tagline: string;
  status: string;
  href: string;
}

export function getProjects(isKo: boolean): ProjectItem[] {
  return isKo
    ? [
        {
          name: "매치다",
          tagline: "채용공고 URL 붙여넣기 → AI 매칭 → 커버레터 자동 생성",
          status: "테스트 중",
          href: "https://matchda.com/",
        },
        {
          name: "TILT — The Maze Puzzle",
          tagline: "기울여서 탈출, 음성만으로도 완전히 플레이 가능",
          status: "출시",
          href: "https://play.google.com/store/apps/details?id=com.backdev.tilt",
        },
        {
          name: "ChainPlay",
          tagline: "내가 만든 순서대로 유튜브 자동 재생",
          status: "출시",
          href: "https://play.google.com/store/apps/details?id=com.backdev.chainplay",
        },
        {
          name: "Cassette Music Player",
          tagline: "스킵 버튼 없는 레트로 카세트 플레이어",
          status: "출시",
          href: "https://play.google.com/store/apps/details?id=com.hscassette.player",
        },
        {
          name: "back to dev",
          tagline: "이 블로그 — 다시 개발자로 돌아오는 기록",
          status: "운영 중",
          href: "https://backtodev.com",
        },
        {
          name: "WiFi QR 코드 생성기",
          tagline: "손님한테 비밀번호 받아 적는 거 이제 그만",
          status: "운영 중",
          href: "https://wi-fi-qr.xyz",
        },
      ]
    : [
        {
          name: "Matchda",
          tagline: "Paste a job URL → AI matching → auto cover letter",
          status: "Testing",
          href: "https://matchda.com/",
        },
        {
          name: "TILT — The Maze Puzzle",
          tagline: "Tilt to escape — fully playable by voice alone",
          status: "Released",
          href: "https://play.google.com/store/apps/details?id=com.backdev.tilt",
        },
        {
          name: "ChainPlay",
          tagline: "Autoplay YouTube videos in the order you choose",
          status: "Released",
          href: "https://play.google.com/store/apps/details?id=com.backdev.chainplay",
        },
        {
          name: "Cassette Music Player",
          tagline: "A retro cassette player with no skip button",
          status: "Released",
          href: "https://play.google.com/store/apps/details?id=com.hscassette.player",
        },
        {
          name: "back to dev",
          tagline: "This blog — a PM's journey back to code",
          status: "Live",
          href: "https://backtodev.com",
        },
        {
          name: "WiFi QR Code Generator",
          tagline: "No more reading out WiFi passwords to guests",
          status: "Live",
          href: "https://wi-fi-qr.xyz",
        },
      ];
}
