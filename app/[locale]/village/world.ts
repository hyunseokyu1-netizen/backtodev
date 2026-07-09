// ─────────────────────────────────────────────
// 마을 배치 데이터 — 좌표는 world unit, 원점은 맵 중앙, y는 북쪽이 +
// ─────────────────────────────────────────────

export const MAP_WIDTH = 40;
export const MAP_HEIGHT = 30;

export interface AABB {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface BuildingDef {
  id: "home" | "library" | "lab";
  /** 스프라이트 중심 좌표 */
  x: number;
  y: number;
  /** 월드 가로 크기 (세로는 스프라이트 픽셀 비율로 계산) */
  width: number;
  /** 스프라이트 높이 중 벽(충돌 대상) 비율 — 지붕 뒤로는 걸어 들어갈 수 있음 */
  wallRatio: number;
  /** 영문 간판 텍스트 (3×5 픽셀 폰트, A–Z와 공백만) */
  sign: string;
  /** 간판 중심 높이 — footY + height * signRatio */
  signRatio: number;
}

export const BUILDINGS: BuildingDef[] = [
  { id: "home", x: -12, y: 4.2, width: 6, wallRatio: 9 / 16, sign: "MY HOME", signRatio: 0.62 },
  { id: "library", x: 0, y: 7, width: 9, wallRatio: 14 / 22, sign: "LIBRARY", signRatio: 0.545 },
  { id: "lab", x: 12, y: 4.2, width: 6.5, wallRatio: 10 / 18, sign: "WORKSHOP", signRatio: 0.62 },
];

/** 나무 위치 (길과 건물을 피해 가장자리 위주로 배치) */
export const TREES: { x: number; y: number }[] = [
  { x: -17, y: 12 },
  { x: -13.5, y: 13 },
  { x: -16, y: 8 },
  { x: -18, y: -3 },
  { x: -16.5, y: -9 },
  { x: -13, y: -12.5 },
  { x: 17, y: 12.5 },
  { x: 14, y: 11 },
  { x: 17.5, y: 6 },
  { x: 18, y: -4 },
  { x: 15.5, y: -10 },
  { x: 12.5, y: -13 },
  { x: -6.5, y: 11.5 },
  { x: 6.5, y: 11.5 },
  { x: -4, y: -12.5 },
  { x: 4.5, y: -13 },
  { x: -8, y: -11 },
  { x: 9, y: -11.5 },
];

/** 플레이어 시작 위치 (마을 광장) */
export const PLAYER_START = { x: 0, y: -4 };

// ─────────────────────────────────────────────
// 씬(장소) 정의 — Phase 3
// ─────────────────────────────────────────────

export type WorldId = "village" | "library" | "home" | "lab";

/** 상호작용 존 종류 — SPACE를 눌렀을 때 열리는 모달을 결정 */
export type InteractKind = "shelf" | "profile" | "portfolio" | "plant" | "tree";

/** 밟으면 다른 씬으로 이동하는 트리거 존 */
export interface Trigger {
  box: AABB;
  target: WorldId;
  /** 도착한 씬에서의 플레이어 스폰 위치 */
  spawn: { x: number; y: number };
}

/** 도서관 내부 맵 */
export const LIBRARY = {
  width: 22,
  height: 14,
  /** 북쪽 벽 두께 (world units) — 배경 텍스처와 충돌 박스가 같이 사용 */
  wallHeight: 2.4,
  /** 도서관에 들어왔을 때 스폰 위치 (남쪽 출구 매트 위) */
  spawn: { x: 0, y: -5.2 },
  /** 남쪽 중앙 출구 매트 — 밟으면 마을로 복귀 */
  exitTrigger: { minX: -1.1, maxX: 1.1, minY: -7, maxY: -6.4 } as AABB,
};

// ─────────────────────────────────────────────
// 책장 카테고리 — Phase 4
// ─────────────────────────────────────────────

export interface ShelfDef {
  id: "recent" | "web" | "app" | "ai";
  /** 책장 x 좌표 (북쪽 벽 아래 일렬 배치) */
  x: number;
  labelKo: string;
  labelEn: string;
  /** 책장 위에 거는 영문 간판 텍스트 (픽셀 폰트) */
  sign: string;
  /** 정규화된 태그가 이 목록과 겹치면 포함. 생략하면 전체 포스트(최신순) */
  tags?: string[];
}

/** 태그 표기 편차 흡수: "Next.js"/"NextJS" → "nextjs", "Claude Code" → "claudecode" */
export function normalizeTag(tag: string): string {
  return tag.toLowerCase().replace(/[\s.\-_]/g, "");
}

export const SHELVES: ShelfDef[] = [
  { id: "recent", x: -8.25, labelKo: "최신 글", labelEn: "Recent Posts", sign: "RECENT" },
  {
    id: "web",
    x: -2.75,
    labelKo: "웹 개발",
    labelEn: "Web Dev",
    sign: "WEB",
    tags: [
      "nextjs", "react", "vercel", "seo", "i18n", "nextintl",
      "supabase", "typescript", "tailwindcss", "css", "웹",
    ],
  },
  {
    id: "app",
    x: 2.75,
    labelKo: "앱 개발",
    labelEn: "App Dev",
    sign: "APP",
    tags: [
      "android", "reactnative", "expo", "googleplay",
      "앱출시", "ios", "앱",
    ],
  },
  {
    id: "ai",
    x: 8.25,
    labelKo: "AI & 자동화",
    labelEn: "AI & Automation",
    sign: "AI",
    tags: [
      "ai", "claudecode", "claude", "claudeapi", "자동화",
      "playwright", "mcp", "githubactions", "llm",
    ],
  },
];

/** 우리 집 / 공방 내부 공용 규격 (작은 방) */
export const ROOM = {
  width: 14,
  height: 10,
  wallHeight: 2.2,
  /** 방에 들어왔을 때 스폰 위치 (남쪽 출구 매트 위) */
  spawn: { x: 0, y: -3.4 },
  /** 남쪽 중앙 출구 매트 — 밟으면 마을로 복귀 */
  exitTrigger: { minX: -1.1, maxX: 1.1, minY: -5, maxY: -4.4 } as AABB,
};

/** 각 건물에서 나왔을 때 마을 스폰 위치 (문 트리거에 안 겹치게 남쪽으로) */
export const VILLAGE_SPAWN_FROM_LIBRARY = { x: 0, y: 2.6 };
export const VILLAGE_SPAWN_FROM_HOME = { x: -12, y: 0.9 };
export const VILLAGE_SPAWN_FROM_LAB = { x: 12, y: 0.65 };

/**
 * Y-소팅: 발밑(footY)이 남쪽일수록 카메라에 가깝게(z 크게).
 * 바닥은 z=0, 스프라이트는 z ∈ [1, 1.9] 범위에서 정렬된다.
 */
export function zForFoot(footY: number): number {
  return 1 + (MAP_HEIGHT / 2 - footY) * 0.03;
}

// ─────────────────────────────────────────────
// 방명록 — 돌바위에서 글을 쓰면 잔디밭에 나무가 심어짐
// (이 섹션은 API 라우트에서도 import하므로 순수 데이터/로직만 둘 것)
// ─────────────────────────────────────────────

export interface GuestbookEntry {
  id: string;
  name: string;
  message: string;
  date: string;
  /** 나무가 심어진 위치 (world 좌표, 서버가 결정) */
  x: number;
  y: number;
  /** 나무 표정 (서버가 심을 때 랜덤으로 결정, 이후 고정) — 왼눈/오른눈 각각 독립 */
  eyeL?: string;
  eyeR?: string;
  mouth?: string;
  /** @deprecated 초기 데이터 호환용 (양쪽 눈 동일) */
  eyes?: string;
}

/** 나무 표정 후보 — 서버가 심을 때 눈 2개, 입 1개를 각각 뽑는다 */
export const GB_EYES = [".", ">", "<", "-", "^", "_"] as const;
export const GB_MOUTHS = ["-", "ㅠ", "ㅜ", "=", "+", ".", "⏝", "⏜"] as const;

export const GUESTBOOK_NAME_MAX = 20;
export const GUESTBOOK_MESSAGE_MAX = 200;
export const GUESTBOOK_MAX_ENTRIES = 500;

/** 방명록 돌바위 위치 (마을 오른쪽 아래) */
export const ROCK = { x: 16.8, y: -12.4 };

/** 나무 심기 금지 구역 — 건물·길·광장·마을 이름·바위 주변 */
const NO_PLANT_ZONES: AABB[] = [
  { minX: -15.5, maxX: -8.5, minY: 0.4, maxY: 6.6 }, // 우리 집 + 문 앞
  { minX: -5.2, maxX: 5.2, minY: 2.0, maxY: 10.5 }, // 도서관 + 문 앞
  { minX: 8.4, maxX: 15.6, minY: 0.2, maxY: 6.7 }, // 공방 + 문 앞
  { minX: -13.6, maxX: 13.6, minY: -3.4, maxY: -0.6 }, // 가로 중앙길
  { minX: -13.6, maxX: -10.4, minY: -3.0, maxY: 2.8 }, // 집 진입로
  { minX: -1.6, maxX: 1.6, minY: -3.0, maxY: 4.6 }, // 도서관 진입로
  { minX: 10.4, maxX: 13.6, minY: -3.0, maxY: 2.6 }, // 공방 진입로
  { minX: -4.0, maxX: 4.0, minY: -4.7, maxY: 0.7 }, // 광장
  { minX: -8.0, maxX: 8.0, minY: -8.0, maxY: -6.2 }, // HYUNSEOK'S VILLAGE 텍스트
  { minX: 14.8, maxX: 18.6, minY: -14.0, maxY: -11.2 }, // 방명록 바위
];

/**
 * 잔디밭에서 나무 심을 빈자리를 찾는다 (rejection sampling).
 * taken = 이미 심어진 방명록 나무들. 장식 나무(TREES)와도 거리를 둔다.
 */
export function findPlantingSpot(
  taken: { x: number; y: number }[],
  rnd: () => number = Math.random
): { x: number; y: number } | null {
  for (let i = 0; i < 300; i++) {
    const x = -18 + rnd() * 36;
    const y = -13 + rnd() * 25.5; // y ∈ [-13, 12.5]
    const blocked = NO_PLANT_ZONES.some(
      (b) => x > b.minX && x < b.maxX && y > b.minY && y < b.maxY
    );
    if (blocked) continue;
    const tooClose =
      taken.some((t) => Math.hypot(t.x - x, t.y - y) < 1.8) ||
      TREES.some((t) => Math.hypot(t.x - x, t.y - y) < 1.8);
    if (tooClose) continue;
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  }
  return null;
}
