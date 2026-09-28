// Spotify: move playback to Manu's speaker ("baño") and open Spotify so he
// chooses what to play. Authorization Code with PKCE (no client secret), as
// Spotify documents for apps that cannot keep a secret. Tokens live in this
// device's storage, outside the vault (never in backups).
import { normalise } from "./text.js";

const AUTH = "https://accounts.spotify.com/authorize";
const TOKEN = "https://accounts.spotify.com/api/token";
const API = "https://api.spotify.com/v1/me/player";
export const SPOTIFY_SCOPES = "user-read-playback-state user-modify-playback-state";
export const DEFAULT_SPEAKER = "baño";

export const isSpotifyClientId = (id) => /^[0-9a-f]{32}$/i.test(String(id ?? "").trim());

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function randomVerifier(length = 64) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export async function challengeFor(verifier) {
  return b64url(await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
}

export function authorizeUrl({ clientId, redirectUri, challenge, state }) {
  const p = new URLSearchParams({ client_id: clientId, response_type: "code", redirect_uri: redirectUri, code_challenge_method: "S256", code_challenge: challenge, scope: SPOTIFY_SCOPES, state });
  return `${AUTH}?${p}`;
}

async function tokenRequest(body, fetchImpl) {
  const res = await fetchImpl(TOKEN, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body).toString() });
  if (!res.ok) throw Object.assign(new Error("Spotify no ha dado permiso"), { code: "auth" });
  const j = await res.json();
  return { access: j.access_token, refresh: j.refresh_token ?? body.refresh_token ?? null, expires: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
}

export const exchangeCode = ({ clientId, code, redirectUri, verifier }, fetchImpl = fetch) =>
  tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: clientId, code_verifier: verifier }, fetchImpl);

export const refreshTokens = ({ clientId, refresh }, fetchImpl = fetch) =>
  tokenRequest({ grant_type: "refresh_token", refresh_token: refresh, client_id: clientId }, fetchImpl);

// "Baño", "Altavoz baño", "BAÑO (Chromecast)" all match "baño".
export function findSpeaker(devices, wanted = DEFAULT_SPEAKER) {
  const w = normalise(wanted);
  return (devices ?? []).find((d) => normalise(d.name).split(/[^a-z0-9ñ]+/).includes(w)) ?? (devices ?? []).find((d) => normalise(d.name).includes(w)) ?? null;
}

async function player(token, path, init, fetchImpl) {
  const res = await fetchImpl(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) } });
  if (res.status === 401) throw Object.assign(new Error("Sesión de Spotify caducada"), { code: "auth" });
  if (res.status === 403) throw Object.assign(new Error("Spotify no deja cambiar de altavoz (suele requerir Premium)"), { code: "premium" });
  if (res.status === 404) throw Object.assign(new Error("Spotify no encuentra ese altavoz ahora"), { code: "device" });
  if (!res.ok) throw new Error(`Spotify respondió ${res.status}`);
  return res.status === 204 ? null : res.json().catch(() => null);
}

export async function listDevices(token, fetchImpl = fetch) {
  return (await player(token, "/devices", {}, fetchImpl))?.devices ?? [];
}

// Transfers playback without starting it: Manu picks the music in Spotify.
export function transferTo(token, deviceId, fetchImpl = fetch) {
  return player(token, "", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ device_ids: [deviceId], play: false }) }, fetchImpl);
}
