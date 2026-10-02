// Input arriving from outside the app (iOS Shortcuts, a pasted text, a link).
// Everything here is untrusted: bounded, trimmed and rendered escaped.
export const LIMITS = { text: 500, events: 50, title: 120 };

const clip = (s, n) => String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, n);

// "09:30 Dentista", "9:30-10:15 Reunión", "todo el día Cumpleaños".
export function parseEvents(text) {
  const events = [];
  for (const raw of String(text ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (events.length >= LIMITS.events) break;
    const timed = line.match(/^(\d{1,2})[:.](\d{2})(?:\s*[-–]\s*(\d{1,2})[:.](\d{2}))?\s+(.+)$/);
    if (timed) {
      const [, h, m, h2, m2, title] = timed;
      if (Number(h) > 23 || Number(m) > 59 || (h2 && (Number(h2) > 23 || Number(m2) > 59))) continue;
      const pad = (x) => x.padStart(2, "0");
      events.push({ time: `${pad(h)}:${m}`, end: h2 ? `${pad(h2)}:${m2}` : null, title: clip(title, LIMITS.title) });
      continue;
    }
    const allDay = line.match(/^todo el d[ií]a\s+(.+)$/i);
    if (allDay) events.push({ time: null, end: null, title: clip(allDay[1], LIMITS.title) });
  }
  return events.filter((e) => e.title).sort((a, b) => (a.time ?? "") < (b.time ?? "") ? -1 : 1);
}

// Reads di=…, eventos=… and manana=1 from the URL. QA ChatGPT 2026-10 (#4):
// Shortcuts now use the fragment (#di=…), which never reaches the server; the
// old query form (?di=…) still works for Shortcuts already created.
export function launchParams(search) {
  const params = new URLSearchParams(String(search ?? "").replace(/^[?#]/, ""));
  const say = clip(params.get("di"), LIMITS.text) || null;
  const rawEvents = params.get("eventos");
  // WEB-72: «?manana=1» from the morning Shortcut (alarm stopped).
  return { say, events: rawEvents === null ? null : parseEvents(rawEvents), morning: params.get("manana") === "1" };
}

export function localDay(date = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

// Next event that has not started yet today (all-day events are not "next").
export function nextEvent(agenda, now = new Date()) {
  if (!agenda || agenda.day !== localDay(now)) return null;
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return agenda.events.find((e) => e.time && e.time >= hhmm) ?? null;
}
