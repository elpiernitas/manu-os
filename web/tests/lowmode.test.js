import test from "node:test";
import assert from "node:assert/strict";
import { lowDays, gentleMode, gentlePlan, isGentleQuestion } from "../core/lowmode.js";
import { whatNow } from "../core/now.js";
import { briefing } from "../core/briefing.js";

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h);
const day = (d) => `2026-10-${String(d).padStart(2, "0")}`;
const now = at(2026, 10, 7);

test("WEB-70: off on good days; soft after a low day; heavy after a bad week", () => {
  assert.equal(gentleMode([{ day: day(7), value: 3 }], now).on, false);
  assert.equal(gentleMode([], now).on, false);
  const soft = gentleMode([{ day: day(6), value: 2 }], now);
  assert.deepEqual([soft.on, soft.level, soft.why], [true, "soft", "Ayer no estabas bien."]);
  const week = [1, 3, 4, 5].map((d) => ({ day: day(d), value: 2 }));
  assert.equal(lowDays(week, now), 4);
  assert.equal(gentleMode(week, now).level, "heavy");
  assert.equal(gentleMode([5, 6, 7].map((d) => ({ day: day(d), value: 1 })), now).level, "heavy");
  // a good mood today ends it, whatever the week was
  assert.equal(gentleMode([...week, { day: day(7), value: 4 }], now).on, false);
  // «Hoy estoy bien, quítalo»
  assert.equal(gentleMode(week, now, { pausedDay: day(7) }).on, false);
  assert.equal(lowDays([{ day: "2026-09-29", value: 1 }], now), 0); // older than a week
});

test("WEB-70: the plan offers someone he trusts only on heavy days", () => {
  const p = gentlePlan({ on: true, level: "heavy", why: "x" }, { trusted: [{ name: "Persona Demo" }] });
  assert.match(p.lines.map((l) => l.t).join(" "), /Escribe a Persona Demo/);
  const s = gentlePlan({ on: true, level: "soft", why: "x" }, { trusted: [{ name: "Persona Demo" }] });
  assert.doesNotMatch(s.lines.map((l) => l.t).join(" "), /Persona Demo/);
  assert.equal(gentlePlan({ on: false }), null);
  for (const q of ["modo bajón", "Modo suave", "vamos suave"]) assert.ok(isGentleQuestion(q), q);
  assert.equal(isGentleQuestion("estoy de bajón"), false); // that one opens the Refugio
});

test("WEB-70: gentle «Ahora» drops stale projects and softens tasks; no money pressure", () => {
  const projects = [{ id: "p", name: "viejo", createdAt: "2026-01-01T10:00:00Z" }];
  const tasks = [{ text: "pagar Orange", at: "2026-09-01T10:00:00Z" }];
  const normal = whatNow({ now: at(2026, 10, 7, 18), mode: "AFTERNOON", projects, tasks });
  assert.match([normal.main, ...normal.more].map((x) => x.t).join(" "), /viejo/);
  const g = whatNow({ now: at(2026, 10, 7, 18), mode: "AFTERNOON", projects, tasks, gentle: true });
  assert.doesNotMatch([g.main, ...g.more].map((x) => x.t).join(" "), /viejo/);
  assert.equal(g.main.t, "Si te apetece, solo una: pagar Orange.");
  const spending = [{ cents: 5000, at: at(2026, 10, 3).toISOString() }];
  const b = briefing({ now: at(2026, 10, 7, 10), spending, budgetAlerts: ["Comer: 120 € de 100 €"], gentle: true });
  assert.doesNotMatch(b.lines.map((l) => l.t).join(" "), /Comer|Llevas/);
  const n = briefing({ now: at(2026, 10, 7, 10), spending, budgetAlerts: ["Comer: 120 € de 100 €"] });
  assert.match(n.lines.map((l) => l.t).join(" "), /Comer/);
});
