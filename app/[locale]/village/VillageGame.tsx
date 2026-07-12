"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  createGroundTexture,
  createInteriorBackgroundTexture,
  createSignTexture,
  createSpriteTexture,
  INTERIOR_THEMES,
  HOME_SPRITE,
  LIBRARY_SPRITE,
  LAB_SPRITE,
  TREE_SPRITE,
  BOOKSHELF_SPRITE,
  BED_SPRITE,
  DESK_SPRITE,
  FORGE_SPRITE,
  WORKBENCH_SPRITE,
  ROCK_SPRITE,
  createGuestbookTreeTexture,
  PLAYER_SPRITE,
  type SpriteDef,
  type SpriteTexture,
} from "./pixelart";
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  BUILDINGS,
  TREES,
  PLAYER_START,
  LIBRARY,
  ROOM,
  ROCK,
  SHELVES,
  VILLAGE_SPAWN_FROM_LIBRARY,
  VILLAGE_SPAWN_FROM_HOME,
  VILLAGE_SPAWN_FROM_LAB,
  GUESTBOOK_NAME_MAX,
  GUESTBOOK_MESSAGE_MAX,
  normalizeTag,
  zForFoot,
  type AABB,
  type GuestbookEntry,
  type ShelfDef,
  type Trigger,
  type WorldId,
} from "./world";
import { getProfile, getProjects } from "./content";

/** 서버에서 내려주는 포스트 메타 (frontmatter 요약) */
export interface VillagePost {
  slug: string;
  title: string;
  date: string;
  tags: string[];
}

/** 상호작용 대상 — 프롬프트와 모달이 공유 */
type Interact =
  | { kind: "shelf"; shelfId: ShelfDef["id"] }
  | { kind: "profile" }
  | { kind: "portfolio" }
  | { kind: "plant" }
  | { kind: "tree"; entry: GuestbookEntry };

/** 모달 상태 — 상호작용 + 나무 심기 완료 안내 */
type ModalState = Interact | { kind: "planted" };

function sameInteract(a: Interact | null, b: Interact | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind !== b.kind) return false;
  if (a.kind === "shelf" && b.kind === "shelf") return a.shelfId === b.shelfId;
  if (a.kind === "tree" && b.kind === "tree") return a.entry.id === b.entry.id;
  return true;
}

// ---------- 게임 상수 ----------
const VIEW_HEIGHT = 14; // 카메라에 보이는 세로 범위 (작을수록 줌인)
const PLAYER_SPEED = 7; // units / sec
const CAMERA_DAMP = 6; // 카메라 감쇠 계수 (클수록 빨리 붙음)
const MAX_DELTA = 0.05; // 탭 복귀 시 순간이동 방지용 delta 상한
const FADE_MS = 380; // 씬 전환 페이드 시간 (CSS transition과 맞출 것)
const RECENT_COUNT = 20; // "최신 글" 책장에 꽂는 권수
const SIGN_PPU = 8; // 간판 텍스처의 unit당 픽셀 수 (작을수록 간판이 커짐)

// 플레이어 스프라이트 크기 (world units)
const PLAYER_W = 0.95;
const PLAYER_H = (16 / 12) * PLAYER_W; // 스프라이트 픽셀 비율 12×16 유지
// 충돌은 발밑 박스만 사용 — 머리가 벽 스프라이트에 겹쳐도 통과 안 막힘 (RPG 관례)
const FEET_HALF_W = 0.4;
const FEET_HEIGHT = 0.5;

