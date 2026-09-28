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
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day",
    hourly: "temperature_2m,weather_code,precipitation_probability",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max,wind_speed_10m_max",
    timezone: "auto",
    forecast_days: "7",
    forecast_hours: "24",
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

const round = (x) => (Number.isFinite(x) ? Math.round(x) : null);
const clock = (iso) => (typeof iso === "string" && iso.length >= 16 ? iso.slice(11, 16) : null);
const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

// Clear and partly cloudy skies at night get a moon.
function iconFor(code, isDay) {
  const d = describe(code);
  if (isDay === 0 && d.icon === "sun") return { ...d, icon: "moon" };
  if (isDay === 0 && d.icon === "cloud-sun") return { ...d, icon: "cloud-moon" };
  return d;
}

// Turns an Open-Meteo response into what the app shows. Throws on shapes it does not understand.
export function parseForecast(json) {
  const c = json?.current;
  const d = json?.daily;
  if (!c || !d || !Array.isArray(d.time) || d.time.length === 0) throw new Error("Respuesta del tiempo no válida");
  const day = (i) => {
    const date = new Date(`${d.time[i]}T12:00:00`);
    const rain = d.precipitation_probability_max?.[i] ?? null;
    const desc = describe(d.weather_code[i]);
    // A likely-rain day shows rain even if the daily code is only "cloudy".
    const icon = rain !== null && rain >= 50 && (desc.icon === "cloud" || desc.icon === "cloud-sun") ? "rain" : desc.icon;
    return {
      date: d.time[i],
      weekday: i === 0 ? "Hoy" : WEEKDAYS[date.getDay()],
      ...desc,
      icon,
      max: round(d.temperature_2m_max[i]),
      min: round(d.temperature_2m_min[i]),
      rain: d.precipitation_probability_max?.[i] ?? null,
      sunrise: clock(d.sunrise?.[i]),
      sunset: clock(d.sunset?.[i]),
      uv: d.uv_index_max?.[i] ?? null,
      windMax: round(d.wind_speed_10m_max?.[i]),
    };
  };
  const h = json.hourly;
  const hours = h && Array.isArray(h.time)
    ? h.time.map((t, i) => {
        const hh = Number(t.slice(11, 13));
        const sunrise = Number((d.sunrise?.[0] ?? "T07").slice(11, 13));
        const sunset = Number((d.sunset?.[0] ?? "T20").slice(11, 13));
        return { time: i === 0 ? "Ahora" : t.slice(11, 13), temp: round(h.temperature_2m[i]), rain: h.precipitation_probability?.[i] ?? null, ...iconFor(h.weather_code[i], hh >= sunrise && hh < sunset ? 1 : 0) };
      })
    : [];
  const days = d.time.map((_, i) => day(i));
  return {
    now: { temp: round(c.temperature_2m), feels: round(c.apparent_temperature), humidity: c.relative_humidity_2m ?? null, wind: round(c.wind_speed_10m), ...iconFor(c.weather_code, c.is_day) },
    today: days[0],
    tomorrow: days[1] ?? null,
    days,
    hours,
  };
}

// One short sentence in MANU's tone. Never contradicts the sky right now:
// a rainy daily code with a low probability is not announced as rain.
export function advice(forecast) {
  const t = forecast.today;
  if (t.rain !== null && t.rain >= 50) return `Hoy puede llover (${t.rain} %). Lleva paraguas.`;
  if (t.rain !== null && t.rain >= 30) return `Quizá caiga algo (${t.rain} %). Entre ${t.min} y ${t.max} °C.`;
  if (t.max >= 32) return "Hoy aprieta el calor. Bebe agua.";
  if (t.min <= 3) return "Hoy hace frío por la mañana. Abrígate.";
  return `Ahora ${forecast.now.text.toLowerCase()}. Hoy entre ${t.min} y ${t.max} °C.`;
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
