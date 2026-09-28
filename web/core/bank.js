// Bank statement import (CSV exported from the bank's website/app).
// Runs on the device; nothing is uploaded. Unknown formats are rejected with a reason.
import { normalise } from "./text.js";
import { newEntry } from "./money.js";

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

const DATE_KEYS = ["fecha operacion", "fecha", "f. operacion", "fecha valor", "date"];
const CONCEPT_KEYS = ["concepto", "descripcion", "movimiento", "detalle", "comercio", "description"];
const AMOUNT_KEYS = ["importe", "cantidad", "amount", "importe (eur)", "importe eur"];

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

function fingerprint(at, cents, concept) {
  const str = `${at.slice(0, 10)}|${cents}|${normalise(concept)}`;
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  return `bank-${h.toString(36)}`;
}

// Returns { entries, skippedIncome, skippedInvalid, duplicates } or { error }.
export function importStatement(text, existingIds = new Set()) {
  const rows = parseCsv(text);
  const headerIndex = rows.findIndex((r) => findColumn(r, DATE_KEYS) >= 0 && findColumn(r, AMOUNT_KEYS) >= 0);
  if (headerIndex < 0) return { error: "No encuentro las columnas de fecha e importe. ¿Es el CSV de movimientos del banco?" };
  const header = rows[headerIndex];
  const cDate = findColumn(header, DATE_KEYS), cAmount = findColumn(header, AMOUNT_KEYS), cConcept = findColumn(header, CONCEPT_KEYS);
  const result = { entries: [], skippedIncome: 0, skippedInvalid: 0, duplicates: 0 };
  const seen = new Set(existingIds);
  for (const r of rows.slice(headerIndex + 1)) {
    const at = parseDate(r[cDate]);
    const cents = amountToCents(r[cAmount]);
    if (!at || cents === null || cents === 0) { result.skippedInvalid++; continue; }
    if (cents > 0) { result.skippedIncome++; continue; }
    const concept = (cConcept >= 0 ? r[cConcept] : "").slice(0, 80) || null;
    const id = fingerprint(at, cents, concept ?? "");
    if (seen.has(id)) { result.duplicates++; continue; }
    seen.add(id);
    result.entries.push({ ...newEntry({ id, cents: -cents, merchant: concept, at }), source: "BANK" });
  }
  return result;
}
