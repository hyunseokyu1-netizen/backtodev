const TOKEN_EXPIRY_MS = 8 * 60 * 60 * 1000; // 8시간

async function getKey(password: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  return keyMaterial;
}

function b64url(buf: ArrayBuffer): string {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function signToken(): Promise<string> {
  const password = process.env.ADMIN_PASSWORD ?? "";
  const payload = JSON.stringify({ exp: Date.now() + TOKEN_EXPIRY_MS });
  const enc = new TextEncoder();
  const key = await getKey(password);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return `${Buffer.from(payload).toString("base64url")}.${b64url(sig)}`;
}

export async function verifyToken(token: string): Promise<boolean> {
  try {
    const password = process.env.ADMIN_PASSWORD ?? "";
    const [payloadB64, sigB64] = token.split(".");
    if (!payloadB64 || !sigB64) return false;

    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    if (!payload.exp || Date.now() > payload.exp) return false;

    const enc = new TextEncoder();
    const key = await getKey(password);
    const sigBuf = Buffer.from(sigB64.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    const valid = await crypto.subtle.verify("HMAC", key, sigBuf, enc.encode(JSON.stringify(payload)));
    return valid;
  } catch {
    return false;
  }
}
