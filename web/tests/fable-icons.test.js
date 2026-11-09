import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FABLE_ICONS, FABLE_ICON_NAMES, fableIcon, fableMark } from "../design/fable-icons.js";

const ROOT = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");

test("Fable supplies all 31 source icons and an extra Bahía glyph for existing MANU", () => {
  assert.equal(FABLE_ICON_NAMES.length, 32);
  for (const name of ["hoy", "agenda", "manu", "dinero", "tu", "memoria", "proyectos", "nube", "amanecer", "seguridad", "bahia"]) {
    assert.ok(Object.hasOwn(FABLE_ICONS, name), name);
    assert.match(fableIcon(name), /^<svg/);
  }
});

test("Fable SVGs are static decorative markup, accessible button labels remain text", () => {
  for (const name of FABLE_ICON_NAMES) {
    const icon = fableIcon(name);
    assert.match(icon, /aria-hidden="true"/);
    assert.match(icon, /stroke="currentColor"/);
    assert.doesNotMatch(icon, /<script|onerror=|onload=|javascript:/i);
  }
  assert.match(fableMark(), /viewBox="0 0 64 64"/);
  assert.throws(() => fableIcon("anything-not-here"), RangeError);
  assert.match(fableIcon("hoy", Infinity), /width="24"/);
});

test("new design assets are referenced in the PWA and service worker cache", () => {
  const html = read("index.html");
  const sw = read("sw.js");
  const js = read("app.js");
  for (const asset of ["design/fable-icons.js", "design/fable-tokens.css", "design/fable-mark.svg"]) {
    assert.ok(sw.includes('"' + asset + '"'), asset + " missing from offline cache");
  }
  assert.match(html, /href="design\/fable-tokens\.css"/);
  assert.match(html, /href="design\/fable-mark\.svg"/);
  assert.match(js, /import \{ fableIcon, fableMark \}/);
  assert.match(js, /data-fable="true"/);
  // Crucial: all six real destinations are preserved, including Bahía and Proyectos.
  assert.match(js, /const TABS = \[\["bahia", "Bahía"\], \["hoy", "Hoy"\], \["manu", "MANU"\], \["dinero", "Dinero"\], \["proyectos", "Proyectos"\], \["tu", "Tú"\]\]/);
});
