// Fichaje (WEB-74). Manu clocks in at RK Iglesias and taps the same buttons in
// MANU: «Entro», «Pausa» (café, fumar, un recado…), «Vuelvo a la oficina» and
// «Salida». MANU tells him how much of the day is left and when he can leave,
// keeps the record, and adds up the month: «RK te debe X h Y min» (whole
// workdays when it reaches one). Pure: events in, numbers out.
//
// vault.clock = [{ day: "YYYY-MM-DD", events: [{ id, t: "in"|"pause"|"back"|"out", at: ISO, why? }] }]
const MIN = 60000;
const pad = (n) => String(n).padStart(2, "0");
export const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const toMin = (hhmm) => { const [h, m] = String(hhmm).split(":").map(Number); return h * 60 + m; };

const toMinute = (d) => { const x = new Date(d); x.setSeconds(0, 0); return x; };

export const PAUSE_REASONS = ["Café", "Fumar", "Recado", "Otro"];

// Length of the workday, from his schedule (9:00–13:00 → 240 min).
export function workdayMinutes({ workStart = "09:00", workEnd = "13:00" } = {}) {
  const m = toMin(workEnd) - toMin(workStart);
  return Number.isFinite(m) && m > 0 ? m : 240;
}

// By real time, not by text: a copy with mixed offsets still sorts right.
const sorted = (events) => [...(events ?? [])].filter((e) => e && e.at && !Number.isNaN(Date.parse(e.at))).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

// The day must read like the buttons allow: Entro → (Pausa → Vuelvo)* → Salida, again.
export function validSequence(events) {
  let state = "off";
  for (const e of sorted(events)) {
    if (!nextActions(state).includes(e.t)) return false;
    state = { in: "working", back: "working", pause: "paused", out: "done" }[e.t];
  }
  return true;
}

// off → working ⇄ paused → done
export function clockState(events) {
  const last = sorted(events).at(-1);
  if (!last) return "off";
  return { in: "working", back: "working", pause: "paused", out: "done" }[last.t] ?? "off";
}

// Which buttons make sense now.
export function nextActions(state) {
  return { off: ["in"], working: ["pause", "out"], paused: ["back"], done: ["in"] }[state] ?? ["in"];
}

// Worked and paused time. An open stretch counts until `now`.
export function tally(events, now = new Date()) {
  let worked = 0, paused = 0, pauses = 0, start = null, pauseStart = null;
  const list = sorted(events);
  for (const e of list) {
    const t = Date.parse(e.at);
    if (e.t === "in" || e.t === "back") {
      if (pauseStart !== null) { paused += t - pauseStart; pauseStart = null; }
      if (start === null) start = t;
    } else if (e.t === "pause" || e.t === "out") {
      if (start !== null) { worked += t - start; start = null; }
      if (e.t === "pause") { pauseStart = t; pauses++; }
    }
  }
  const open = start !== null || pauseStart !== null;
  if (start !== null) worked += Math.max(0, now.getTime() - start);
  if (pauseStart !== null) paused += Math.max(0, now.getTime() - pauseStart);
  const first = list.find((e) => e.t === "in") ?? null;
  const lastOut = [...list].reverse().find((e) => e.t === "out") ?? null;
  return { workedMin: Math.floor(worked / MIN), pausedMin: Math.floor(paused / MIN), pauses, open, firstIn: first?.at ?? null, lastOut: lastOut?.at ?? null };
}

/**
 * Today at a glance: what is left and when he can leave.
 * @returns {{ state, workedMin, pausedMin, pauses, leftMin, extraMin, leaveAt: string|null }}
 */
export function today(events, { now = new Date(), targetMin = 240 } = {}) {
  now = toMinute(now);
  const state = clockState(events);
  const t = tally(events, now);
  const leftMin = Math.max(0, targetMin - t.workedMin);
  const extraMin = Math.max(0, t.workedMin - targetMin);
  // Only while working: if he paused, the exit time moves with the pause.
  const leaveAt = state === "working" ? hm(new Date(now.getTime() + leftMin * MIN)) : null;
  return { state, ...t, leftMin, extraMin, leaveAt };
}

// «1 h 05 min», «45 min», «2 h».
export function dur(min) {
  const m = Math.abs(Math.round(min));
  const h = Math.floor(m / 60), r = m % 60;
  if (!h) return `${r} min`;
  return r ? `${h} h ${pad(r)} min` : `${h} h`;
}

