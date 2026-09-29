// «Escenas vivas»: emoji and ambient scene for each weather state. Pure, so
// the mapping is testable; motion lives in CSS and respects reduced motion.
const EMOJI = { sun: "☀️", moon: "🌙", "cloud-sun": "🌤️", "cloud-moon": "☁️", cloud: "☁️", fog: "🌫️", rain: "🌧️", snow: "❄️", storm: "⛈️" };
export const weatherEmoji = (icon) => EMOJI[icon] ?? "🌥️";

// Scene of the card and of the app background.
export function sceneFor(icon) {
  if (icon === "storm") return "storm";
  if (icon === "rain") return "rain";
  if (icon === "snow") return "snow";
  if (icon === "fog") return "fog";
  if (icon === "moon" || icon === "cloud-moon") return "night";
  if (icon === "sun") return "sun";
  return "cloud"; // cloud, cloud-sun, unknown
}

// How many particles each scene draws (drops, stars, clouds, flakes).
export const PARTICLES = { rain: 14, storm: 14, snow: 12, night: 12, cloud: 3, fog: 3, sun: 0 };

// Money scene: a short shower of notes and coins when entering Dinero.
export const MONEY_EMOJI = ["💶", "💸", "🪙"];
