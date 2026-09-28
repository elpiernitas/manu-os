import { test } from "node:test";
import assert from "node:assert/strict";
import { parse, reply, CRISIS_REPLY, amountCents, merchant } from "../core/assistant.js";
import { categorise, toCents, euros, newEntry, correctCategory, summary } from "../core/money.js";
import { modeState } from "../core/modes.js";
import { capture, confirm, markUnclassified, pending, tasks, toggleDone } from "../core/inbox.js";
import { initialRefuge, refugeReply } from "../core/refuge.js";
import { LocalStore, emptyVault, validateVault } from "../core/storage.js";

test("crisis phrases always win and give 112 and 024", () => {
  for (const text of ["No quiero vivir", "estoy de bajón y no quiero vivir", "pensé en SUICIDARME", "gasté 5 en algo y quiero acabar con todo"]) {
    assert.equal(parse(text).kind, "crisis", text);
  }
  assert.ok(CRISIS_REPLY.includes("112") && CRISIS_REPLY.includes("024"));
  assert.equal(reply({ kind: "crisis" }, 1), CRISIS_REPLY);
});

test("expenses parse amount in cents and merchant", () => {
  assert.deepEqual(parse("gasté 12,50 en Café"), { kind: "expense", cents: 1250, merchant: "Café" });
  assert.deepEqual(parse("He pagado 3.2€ en el bus."), { kind: "expense", cents: 320, merchant: "el bus" });
  assert.deepEqual(parse("pagué 40 euros"), { kind: "expense", cents: 4000, merchant: null });
  assert.equal(parse("gasté mucho").kind, "unknown");
  assert.equal(amountCents("gaste 0"), null);
  assert.equal(merchant("gaste 3 en ."), null);
});

test("ideas keep Manu's original wording", () => {
  assert.deepEqual(parse("Apunta: Llamar al Taller"), { kind: "idea", text: "Llamar al Taller" });
  assert.deepEqual(parse("idea: app de recetas"), { kind: "idea", text: "app de recetas" });
  assert.equal(parse("apunta").kind, "unknown");
});

test("other intents", () => {
  assert.equal(parse("estoy de bajón").kind, "lowMood");
  assert.deepEqual(parse("¿qué tengo mañana?"), { kind: "agenda", day: "tomorrow" });
  assert.deepEqual(parse("que tengo hoy"), { kind: "agenda", day: "today" });
  assert.equal(parse("¿va a llover?").kind, "weather");
  assert.equal(parse("").kind, "unknown");
  assert.equal(reply({ kind: "expense", cents: 1250, merchant: "cafe" }), "Anotado: 12,50 € en cafe. Lo dejo pendiente de que confirmes la categoría.");
});

test("money: cents, euros and categories", () => {
  assert.equal(toCents("12,5"), 1250);
  assert.equal(toCents("0,01"), 1);
  assert.equal(toCents("0"), null);
  assert.equal(toCents("1,234"), null);
  assert.equal(euros(123456), "1.234,56 €");
  assert.equal(euros(5), "0,05 €");
  assert.equal(categorise("Mercadona Centro"), "GROCERIES");
  assert.equal(categorise("cafetería"), "OTHER", "whole words only");
  assert.equal(categorise(null), "OTHER");
  const e = newEntry({ id: "1", cents: 999, merchant: "spotify", at: "2026-09-01T10:00:00Z" });
  assert.equal(e.category, "SUBSCRIPTIONS");
  assert.equal(e.inferred, true);
  const fixed = correctCategory(e, "LEISURE");
  assert.equal(fixed.inferred, false);
  assert.throws(() => correctCategory(e, "NOPE"));
  const s = summary([e, { ...e, id: "2", at: "2026-10-01T00:00:00Z" }], "2026-09-01T00:00:00Z", "2026-10-01T00:00:00Z");
  assert.deepEqual(s, { total: 999, byCategory: { SUBSCRIPTIONS: 999 } });
});

test("modes follow Manu's default schedule", () => {
  const at = (iso) => modeState(new Date(iso));
  // Local-time constructor strings (no Z): read in the machine's zone.
  assert.equal(at("2026-09-28T23:00:00").mode, "NIGHT"); // Monday
  assert.equal(at("2026-09-28T06:59:00").mode, "NIGHT");
  assert.equal(at("2026-09-28T08:00:00").mode, "MORNING");
  const work = at("2026-09-28T10:00:00");
  assert.equal(work.mode, "WORK");
  assert.equal(work.showsWorkContent, true);
  assert.equal(at("2026-09-28T13:00:00").mode, "AFTERNOON");
  assert.equal(at("2026-09-27T11:00:00").mode, "WEEKEND"); // Sunday
  const forced = modeState(new Date("2026-09-28T10:00:00"), undefined, { mode: "AFTERNOON", until: "2026-09-28T11:00:00" });
  assert.equal(forced.showsWorkContent, false);
});

test("inbox never classifies by itself", () => {
  const c = capture({ id: "c1", text: "x", at: "t" });
  assert.equal(c.status, "PENDING");
  assert.deepEqual(pending([c]).map((i) => i.id), ["c1"]);
  const t = confirm(c, "TASK");
  assert.equal(tasks([t]).length, 1);
  assert.equal(tasks([toggleDone(t)]).length, 0);
  assert.equal(confirm(t, "IDEA").status, "TASK", "confirmed items are not re-classified");
  assert.equal(markUnclassified(c).status, "UNCLASSIFIED");
  assert.throws(() => confirm(c, "PROJECT"));
});

test("refuge: asks, follows, crisis wins and stays in human help", () => {
  let s = initialRefuge();
  let r = refugeReply(s, "no sé");
  assert.equal(r.state.phase, "CHOOSING");
  r = refugeReply(r.state, "quiero desconectar");
  assert.equal(r.state.phase, "CHANGE_OF_AIR");
  const other = refugeReply(r.state, "otra");
  assert.notEqual(r.reply, other.reply);
  const crisis = refugeReply(other.state, "no quiero vivir");
  assert.equal(crisis.state.phase, "HUMAN_HELP");
  assert.ok(refugeReply(crisis.state, "vale").reply.includes("112"));
  for (const text of [r.reply, other.reply]) assert.ok(!/depresi|trastorno/i.test(text));
});

function memory() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), map: m };
}

test("storage round-trips and survives reopening", () => {
  const backend = memory();
  const store = new LocalStore(backend);
  const vault = emptyVault();
  vault.spending.push(newEntry({ id: "s1", cents: 100, merchant: "bar", at: "t" }));
  assert.ok(store.save(vault));
  const reopened = new LocalStore(backend).load();
  assert.equal(reopened.warning, null);
  assert.deepEqual(reopened.vault, vault);
});

test("damaged data is set aside, never silently overwritten", () => {
  const backend = memory();
  backend.setItem("manuos.vault", "{not json");
  const res = new LocalStore(backend).load();
  assert.ok(res.warning);
  assert.equal(backend.getItem("manuos.vault.damaged"), "{not json");
});

test("backups with duplicate ids or bad amounts are rejected", () => {
  const dup = { ...emptyVault(), inbox: [{ id: "a" }], spending: [{ id: "a", cents: 1 }] };
  assert.equal(validateVault(dup).ok, false);
  const bad = { ...emptyVault(), spending: [{ id: "a", cents: 1.5 }] };
  assert.equal(validateVault(bad).ok, false);
  assert.equal(validateVault({ schema: 99, inbox: [], spending: [], chat: [] }).ok, false);
  assert.equal(validateVault(null).ok, false);
});
