// Hoy como centro de control (misión «asistente real»). Junta lo que viene de cada fuente y lo
// ordena en tres niveles con reglas fijas y explicables, nunca por intuición:
//   URGENT    · empieza o vence en las próximas 2 horas, ya ha vencido, o un documento vence en 3 días.
//   IMPORTANT · el resto de lo de hoy, el correo que parece pedirte algo, documentos que vencen en
//               30 días, cumpleaños hoy y movimientos de dinero pendientes de revisar.
//   INFO      · mañana, el dinero del mes (con su fiabilidad) y cumpleaños de la semana.
// Cada cosa dice de dónde sale (`source`), por qué está ahí (`why`) y adónde lleva (`go`).
// Puro: no lee el reloj ni la red por su cuenta.
const H = 3600000, DAY = 86400000;
const pad = (n) => String(n).padStart(2, "0");
const at = (now, hhmm) => { const [h, m] = String(hhmm).split(":").map(Number); const d = new Date(now); d.setHours(h, m, 0, 0); return d; };
const fmtH = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export const LEVELS = { URGENT: "Urgente", IMPORTANT: "Importante", INFO: "Para saber" };

/**
 * @param {object} d
 *  now, events (hoy, de la agenda), tomorrow (eventos de mañana), reminders, tasks (abiertas),
 *  mail (pendientes del triaje), docs (de expiringSoon), money (summary del mes), birthdays
 *  ([{name, days}]), euros (formateador)
 */
export function controlItems({ now = new Date(), events = [], tomorrow = [], reminders = [], tasks = [], mail = [], docs = [], money = null, birthdays = [], euros = (c) => `${(c / 100).toFixed(2)} €`, mailLabel = (k) => k } = {}) {
  const out = [];
  const t = now.getTime();
  for (const e of events ?? []) {
    if (!e.time) continue; // los de todo el día van como información de la agenda
    const start = at(now, e.time).getTime(), end = e.end ? at(now, e.end).getTime() : start;
    if (end < t) continue; // ya pasó
    const soon = start - t <= 2 * H;
    out.push({ level: soon ? "URGENT" : "IMPORTANT", icon: "📅", title: e.title, detail: `${start <= t ? `Ahora, hasta las ${e.end ?? "?"}` : `A las ${e.time}`}${e.location ? ` · ${e.location}` : ""}`, source: e.calendar ? `Google Calendar · ${e.calendar}` : "Agenda", why: soon ? (start <= t ? "Está pasando ahora" : "Empieza en menos de 2 horas") : "Es hoy", go: { tab: "agenda" }, sort: start });
  }
  for (const r of reminders ?? []) {
    if (r.done) continue;
    const when = Date.parse(r.at); if (!Number.isFinite(when)) continue;
    const d = new Date(when);
    const isToday = d.toDateString() === now.toDateString();
    if (when < t) out.push({ level: "URGENT", icon: "🔔", title: r.text, detail: `Vencido ${isToday ? `a las ${fmtH(d)}` : `el ${d.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`}`, source: "Recordatorios", why: "Ya ha pasado su hora y sigue sin hacer", go: { tab: "agenda" }, sort: when, id: r.id, kind: "reminder" });
    else if (isToday) out.push({ level: when - t <= 2 * H ? "URGENT" : "IMPORTANT", icon: "🔔", title: r.text, detail: `A las ${fmtH(d)}`, source: "Recordatorios", why: when - t <= 2 * H ? "Es en menos de 2 horas" : "Es hoy", go: { tab: "agenda" }, sort: when, id: r.id, kind: "reminder" });
  }
  for (const x of docs ?? []) {
    const left = x.left;
    if (left > 30) continue;
    out.push({ level: left <= 3 ? "URGENT" : "IMPORTANT", icon: "📄", title: x.doc.title, detail: left < 0 ? `Venció hace ${-left} día${left === -1 ? "" : "s"}` : left === 0 ? "Vence hoy" : `Vence en ${left} día${left === 1 ? "" : "s"}`, source: "Documentos", why: left <= 3 ? "Vence en 3 días o menos" : "Vence este mes", go: { sub: "documentos" }, sort: t + left * DAY });
  }
  for (const m of (mail ?? []).slice(0, 5)) out.push({ level: "IMPORTANT", icon: "✉️", title: m.subject || "(sin asunto)", detail: `${m.name} · ${mailLabel(m.kind)}`, source: "Gmail", why: `${m.why?.[0] ?? "Parece pedirte algo"} (suposición por remitente y asunto)`, go: { sub: "correo" }, sort: t + 3 * H });
  if ((mail ?? []).length > 5) out.push({ level: "IMPORTANT", icon: "✉️", title: `Y ${mail.length - 5} correos más que parecen pedirte algo`, detail: "En Correo", source: "Gmail", why: "Mismo criterio", go: { sub: "correo" }, sort: t + 3 * H + 1 });
  for (const b of birthdays ?? []) {
    if (b.days === 0) out.push({ level: "IMPORTANT", icon: "🎂", title: `Cumpleaños de ${b.name}`, detail: "Hoy", source: "Personas", why: "Es hoy", go: { sub: "personas" }, sort: t + 4 * H });
    else if (b.days <= 7) out.push({ level: "INFO", icon: "🎂", title: `Cumpleaños de ${b.name}`, detail: b.days === 1 ? "Mañana" : `En ${b.days} días`, source: "Personas", why: "Esta semana", go: { sub: "personas" }, sort: t + b.days * DAY });
  }
  if (money && money.pending?.count && !money.fiable) out.push({ level: "IMPORTANT", icon: "💶", title: `${money.pending.count} movimientos sin atribuir`, detail: `${euros(money.pending.cents)}: retiradas, Bizum o transferencias`, source: "Dinero", why: "Hasta revisarlos, tus cifras del mes son provisionales", go: { tab: "dinero" }, sort: t + 5 * H });
  if (money && money.bank?.count) out.push({ level: "INFO", icon: "💶", title: `Consumo del mes: ${euros(money.consumo)}`, detail: money.nivelLabel ?? "", source: "Dinero", why: money.fiable ? "Tu consumo personal, sin dinero de otros ni traspasos" : "Provisional: falta revisar movimientos", go: { tab: "dinero" }, sort: t + 30 * DAY });
  const tmw = (tomorrow ?? []).filter((e) => e.time).sort((a, b) => (a.time < b.time ? -1 : 1));
  if (tmw.length) out.push({ level: "INFO", icon: "🌅", title: `Mañana empiezas a las ${tmw[0].time}`, detail: `${tmw[0].title}${tmw.length > 1 ? ` y ${tmw.length - 1} más` : ""}`, source: "Agenda", why: "Para que lo tengas en cuenta esta noche", go: { tab: "agenda" }, sort: t + DAY });
  const order = { URGENT: 0, IMPORTANT: 1, INFO: 2 };
  return out.sort((a, b) => order[a.level] - order[b.level] || a.sort - b.sort);
}

/** «Actualizado a las…» de cada fuente, para decir de cuándo es cada dato. Sin inventar. */
export function freshness(sources, now = new Date()) {
  return sources.filter((s) => s.on).map((s) => {
    if (!s.at) return { name: s.name, text: "sin leer aún", stale: true };
    const d = new Date(s.at), age = now - d;
    const text = d.toDateString() === now.toDateString() ? `a las ${fmtH(d)}` : `el ${d.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`;
    return { name: s.name, text, stale: age > (s.maxAgeH ?? 6) * H };
  });
}
