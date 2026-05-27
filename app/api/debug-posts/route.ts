import { NextResponse } from "next/server";

export async function GET() {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;

  if (!token) return NextResponse.json({ error: "NO_TOKEN" });
  if (!owner) return NextResponse.json({ error: "NO_OWNER" });
  if (!repo) return NextResponse.json({ error: "NO_REPO" });

  const query = `
    query($owner: String!, $repo: String!, $expr: String!) {
      repository(owner: $owner, name: $repo) {
        object(expression: $expr) {
          ... on Tree { entries { name } }
        }
      }
    }
  `;

  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { owner, repo, expr: "HEAD:content/posts" } }),
    cache: "no-store",
  });

  const json = await res.json();
  const entries = json?.data?.repository?.object?.entries ?? [];

  return NextResponse.json({
    owner,
    repo,
    tokenPrefix: token.slice(0, 8),
    isVercel: !!process.env.VERCEL,
    vercelVal: process.env.VERCEL,
    httpStatus: res.status,
    gqlErrors: json.errors ?? null,
    entryCount: entries.length,
    firstThree: entries.slice(0, 3).map((e: { name: string }) => e.name),
  });
}
