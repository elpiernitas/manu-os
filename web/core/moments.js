// Momentos (WEB-120, misión maestra · «documentar mi vida»): recuerdos de días normales, no solo
// de los grandes. Una foto elegida (opcional), una frase, con quién, dónde y cuándo si se sabe.
//
// - La foto vive solo en este dispositivo (IndexedDB) y en la copia completa cifrada. No sube a
//   Tu nube ni a ninguna IA. Los momentos tampoco suben a Tu nube (cloudprivacy.js).
// - Las personas son las de Personas (por id); MANU no las adivina.
// - No duplica la Agenda: se enseña lo que había ese día en la agenda, sin copiarlo.
export const MOMENT_LIMITS = { text: 500, place: 80, people: 12 };
const clip = (s, n) => String(s ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").replace(/[ \t]+/g, " ").trim().slice(0, n);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Crea un momento válido o lanza un error que dice qué falta. */
export function newMoment({ id, day, text, place = "", people = [], imageId = null }, now = new Date()) {
  const t = clip(text, MOMENT_LIMITS.text);
  if (!t && !imageId) throw new Error("Escribe una frase o elige una foto");
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const d = DAY_RE.test(String(day ?? "")) ? String(day) : today;
  if (d > today) throw new Error("Un momento es algo que ya ha pasado");
  return {
    id, day: d, text: t, ...(clip(place, MOMENT_LIMITS.place) ? { place: clip(place, MOMENT_LIMITS.place) } : {}),
    people: [...new Set((Array.isArray(people) ? people : []).map(String))].slice(0, MOMENT_LIMITS.people),
    ...(imageId ? { imageId: String(imageId) } : {}), createdAt: now.toISOString(), source: "manu",
  };
}

/** Por meses, lo más reciente primero: [{ key: "2026-11", label, items }]. */
export function byMonth(moments) {
  const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const groups = new Map();
  for (const m of [...(moments ?? [])].sort((a, b) => (b.day + b.createdAt).localeCompare(a.day + a.createdAt))) {
    const k = m.day.slice(0, 7);
    if (!groups.has(k)) groups.set(k, { key: k, label: `${MONTHS[+k.slice(5, 7) - 1]} de ${k.slice(0, 4)}`, items: [] });
    groups.get(k).items.push(m);
  }
  return [...groups.values()];
}

/** «Tal día como hoy»: momentos del mismo día y mes de años anteriores. */
export function onThisDay(moments, now = new Date()) {
  const md = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return (moments ?? []).filter((m) => m.day.slice(5) === md && +m.day.slice(0, 4) < now.getFullYear()).sort((a, b) => b.day.localeCompare(a.day));
}

/** Búsqueda local por texto, lugar o nombre de las personas. */
export function searchMoments(moments, q, people = []) {
  const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const ts = norm(q).split(/[^a-z0-9ñ]+/).filter((w) => w.length >= 2);
  if (!ts.length) return [];
  const name = new Map((people ?? []).map((p) => [p.id, p.name]));
  return (moments ?? []).filter((m) => { const h = ` ${norm(`${m.text} ${m.place ?? ""} ${m.day} ${(m.people ?? []).map((id) => name.get(id) ?? "").join(" ")}`).replace(/[^a-z0-9ñ]+/g, " ")}`; return ts.every((t) => h.includes(` ${t}`)); });
}
