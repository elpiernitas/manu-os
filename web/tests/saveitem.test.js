// «Guardar en MANU» y la búsqueda en lo guardado. Datos ficticios.
import test from "node:test";
import assert from "node:assert/strict";
import { propose, detectInput, searchSaved } from "../core/saveitem.js";
import { newItem } from "../core/library.js";

test("un enlace con palabras propone título, tipo y tema sin abrir la página", () => {
  const p = propose({ text: "https://www.ejemplo.test/recetas/pan-de-masa-madre-casero" });
  assert.equal(detectInput({ text: "https://x.test/a" }), "link");
  assert.equal(p.kind, "articulo");
  assert.equal(p.title, "Pan de masa madre casero");
  assert.equal(p.topic, "Cocina");
  assert.equal(p.needsReview, false);
  assert.match(p.why.join(" "), /no he abierto la página/);
  assert.equal(p.note, "", "nunca inventa un resumen");
});

test("un enlace que no dice nada: título provisional y pide revisarlo", () => {
  const yt = propose({ text: "https://www.youtube.com/watch?v=abcDEF12345" });
  assert.equal(yt.kind, "video");
  assert.equal(yt.needsReview, true);
  assert.equal(yt.title, "Enlace de youtube.com");
  const tk = propose({ text: "https://www.tiktok.com/@usuario/video/7300000000000000000" });
  assert.equal(tk.needsReview, true, "un @usuario no es un título");
  const conTexto = propose({ text: "Truco para dormir mejor https://www.youtube.com/watch?v=abcDEF12345" });
  assert.equal(conTexto.title, "Truco para dormir mejor"); assert.equal(conTexto.needsReview, false);
  assert.equal(conTexto.topic, "Salud");
});

test("texto: corto es idea, largo es nota tal cual; archivos por tipo y nombre", () => {
  assert.equal(propose({ text: "Probar la ruta del Cares en primavera" }).kind, "idea");
  const larga = "Lista para la mudanza:\n- cajas\n- avisar al banco\n- cambiar dirección";
  const n = propose({ text: larga });
  assert.equal(n.kind, "nota"); assert.equal(n.note, larga.replace(/\s+/g, " "));
  const pdf = propose({ file: { name: "contrato-alquiler-2026.pdf", type: "application/pdf", size: 1000 } });
  assert.equal(pdf.kind, "documento"); assert.equal(pdf.title, "contrato alquiler 2026"); assert.equal(pdf.needsReview, false);
  const foto = propose({ file: { name: "IMG_4021.jpg", type: "image/jpeg", size: 1000 } });
  assert.equal(foto.kind, "imagen"); assert.equal(foto.needsReview, true, "IMG_4021 no dice de qué trata");
  assert.equal(propose({ text: "  " }), null);
});

test("propone el proyecto si se menciona", () => {
  const p = propose({ text: "Ideas de azulejos para la reforma https://x.test/azulejos-modernos" }, { projects: [{ id: "pr1", name: "Reforma baño" }] });
  assert.equal(p.project, "pr1");
  assert.equal(p.topic, "Casa");
});

test("búsqueda real en biblioteca, documentos, fuentes de proyectos e ideas, con su origen", () => {
  const v = {
    library: [{ ...newItem({ id: "l1", title: "Pan de masa madre", kind: "articulo", url: "https://x.test/pan" }), topic: "Cocina", tags: ["Cocina"] }, newItem({ id: "l2", title: "Curso de inglés", kind: "curso", notes: "Repasar los phrasal verbs" })],
    docs: [{ id: "d1", title: "Seguro del coche", company: "Aseguradora Prueba", at: "2026-10-01" }],
    projects: [{ id: "p1", name: "Reforma", sources: [{ id: "s1", kind: "note", title: "Presupuesto fontanero", text: "El fontanero cobra por horas", at: "2026-11-01" }] }],
    inbox: [{ id: "i1", status: "IDEA", text: "Hacer pan los domingos", at: "2026-11-02" }],
  };
  assert.deepEqual(searchSaved(v, "pan").map((r) => r.id).sort(), ["i1", "l1"]);
  assert.equal(searchSaved(v, "cocina")[0].id, "l1", "busca también por tema");
  assert.equal(searchSaved(v, "phrasal")[0].id, "l2", "y dentro de las notas");
  const f = searchSaved(v, "fontanero horas");
  assert.equal(f.length, 1); assert.equal(f[0].kind, "Proyecto «Reforma»"); assert.deepEqual(f[0].go, { project: "p1" });
  assert.match(f[0].snippet, /fontanero cobra/);
  assert.equal(searchSaved(v, "aseguradora")[0].go.sub, "documentos");
  assert.deepEqual(searchSaved(v, "inexistente"), []);
  assert.deepEqual(searchSaved(v, ""), []);
});

test("seguridad: solo se abren dentro del navegador los tipos inertes; lo activo se descarga", async () => {
  const { safeViewType } = await import("../core/saveitem.js");
  for (const ok of ["image/png", "image/jpeg", "application/pdf", "text/plain", "video/mp4", "audio/mpeg"]) assert.equal(safeViewType(ok), true, ok);
  for (const bad of ["text/html", "image/svg+xml", "application/xhtml+xml", "text/xml", "application/javascript", "text/javascript", "", null, "application/octet-stream", "image/png;x=svg"]) assert.equal(safeViewType(bad), false, String(bad));
});
