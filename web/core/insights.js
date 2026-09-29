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

const monthKey = (iso) => iso.slice(0, 7);
const inMonth = (list, key) => list.filter((e) => monthKey(e.at) === key);
const sum = (list) => list.reduce((a, e) => a + e.cents, 0);

// Payroll: keyword lines, plus any payer that pays ≥ 600 € in 2+ different
// months (a salary without «nómina» in the concept). Inferred, never confirmed.
export function markPayroll(income) {
  const byPayer = new Map();
  for (const e of income) {
    if (e.kind !== "OTHER" && e.kind !== "TRANSFER") continue;
    const k = merchantKey(e.concept);
    if (!k || e.cents < 60000) continue;
    if (!byPayer.has(k)) byPayer.set(k, new Set());
    byPayer.get(k).add(monthKey(e.at));
  }
  const payroll = new Set([...byPayer].filter(([, months]) => months.size >= 2).map(([k]) => k));
  return income.map((e) => (e.kind === "PAYROLL" || (payroll.has(merchantKey(e.concept)) && e.cents >= 60000) ? { ...e, payroll: true } : e));
}

// Everything the Dinero statistics need for one month («YYYY-MM»).
export function monthStats(spending, income, key, now = new Date()) {
  const prevDate = new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 2, 1);
  const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
  const sp = inMonth(spending, key), inc = markPayroll(inMonth(income, key));
  const spent = sum(sp), earned = sum(inc);
  const prevSpent = sum(inMonth(spending, prevKey)), prevEarned = sum(inMonth(income, prevKey));
  const payroll = inc.filter((e) => e.payroll).sort((a, b) => (a.at < b.at ? -1 : 1));
  const y = Number(key.slice(0, 4)), m = Number(key.slice(5, 7)) - 1;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const current = now.getFullYear() === y && now.getMonth() === m;
  const daysElapsed = current ? now.getDate() : daysInMonth;
  const merchants = new Map();
  for (const e of sp) {
    const k = merchantKey(e.merchant) ?? "sin concepto";
    const cur = merchants.get(k) ?? { name: e.merchant ?? "Sin concepto", cents: 0, count: 0 };
    cur.cents += e.cents; cur.count++;
    merchants.set(k, cur);
  }
  const pct = (a, b) => (b > 0 ? Math.round(((a - b) / b) * 100) : null);
  return {
    key, spent, earned, saved: earned - spent,
    savingRate: earned > 0 ? Math.round(((earned - spent) / earned) * 100) : null,
    payroll: { cents: sum(payroll), days: payroll.map((e) => Number(e.at.slice(8, 10))) },
    incomeByKind: ["PAYROLL", "BIZUM", "TRANSFER", "REFUND", "OTHER"].map((k) => [k, sum(inc.filter((e) => (k === "PAYROLL" ? e.payroll : !e.payroll && e.kind === k)))]).filter(([, c]) => c > 0),
    prevSpent, prevEarned, spentDelta: pct(spent, prevSpent), earnedDelta: pct(earned, prevEarned),
    avgDaily: daysElapsed ? Math.round(spent / daysElapsed) : 0,
    projection: current && daysElapsed ? Math.round((spent / daysElapsed) * daysInMonth) : null,
    count: sp.length,
    biggest: sp.reduce((b, e) => (!b || e.cents > b.cents ? e : b), null),
    topMerchants: [...merchants.values()].sort((a, b) => b.cents - a.cents).slice(0, 5),
    income: inc.sort((a, b) => (a.at < b.at ? 1 : -1)),
  };
}

// Last n months, oldest first, for the income vs spending chart.
export function monthlySeries(spending, income, n = 6, now = new Date()) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { key, label: d.toLocaleDateString("es-ES", { month: "short" }).replace(".", ""), spent: sum(inMonth(spending, key)), earned: sum(inMonth(income, key)) };
  });
}
