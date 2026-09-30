// «Busca "eva" y elige cuál» (WEB-61): Google contacts found by any word of
// the name, so every Eva shows up, and the ones already in Personas are marked.
// Pure; the contacts never leave the phone.
import { normalise } from "./text.js";

const words = (s) => normalise(s).replace(/[^a-z0-9ñ]+/g, " ").trim();

export function searchContacts(contacts, query, people = [], limit = 15) {
  const terms = words(query).split(" ").filter(Boolean);
  if (!terms.length) return [];
  const added = new Set((people ?? []).map((p) => p.googleId).filter(Boolean));
  const out = [];
  for (const c of contacts ?? []) {
    const hay = ` ${words(c.name)}`;
    if (!terms.every((t) => hay.includes(` ${t}`))) continue;
    out.push({ ...c, added: added.has(c.googleId), first: hay.startsWith(` ${terms[0]}`) });
  }
  // Names starting with the query first («Eva …» before «María Eva …»), then A–Z.
  return out.sort((a, b) => (b.first - a.first) || a.name.localeCompare(b.name, "es")).slice(0, limit).map(({ first, ...c }) => c);
}
