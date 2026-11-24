// Capturar una vez y relacionar (WEB-120, misión maestra · segundo cerebro).
//
// Tres cosas, todas puras, explicables y sin IA (ADR-0009):
//  1. Repeticiones: si Manu guarda otra vez la misma idea o el mismo enlace, no nace un registro
//     nuevo e inconexo; se apunta la fecha en el que ya existe (`repeats`). Nada se borra.
//  2. Fechas en lo que guarda: «el 3 de diciembre a las 17:30», «mañana a las 10», «el viernes»…
//     MANU PROPONE pasarlo a Agenda como recordatorio, con la fuente. Nunca lo crea solo.
//  3. Conexiones: propuestas que juntan piezas (una idea con fecha → Agenda; una idea repetida tres
//     veces sin proyecto → proyecto; un documento que vence → recordatorio). Cada propuesta dice
//     por qué y desde qué dato. Manu acepta o descarta; lo descartado no vuelve.
//
// Una fecha detectada es una INFERENCIA, no un hecho: se enseña como «parece que…» y Manu decide.
import { normalise } from "./text.js";

const STOP = new Set("para por con sin una uno unos unas que los las del al como mas muy pero este esta estos estas eso esa ese hay ser tengo tiene hacer algo cosa cosas idea nota sobre desde hasta cuando donde mucho poco todo toda todos todas tambien".split(" "));
const words = (s) => normalise(s).replace(/https?:\/\/\S+/g, " ").split(/[^a-z0-9ñ]+/).filter((w) => w.length >= 3 && !STOP.has(w)).map((w) => (w.length >= 6 ? w.slice(0, 5) : w.replace(/(es|s)$/, ""))); // raíz corta: «montar», «montarlo» → «monta»

/** Parecido entre dos textos (0–1): palabras con contenido compartidas sobre las del más corto. */
export function similarity(a, b) {
  const A = new Set(words(a)), Bs = new Set(words(b));
  if (!A.size || !Bs.size) return normalise(a).trim() === normalise(b).trim() && normalise(a).trim() ? 1 : 0;
  let shared = 0; for (const w of A) if (Bs.has(w)) shared++;
  const small = Math.min(A.size, Bs.size), big = Math.max(A.size, Bs.size);
  // Contención con un mínimo de palabras y sin que el largo sea el triple que el corto.
  if (shared < Math.min(2, small) || big > small * 3) return shared === small && small === big ? 1 : 0;
  return shared / small;
}

const sameUrl = (a, b) => { try { const u = (x) => { const p = new URL(x); return `${p.hostname.replace(/^www\./, "")}${p.pathname.replace(/\/+$/, "")}${p.search}`; }; return Boolean(a && b) && u(a) === u(b); } catch { return false; } };

/**
 * ¿Ya existe? `items` son { id, text, url? }. Devuelve { id, score, why } o null.
 * Umbral alto a propósito: mejor dos registros parecidos que juntar dos ideas distintas.
 */
export function findRepeat({ text = "", url = null } = {}, items = [], { min = 0.75 } = {}) {
  let best = null;
  for (const it of items ?? []) {
    if (url && it.url && sameUrl(url, it.url)) return { id: it.id, score: 1, why: "Mismo enlace" };
    const s = similarity(text, it.text ?? "");
    if (s >= min && (!best || s > best.score)) best = { id: it.id, score: s, why: s === 1 ? "Mismas palabras" : "Casi las mismas palabras" };
  }
  return best;
}

/** Apunta otra vez lo mismo en el registro que ya existe (sin perder ninguna fecha). */
export function addRepeat(item, at, extra = {}) {
  const repeats = [...(item.repeats ?? []), String(at)].slice(-50);
  return { ...item, repeats, ...(extra.note && !String(item.text ?? "").includes(extra.note) ? { notes: [...(item.notes ?? []), String(extra.note).slice(0, 400)].slice(-10) } : {}) };
}
export const timesSaved = (item) => 1 + (item?.repeats?.length ?? 0);

// ---------- Fechas en texto (español) ----------
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DAYS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const pad = (n) => String(n).padStart(2, "0");

/**
 * Busca UNA fecha (y hora si la hay) en un texto. `now` es la referencia local.
 * Devuelve { at: Date, allDay, label, matched } o null. Fechas pasadas → null (no proponemos el pasado).
 */