// e.key 대신 e.code 사용 — 한글 IME가 켜져 있어도 동작
const MOVE_KEYS: Record<string, [number, number]> = {
  KeyW: [0, 1],
  ArrowUp: [0, 1],
  KeyS: [0, -1],
  ArrowDown: [0, -1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

/** 씬 하나 = 지도 + 충돌 박스 + 트리거 존 + 상호작용 존 */
interface GameWorld {
  scene: THREE.Scene;
  colliders: AABB[];
  triggers: Trigger[];
  zones: { box: AABB; interact: Interact }[];
  mapW: number;
  mapH: number;
}

/** 스프라이트 텍스처 → 투명 컷아웃 플레인 메시. 세로 크기는 픽셀 비율로 계산 */
function meshFromSpriteTexture(
  st: SpriteTexture,
  worldWidth: number
): { mesh: THREE.Mesh; width: number; height: number } {
  const height = (st.pxHeight / st.pxWidth) * worldWidth;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(worldWidth, height),
    new THREE.MeshBasicMaterial({
      map: st.texture,
      transparent: true,
      alphaTest: 0.5, // 컷아웃 방식 — depth buffer로 Y-소팅이 그대로 동작
      side: THREE.DoubleSide, // scale.x = -1 반전 시 backface culling으로 사라지는 것 방지
    })
  );
  return { mesh, width: worldWidth, height };
}

function createSpriteMesh(def: SpriteDef, worldWidth: number) {
  return meshFromSpriteTexture(createSpriteTexture(def), worldWidth);
}

/** 방명록 나무 한 그루를 마을 씬에 추가 (초기 로드 + 새로 심을 때 공용) */
function addGuestbookTree(world: GameWorld, entry: GuestbookEntry) {
  const { mesh, height } = meshFromSpriteTexture(
    createGuestbookTreeTexture(
      entry.eyeL ?? entry.eyes ?? ".",
      entry.eyeR ?? entry.eyes ?? ".",
      entry.mouth ?? "-"
    ),
    2.0
  );
  const footY = entry.y - height / 2;
  mesh.position.set(entry.x, entry.y, zForFoot(footY));
  world.scene.add(mesh);
  world.colliders.push({
    minX: entry.x - 0.35,
    maxX: entry.x + 0.35,
    minY: footY,
    maxY: footY + 0.5,
  });
  world.zones.push({
    box: {
      minX: entry.x - 1.3,
      maxX: entry.x + 1.3,
      minY: footY - 1.1,
      maxY: footY + 0.5,
    },
    interact: { kind: "tree", entry },
  });
}

type BuildingDefId = (typeof BUILDINGS)[number]["id"];

/** 마을 씬 구성 */
function buildVillage(guestbook: GuestbookEntry[]): GameWorld {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#10140d");
  const colliders: AABB[] = [];
  const triggers: Trigger[] = [];
  const zones: GameWorld["zones"] = [];

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP_WIDTH, MAP_HEIGHT),
    new THREE.MeshBasicMaterial({ map: createGroundTexture(MAP_WIDTH, MAP_HEIGHT) })
  );
  scene.add(ground);

  const doorSpawns: Record<BuildingDefId, { x: number; y: number }> = {
    home: ROOM.spawn,
    library: LIBRARY.spawn,
    lab: ROOM.spawn,
  };

  for (const def of BUILDINGS) {
    const sprite =
      def.id === "home"
        ? HOME_SPRITE
        : def.id === "library"
          ? LIBRARY_SPRITE
          : LAB_SPRITE;
    const { mesh, width, height } = createSpriteMesh(sprite, def.width);
    const footY = def.y - height / 2;
    mesh.position.set(def.x, def.y, zForFoot(footY));
    scene.add(mesh);

    // 영문 간판 — 건물 스프라이트보다 살짝 앞(z+0.05)에 부착
    const sign = createSignTexture(def.sign);
    const signMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(sign.pxWidth / SIGN_PPU, sign.pxHeight / SIGN_PPU),
      new THREE.MeshBasicMaterial({ map: sign.texture })
    );
    signMesh.position.set(def.x, footY + height * def.signRatio, zForFoot(footY) + 0.05);
    scene.add(signMesh);

    // 벽 부분만 충돌 — 지붕 위쪽(북쪽)으로는 걸어 들어가 가려질 수 있음
    colliders.push({
      minX: def.x - (width / 2) * 0.94,
      maxX: def.x + (width / 2) * 0.94,
      minY: footY,
      maxY: footY + height * def.wallRatio,
    });

    // 문 앞 트리거 — 문으로 걸어가면 내부로 진입
    triggers.push({
      box: {
        minX: def.x - 0.85,
        maxX: def.x + 0.85,
        minY: footY - 0.45,
        maxY: footY + 0.1,
      },
      target: def.id,
      spawn: doorSpawns[def.id],
    });
  }

  const TREE_W = 2.2;
  for (const pos of TREES) {
    const { mesh, height } = createSpriteMesh(TREE_SPRITE, TREE_W);
    const footY = pos.y - height / 2;
    mesh.position.set(pos.x, pos.y, zForFoot(footY));
    scene.add(mesh);

    // 줄기 부분만 충돌 (수관 뒤로는 지나갈 수 있음)
    colliders.push({
      minX: pos.x - 0.35,
      maxX: pos.x + 0.35,
      minY: footY,
      maxY: footY + 0.5,
    });
  }

  // 방명록 돌바위 (이스터에그) — 다가가면 나무 심기
  const rock = createSpriteMesh(ROCK_SPRITE, 1.8);
  const rockFootY = ROCK.y - rock.height / 2;
  rock.mesh.position.set(ROCK.x, ROCK.y, zForFoot(rockFootY));
  scene.add(rock.mesh);
  colliders.push({
    minX: ROCK.x - 0.85,
    maxX: ROCK.x + 0.85,
    minY: rockFootY,
    maxY: rockFootY + 0.7,
  });
  zones.push({
    box: {
      minX: ROCK.x - 1.6,
      maxX: ROCK.x + 1.6,
      minY: rockFootY - 1.2,
      maxY: rockFootY + 1.0,
    },
    interact: { kind: "plant" },
  });

  const world: GameWorld = { scene, colliders, triggers, zones, mapW: MAP_WIDTH, mapH: MAP_HEIGHT };

  // 이미 심어진 방명록 나무들
  for (const entry of guestbook) {
    addGuestbookTree(world, entry);
  }

  return world;
}

/** 도서관 내부 씬 구성 */
function buildLibrary(): GameWorld {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#241a10");
  const colliders: AABB[] = [];
  const triggers: Trigger[] = [];
  const zones: GameWorld["zones"] = [];
  const { width: mapW, height: mapH, wallHeight } = LIBRARY;

  const background = new THREE.Mesh(
    new THREE.PlaneGeometry(mapW, mapH),
    new THREE.MeshBasicMaterial({
      map: createInteriorBackgroundTexture(mapW, mapH, wallHeight, INTERIOR_THEMES.library),
    })
  );
  scene.add(background);

  // 북쪽 벽 충돌
  const wallBottom = mapH / 2 - wallHeight;
  colliders.push({
    minX: -mapW / 2,
    maxX: mapW / 2,
    minY: wallBottom,
    maxY: mapH / 2,
  });

  // 책장 — 카테고리별 상호작용 지점 (벽에서 앞으로 빼서 바닥 위에 배치)
  const SHELF_W = 2.6;
  const SHELF_SIGN_PPU = 10;
  for (const shelf of SHELVES) {
    const { mesh, height } = createSpriteMesh(BOOKSHELF_SPRITE, SHELF_W);
    const footY = wallBottom - 1.2;
    mesh.position.set(shelf.x, footY + height / 2, zForFoot(footY));
    scene.add(mesh);

    // 책장 위 영문 카테고리 간판
    const sign = createSignTexture(shelf.sign);
    const signMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(sign.pxWidth / SHELF_SIGN_PPU, sign.pxHeight / SHELF_SIGN_PPU),
      new THREE.MeshBasicMaterial({ map: sign.texture })
    );
    signMesh.position.set(shelf.x, footY + height + 0.5, zForFoot(footY) + 0.05);
    scene.add(signMesh);

    colliders.push({
      minX: shelf.x - SHELF_W / 2,
      maxX: shelf.x + SHELF_W / 2,
      minY: footY,
      maxY: footY + 0.8,
    });
    // 책장 남쪽 앞 공간에 서면 "SPACE로 읽기" 프롬프트가 뜸
    zones.push({
      box: {
        minX: shelf.x - SHELF_W / 2 - 0.3,
        maxX: shelf.x + SHELF_W / 2 + 0.3,
        minY: footY - 1.3,
        maxY: footY + 0.3,
      },
      interact: { kind: "shelf", shelfId: shelf.id },
    });
  }

  // 남쪽 출구 매트 → 마을로 복귀
  triggers.push({
    box: LIBRARY.exitTrigger,
    target: "village",
    spawn: VILLAGE_SPAWN_FROM_LIBRARY,
  });

  return { scene, colliders, triggers, zones, mapW, mapH };
}

