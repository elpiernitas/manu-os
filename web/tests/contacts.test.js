import test from "node:test";
import assert from "node:assert/strict";
import { searchContacts } from "../core/contacts.js";

const contacts = [
  { googleId: "people/1", name: "Eva Martínez", birthday: "10-11", phone: "+34600000001" },
  { googleId: "people/2", name: "Eva Demo", birthday: null, phone: null },
  { googleId: "people/3", name: "María Eva López", birthday: null, phone: null },
  { googleId: "people/4", name: "Evaristo Ejemplo", birthday: null, phone: null },
  { googleId: "people/5", name: "Nieves Prueba", birthday: null, phone: null },
];

test("WEB-61: «eva» shows every Eva (any word), names starting with it first, A–Z", () => {
  const r = searchContacts(contacts, "eva");
  assert.deepEqual(r.map((c) => c.name), ["Eva Demo", "Eva Martínez", "Evaristo Ejemplo", "María Eva López"]);
  assert.ok(!r.some((c) => c.name.startsWith("Nieves"))); // «nieves» contains «eve», not a word start
});

test("WEB-61: more words narrow it; accents and case ignored; already added is marked", () => {
  assert.deepEqual(searchContacts(contacts, "EVA mart").map((c) => c.name), ["Eva Martínez"]);
  assert.deepEqual(searchContacts(contacts, "maria").map((c) => c.name), ["María Eva López"]);
  const r = searchContacts(contacts, "eva", [{ id: "x", name: "Eva Martínez", googleId: "people/1" }]);
  assert.equal(r.find((c) => c.googleId === "people/1").added, true);
  assert.equal(r.find((c) => c.googleId === "people/2").added, false);
  assert.deepEqual(searchContacts(contacts, "  "), []);
  assert.equal(searchContacts(contacts, "e", [], 2).length, 2);
});
