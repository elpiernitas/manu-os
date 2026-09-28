// MANU as a hub: shortcuts to Manu's apps, chosen by the moment of the day.
// Universal links (https) open the installed app when iOS allows it;
// NO_VERIFICADO from a home-screen web app.
export const APPS = {
  spotify: { label: "Spotify", url: "https://open.spotify.com/", color: "green" },
  whatsapp: { label: "WhatsApp", url: "https://wa.me/", color: "green" },
  calendar: { label: "Calendar", url: "https://calendar.google.com/", color: "blue" },
  gmail: { label: "Gmail", url: "https://mail.google.com/", color: "red" },
  drive: { label: "Drive", url: "https://drive.google.com/", color: "orange" },
  docs: { label: "Docs", url: "https://docs.google.com/document/", color: "blue" },
  sheets: { label: "Hojas", url: "https://docs.google.com/spreadsheets/", color: "green" },
  maps: { label: "Maps", url: "https://www.google.com/maps/", color: "teal" },
  oviedo: { label: "Ir a Oviedo", url: "https://www.google.com/maps/dir/?api=1&destination=Oviedo", color: "teal" },
  alsa: { label: "ALSA", url: "https://www.alsa.es/", color: "gray" },
  gemini: { label: "Gemini", url: "https://gemini.google.com/app", color: "purple" },
  chatgpt: { label: "ChatGPT", url: "https://chatgpt.com/", color: "gray" },
  claude: { label: "Claude", url: "https://claude.ai/new", color: "orange" },
};

const BY_MODE = {
  MORNING: ["spotify", "calendar", "maps", "whatsapp"],
  WORK: ["calendar", "gmail", "drive", "docs", "sheets"],
  AFTERNOON: ["spotify", "whatsapp", "maps", "gemini"],
  WEEKEND: ["spotify", "whatsapp", "maps", "gemini"],
  NIGHT: ["spotify", "calendar", "whatsapp"],
};

// When Manu works in Oviedo, the way there goes first in the morning.
export function appsFor(mode, { oviedoToday = false } = {}) {
  let ids = [...(BY_MODE[mode] ?? BY_MODE.AFTERNOON)];
  if (oviedoToday && (mode === "MORNING" || mode === "NIGHT")) ids = ["oviedo", "alsa", ...ids.filter((i) => i !== "maps")];
  return ids.map((id) => ({ id, ...APPS[id] }));
}

// Spanish mobile numbers: keeps digits, adds 34 when missing. Returns null if implausible.
export function whatsappNumber(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (/^[6-9]\d{8}$/.test(digits)) return `34${digits}`;
  if (/^\d{10,15}$/.test(digits)) return digits;
  return null;
}

export function whatsappUrl(phone, text) {
  const n = whatsappNumber(phone);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : null;
}

// Prefilled question for another assistant. `?q=` prefill is NO_VERIFICADO
// for ChatGPT and Claude; the app also copies the text to the clipboard.
export function askElsewhereUrl(app, text) {
  const q = encodeURIComponent(String(text).slice(0, 1500));
  if (app === "chatgpt") return `https://chatgpt.com/?q=${q}`;
  if (app === "claude") return `https://claude.ai/new?q=${q}`;
  return APPS.gemini.url;
}
