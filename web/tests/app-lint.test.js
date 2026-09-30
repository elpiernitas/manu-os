import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// WEB-69: app.js imports `confirm` from core/inbox.js (confirm an item as a
// task or idea), which shadows the browser's confirm(). A dialog must be
// window.confirm(...); a bare confirm("…") calls the wrong function.
test("WEB-69: dialogs use window.confirm, never the shadowed confirm", () => {
  const src = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const bad = src.split("\n").map((l, i) => [i + 1, l]).filter(([, l]) => /(^|[^.\w])confirm\(\s*["'`]/.test(l));
  assert.deepEqual(bad.map(([n]) => n), [], "use window.confirm(...) for dialogs");
});
