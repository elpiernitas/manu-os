// Google Calendar through the user's own OAuth consent (Google Identity
// Services token model). No server: the access token lives only in memory.
// The OAuth Client ID is public by design and is pasted by Manu in Ajustes.
export const GCAL_SCOPE = "https://www.googleapis.com/auth/calendar.events";
// Read-only list of Manu's calendars (names and colours), to show all of them.
export const CALENDAR_LIST_SCOPE = "https://www.googleapis.com/auth/calendar.calendarlist.readonly";
const BASE = "https://www.googleapis.com/calendar/v3";
const API = `${BASE}/calendars/primary/events`;
const eventsApi = (calendarId) => `${BASE}/calendars/${encodeURIComponent(calendarId)}/events`;
export const safeColor = (c) => (/^#[0-9a-f]{6}$/i.test(String(c ?? "")) ? c : null);

export function isClientId(id) {
  return /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(String(id ?? "").trim());
}

export function eventsUrl(from, to, calendarId = "primary") {
  const p = new URLSearchParams({ timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "250" });
  return `${eventsApi(calendarId)}?${p}`;
}

const hhmm = (iso) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const localDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const parseDay = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };

// Google events -> Map(day -> [{ id, time, end, title, location, allDay, first, last, color, calendar }]).
// Multi-day events appear on every day they cover (max 62), marked first/last
// so the month view can draw them as a continuous bar.
export function groupByDay(json, meta = {}) {
  const byDay = new Map();
  const push = (day, item) => { if (!byDay.has(day)) byDay.set(day, []); byDay.get(day).push(item); };
  for (const ev of json?.items ?? []) {
    if (ev.status === "cancelled") continue;
    const base = {
      id: String(ev.id ?? `${ev.summary}-${ev.start?.dateTime ?? ev.start?.date}`),
      title: String(ev.summary ?? "(Sin título)").slice(0, 120),
      location: ev.location ? String(ev.location).slice(0, 120) : null,
      color: safeColor(meta.color),
      calendar: meta.calendar ? String(meta.calendar).slice(0, 60) : null,
    };
    let firstDay, lastDay, time = null, end = null, allDay = false;
    if (ev.start?.dateTime) {
      const s0 = new Date(ev.start.dateTime);
      const e0 = ev.end?.dateTime ? new Date(ev.end.dateTime) : s0;
      firstDay = new Date(s0.getFullYear(), s0.getMonth(), s0.getDate());
      // An event ending exactly at 00:00 does not occupy that day.
      const eAdj = new Date(e0.getTime() - 1);
      lastDay = e0 > s0 ? new Date(eAdj.getFullYear(), eAdj.getMonth(), eAdj.getDate()) : firstDay;
      time = hhmm(ev.start.dateTime);
      end = ev.end?.dateTime ? hhmm(ev.end.dateTime) : null;
    } else if (ev.start?.date) {
      allDay = true;
      firstDay = parseDay(ev.start.date);
      lastDay = ev.end?.date ? addDays(parseDay(ev.end.date), -1) : firstDay; // end.date is exclusive
      if (lastDay < firstDay) lastDay = firstDay;
    } else continue;
    let i = 0;
    for (let d = firstDay; d <= lastDay && i < 62; d = addDays(d, 1), i++) {
      const first = i === 0, last = d.getTime() === lastDay.getTime();
      push(localDay(d), { ...base, time: first ? time : null, end: last ? end : null, allDay: allDay || !first, first, last, multi: firstDay.getTime() !== lastDay.getTime() });
    }
  }
  for (const list of byDay.values()) list.sort((a, b) => (Number(b.multi) - Number(a.multi)) || (Number(b.allDay) - Number(a.allDay)) || ((a.time ?? "") < (b.time ?? "") ? -1 : 1));
  return byDay;
}

export function mergeDays(maps) {
  const out = new Map();
  for (const m of maps) for (const [day, list] of m) out.set(day, [...(out.get(day) ?? []), ...list]);
  for (const list of out.values()) list.sort((a, b) => (Number(b.multi) - Number(a.multi)) || (Number(b.allDay) - Number(a.allDay)) || ((a.time ?? "") < (b.time ?? "") ? -1 : 1));
  return out;
}

// Calendars Manu has visible in Google Calendar, with their colours.
export async function listCalendars(token, fetchImpl = fetch) {
  const res = await fetchImpl(`${BASE}/users/me/calendarList?minAccessRole=reader&maxResults=100`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) throw Object.assign(new Error("Sesión de Google caducada"), { code: "auth" });
  if (!res.ok) throw new Error(`Google Calendar respondió ${res.status}`);
  const json = await res.json();
  return (json.items ?? []).filter((c) => c.selected !== false && !c.hidden).slice(0, 25).map((c) => ({ id: String(c.id), name: String(c.summaryOverride ?? c.summary ?? "Calendario"), color: safeColor(c.backgroundColor), primary: Boolean(c.primary) }));
}

export function newEventBody({ title, start, minutes = 60 }) {
  const s = new Date(start);
  if (!title || Number.isNaN(s.getTime())) throw new Error("Evento no válido");
  const e = new Date(s.getTime() + minutes * 60000);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return { summary: String(title).slice(0, 200), start: { dateTime: s.toISOString(), timeZone: tz }, end: { dateTime: e.toISOString(), timeZone: tz } };
}

// A yearly all-day birthday (WEB-38). birthday: "MM-DD". Starts on the next
// occurrence; 29 February repeats only in leap years (Google's own rule).
export function birthdayEventBody({ name, birthday }, now = new Date()) {
  const m = /^(\d{2})-(\d{2})$/.exec(String(birthday ?? ""));
  if (!name || !m) throw new Error("Cumpleaños no válido");
  const month = Number(m[1]), day = Number(m[2]);
  let year = now.getFullYear();
  const todayKey = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (birthday < todayKey) year++;
  if (month === 2 && day === 29) while (!(year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0))) year++;
  const pad = (n) => String(n).padStart(2, "0");
  const start = `${year}-${pad(month)}-${pad(day)}`;
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const end = `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
  return { summary: `🎂 Cumpleaños de ${String(name).slice(0, 60)}`, start: { date: start }, end: { date: end }, recurrence: ["RRULE:FREQ=YEARLY"], transparency: "transparent" };
}

// Paginated: follows nextPageToken (max 10 pages) so a busy month is complete.
export async function listEvents(token, from, to, fetchImpl = fetch, { calendarId = "primary", color = null, calendar = null } = {}) {
  const items = [];
  let pageToken = null;
  for (let page = 0; page < 10; page++) {
    const url = eventsUrl(from, to, calendarId) + (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");
    const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) throw Object.assign(new Error("Sesión de Google caducada"), { code: "auth" });
    if (!res.ok) throw new Error(`Google Calendar respondió ${res.status}`);
    const json = await res.json();
    items.push(...(json.items ?? []));
    pageToken = json.nextPageToken;
    if (!pageToken) break;
  }
  return groupByDay({ items }, { color, calendar });
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
