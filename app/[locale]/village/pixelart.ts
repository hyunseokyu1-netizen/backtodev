import * as THREE from "three";

// ─────────────────────────────────────────────
// 픽셀아트를 코드로 그리는 모듈.
// 스프라이트는 ASCII 행렬로 정의: 각 문자가 팔레트의 색 하나,
// '.' 또는 팔레트에 없는 문자는 투명 픽셀.
// ─────────────────────────────────────────────

export interface SpriteDef {
  rows: string[];
  palette: Record<string, string>;
}

/** 결정적 난수 (마운트마다 바닥 무늬가 바뀌지 않도록 시드 고정) */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pixelTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export interface SpriteTexture {
  texture: THREE.CanvasTexture;
  /** 픽셀 가로/세로 비율 계산용 */
  pxWidth: number;
  pxHeight: number;
}

export function createSpriteTexture(def: SpriteDef): SpriteTexture {
  const pxHeight = def.rows.length;
  const pxWidth = Math.max(...def.rows.map((r) => r.length));
  const canvas = document.createElement("canvas");
  canvas.width = pxWidth;
  canvas.height = pxHeight;
  const ctx = canvas.getContext("2d")!;
  def.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = def.palette[row[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  return { texture: pixelTexture(canvas), pxWidth, pxHeight };
}

// ─────────────────────────────────────────────
// 스프라이트 정의
// ─────────────────────────────────────────────

/** 우리 집 (프로필) — 붉은 지붕 작은 집, 22×16px */
export const HOME_SPRITE: SpriteDef = {
  palette: {
    R: "#c0503f", r: "#93392e",
    W: "#ead9b0", w: "#d6c290",
    D: "#8a5a33", d: "#5f3b1e",
    G: "#8fd3e8", g: "#3f3f46",
  },
  rows: [
    ".....RRRRRRRRRRRR.....",
    "....RRRRRRRRRRRRRR....",
    "...RRRRRRRRRRRRRRRR...",
    "..RRRRRRRRRRRRRRRRRR..",
    ".RRRRRRRRRRRRRRRRRRRR.",
    "RRRRRRRRRRRRRRRRRRRRRR",
    "rrrrrrrrrrrrrrrrrrrrrr",
    "WWWWWWWWWWWWWWWWWWWWWW",
    "WWgGGgWWWWWWWWWWgGGgWW",
    "WWgGGgWWWWWWWWWWgGGgWW",
    "WWgGGgWWWdDDdWWWgGGgWW",
    "WWWWWWWWWdDDdWWWWWWWWW",
    "WWWWWWWWWdDDdWWWWWWWWW",
    "WWWWWWWWWdDDdWWWWWWWWW",
    "WWWWWWWWWdDDdWWWWWWWWW",
    "wwwwwwwwwdDDdwwwwwwwww",
  ],
};

/** 도서관 (포스트) — 파란 지붕 큰 건물, 30×22px */
export const LIBRARY_SPRITE: SpriteDef = {
  palette: {
    B: "#3f6fb5", b: "#2c4f86",
    S: "#e3d5b8", s: "#cdbb95",
    D: "#8a5a33", d: "#5f3b1e",
    G: "#8fd3e8", g: "#3f3f46",
    Y: "#d9a441", y: "#a3762a",
  },
  rows: [
    "......BBBBBBBBBBBBBBBBBB......",
    ".....BBBBBBBBBBBBBBBBBBBB.....",
    "....BBBBBBBBBBBBBBBBBBBBBB....",
    "...BBBBBBBBBBBBBBBBBBBBBBBB...",
    "..BBBBBBBBBBBBBBBBBBBBBBBBBB..",
    ".BBBBBBBBBBBBBBBBBBBBBBBBBBBB.",
    "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "SSSSSSSSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSYYYYYYYYSSSSSSSSSSS",
    "SSSSSSSSSSSyyyyyyyySSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSgGGgSSSSSSSSSSSSSSSSgGGgSSS",
    "SSSgGGgSSSSSSSSSSSSSSSSgGGgSSS",
    "SSSgGGgSSSSSSdDDdSSSSSSgGGgSSS",
    "SSSgGGgSSSSSSdDDdSSSSSSgGGgSSS",
    "SSSSSSSSSSSSSdDDdSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSdDDdSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSdDDdSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSdDDdSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSdDDdSSSSSSSSSSSSS",
    "sssssssssssssdDDdsssssssssssss",
  ],
};

/** 공방 (프로젝트) — 회색 벽 + 굴뚝 + 주황 창(용광로 불빛), 24×18px */
export const LAB_SPRITE: SpriteDef = {
  palette: {
    A: "#565f6e", a: "#3e4450",
    K: "#9aa3ae", k: "#7c8590",
    D: "#8a5a33", d: "#5f3b1e",
    O: "#f2a341", g: "#3f3f46",
    C: "#4a4f57",
  },
  rows: [
    ".................CCC....",
    ".................CCC....",
    "....AAAAAAAAAAAAAAAA....",
    "...AAAAAAAAAAAAAAAAAA...",
    "..AAAAAAAAAAAAAAAAAAAA..",
    ".AAAAAAAAAAAAAAAAAAAAAA.",
    "AAAAAAAAAAAAAAAAAAAAAAAA",
    "aaaaaaaaaaaaaaaaaaaaaaaa",
    "KKKKKKKKKKKKKKKKKKKKKKKK",
    "KKKgOOgKKKKKKKKKKgOOgKKK",
    "KKKgOOgKKKKKKKKKKgOOgKKK",
    "KKKKKKKKKKKKKKKKKKKKKKKK",
    "KKKKKKKKKKdDDdKKKKKKKKKK",
    "KKKKKKKKKKdDDdKKKKKKKKKK",
    "KKKKKKKKKKdDDdKKKKKKKKKK",
    "KKKKKKKKKKdDDdKKKKKKKKKK",
    "KKKKKKKKKKdDDdKKKKKKKKKK",
    "kkkkkkkkkkdDDdkkkkkkkkkk",
  ],
};

/** 나무 — 12×12px */
export const TREE_SPRITE: SpriteDef = {
  palette: {
    F: "#3f9a4d",
    G: "#2e7d3b",
    g: "#1e5c2a",
    T: "#6b4226",
    t: "#4e2f18",
  },
  rows: [
    "....FFFF....",
    "..FFFGGFFF..",
    ".FFGGGGGGFF.",
    "GGGGGGGGGGGG",
    "GGGgGGGGgGGG",
    "GGGGGGGGGGGG",
    ".GGGgggGGGG.",
    "..GGGGGGGG..",
    "...gGGGGg...",
    ".....Tt.....",
    ".....Tt.....",
    "....tTTt....",
  ],
};

/** 책장 — 16×14px, 3단 선반에 색색의 책 */
export const BOOKSHELF_SPRITE: SpriteDef = {
  palette: {
    O: "#8a5a33",
    o: "#5f3b1e",
    "1": "#c94f4f",
    "2": "#4f7fc9",
    "3": "#4fa763",
    "4": "#c9a24f",
    "5": "#8a5fbf",
    "6": "#c97b4f",
  },
  rows: [
    "OOOOOOOOOOOOOOOO",
    "O14253614253614O",
    "O14253614253614O",
    "O14253614253614O",
    "OooooooooooooooO",
    "O36142536142536O",
    "O36142536142536O",
    "O36142536142536O",
    "OooooooooooooooO",
    "O52631452631452O",
    "O52631452631452O",
    "O52631452631452O",
    "OooooooooooooooO",
    "OOOOOOOOOOOOOOOO",
  ],
};

/** 침대 — 12×16px (우리 집) */
export const BED_SPRITE: SpriteDef = {
  palette: {
    W: "#8a5a33", w: "#5f3b1e",
    P: "#f0f0e0",
    S: "#d8d8c8",
    B: "#b5443c", b: "#8c2f2b",
  },
  rows: [
    "wWWWWWWWWWWw",
    "WPPPPPPPPPPW",
    "WPPPPPPPPPPW",
    "WSSSSSSSSSSW",
    "WBBBBBBBBBBW",
    "WBBBBBBBBBBW",
    "WBBbBBBBbBBW",
    "WBBBBBBBBBBW",
    "WBBBBBBBBBBW",
    "WBBbBBBBbBBW",
    "WBBBBBBBBBBW",
    "WBBBBBBBBBBW",
    "WBBbBBBBbBBW",
    "WBBBBBBBBBBW",
    "WBBBBBBBBBBW",
    "wWWWWWWWWWWw",
  ],
};

/** 책상 + 모니터 — 16×10px (우리 집, 프로필 상호작용 지점) */
export const DESK_SPRITE: SpriteDef = {
  palette: {
    M: "#2a2a30",
    m: "#7ec8e3",
    W: "#8a5a33", w: "#5f3b1e",
  },
  rows: [
    "....MMMMMMMM....",
    "....MmmmmmmM....",
    "....MmmmmmmM....",
    "....MMMMMMMM....",
    ".......MM.......",
    "WWWWWWWWWWWWWWWW",
    "wWWWWWWWWWWWWWWw",
    "wW............Ww",
    "wW............Ww",
    "ww............ww",
  ],
};

/** 화로 — 16×11px (공방 장식) */
export const FORGE_SPRITE: SpriteDef = {
  palette: {
    S: "#6b7280", s: "#4a4f57",
    K: "#1e1e22",
    F: "#f2a341", f: "#e2574c",
  },
  rows: [
    "..SSSSSSSSSSSS..",
    ".SSSSSSSSSSSSSS.",
    "SSSSSSSSSSSSSSSS",
    "SSSSKKKKKKKKSSSS",
    "SSSSKKFFFFKKSSSS",
    "SSSSKFFffFFKSSSS",
    "SSSSKFffffFKSSSS",
    "SSSSKKFFFFKKSSSS",
    "SSSSKKKKKKKKSSSS",
    "SSSSSSSSSSSSSSSS",
    "ssssssssssssssss",
  ],
};

/** 작업대 + 모루 — 16×8px (공방, 포트폴리오 상호작용 지점) */
export const WORKBENCH_SPRITE: SpriteDef = {
  palette: {
    A: "#3a3f47",
    T: "#c9a24f",
    W: "#8a5a33", w: "#5f3b1e",
  },
  rows: [
    "....AAAAAA......",
    ".....AAAA.......",
    "....AAAAAA......",
    "WWWWWWWWWWWTTWWW",
    "wWWWWWWWWWWWWWWw",
    "wW............Ww",
    "wW............Ww",
    "ww............ww",
  ],
};

/** 방명록 돌바위 — 14×9px (마을 오른쪽 아래 이스터에그) */
export const ROCK_SPRITE: SpriteDef = {
  palette: {
    G: "#8a939e",
    g: "#6b7280",
    d: "#4a4f57",
  },
  rows: [
    "....gGGGGg....",
    "..gGGGGGGGGg..",
    ".gGGGGGGGGGGg.",
    "gGGGGGGdGGGGGg",
    "gGGGGGGdGGGGGg",
    "gGGGGGdGGGGGGg",
    ".gGGGGdGGGGGg.",
    "..ggGGGGGGgg..",
    "..dddddddddd..",
  ],
};

/** 방명록 나무 몸통 — 16×15px, 가운데는 얼굴이 들어갈 자리라 비워둠 */
const GB_TREE_BASE: SpriteDef = {
  palette: {
    F: "#3f9a4d",
    G: "#2e7d3b",
    g: "#1e5c2a",
    P: "#e88fb7",
    T: "#6b4226",
    t: "#4e2f18",
  },
  rows: [
    "....FFFFFFFF....",
    "..FFFPGGGGFFFF..",
    ".FFGGGGGGGGGPFF.",
    ".FGGGGGGGGGGGGF.",
    "GGGGGGGGGGGGGGGG",
    "GGGGGGGGGGGGGGGG",
    "GGGGGGGGGGGGGGGG",
    "GGGGGGGGGGGGGGGG",
    "GGGGGGGGGGGGGGGG",
    ".GPGGGGGGGGGGGP.",
    "..gGGGGGGGGGGg..",
    "...ggGGGGGGgg...",
    "......tTTt......",
    "......tTTt......",
    ".....tTTTTt.....",
  ],
};

// 눈/입 글리프 — "1"이 칠해지는 픽셀
const EYE_GLYPHS: Record<string, string[]> = {
  ".": ["11", "11"],
  ">": ["100", "010", "100"],
  "<": ["001", "010", "001"],
  "-": ["111"],
  "^": ["010", "101"],
  _: ["111"],
};

const MOUTH_GLYPHS: Record<string, string[]> = {
  "-": ["1111"],
  "ㅠ": ["11111", "01010"],
  "ㅜ": ["11111", "00100"],
  "=": ["1111", "0000", "1111"],
  "+": ["010", "111", "010"],
  ".": ["11", "11"],
  "⏝": ["10001", "01110"],
  "⏜": ["01110", "10001"],
};

function drawGlyph(
  ctx: CanvasRenderingContext2D,
  glyph: string[],
  centerX: number,
  centerY: number,
  color: string
): void {
  const h = glyph.length;
  const w = glyph[0].length;
  const x0 = centerX - Math.floor(w / 2);
  const y0 = centerY - Math.floor(h / 2);
  ctx.fillStyle = color;
  for (let gy = 0; gy < h; gy++) {
    for (let gx = 0; gx < w; gx++) {
      if (glyph[gy][gx] === "1") ctx.fillRect(x0 + gx, y0 + gy, 1, 1);
    }
  }
}

/** 방명록 나무 — 나무 몸통에 눈/입을 합성해 표정 있는 나무를 만든다 (양쪽 눈 독립) */
export function createGuestbookTreeTexture(
  eyeL: string,
  eyeR: string,
  mouth: string
): SpriteTexture {
  const pxHeight = GB_TREE_BASE.rows.length;
  const pxWidth = GB_TREE_BASE.rows[0].length;
  const canvas = document.createElement("canvas");
  canvas.width = pxWidth;
  canvas.height = pxHeight;
  const ctx = canvas.getContext("2d")!;
  GB_TREE_BASE.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = GB_TREE_BASE.palette[row[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  });

  // 얼굴 — 잎보다 훨씬 어두운 색으로 그려 표정이 도드라지게
  const FACE = "#12300f";
  drawGlyph(ctx, EYE_GLYPHS[eyeL] ?? EYE_GLYPHS["."], 4, 5, FACE); // 왼쪽 눈
  drawGlyph(ctx, EYE_GLYPHS[eyeR] ?? EYE_GLYPHS["."], 11, 5, FACE); // 오른쪽 눈
  drawGlyph(ctx, MOUTH_GLYPHS[mouth] ?? MOUTH_GLYPHS["-"], 7, 8, FACE); // 입

  return { texture: pixelTexture(canvas), pxWidth, pxHeight };
}

/** 플레이어 캐릭터 — 12×16px */
export const PLAYER_SPRITE: SpriteDef = {
  palette: {
    H: "#3a2a1c",
    F: "#f0c8a0",
    E: "#222222",
    S: "#d94f43",
    P: "#3a4a8c",
    B: "#26262b",
  },
  rows: [
    "...HHHHHH...",
    "..HHHHHHHH..",
    "..HFFFFFFH..",
    "..FFEFFEFF..",
    "..FFFFFFFF..",
    "...FFFFFF...",
    "..SSSSSSSS..",
    ".SSSSSSSSSS.",
    ".FSSSSSSSSF.",
    "..SSSSSSSS..",
    "..SSSSSSSS..",
    "..PPPPPPPP..",
    "..PPP..PPP..",
    "..PPP..PPP..",
    "..BBB..BBB..",
    ".BBBB..BBBB.",
  ],
};

// ─────────────────────────────────────────────
// 바닥 텍스처 — 맵 전체를 한 장의 캔버스에 그림
// (잔디 노이즈 + 흙길 + 광장)
// ─────────────────────────────────────────────

const GROUND_PPU = 16; // ground pixels per world unit

export function createGroundTexture(
  mapW: number,
  mapH: number
): THREE.CanvasTexture {
  const W = mapW * GROUND_PPU;
  const H = mapH * GROUND_PPU;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const rand = mulberry32(20260710);

  // 월드 좌표(y 위쪽 +) → 캔버스 픽셀 좌표(y 아래쪽 +)
  const toPx = (wx: number, wy: number) => ({
    x: Math.round((wx + mapW / 2) * GROUND_PPU),
    y: Math.round((mapH / 2 - wy) * GROUND_PPU),
  });

  // 1) 잔디 베이스 + 노이즈
  ctx.fillStyle = "#3e8948";
  ctx.fillRect(0, 0, W, H);
  const grassShades = ["#46a24f", "#37793f", "#4aa151", "#356f3c"];
  const speckles = (W * H) / 7;
  for (let i = 0; i < speckles; i++) {
    ctx.fillStyle = grassShades[Math.floor(rand() * grassShades.length)];
    ctx.fillRect(Math.floor(rand() * W), Math.floor(rand() * H), 1, 1);
  }
  // 잔디 포기 (2px 세로선)
  for (let i = 0; i < (W * H) / 220; i++) {
    ctx.fillStyle = "#2f6b36";
    ctx.fillRect(Math.floor(rand() * W), Math.floor(rand() * (H - 2)), 1, 2);
  }
  // 꽃 (희귀)
  const flowers = ["#e8e26e", "#e88fb7", "#f0f0f0"];
  for (let i = 0; i < (W * H) / 2600; i++) {
    ctx.fillStyle = flowers[Math.floor(rand() * flowers.length)];
    ctx.fillRect(Math.floor(rand() * W), Math.floor(rand() * H), 1, 1);
  }

  // 2) 흙길 — 월드 좌표 사각형 채우기
  const pathRects: [number, number, number, number][] = [
    [-12.8, -2.8, 12.8, -1.2], // 가로 중앙길
    [-12.8, -2.0, -11.2, 2.2], // 우리 집 진입로
    [-0.8, -2.0, 0.8, 4.0], // 도서관 진입로
    [11.2, -2.0, 12.8, 2.0], // 공방 진입로
  ];
  const drawnPath: { x: number; y: number; w: number; h: number }[] = [];
  ctx.fillStyle = "#bfa065";
  for (const [x0, y0, x1, y1] of pathRects) {
    const a = toPx(x0, y1); // y1이 위쪽
    const b = toPx(x1, y0);
    ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    drawnPath.push({ x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y });
  }

  // 3) 광장 — 마을 중앙 타원 (픽셀 단위로 그려 AA 블러 방지)
  const plaza = { cx: 0, cy: -2, rx: 3.2, ry: 2.1 };
  const p0 = toPx(plaza.cx - plaza.rx, plaza.cy + plaza.ry);
  const p1 = toPx(plaza.cx + plaza.rx, plaza.cy - plaza.ry);
  const pcx = (p0.x + p1.x) / 2;
  const pcy = (p0.y + p1.y) / 2;
  const prx = (p1.x - p0.x) / 2;
  const pry = (p1.y - p0.y) / 2;
  for (let py = p0.y; py < p1.y; py++) {
    for (let px = p0.x; px < p1.x; px++) {
      const nx = (px + 0.5 - pcx) / prx;
      const ny = (py + 0.5 - pcy) / pry;
      if (nx * nx + ny * ny <= 1) {
        ctx.fillStyle = "#bfa065";
        ctx.fillRect(px, py, 1, 1);
      }
    }
  }
  drawnPath.push({ x: p0.x, y: p0.y, w: p1.x - p0.x, h: p1.y - p0.y });

  // 4) 길 위에 어두운 점 노이즈 (흙 질감)
  const pathShades = ["#a3854e", "#d1b57a", "#8f7440"];
  for (const r of drawnPath) {
    const n = (r.w * r.h) / 10;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = pathShades[Math.floor(rand() * pathShades.length)];
      ctx.fillRect(
        r.x + Math.floor(rand() * r.w),
        r.y + Math.floor(rand() * r.h),
        1,
        1
      );
    }
  }

  // 5) 광장 남쪽 잔디에 마을 이름 새기기 (깎은 잔디 느낌의 짙은 초록)
  const title = "HYUNSEOK'S VILLAGE";
  const titleScale = 3;
  const titleW = measurePixelText(title) * titleScale;
  const titlePos = toPx(0, -6.6);
  drawPixelText(ctx, title, Math.round(titlePos.x - titleW / 2), titlePos.y, titleScale, "#2c6134");

  return pixelTexture(canvas);
}

// ─────────────────────────────────────────────
// 건물 간판 — 3×5 픽셀 폰트로 영문 텍스트를 나무판에 새김
// ─────────────────────────────────────────────

// 가변폭 픽셀 폰트 (높이 5px, 글자마다 폭 1~5px)
const PIXEL_FONT: Record<string, string[]> = {
  A: ["010", "101", "111", "101", "101"],
  B: ["110", "101", "110", "101", "110"],
  C: ["111", "100", "100", "100", "111"],
  D: ["110", "101", "101", "101", "110"],
  E: ["111", "100", "110", "100", "111"],
  G: ["111", "100", "101", "101", "111"],
  H: ["101", "101", "111", "101", "101"],
  I: ["111", "010", "010", "010", "111"],
  K: ["101", "110", "100", "110", "101"],
  L: ["100", "100", "100", "100", "111"],
  M: ["10001", "11011", "10101", "10001", "10001"],
  N: ["1001", "1101", "1011", "1001", "1001"],
  O: ["111", "101", "101", "101", "111"],
  P: ["110", "101", "110", "100", "100"],
  R: ["110", "101", "110", "101", "101"],
  S: ["011", "100", "010", "001", "110"],
  T: ["111", "010", "010", "010", "010"],
  U: ["101", "101", "101", "101", "111"],
  V: ["101", "101", "101", "101", "010"],
  W: ["10001", "10001", "10101", "11011", "10001"],
  Y: ["101", "101", "010", "010", "010"],
  "'": ["1", "1", "0", "0", "0"],
  " ": ["000", "000", "000", "000", "000"],
};

function measurePixelText(text: string): number {
  return (
    text
      .toUpperCase()
      .split("")
      .reduce((w, ch) => w + (PIXEL_FONT[ch] ?? PIXEL_FONT[" "])[0].length + 1, 0) - 1
  );
}

/** 캔버스에 픽셀 폰트 텍스트를 그림. (x, y)는 좌상단, scale은 폰트 픽셀당 캔버스 픽셀 수 */
function drawPixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  scale: number,
  color: string
): void {
  ctx.fillStyle = color;
  let cursor = x;
  for (const ch of text.toUpperCase()) {
    const glyph = PIXEL_FONT[ch] ?? PIXEL_FONT[" "];
    const glyphW = glyph[0].length;
    glyph.forEach((row, gy) => {
      for (let gx = 0; gx < glyphW; gx++) {
        if (row[gx] === "1") {
          ctx.fillRect(cursor + gx * scale, y + gy * scale, scale, scale);
        }
      }
    });
    cursor += (glyphW + 1) * scale;
  }
}

