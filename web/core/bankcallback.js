// Vuelta del banco (Enable Banking, WEB-93 preparación). Pure helpers, tested.
// Enable Banking returns to the whitelisted redirect URL with OAuth-style query parameters:
// code, state, error, error_description (https://enablebanking.com/docs/api/reference/).
// Rules:
// - The code is single-use and only becomes a session through POST /sessions, signed with the
//   application's PRIVATE key. That happens on a server (pending), never in the browser.
// - The state must match the one this device created when starting, used once, and be recent.
// - The code never goes to logs, analytics, the URL bar or the history: the page removes the
//   query at once and keeps the code only in sessionStorage, for at most PENDING_MS.

export const STATE_MAX_AGE_MS = 30 * 60 * 1000;
export const PENDING_MS = 10 * 60 * 1000;
const SAFE = /^[A-Za-z0-9._~-]{8,512}$/;

/** Reads the callback query. Only well-formed values are kept; nothing else is echoed back. */
export function parseCallback(search) {
  const p = new URLSearchParams(String(search ?? ""));
  const pick = (k) => { const v = p.get(k); return v && SAFE.test(v) ? v : null; };
  const error = p.get("error");
  return {
    code: pick("code"),
    state: pick("state"),
    error: error && /^[a-z_]{1,64}$/.test(error) ? error : error ? "invalid_response" : null,
    // Shown as text (never as HTML), cut short.
    description: (p.get("error_description") ?? "").replace(/[\u0000-\u001f<>]/g, "").slice(0, 160) || null,
    present: ["code", "state", "error"].some((k) => p.has(k)),
  };
}

/** A new random state for starting an authorisation (stored on this device, used once). */
export function newState(cryptoImpl = globalThis.crypto, now = Date.now()) {
  const b = new Uint8Array(24); cryptoImpl.getRandomValues(b);
  return { state: btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""), at: now };
}

/** Decides what the callback page does. Pure. */
export function judge(cb, stored, now = Date.now()) {
  if (!cb.present) return { kind: "empty" };
  if (cb.error) return { kind: "error", error: cb.error, description: cb.description };
  if (!cb.code || !cb.state) return { kind: "invalid" };
  if (!stored?.state) return { kind: "unknown-state" };
  if (stored.state !== cb.state) return { kind: "mismatch" };
  if (now - stored.at > STATE_MAX_AGE_MS) return { kind: "expired" };
  return { kind: "ok", pending: { code: cb.code, until: now + PENDING_MS } };
}
