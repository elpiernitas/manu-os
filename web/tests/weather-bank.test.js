import { test } from "node:test";
import assert from "node:assert/strict";
import { describe as wmo, parseForecast, parseCities, advice, forecastUrl, fetchForecast } from "../core/weather.js";
import { parseCsv, amountToCents, parseDate, importStatement } from "../core/bank.js";

// Shape copied from a real Open-Meteo response (2026-09-28), values synthetic.
const sample = {
  current: { temperature_2m: 18.04, weather_code: 1 },
  daily: { time: ["2026-09-28", "2026-09-29"], weather_code: [3, 61], temperature_2m_max: [26.7, 24.2], temperature_2m_min: [13.8, 13.5], precipitation_probability_max: [53, 18] },
};

test("weather: codes, parsing and advice", () => {
  assert.equal(wmo(0).text, "Despejado");
  assert.equal(wmo(999).text, "Tiempo variable");
  const f = parseForecast(sample);
  assert.deepEqual(f.now, { temp: 18, text: "Poco nuboso", icon: "cloud-sun" });
  assert.equal(f.today.max, 27);
  assert.equal(f.tomorrow.text, "Lluvia");
  assert.equal(advice(f), "Hoy puede llover (53 %). Lleva paraguas.");
  assert.throws(() => parseForecast({}));
  assert.ok(forecastUrl({ latitude: 41.6, longitude: -4.7 }).startsWith("https://api.open-meteo.com/v1/forecast?latitude=41.6"));
  assert.deepEqual(parseCities({ results: [{ name: "Ciudad", admin1: "Región", country: "España", latitude: 1, longitude: 2 }, { name: "Mala" }] }), [{ name: "Ciudad", region: "Región, España", latitude: 1, longitude: 2 }]);
});

test("weather adapter reports HTTP errors", async () => {
  await assert.rejects(fetchForecast({ latitude: 1, longitude: 1 }, async () => ({ ok: false, status: 429 })), /429/);
  const f = await fetchForecast({ latitude: 1, longitude: 1 }, async () => ({ ok: true, json: async () => sample }));
  assert.equal(f.now.temp, 18);
});

test("csv: delimiters, quotes and BOM", () => {
  assert.deepEqual(parseCsv('﻿a;b\n"x;y";"di ""hola"""\n'), [["a", "b"], ["x;y", 'di "hola"']]);
  assert.deepEqual(parseCsv("a,b\r\n1,2"), [["a", "b"], ["1", "2"]]);
});

test("bank amounts and dates in Spanish formats", () => {
  assert.equal(amountToCents("-1.234,56"), -123456);
  assert.equal(amountToCents("-1234.56"), -123456);
  assert.equal(amountToCents("12,5 €"), 1250);
  assert.equal(amountToCents("abc"), null);
  assert.equal(parseDate("31/02/2026"), null);
  assert.ok(parseDate("28/09/26").startsWith("2026-09-2"));
  assert.ok(parseDate("2026-09-28"));
});

test("statement import: expenses only, dedup, categorised, rejects unknown files", () => {
  const csv = "Movimientos de la cuenta\nFecha;Concepto;Importe;Saldo\n28/09/2026;COMPRA MERCADONA;-34,50;1000\n28/09/2026;NOMINA;1500,00;2500\n27/09/2026;Pago Spotify;-11,99;988\n27/09/2026;Pago Spotify;-11,99;988\nbasura;;;\n";
  const r = importStatement(csv);
  assert.equal(r.entries.length, 2);
  assert.equal(r.skippedIncome, 1);
  assert.equal(r.duplicates, 1);
  assert.equal(r.skippedInvalid, 1);
  const merc = r.entries.find((e) => e.merchant === "COMPRA MERCADONA");
  assert.equal(merc.cents, 3450);
  assert.equal(merc.category, "GROCERIES");
  assert.equal(merc.source, "BANK");
  const again = importStatement(csv, new Set(r.entries.map((e) => e.id)));
  assert.equal(again.entries.length, 0);
  assert.ok(importStatement("hola,adios\n1,2").error);
});
