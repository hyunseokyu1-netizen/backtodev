import { NextResponse } from "next/server";
import { readGuestbook, saveGuestbook } from "@/lib/guestbook";
import {
  findPlantingSpot,
  GUESTBOOK_NAME_MAX,
  GUESTBOOK_MESSAGE_MAX,
  GUESTBOOK_MAX_ENTRIES,
  GB_EYES,
  GB_MOUTHS,
  type GuestbookEntry,
} from "@/app/[locale]/village/world";

// 서버리스 인스턴스 안에서만 유효한 간이 스로틀 (완벽하지 않지만 최소 방어선)
const lastPostByIp = new Map<string, number>();
const THROTTLE_MS = 60_000;

function sanitize(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  // 제어문자 제거 + 공백 정리 (방명록은 한 줄 메시지)
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || cleaned.length > maxLen) return null;
  return cleaned;
}

export async function GET() {
  const { entries } = await readGuestbook();
  return NextResponse.json({ entries });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  // 허니팟 — 봇이 채우는 숨은 필드
  if (body.website) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const name = sanitize(body.name, GUESTBOOK_NAME_MAX);
  const message = sanitize(body.message, GUESTBOOK_MESSAGE_MAX);
  if (!name || !message) {
    return NextResponse.json(
      { error: "이름과 메시지를 확인해 주세요." },
      { status: 400 }
    );
  }

  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  const last = lastPostByIp.get(ip);
  if (last && Date.now() - last < THROTTLE_MS) {
    return NextResponse.json(
      { error: "나무는 1분에 한 그루만 심을 수 있어요." },
      { status: 429 }
    );
  }

  const { entries, sha } = await readGuestbook();
  if (entries.length >= GUESTBOOK_MAX_ENTRIES) {
    return NextResponse.json(
      { error: "숲이 가득 찼어요. 다음 시즌을 기다려 주세요 🌲" },
      { status: 403 }
    );
  }

  const spot = findPlantingSpot(entries);
  if (!spot) {
    return NextResponse.json(
      { error: "빈 잔디를 찾지 못했어요. 잠시 후 다시 시도해 주세요." },
      { status: 409 }
    );
  }

  const entry: GuestbookEntry = {
    id: `gb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    message,
    date: new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }),
    x: spot.x,
    y: spot.y,
    // 나무 표정 — 심는 순간 정해져 평생 유지된다 (양쪽 눈 독립 추첨)
    eyeL: GB_EYES[Math.floor(Math.random() * GB_EYES.length)],
    eyeR: GB_EYES[Math.floor(Math.random() * GB_EYES.length)],
    mouth: GB_MOUTHS[Math.floor(Math.random() * GB_MOUTHS.length)],
  };

  entries.push(entry);
  await saveGuestbook(entries, sha, name);
  lastPostByIp.set(ip, Date.now());

  return NextResponse.json({ entry });
}