export function createSignTexture(text: string): SpriteTexture {
  const textW = measurePixelText(text);
  const pxWidth = textW + 6; // 테두리 1px + 안쪽 여백 2px씩
  const pxHeight = 5 + 6;
  const canvas = document.createElement("canvas");
  canvas.width = pxWidth;
  canvas.height = pxHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#3d2413"; // 테두리
  ctx.fillRect(0, 0, pxWidth, pxHeight);
  ctx.fillStyle = "#7a4a2b"; // 나무판
  ctx.fillRect(1, 1, pxWidth - 2, pxHeight - 2);
  drawPixelText(ctx, text, 3, 3, 1, "#f5ead0");
  return { texture: pixelTexture(canvas), pxWidth, pxHeight };
}

// ─────────────────────────────────────────────
// 실내 배경 — 바닥 + 북쪽 벽 + 출구 매트 (도서관/집/공방 테마 공유)
// ─────────────────────────────────────────────

export interface InteriorTheme {
  floorBase: string;
  floorSeam: string;
  grains: string[];
  wallBase: string;
  wallPanel: string;
  wallTrim: string;
  wallShadow: string;
  seed: number;
}

export const INTERIOR_THEMES: Record<"library" | "home" | "lab", InteriorTheme> = {
  library: {
    floorBase: "#a87b4e",
    floorSeam: "#7c5836",
    grains: ["#96693f", "#b58a5c", "#8f6a42"],
    wallBase: "#5a4632",
    wallPanel: "#4a3a29",
    wallTrim: "#8a6a45",
    wallShadow: "#6f5436",
    seed: 20260711,
  },
  home: {
    floorBase: "#b58a5c",
    floorSeam: "#8a6540",
    grains: ["#a87b4e", "#c1996b", "#9c7148"],
    wallBase: "#6b5138",
    wallPanel: "#59422d",
    wallTrim: "#96754e",
    wallShadow: "#7d5f40",
    seed: 20260712,
  },
  lab: {
    floorBase: "#7c8590",
    floorSeam: "#5f6772",
    grains: ["#6b7280", "#8a939e", "#646c78"],
    wallBase: "#4a4f57",
    wallPanel: "#3e4450",
    wallTrim: "#6b7280",
    wallShadow: "#565f6e",
    seed: 20260713,
  },
};

