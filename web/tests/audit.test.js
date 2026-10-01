import test from "node:test";
import assert from "node:assert/strict";
import { safeHref } from "../core/links.js";
import { storageUse, STORAGE_BUDGET } from "../core/storage.js";

test("audit: links built from data only keep schemes MANU opens", () => {
  for (const ok of ["https://x.es/a?b=1", "http://x.es", "mailto:baja@x.es", "tel:+34600000000", "whatsapp://send?text=hola", "shortcuts://run-shortcut?name=MANU", "spotify:", "?manana=1", "./"]) assert.equal(safeHref(ok), ok, ok);
  for (const bad of ["javascript:alert(1)", " JaVaScRiPt:alert(1)", "data:text/html,<b>x</b>", "vbscript:x", "file:///etc/passwd", "//evil.example/x", "blob:https://x/1"]) assert.equal(safeHref(bad), "#", bad);
  assert.equal(safeHref(null), "#");
  assert.equal(safeHref(""), "#");
});

test("audit: storage use counts only MANU keys, in UTF-16 bytes", () => {
  const m = new Map([["manuos.vault", "x".repeat(1000)], ["other.app", "y".repeat(10 ** 6)]]);
  const fake = { get length() { return m.size; }, key: (i) => [...m.keys()][i], getItem: (k) => m.get(k) ?? null };
  const u = storageUse(fake);
  assert.equal(u.bytes, ("manuos.vault".length + 1000) * 2);
  assert.equal(u.level, "ok");
  m.set("manuos.vault", "x".repeat(Math.ceil(STORAGE_BUDGET * 0.9 / 2)));
  assert.equal(storageUse(fake).level, "full");
  m.set("manuos.vault", "x".repeat(Math.ceil(STORAGE_BUDGET * 0.65 / 2)));
  assert.equal(storageUse(fake).level, "warn");
  assert.equal(storageUse({ get length() { throw new Error("blocked"); } }), null);
});
