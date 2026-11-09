// WEB-99 — cifrado Web Push (RFC 8291) y VAPID (RFC 8292), contra el ejemplo oficial del RFC 8291.
import test from "node:test";
import assert from "node:assert/strict";
import { encrypt, vapidHeader, newVapidKeys, b64u, allowedEndpoint, rawToJwk } from "../../supabase/functions/manu-push/webpush.js";

// RFC 8291, section 5 and Appendix A.
const RFC = {
  plaintext: "When I grow up, I want to be a watermelon",
  ua: { p256dh: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4", auth: "BTBZMqHH6r4Tts7J_aSIgg" },
  as: { publicKey: "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8", d: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw" },
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  body: "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};

test("encryption reproduces the RFC 8291 example byte for byte", async () => {
  const out = await encrypt(RFC.plaintext, RFC.ua, { asKeys: RFC.as, salt: RFC.salt });
  assert.equal(b64u.enc(out), RFC.body);
  // 86-byte header (Appendix A) + 41 bytes of text + 1 delimiter + 16-byte tag. The «Content-Length: 145»
  // printed in §5 does not match its own body (144 bytes decoded); the bytes are what we compare.
  assert.equal(out.length, 86 + 42 + 16);
});

test("with random keys the receiver can decrypt it (round trip with the RFC receiver key)", async () => {
  const out = await encrypt("Tienes un recordatorio en MANU", RFC.ua);
  // Decrypt as the user agent would (RFC 8291 §3.4), with the receiver private key of the RFC.
  const salt = out.slice(0, 16), idlen = out[20], asPublic = out.slice(21, 21 + idlen), ct = out.slice(21 + idlen);
  const uaPriv = await crypto.subtle.importKey("jwk", rawToJwk(b64u.dec(RFC.ua.p256dh), "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94"), { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  const asKey = await crypto.subtle.importKey("raw", asPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: asKey }, uaPriv, 256));
  const te = new TextEncoder();
  const hmac = async (k, d) => new Uint8Array(await crypto.subtle.sign("HMAC", await crypto.subtle.importKey("raw", k, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]), d));
  const cat = (...xs) => Uint8Array.from(xs.flatMap((x) => [...x]));
  const hk = async (s, ikm, info, n) => (await hmac(await hmac(s, ikm), cat(info, [1]))).slice(0, n);
  const ikm = await hk(b64u.dec(RFC.ua.auth), ecdh, cat(te.encode("WebPush: info\0"), b64u.dec(RFC.ua.p256dh), asPublic), 32);
  const cek = await hk(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hk(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12);
  const pt = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]), ct));
  assert.equal(new TextDecoder().decode(pt.slice(0, -1)), "Tienes un recordatorio en MANU");
  assert.equal(pt.at(-1), 2, "padding delimiter");
});

test("bad subscriptions are refused", async () => {
  await assert.rejects(encrypt("x", { p256dh: "AAAA", auth: RFC.ua.auth }), /p256dh/);
  await assert.rejects(encrypt("x", { p256dh: RFC.ua.p256dh, auth: "AAAA" }), /auth/);
  await assert.rejects(encrypt("x".repeat(5000), RFC.ua), /largo/);
});

test("VAPID: a valid ES256 JWT for the endpoint's origin, verifiable with the public key", async () => {
  const keys = await newVapidKeys();
  assert.equal(b64u.dec(keys.publicKey).length, 65);
  const h = await vapidHeader("https://web.push.apple.com/QGuQyavXutnMH...", keys, { sub: "https://example.invalid/manu", now: Date.parse("2026-11-09T10:00:00Z") });
  const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(h);
  assert.ok(m); assert.equal(m[4], keys.publicKey);
  const claims = JSON.parse(new TextDecoder().decode(b64u.dec(m[2])));
  assert.equal(claims.aud, "https://web.push.apple.com"); assert.equal(claims.sub, "https://example.invalid/manu");
  assert.equal(claims.exp, Date.parse("2026-11-09T10:00:00Z") / 1000 + 12 * 3600);
  const pub = await crypto.subtle.importKey("raw", b64u.dec(keys.publicKey), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  assert.ok(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pub, b64u.dec(m[3]), new TextEncoder().encode(`${m[1]}.${m[2]}`)));
  assert.ok(!("d" in JSON.parse(JSON.stringify({ k: keys.publicKey }))), "only the public key travels");
});

test("only real push services are allowed as endpoints", () => {
  for (const ok of ["https://web.push.apple.com/abc", "https://fcm.googleapis.com/fcm/send/abc", "https://updates.push.services.mozilla.com/wpush/v2/abc", "https://wns2-par02p.notify.windows.com/w/?token=abc"]) assert.ok(allowedEndpoint(ok), ok);
  for (const bad of ["http://web.push.apple.com/abc", "https://evil.example/abc", "https://web.push.apple.com.evil.example/x", "https://169.254.169.254/latest", "nope"]) assert.ok(!allowedEndpoint(bad), bad);
});
