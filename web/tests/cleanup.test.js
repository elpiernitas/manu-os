// Limpieza digital (WEB-122). Datos inventados.
import test from "node:test";
import assert from "node:assert/strict";
import { cleanupReport, referencedImages, CANNOT } from "../core/cleanup.js";

const now = new Date(2026, 10, 20, 12);
test("encuentra duplicados, capturas viejas, bandeja olvidada, títulos flojos, vencidos y fotos huérfanas", () => {
  const v = {
    library: [{ id: "a", title: "Pan casero", url: "https://ejemplo.com/pan" }, { id: "b", title: "Otra cosa", url: "https://www.ejemplo.com/pan/" }, { id: "c", title: "Enlace de ejemplo.com", needsReview: true }],
    captures: [{ id: "k1", status: "pending", at: "2026-09-01T10:00:00Z", imageId: "img1" }, { id: "k2", status: "pending", at: "2026-11-19T10:00:00Z" }],
    inbox: [{ id: "i1", status: "PENDING", text: "algo", at: "2026-10-01T10:00:00Z" }, { id: "i2", status: "IDEA", text: "x", at: "2026-01-01T10:00:00Z" }],
    docs: [{ id: "d1", title: "Seguro viejo", expires: "2026-09-01" }, { id: "d2", title: "Vigente", expires: "2027-01-01" }],
    moments: [{ id: "m", imageId: "img2" }],
  };
  const r = cleanupReport(v, now, { imageIds: ["img1", "img2", "img3"] });
  assert.deepEqual(r.map((x) => x.key), ["dup-lib", "old-caps", "old-inbox", "weak-lib", "old-docs", "orphans"]);
  assert.equal(r[0].items[0].keep, "a");
  assert.deepEqual(r.find((x) => x.key === "orphans").items.map((x) => x.id), ["img3"], "solo lo que nada usa");
  assert.equal(r.find((x) => x.key === "orphans").risky, true);
  assert.ok(r.filter((x) => x.key !== "orphans").every((x) => !x.risky), "lo demás es reversible");
  assert.deepEqual(cleanupReport({}, now), [], "sin datos, sin propuestas");
  assert.equal(cleanupReport(v, now).some((x) => x.key === "orphans"), false, "sin poder leer las fotos no se propone borrarlas");
});
test("referencias de imagen en cualquier sitio y límites dichos claro", () => {
  assert.deepEqual([...referencedImages({ projects: [{ sources: [{ imageId: "p1" }] }], library: [{ fileId: "f1" }] })].sort(), ["f1", "p1"]);
  assert.ok(CANNOT.some(([t]) => /Apps/.test(t)));
});
