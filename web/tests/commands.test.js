import test from "node:test";
import assert from "node:assert/strict";
import { parseCommand, describe, suggest, SCREENS } from "../core/commands.js";

test("WEB-78: fichaje in plain words", () => {
  assert.deepEqual(parseCommand("Entro"), { type: "punch", t: "in" });
  assert.deepEqual(parseCommand("/fichar entrada"), { type: "punch", t: "in" });
  assert.deepEqual(parseCommand("pausa café"), { type: "punch", t: "pause", why: "Café" });
  assert.deepEqual(parseCommand("salgo a fumar"), { type: "punch", t: "pause", why: "Fumar" });
  assert.deepEqual(parseCommand("pausa para el café"), { type: "punch", t: "pause", why: "Café" });
  assert.deepEqual(parseCommand("pausa"), { type: "punch", t: "pause", why: null });
  assert.deepEqual(parseCommand("voy a un recado"), { type: "punch", t: "pause", why: "Recado" });
  assert.deepEqual(parseCommand("vuelvo a la oficina"), { type: "punch", t: "back" });
  assert.deepEqual(parseCommand("salgo"), { type: "punch", t: "out" });
  assert.deepEqual(parseCommand("me voy!"), { type: "punch", t: "out" });
});

test("WEB-78: ánimo only with «ánimo»; «estoy mal» stays with MANU (Refugio)", () => {
  assert.deepEqual(parseCommand("ánimo bien"), { type: "mood", value: 3 });
  assert.deepEqual(parseCommand("animo muy bien"), { type: "mood", value: 4 });
  assert.deepEqual(parseCommand("ánimo 1"), { type: "mood", value: 1 });
  assert.deepEqual(parseCommand("estoy mal"), { type: "say", text: "estoy mal" });
  assert.deepEqual(parseCommand("ánimo fatal"), { type: "say", text: "ánimo fatal" });
});

test("WEB-78: short forms become phrases MANU understands", () => {
  assert.deepEqual(parseCommand("/gasto 12 café"), { type: "say", text: "gasté 12 en café" });
  assert.deepEqual(parseCommand("gasto 12,50€ en Mercadona"), { type: "say", text: "gasté 12,50 en Mercadona" });
  assert.deepEqual(parseCommand("/tarea llamar al banco"), { type: "say", text: "tarea: llamar al banco" });
  assert.deepEqual(parseCommand("idea app de recetas"), { type: "say", text: "idea: app de recetas" });
  assert.deepEqual(parseCommand("/recordar sacar la basura a las 21"), { type: "say", text: "recuérdame sacar la basura a las 21" });
  assert.deepEqual(parseCommand("hábito Leer"), { type: "habit", name: "Leer" });
  assert.equal(describe(parseCommand("/gasto 12 café")), "💶 Gasto de 12,00 € · café");
  assert.match(describe(parseCommand("/recordar sacar la basura a las 21")), /Recordatorio: sacar la basura a las 21:00/);
  assert.match(describe(parseCommand("qué tengo hoy")), /Preguntar a MANU/);
});

test("WEB-78: screens by name", () => {
  assert.deepEqual(parseCommand("fichaje"), { type: "go", target: "tu/fichaje", label: "Fichaje" });
  assert.deepEqual(parseCommand("Hábitos"), { type: "go", target: "tu/habitos", label: "Hábitos" });
  assert.deepEqual(parseCommand("tu nube"), { type: "go", target: "tu/nube", label: "Tu nube" });
  assert.deepEqual(parseCommand("excel"), { type: "go", target: "tu/fichaje", label: "Fichaje" });
  assert.equal(parseCommand("di").type, "say"); // too short to guess a screen
  assert.equal(parseCommand(""), null);
  assert.ok(SCREENS.every(([t]) => /^[a-z]+(\/[a-z]+)?$/.test(t)));
});

test("WEB-78: suggestions", () => {
  assert.ok(suggest("").length >= 5);
  assert.equal(suggest("")[0].label, "🟢 Entro");
  assert.deepEqual(suggest("", { clock: "working" }).slice(0, 3).map((x) => x.run), ["pausa café", "salgo a fumar", "salida"]);
  assert.equal(suggest("", { clock: "paused" })[0].run, "vuelvo");
  assert.ok(!suggest("", { clock: "done" }).some((x) => /entro|salida/.test(x.run ?? "")));
  const s = suggest("háb");
  assert.equal(s[0].label, "→ Hábitos"); // the name wins over «hablar» (MANU's keyword)
  assert.match(s[1].label, /Preguntar a MANU/);
  assert.equal(suggest("excel")[0].label, "→ Abrir Fichaje");
  assert.match(suggest("gasto 5 pan")[0].label, /Gasto de 5,00 €/);
  assert.equal(suggest("entro")[0].label, "🟢 Fichar la entrada");
});
