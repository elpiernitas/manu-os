// Google Calendar through the user's own OAuth consent (Google Identity
// Services token model). No server: the access token lives only in memory.
// The OAuth Client ID is public by design and is pasted by Manu in Ajustes.
export const GCAL_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export function isClientId(id) {
  return /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(String(id ?? "").trim());
}

export function eventsUrl(from, to) {
  const p = new URLSearchParams({ timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "50" });
  return `${API}?${p}`;
}

const hhmm = (iso) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const localDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Google events -> { day: "YYYY-MM-DD", events: [{ time, end, title, location }] }[]
export function groupByDay(json) {
  const byDay = new Map();
  for (const ev of json?.items ?? []) {
    if (ev.status === "cancelled") continue;
    const title = String(ev.summary ?? "(Sin título)").slice(0, 120);
    const location = ev.location ? String(ev.location).slice(0, 120) : null;
    let day, time = null, end = null;
    if (ev.start?.dateTime) {
      const start = new Date(ev.start.dateTime);
      day = localDay(start);
      time = hhmm(ev.start.dateTime);
      end = ev.end?.dateTime ? hhmm(ev.end.dateTime) : null;
    } else if (ev.start?.date) {
      day = ev.start.date;
    } else continue;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push({ time, end, title, location });
  }
  for (const list of byDay.values()) list.sort((a, b) => ((a.time ?? "") < (b.time ?? "") ? -1 : 1));
  return byDay;
}

export function newEventBody({ title, start, minutes = 60 }) {
  const s = new Date(start);
  if (!title || Number.isNaN(s.getTime())) throw new Error("Evento no válido");
  const e = new Date(s.getTime() + minutes * 60000);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return { summary: String(title).slice(0, 200), start: { dateTime: s.toISOString(), timeZone: tz }, end: { dateTime: e.toISOString(), timeZone: tz } };
}

export async function listEvents(token, from, to, fetchImpl = fetch) {
  const res = await fetchImpl(eventsUrl(from, to), { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) throw Object.assign(new Error("Sesión de Google caducada"), { code: "auth" });
  if (!res.ok) throw new Error(`Google Calendar respondió ${res.status}`);
  return groupByDay(await res.json());
}

export async function createEvent(token, body, fetchImpl = fetch) {
  const res = await fetchImpl(API, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (res.status === 401) throw Object.assign(new Error("Sesión de Google caducada"), { code: "auth" });
  if (!res.ok) throw new Error(`Google Calendar respondió ${res.status}`);
  return res.json();
}