/** 우리 집 내부 씬 — 침대 + 책상(프로필 상호작용) */
function buildHome(): GameWorld {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#241a10");
  const colliders: AABB[] = [];
  const triggers: Trigger[] = [];
  const zones: GameWorld["zones"] = [];
  const { width: mapW, height: mapH, wallHeight } = ROOM;
  const wallBottom = mapH / 2 - wallHeight;

  const background = new THREE.Mesh(
    new THREE.PlaneGeometry(mapW, mapH),
    new THREE.MeshBasicMaterial({
      map: createInteriorBackgroundTexture(mapW, mapH, wallHeight, INTERIOR_THEMES.home),
    })
  );
  scene.add(background);

  colliders.push({ minX: -mapW / 2, maxX: mapW / 2, minY: wallBottom, maxY: mapH / 2 });

  // 침대 (서쪽 벽 앞, 장식)
  const bed = createSpriteMesh(BED_SPRITE, 1.6);
  const bedFootY = 0.85;
  bed.mesh.position.set(-4.3, bedFootY + bed.height / 2, zForFoot(bedFootY));
  scene.add(bed.mesh);
  colliders.push({ minX: -5.1, maxX: -3.5, minY: bedFootY, maxY: bedFootY + bed.height });

  // 책상 + 모니터 (동쪽 벽 앞) — 프로필 상호작용 지점
  const desk = createSpriteMesh(DESK_SPRITE, 1.9);
  const deskFootY = 1.7;
  desk.mesh.position.set(3.6, deskFootY + desk.height / 2, zForFoot(deskFootY));
  scene.add(desk.mesh);
  colliders.push({ minX: 2.65, maxX: 4.55, minY: deskFootY, maxY: deskFootY + 0.8 });
  zones.push({
    box: { minX: 2.35, maxX: 4.85, minY: deskFootY - 1.3, maxY: deskFootY + 0.3 },
    interact: { kind: "profile" },
  });

  triggers.push({
    box: ROOM.exitTrigger,
    target: "village",
    spawn: VILLAGE_SPAWN_FROM_HOME,
  });

  return { scene, colliders, triggers, zones, mapW, mapH };
}

/** 공방 내부 씬 — 화로 + 작업대(포트폴리오 상호작용) */
function buildLab(): GameWorld {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#1a1c20");
  const colliders: AABB[] = [];
  const triggers: Trigger[] = [];
  const zones: GameWorld["zones"] = [];
  const { width: mapW, height: mapH, wallHeight } = ROOM;
  const wallBottom = mapH / 2 - wallHeight;

  const background = new THREE.Mesh(
    new THREE.PlaneGeometry(mapW, mapH),
    new THREE.MeshBasicMaterial({
      map: createInteriorBackgroundTexture(mapW, mapH, wallHeight, INTERIOR_THEMES.lab),
    })
  );
  scene.add(background);

  colliders.push({ minX: -mapW / 2, maxX: mapW / 2, minY: wallBottom, maxY: mapH / 2 });

  // 화로 (서쪽, 장식)
  const forge = createSpriteMesh(FORGE_SPRITE, 2.2);
  const forgeFootY = 1.6;
  forge.mesh.position.set(-3.2, forgeFootY + forge.height / 2, zForFoot(forgeFootY));
  scene.add(forge.mesh);
  colliders.push({ minX: -4.3, maxX: -2.1, minY: forgeFootY, maxY: forgeFootY + forge.height });

  // 작업대 + 모루 (동쪽) — 포트폴리오 상호작용 지점
  const bench = createSpriteMesh(WORKBENCH_SPRITE, 2.2);
  const benchFootY = 1.55;
  bench.mesh.position.set(2.8, benchFootY + bench.height / 2, zForFoot(benchFootY));
  scene.add(bench.mesh);
  colliders.push({ minX: 1.7, maxX: 3.9, minY: benchFootY, maxY: benchFootY + 0.8 });
  zones.push({
    box: { minX: 1.4, maxX: 4.2, minY: benchFootY - 1.3, maxY: benchFootY + 0.3 },
    interact: { kind: "portfolio" },
  });

  triggers.push({
    box: ROOM.exitTrigger,
    target: "village",
    spawn: VILLAGE_SPAWN_FROM_LAB,
  });

  return { scene, colliders, triggers, zones, mapW, mapH };
}

