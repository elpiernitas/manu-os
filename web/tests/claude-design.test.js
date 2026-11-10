import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { skinOf, SKINS } from "../core/horizonte.js";
import { hzApariencia } from "../design/horizonte.js";
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

test("Original Claude Design is default, old choices remain accessible", () => {
  assert.equal(skinOf(undefined), "design");
  assert.equal(skinOf({}), "design");
  assert.equal(skinOf({ skin: "design" }), "design");
  assert.equal(skinOf({ skin: "clasico" }), "clasico");
  assert.equal(skinOf({ skin: "horizonte" }), "horizonte");
  assert.deepEqual(Object.keys(SKINS), ["design", "clasico", "horizonte"]);
});

test("Appearance exposes 3 real themes with explicit controls, no fake data", () => {
  const html = hzApariencia("design");
  for (const x of ["design", "clasico", "horizonte"]) assert.match(html, new RegExp('data-v="' + x + '"'));
  assert.match(html, /Claude Design · original/);
  assert.match(html, /aria-pressed="true"/);
  assert.doesNotMatch(html, /DEMO|datos inventados/i);
});

test("Theme follows the original design system tokens", () => {
  const css = read("design/claude-design.css");
  for (const hex of ["#050608", "#111318", "#F7F8FA", "#949AA6", "#246BFD", "#4D8DFF"]) assert.ok(css.includes(hex), hex);
  assert.match(css, /html\[data-skin="design"\]/);
  assert.match(css, /\.tabbar/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /quick-action FAB slot/);
});

test("PWA loads and precaches design skin without removing existing bank modules", () => {
  const html = read("index.html");
  const sw = read("sw.js");
  const app = read("app.js");
  assert.match(html, /design\/claude-design\.css/);
  assert.match(sw, /"design\/claude-design\.css"/);
  assert.match(sw, /core\/enablebanking\.js/);
  assert.match(sw, /design\/horizonte\.css/);
  assert.match(sw, /const VERSION = "manuos-v109"/);
  assert.match(app, /APP_VERSION = "109"/);
  assert.match(app, /const skin = \(\) => skinOf\(vault\.settings\)/);
  assert.match(app, /bankAisImport/);
});
