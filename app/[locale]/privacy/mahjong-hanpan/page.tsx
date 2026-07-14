import { getLocale } from "next-intl/server";
import type { Metadata } from "next";

const BASE_URL = "https://backtodev.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "Privacy Policy — Mahjong Round (마작한판)",
    description: "Privacy policy for the Mahjong Round (마작한판) mobile game.",
    alternates: {
      canonical: `${BASE_URL}/${locale}/privacy/mahjong-hanpan`,
      languages: {
        ko: `${BASE_URL}/ko/privacy/mahjong-hanpan`,
        en: `${BASE_URL}/en/privacy/mahjong-hanpan`,
      },
    },
  };
}

export default async function MahjongHanpanPrivacyPage() {
  const locale = await getLocale();
  const isKo = locale === "ko";

  return (
    <div style={{ maxWidth: "48rem" }}>
      <h1
        style={{
          fontSize: "clamp(1.75rem, 4vw, 2.25rem)",
          fontWeight: 700,
          letterSpacing: "-0.04em",
          color: "hsl(var(--foreground))",
          marginBottom: "0.5rem",
        }}
      >
        {isKo ? "개인정보처리방침 — 마작한판" : "Privacy Policy — Mahjong Round"}
      </h1>
      <p style={{ fontSize: "0.875rem", color: "hsl(var(--muted-foreground))", marginBottom: "3rem" }}>
        {isKo ? "최종 업데이트: 2026년 7월 14일" : "Last updated: July 14, 2026"}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>

        {isKo ? (
          <>
            <section>
              <h2 style={h2Style}>1. 개요</h2>
              <p style={pStyle}>
                마작한판(Mahjong Round)은 회원가입이나 로그인 없이 즐기는 마작 게임입니다.
                이 개인정보처리방침은 앱이 어떤 정보를 다루는지 설명합니다.
              </p>
            </section>

            <section>
              <h2 style={h2Style}>2. 수집하는 정보</h2>
              <p style={pStyle}>
                마작한판은 광고나 분석(애널리틱스) SDK를 사용하지 않으며, 외부 서버로 전송되는
                개인정보가 없습니다. 앱이 다루는 정보는 다음과 같이 전부 기기 안에만 머무릅니다.
              </p>
              <ul style={ulStyle}>
                <li style={liStyle}>언어 설정, 초보자 모드 여부 — 기기에만 저장</li>
                <li style={liStyle}>플레이어 이름(닉네임) — 기기에만 저장되며, LAN 대전 시 같은 방에 참여한 기기에만 표시됨</li>
              </ul>
            </section>

            <section>
              <h2 style={h2Style}>3. LAN 멀티플레이 통신</h2>
              <p style={pStyle}>
                친구와 함께하는 대전은 별도의 서버를 거치지 않고, 같은 Wi-Fi에 연결된 기기끼리
                직접 통신합니다(방 찾기·게임 진행 모두 로컬 네트워크 안에서만 이뤄짐).
                인터넷 권한은 이 로컬 통신(소켓/UDP)을 위해서만 사용되며, 인터넷 너머 외부
                서버로 전송되는 데이터는 없습니다.
              </p>
            </section>

            <section>
              <h2 style={h2Style}>4. 제3자 제공</h2>
              <p style={pStyle}>
                마작한판은 어떠한 개인정보도 제3자와 공유하거나 판매하지 않습니다.
              </p>
            </section>

            <section>
              <h2 style={h2Style}>5. 아동의 개인정보</h2>
              <p style={pStyle}>
                초보자 모드는 아이와 함께 플레이하기 쉽도록 만들어졌지만, 앱 자체가 이름 외의
                어떠한 개인정보도 수집하지 않으므로 아동 이용자에 대해서도 별도로 수집되는
                정보가 없습니다.
              </p>
            </section>

            <section>
              <h2 style={h2Style}>6. 방침 변경</h2>
              <p style={pStyle}>
                개인정보처리방침은 앱 기능 변경(예: 광고·분석 기능 추가)에 따라 업데이트될 수
                있으며, 변경 시 이 페이지에 반영됩니다.
              </p>
            </section>

            <section>
              <h2 style={h2Style}>7. 문의</h2>
              <p style={pStyle}>
                개인정보 관련 문의사항이 있으시면 GitHub를 통해 연락해 주세요:{" "}
                <a href="https://github.com/hyunseokyu1-netizen" target="_blank" rel="noopener noreferrer" style={linkStyle}>
                  github.com/hyunseokyu1-netizen
                </a>
              </p>
            </section>
          </>
        ) : (
          <>
            <section>
              <h2 style={h2Style}>1. Overview</h2>
              <p style={pStyle}>
                Mahjong Round (마작한판) is a mahjong game that can be played without any sign-up
                or login. This Privacy Policy explains what information the app handles.
              </p>
            </section>

            <section>
              <h2 style={h2Style}>2. Information We Collect</h2>
              <p style={pStyle}>
                Mahjong Round does not use any advertising or analytics SDKs, and no personal
                information is sent to any external server. Everything the app handles stays on
                your device:
              </p>
              <ul style={ulStyle}>
                <li style={liStyle}>Language preference and Beginner Mode setting — stored on-device only</li>
                <li style={liStyle}>Player name (nickname) — stored on-device only, shown only to devices in the same LAN room during a match</li>
              </ul>
            </section>

            <section>
              <h2 style={h2Style}>3. LAN Multiplayer Communication</h2>
              <p style={pStyle}>
                Playing with friends does not go through any server — devices on the same Wi-Fi
                network communicate directly with each other (both room discovery and gameplay
                happen entirely within your local network). The Internet permission is used only
                for this local communication (socket/UDP); no data is sent beyond your local
                network.
              </p>
            </section>

            <section>
              <h2 style={h2Style}>4. Third-Party Sharing</h2>
              <p style={pStyle}>
                Mahjong Round does not share or sell any personal information to third parties.
              </p>
            </section>

            <section>
              <h2 style={h2Style}>5. Children&apos;s Privacy</h2>
              <p style={pStyle}>
                Beginner Mode is designed to make the game easy to play with kids, but since the
                app collects nothing beyond an on-device nickname, no additional information is
                collected from child users specifically.
              </p>
            </section>

            <section>
              <h2 style={h2Style}>6. Changes to This Policy</h2>
              <p style={pStyle}>
                This Privacy Policy may be updated if the app&apos;s functionality changes (for
                example, if ads or analytics are added in the future). Any changes will be
                reflected on this page.
              </p>
            </section>

            <section>
              <h2 style={h2Style}>7. Contact</h2>
              <p style={pStyle}>
                If you have any questions about this Privacy Policy, please reach out via GitHub:{" "}
                <a href="https://github.com/hyunseokyu1-netizen" target="_blank" rel="noopener noreferrer" style={linkStyle}>
                  github.com/hyunseokyu1-netizen
                </a>
              </p>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

const h2Style: React.CSSProperties = {
  fontSize: "1.1rem",
  fontWeight: 700,
  color: "hsl(var(--foreground))",
  marginBottom: "0.75rem",
  letterSpacing: "-0.02em",
};

const pStyle: React.CSSProperties = {
  color: "hsl(var(--muted-foreground))",
  lineHeight: 1.9,
  marginBottom: "0.75rem",
};

const ulStyle: React.CSSProperties = {
  margin: "0.5rem 0 0.75rem 0",
  display: "flex",
  flexDirection: "column",
  gap: "0.4rem",
};

const liStyle: React.CSSProperties = {
  color: "hsl(var(--muted-foreground))",
  lineHeight: 1.8,
  paddingLeft: "1rem",
  listStyleType: "disc",
  listStylePosition: "inside",
};

const linkStyle: React.CSSProperties = {
  color: "hsl(var(--primary))",
  textDecoration: "underline",
  textUnderlineOffset: 3,
};
