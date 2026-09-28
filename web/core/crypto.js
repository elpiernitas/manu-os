// Client-side encryption for backups that leave the device (ARCHITECTURE.md:
// "Drive appDataFolder cifrado"; THREAT_MODEL.md: backup completo cifrado).
// AES-256-GCM (AEAD) with a key derived from a passphrase Manu chooses.
// KDF: PBKDF2-HMAC-SHA-256 because it is native to Web Crypto; the native app
// uses Argon2id (ADR-0011). The passphrase is never stored or uploaded.
export const BACKUP_FORMAT = "manuos-backup";
export const BACKUP_VERSION = 1;
export const PBKDF2_ITERATIONS = 600000;
export const MIN_PASSPHRASE = 10;

const subtle = () => {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error("Este navegador no permite cifrar");
  return s;
};
const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
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
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, iterations);
  const header = { format: BACKUP_FORMAT, v: BACKUP_VERSION, kdf: { name: "PBKDF2", hash: "SHA-256", iterations, salt: b64(salt) }, cipher: { name: "AES-GCM", iv: b64(iv) } };
  // The header is authenticated as additional data: tampering with it fails decryption.
  const aad = new TextEncoder().encode(JSON.stringify(header));
  const ct = await subtle().encrypt({ name: "AES-GCM", iv, additionalData: aad }, key, new TextEncoder().encode(JSON.stringify(data)));
  return { ...header, ct: b64(ct) };
}

export function isEnvelope(x) {
  return Boolean(x && x.format === BACKUP_FORMAT && typeof x.ct === "string" && x.kdf?.salt && x.cipher?.iv);
}

export async function decryptBackup(envelope, passphrase) {
  if (!isEnvelope(envelope)) throw new Error("No es una copia cifrada de MANU OS");
  if (envelope.v !== BACKUP_VERSION) throw new Error(`Versión de copia no compatible (${envelope.v})`);
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
