import { getContributionCalendar } from "@/lib/github";

export default async function GithubContributions({ isKo }: { isKo: boolean }) {
  const login = process.env.GITHUB_OWNER;
  const data = login ? await getContributionCalendar(login) : null;
  if (!data || data.weeks.length === 0) return null;

  const maxCount = Math.max(1, ...data.weeks.flatMap((week) => week.days.map((day) => day.count)));

  const cellColor = (count: number) => {
    if (count === 0) return "hsl(var(--border) / 0.6)";
    const ratio = count / maxCount;
    if (ratio > 0.75) return "hsl(var(--primary))";
    if (ratio > 0.5) return "hsl(var(--primary) / 0.75)";
    if (ratio > 0.25) return "hsl(var(--primary) / 0.5)";
    return "hsl(var(--primary) / 0.3)";
  };

  return (
    <a
      href={`https://github.com/${login}`}
      target="_blank"
      rel="noopener noreferrer"
      className="post-card"
      style={{
        padding: "1.25rem",
        maxWidth: "100%",
        minWidth: 0,
      }}
    >
      <div className="flex items-center justify-between flex-wrap" style={{ gap: "0.5rem", marginBottom: "1rem" }}>
        <p
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: "0.75rem",
            fontWeight: 700,
            color: "hsl(var(--muted-foreground))",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          {isKo ? "GitHub 잔디" : "GitHub Activity"}
        </p>
        <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.75rem", color: "hsl(var(--primary))" }}>
          {data.total.toLocaleString()} {isKo ? "커밋 · 지난 1년" : "contributions · past year"}
        </span>
      </div>

      <div style={{ overflowX: "auto", paddingBottom: 4 }}>
        <div className="flex" style={{ gap: 3 }}>
          {data.weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col" style={{ gap: 3 }}>
              {week.days.map((day) => (
                <div
                  key={day.date}
                  title={`${day.date} · ${day.count}${isKo ? "개 커밋" : " contributions"}`}
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 2,
                    background: cellColor(day.count),
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </a>
  );
}
