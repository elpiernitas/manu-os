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
  assert.equal(f.now.temp, 18);
  assert.equal(f.now.text, "Poco nuboso");
  assert.equal(f.today.max, 27);
  assert.equal(f.tomorrow.text, "Lluvia");
  assert.equal(advice(f), "Hoy puede llover (53 %). Lleva paraguas.");
  assert.throws(() => parseForecast({}));
  assert.ok(forecastUrl({ latitude: 41.6, longitude: -4.7 }).startsWith("https://api.open-meteo.com/v1/forecast?latitude=41.6"));
  assert.deepEqual(parseCities({ results: [{ name: "Ciudad", admin1: "Región", country: "España", latitude: 1, longitude: 2 }, { name: "Mala" }] }), [{ name: "Ciudad", region: "Región, España", latitude: 1, longitude: 2 }]);
});

test("weather: full forecast like the iPhone, no contradictory advice", () => {
  const full = {
    current: { temperature_2m: 20.3, apparent_temperature: 22.6, relative_humidity_2m: 89, wind_speed_10m: 4.9, weather_code: 2, is_day: 0 },
    hourly: { time: ["2026-09-28T23:00", "2026-09-29T00:00", "2026-09-29T09:00"], temperature_2m: [20.3, 20.3, 21], weather_code: [61, 0, 0], precipitation_probability: [0, 0, 3] },
    daily: { time: ["2026-09-28", "2026-09-29"], weather_code: [61, 3], temperature_2m_max: [21.8, 28.4], temperature_2m_min: [18.0, 19.6], precipitation_probability_max: [10, 70], sunrise: ["2026-09-28T08:16", "2026-09-29T08:17"], sunset: ["2026-09-28T20:09", "2026-09-29T20:07"], uv_index_max: [4.5, 4.0], wind_speed_10m_max: [11.2, 27.0] },
  };
  const f = parseForecast(full);
  assert.equal(f.now.icon, "cloud-moon");
  assert.equal(f.now.feels, 23);
  assert.equal(f.hours[0].time, "Ahora");
  assert.equal(f.hours[1].icon, "moon");
  assert.equal(f.hours[2].icon, "sun");
  assert.equal(f.days[1].weekday, "Mar");
  assert.equal(f.today.sunset, "20:09");
  assert.equal(advice(f), "Ahora poco nuboso. Hoy entre 18 y 22 °C.");
  assert.ok(!advice(f).startsWith("Lluvia"));
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
  const csv = "Movimientos de la cuenta\nFecha;Concepto;Importe\n28/09/2026;COMPRA MERCADONA;-34,50\n28/09/2026;NOMINA;1500,00\n27/09/2026;Pago Spotify;-11,99\nbasura;;\n";
  const r = importStatement(csv);
  assert.equal(r.entries.length, 2);
  assert.equal(r.skippedIncome, 1);
  assert.equal(r.duplicates, 0);
  assert.equal(r.skippedInvalid, 1);
  const merc = r.entries.find((e) => e.merchant === "COMPRA MERCADONA");
  assert.equal(merc.cents, 3450);
  assert.equal(merc.category, "GROCERIES");
  assert.equal(merc.source, "BANK");
  const again = importStatement(csv, new Set(r.entries.map((e) => e.id)));
  assert.equal(again.entries.length, 0);
  assert.ok(importStatement("hola,adios\n1,2").error);
});

test("two identical purchases on the same day are both kept; re-import stays idempotent", () => {
  const withBalance = "Fecha;Concepto;Importe;Saldo\n28/09/2026;COMPRA TARJ. CAFE;-1,50;100,00\n28/09/2026;COMPRA TARJ. CAFE;-1,50;98,50\n";
  const a = importStatement(withBalance);
  assert.equal(a.entries.length, 2);
  assert.equal(importStatement(withBalance, new Set(a.entries.map((e) => e.id))).entries.length, 0);
  const noBalance = "Fecha;Concepto;Importe\n28/09/2026;CAFE;-1,50\n28/09/2026;CAFE;-1,50\n";
  const b = importStatement(noBalance);
  assert.equal(b.entries.length, 2);
  assert.equal(importStatement(noBalance, new Set(b.entries.map((e) => e.id))).entries.length, 0);
});

test("bank concepts: whole-word keywords and new categories", async () => {
  const { categorise } = await import("../core/money.js");
  assert.equal(categorise("PAGO BIZUM A PERSONA"), "TRANSFERS");
  assert.equal(categorise("REINTEGRO CAJERO"), "CASH");
  assert.equal(categorise("COMPRA TARJ. ALIMERKA GIJON"), "GROCERIES");
  assert.equal(categorise("COMPRA TARJ. SIDRERIA EJEMPLO"), "FOOD_AND_DRINK");
  assert.equal(categorise("COMPRA TARJ. AMAZON EU"), "SHOPPING");
  assert.equal(categorise("TELEFONOS ORANGE"), "HOME");
  assert.equal(categorise("superior"), "OTHER", "whole words only");
  assert.equal(categorise("cafetería"), "FOOD_AND_DRINK");
});

test("Manu's correction is learned per merchant and applied to proposals and future imports", async () => {
  const { merchantKey, learnCategory, categorise } = await import("../core/money.js");
  assert.equal(merchantKey("COMPRA TARJ. 5540XXXXXXXX1234 LA TIENDA EJEMPLO-GIJON"), merchantKey("COMPRA TARJ. 5540XXXXXXXX9999 LA TIENDA EJEMPLO-GIJON"));
  const csv = "Fecha;Concepto;Importe;Saldo\n01/09/2026;COMPRA TARJ. LA TIENDA EJEMPLO;-5,00;10\n02/09/2026;COMPRA TARJ. LA TIENDA EJEMPLO;-7,00;3\n03/09/2026;COMPRA TARJ. OTRA COSA;-1,00;2\n";
  const first = importStatement(csv);
  assert.ok(first.entries.every((e) => e.category === "OTHER" && e.inferred));
  const { entries, learned, applied } = learnCategory(first.entries, {}, first.entries[0].id, "LEISURE");
  assert.equal(applied, 1);
  assert.deepEqual(entries.map((e) => e.category), ["LEISURE", "LEISURE", "OTHER"]);
  assert.equal(entries[2].inferred, true, "other merchants untouched");
  const later = importStatement("Fecha;Concepto;Importe;Saldo\n01/10/2026;COMPRA TARJ. LA TIENDA EJEMPLO;-9,00;50\n", new Set(), learned);
  assert.equal(later.entries[0].category, "LEISURE");
  assert.equal(later.entries[0].inferred, false);
  assert.equal(categorise("COMPRA TARJ. LA TIENDA EJEMPLO", { "la tienda ejemplo": "NOPE" }), "OTHER", "unknown learned categories are ignored");
  const manualFix = learnCategory(entries, learned, entries[0].id, "SHOPPING");
  assert.equal(manualFix.entries[1].category, "LEISURE", "confirmed entries are not overwritten by a later rule");
});