// Balance in workdays once it reaches one: 9 h 30 with 4 h days → «2 días y 1 h 30 min».
export function balanceText(min, targetMin = 240) {
  if (Math.abs(min) < 1) return "Estás en paz con RK: ni te debe ni le debes.";
  const abs = Math.abs(min);
  const days = Math.floor(abs / targetMin);
  const rest = abs - days * targetMin;
  const amount = days ? `${days} ${days === 1 ? "día" : "días"}${rest ? ` y ${dur(rest)}` : ""}` : dur(rest);
  return min > 0 ? `RK te debe ${amount}.` : `Le debes a RK ${amount}.`;
}

const WD = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/**
 * A month of records. Open days (no «Salida») are listed but not counted.
 * @param {Array} clock vault.clock
 * @param {string} month "YYYY-MM"
 */
export function monthReport(clock, month, { targetMin = 240, now = new Date() } = {}) {
  const days = (clock ?? []).filter((d) => d.day?.startsWith(`${month}-`)).sort((a, b) => a.day.localeCompare(b.day));
  const rows = days.map((d) => {
    const t = tally(d.events, now);
    const done = clockState(d.events) === "done";
    const [y, mo, da] = d.day.split("-").map(Number);
    return {
      day: d.day, weekday: WD[new Date(y, mo - 1, da).getDay()],
      in: t.firstIn ? hm(new Date(t.firstIn)) : "", out: done && t.lastOut ? hm(new Date(t.lastOut)) : "",
      pauses: t.pauses, pausedMin: t.pausedMin, workedMin: t.workedMin, targetMin,
      diffMin: done ? t.workedMin - targetMin : null, open: !done,
    };
  });
  const closed = rows.filter((r) => !r.open);
  const workedMin = closed.reduce((s, r) => s + r.workedMin, 0);
  const dueMin = closed.length * targetMin;
  const balanceMin = workedMin - dueMin;
  return { month, rows, days: closed.length, openDays: rows.length - closed.length, workedMin, dueMin, balanceMin, balance: balanceText(balanceMin, targetMin) };
}

// The sheet as rows (for SheetJS aoa_to_sheet or CSV).
export function reportRows(r) {
  const hours = (m) => (m === null ? "" : Math.round((m / 60) * 100) / 100);
  const head = [["Fichaje", r.month], [], ["Fecha", "Día", "Entrada", "Salida", "Pausas", "Tiempo en pausa", "Trabajado", "Jornada", "Diferencia", "Horas trabajadas", "Diferencia (horas)"]];
  const body = r.rows.map((x) => [x.day, x.weekday, x.in, x.out || "sin salida", x.pauses, dur(x.pausedMin), dur(x.workedMin), dur(x.targetMin), x.diffMin === null ? "abierto" : `${x.diffMin >= 0 ? "+" : "−"}${dur(x.diffMin)}`, hours(x.workedMin), hours(x.diffMin)]);
  const foot = [[], ["Días fichados", r.days], ["Total trabajado", dur(r.workedMin)], ["Jornada total", dur(r.dueMin)], ["Saldo", `${r.balanceMin >= 0 ? "+" : "−"}${dur(r.balanceMin)}`], [r.balance]];
  if (r.openDays) foot.push([`${r.openDays} ${r.openDays === 1 ? "día sin salida no cuenta" : "días sin salida no cuentan"}: corrígelos en MANU.`]);
  return [...head, ...body, ...foot];
}

const signed = (m) => (m === 0 ? "jornada justa" : `${m > 0 ? "+" : "−"}${dur(m)}`);

// WEB-79: the month as a note to copy and paste (one line per day).
export function monthNote(r, title = r.month) {
  const lines = r.rows.map((x) => {
    const d = `${x.weekday[0].toUpperCase()}${x.weekday.slice(1, 3)} ${Number(x.day.slice(8))}`;
    if (x.open) return `${d}: ${x.in || "—"} – sin salida`;
    const pauses = x.pauses ? ` (${x.pauses} ${x.pauses === 1 ? "pausa" : "pausas"}, ${dur(x.pausedMin)})` : "";
    return `${d}: ${x.in} – ${x.out} · ${dur(x.workedMin)}${pauses} · ${signed(x.diffMin)}`;
  });
  return [`Fichaje · ${title}`, "", ...lines, "", `Total: ${dur(r.workedMin)} de ${dur(r.dueMin)} (${r.days} ${r.days === 1 ? "día" : "días"})`, r.balance].join("\n");
}

