// Modo bajón (WEB-70). When Manu has been low, MANU goes gentle by itself:
// fewer demands (no stale projects, no money pace, no budget alarms), one
// thing that helps, and an open door to talk. It never diagnoses; with
// several bad days in a row it suggests talking to someone he trusts.
// Pure: moods come from the vault, the clock from the caller. Mood data
// never leaves the device unless Manu shares it (ADR-0013).
const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const LOW = 2; // MOODS: 1 Mal, 2 Regular, 3 Bien, 4 Muy bien

export function lowDays(moods, now = new Date(), days = 7) {
  const keys = new Set(Array.from({ length: days }, (_, i) => dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i))));
  return (moods ?? []).filter((m) => keys.has(m.day) && m.value <= LOW).length;
}

/**
 * @returns {{ on: boolean, level: "off"|"soft"|"heavy", low7: number, why: string }}
 *   soft:  today or yesterday was low, or 3+ low days this week
 *   heavy: 4+ low days this week (or «Mal» three days running)
 */
export function gentleMode(moods, now = new Date(), { pausedDay = null } = {}) {
  const today = dayKey(now);
  const y = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const recent = (moods ?? []).filter((m) => m.day === today || m.day === y).sort((a, b) => a.day.localeCompare(b.day));
  const last = recent.at(-1) ?? null;
  const low7 = lowDays(moods, now, 7);
  const bad3 = [0, 1, 2].every((i) => (moods ?? []).some((m) => m.day === dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)) && m.value === 1));
  const off = { on: false, level: "off", low7, why: "" };
  if (pausedDay === today) return off;
  // A good mood today ends it, whatever the week was.
  const todayMood = (moods ?? []).find((m) => m.day === today);
  if (todayMood && todayMood.value > LOW) return off;
  if (low7 >= 4 || bad3) return { on: true, level: "heavy", low7, why: `Llevas ${low7} días flojos esta semana.` };
  if ((last && last.value <= LOW) || low7 >= 3) return { on: true, level: "soft", low7, why: last && last.value <= LOW ? (last.day === today ? "Hoy no estás bien." : "Ayer no estabas bien.") : `Llevas ${low7} días flojos esta semana.` };
  return off;
}

// What the «Hoy vamos suave» card offers. `trusted`: people he marked or
// talks to most; the first one is offered by name.
export function gentlePlan(g, { trusted = [], lift = null } = {}) {
  if (!g.on) return null;
  const lines = [];
  if (lift) lines.push({ e: "🌿", t: lift });
  lines.push({ e: "🧘", t: "Hoy MANU no te mete prisa: nada de proyectos parados ni de cuentas. Solo lo que no puede esperar." });
  if (g.level === "heavy") lines.push({ e: "🤝", t: trusted[0] ? `Escribe a ${trusted[0].name}, aunque sea un «¿qué tal?». Hablarlo con alguien ayuda.` : "Cuéntaselo a alguien de confianza, aunque sea un mensaje. Hablarlo ayuda." });
  return { title: "💙 Hoy vamos suave", why: g.why, lines };
}

export const isGentleQuestion = (text) => /^(modo (bajon|suave)|vamos suave|hoy suave)$/.test(String(text ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[¿?¡!.,]+/g, "").trim());
