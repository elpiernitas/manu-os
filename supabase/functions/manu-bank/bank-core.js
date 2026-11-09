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
// The key as stored in the secret: PKCS#8 («BEGIN PRIVATE KEY») or PKCS#1 («BEGIN RSA PRIVATE
// KEY»), with real or escaped («\n») line breaks. PKCS#1 is wrapped into PKCS#8 in memory (the
// secret itself is never changed). Returns { type, der } or { type: "missing"|"other"|"encrypted" }.
export function readPrivateKey(raw) {
  const pem = String(raw ?? "").replace(/\\n/g, "\n").replace(/\r/g, "").trim();
  if (!pem) return { type: "missing" };
  if (/BEGIN ENCRYPTED PRIVATE KEY/.test(pem)) return { type: "encrypted" };
  const m = /-----BEGIN (RSA )?PRIVATE KEY-----([\s\S]+?)-----END \1?PRIVATE KEY-----/.exec(pem);
  if (!m) {
    // No PEM block: maybe the base64 body alone (DER), or a whole PEM file encoded in base64.
    const b64 = pem.replace(/\s/g, "");
    if (/^[A-Za-z0-9+/=_-]{300,}$/.test(b64)) {
      let bytes;
      try { bytes = Uint8Array.from(atob(b64.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)); } catch { return { type: "other", marker: "none" }; }
      const text = new TextDecoder().decode(bytes);
      if (/-----BEGIN/.test(text)) return readPrivateKey(text);
      if (bytes[0] === 0x30) return { type: "der", der: bytes, alt: pkcs1ToPkcs8(bytes) };
    }
    return { type: "other", marker: pemMarker(pem) };
  }
  let der;
  try { der = Uint8Array.from(atob(m[2].replace(/\s/g, "")), (c) => c.charCodeAt(0)); } catch { return { type: "other", marker: "bad-base64" }; }
  return m[1] ? { type: "pkcs1", der: pkcs1ToPkcs8(der) } : { type: "pkcs8", der };
}
// Only the KIND of the first PEM header (a fixed list), never any content.
const MARKERS = ["CERTIFICATE", "PUBLIC KEY", "RSA PUBLIC KEY", "PRIVATE KEY", "RSA PRIVATE KEY", "EC PRIVATE KEY", "OPENSSH PRIVATE KEY", "CERTIFICATE REQUEST"];
export function pemMarker(text) {
  const m = /-----BEGIN ([A-Z ]{3,40})-----/.exec(String(text ?? ""));
  if (!m) return /BEGIN/i.test(String(text)) ? "malformed-header" : "none";
  return MARKERS.includes(m[1]) ? m[1] : "unknown";
}
// Imports the key whatever the accepted format (raw DER may be PKCS#8 or PKCS#1).
export async function importSigningKey(k, cryptoImpl = crypto) {
  const alg = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" };
  try { return await cryptoImpl.subtle.importKey("pkcs8", k.der, alg, false, ["sign"]); }
  catch (e) { if (k.alt) return cryptoImpl.subtle.importKey("pkcs8", k.alt, alg, false, ["sign"]); throw e; }
}
const derLen = (n) => (n < 128 ? [n] : n < 256 ? [0x81, n] : n < 65536 ? [0x82, n >> 8, n & 255] : [0x83, n >> 16, (n >> 8) & 255, n & 255]);
export function pkcs1ToPkcs8(pkcs1) {
  // PrivateKeyInfo ::= SEQUENCE { INTEGER 0, AlgorithmIdentifier { rsaEncryption, NULL }, OCTET STRING pkcs1 }
  const algo = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  const octet = [0x04, ...derLen(pkcs1.length)];
  const body = [0x02, 0x01, 0x00, ...algo, ...octet];
  const total = body.length + pkcs1.length;
  const out = new Uint8Array([0x30, ...derLen(total), ...body, ...pkcs1]);
  return out;
}
export const cleanAppId = (s) => String(s ?? "").trim();
export async function makeEnableJwt({ appId, privatePem, now = Date.now(), cryptoImpl = crypto }) {
  appId = cleanAppId(appId);
  if (!validAccountId(appId)) throw new Error("Invalid application ID");
  const k = readPrivateKey(privatePem);
  if (!k.der) throw new Error("Require an RSA private key (PKCS#8 or PKCS#1) stored as a server secret");
  const key = await importSigningKey(k, cryptoImpl);
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
  // In Enable Banking, `name` is the account HOLDER's name (AccountResource): never stored.
  // The label is the account description, or «Cuenta ···1234» from the IBAN's last 4 digits.
  const label = (a) => {
    const d = typeof a.details === "string" ? a.details.trim() : typeof a.product === "string" ? a.product.trim() : "";
    if (d) return d.slice(0, 50);
    const iban = String(a.account_id?.iban ?? "").replace(/\s/g, "");
    return iban.length >= 4 ? "Cuenta ···" + iban.slice(-4) : "Cuenta";
  };
  return all.filter((a) => validAccountId(a?.uid)).slice(0, 5).map((a) => ({ uid: a.uid, label: label(a), currency: String(a.currency ?? "EUR").slice(0, 3) }));
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
    transactions: (Array.isArray(data?.transactions) ? data.transactions : []).slice(0, 1000).map((t) => ({
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

// Pre-flight from GET /application (GetApplicationResponse): only flags, never secrets or names.
export function serverCheck(app, callback) {
  const urls = Array.isArray(app?.redirect_urls) ? app.redirect_urls : [];
  const services = Array.isArray(app?.services) ? app.services : [];
  const out = {
    active: app?.active === true,
    production: app?.environment === "PRODUCTION",
    ais: services.includes("AIS"),
    redirectRegistered: typeof callback === "string" && urls.includes(callback),
  };
  out.ready = out.active && out.production && out.ais && out.redirectRegistered;
  return out;
}

// Which configuration checks pass. Booleans and a key TYPE only: never a value, length or prefix.
export async function configReport(env, { project, cryptoImpl = crypto } = {}) {
  const k = readPrivateKey(env.privateKey);
  let keyImports = false;
  if (k.der) { try { await importSigningKey(k, cryptoImpl); keyImports = true; } catch {} }
  const expected = `https://${project}.supabase.co/functions/v1/manu-bank`;
  const r = {
    supabaseUrl: /^https:\/\//.test(env.supabase ?? ""),
    serviceKey: (env.service ?? "").length > 20,
    publicKey: (env.public ?? "").length > 10,
    appIdFormat: validAccountId(cleanAppId(env.appId)),
    privateKeyType: k.type,
    ...(k.marker ? { privateKeyHeader: k.marker } : {}),
    privateKeyImports: keyImports,
    callbackMatches: String(env.callback ?? "").trim() === expected,
  };
  r.ok = r.supabaseUrl && r.serviceKey && r.publicKey && r.appIdFormat && r.privateKeyImports && r.callbackMatches;
  return r;
}
