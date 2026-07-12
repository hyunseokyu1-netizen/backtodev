import { NextRequest, NextResponse } from "next/server";
import { signToken, verifyPassword } from "@/lib/auth";

// ── 로그인 무차별 대입 방어 (in-memory) ──────────────────────────────────────
// 서버리스 인스턴스 단위라 완벽하지 않지만(인스턴스마다 리셋), 단일 인스턴스에
// 몰리는 자동화 공격에는 실질적 방어가 된다. 다중 인스턴스 대비 완전 방어가
// 필요하면 Upstash Redis 등 외부 스토어로 옮길 것.
const WINDOW_MS = 15 * 60 * 1000; // 15분 창
const MAX_ATTEMPTS = 5; // 창 내 최대 실패 횟수
const attempts = new Map<string, { count: number; first: number }>();

function clientIp(req: NextRequest): string {
  return (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
}

/** 실패 상태를 반영하고 현재 창의 실패 횟수를 반환 */
function recordFailure(ip: string): number {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now - rec.first > WINDOW_MS) {
    attempts.set(ip, { count: 1, first: now });
    return 1;
  }
  rec.count += 1;
  return rec.count;
}

function isLocked(ip: string): boolean {
  const rec = attempts.get(ip);
  if (!rec) return false;
  if (Date.now() - rec.first > WINDOW_MS) {
    attempts.delete(ip);
    return false;
  }
  return rec.count >= MAX_ATTEMPTS;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(request: NextRequest) {
  const ip = clientIp(request);

  if (isLocked(ip)) {
    return NextResponse.json(
      { error: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429 }
    );
  }

  const { password } = await request.json().catch(() => ({ password: "" }));

  if (!(await verifyPassword(password ?? ""))) {
    const count = recordFailure(ip);
    // 실패할수록 응답을 지연시켜 대량 시도를 느리게 만든다 (최대 ~2초)
    await sleep(Math.min(count * 400, 2000));
    return NextResponse.json({ error: "비밀번호가 틀렸습니다." }, { status: 401 });
  }

  // 성공 시 해당 IP의 실패 카운트 초기화
  attempts.delete(ip);

  const token = await signToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set("admin_token", token, {
    httpOnly: true,
    sameSite: "strict",
    maxAge: 60 * 60 * 8, // 8시간
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
