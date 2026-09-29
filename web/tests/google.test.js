import { test } from "node:test";
import assert from "node:assert/strict";

test("WEB-38: every contact for autocomplete, with birthday and phone when present", async () => {
  const { contactsFrom } = await import("../core/google.js");
  const list = contactsFrom({ connections: [
    { resourceName: "people/2", names: [{ displayName: "Zoe Ejemplo" }] },
    { resourceName: "people/1", names: [{ displayName: "Ana Ejemplo" }], birthdays: [{ date: { month: 3, day: 7 } }], phoneNumbers: [{ value: "+34 600 00 00 00" }] },
    { resourceName: "people/3" }, // no name: skipped
  ] });
  assert.deepEqual(list.map((c) => c.name), ["Ana Ejemplo", "Zoe Ejemplo"]);
  assert.deepEqual(list[0], { googleId: "people/1", name: "Ana Ejemplo", birthday: "03-07", phone: "+34600000000" });
  assert.equal(list[1].birthday, null);
});