export function whenIn(text, now = new Date()) {
  const t = normalise(text);
  let day = null, matched = [], explicit = false;
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let m;
  if ((m = t.match(/\bpasado manana\b/))) { day = new Date(base); day.setDate(day.getDate() + 2); matched.push(m[0]); }
  else if ((m = t.match(/\bmanana\b/)) && !/\bpor la manana\b|\bde la manana\b|\besta manana\b/.test(t.slice(Math.max(0, m.index - 8), m.index + 8))) { day = new Date(base); day.setDate(day.getDate() + 1); matched.push(m[0]); }
  else if ((m = t.match(/\bhoy\b/))) { day = new Date(base); matched.push(m[0]); }
  if (!day && (m = t.match(/\b(\d{1,2}) de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?: de (\d{4}))?\b/))) {
    const mo = m[2] === "setiembre" ? 8 : MONTHS.indexOf(m[2]);
    let y = m[3] ? +m[3] : now.getFullYear();
    let d = new Date(y, mo, +m[1]);
    if (!m[3] && d < base) d = new Date(y + 1, mo, +m[1]);
    if (d.getMonth() === mo) { day = d; matched.push(m[0]); explicit = Boolean(m[3]) || d.getFullYear() === now.getFullYear(); }
  }
  if (!day && (m = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) {
    const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : now.getFullYear();
    let d = new Date(y, +m[2] - 1, +m[1]);
    if (!m[3] && d < base) d = new Date(y + 1, +m[2] - 1, +m[1]);
    if (+m[2] >= 1 && +m[2] <= 12 && d.getDate() === +m[1]) { day = d; matched.push(m[0]); explicit = Boolean(m[3]) || d.getFullYear() === now.getFullYear(); }
  }
  if (!day && (m = t.match(/\b(?:el |este |proximo |el proximo )?(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/))) {
    const want = DAYS.indexOf(m[1]);
    const d = new Date(base); let add = (want - d.getDay() + 7) % 7; if (add === 0) add = 7;
    d.setDate(d.getDate() + add); day = d; matched.push(m[0].trim());
  }
  if (!day) return null;
  let allDay = true;
  const tm = t.match(/\ba las (\d{1,2})(?:[:.h](\d{2}))?\s*(?:h\b)?(?:\s*(de la tarde|de la noche|de la manana|pm|am))?/) ?? t.match(/\b(\d{1,2})[:.](\d{2})\s*h?\b/) ?? t.match(/\b(\d{1,2})\s*h\b/);
  if (tm) {
    let h = +tm[1]; const mi = tm[2] ? +tm[2] : 0;
    const suf = tm[3] ?? "";
    if (/tarde|noche|pm/.test(suf) && h < 12) h += 12;
    if (h <= 23 && mi <= 59) { day = new Date(day); day.setHours(h, mi, 0, 0); allDay = false; matched.push(tm[0].trim()); }
  }
  if (allDay) day.setHours(9, 0, 0, 0);
  if (day < now && (allDay ? day.getTime() < base.getTime() : true)) return null;
  const label = `${DAYS[day.getDay()]} ${day.getDate()} de ${MONTHS[day.getMonth()]}${allDay ? "" : ` a las ${pad(day.getHours())}:${pad(day.getMinutes())}`}`.replace("miercoles", "miércoles").replace("sabado", "sábado");
  // Explícita: el texto dice el día del calendario (y el año, o es este año). Interpretada: «mañana», «el
  // viernes», o un día sin año que MANU ha llevado al año que viene. Las dos son propuestas; solo cambia la cautela.
  const certainty = explicit ? "explicita" : "interpretada";
  const shown = matched.join(" ").replace(/\bmanana\b/g, "mañana").replace(/\bmiercoles\b/g, "miércoles").replace(/\bsabado\b/g, "sábado");
  const how = explicit ? `escrito tal cual: «${shown}»` : /^\d/.test(matched[0] ?? "") ? `«${shown}» sin año: entiendo el de ${day.getFullYear()}` : `«${shown}» contado desde el ${now.getDate()}/${now.getMonth() + 1}`;
  return { at: day, allDay, label, matched: matched.join(" · "), certainty, how };
}

// ---------- Conexiones (propuestas) ----------
const DAY = 864e5;

/**
 * Propuestas que relacionan lo guardado. Solo lee; no cambia nada.
 * Cada una: { key, kind, title, why, source: { list, id }, ...datos para la acción }.
 * `dismissed` son claves que Manu ya descartó.
 */
export function conexiones(v, now = new Date(), { dismissed = [], max = 6 } = {}) {
  const out = [], seen = new Set(dismissed);
  const push = (p) => { if (!seen.has(p.key)) { seen.add(p.key); out.push(p); } };
  const ideas = (v?.inbox ?? []).filter((i) => i.status === "IDEA" && !i.done);
  const tasks = (v?.inbox ?? []).filter((i) => i.status === "TASK" && !i.done);
  const pending = (v?.inbox ?? []).filter((i) => i.status === "PENDING");
  const reminders = v?.reminders ?? [];
  const scheduled = new Set(reminders.map((r) => r.from?.id).filter(Boolean));
  // 1) Algo guardado con fecha → recordatorio en Agenda.
  for (const i of [...pending, ...ideas, ...tasks, ...(v?.library ?? []).map((l) => ({ ...l, text: `${l.title} ${l.notes ?? ""}`, list: "library" }))]) {
    if (scheduled.has(i.id) || i.scheduled) continue;
    const w = whenIn(i.text ?? "", now);
    if (!w || w.at.getTime() - now.getTime() > 120 * DAY) continue;
    const list = i.list ?? "inbox";
    push({ key: `agenda:${i.id}`, kind: "agenda", title: String(i.text ?? i.title).slice(0, 120), at: w.at.toISOString(), allDay: w.allDay, label: w.label,
      certainty: w.certainty,
      why: w.certainty === "explicita" ? `Fecha explícita (${w.how}). Aun así es una suposición mía que sea una cita: revísalo antes de guardarlo.` : `Fecha interpretada (${w.how}). Es una suposición: revisa el día antes de guardarlo.`, source: { list, id: i.id } });
  }
  // 2) Idea repetida (3 veces o más) que no está en ningún proyecto → proponer proyecto.
  for (const i of ideas) {
    if (timesSaved(i) < 3 || i.filed || i.project) continue;
    push({ key: `proyecto:${i.id}`, kind: "proyecto", title: String(i.text).slice(0, 60), why: `La has guardado ${timesSaved(i)} veces. ¿Le damos un proyecto para que no se pierda?`, source: { list: "inbox", id: i.id } });
  }
  // 2b) Idea suelta que comparte palabras con un proyecto que ya existe → proponer añadirla, diciendo cuáles.
  const projects = (v?.projects ?? []).map((p) => ({ p, w: new Set(words(`${p.name} ${p.why ?? ""} ${(p.sources ?? []).map((x) => x.title ?? "").join(" ")}`)) }));
  for (const i of ideas) {
    if (i.filed || i.project) continue;
    const iw = [...new Set(words(i.text ?? ""))];
    let best = null;
    for (const { p, w } of projects) { const common = iw.filter((x) => w.has(x)); if (common.length && (!best || common.length > best.common.length)) best = { p, common }; }
    if (!best) continue;
    const shown = normalise(i.text ?? "").split(/[^a-z0-9ñ]+/).filter((x) => best.common.includes(x.length >= 6 ? x.slice(0, 5) : x.replace(/(es|s)$/, ""))).slice(0, 3);
    push({ key: `al-proyecto:${i.id}:${best.p.id}`, kind: "al-proyecto", title: String(i.text).slice(0, 80), label: `${best.p.emoji ?? "📁"} ${best.p.name}`, projectId: best.p.id,
      why: `Comparte ${shown.length ? shown.map((x) => `«${x}»`).join(", ") : "palabras"} con el proyecto «${best.p.name}». Es una suposición: tú decides.`, source: { list: "inbox", id: i.id } });
  }
  // 3) Documento que vence en 45 días y sin recordatorio → recordatorio una semana antes (o mañana).
  for (const d of v?.docs ?? []) {
    if (!d.expires || scheduled.has(d.id)) continue;
    const exp = new Date(`${String(d.expires).slice(0, 10)}T09:00:00`);
    const left = (exp - now) / DAY;
    if (!(left > 0 && left <= 45)) continue;
    const when = new Date(Math.max(exp.getTime() - 7 * DAY, now.getTime() + DAY)); when.setHours(9, 0, 0, 0);
    push({ key: `doc:${d.id}`, kind: "agenda", title: `Revisar «${String(d.title).slice(0, 80)}» (vence el ${exp.getDate()}/${exp.getMonth() + 1})`, at: when.toISOString(), allDay: false,
      label: `${when.getDate()}/${when.getMonth() + 1} a las 09:00`, why: `El documento vence en ${Math.ceil(left)} días y no tiene aviso.`, source: { list: "docs", id: d.id } });
  }
  return out.slice(0, max);
}