export function createInteriorBackgroundTexture(
  mapW: number,
  mapH: number,
  wallHeight: number,
  theme: InteriorTheme
): THREE.CanvasTexture {
  const W = mapW * GROUND_PPU;
  const H = mapH * GROUND_PPU;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const rand = mulberry32(theme.seed);

  // 1) 바닥 — 가로 널빤지 + 어긋난 세로 이음새 + 결 노이즈
  ctx.fillStyle = theme.floorBase;
  ctx.fillRect(0, 0, W, H);
  const plankH = 16;
  for (let py = 0; py < H; py += plankH) {
    ctx.fillStyle = theme.floorSeam; // 널빤지 가로 이음새
    ctx.fillRect(0, py, W, 1);
    const offset = ((py / plankH) % 2) * 32; // 세로 이음새를 벽돌처럼 어긋나게
    for (let px = offset; px < W; px += 64) {
      ctx.fillRect(px, py, 1, plankH);
    }
  }
  for (let i = 0; i < (W * H) / 12; i++) {
    ctx.fillStyle = theme.grains[Math.floor(rand() * theme.grains.length)];
    ctx.fillRect(Math.floor(rand() * W), Math.floor(rand() * H), 1, 1);
  }

  // 2) 북쪽 벽 — 패널 + 하단 트림
  const wallPx = Math.round(wallHeight * GROUND_PPU);
  ctx.fillStyle = theme.wallBase;
  ctx.fillRect(0, 0, W, wallPx);
  ctx.fillStyle = theme.wallPanel; // 세로 패널 라인
  for (let px = 0; px < W; px += 32) {
    ctx.fillRect(px, 0, 1, wallPx);
  }
  ctx.fillStyle = theme.wallTrim; // 하단 트림
  ctx.fillRect(0, wallPx - 4, W, 4);
  ctx.fillStyle = theme.wallShadow; // 벽 밑 그림자
  ctx.fillRect(0, wallPx, W, 2);

  // 3) 출구 매트 — 남쪽 중앙 (여기로 걸어가면 마을로 복귀)
  const matW = 2 * GROUND_PPU;
  const matH = Math.round(0.8 * GROUND_PPU);
  const matX = Math.round(W / 2 - matW / 2);
  const matY = H - matH;
  ctx.fillStyle = "#7a2e28";
  ctx.fillRect(matX, matY, matW, matH);
  ctx.fillStyle = "#a8433a";
  ctx.fillRect(matX + 2, matY + 2, matW - 4, matH - 2);
  ctx.fillStyle = "#c9776b"; // 매트 무늬 점
  for (let px = matX + 5; px < matX + matW - 4; px += 6) {
    ctx.fillRect(px, matY + Math.round(matH / 2), 2, 2);
  }

  return pixelTexture(canvas);
}