// WEB-79: the month as a calendar (.ics): one event per day, from «Entro» to «Salida».
// Floating local times (no zone): the calendar shows them as they were punched.
export function monthIcs(clock, month, { targetMin = 240, now = new Date() } = {}) {
  const r = monthReport(clock, month, { targetMin, now });
  const stamp = (iso) => { const d = new Date(iso); return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`; };
  const esc = (t) => String(t).replace(/[\\;,]/g, (c) => `\\${c}`);
  const ev = [];
  for (const x of r.rows) {
    if (x.open) continue;
    const t = tally(clock.find((d) => d.day === x.day).events, now);
    ev.push("BEGIN:VEVENT", `UID:fichaje-${x.day}@manu-os`, `DTSTAMP:${stamp(now.toISOString())}`, `DTSTART:${stamp(t.firstIn)}`, `DTEND:${stamp(t.lastOut)}`,
      `SUMMARY:${esc(`Trabajo ${x.in}–${x.out} (${signed(x.diffMin)})`)}`,
      `DESCRIPTION:${esc(`Trabajado ${dur(x.workedMin)}${x.pauses ? ` · ${x.pauses} ${x.pauses === 1 ? "pausa" : "pausas"} (${dur(x.pausedMin)})` : ""}`)}`, "END:VEVENT");
  }
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MANU OS//Fichaje//ES", "CALSCALE:GREGORIAN", ...ev, "END:VCALENDAR"].join("\r\n") + "\r\n";
}

export function toCsv(rows) {
  const cell = (v) => { const s = String(v ?? ""); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n"); // BOM + «;» for Excel in Spanish
}

// WEB-75: the two nudges Manu asked for. At start + 1 min (9:01) «¿Fichaste
// ya?» if he has not clocked in; at start + workday (13:00) «Acuérdate de fichar
// al salir» if he is still in. Weekdays only, not on a day he said he is off,
// and each window closes after a while so a late opening does not nag him.
// `sent` = { day, in?, out? } remembers what was already shown today.
export function clockNudge(events, { now = new Date(), workStart = "09:00", targetMin = 240, off = false, sent = null } = {}) {
  if (off || (now.getDay() + 6) % 7 >= 5) return null;
  const key = dayKey(now);
  const done = sent?.day === key ? sent : {};
  const m = now.getHours() * 60 + now.getMinutes();
  const start = toMin(workStart);
  if (!Number.isFinite(start)) return null;
  const state = clockState(events);
  if (state === "off" && !done.in && m >= start + 1 && m < start + 60) {
    return { kind: "in", text: "¿Fichaste ya? Si ya estás dentro, pulsa «Entro» en MANU." };
  }
  const end = start + targetMin;
  if ((state === "working" || state === "paused") && !done.out && m >= end && m < end + 120) {
    const t = today(events, { now, targetMin });
    const when = state === "working" && t.leftMin ? ` Hoy puedes salir a las ${t.leaveAt}.` : "";
    return { kind: "out", text: `Acuérdate de fichar al salir.${when}` };
  }
  return null;
}

// Add an event to the day of `at`. Refuses impossible sequences (two «Entro»).
export function punch(clock, t, { at = new Date(), id, why = null } = {}) {
  at = toMinute(at); // fichajes go by the minute, like RK's own clock
  const key = dayKey(at);
  const list = [...(clock ?? [])];
  let rec = list.find((d) => d.day === key);
  const state = clockState(rec?.events ?? []);
  if (!nextActions(state).includes(t)) throw new Error({ in: "Ya estás dentro.", pause: "No estás trabajando ahora.", back: "No estás en pausa.", out: "No estás trabajando ahora." }[t] ?? "Acción no válida.");
  const ev = { id, t, at: at.toISOString(), ...(why ? { why: String(why).slice(0, 40) } : {}) };
  if (rec) rec = { ...rec, events: [...rec.events, ev] }; else rec = { day: key, events: [ev] };
  return [...list.filter((d) => d.day !== key), rec].sort((a, b) => a.day.localeCompare(b.day)).slice(-800);
}

// Correct an event's time (forgot to clock) or remove it. A change that leaves
// the day impossible (a pause with no return, «Salida» before «Entro») is
// refused, so the report never counts a closed day with a pause still open
// (QA ChatGPT 2026-10, #6).
export function editPunch(clock, day, id, { time = null, remove = false } = {}) {
  const next = (clock ?? []).map((d) => {
    if (d.day !== day) return d;
    let events = d.events;
    if (remove) events = events.filter((e) => e.id !== id);
    else if (time && /^\d{2}:\d{2}$/.test(time)) {
      events = events.map((e) => { if (e.id !== id) return e; const x = new Date(e.at); const [h, m] = time.split(":").map(Number); x.setHours(h, m, 0, 0); return { ...e, at: x.toISOString() }; });
    }
    return { ...d, events: sorted(events) };
  });
  const after = next.find((d) => d.day === day);
  if (after && !validSequence(after.events)) {
    throw new Error(remove ? "Si borro ese, el día no cuadra: borra también el que va con él (por ejemplo, la pausa y su vuelta)." : "Con esa hora el día no cuadra: los fichajes quedarían desordenados.");
  }
  return next.filter((d) => d.events.length);
}
