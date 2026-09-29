import { test } from "node:test";
import assert from "node:assert/strict";
import { isGeminiKey, isSensitive } from "../core/ai.js";

// Keys below are invented, with the shape of each format.
const OLD = "AIzaSyTEST_0123456789abcdefghijklmnopq";
const NEW = "AQ.Ab8TESTxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_abcdef";

test("accepts the classic AIza keys and the newer AQ. keys from AI Studio", () => {
  assert.equal(isGeminiKey(OLD), true);
  assert.equal(isGeminiKey(NEW), true);
  assert.equal(isGeminiKey(`  ${NEW}\n`), true);
});

test("rejects what else can be copied from the key details (name, project)", () => {
  for (const s of ["Gemini API Key 2", "projects/404653169742", "404653169742", "AQ.", "hola", ""]) assert.equal(isGeminiKey(s), false, s);
});

test("a key pasted in the chat is never offered to Gemini", () => {
  assert.equal(isSensitive(`toma esto ${NEW}`), true);
  assert.equal(isSensitive(`toma ${OLD}`), true);
  assert.equal(isSensitive("qué tiempo hace mañana"), false);
});
