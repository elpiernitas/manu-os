// Bank statement import (CSV exported from the bank's website/app).
// Runs on the device; nothing is uploaded. Unknown formats are rejected with a reason.
import { normalise } from "./text.js";
import { newEntry, categoryId } from "./money.js";

export function parseCsv(text) {
  const src = String(text ?? "").replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [";", ",", "\t"].map((d) => [d, firstLine.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ""));
}

const DATE_KEYS = ["fecha operacion", "f. operativa", "f. operacion", "fecha", "fecha valor", "f. valor", "date"];
const CONCEPT_KEYS = ["concepto", "descripcion", "movimiento", "detalle", "comercio", "description"];
const AMOUNT_KEYS = ["importe", "cantidad", "amount", "importe (eur)", "importe eur"];
const BALANCE_KEYS = ["saldo", "balance"];

function findColumn(header, keys) {
  const h = header.map(normalise);
  for (const k of keys) {
    const i = h.findIndex((c) => c === k);
    if (i >= 0) return i;
  }
  for (const k of keys) {
    const i = h.findIndex((c) => c.startsWith(k));
    if (i >= 0) return i;
  }
  return -1;
}

// "-1.234,56" / "-1234.56" / "12,5 €" -> cents (signed integer), or null.
export function amountToCents(raw) {
  let s = String(raw ?? "").replace(/[€\s]|EUR/gi, "");
  if (!/^[-+]?[\d.,]+$/.test(s)) return null;
  const lastComma = s.lastIndexOf(","), lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

// "28/09/2026", "28-09-26", "2026-09-28" -> "2026-09-28T12:00:00" (local noon), or null.
export function parseDate(raw) {
  // Excel serial dates (days since 1899-12-30) from spreadsheets.
  if (typeof raw === "number" && raw > 20000 && raw < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(raw) * 86400000);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12).toISOString();
  }
  const s = String(raw ?? "").trim();
  let y, m, d;
  let t = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (t) [, y, m, d] = t;
  else if ((t = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/))) {
    [, d, m, y] = t;
    if (y.length === 2) y = `20${y}`;
  } else return null;
  const date = new Date(Number(y), Number(m) - 1, Number(d), 12);
  if (date.getMonth() !== Number(m) - 1 || date.getDate() !== Number(d)) return null;
  return date.toISOString();
}

// Identity of a bank line. The running balance ("Saldo") tells apart two
// identical purchases on the same day; without it, the nth repetition inside
// the same file gets its own index. Re-importing the same file stays idempotent.
// The id is the identity itself, not a hash: a 32-bit hash let two different
// lines collide and one was dropped as a "duplicate".
function fingerprint(at, cents, concept, balance, nth) {
  return `bank:${at.slice(0, 10)}|${cents}|${normalise(concept)}|${balance ?? ""}|${nth}`;
}

// Ids written before WEB-13 (32-bit hash). Only used to recognise lines that
// were already imported, and only if the saved entry really is the same line.
export function legacyFingerprint(at, cents, concept, balance, nth) {
  const str = `${at.slice(0, 10)}|${cents}|${normalise(concept)}|${balance ?? ""}|${nth}`;
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  return `bank-${h.toString(36)}`;
}

// Returns { entries, income, balance, skippedInvalid, duplicates, incomeDuplicates } or { error }.
// Income lines (positive amounts) are kept apart from expenses (WEB-21).
export function importStatement(text, existingIds = new Set(), learned = {}, legacy = new Map()) {
  return importStatementRows(parseCsv(text), existingIds, learned, legacy);
}

// Same import from already-parsed rows (e.g. an .xls read with SheetJS).
// `legacy`: Map of pre-WEB-13 id -> saved entry.
export function importStatementRows(rawRows, existingIds = new Set(), learned = {}, legacy = new Map()) {
  const rows = (rawRows ?? []).map((r) => (r ?? []).map((c) => (typeof c === "string" ? c.trim() : c))).filter((r) => r.some((c) => c !== "" && c !== null && c !== undefined));
  const headerIndex = rows.findIndex((r) => findColumn(r, DATE_KEYS) >= 0 && findColumn(r, AMOUNT_KEYS) >= 0);
  if (headerIndex < 0) return { error: "No encuentro las columnas de fecha e importe. ¿Es el archivo de movimientos del banco?" };
  const header = rows[headerIndex].map((c) => String(c ?? ""));
  const cDate = findColumn(header, DATE_KEYS), cAmount = findColumn(header, AMOUNT_KEYS), cConcept = findColumn(header, CONCEPT_KEYS), cBalance = findColumn(header, BALANCE_KEYS);
  const occurrences = new Map();
  const result = { entries: [], income: [], incomeDuplicates: 0, balance: null, skippedIncome: 0, skippedInvalid: 0, duplicates: 0 };
  const seen = new Set(existingIds);
  for (const r of rows.slice(headerIndex + 1)) {
    const at = parseDate(r[cDate]);
    const cents = amountToCents(r[cAmount]);
    if (!at || cents === null || cents === 0) { result.skippedInvalid++; continue; }
    const concept = String(cConcept >= 0 ? r[cConcept] ?? "" : "").slice(0, 80) || null;
    const balance = cBalance >= 0 ? amountToCents(r[cBalance]) : null;
    // Latest running balance in the file («Saldo»): the account balance on that day.
    if (balance !== null && (!result.balance || at > result.balance.at)) result.balance = { cents: balance, at };
    const base = `${at.slice(0, 10)}|${cents}|${normalise(concept ?? "")}|${balance ?? ""}`;
    const nth = occurrences.get(base) ?? 0;
    occurrences.set(base, nth + 1);
    const id = fingerprint(at, cents, concept ?? "", balance, nth);
    const old = legacy.get(legacyFingerprint(at, cents, concept ?? "", balance, nth));
    const sameLine = old && old.at?.slice(0, 10) === at.slice(0, 10) && old.cents === -cents && normalise(old.merchant ?? "") === normalise(concept ?? "");
    if (seen.has(id) || sameLine) { if (cents > 0) result.incomeDuplicates++; else result.duplicates++; continue; }
    seen.add(id);
    if (cents > 0) { result.income.push({ id, cents, concept, at, source: "BANK", kind: incomeKind(concept) }); continue; }
    result.entries.push({ ...newEntry({ id, cents: -cents, merchant: concept, at }, learned), source: "BANK" });
  }
  return result;
}

