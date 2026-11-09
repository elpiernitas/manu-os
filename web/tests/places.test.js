// «Dónde gastas»: sitios y ciudades desde el concepto del banco. Conceptos inventados.
import test from "node:test";
import assert from "node:assert/strict";
import { cityOf, wherePlaces } from "../core/places.js";
import { spendingPattern } from "../core/insights.js";

test("city from the trailing «-CIUDAD[/OTRO]» of a bank concept, with accents", () => {
  assert.equal(cityOf("COMPRA TARJ. 5402XXXXXXXX1234 CAFETERIA INVENTADA-GIJON/XIXON"), "Gijón");
  assert.equal(cityOf("COMPRA TARJ. 5402XXXX TIENDA INVENTADA-OVIEDO"), "Oviedo");
  assert.equal(cityOf("COMPRA TARJ. 5402XXXX SUPER INVENTADO-POLA DE SIERO"), "Pola De Siero");
  assert.equal(cityOf("COMPRA TARJ. 5402XXXX EMPRESA INVENTADA-SL"), null, "a company suffix is not a city");
  assert.equal(cityOf("ENVIO BIZUM A PERSONA INVENTADA"), null);
  assert.equal(cityOf("café con Ana - gijón"), null, "only bank concepts (upper case)");
  assert.equal(cityOf("RECIBO 12345-0001"), null);
});

test("shops and cities by money, without Bizum, transfers or cash", () => {
  const now = new Date("2026-11-09T12:00:00Z");
  const s = [
    { cents: 1250, at: "2026-11-08T12:00:00Z", merchant: "COMPRA TARJ. 5402XXXX CAFETERIA INVENTADA-GIJON/XIXON", category: "FOOD_AND_DRINK" },
    { cents: 1250, at: "2026-11-01T12:00:00Z", merchant: "COMPRA TARJ. 5402XXXX CAFETERIA INVENTADA-GIJON/XIXON", category: "FOOD_AND_DRINK" },
    { cents: 9000, at: "2026-10-20T12:00:00Z", merchant: "COMPRA TARJ. 5402XXXX SUPER INVENTADO-OVIEDO", category: "GROCERIES" },
    { cents: 5000, at: "2026-11-02T12:00:00Z", merchant: "ENVIO BIZUM A PERSONA INVENTADA", category: "TRANSFERS" },
    { cents: 2000, at: "2026-11-03T12:00:00Z", merchant: "REINTEGRO CAJERO", category: "CASH" },
    { cents: 700, at: "2026-01-01T12:00:00Z", merchant: "COMPRA TARJ. 5402XXXX VIEJO-GIJON", category: "OTHER" },
  ];
  const p = wherePlaces(s, { now });
  assert.deepEqual(p.shops.map((x) => [x.name, x.cents, x.count, x.city]), [["Super Inventado", 9000, 1, "Oviedo"], ["Cafeteria Inventada", 2500, 2, "Gijón"]]);
  assert.deepEqual(p.cities.map((c) => [c.city, c.cents]), [["Oviedo", 9000], ["Gijón", 2500]]);
  assert.equal(p.total, 11500, "outside 90 days, Bizum and cash do not count");
  assert.ok(!JSON.stringify(p).includes("PERSONA"), "no Bizum counterpart names");
});

test("movements from the bank (no time) never count as «mañana/tarde/noche»", () => {
  const p = spendingPattern([{ cents: 100, at: "2026-11-08T12:00:00Z", source: "SABADELL" }, { cents: 200, at: "2026-11-08T12:00:00Z", source: "BANK" }]);
  assert.equal(p.byMoment, null);
});
