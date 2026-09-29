// Client-side encryption for backups that leave the device (ARCHITECTURE.md:
// "Drive appDataFolder cifrado"; THREAT_MODEL.md: backup completo cifrado).
// AES-256-GCM (AEAD) with a key derived from a passphrase Manu chooses.
// KDF: PBKDF2-HMAC-SHA-256 because it is native to Web Crypto; the native app
// uses Argon2id (ADR-0011). The passphrase is never stored or uploaded.
export const BACKUP_FORMAT = "manuos-backup";
export const BACKUP_VERSION = 1;
export const PBKDF2_ITERATIONS = 600000;
export const MIN_PASSPHRASE = 10;
export const MIN_ITERATIONS = 100000;
export const MAX_ITERATIONS = 2000000;

const subtle = () => {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error("Este navegador no permite cifrar");
  return s;
};
// WEB-44: in chunks; spreading a multi-megabyte array overflows the call stack.
const b64 = (bytes) => {
  const u = new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(bin);
};
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(passphrase, salt, iterations) {
  const base = await subtle().importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return subtle().deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export function passphraseProblem(p) {
  if (typeof p !== "string" || p.length < MIN_PASSPHRASE) return `La frase debe tener al menos ${MIN_PASSPHRASE} caracteres.`;
  return null;
}

export async function encryptBackup(data, passphrase, { iterations = PBKDF2_ITERATIONS } = {}) {
  const problem = passphraseProblem(passphrase);
  if (problem) throw new Error(problem);
  if (!Number.isInteger(iterations) || iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS) throw new Error("Iteraciones fuera de rango");
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, iterations);
  const header = { format: BACKUP_FORMAT, v: BACKUP_VERSION, kdf: { name: "PBKDF2", hash: "SHA-256", iterations, salt: b64(salt) }, cipher: { name: "AES-GCM", iv: b64(iv) } };
  // The header is authenticated as additional data: tampering with it fails decryption.
  const aad = new TextEncoder().encode(JSON.stringify(header));
  const ct = await subtle().encrypt({ name: "AES-GCM", iv, additionalData: aad }, key, new TextEncoder().encode(JSON.stringify(data)));
  return { ...header, ct: b64(ct) };
}

const B64 = /^[A-Za-z0-9+/]+={0,2}$/;
const exactKeys = (o, keys) => o && typeof o === "object" && !Array.isArray(o) && Object.keys(o).length === keys.length && keys.every((k) => Object.prototype.hasOwnProperty.call(o, k));
function b64Length(s) {
  if (typeof s !== "string" || s.length === 0 || s.length % 4 !== 0 || !B64.test(s)) return -1;
  return (s.length / 4) * 3 - (s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0);
}

// Closed schema: exact keys, exact algorithm names, supported version, valid
// base64 with the right lengths and a safe iteration range. Anything else is
// rejected before any upload or any PBKDF2 work.
export function envelopeProblem(x) {
  if (!exactKeys(x, ["format", "v", "kdf", "cipher", "ct"])) return "campos no válidos";
  if (x.format !== BACKUP_FORMAT) return "formato no válido";
  if (x.v !== BACKUP_VERSION) return `versión no soportada (${x.v})`;
  if (!exactKeys(x.kdf, ["name", "hash", "iterations", "salt"])) return "KDF no válido";
  if (x.kdf.name !== "PBKDF2" || x.kdf.hash !== "SHA-256") return "algoritmo de KDF no válido";
  if (!Number.isInteger(x.kdf.iterations) || x.kdf.iterations < MIN_ITERATIONS || x.kdf.iterations > MAX_ITERATIONS) return "iteraciones fuera de rango";
  if (b64Length(x.kdf.salt) !== 16) return "sal no válida";
  if (!exactKeys(x.cipher, ["name", "iv"])) return "cifrado no válido";
  if (x.cipher.name !== "AES-GCM") return "algoritmo de cifrado no válido";
  if (b64Length(x.cipher.iv) !== 12) return "IV no válido";
  if (b64Length(x.ct) < 16) return "texto cifrado no válido";
  return null;
}

export function isEnvelope(x) {
  return envelopeProblem(x) === null;
}

export async function decryptBackup(envelope, passphrase) {
  const problem = envelopeProblem(envelope);
  if (problem) throw new Error(`Copia no válida: ${problem}`);
  const { format, v, kdf, cipher } = envelope;
  const aad = new TextEncoder().encode(JSON.stringify({ format, v, kdf, cipher }));
  const key = await deriveKey(passphrase, unb64(kdf.salt), kdf.iterations);
  try {
    const pt = await subtle().decrypt({ name: "AES-GCM", iv: unb64(cipher.iv), additionalData: aad }, key, unb64(envelope.ct));
    return JSON.parse(new TextDecoder().decode(pt));
  } catch {
    throw new Error("Frase incorrecta o copia dañada");
  }
}
