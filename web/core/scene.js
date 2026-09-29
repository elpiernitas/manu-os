// «Escenas vivas»: emoji and ambient scene for each weather state. Pure, so
// the mapping is testable; motion lives in CSS and respects reduced motion.
const EMOJI = { sun: "☀️", moon: "🌙", "cloud-sun": "🌤️", "cloud-moon": "☁️", cloud: "☁️", fog: "🌫️", rain: "🌧️", snow: "❄️", storm: "⛈️" };
export const weatherEmoji = (icon) => EMOJI[icon] ?? "🌥️";

// «Sol mucho» (WEB-36): a clear day that is hot or with a very high UV index.
export const HOT = { max: 29, uv: 8 };

// Scene of the card and of the app background. Manu asked for six daytime
// scenes: sol mucho, sol, sol con nubes, nubes, lluvia y tormenta.
export function sceneFor(icon, today = {}) {
  if (icon === "storm") return "storm";
  if (icon === "rain") return "rain";
  if (icon === "snow") return "snow";
  if (icon === "fog") return "fog";
  if (icon === "moon" || icon === "cloud-moon") return "night";
  if (icon === "sun") return (today?.max ?? -99) >= HOT.max || (today?.uv ?? 0) >= HOT.uv ? "hot" : "sun";
  if (icon === "cloud-sun") return "sun-cloud";
  return "cloud"; // cloud, unknown
}

// Particles drawn as <i> (drops, stars, flakes, fog bands).
export const PARTICLES = { rain: 14, storm: 14, snow: 12, night: 12, fog: 3, cloud: 0, "sun-cloud": 0, sun: 0, hot: 0 };

// Shapes drawn as <b>: sun, rays, clouds, lightning. Cheap to move (transform
// and opacity only, no blur), so the iPhone keeps them smooth.
export const SHAPES = {
  hot: ["haze", "rays fast", "sun hot"],
  sun: ["rays", "sun"],
  "sun-cloud": ["rays", "sun", "cloud c1", "cloud c2"],
  cloud: ["cloud c1", "cloud c2", "cloud c3"],
  rain: ["cloud c1 dark", "cloud c2 dark"],
  storm: ["flash", "cloud c1 dark", "cloud c2 dark", "bolt"],
};

// Money scene: a short shower of notes and coins when entering Dinero.
export const MONEY_EMOJI = ["💶", "💸", "🪙"];
