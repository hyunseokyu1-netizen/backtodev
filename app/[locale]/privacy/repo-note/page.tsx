import { getLocale } from "next-intl/server";
import type { Metadata } from "next";
import { localizedPageMetadata } from "@/lib/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return localizedPageMetadata({
    locale,
    path: "privacy/repo-note",
    title: locale === "ko" ? "RepoNote 개인정보처리방침" : "RepoNote Privacy Policy",
    description: locale === "ko"
      ? "RepoNote 모바일 앱 개인정보처리방침"
      : "Privacy policy for the RepoNote mobile app",
  });
}

export default async function RepoNotePrivacyPage() {
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
        {isKo ? "개인정보처리방침 — RepoNote" : "Privacy Policy — RepoNote"}
      </h1>
      <p style={{ fontSize: "0.875rem", color: "hsl(var(--muted-foreground))", marginBottom: "3rem" }}>
        {isKo ? "최종 업데이트: 2026년 7월 17일" : "Last updated: July 17, 2026"}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>

        {isKo ? (
          <>
            <section>
              <h2 style={h2Style}>1. 개요</h2>
              <p style={pStyle}>
                RepoNote는 사용자 본인의 GitHub 저장소에 보관된 Markdown 문서를 조회·작성·수정하는
                개인용 메모 앱입니다. 이 개인정보처리방침은 앱이 어떤 정보를 다루고, 그 정보가
                어디로 전송되는지 설명합니다. RepoNote는 자체 서버를 운영하지 않으며, 개발자가
                사용자의 데이터를 수집하거나 열람할 수 없습니다.
              </p>
            </section>

            <section>
              <h2 style={h2Style}>2. 기기에 저장되는 정보</h2>
              <p style={pStyle}>
                다음 정보는 모두 사용자의 기기 안에만 저장되며, 개발자를 포함한 외부로 전송되지
                않습니다.
              </p>
              <ul style={ulStyle}>
                <li style={liStyle}>
                  GitHub Personal Access Token — 기기의 보안 저장소(Android Keystore)에만 저장
                </li>
                <li style={liStyle}>
                  노트 초안 및 문서 캐시 — 오프라인 사용과 데이터 유실 방지를 위해 기기에 저장
                </li>
                <li style={liStyle}>
                  GitHub 계정 표시 정보(사용자명, 프로필 이미지 URL) — 설정 화면 표시용
                </li>
                <li style={liStyle}>앱 설정(테마, 동기화 주기, 선택한 저장소·브랜치 정보 등)</li>
              </ul>
            </section>

            <section>
              <h2 style={h2Style}>3. GitHub와의 통신</h2>
              <p style={pStyle}>
                앱의 모든 네트워크 통신은 GitHub 공식 API(api.github.com)와의 HTTPS 통신뿐입니다.
                Token은 API 인증 목적으로만 GitHub에 전송되며, 노트 내용은 사용자가 직접 선택한
                본인 소유의 GitHub 저장소에 커밋됩니다. 즉, 노트 데이터의 저장 위치와 공개 범위는
                전적으로 사용자의 GitHub 저장소 설정을 따릅니다. GitHub의 데이터 처리에 대해서는{" "}
                <a
                  href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={linkStyle}
                >
                  GitHub 개인정보처리방침
                </a>
                을 참고하세요.
              </p>
            </section>

            <section>
              <h2 style={h2Style}>4. 광고 및 분석 도구</h2>
              <p style={pStyle}>
                RepoNote는 광고 SDK나 분석(애널리틱스) SDK를 사용하지 않습니다. 사용 통계, 크래시
                리포트를 포함해 어떠한 데이터도 개발자에게 전송되지 않습니다.
              </p>
            </section>

            <section>
              <h2 style={h2Style}>5. 데이터 삭제</h2>
              <ul style={ulStyle}>
                <li style={liStyle}>
                  앱에서 로그아웃하면 Token과 모든 로컬 데이터(초안, 캐시, 설정)가 즉시 삭제됩니다.
                </li>
                <li style={liStyle}>앱을 삭제하면 기기에 저장된 모든 데이터가 함께 삭제됩니다.</li>
                <li style={liStyle}>
                  GitHub 저장소에 커밋된 노트는 사용자 본인의 저장소에 남으며, 삭제 여부는
                  사용자가 직접 관리합니다. 앱에 등록한 Token은 GitHub 설정에서 언제든지 폐기할
                  수 있습니다.
                </li>
              </ul>
            </section>

            <section>
              <h2 style={h2Style}>6. 제3자 제공</h2>
              <p style={pStyle}>
                RepoNote는 어떠한 개인정보도 제3자와 공유하거나 판매하지 않습니다. 사용자의 노트가
                전송되는 곳은 사용자가 직접 지정한 본인의 GitHub 저장소가 유일합니다.
              </p>
            </section>

            <section>
              <h2 style={h2Style}>7. 아동의 개인정보</h2>
              <p style={pStyle}>
                RepoNote는 아동을 대상으로 하지 않으며, 아동을 포함한 어떤 이용자로부터도
                개인정보를 수집하지 않습니다.
              </p>
            </section>

            <section>
              <h2 style={h2Style}>8. 방침 변경</h2>
              <p style={pStyle}>
                개인정보처리방침은 앱 기능 변경에 따라 업데이트될 수 있으며, 변경 시 이 페이지에
                반영됩니다.
              </p>
            </section>

            <section>
              <h2 style={h2Style}>9. 문의</h2>
              <p style={pStyle}>
                개인정보 관련 문의사항이 있으시면 이메일로 연락해 주세요:{" "}
                <a href="mailto:backdev.tip@gmail.com" style={linkStyle}>
                  backdev.tip@gmail.com
                </a>
              </p>
            </section>
          </>
        ) : (
          <>
            <section>
              <h2 style={h2Style}>1. Overview</h2>
              <p style={pStyle}>
                RepoNote is a personal note-taking app for reading, writing, and editing Markdown
                documents stored in your own GitHub repository. This Privacy Policy explains what
                information the app handles and where it goes. RepoNote operates no servers of its
                own — the developer cannot collect or access any of your data.
              </p>
            </section>

            <section>
              <h2 style={h2Style}>2. Information Stored on Your Device</h2>
              <p style={pStyle}>
                All of the following stays on your device only and is never sent to the developer
                or any external service:
              </p>
              <ul style={ulStyle}>
                <li style={liStyle}>
                  Your GitHub personal access token — stored only in the device&apos;s secure
                  storage (Android Keystore)
                </li>
                <li style={liStyle}>
                  Note drafts and document cache — kept on-device for offline use and data-loss
                  protection
                </li>
                <li style={liStyle}>
                  GitHub account display info (username, avatar URL) — shown on the settings screen
                </li>
                <li style={liStyle}>
                  App preferences (theme, sync interval, selected repository and branch, etc.)
                </li>
              </ul>
            </section>

            <section>
              <h2 style={h2Style}>3. Communication with GitHub</h2>
              <p style={pStyle}>
                The app&apos;s only network communication is HTTPS traffic to the official GitHub
                API (api.github.com). Your token is sent to GitHub solely for API authentication,
                and your notes are committed to the GitHub repository you chose — one you own. The
                storage location and visibility of your notes are governed entirely by your own
                repository settings. For how GitHub handles data, see the{" "}
                <a
                  href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={linkStyle}
                >
                  GitHub Privacy Statement
                </a>
                .
              </p>
            </section>

            <section>
              <h2 style={h2Style}>4. Advertising &amp; Analytics</h2>
              <p style={pStyle}>
                RepoNote uses no advertising or analytics SDKs. Nothing — including usage
                statistics or crash reports — is transmitted to the developer.
              </p>
            </section>

            <section>
              <h2 style={h2Style}>5. Data Deletion</h2>
              <ul style={ulStyle}>
                <li style={liStyle}>
                  Logging out immediately deletes your token and all local data (drafts, cache,
                  preferences).
                </li>
                <li style={liStyle}>Uninstalling the app removes all data stored on the device.</li>
                <li style={liStyle}>
                  Notes committed to your GitHub repository remain in your repository under your
                  control. You can revoke the token you registered in the app at any time from
                  your GitHub settings.
                </li>
              </ul>
            </section>

            <section>
              <h2 style={h2Style}>6. Third-Party Sharing</h2>
              <p style={pStyle}>
                RepoNote does not share or sell any personal information to third parties. The only
                place your notes are sent is the GitHub repository you designated — your own.
              </p>
            </section>

            <section>
              <h2 style={h2Style}>7. Children&apos;s Privacy</h2>
              <p style={pStyle}>
                RepoNote is not directed at children and collects no personal information from any
                user, including children.
              </p>
            </section>

            <section>
              <h2 style={h2Style}>8. Changes to This Policy</h2>
              <p style={pStyle}>
                This Privacy Policy may be updated if the app&apos;s functionality changes. Any
                changes will be reflected on this page.
              </p>
            </section>

            <section>
              <h2 style={h2Style}>9. Contact</h2>
              <p style={pStyle}>
                If you have any questions about this Privacy Policy, please reach out via email:{" "}
                <a href="mailto:backdev.tip@gmail.com" style={linkStyle}>
                  backdev.tip@gmail.com
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
