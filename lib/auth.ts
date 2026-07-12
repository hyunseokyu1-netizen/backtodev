const TOKEN_EXPIRY_MS = 8 * 60 * 60 * 1000; // 8시간

/**
 * 토큰 서명 키. 비밀번호와 **분리된** 시크릿을 쓴다.
 * JWT_SECRET가 있으면 그것을, 없으면 레거시 호환을 위해 ADMIN_PASSWORD로 폴백한다.
 * (운영에서는 JWT_SECRET를 반드시 설정할 것 — 폴백은 마이그레이션용)
 */
function getSigningSecret(): string {
  return process.env.JWT_SECRET || process.env.ADMIN_PASSWORD || "";
}

async function getKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function b64url(buf: ArrayBuffer): string {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlToBytes(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64"));
}

/** hex 문자열 상수 시간 비교 (고정 길이라 길이 노출 없음) */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** 임의 문자열 상수 시간 비교 (레거시 평문 폴백용) */
function timingSafeEqualStr(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  const len = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Buffer.from(digest).toString("hex");
}

/**
 * 관리자 비밀번호 검증.
 * ADMIN_PASSWORD_HASH(비밀번호의 SHA-256 hex)가 있으면 해시 비교,
 * 없으면 레거시 호환으로 ADMIN_PASSWORD 평문을 상수 시간 비교한다.
 */
export async function verifyPassword(input: string): Promise<boolean> {
  if (!input) return false;
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (hash) {
    const inputHash = await sha256Hex(input);
    return timingSafeEqualHex(inputHash, hash.trim().toLowerCase());
  }
  const expected = process.env.ADMIN_PASSWORD ?? "";
  return expected.length > 0 && timingSafeEqualStr(input, expected);
}

export async function signToken(): Promise<string> {
  const payloadB64 = Buffer.from(
    JSON.stringify({ exp: Date.now() + TOKEN_EXPIRY_MS })
  ).toString("base64url");
  const key = await getKey(getSigningSecret());
  // 서명 대상 = 인코딩된 payload 문자열 그 자체 (검증도 동일 바이트로 수행)
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  return `${payloadB64}.${b64url(sig)}`;
}

export async function verifyToken(token: string): Promise<boolean> {
  try {
    const [payloadB64, sigB64] = token.split(".");
    if (!payloadB64 || !sigB64) return false;

    const key = await getKey(getSigningSecret());
    const sigBytes = b64urlToBytes(sigB64);
    // 서명이 만들어진 것과 동일한 바이트(payloadB64)로 검증 — 재직렬화 없음
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes as BufferSource,
      new TextEncoder().encode(payloadB64)
    );
    if (!valid) return false;

    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    if (!payload.exp || Date.now() > payload.exp) return false;
    return true;
  } catch {
    return false;
  }
}
