import test from "node:test";
import assert from "node:assert/strict";
import { contextModel, contextHtml, sideSubHtml, SIDE_SUB } from "../shell/context.js";

test("el panel separa lo que sabe, deduce, propone y le falta", () => {
  const html = contextHtml({ title: "Hoy", know: [{ text: "09:30 · Reunión", src: "Agenda pegada" }], infer: [{ text: "Día lleno", why: "5 cosas con hora" }], propose: [{ text: "Repasar", label: "Hacerlo", attrs: { "data-act": "x" } }], gaps: ["Sin Google"] });
  for (const t of ["Lo sé", "Lo deduzco", "Te propongo", "Me falta", "Agenda pegada", "5 cosas con hora", 'data-act="x"', "Sin Google"]) assert.ok(html.includes(t), t);
  assert.ok(html.indexOf("Lo sé") < html.indexOf("Lo deduzco"));
});

test("sin datos no se inventa nada y lo dice", () => {
  const html = contextHtml({ title: "Vacío" });
  assert.match(html, /No me lo invento/);
  assert.doesNotMatch(html, /Lo sé|Lo deduzco|Te propongo/);
});

test("lo que viene del vault se escapa: es dato, no HTML ni orden", () => {
  const evil = '<img src=x onerror=alert(1)>"';
  const html = contextHtml({ title: evil, know: [{ text: evil, src: evil }], propose: [{ text: evil, label: evil, attrs: { "data-k": evil } }] });
  assert.doesNotMatch(html, /<img/);
  assert.doesNotMatch(html, /data-k="<|"" /);
});

test("contextModel descarta entradas vacías o nulas", () => {
  const m = contextModel({ know: [null, { text: "" }, { text: "sí", src: "x" }], infer: [undefined], gaps: ["", null, "falta"] });
  assert.deepEqual(m.know, [{ text: "sí", src: "x" }]);
  assert.deepEqual(m.infer, []);
  assert.deepEqual(m.gaps, ["falta"]);
});

test("la barra lateral enlaza subpantallas existentes y marca la actual", () => {
  const html = sideSubHtml("tu", { sub: "momentos" });
  assert.equal((html.match(/data-act="side-go"/g) ?? []).length, SIDE_SUB.tu.length);
  assert.match(html, /data-to="momentos" aria-current="page"/);
  assert.equal(sideSubHtml("proyectos", { projects: [] }), "");
  const p = sideSubHtml("proyectos", { projects: [{ id: "a<b", name: "<b>X</b>" }], openProject: "a<b" });
  assert.match(p, /aria-current="page"/);
  assert.doesNotMatch(p, /<b>X/);
});
