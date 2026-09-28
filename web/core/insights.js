// Money insights computed on the device: fixed charges and when Manu spends.
import { merchantKey } from "./money.js";

const DAY = 86400000;

// Charges that repeat roughly every month (25–35 days) with a stable amount
// (±15 %). Subscriptions and services need 2 occurrences; the rest 3.
export function detectRecurring(entries, { now = new Date() } = {}) {
  const groups = new Map();
  for (const e of entries) {
    const key = merchantKey(e.merchant);
    if (!key || !e.cents) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  const out = [];
  for (const [key, list] of groups) {
    const sorted = [...list].sort((a, b) => (a.at < b.at ? -1 : 1));
    const fixedKind = sorted.some((e) => ["SUBSCRIPTIONS", "SERVICES", "HOME", "FINANCE"].includes(e.category));
    if (sorted.length < (fixedKind ? 2 : 3)) continue;
    const times = sorted.map((e) => new Date(e.at).getTime());
    const gaps = times.slice(1).map((t, i) => (t - times[i]) / DAY);
    if (!gaps.every((g) => g >= 25 && g <= 35)) continue;
    const amounts = sorted.map((e) => e.cents);
    const low = Math.min(...amounts), high = Math.max(...amounts);
    if ((high - low) / low > 0.15) continue;
    const last = sorted[sorted.length - 1];
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const next = new Date(times[times.length - 1] + avgGap * DAY);
    out.push({ key, merchant: last.merchant, category: last.category, cents: last.cents, occurrences: sorted.length, dayOfMonth: new Date(last.at).getDate(), lastPaid: last.at, nextExpected: next.toISOString(), overdue: next < new Date(now.getTime() - 5 * DAY) });
  }
  return out.sort((a, b) => a.dayOfMonth - b.dayOfMonth);
}

export function upcomingRecurring(recurring, now = new Date(), days = 7) {
  return recurring.filter((r) => { const t = new Date(r.nextExpected).getTime(); return t >= now.getTime() - DAY && t - now.getTime() <= days * DAY; });
}

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

// When the money goes: by weekday, by part of the month and (only for entries
// with a real time, not bank lines) by moment of the day.
export function spendingPattern(entries) {
  const byWeekday = WEEKDAYS.map((label) => ({ label, cents: 0 }));
  const byMonthPart = [{ label: "Días 1–10", cents: 0 }, { label: "Días 11–20", cents: 0 }, { label: "Días 21–31", cents: 0 }];
  const byMoment = [{ label: "Mañana", cents: 0 }, { label: "Tarde", cents: 0 }, { label: "Noche", cents: 0 }];
  let timed = 0;
  for (const e of entries) {
    const d = new Date(e.at);
    if (Number.isNaN(d.getTime())) continue;
    byWeekday[(d.getDay() + 6) % 7].cents += e.cents;
    byMonthPart[d.getDate() <= 10 ? 0 : d.getDate() <= 20 ? 1 : 2].cents += e.cents;
    if (e.source !== "BANK") {
      const h = d.getHours();
      byMoment[h >= 6 && h < 14 ? 0 : h >= 14 && h < 21 ? 1 : 2].cents += e.cents;
      timed++;
    }
  }
  const top = [...byWeekday].sort((a, b) => b.cents - a.cents)[0];
  return { byWeekday, byMonthPart, byMoment: timed ? byMoment : null, topWeekday: top.cents ? top.label : null };
}
