// «Buscar en todo» (WEB-48): one box for everything MANU keeps on the phone
// (ideas, tasks, expenses, income, reminders, people, projects, meals, chat).
// «Tu archivo» and the diary are searched with archive.search and joined by
// the app. Pure and local: nothing leaves the device.
import { normalise } from "./text.js";
import { terms } from "./archive.js";
import { euros } from "./money.js";

const day = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }); };

// Every searchable thing as { kind, icon, title, detail, at, go } where `go`
// says where it lives: { tab } or { sub } or { project }.
function* items(v) {
  for (const i of v.inbox ?? []) {
    const kind = i.status === "TASK" ? "Tarea" : i.status === "IDEA" ? "Idea" : "Apunte";
    yield { kind, icon: i.status === "TASK" ? (i.done ? "☑️" : "✅") : "💡", title: i.text, detail: `${kind}${i.done ? " hecha" : ""} · ${day(i.at)}`, at: i.at, go: { tab: "agenda" }, text: `${i.text} ${i.link ?? ""}` };
  }
  for (const s of v.spending ?? []) yield { kind: "Gasto", icon: "💸", title: `${s.merchant ?? "Sin concepto"} · ${euros(s.cents)}`, detail: `Gasto · ${day(s.at)}`, at: s.at, go: { tab: "dinero" }, text: `${s.merchant ?? ""} ${s.note ?? ""}` };
  for (const s of v.income ?? []) yield { kind: "Ingreso", icon: "💶", title: `${s.concept ?? "Ingreso"} · ${euros(s.cents)}`, detail: `Ingreso · ${day(s.at)}`, at: s.at, go: { tab: "dinero" }, text: s.concept ?? "" };
  for (const r of v.reminders ?? []) yield { kind: "Recordatorio", icon: "🔔", title: r.text, detail: `Recordatorio · ${day(r.at)}${r.done ? " · hecho" : ""}`, at: r.at, go: { tab: "agenda" }, text: r.text };
  for (const p of v.people ?? []) yield { kind: "Persona", icon: "👤", title: p.name, detail: `Persona${p.notes ? ` · ${p.notes.slice(0, 60)}` : ""}`, at: p.lastContact ?? "", go: { sub: "personas" }, text: `${p.name} ${p.notes ?? ""}` };
  for (const p of v.projects ?? []) {
    yield { kind: "Proyecto", icon: p.emoji ?? "📁", title: p.name, detail: `Proyecto · ${(p.sources ?? []).length} fuentes`, at: p.createdAt ?? "", go: { project: p.id }, text: p.name };
    for (const src of p.sources ?? []) yield { kind: "Fuente", icon: "📄", title: src.title, detail: `En «${p.name}»`, at: src.at ?? "", go: { project: p.id }, text: `${src.title} ${src.text ?? ""} ${src.url ?? ""}` };
  }
  for (const m of v.meals ?? []) yield { kind: "Comida", icon: "🍽️", title: m.text, detail: `Comida · ${m.day ?? ""}`, at: m.day ?? "", go: { sub: "comidas" }, text: m.text };
  // WEB-59: what MANU read from screenshots Manu kept.
  for (const c of v.captures ?? []) if (c.text && c.status !== "pending") yield { kind: "Captura", icon: "🖼️", title: c.text.slice(0, 90), detail: `Captura · ${c.topic ?? ""} · ${day(c.at)}`, at: c.at ?? "", go: { sub: "capturas" }, text: `${c.topic ?? ""} ${c.text}` };
  for (const c of v.chat ?? []) if (c.text) yield { kind: "Chat", icon: c.from === "me" ? "🗨️" : "💬", title: c.text.slice(0, 90), detail: `Chat de hoy · ${c.from === "me" ? "tú" : "MANU"}`, at: c.at ?? "", go: { tab: "manu" }, text: c.text };
}

// All terms must appear (as the start of a word). Newest first.
export function findInVault(vault, query, { limit = 30 } = {}) {
  const ts = terms(query);
  if (!ts.length) return [];
  const out = [];
  for (const it of items(vault ?? {})) {
    const hay = ` ${normalise(`${it.title} ${it.text}`).replace(/[^a-z0-9ñ]+/g, " ")}`;
    if (ts.every((t) => hay.includes(` ${t}`))) { const { text, ...rest } = it; out.push(rest); }
  }
  return out.sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, limit);
}

// «busca lisboa», «encuentra el taller», «¿dónde apunté lo del alquiler?».
// «busca en mi archivo …» is the archive command and is not taken here.
export function findCommand(text) {
  const t = normalise(text).replace(/[¿?¡!.]+/g, " ").trim();
  if (/en (mi|el) archivo|chatgpt/.test(t)) return null;
  // WEB-55: the web is the AI's job, and «¿dónde está la farmacia?» is not about Manu's notes.
  if (/\b(en internet|en google|en la web|online|vuelos?|hoteles?)\b/.test(t)) return null;
  const m = t.match(/^(?:busca(?:me)?|buscar|encuentra(?:me)?|donde (?:apunte|guarde|puse|tengo|deje)(?: lo de| lo del| lo| el| la)?)\s+(.+)$/);
  return m && terms(m[1]).length ? m[1].replace(/^(lo de|lo del|el|la|los|las) /, "") : null;
}
