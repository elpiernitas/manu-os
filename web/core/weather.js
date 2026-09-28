// Weather through Open-Meteo (free, no key). Only the chosen city's
// coordinates leave the device. Pure helpers + a fetch adapter.
const WMO = [
  [[0], "Despejado", "sun"],
  [[1, 2], "Poco nuboso", "cloud-sun"],
  [[3], "Nublado", "cloud"],
  [[45, 48], "Niebla", "fog"],
  [[51, 53, 55, 56, 57], "Llovizna", "rain"],
  [[61, 63, 65, 66, 67, 80, 81, 82], "Lluvia", "rain"],
  [[71, 73, 75, 77, 85, 86], "Nieve", "snow"],
  [[95, 96, 99], "Tormenta", "storm"],
];

export function describe(code) {
  const hit = WMO.find(([codes]) => codes.includes(code));
  return hit ? { text: hit[1], icon: hit[2] } : { text: "Tiempo variable", icon: "cloud" };
}

export function forecastUrl({ latitude, longitude }) {
  const p = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "auto",
    forecast_days: "2",
  });
  return `https://api.open-meteo.com/v1/forecast?${p}`;
}

export function geocodeUrl(name) {
  const p = new URLSearchParams({ name: String(name).slice(0, 80), count: "5", language: "es", format: "json" });
  return `https://geocoding-api.open-meteo.com/v1/search?${p}`;
}

export function parseCities(json) {
  return (json?.results ?? [])
    .filter((r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude))
    .map((r) => ({ name: String(r.name), region: [r.admin1, r.country].filter(Boolean).join(", "), latitude: r.latitude, longitude: r.longitude }));
}

// Turns an Open-Meteo response into what the app shows. Throws on shapes it does not understand.
export function parseForecast(json) {
  const c = json?.current;
  const d = json?.daily;
  if (!c || !d || !Array.isArray(d.time) || d.time.length === 0) throw new Error("Respuesta del tiempo no válida");
  const day = (i) => ({
    date: d.time[i],
    ...describe(d.weather_code[i]),
    max: Math.round(d.temperature_2m_max[i]),
    min: Math.round(d.temperature_2m_min[i]),
    rain: d.precipitation_probability_max?.[i] ?? null,
  });
  return {
    now: { temp: Math.round(c.temperature_2m), ...describe(c.weather_code) },
    today: day(0),
    tomorrow: d.time.length > 1 ? day(1) : null,
  };
}

// One short sentence in MANU's tone.
export function advice(forecast) {
  const t = forecast.today;
  if (t.rain !== null && t.rain >= 50) return `Hoy puede llover (${t.rain} %). Lleva paraguas.`;
  if (t.max >= 32) return "Hoy aprieta el calor. Bebe agua.";
  if (t.min <= 3) return "Hoy hace frío por la mañana. Abrígate.";
  return `${t.text}, entre ${t.min} y ${t.max} °C.`;
}

export const WEATHER_TTL_MS = 30 * 60 * 1000;

export async function fetchForecast(city, fetchImpl = fetch) {
  const res = await fetchImpl(forecastUrl(city));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseForecast(await res.json());
}

export async function searchCities(name, fetchImpl = fetch) {
  const res = await fetchImpl(geocodeUrl(name));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseCities(await res.json());
}