export default function VillageGame({
  locale,
  posts,
  guestbook,
}: {
  locale: string;
  posts: VillagePost[];
  guestbook: GuestbookEntry[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const honeypotRef = useRef<HTMLInputElement>(null);
  const [worldId, setWorldId] = useState<WorldId>("village");
  const [prompt, setPrompt] = useState<Interact | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const modalRef = useRef<ModalState | null>(null);
  /** 심기 성공 시 마을 씬에 나무를 추가하는 엔진 훅 */
  const plantRef = useRef<((entry: GuestbookEntry) => void) | null>(null);
  /** 터치 D-pad가 조작할 눌린 키 집합 — 키보드 핸들러와 동일한 Set을 공유 */
  const pressedRef = useRef<Set<string>>(new Set());
  /** 터치 상호작용 버튼이 호출할 SPACE 로직 */
  const interactRef = useRef<() => void>(() => {});
  const isKo = locale === "ko";

  // 방명록 작성 폼 상태
  const [gbName, setGbName] = useState("");
  const [gbMessage, setGbMessage] = useState("");
  const [gbBusy, setGbBusy] = useState(false);
  const [gbError, setGbError] = useState<string | null>(null);

  // 책장별 포스트 분류 — 태그 표기 편차를 정규화해서 매칭
  const shelfPosts = useMemo(() => {
    const result: Record<ShelfDef["id"], VillagePost[]> = {
      recent: posts.slice(0, RECENT_COUNT),
      web: [],
      app: [],
      ai: [],
    };
    for (const post of posts) {
      const normalized = post.tags.map(normalizeTag);
      for (const shelf of SHELVES) {
        if (shelf.tags && normalized.some((t) => shelf.tags!.includes(t))) {
          result[shelf.id].push(post);
        }
      }
    }
    return result;
  }, [posts]);

  const profile = useMemo(() => getProfile(isKo), [isKo]);
  const projects = useMemo(() => getProjects(isKo), [isKo]);

  function openModal(next: ModalState) {
    modalRef.current = next;
    setModal(next);
  }

  function closeModal() {
    modalRef.current = null;
    setModal(null);
    setGbError(null);
  }

  async function submitGuestbook(e: React.FormEvent) {
    e.preventDefault();
    if (gbBusy) return;
    setGbBusy(true);
    setGbError(null);
    try {
      const res = await fetch("/api/guestbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: gbName,
          message: gbMessage,
          website: honeypotRef.current?.value ?? "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setGbError(
          data.error ?? (isKo ? "심기에 실패했어요. 잠시 후 다시 시도해 주세요." : "Failed to plant. Try again later.")
        );
        return;
      }
      plantRef.current?.(data.entry);
      setGbName("");
      setGbMessage("");
      openModal({ kind: "planted" });
    } catch {
      setGbError(isKo ? "네트워크 오류가 발생했어요." : "Network error.");
    } finally {
      setGbBusy(false);
    }
  }

  useEffect(() => {
    const container = containerRef.current;
    const fade = fadeRef.current;
    if (!container || !fade) return;

    // ---------- 렌더러 ----------
    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.domElement.style.display = "block";
    container.appendChild(renderer.domElement);

    // ---------- 카메라 ----------
    // XY 평면을 정면(위)에서 내려다보는 구도 — z가 레이어(그리기 순서) 역할
    const camera = new THREE.OrthographicCamera(0, 0, 0, 0, 0.1, 100);
    camera.position.z = 50;

    function updateCameraFrustum() {
      const aspect = container!.clientWidth / container!.clientHeight;
      const viewW = VIEW_HEIGHT * aspect;
      camera.left = -viewW / 2;
      camera.right = viewW / 2;
      camera.top = VIEW_HEIGHT / 2;
      camera.bottom = -VIEW_HEIGHT / 2;
      camera.updateProjectionMatrix();
    }
    updateCameraFrustum();

    // ---------- 씬 구성 ----------
    const worlds: Record<WorldId, GameWorld> = {
      village: buildVillage(guestbook),
      library: buildLibrary(),
      home: buildHome(),
      lab: buildLab(),
    };
    let active = worlds.village;

    // 방명록 나무 심기 훅 등록 (폼 제출 성공 시 호출됨)
    plantRef.current = (entry) => addGuestbookTree(worlds.village, entry);

    // ---------- 플레이어 ----------
    const playerSprite = createSpriteMesh(PLAYER_SPRITE, PLAYER_W);
    const player = playerSprite.mesh;
    player.position.set(PLAYER_START.x, PLAYER_START.y, 1);
    active.scene.add(player);
    camera.position.x = PLAYER_START.x;
    camera.position.y = PLAYER_START.y;

    /** 플레이어 발밑 박스 (cx, cy = 스프라이트 중심) */
    function feetBox(cx: number, cy: number): AABB {
      const minY = cy - PLAYER_H / 2;
      return {
        minX: cx - FEET_HALF_W,
        maxX: cx + FEET_HALF_W,
        minY,
        maxY: minY + FEET_HEIGHT,
      };
    }

    function intersects(a: AABB, b: AABB): boolean {
      return a.maxX > b.minX && a.minX < b.maxX && a.maxY > b.minY && a.minY < b.maxY;
    }

    function collides(cx: number, cy: number): boolean {
      const feet = feetBox(cx, cy);
      return active.colliders.some((b) => intersects(feet, b));
    }

    // ---------- 씬 전환 (페이드 아웃 → 씬 교체 → 페이드 인) ----------
    let transitioning = false;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    function goToWorld(target: WorldId, spawn: { x: number; y: number }) {
      if (transitioning) return;
      transitioning = true;
      currentZone = null;
      setPrompt(null);
      fade!.style.opacity = "1";
      timeouts.push(
        setTimeout(() => {
          active = worlds[target];
          active.scene.add(player); // 다른 씬에 add하면 이전 씬에서 자동 제거됨
          player.position.set(spawn.x, spawn.y, zForFoot(spawn.y - PLAYER_H / 2));
          camera.position.x = spawn.x;
          camera.position.y = spawn.y;
          setWorldId(target);
          fade!.style.opacity = "0";
          timeouts.push(
            setTimeout(() => {
              transitioning = false;
            }, FADE_MS)
          );
        }, FADE_MS)
      );
    }

    // 첫 로드는 검은 화면에서 페이드 인
    fade.style.opacity = "1";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fade.style.opacity = "0";
      });
    });

    // ---------- 키보드 입력 ----------
    const pressed = pressedRef.current;
    pressed.clear();
    let currentZone: Interact | null = null; // 지금 프롬프트가 떠 있는 상호작용 대상

    /** SPACE 상호작용 로직 — 키보드와 터치 버튼이 공용으로 호출 */
    function handleInteract() {
      const m = modalRef.current;
      if (m) {
        if (m.kind !== "plant") closeModal(); // 작성 폼은 Space로 닫히지 않음
      } else if (currentZone && !transitioning) {
        openModal(currentZone);
        pressed.clear(); // 모달 열린 동안 이동키가 눌린 채 고정되는 것 방지
      }
    }
    interactRef.current = handleInteract;

    function onKeyDown(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const typing =
        !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "BUTTON");

      if (e.code === "Escape") {
        if (modalRef.current) closeModal();
        return;
      }
      if (typing) return; // 방명록 폼 입력 중에는 게임 키 처리 안 함

      if (e.code === "Space") {
        e.preventDefault(); // 스페이스로 페이지가 스크롤되는 것 방지
        if (e.repeat) return;
        handleInteract();
        return;
      }
      if (MOVE_KEYS[e.code]) {
        e.preventDefault(); // 방향키로 페이지가 스크롤되는 것 방지
        pressed.add(e.code);
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      pressed.delete(e.code);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // ---------- 리사이즈 ----------
    const resizeObserver = new ResizeObserver(() => {
      renderer.setSize(container!.clientWidth, container!.clientHeight);
      updateCameraFrustum();
    });
    resizeObserver.observe(container);

    // ---------- 게임 루프 ----------
    const clock = new THREE.Clock();
    let rafId = 0;

    function tick() {
      rafId = requestAnimationFrame(tick);
      const delta = Math.min(clock.getDelta(), MAX_DELTA);

      // 전환 중·모달 열림에는 입력을 얼리고 렌더링만 유지
      if (!transitioning && !modalRef.current) {
        // 입력 → 이동 벡터 (대각선 이동 속도 보정)
        let dx = 0;
        let dy = 0;
        for (const code of pressed) {
          const dir = MOVE_KEYS[code];
          if (dir) {
            dx += dir[0];
            dy += dir[1];
          }
        }
        const len = Math.hypot(dx, dy);
        if (len > 0) {
          const stepX = (dx / len) * PLAYER_SPEED * delta;
          const stepY = (dy / len) * PLAYER_SPEED * delta;

          // 축별로 나눠 충돌 판정 — 벽에 비스듬히 걸어도 미끄러지듯 이동
          const nextX = player.position.x + stepX;
          if (!collides(nextX, player.position.y)) {
            player.position.x = nextX;
          }
          const nextY = player.position.y + stepY;
          if (!collides(player.position.x, nextY)) {
            player.position.y = nextY;
          }

          // 좌우 이동 시 스프라이트 반전
          if (dx < 0) player.scale.x = -1;
          else if (dx > 0) player.scale.x = 1;
        }

        // 맵 경계 클램프
        const maxX = active.mapW / 2 - PLAYER_W / 2;
        const maxY = active.mapH / 2 - PLAYER_H / 2;
        player.position.x = THREE.MathUtils.clamp(player.position.x, -maxX, maxX);
        player.position.y = THREE.MathUtils.clamp(player.position.y, -maxY, maxY);

        // Y-소팅: 발밑 기준으로 매 프레임 z 갱신
        player.position.z = zForFoot(player.position.y - PLAYER_H / 2);

        const feet = feetBox(player.position.x, player.position.y);

        // 상호작용 존 검사 → SPACE 프롬프트
        let near: Interact | null = null;
        for (const zone of active.zones) {
          if (intersects(feet, zone.box)) {
            near = zone.interact;
            break;
          }
        }
        if (!sameInteract(near, currentZone)) {
          currentZone = near;
          setPrompt(near);
        }

        // 트리거 존 검사 (문, 출구 매트)
        for (const trig of active.triggers) {
          if (intersects(feet, trig.box)) {
            goToWorld(trig.target, trig.spawn);
            break;
          }
        }
      }

      // 카메라 스무스 추적 (damp = 프레임레이트 무관 lerp)
      camera.position.x = THREE.MathUtils.damp(
        camera.position.x,
        player.position.x,
        CAMERA_DAMP,
        delta
      );
      camera.position.y = THREE.MathUtils.damp(
        camera.position.y,
        player.position.y,
        CAMERA_DAMP,
        delta
      );

      // 카메라가 맵 바깥을 비추지 않도록 클램프
      const viewW = camera.right - camera.left;
      const camMaxX = Math.max(0, active.mapW / 2 - viewW / 2);
      const camMaxY = Math.max(0, active.mapH / 2 - VIEW_HEIGHT / 2);
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, -camMaxX, camMaxX);
      camera.position.y = THREE.MathUtils.clamp(camera.position.y, -camMaxY, camMaxY);

      renderer.render(active.scene, camera);
    }
    tick();

    // ---------- 클린업 (dev StrictMode 이중 마운트 대응) ----------
    return () => {
      cancelAnimationFrame(rafId);
      timeouts.forEach(clearTimeout);
      plantRef.current = null;
      interactRef.current = () => {};
      pressed.clear();
      resizeObserver.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      for (const world of Object.values(worlds)) {
        world.scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
            materials.forEach((m) => {
              if (m instanceof THREE.MeshBasicMaterial && m.map) m.map.dispose();
              m.dispose();
            });
          }
        });
      }
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- UI 라벨 ----------
  const shelfLabel = (id: ShelfDef["id"]) => {
    const shelf = SHELVES.find((s) => s.id === id);
    return shelf ? (isKo ? shelf.labelKo : shelf.labelEn) : "";
  };

  const LOCATION_LABELS: Record<WorldId, { ko: string; en: string }> = {
    village: { ko: "마을 광장", en: "Village Square" },
    library: { ko: "도서관", en: "Library" },
    home: { ko: "우리 집", en: "My Home" },
    lab: { ko: "공방", en: "Workshop" },
  };
  const locationLabel = isKo ? LOCATION_LABELS[worldId].ko : LOCATION_LABELS[worldId].en;

  const promptText = (target: Interact): string => {
    switch (target.kind) {
      case "shelf":
        return isKo
          ? `[SPACE] ${shelfLabel(target.shelfId)} 책장 읽기`
          : `[SPACE] Browse ${shelfLabel(target.shelfId)}`;
      case "profile":
        return isKo ? "[SPACE] 프로필 보기" : "[SPACE] View profile";
      case "portfolio":
        return isKo ? "[SPACE] 프로젝트 보기" : "[SPACE] View projects";
      case "plant":
        return isKo ? "[SPACE] 나무 심기" : "[SPACE] Plant a tree";
      case "tree":
        return isKo
          ? `[SPACE] ${target.entry.name}님의 나무`
          : `[SPACE] ${target.entry.name}'s tree`;
    }
  };

  const modalTitle = (target: ModalState): string => {
    switch (target.kind) {
      case "shelf":
        return `📚 ${shelfLabel(target.shelfId)}`;
      case "profile":
        return isKo ? "🏠 프로필" : "🏠 Profile";
      case "portfolio":
        return isKo ? "⚒️ 프로젝트" : "⚒️ Projects";
      case "plant":
        return isKo ? "🌱 나무 심기 — 방명록" : "🌱 Plant a Tree — Guestbook";
      case "tree":
        return isKo ? `🌳 ${target.entry.name}님의 나무` : `🌳 ${target.entry.name}'s tree`;
      case "planted":
        return isKo ? "🌳 심었어요!" : "🌳 Planted!";
    }
  };

  /** 내부 링크면 locale 접두사 부착 */
  const withLocale = (href: string) => (href.startsWith("/") ? `/${locale}${href}` : href);

  const chipStyle: React.CSSProperties = {
    display: "inline-block",
    padding: "0.1rem 0.45rem",
    margin: "0 0.3rem 0.3rem 0",
    fontSize: "0.65rem",
    color: "#e8e4d8",
    border: "1px solid rgba(232, 228, 216, 0.3)",
  };

  const sectionHeadStyle: React.CSSProperties = {
    fontSize: "0.65rem",
    color: "rgba(232, 228, 216, 0.5)",
    letterSpacing: "0.08em",
    margin: "0.9rem 0 0.4rem",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.5rem 0.6rem",
    fontSize: "0.78rem",
    color: "#e8e4d8",
    background: "#161c12",
    border: "2px solid rgba(232, 228, 216, 0.35)",
    outline: "none",
    fontFamily: "inherit",
  };

  return (
    <div style={{ maxWidth: "60rem", margin: "0 auto" }}>
      {/* 모달 안 링크 hover — 인라인 스타일로는 :hover가 안 되므로 클래스 사용 */}
      <style>{`
        .pv-modal-link:hover { background: rgba(232, 228, 216, 0.08); }
        .pv-touch-controls { display: none; }
        @media (pointer: coarse) {
          .pv-touch-controls { display: block; }
        }
      `}</style>

      <div style={{ marginBottom: "1.25rem" }}>
        <h1
          style={{
            fontSize: "clamp(1.4rem, 3vw, 1.9rem)",
            fontWeight: 700,
            letterSpacing: "-0.04em",
            color: "hsl(var(--foreground))",
            marginBottom: "0.4rem",
          }}
        >
          {isKo ? "픽셀 마을" : "Pixel Village"}
        </h1>
        <p
          style={{
            fontSize: "0.85rem",
            color: "hsl(var(--muted-foreground))",
            fontFamily: "var(--font-mono), monospace",
          }}
        >
          {isKo
            ? "// MY HOME은 프로필, LIBRARY는 포스트, WORKSHOP은 프로젝트."
            : "// MY HOME = profile, LIBRARY = posts, WORKSHOP = projects."}
        </p>
      </div>

      <div
        style={{
          position: "relative",
          width: "100%",
          height: "min(70vh, 620px)",
          borderRadius: 14,
          overflow: "hidden",
          border: "1px solid hsl(var(--border))",
          background: "#10140d",
        }}
      >
        <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

        {/* 현재 위치 표시 */}
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            padding: "0.3rem 0.7rem",
            fontSize: "0.72rem",
            fontWeight: 700,
            color: "#e8e4d8",
            background: "rgba(16, 20, 13, 0.75)",
            border: "1px solid rgba(232, 228, 216, 0.25)",
            borderRadius: 8,
            fontFamily: "var(--font-mono), monospace",
            pointerEvents: "none",
            zIndex: 2,
          }}
        >
          {locationLabel}
        </div>

        {/* 상호작용 프롬프트 */}
        {prompt && !modal && (
          <div
            style={{
              position: "absolute",
              bottom: 16,
              left: "50%",
              transform: "translateX(-50%)",
              padding: "0.45rem 0.9rem",
              fontSize: "0.78rem",
              fontWeight: 700,
              color: "#10140d",
              background: "#e8e4d8",
              border: "2px solid #10140d",
              boxShadow: "3px 3px 0 rgba(0, 0, 0, 0.5)",
              fontFamily: "var(--font-mono), monospace",
              pointerEvents: "none",
              whiteSpace: "nowrap",
              zIndex: 2,
            }}
          >
            {promptText(prompt)}
          </div>
        )}

        {/* 레트로 모달 */}
        {modal && (
          <div
            onClick={closeModal}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0, 0, 0, 0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 4,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "min(460px, 88%)",
                maxHeight: "82%",
                display: "flex",
                flexDirection: "column",
                background: "#20281b",
                border: "3px solid #e8e4d8",
                boxShadow: "0 0 0 3px #10140d, 8px 8px 0 rgba(0, 0, 0, 0.6)",
                fontFamily: "var(--font-mono), monospace",
              }}
            >
              {/* 타이틀 바 */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.6rem 0.9rem",
                  borderBottom: "2px solid rgba(232, 228, 216, 0.3)",
                  background: "#2a3323",
                }}
              >
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#e8e4d8" }}>
                  {modalTitle(modal)}
                  {modal.kind === "shelf" && (
                    <span style={{ opacity: 0.6, fontWeight: 400 }}>
                      {" "}
                      ({shelfPosts[modal.shelfId].length})
                    </span>
                  )}
                </span>
                <button
                  onClick={closeModal}
                  aria-label={isKo ? "닫기" : "Close"}
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    color: "#10140d",
                    background: "#e8e4d8",
                    border: "none",
                    padding: "0.15rem 0.5rem",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    boxShadow: "2px 2px 0 rgba(0, 0, 0, 0.5)",
                  }}
                >
                  X
                </button>
              </div>

              {/* 본문 */}
              <div style={{ overflowY: "auto", flex: 1 }}>
                {/* 책장 — 포스트 목록 */}
                {modal.kind === "shelf" && (
                  <>
                    {shelfPosts[modal.shelfId].length === 0 && (
                      <p
                        style={{
                          padding: "1.5rem",
                          fontSize: "0.8rem",
                          color: "rgba(232, 228, 216, 0.6)",
                          textAlign: "center",
                        }}
                      >
                        {isKo ? "이 책장은 아직 비어 있어요." : "This shelf is empty."}
                      </p>
                    )}
                    {shelfPosts[modal.shelfId].map((post) => (
                      <a
                        key={post.slug}
                        className="pv-modal-link"
                        href={`/${locale}/posts/${post.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "block",
                          padding: "0.6rem 0.9rem",
                          borderBottom: "1px dashed rgba(232, 228, 216, 0.15)",
                          textDecoration: "none",
                        }}
                      >
                        <span
                          style={{
                            display: "block",
                            fontSize: "0.65rem",
                            color: "rgba(232, 228, 216, 0.5)",
                            marginBottom: "0.15rem",
                          }}
                        >
                          {post.date}
                        </span>
                        <span
                          style={{
                            display: "block",
                            fontSize: "0.8rem",
                            fontWeight: 700,
                            color: "#e8e4d8",
                            lineHeight: 1.45,
                          }}
                        >
                          ▸ {post.title}
                        </span>
                      </a>
                    ))}
                  </>
                )}

                {/* 우리 집 — 프로필 */}
                {modal.kind === "profile" && (
                  <div style={{ padding: "0.9rem" }}>
                    <p
                      style={{
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        color: "#e8e4d8",
                        lineHeight: 1.5,
                        marginBottom: "0.6rem",
                      }}
                    >
                      {profile.title}
                    </p>
                    {profile.intro.map((para) => (
                      <p
                        key={para}
                        style={{
                          fontSize: "0.72rem",
                          color: "rgba(232, 228, 216, 0.75)",
                          lineHeight: 1.7,
                          marginBottom: "0.4rem",
                        }}
                      >
                        {para}
                      </p>
                    ))}

                    <p style={sectionHeadStyle}># NOW</p>
                    <div>
                      {profile.stackNow.map((s) => (
                        <span key={s} style={chipStyle}>
                          {s}
                        </span>
                      ))}
                    </div>

                    <p style={sectionHeadStyle}># BEFORE</p>
                    <div>
                      {profile.stackPast.map((s) => (
                        <span key={s} style={{ ...chipStyle, opacity: 0.6 }}>
                          {s}
                        </span>
                      ))}
                    </div>

                    <p style={sectionHeadStyle}># FOCUS</p>
                    <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                      {profile.focus.map((item) => (
                        <li
                          key={item}
                          style={{
                            fontSize: "0.72rem",
                            color: "rgba(232, 228, 216, 0.75)",
                            lineHeight: 1.8,
                          }}
                        >
                          → {item}
                        </li>
                      ))}
                    </ul>

                    <div style={{ marginTop: "0.9rem", display: "flex", gap: "1rem" }}>
                      {profile.links.map((link) => (
                        <a
                          key={link.label}
                          href={withLocale(link.href)}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            color: "#8fd3e8",
                            textDecoration: "none",
                            borderBottom: "1px solid rgba(143, 211, 232, 0.4)",
                          }}
                        >
                          → {link.label}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* 공방 — 프로젝트 목록 */}
                {modal.kind === "portfolio" && (
                  <>
                    {projects.map((project) => (
                      <a
                        key={project.name}
                        className="pv-modal-link"
                        href={project.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "block",
                          padding: "0.6rem 0.9rem",
                          borderBottom: "1px dashed rgba(232, 228, 216, 0.15)",
                          textDecoration: "none",
                        }}
                      >
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            marginBottom: "0.15rem",
                          }}
                        >
                          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#e8e4d8" }}>
                            ▸ {project.name}
                          </span>
                          <span
                            style={{
                              fontSize: "0.6rem",
                              padding: "0.05rem 0.35rem",
                              color: "#9be8a8",
                              border: "1px solid rgba(155, 232, 168, 0.35)",
                            }}
                          >
                            {project.status}
                          </span>
                        </span>
                        <span
                          style={{
                            display: "block",
                            fontSize: "0.68rem",
                            color: "rgba(232, 228, 216, 0.6)",
                            lineHeight: 1.5,
                          }}
                        >
                          {project.tagline}
                        </span>
                      </a>
                    ))}
                    <div style={{ padding: "0.7rem 0.9rem", textAlign: "center" }}>
                      <a
                        href={withLocale("/portfolio")}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          color: "#8fd3e8",
                          textDecoration: "none",
                          borderBottom: "1px solid rgba(143, 211, 232, 0.4)",
                        }}
                      >
                        {isKo ? "→ 포트폴리오 전체 보기" : "→ Full portfolio"}
                      </a>
                    </div>
                  </>
                )}

                {/* 돌바위 — 방명록 작성 폼 */}
                {modal.kind === "plant" && (
                  <form
                    onSubmit={submitGuestbook}
                    style={{
                      padding: "0.9rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.55rem",
                    }}
                  >
                    <p
                      style={{
                        fontSize: "0.72rem",
                        color: "rgba(232, 228, 216, 0.75)",
                        lineHeight: 1.7,
                      }}
                    >
                      {isKo
                        ? "오래된 돌에 이름을 새기면, 마을 잔디밭 어딘가에 나무 한 그루가 자라난대요."
                        : "Carve your name on the old stone, and a tree will grow somewhere in the village."}
                    </p>
                    <input
                      value={gbName}
                      onChange={(e) => setGbName(e.target.value)}
                      maxLength={GUESTBOOK_NAME_MAX}
                      placeholder={isKo ? "닉네임" : "Nickname"}
                      autoFocus
                      style={inputStyle}
                    />
                    <textarea
                      value={gbMessage}
                      onChange={(e) => setGbMessage(e.target.value)}
                      maxLength={GUESTBOOK_MESSAGE_MAX}
                      rows={3}
                      placeholder={isKo ? "남기고 싶은 말" : "Leave a message"}
                      style={{ ...inputStyle, resize: "none" }}
                    />
                    <span
                      style={{
                        fontSize: "0.6rem",
                        color: "rgba(232, 228, 216, 0.4)",
                        textAlign: "right",
                      }}
                    >
                      {gbMessage.length}/{GUESTBOOK_MESSAGE_MAX}
                    </span>
                    {/* 허니팟 — 봇 방지용 숨은 필드 */}
                    <input
                      ref={honeypotRef}
                      type="text"
                      name="website"
                      tabIndex={-1}
                      autoComplete="off"
                      style={{ display: "none" }}
                    />
                    {gbError && (
                      <p style={{ fontSize: "0.7rem", color: "#e2574c" }}>{gbError}</p>
                    )}
                    <button
                      type="submit"
                      disabled={gbBusy || !gbName.trim() || !gbMessage.trim()}
                      style={{
                        padding: "0.55rem",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        color: "#10140d",
                        background: gbBusy ? "rgba(232, 228, 216, 0.5)" : "#e8e4d8",
                        border: "none",
                        cursor: gbBusy ? "wait" : "pointer",
                        fontFamily: "inherit",
                        boxShadow: "3px 3px 0 rgba(0, 0, 0, 0.5)",
                        opacity: !gbName.trim() || !gbMessage.trim() ? 0.5 : 1,
                      }}
                    >
                      {gbBusy
                        ? isKo
                          ? "심는 중..."
                          : "Planting..."
                        : isKo
                          ? "🌳 나무 심기"
                          : "🌳 Plant a tree"}
                    </button>
                  </form>
                )}

                {/* 방명록 나무 — 메시지 읽기 */}
                {modal.kind === "tree" && (
                  <div style={{ padding: "1rem 0.9rem" }}>
                    <p
                      style={{
                        fontSize: "0.65rem",
                        color: "rgba(232, 228, 216, 0.5)",
                        marginBottom: "0.5rem",
                      }}
                    >
                      {modal.entry.date}
                    </p>
                    <p
                      style={{
                        fontSize: "0.85rem",
                        color: "#e8e4d8",
                        lineHeight: 1.8,
                        marginBottom: "0.7rem",
                        wordBreak: "break-word",
                      }}
                    >
                      “{modal.entry.message}”
                    </p>
                    <p
                      style={{
                        fontSize: "0.72rem",
                        color: "rgba(232, 228, 216, 0.6)",
                        textAlign: "right",
                      }}
                    >
                      — {modal.entry.name}
                    </p>
                  </div>
                )}

                {/* 심기 완료 안내 */}
                {modal.kind === "planted" && (
                  <div style={{ padding: "1.4rem 1rem", textAlign: "center" }}>
                    <p style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>🌳</p>
                    <p
                      style={{
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        color: "#e8e4d8",
                        marginBottom: "0.5rem",
                      }}
                    >
                      {isKo ? "나무를 심었어요!" : "Your tree has been planted!"}
                    </p>
                    <p
                      style={{
                        fontSize: "0.72rem",
                        color: "rgba(232, 228, 216, 0.7)",
                        lineHeight: 1.7,
                      }}
                    >
                      {isKo
                        ? "마을 잔디밭 어딘가에 방금 자라났어요. 이제 본인의 나무를 찾아보세요 🌱"
                        : "It just grew somewhere in the village. Now go find your tree 🌱"}
                    </p>
                  </div>
                )}
              </div>

              {/* 푸터 힌트 */}
              <div
                style={{
                  padding: "0.45rem 0.9rem",
                  fontSize: "0.65rem",
                  color: "rgba(232, 228, 216, 0.5)",
                  borderTop: "2px solid rgba(232, 228, 216, 0.3)",
                  textAlign: "center",
                }}
              >
                {modal.kind === "plant"
                  ? isKo
                    ? "[ESC] 닫기"
                    : "[ESC] close"
                  : isKo
                    ? "[ESC / SPACE] 닫기"
                    : "[ESC / SPACE] close"}
              </div>
            </div>
          </div>
        )}

        {/* 씬 전환 페이드 오버레이 */}
        <div
          ref={fadeRef}
          style={{
            position: "absolute",
            inset: 0,
            background: "#000",
            opacity: 0,
            transition: `opacity ${FADE_MS}ms ease`,
            pointerEvents: "none",
            zIndex: 3,
          }}
        />

        {/* 터치 조작 — 키보드가 없는 모바일에서도 이동/상호작용 가능하게 */}
        {!modal && (
          <div
            className="pv-touch-controls"
            style={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none" }}
          >
            <div
              style={{
                position: "absolute",
                left: 14,
                bottom: 14,
                width: 132,
                height: 132,
                pointerEvents: "auto",
              }}
            >
              {(
                [
                  { code: "KeyW", label: "▲", col: 2, row: 1 },
                  { code: "KeyA", label: "◀", col: 1, row: 2 },
                  { code: "KeyD", label: "▶", col: 3, row: 2 },
                  { code: "KeyS", label: "▼", col: 2, row: 3 },
                ] as const
              ).map((btn) => (
                <button
                  key={btn.code}
                  type="button"
                  aria-label={btn.code}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    pressedRef.current.add(btn.code);
                  }}
                  onPointerUp={(e) => {
                    e.preventDefault();
                    pressedRef.current.delete(btn.code);
                  }}
                  onPointerLeave={() => pressedRef.current.delete(btn.code)}
                  onPointerCancel={() => pressedRef.current.delete(btn.code)}
                  onContextMenu={(e) => e.preventDefault()}
                  style={{
                    position: "absolute",
                    left: (btn.col - 1) * 44,
                    top: (btn.row - 1) * 44,
                    width: 44,
                    height: 44,
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.1rem",
                    lineHeight: 1,
                    color: "#e8e4d8",
                    background: "rgba(232, 228, 216, 0.14)",
                    border: "1px solid rgba(232, 228, 216, 0.4)",
                    borderRadius: 8,
                    touchAction: "none",
                    userSelect: "none",
                    WebkitUserSelect: "none",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              aria-label={isKo ? "상호작용" : "Interact"}
              onPointerDown={(e) => {
                e.preventDefault();
                interactRef.current();
              }}
              onContextMenu={(e) => e.preventDefault()}
              style={{
                position: "absolute",
                right: 18,
                bottom: 18,
                width: 64,
                height: 64,
                padding: 0,
                borderRadius: "50%",
                fontSize: "0.68rem",
                fontWeight: 700,
                color: "#10140d",
                background: "#e8e4d8",
                border: "2px solid #10140d",
                boxShadow: "3px 3px 0 rgba(0, 0, 0, 0.5)",
                fontFamily: "var(--font-mono), monospace",
                touchAction: "none",
                userSelect: "none",
                WebkitUserSelect: "none",
                WebkitTapHighlightColor: "transparent",
                pointerEvents: "auto",
              }}
            >
              {isKo ? "실행" : "USE"}
            </button>
          </div>
        )}
      </div>

      <p
        style={{
          marginTop: "0.75rem",
          fontSize: "0.75rem",
          color: "hsl(var(--muted-foreground) / 0.7)",
          fontFamily: "var(--font-mono), monospace",
          textAlign: "center",
        }}
      >
        {isKo
          ? "[ W A S D / ← ↑ ↓ → ] 이동 · [ SPACE ] 상호작용"
          : "[ W A S D / ← ↑ ↓ → ] move · [ SPACE ] interact"}
      </p>
    </div>
  );
}
