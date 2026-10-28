// Verifies fal webhook signatures (Ed25519). Steps from https://fal.ai/docs/documentation/model-apis/inference/webhooks:
//   message = request-id \n user-id \n timestamp \n hex(sha256(raw body)), signed with a key from the JWKS,
//   timestamp within ±300 s, JWKS cached for at most 24 h.

import "server-only";
import { createHash, createPublicKey, verify } from "node:crypto";

const JWKS_URL = "https://rest.fal.ai/.well-known/jwks.json";
const JWKS_TTL_MS = 12 * 60 * 60 * 1000;

let jwks: { keys: Array<{ x: string; kty?: string; crv?: string }>; at: number } | undefined;

async function keys() {
  if (!jwks || Date.now() - jwks.at > JWKS_TTL_MS) {
    const res = await fetch(JWKS_URL, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`JWKS fetch failed ${res.status}`);
    jwks = { keys: ((await res.json()) as { keys: Array<{ x: string }> }).keys ?? [], at: Date.now() };
  }
  return jwks.keys;
}

export async function verifyFalWebhook(headers: Headers, body: Buffer): Promise<boolean> {
  const requestId = headers.get("x-fal-webhook-request-id");
  const userId = headers.get("x-fal-webhook-user-id");
  const timestamp = headers.get("x-fal-webhook-timestamp");
  const signature = headers.get("x-fal-webhook-signature");
  if (!requestId || !userId || !timestamp || !signature) return false;
  if (!/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const message = Buffer.from([requestId, userId, timestamp, createHash("sha256").update(body).digest("hex")].join("\n"), "utf8");
  const sig = Buffer.from(signature, "hex");
  for (const k of await keys()) {
    try {
      const key = createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: k.x }, format: "jwk" });
      if (verify(null, message, key, sig)) return true;
    } catch {
      // malformed key: try the next one
    }
  }
  return false;
}
