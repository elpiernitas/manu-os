// Google Calendar through the user's own OAuth consent (Google Identity
// Services token model). No server: the access token lives only in memory.
// The OAuth Client ID is public by design and is pasted by Manu in Ajustes.
export const GCAL_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export function isClientId(id) {
  return /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(String(id ?? "").trim());
}

export function eventsUrl(from, to) {
  const p = new URLSearchParams({ timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "250" });
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

// Paginated: follows nextPageToken (max 10 pages) so a busy month is complete.
export async function listEvents(token, from, to, fetchImpl = fetch) {
  const items = [];
  let pageToken = null;
  for (let page = 0; page < 10; page++) {
    const url = eventsUrl(from, to) + (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");
    const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) throw Object.assign(new Error("Sesión de Google caducada"), { code: "auth" });
    if (!res.ok) throw new Error(`Google Calendar respondió ${res.status}`);
    const json = await res.json();
    items.push(...(json.items ?? []));
    pageToken = json.nextPageToken;
    if (!pageToken) break;
  }
  return groupByDay({ items });
}

// Month grid (weeks starting on Monday) for the calendar view.
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - lead);
  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    days.push({ day: localDay(d), date: d.getDate(), inMonth: d.getMonth() === month });
  }
  // Drop a trailing week that belongs entirely to the next month.
  return days.slice(35).every((d) => !d.inMonth) ? days.slice(0, 35) : days;
}

export async function createEvent(token, body, fetchImpl = fetch) {
  const res = await fetchImpl(API, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (res.status === 401) throw Object.assign(new Error("Sesión de Google caducada"), { code: "auth" });
  if (!res.ok) throw new Error(`Google Calendar respondió ${res.status}`);
  return res.json();
}
