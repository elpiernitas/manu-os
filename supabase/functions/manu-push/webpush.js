// Web Push without dependencies (WEB-99): message encryption (RFC 8291, «aes128gcm» of RFC 8188)
// and VAPID (RFC 8292). Only WebCrypto, so the same file runs in Supabase Edge Functions (Deno)
// and in Node for the tests (checked against the RFC 8291 example, Appendix A).

const te = new TextEncoder();
export const b64u = {
  enc: (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  dec: (s) => { const t = String(s).replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/"); const p = atob(t + "===".slice((t.length + 3) % 4)); return Uint8Array.from(p, (c) => c.charCodeAt(0)); },
};
const concat = (...xs) => { const out = new Uint8Array(xs.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of xs) { out.set(x, i); i += x.length; } return out; };

async function hmac(key, data) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}
// HKDF with a single output block (all lengths here are ≤ 32 bytes).
const hkdf = async (salt, ikm, info, len) => (await hmac(await hmac(salt, ikm), concat(info, Uint8Array.of(1)))).slice(0, len);

// A P-256 public key in uncompressed form (65 bytes, 0x04‖x‖y) ⇄ JWK.
export function rawToJwk(raw, d = null) {
  const r = raw instanceof Uint8Array ? raw : b64u.dec(raw);
  if (r.length !== 65 || r[0] !== 4) throw new Error("Clave pública P-256 no válida");
  return { kty: "EC", crv: "P-256", x: b64u.enc(r.slice(1, 33)), y: b64u.enc(r.slice(33)), ...(d ? { d } : {}), ext: true };
}
export const jwkToRaw = (jwk) => concat(Uint8Array.of(4), b64u.dec(jwk.x), b64u.dec(jwk.y));

/** A new ECDSA P-256 key pair for VAPID, as JWKs (the private one never leaves the server). */
export async function newVapidKeys() {
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const priv = await crypto.subtle.exportKey("jwk", kp.privateKey);
  return { privateJwk: { kty: priv.kty, crv: priv.crv, x: priv.x, y: priv.y, d: priv.d }, publicKey: b64u.enc(jwkToRaw(priv)) };
}

/**
 * Encrypts `plaintext` for one subscription. `ua` = { p256dh, auth } (base64url) from the browser.
 * `asKeys` and `salt` are only passed by the tests (fixed RFC values); normally random.
 */
export async function encrypt(plaintext, ua, { asKeys = null, salt = null, rs = 4096 } = {}) {
  const uaPublic = b64u.dec(ua.p256dh), authSecret = b64u.dec(ua.auth);
  if (uaPublic.length !== 65 || uaPublic[0] !== 4) throw new Error("Suscripción no válida (p256dh)");
  if (authSecret.length !== 16) throw new Error("Suscripción no válida (auth)");
  let asPrivate, asPublic;
  if (asKeys) {
    asPublic = b64u.dec(asKeys.publicKey);
    asPrivate = await crypto.subtle.importKey("jwk", rawToJwk(asPublic, asKeys.d), { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  } else {
    const kp = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    asPrivate = kp.privateKey; asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  }
  const s = salt ? b64u.dec(salt) : crypto.getRandomValues(new Uint8Array(16));
  // Importing the receiver's key also checks that it is on the P-256 curve (RFC 8291 §7).
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asPrivate, 256));
  const ikm = await hkdf(authSecret, ecdh, concat(te.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const cek = await hkdf(s, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(s, ikm, te.encode("Content-Encoding: nonce\0"), 12);
  const body = concat(typeof plaintext === "string" ? te.encode(plaintext) : plaintext, Uint8Array.of(2));
  if (body.length + 16 > rs) throw new Error("Mensaje demasiado largo");
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, body));
  const header = concat(s, Uint8Array.of(rs >>> 24, (rs >>> 16) & 255, (rs >>> 8) & 255, rs & 255), Uint8Array.of(asPublic.length), asPublic);
  return concat(header, ct);
}

/** The «Authorization: vapid t=…, k=…» header for one push endpoint (RFC 8292). */
export async function vapidHeader(endpoint, keys, { sub, now = Date.now(), ttlSec = 12 * 3600 } = {}) {
  const aud = new URL(endpoint).origin;
  const enc = (o) => b64u.enc(te.encode(JSON.stringify(o)));
  const unsigned = `${enc({ typ: "JWT", alg: "ES256" })}.${enc({ aud, exp: Math.floor(now / 1000) + ttlSec, sub })}`;
  const key = await crypto.subtle.importKey("jwk", { ...keys.privateJwk, key_ops: ["sign"] }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, te.encode(unsigned)));
  return `vapid t=${unsigned}.${b64u.enc(sig)}, k=${keys.publicKey}`;
}

// Only real push services: the server never posts to an arbitrary URL stored in the table (SSRF).
const PUSH_HOSTS = [/^web\.push\.apple\.com$/, /^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^[a-z0-9-]+\.notify\.windows\.com$/];
export function allowedEndpoint(endpoint) {
  try { const u = new URL(endpoint); return u.protocol === "https:" && PUSH_HOSTS.some((re) => re.test(u.hostname)); } catch { return false; }
}
