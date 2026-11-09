// Enable Banking AIS: pure, testable helpers. No credentials or user data in this module.
// Official API: https://enablebanking.com/docs/api/reference/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OAUTH_VALUE = /^[A-Za-z0-9._~-]{8,1024}$/;
export const validState = (s) => typeof s === "string" && OAUTH_VALUE.test(s);
export const validAccountId = (s) => typeof s === "string" && UUID.test(s);
export const validIsoDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z")) && new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
const utf8 = (s) => new TextEncoder().encode(s);
export const newOAuthState = (cryptoImpl = crypto) => b64url(cryptoImpl.getRandomValues(new Uint8Array(32)));
export async function hashState(state, cryptoImpl = crypto) {
  if (!validState(state)) throw new Error("Invalid OAuth state");
  return Array.from(new Uint8Array(await cryptoImpl.subtle.digest("SHA-256", utf8(state)))).map((b) => b.toString(16).padStart(2, "0")).join("");
}
export async function makeEnableJwt({ appId, privatePem, now = Date.now(), cryptoImpl = crypto }) {
  if (!validAccountId(appId)) throw new Error("Invalid application ID");
  if (typeof privatePem !== "string" || !privatePem.includes("-----BEGIN PRIVATE KEY-----")) throw new Error("Require a PKCS#8 private key stored as a server secret");
  const data = privatePem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const binary = atob(data);
  const key = await cryptoImpl.subtle.importKey("pkcs8", Uint8Array.from(binary, (c) => c.charCodeAt(0)), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const issued = Math.floor(now / 1000);
  const h = b64url(utf8(JSON.stringify({ typ: "JWT", alg: "RS256", kid: appId })));
  const p = b64url(utf8(JSON.stringify({ iss: "enablebanking.com", aud: "api.enablebanking.com", iat: issued, exp: issued + 600 })));
  const message = h + "." + p;
  const signature = await cryptoImpl.subtle.sign("RSASSA-PKCS1-v1_5", key, utf8(message));
  return message + "." + b64url(new Uint8Array(signature));
}
export function sabadellFromAspsps(data) {
  const all = Array.isArray(data?.aspsps) ? data.aspsps : [];
  const match = all.find((x) => x?.country === "ES" && typeof x.name === "string" && /sabadell/i.test(x.name));
  if (!match) throw new Error("Banco Sabadell no aparece en GET /aspsps; no se inicia autorización");
  return { name: match.name, country: "ES" };
}
export function sanitizeAccounts(raw) {
  const all = Array.isArray(raw) ? raw : [];
  return all.filter((a) => validAccountId(a?.uid)).slice(0, 5).map((a) => ({ uid: a.uid, label: String(a.name ?? "Cuenta").slice(0, 50), currency: String(a.currency ?? "EUR").slice(0, 3) }));
}
export function balancesView(data) {
  return (Array.isArray(data?.balances) ? data.balances : []).slice(0, 12).map((b) => ({
    type: String(b.balance_type ?? "").slice(0, 16),
    amount: String(b.balance_amount?.amount ?? "").slice(0, 40),
    currency: String(b.balance_amount?.currency ?? "EUR").slice(0, 3),
    at: String(b.reference_date ?? b.last_change_date_time ?? "").slice(0, 30),
  }));
}
export function transactionsView(data) {
  return {
    transactions: (Array.isArray(data?.transactions) ? data.transactions : []).slice(0, 100).map((t) => ({
      ref: String(t.entry_reference ?? "").slice(0, 100),
      date: String(t.booking_date ?? t.value_date ?? "").slice(0, 30),
      amount: String(t.transaction_amount?.amount ?? "").slice(0, 40),
      currency: String(t.transaction_amount?.currency ?? "EUR").slice(0, 3),
      direction: t.credit_debit_indicator === "CRDT" ? "credit" : t.credit_debit_indicator === "DBIT" ? "debit" : "unknown",
      description: String((Array.isArray(t.remittance_information) ? t.remittance_information.join(" ") : t.remittance_information) ?? t.additional_information ?? "").slice(0, 160),
      status: String(t.status ?? "").slice(0, 20),
    })),
    continuation: typeof data?.continuation_key === "string" ? data.continuation_key.slice(0, 500) : null,
  };
}
