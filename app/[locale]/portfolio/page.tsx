import { getLocale } from "next-intl/server";
import type { Metadata } from "next";
import LightboxImage from "@/components/LightboxImage";

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
  image?: { src: string; alt: string };
  screenshots?: { src: string; alt: string; caption: string; width?: number; height?: number }[];
}

export default async function PortfolioPage() {
  const locale = await getLocale();
  const isKo = locale === "ko";

  const projects: Project[] = isKo
    ? [
        {
          name: "대화형 학습 플랫폼",
          tagline: "코드 실행부터 쿠버네티스 배포까지, 브라우저 안의 실습실",
          description:
            "딥러닝과 쿠버네티스를 공부하려고 책 대신 학습 사이트를 직접 만들었습니다. 화면은 마크다운 지문·Monaco 에디터·Xterm.js 터미널의 3분할 구조이고, 에디터에서 실행한 파이썬 코드는 FastAPI 백엔드가 CPU·시간·출력량 제한을 건 격리 서브프로세스에서 돌린 뒤 웹소켓으로 터미널에 실시간 스트리밍합니다. 채점도 같은 샌드박스에서 이뤄집니다 — 제출 코드를 실행한 디렉터리에서 체커 스크립트가 돌아 '입력 차원이 기대와 다릅니다' 같은 한국어 피드백을 주고, 통과 산출물(토큰, 모델 가중치)은 다음 단계로 자동 전달됩니다. 쿠버네티스 실습은 시뮬레이션이 아니라 유저 전용 K3s 클러스터 컨테이너의 셸을 PTY로 웹 터미널에 연결해 실제 kubectl이 응답하고, Docker 기초 코스는 별도의 dind(Docker-in-Docker) 환경을 씁니다. 마지막 MLOps 코스는 직접 학습시킨 PyTorch 모델을 torch 없이 numpy만으로 추론하는 경량 서빙 이미지로 빌드해 K3s에 주입하고, LoadBalancer IP로 curl 검증까지 하는 전체 파이프라인입니다. PyTorch·머신러닝·LLM·데이터 분석·Docker·쿠버네티스 기초/심화·MLOps까지 8개 코스, 채점 회귀 테스트 41개로 유지합니다. 로컬 Docker·K3s 인프라 위에서 도는 개인 학습 환경이라 라이브 데모는 없고, 소스와 실행 방법은 GitHub에 공개했습니다.",
          tech: [
            "Next.js",
            "TypeScript",
            "Monaco Editor",
            "Xterm.js",
            "FastAPI",
            "PyTorch",
            "WebSocket",
            "Docker",
            "K3s",
            "pytest",
          ],
          links: [
            { label: "→ GitHub", href: "https://github.com/hyunseokyu1-netizen/interactive-learning-platform", primary: true },
          ],
          status: "live",
          statusLabel: "로컬 운영 중",
          period: "2026.07",
          screenshots: [
            { src: "/portfolio/studysite-screen-catalog.png", alt: "대화형 학습 플랫폼 코스 카탈로그 — 8개 코스 카드와 진행률", caption: "코스 카탈로그 — 8개 코스·진행률", width: 1600, height: 1000 },
            { src: "/portfolio/studysite-screen-workspace.png", alt: "대화형 학습 플랫폼 실습 화면 — 지문·코드 에디터·터미널 3분할", caption: "실습 화면 — 지문·에디터·터미널", width: 1600, height: 1000 },
          ],
        },
        {
          name: "노가리",
          tagline: "게시판을 운영자가 아니라 사용자들의 동의로 여는 익명 커뮤니티",
          description:
            "누구나 사람·사물·브랜드·사건을 두고 익명으로 수다 떠는 커뮤니티입니다. 핵심 실험은 두 가지였습니다. 첫째, 게시판(노가리방)을 운영자가 만들지 않습니다 — 누구나 주제를 제안하고 72시간 안에 30명이 동의하면 자동 개설되며, 만료·폭파(24시간 시한부 대나무숲)·무활동 아카이브는 전부 pg_cron이 처리합니다. 둘째, 회원가입이 없는데도 대화가 성립해야 했습니다. 미들웨어가 모든 방문자에게 익명 세션을 부여하고, 방 ID와 기기 해시를 시드로 한 결정론적 닉네임을 만들어 같은 방에서는 '격분한 국회의원'으로 일관되게 유지되지만 다른 방에서는 추적이 불가능합니다. 중복 방 제안은 임베딩 없이 Claude에게 기존 주제 목록을 통째로 주고 의미상 중복을 판정시키고, 댓글은 정규식 개인정보 필터 → LLM 스크리닝 2단계로 거릅니다. 트렌딩 랭킹은 Hacker News식 시간 감쇠 점수를 Postgres 뷰 하나로 계산합니다. 디자인은 검은 선 물고기 아이콘 + 오프화이트 종이 질감의 모노크롬 시스템을 HTML 핸드오프에서 코드로 재구현했습니다.",
          tech: [
            "Next.js",
            "TypeScript",
            "React",
            "Supabase",
            "PostgreSQL",
            "pg_cron",
            "Tailwind CSS",
            "Claude API",
            "Serwist PWA",
            "Vercel",
          ],
          links: [
            { label: "→ nogari.org", href: "https://nogari.org", primary: true },
          ],
          status: "live",
          statusLabel: "운영 중",
          period: "2026.07",
          image: { src: "/portfolio/nogari-feature.png", alt: "노가리 첫 화면 — 핫한 노가리방 실시간 랭킹" },
          screenshots: [
            { src: "/portfolio/nogari-screen-browse.png", alt: "노가리방 유형별 브라우징 — 국회의원 300명 시드 카드 그리드", caption: "유형별 브라우징 + 검색", width: 2560, height: 1720 },
            { src: "/portfolio/nogari-screen-room.png", alt: "노가리방 상세 — 자동 생성 익명 닉네임과 댓글", caption: "익명 댓글 — 방마다 다른 닉네임", width: 2560, height: 1400 },
          ],
        },
        {
          name: "블로그 자동 발행 SaaS",
          tagline: "주제만 등록하면 AI가 초안을 쓰고, 클라우드가 알아서 발행",
          description:
            "날짜별로 주제를 등록해 두면 Claude가 초안을 쓰고, 예약된 시간에 티스토리와 네이버 블로그에 자동 발행해 주는 서비스입니다. 두 플랫폼 모두 글쓰기 API가 종료되어 Playwright 브라우저 자동화가 유일한 방법이었습니다 — Vercel 서버리스 함수 안에서 헤드리스 크롬을 띄워 실제 에디터에 글을 쓰고 발행 버튼을 누릅니다. 로그인은 Browserbase 원격 브라우저를 iframe으로 임베드해 사용자가 직접 하고, 서비스는 비밀번호를 전혀 다루지 않고 세션 쿠키만 저장합니다. 하루만 지나도 만료되는 카카오 세션은 매일 밤 세션을 깨워 연명시키는 cron으로 해결했고, 사용자별 Redis 네임스페이스로 멀티테넌트 구조를 갖췄습니다. 처음엔 로컬 CLI로 시작했다가 클라우드 SaaS로 전환했고, 현재 월 구독 서비스로 상업화를 준비 중입니다. 발행 자동화 로직이 곧 제품이라, 이 프로젝트는 예외적으로 소스를 공개하지 않습니다.",
          tech: [
            "Next.js",
            "TypeScript",
            "Playwright",
            "@sparticuz/chromium",
            "Upstash Redis",
            "Auth.js",
            "Browserbase",
            "Vercel Cron",
            "Claude API",
          ],
          links: [],
          status: "wip",
          statusLabel: "상업화 준비 중",
          period: "2026.07 ~",
          screenshots: [
            { src: "/portfolio/blogauto-screen-dashboard.png", alt: "블로그 자동 발행 대시보드 — 주제 등록과 발행 현황", caption: "대시보드 — 주제 등록·발행 현황", width: 2412, height: 1682 },
            { src: "/portfolio/blogauto-screen-queue.png", alt: "블로그 자동 발행 큐 — 날짜별 예약 주제 목록", caption: "발행 큐 — 한 달치 예약", width: 1956, height: 1650 },
            { src: "/portfolio/blogauto-screen-generating.png", alt: "AI 초안 생성 중 화면", caption: "AI 초안 생성", width: 1440, height: 362 },
            { src: "/portfolio/blogauto-screen-draft.png", alt: "생성된 초안 미리보기·수정 팝업", caption: "초안 미리보기·수정", width: 1438, height: 1024 },
            { src: "/portfolio/blogauto-screen-settings.png", alt: "티스토리·네이버 블로그 연동 설정 화면", caption: "블로그 연동 설정", width: 2392, height: 1418 },
          ],
        },
        {
          name: "문서 위변조 검증 블록체인",
          tagline: "처방전 파일의 해시만 온체인에 기록해 위변조를 검증하는 스마트 계약",
          description:
            "병원이 발급한 처방전 같은 민감 문서의 위변조를 막기 위해 만든 스마트 계약입니다. 개인정보보호법 때문에 문서 원본을 블록체인에 올릴 수 없어서, SHA-256 해시값만 온체인에 기록하고 원본은 오프체인에 남겨두는 구조로 설계했습니다. 병원(발행)과 약국(검증·사용 처리) 권한을 역할 기반으로 분리하고, 발행 후 7일이 지나면 자동으로 만료되는 로직을 넣었습니다. Hardhat으로 테스트 케이스 29개를 작성해 위조 파일 적발, 재사용 차단, 권한 없는 계정의 접근 차단을 검증했고, Sepolia 테스트넷에 실제 배포까지 마쳤습니다. 브라우저에서 Web Crypto API로 파일 해시를 계산해 원본이 서버로 전송되지 않는 웹 UI도 함께 만들었습니다.",
          tech: ["Solidity", "Hardhat", "OpenZeppelin", "Ethereum", "Ethers.js", "Express"],
          links: [
            {
              label: "→ Etherscan에서 확인",
              href: "https://sepolia.etherscan.io/address/0xF4d634D1E21c5682EB95727922077f9C048cc801",
              primary: true,
            },
            { label: "GitHub", href: "https://github.com/hyunseokyu1-netizen/document-verification-blockchain" },
            { label: "개발 이야기", href: "/ko/posts/blockchain_prescription_verification_20260710" },
          ],
          status: "live",
          statusLabel: "Sepolia 테스트넷 배포",
          period: "2026.07",
          screenshots: [
            { src: "/portfolio/docverify-screen-hospital.png", alt: "처방전 위변조 검증 시스템 병원 발행 화면", caption: "병원 — 발행", width: 1578, height: 1492 },
            { src: "/portfolio/docverify-screen-pharmacy.png", alt: "처방전 위변조 검증 시스템 약국 검증 화면", caption: "약국 — 검증", width: 1466, height: 1562 },
            { src: "/portfolio/docverify-screen-lookup.png", alt: "처방전 위변조 검증 시스템 상태 조회 화면", caption: "상태 조회", width: 1502, height: 1264 },
          ],
        },
        {
          name: "매치다",
          tagline: "채용공고 URL 붙여넣기 → AI 매칭 → 커버레터 자동 생성",
          description:
            "취업 준비 중 매일 반복되는 공고 검색과 커버레터 작성을 자동화하기 위해 만든 개인 툴입니다. 채용공고 URL을 붙여넣으면 JD를 자동으로 스크래핑하고, AI가 내 프로필과 매칭 점수를 매깁니다. 관심 있는 공고는 지원 상태(관심있음 → 지원완료 → 면접 → 합격)로 관리하고, 버튼 하나로 영문·한국어 커버레터를 생성해 TXT·DOCX·PDF로 내보낼 수 있습니다. Seek, Indeed, LinkedIn, Glassdoor URL을 지원합니다. 처음엔 'JobRadar'라는 이름으로 시작했지만, 브랜딩 작업을 거치며 '세상의 모든 직업을 매칭해준다'는 뜻의 매치다(match + da)로 이름을 바꿨습니다.",
          tech: [
            "Next.js",
            "TypeScript",
            "Supabase",
            "Vercel",
            "Cheerio",
            "Claude API",
          ],
          links: [
            { label: "→ 사이트 바로가기", href: "https://matchda.com/", primary: true },
            { label: "GitHub", href: "https://github.com/hyunseokyu1-netizen/jobradar" },
            { label: "개발 이야기", href: "/ko/posts/jobradar_01_setup_20260420" },
          ],
          status: "wip",
          statusLabel: "테스트 중",
          period: "2026.04 ~",
          image: { src: "/portfolio/matchda-feature.png", alt: "매치다 글로벌 커리어 플랫폼 홈 화면" },
          screenshots: [
            { src: "/portfolio/matchda-screen-matching.png", alt: "매치다 AI 공고 매칭 화면", caption: "AI 공고 매칭" },
            { src: "/portfolio/matchda-screen-translate.png", alt: "매치다 이력서 영문 번역 화면", caption: "이력서 영문 번역" },
            { src: "/portfolio/matchda-screen-tracking.png", alt: "매치다 지원 현황 추적 화면", caption: "지원 현황 추적" },
          ],
        },
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
            { label: "→ Google Play", href: "https://play.google.com/store/apps/details?id=com.backdev.tilt", primary: true },
            { label: "GitHub", href: "https://github.com/hyunseokyu1-netizen/Tilt" },
          ],
          status: "live",
          statusLabel: "출시 완료",
          period: "2026.05",
          image: { src: "/portfolio/tilt-feature.png", alt: "TILT 메이즈 퍼즐 게임 화면" },
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
            { label: "→ Google Play", href: "https://play.google.com/store/apps/details?id=com.backdev.chainplay", primary: true },
            { label: "GitHub", href: "https://github.com/hyunseokyu1-netizen/yt-player" },
            { label: "개인정보처리방침", href: "https://hyunseokyu1-netizen.github.io/chain-play-privacy/" },
          ],
          status: "live",
          statusLabel: "출시 완료",
          period: "2026.05",
          image: { src: "/portfolio/chainplay-feature.png", alt: "ChainPlay 메인 화면" },
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
              href: "https://play.google.com/store/apps/details?id=com.hscassette.player",
              primary: true,
            },
            {
              label: "GitHub",
              href: "https://github.com/hyunseokyu1-netizen/cassette-music-player",
            },
          ],
          status: "live",
          statusLabel: "출시 완료",
          period: "2025.05",
          image: { src: "/portfolio/cassette-feature.png", alt: "Cassette Music Player 화면" },
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
          name: "back to dev",
          tagline: "40대 PM이 다시 개발자로 돌아오는 기록",
          description:
            "개발을 다시 시작하면서 배운 것들을 글로 남기는 개인 개발 블로그입니다. Markdown 파일을 GitHub에 올리면 GitHub Actions가 날짜에 맞춰 자동 발행하는 워크플로우를 직접 설계했습니다. Next.js App Router로 한국어·영어를 분리 운영하고, SEO 메타데이터·sitemap·robots까지 구성했습니다. 지금 이 포트폴리오 페이지도 이 블로그 안에 있습니다.",
          tech: [
            "Next.js",
            "TypeScript",
            "Vercel",
            "GitHub API",
            "GitHub Actions",
            "next-intl",
            "Tailwind CSS",
          ],
          links: [
            { label: "→ backtodev.com", href: "https://backtodev.com", primary: true },
            { label: "GitHub", href: "https://github.com/hyunseokyu1-netizen/backtodev" },
          ],
          status: "live",
          statusLabel: "운영 중",
          period: "2026.04 ~",
          image: { src: "/portfolio/backtodev-feature.png", alt: "back to dev 블로그 홈 화면" },
          screenshots: [
            { src: "/portfolio/backtodev-screen-posts.png", alt: "포스트 목록 화면", caption: "Posts" },
          ],
        },
        {
          name: "Village — 픽셀 마을 방명록",
          tagline: "이스터에그를 찾아야 나무를 심고, 댓글도 남길 수 있는 방명록",
          description:
            "이 블로그는 DB 없이 GitHub만으로 유지하고 싶었는데, 그래도 댓글 기능은 갖고 싶어서 만든 기능입니다. 90년대 RPG 스타일 픽셀 마을을 캐릭터로 돌아다니다가 숨겨진 돌바위(이스터에그)를 찾아야만 방명록 나무를 심을 수 있고, 댓글을 읽으려면 마을 어딘가에 심어진 나무를 찾아가야 합니다. 방명록 데이터는 별도 DB 없이 GitHub 저장소의 JSON 파일에 직접 커밋되는 방식으로 저장됩니다. 방문자가 직접 댓글을 수정·삭제할 수는 없고, 고치고 싶으면 GitHub PR을 보내야 하며 제가 검토해서 반영합니다. 봇 방지를 위해 허니팟 필드와 IP 기반 스로틀(1분에 나무 1그루)도 넣었습니다.",
          tech: ["Next.js", "TypeScript", "React", "GitHub REST API"],
          links: [
            { label: "→ 마을 구경하기", href: "/ko/village", primary: true },
            { label: "GitHub", href: "https://github.com/hyunseokyu1-netizen/backtodev" },
          ],
          status: "live",
          statusLabel: "운영 중",
          period: "2026.07",
          screenshots: [
            { src: "/portfolio/village-screen-overview.png", alt: "픽셀 마을 전체 지도 화면", caption: "마을 전경 — 집·도서관·작업실", width: 1974, height: 1416 },
            { src: "/portfolio/village-screen-square.png", alt: "픽셀 마을 광장 화면", caption: "마을 광장", width: 1964, height: 1162 },
            { src: "/portfolio/village-screen-library.png", alt: "픽셀 마을 도서관 내부 화면", caption: "도서관 — 포스트 서가", width: 1966, height: 1164 },
            { src: "/portfolio/village-screen-posts.png", alt: "픽셀 마을 도서관 최신 포스트 목록 모달", caption: "최신 포스트 목록", width: 1986, height: 1174 },
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
          period: "2026.04",
          image: { src: "/portfolio/wifi-qr-preview.png", alt: "WiFi QR 코드 생성기 화면" },
        },
        {
          name: "마작 조이",
          tagline: "족보도 역도 없이, 짝만 맞추면 이기는 심플 마작",
          description:
            "사람들이 마작을 어려워하는 진짜 이유는 규칙이 아니라 복잡한 점수 체계(역·판수·부수)라고 생각했습니다. 그래서 규칙을 걷어내고 '몸통 4개 + 머리 1개' 조합 하나만 기억하면 되게 만들었고, 대신 승리 점수는 기본 100점에 더하기 보너스와 곱하기 보너스를 얹어 영수증처럼 한 줄씩 보여주는 연출을 넣었습니다. 사람은 항상 좌석 0, 나머지는 AI가 채우는 로컬 대전이 기본이고, 같은 Wi-Fi에서 방을 만들면 최대 4명이 함께 즐기는 LAN 멀티플레이도 지원합니다 — 호스트가 유일한 심판 역할을 하고 참가자는 행동만 전송하는 구조라 서버 비용이 들지 않습니다. 효과음은 외부 에셋 없이 파이썬으로 직접 합성했고, 한국어·중국어·영어 3개 언어와 점수 없이 짝 맞추기만 즐기는 초보자 모드도 넣었습니다.",
          tech: ["Flutter", "Dart", "dart:io Sockets", "Provider", "audioplayers"],
          links: [
            { label: "→ GitHub", href: "https://github.com/hyunseokyu1-netizen/mahjong_joy", primary: true },
          ],
          status: "wip",
          statusLabel: "개발 중",
          period: "2026.07",
          screenshots: [
            { src: "/portfolio/mahjongjoy-screen-home.png", alt: "마작 조이 홈 화면", caption: "홈 — AI / 친구와 하기", width: 1080, height: 2340 },
            { src: "/portfolio/mahjongjoy-screen-gameplay.png", alt: "마작 조이 게임플레이 화면, 패 가져가기 타이머", caption: "게임플레이 — 15초 응답 타이머", width: 1080, height: 2340 },
            { src: "/portfolio/mahjongjoy-screen-howto.png", alt: "마작 조이 게임 설명서 화면", caption: "설명서 — 족보 없이 조합 하나만", width: 1080, height: 2340 },
          ],
        },
        {
          name: "Football Dice",
          tagline: "주사위와 카드로 승부하는 미식축구 보드게임",
          description:
            "미식축구를 주사위와 카드로 재현한 보드게임 앱입니다. 공격·수비 플레이북에서 카드를 고르면 주사위 매치업 차트로 결과가 갈리는 방식으로, 보드게임 특유의 긴장감을 그대로 살렸습니다. 쉬움·보통·어려움 난이도별 AI와 대전하거나, 같은 Wi-Fi에서 친구와 직접 대전할 수 있습니다. 추천 플레이 3장뿐 아니라 전체 플레이북도 열람할 수 있고, 한국어·영어를 지원하며 주사위·카드 연출과 효과음은 각각 켜고 끌 수 있습니다.",
          tech: ["Flutter", "Dart", "dart:io Sockets", "shared_preferences", "audioplayers"],
          links: [
            { label: "→ GitHub", href: "https://github.com/hyunseokyu1-netizen/football_dice", primary: true },
          ],
          status: "wip",
          statusLabel: "개발 중",
          period: "2026.07",
          screenshots: [
            { src: "/portfolio/footballdice-screen-home.png", alt: "Football Dice 홈 화면", caption: "홈 — 난이도 선택", width: 1080, height: 2340 },
            { src: "/portfolio/footballdice-screen-gameplay.png", alt: "Football Dice 공격 플레이북 화면", caption: "공격 플레이북 선택", width: 1080, height: 2340 },
            { src: "/portfolio/footballdice-screen-result.png", alt: "Football Dice 주사위 판정 결과 화면", caption: "주사위 판정 결과", width: 1080, height: 2340 },
          ],
        },
      ]
    : [
        {
          name: "Interactive Learning Platform",
          tagline: "A hands-on lab in the browser — from running code to deploying on Kubernetes",
          description:
            "I wanted to study deep learning and Kubernetes, so instead of reading books I built the learning site myself. The screen is a three-pane workspace — markdown lesson, Monaco editor, and an Xterm.js terminal. Python code from the editor runs in an isolated subprocess with CPU, wall-clock, and output limits enforced by a FastAPI backend, and the output streams back to the terminal over WebSocket in real time. Grading happens in the same sandbox: a checker script runs in the directory where your submission executed, gives feedback like \"expected input dimension (Batch, 100)\", and passing artifacts (tokens, model weights) carry over to the next stage automatically. The Kubernetes labs are not simulations — a per-user K3s cluster container is wired to the web terminal via PTY so real kubectl answers back, and the Docker course gets its own dind (Docker-in-Docker) environment. The final MLOps course closes the loop: package your own trained PyTorch model into a lightweight numpy-only serving image, inject it into K3s, and verify the API through a LoadBalancer IP with curl. Eight courses — PyTorch, ML, LLM, data analysis, Docker, Kubernetes basics/advanced, and MLOps — backed by 41 grading regression tests. It runs on local Docker and K3s infrastructure, so there's no live demo — but the source and setup guide are on GitHub.",
          tech: [
            "Next.js",
            "TypeScript",
            "Monaco Editor",
            "Xterm.js",
            "FastAPI",
            "PyTorch",
            "WebSocket",
            "Docker",
            "K3s",
            "pytest",
          ],
          links: [
            { label: "→ GitHub", href: "https://github.com/hyunseokyu1-netizen/interactive-learning-platform", primary: true },
          ],
          status: "live",
          statusLabel: "Running locally",
          period: "Jul 2026",
          screenshots: [
            { src: "/portfolio/studysite-screen-catalog.png", alt: "Interactive learning platform course catalog with eight course cards and progress bars", caption: "Course catalog — 8 courses & progress", width: 1600, height: 1000 },
            { src: "/portfolio/studysite-screen-workspace.png", alt: "Interactive learning platform workspace — lesson, code editor, and terminal panes", caption: "Workspace — lesson, editor, terminal", width: 1600, height: 1000 },
          ],
        },
        {
          name: "Nogari",
          tagline: "An anonymous community where boards are opened by user consensus, not admins",
          description:
            "An anonymous community for talking about people, products, brands, and events. Two experiments drive it. First, boards aren't created by an admin — anyone can propose a topic, and if 30 people agree within 72 hours, the room opens automatically; expiry, 24-hour self-destructing \"bamboo forest\" rooms, and inactivity archiving are all handled by pg_cron. Second, conversations had to work with zero signup: middleware grants every visitor an anonymous session, and a deterministic nickname derived from the room ID and a device hash keeps you consistently \"Furious Lawmaker\" within one room while making you untraceable across rooms. Duplicate room proposals are screened without embeddings — Claude receives the full list of existing topics and judges semantic duplicates directly — and comments pass through a two-stage filter: regex PII detection, then LLM screening. The trending ranking is a Hacker News-style time-decay score computed in a single Postgres view. The visual design — a line-art fish on off-white paper, all monochrome — was reimplemented in code from an HTML design handoff.",
          tech: [
            "Next.js",
            "TypeScript",
            "React",
            "Supabase",
            "PostgreSQL",
            "pg_cron",
            "Tailwind CSS",
            "Claude API",
            "Serwist PWA",
            "Vercel",
          ],
          links: [
            { label: "→ nogari.org", href: "https://nogari.org", primary: true },
          ],
          status: "live",
          statusLabel: "Live",
          period: "Jul 2026",
          image: { src: "/portfolio/nogari-feature.png", alt: "Nogari first screen — real-time trending rooms" },
          screenshots: [
            { src: "/portfolio/nogari-screen-browse.png", alt: "Browsing rooms by type — 300 seeded lawmaker cards", caption: "Browse by type + search", width: 2560, height: 1720 },
            { src: "/portfolio/nogari-screen-room.png", alt: "Room detail — auto-generated anonymous nicknames and comments", caption: "Anonymous comments — per-room nicknames", width: 2560, height: 1400 },
          ],
        },
        {
          name: "Blog Auto-Publisher SaaS",
          tagline: "Register a topic — AI drafts it, the cloud publishes it",
          description:
            "A service where you register topics by date, Claude writes the drafts, and posts are automatically published to Tistory and Naver Blog at the scheduled time. Both platforms shut down their writing APIs, so Playwright browser automation was the only way in — a headless Chrome runs inside a Vercel serverless function, types into the real editor, and clicks the publish button. For login, a Browserbase remote browser is embedded as an iframe so users sign in themselves; the service never touches passwords and stores only session cookies. Kakao sessions expire after just a day of inactivity, which I solved with a nightly cron that keeps sessions alive. Per-user Redis namespaces make it multi-tenant. It started as a local CLI and pivoted to a cloud SaaS — now preparing to launch as a paid subscription. Since the publishing automation is the product itself, this is the one project whose source stays private.",
          tech: [
            "Next.js",
            "TypeScript",
            "Playwright",
            "@sparticuz/chromium",
            "Upstash Redis",
            "Auth.js",
            "Browserbase",
            "Vercel Cron",
            "Claude API",
          ],
          links: [],
          status: "wip",
          statusLabel: "Preparing to launch",
          period: "Jul 2026 ~",
          screenshots: [
            { src: "/portfolio/blogauto-screen-dashboard.png", alt: "Blog auto-publisher dashboard with topic registration and publish status", caption: "Dashboard — topics & publish status", width: 2412, height: 1682 },
            { src: "/portfolio/blogauto-screen-queue.png", alt: "Publish queue with topics scheduled by date", caption: "Publish queue — a month scheduled", width: 1956, height: 1650 },
            { src: "/portfolio/blogauto-screen-generating.png", alt: "AI draft generation in progress", caption: "AI drafting", width: 1440, height: 362 },
            { src: "/portfolio/blogauto-screen-draft.png", alt: "Generated draft preview and edit modal", caption: "Draft preview & edit", width: 1438, height: 1024 },
            { src: "/portfolio/blogauto-screen-settings.png", alt: "Tistory and Naver blog connection settings", caption: "Blog connection settings", width: 2392, height: 1418 },
          ],
        },
        {
          name: "Document Verification Blockchain",
          tagline: "Smart contract that verifies documents by matching file hashes on-chain",
          description:
            "A smart contract built to prevent tampering with sensitive documents like hospital-issued prescriptions. Privacy law prevents storing the actual document on a public blockchain, so the design only records a SHA-256 hash on-chain while the original file stays off-chain. Hospital (issuer) and pharmacy (verifier) permissions are separated by role, and prescriptions automatically expire 7 days after issuance. I wrote 29 Hardhat test cases covering forged-file detection, reuse prevention, and unauthorized access, then deployed it to the Sepolia testnet. I also built a web UI that computes the file hash in the browser via the Web Crypto API, so the original file never touches the server.",
          tech: ["Solidity", "Hardhat", "OpenZeppelin", "Ethereum", "Ethers.js", "Express"],
          links: [
            {
              label: "→ View on Etherscan",
              href: "https://sepolia.etherscan.io/address/0xF4d634D1E21c5682EB95727922077f9C048cc801",
              primary: true,
            },
            { label: "GitHub", href: "https://github.com/hyunseokyu1-netizen/document-verification-blockchain" },
            { label: "Dev story", href: "/en/posts/blockchain_prescription_verification_20260710" },
          ],
          status: "live",
          statusLabel: "Deployed to Sepolia testnet",
          period: "Jul 2026",
          screenshots: [
            { src: "/portfolio/docverify-screen-hospital.png", alt: "Document verification blockchain hospital issue screen", caption: "Hospital — Issue", width: 1578, height: 1492 },
            { src: "/portfolio/docverify-screen-pharmacy.png", alt: "Document verification blockchain pharmacy verify screen", caption: "Pharmacy — Verify", width: 1466, height: 1562 },
            { src: "/portfolio/docverify-screen-lookup.png", alt: "Document verification blockchain status lookup screen", caption: "Status Lookup", width: 1502, height: 1264 },
          ],
        },
        {
          name: "Matchda",
          tagline: "Paste a job URL → AI matching → auto-generated cover letter",
          description:
            "A personal tool built to automate the daily grind of job searching. Paste a job posting URL from Seek, Indeed, LinkedIn, or Glassdoor — Matchda scrapes the JD automatically and uses AI to score the match against your profile. Track each application through status stages (interested → applied → interview → offer), and generate English or Korean cover letters with one click. Export as TXT, DOCX, or PDF. It originally launched as \"JobRadar,\" but was rebranded through a branding process to Matchda (match + da) — capturing the idea of matching every job in the world.",
          tech: [
            "Next.js",
            "TypeScript",
            "Supabase",
            "Vercel",
            "Cheerio",
            "Claude API",
          ],
          links: [
            { label: "→ Live site", href: "https://matchda.com/", primary: true },
            { label: "GitHub", href: "https://github.com/hyunseokyu1-netizen/jobradar" },
            { label: "Dev story", href: "/en/posts/jobradar_01_setup_20260420" },
          ],
          status: "wip",
          statusLabel: "Testing",
          period: "Apr 2026 ~",
          image: { src: "/portfolio/matchda-feature.png", alt: "Matchda global career platform home" },
          screenshots: [
            { src: "/portfolio/matchda-screen-matching.png", alt: "Matchda AI job matching", caption: "AI job matching" },
            { src: "/portfolio/matchda-screen-translate.png", alt: "Matchda resume translation", caption: "Resume translation" },
            { src: "/portfolio/matchda-screen-tracking.png", alt: "Matchda application tracking", caption: "Application tracking" },
          ],
        },
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
            { label: "→ Google Play", href: "https://play.google.com/store/apps/details?id=com.backdev.tilt", primary: true },
            { label: "GitHub", href: "https://github.com/hyunseokyu1-netizen/Tilt" },
          ],
          status: "live",
          statusLabel: "Released",
          period: "May 2026",
          image: { src: "/portfolio/tilt-feature.png", alt: "TILT maze puzzle game screen" },
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
            { label: "→ Google Play", href: "https://play.google.com/store/apps/details?id=com.backdev.chainplay", primary: true },
            { label: "GitHub", href: "https://github.com/hyunseokyu1-netizen/yt-player" },
            { label: "Privacy Policy", href: "https://hyunseokyu1-netizen.github.io/chain-play-privacy/" },
          ],
          status: "live",
          statusLabel: "Released",
          period: "May 2026",
          image: { src: "/portfolio/chainplay-feature.png", alt: "ChainPlay 메인 화면" },
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
              href: "https://play.google.com/store/apps/details?id=com.hscassette.player",
              primary: true,
            },
            {
              label: "GitHub",
              href: "https://github.com/hyunseokyu1-netizen/cassette-music-player",
            },
          ],
          status: "live",
          statusLabel: "Released",
          period: "May 2025",
          image: { src: "/portfolio/cassette-feature.png", alt: "Cassette Music Player 화면" },
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
          name: "back to dev",
          tagline: "A developer blog — a 40-something PM returning to code",
          description:
            "A personal developer blog documenting the journey back into development. The publishing workflow is fully automated: push a Markdown file to GitHub, and GitHub Actions publishes it on the scheduled date. Built with Next.js App Router to serve Korean and English routes separately, with SEO metadata, sitemap, and robots configured. This portfolio page is part of the same blog.",
          tech: [
            "Next.js",
            "TypeScript",
            "Vercel",
            "GitHub API",
            "GitHub Actions",
            "next-intl",
            "Tailwind CSS",
          ],
          links: [
            { label: "→ backtodev.com", href: "https://backtodev.com", primary: true },
            { label: "GitHub", href: "https://github.com/hyunseokyu1-netizen/backtodev" },
          ],
          status: "live",
          statusLabel: "Live",
          period: "Apr 2026 ~",
          image: { src: "/portfolio/backtodev-feature.png", alt: "back to dev blog home" },
          screenshots: [
            { src: "/portfolio/backtodev-screen-posts.png", alt: "Posts list page", caption: "Posts" },
          ],
        },
        {
          name: "Village — Pixel Village Guestbook",
          tagline: "Find the easter egg to plant a tree, and leave a comment",
          description:
            "I wanted to keep this blog running on GitHub alone, with no database — but I still wanted a comment feature. So I built a 90s-style RPG pixel village you walk around as a character. You can only plant a guestbook tree by finding a hidden easter egg (a stone), and to read a comment, you have to track down a tree planted somewhere in the village. Guestbook entries are stored with no database at all — they're committed directly as a JSON file in the GitHub repo. Visitors can't edit or delete their own entries; if they want a change, they have to send me a GitHub PR, which I review and merge myself. I added a honeypot field and an IP-based throttle (one tree per minute) to keep bots out.",
          tech: ["Next.js", "TypeScript", "React", "GitHub REST API"],
          links: [
            { label: "→ Explore the village", href: "/en/village", primary: true },
            { label: "GitHub", href: "https://github.com/hyunseokyu1-netizen/backtodev" },
          ],
          status: "live",
          statusLabel: "Live",
          period: "Jul 2026",
          screenshots: [
            { src: "/portfolio/village-screen-overview.png", alt: "Pixel village overview map", caption: "Village overview — home, library, workshop", width: 1974, height: 1416 },
            { src: "/portfolio/village-screen-square.png", alt: "Pixel village square screen", caption: "Village square", width: 1964, height: 1162 },
            { src: "/portfolio/village-screen-library.png", alt: "Pixel village library interior", caption: "Library — post shelves", width: 1966, height: 1164 },
            { src: "/portfolio/village-screen-posts.png", alt: "Pixel village library recent posts modal", caption: "Recent posts list", width: 1986, height: 1174 },
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
          image: { src: "/portfolio/wifi-qr-preview.png", alt: "WiFi QR 코드 생성기 화면" },
        },
        {
          name: "Mahjong Joy",
          tagline: "Mahjong is intimidating — so I stripped it down to just matching",
          description:
            "What actually scares people away from mahjong isn't the rules — it's the scoring system (yaku, han, fu). So I stripped the rules down to one shape to remember: 4 sets + 1 pair. Winning scores are rebuilt as a simple receipt instead: a base 100 points, plus bonuses, then multiplier bonuses, revealed line by line like a real receipt. The default mode is solo play against AI — you're always seat 0, AI fills the rest — but I also built LAN multiplayer: create a room on the same Wi-Fi and up to 4 people play together, with the host acting as the sole referee while guests just send actions, so it needs no server at all. Sound effects are synthesized in Python with no external assets, and the app supports Korean, Chinese, and English, plus a beginner mode that drops scoring entirely and keeps just the matching.",
          tech: ["Flutter", "Dart", "dart:io Sockets", "Provider", "audioplayers"],
          links: [
            { label: "→ GitHub", href: "https://github.com/hyunseokyu1-netizen/mahjong_joy", primary: true },
          ],
          status: "wip",
          statusLabel: "In development",
          period: "Jul 2026",
          screenshots: [
            { src: "/portfolio/mahjongjoy-screen-home.png", alt: "Mahjong Joy home screen", caption: "Home — Play with AI / Friends", width: 1080, height: 2340 },
            { src: "/portfolio/mahjongjoy-screen-gameplay.png", alt: "Mahjong Joy gameplay screen with claim timer", caption: "Gameplay — 15s response timer", width: 1080, height: 2340 },
            { src: "/portfolio/mahjongjoy-screen-howto.png", alt: "Mahjong Joy how to play screen", caption: "How to play — one shape, no hands", width: 1080, height: 2340 },
          ],
        },
        {
          name: "Football Dice",
          tagline: "An American football board game resolved by dice and cards",
          description:
            "A board game app that recreates American football with dice and cards. Pick a play from your offense or defense playbook, and the outcome is resolved against a dice matchup chart — keeping the tension of a real tabletop board game. Play against AI across three difficulty levels, or challenge a friend directly over the same Wi-Fi network. Beyond the three suggested plays, you can browse the full playbook, and the app supports Korean and English with independent toggles for dice-and-card animations and sound effects.",
          tech: ["Flutter", "Dart", "dart:io Sockets", "shared_preferences", "audioplayers"],
          links: [
            { label: "→ GitHub", href: "https://github.com/hyunseokyu1-netizen/football_dice", primary: true },
          ],
          status: "wip",
          statusLabel: "In development",
          period: "Jul 2026",
          screenshots: [
            { src: "/portfolio/footballdice-screen-home.png", alt: "Football Dice home screen", caption: "Home — difficulty select", width: 1080, height: 2340 },
            { src: "/portfolio/footballdice-screen-gameplay.png", alt: "Football Dice offense playbook screen", caption: "Offense playbook selection", width: 1080, height: 2340 },
            { src: "/portfolio/footballdice-screen-result.png", alt: "Football Dice dice resolution result screen", caption: "Dice resolution result", width: 1080, height: 2340 },
          ],
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
              className="flex flex-col sm:flex-row sm:items-start sm:justify-between"
              style={{ marginBottom: "0.75rem", gap: "0.5rem" }}
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
              <div className="flex items-center gap-2 flex-wrap sm:shrink-0">
                <span
                  style={{
                    fontSize: "0.7rem",
                    padding: "0.25rem 0.6rem",
                    borderRadius: 99,
                    fontWeight: 700,
                    fontFamily: "var(--font-mono), monospace",
                    whiteSpace: "nowrap",
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
                    whiteSpace: "nowrap",
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

            {/* Preview image — 클릭하면 오버레이로 크게 보기 */}
            {project.image && (
              <div
                style={{
                  marginTop: "1.25rem",
                  borderRadius: 10,
                  overflow: "hidden",
                  border: "1px solid hsl(var(--border))",
                }}
              >
                <LightboxImage
                  src={project.image.src}
                  alt={project.image.alt}
                  width={1280}
                  height={800}
                  priority
                  isKo={isKo}
                />
              </div>
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
                    <LightboxImage
                      src={screenshot.src}
                      alt={screenshot.alt}
                      width={screenshot.width ?? 1080}
                      height={screenshot.height ?? 2340}
                      caption={screenshot.caption}
                      isKo={isKo}
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
