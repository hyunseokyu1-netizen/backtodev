import { NextResponse } from "next/server";
import { readGuestbook, saveGuestbook } from "@/lib/guestbook";
import { GitHubApiError } from "@/lib/github";
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
const MAX_BODY_LENGTH = 2_048;
const MAX_SAVE_ATTEMPTS = 3;

type Locale = "ko" | "en";

function errorResponse(
  locale: Locale,
  ko: string,
  en: string,
  status: number
) {
  return NextResponse.json({ error: locale === "ko" ? ko : en }, { status });
}

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
  try {
    const { entries } = await readGuestbook();
    return NextResponse.json({ entries });
  } catch (error) {
    console.error("Failed to read guestbook", error);
    return NextResponse.json(
      { error: "방명록을 불러오지 못했습니다." },
      { status: 503 }
    );
  }
}

export async function POST(req: Request) {
  const fallbackLocale: Locale = req.headers
    .get("accept-language")
    ?.toLowerCase()
    .startsWith("en")
    ? "en"
    : "ko";

  if (!req.headers.get("content-type")?.startsWith("application/json")) {
    return errorResponse(
      fallbackLocale,
      "JSON 요청만 허용됩니다.",
      "Only JSON requests are accepted.",
      415
    );
  }

  const rawBody = await req.text();
  if (rawBody.length > MAX_BODY_LENGTH) {
    return errorResponse(
      fallbackLocale,
      "요청이 너무 큽니다.",
      "The request is too large.",
      413
    );
  }

  const body = (() => {
    try {
      return JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return null;
    }
  })();
  if (!body) {
    return errorResponse(
      fallbackLocale,
      "잘못된 요청입니다.",
      "Invalid request.",
      400
    );
  }

  const locale: Locale = body.locale === "en" ? "en" : fallbackLocale;

  // 허니팟 — 봇이 채우는 숨은 필드
  if (body.website) {
    return errorResponse(locale, "잘못된 요청입니다.", "Invalid request.", 400);
  }

  const name = sanitize(body.name, GUESTBOOK_NAME_MAX);
  const message = sanitize(body.message, GUESTBOOK_MESSAGE_MAX);
  if (!name || !message) {
    return errorResponse(
      locale,
      "이름과 메시지를 확인해 주세요.",
      "Please check your name and message.",
      400
    );
  }

  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  const last = lastPostByIp.get(ip);
  if (last && Date.now() - last < THROTTLE_MS) {
    return errorResponse(
      locale,
      "나무는 1분에 한 그루만 심을 수 있어요.",
      "You can plant one tree per minute.",
      429
    );
  }

  for (let attempt = 0; attempt < MAX_SAVE_ATTEMPTS; attempt += 1) {
    try {
      const { entries, sha } = await readGuestbook();
      if (entries.length >= GUESTBOOK_MAX_ENTRIES) {
        return errorResponse(
          locale,
          "숲이 가득 찼어요. 다음 시즌을 기다려 주세요 🌲",
          "The forest is full. Please wait for the next season. 🌲",
          403
        );
      }

      const spot = findPlantingSpot(entries);
      if (!spot) {
        return errorResponse(
          locale,
          "빈 잔디를 찾지 못했어요. 잠시 후 다시 시도해 주세요.",
          "No empty grass was found. Please try again shortly.",
          409
        );
      }

      const entry: GuestbookEntry = {
        id: `gb_${crypto.randomUUID()}`,
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
    } catch (error) {
      const canRetry = error instanceof GitHubApiError && error.status === 409;
      if (canRetry && attempt < MAX_SAVE_ATTEMPTS - 1) continue;

      console.error("Failed to save guestbook entry", error);
      return errorResponse(
        locale,
        "나무를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.",
        "The tree could not be saved. Please try again shortly.",
        503
      );
    }
  }

  return errorResponse(
    locale,
    "나무를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.",
    "The tree could not be saved. Please try again shortly.",
    503
  );
}
