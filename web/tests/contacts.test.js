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

test("WEB-62: saving a birthday in Google Contacts reads the etag, then patches only birthdays", async () => {
  const { setContactBirthday } = await import("../core/google.js");
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    const json = calls.length === 1 ? { resourceName: "people/c123", etag: "E1", birthdays: [{ date: { year: 2005, month: 10, day: 11 } }] } : { resourceName: "people/c123" };
    return { ok: true, status: 200, json: async () => json };
  };
  await setContactBirthday("tok", "people/c123", "10-11", fetchImpl);
  assert.match(calls[0].url, /people\/c123\?personFields=birthdays$/);
  assert.match(calls[1].url, /people\/c123:updateContact\?updatePersonFields=birthdays$/);
  assert.equal(calls[1].init.method, "PATCH");
  assert.deepEqual(JSON.parse(calls[1].init.body), { etag: "E1", birthdays: [{ date: { month: 10, day: 11, year: 2005 } }] }); // same day: year kept
  assert.equal(calls[1].init.headers.Authorization, "Bearer tok");
  calls.length = 0;
  await setContactBirthday("tok", "people/c123", "12-05", fetchImpl);
  assert.deepEqual(JSON.parse(calls[1].init.body).birthdays, [{ date: { month: 12, day: 5 } }]);
  await assert.rejects(setContactBirthday("tok", "../../x", "12-05", fetchImpl), /Contacto no válido/);
  await assert.rejects(setContactBirthday("tok", "people/c1", "5 dic", fetchImpl), /Cumpleaños no válido/);
});