// Same statement seen by two sources (the bank file and ChatGPT's classified
// sheet): lines pair up by day and amount, counting repetitions, so neither
// import double-counts the other.
const dayCents = (e) => `${e.at.slice(0, 10)}|${e.cents}`;
export function dropCrossSource(entries, existing, source) {
  const pool = new Map();
  for (const e of existing) if (e.source === source) pool.set(dayCents(e), (pool.get(dayCents(e)) ?? 0) + 1);
  const kept = [];
  let duplicates = 0;
  for (const e of entries) {
    const k = dayCents(e), n = pool.get(k) ?? 0;
    if (n > 0) { pool.set(k, n - 1); duplicates++; } else kept.push(e);
  }
  return { entries: kept, duplicates };
}

// «Gastos clasificados» sheet of the ChatGPT Excel: expenses with the category
// ChatGPT proposed. They are imported as rule-based proposals (ruled), never as
// Manu's decisions; his own corrections (plain rules) still win.
export function classifiedFromRows(rawRows, existing = [], learned = {}) {
  const rows = (rawRows ?? []).map((r) => r ?? []);
  const norm = (c) => normalise(String(c ?? ""));
  const h = rows.findIndex((r) => r.some((c) => norm(c) === "fecha") && r.some((c) => norm(c).startsWith("gasto")) && r.some((c) => norm(c) === "categoria"));
  if (h < 0) return null;
  const header = rows[h].map(norm);
  const col = (p) => header.findIndex(p);
  const cDate = col((c) => c === "fecha"), cAmount = col((c) => c.startsWith("gasto")), cCat = col((c) => c === "categoria");
  const cConcept = col((c) => c.startsWith("concepto")), cName = col((c) => c.startsWith("comercio")), cSub = col((c) => c.startsWith("subcategoria")), cReview = col((c) => c === "revisar");
  const seen = new Set(existing.map((e) => e.id));
  const occurrences = new Map();
  const out = [];
  let skipped = 0, duplicates = 0;
  for (const r of rows.slice(h + 1)) {
    if (!r.some((c) => c !== "" && c !== null && c !== undefined)) continue;
    const at = parseDate(r[cDate]);
    const raw = typeof r[cAmount] === "number" ? Math.round(r[cAmount] * 100) : amountToCents(r[cAmount]);
    const cents = raw === null ? null : Math.abs(raw);
    if (!at || !cents) { skipped++; continue; }
    const concept = String((cConcept >= 0 && r[cConcept]) || (cName >= 0 && r[cName]) || "").trim().slice(0, 80) || null;
    const base = `${at.slice(0, 10)}|${cents}|${normalise(concept ?? "")}`;
    const nth = occurrences.get(base) ?? 0;
    occurrences.set(base, nth + 1);
    const id = `gpt:${base}|${nth}`;
    if (seen.has(id)) { duplicates++; continue; }
    seen.add(id);
    const entry = { ...newEntry({ id, cents, merchant: concept, at }, learned), source: "CHATGPT" };
    const manual = entry.category && !entry.inferred && !entry.ruled; // Manu's own rule
    const category = categoryId(r[cCat]);
    if (!manual && category) {
      const ask = cReview >= 0 && norm(r[cReview]).startsWith("s");
      delete entry.review; delete entry.sub;
      Object.assign(entry, { category, inferred: ask, ruled: true }, ask ? { review: true } : {});
      if (cSub >= 0 && r[cSub]) entry.sub = String(r[cSub]).slice(0, 60);
    }
    out.push(entry);
  }
  const cross = dropCrossSource(out, existing, "BANK");
  return { entries: cross.entries, duplicates: duplicates + cross.duplicates, skipped };
}

// What kind of income a bank line is, from its concept. Payroll without a
// keyword is recognised later by repetition (insights.js › markPayroll).
export function incomeKind(concept) {
  const t = ` ${normalise(concept ?? "").replace(/[^a-z0-9ñ]+/g, " ")} `;
  if (/ (nomina|nominas|salario|haberes|payroll) /.test(t)) return "PAYROLL";
  if (/ (manutencion|pension alimenticia) /.test(t)) return "FAMILY"; // WEB-86
  // Banks write «ABONO BIZUM» for a Bizum received: Bizum first, and «abono»
  // alone (any credit) is not a refund.
  if (/ bizum /.test(t)) return "BIZUM";
  if (/ (devolucion|reembolso) /.test(t)) return "REFUND";
  if (/ (transferencia|transf|traspaso) /.test(t)) return "TRANSFER";
  return "OTHER";
}
