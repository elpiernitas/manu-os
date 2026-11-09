// «Dónde gastas» (WEB-106): sitios y ciudades a partir del concepto del banco. Pura.
// Sabadell escribe la ciudad tras un guion al final: «COMPRA TARJ. 5402XXXX BULEVAR-GIJON/XIXON».
// Es un dato del propio movimiento de Manu: no se infiere nada más ni se guarda aparte.
import { normalise } from "./text.js";
import { cleanConcept } from "./quickmoney.js";

const DAY = 86400000;
const ACCENTS = { gijon: "Gijón", aviles: "Avilés", leon: "León", oviedo: "Oviedo", madrid: "Madrid", barcelona: "Barcelona", malaga: "Málaga", cordoba: "Córdoba", cadiz: "Cádiz", jaen: "Jaén", almeria: "Almería", caceres: "Cáceres", castellon: "Castellón", logrono: "Logroño", santander: "Santander", bilbao: "Bilbao", valencia: "Valencia", sevilla: "Sevilla", zaragoza: "Zaragoza", mieres: "Mieres", langreo: "Langreo", siero: "Siero", llanes: "Llanes", villaviciosa: "Villaviciosa", "a coruna": "A Coruña", lugo: "Lugo", vigo: "Vigo" };
const NOT_CITY = /^(sl|sa|slu|scl|cb|es|eu|com|www|online|internet|app|ue|esp|spain|espana)$/;

/** The city of a bank concept, or null. Only from the trailing «-CIUDAD[/OTRO NOMBRE]». */
export function cityOf(concept) {
  const raw = String(concept ?? "").trim();
  if (!raw || raw !== raw.toUpperCase()) return null; // written by a person
  const m = /-\s*([A-ZÑÁÉÍÓÚÜ][A-ZÑÁÉÍÓÚÜ .']{1,28})(?:\/[A-ZÑÁÉÍÓÚÜ .']+)?\s*$/.exec(raw);
  if (!m) return null;
  const key = normalise(m[1]).replace(/\s+/g, " ").trim();
  if (key.length < 3 || NOT_CITY.test(key) || /\d/.test(key)) return null;
  return ACCENTS[key] ?? key.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/** Shops and cities of the last `days` days, by money spent (Bizum, transfers and cash apart). */
export function wherePlaces(spending, { now = new Date(), days = 90 } = {}) {
  const from = now.getTime() - days * DAY;
  const shops = new Map(), cities = new Map();
  let total = 0, located = 0;
  for (const s of spending ?? []) {
    const t = Date.parse(s.at);
    if (!(t >= from && t <= now.getTime()) || !(s.cents > 0) || s.category === "TRANSFERS" || s.category === "CASH") continue;
    total += s.cents;
    const name = cleanConcept(s.merchant) || null;
    const city = cityOf(s.merchant);
    if (name) {
      const k = normalise(name);
      const g = shops.get(k) ?? { name, cents: 0, count: 0, category: s.category, city: null };
      g.cents += s.cents; g.count++; g.city ??= city;
      shops.set(k, g);
    }
    if (city) { located += s.cents; const c = cities.get(city) ?? { city, cents: 0, count: 0 }; c.cents += s.cents; c.count++; cities.set(city, c); }
  }
  const by = (a, b) => b.cents - a.cents || b.count - a.count;
  return { shops: [...shops.values()].sort(by).slice(0, 10), cities: [...cities.values()].sort(by).slice(0, 6), total, located };
}
