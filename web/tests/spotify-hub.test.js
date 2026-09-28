import { test } from "node:test";
import assert from "node:assert/strict";
import { isSpotifyClientId, randomVerifier, challengeFor, authorizeUrl, exchangeCode, findSpeaker, listDevices, transferTo, SPOTIFY_SCOPES } from "../core/spotify.js";
import { appsFor, whatsappUrl, whatsappNumber, askElsewhereUrl } from "../core/hub.js";

test("PKCE: verifier charset/length and S256 challenge (RFC 7636 appendix B vector)", async () => {
  const v = randomVerifier();
  assert.equal(v.length, 64);
  assert.match(v, /^[A-Za-z0-9\-._~]+$/);
  assert.equal(await challengeFor("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  const url = new URL(authorizeUrl({ clientId: "a".repeat(32), redirectUri: "https://elpiernitas.github.io/manu-os/", challenge: "c", state: "s" }));
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("scope"), SPOTIFY_SCOPES);
  assert.ok(!url.search.includes("secret"));
  assert.ok(isSpotifyClientId("0123456789abcdef0123456789abcdef"));
  assert.ok(!isSpotifyClientId("nope"));
});

test("token exchange sends verifier, never a secret", async () => {
  let body;
  const t = await exchangeCode({ clientId: "id", code: "c", redirectUri: "r", verifier: "v" }, async (url, init) => { body = new URLSearchParams(init.body); return { ok: true, json: async () => ({ access_token: "A", refresh_token: "R", expires_in: 3600 }) }; });
  assert.equal(body.get("code_verifier"), "v");
  assert.equal(body.get("client_secret"), null);
  assert.equal(t.access, "A");
  assert.equal(t.refresh, "R");
});

test("finds the bathroom speaker whatever the case or accents", () => {
  const devices = [{ id: "1", name: "iPhone de Manu" }, { id: "2", name: "BAÑO" }, { id: "3", name: "Bañera" }];
  assert.equal(findSpeaker(devices).id, "2");
  assert.equal(findSpeaker([{ id: "9", name: "Altavoz baño (Chromecast)" }]).id, "9");
  assert.equal(findSpeaker([{ id: "1", name: "Salón" }]), null);
});

test("transfer does not start playback; errors are explained", async () => {
  let sent;
  await transferTo("tok", "2", async (url, init) => { sent = { url, init }; return { ok: true, status: 204 }; });
  assert.equal(sent.init.method, "PUT");
  assert.deepEqual(JSON.parse(sent.init.body), { device_ids: ["2"], play: false });
  await assert.rejects(listDevices("t", async () => ({ ok: false, status: 403 })), (e) => e.code === "premium");
  await assert.rejects(transferTo("t", "x", async () => ({ ok: false, status: 404 })), (e) => e.code === "device");
});

test("hub: apps by mode, Oviedo mornings, WhatsApp and other assistants", () => {
  assert.deepEqual(appsFor("WORK").map((a) => a.id), ["calendar", "gmail", "drive", "docs", "sheets"]);
  assert.deepEqual(appsFor("MORNING", { oviedoToday: true }).map((a) => a.id).slice(0, 2), ["oviedo", "alsa"]);
  assert.ok(!appsFor("WORK").some((a) => a.id === "spotify"), "no music shortcut in work mode");
  assert.equal(whatsappNumber("612 34 56 78"), "34612345678");
  assert.equal(whatsappNumber("12"), null);
  assert.equal(whatsappUrl("+34 612345678", "¡Feliz cumpleaños!"), "https://wa.me/34612345678?text=%C2%A1Feliz%20cumplea%C3%B1os!");
  assert.equal(whatsappUrl("", "x"), null);
  assert.ok(askElsewhereUrl("claude", "hola").startsWith("https://claude.ai/new?q=hola"));
});
