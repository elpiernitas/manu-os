// Night routine: where Manu works tomorrow and when to wake up.
// Mirrors NightPlanner in Sources/ManuOSCore/Routines.swift (brain/02d-app-core).
import { normalise } from "./text.js";

export const CITIES = {
  GIJON: { id: "GIJON", name: "Gijón", latitude: 43.53573, longitude: -5.66152 },
  OVIEDO: { id: "OVIEDO", name: "Oviedo", latitude: 43.36029, longitude: -5.84476 },
};

export const MORNING = { getReady: 30, breakfast: 20, travelToOviedo: 40, arriveEarly: 10, defaultWake: 8 * 60, earliestWake: 6 * 60 };

const toMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
export const toHHMM = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

// Events: [{ time: "HH:MM" | null, title, location? }]
export function guessCity(events) {
  const hit = events.find((e) => normalise(`${e.location ?? ""} ${e.title}`).includes("oviedo"));
  return hit
    ? { city: "OVIEDO", reason: `«${hit.title}» parece en Oviedo` }
    : { city: "GIJON", reason: "No veo nada en Oviedo" };
}

export function proposeAlarm({ events = [], city = "GIJON", wantsBreakfast = true, settings = MORNING }) {
  const timed = events.filter((e) => e.time).sort((a, b) => (a.time < b.time ? -1 : 1));
  const first = timed[0];
  if (!first) {
    return { time: toHHMM(Math.max(settings.defaultWake, settings.earliestWake)), explanation: "No tienes nada temprano: te propongo tu hora habitual." };
  }
  let needed = settings.getReady + settings.arriveEarly;
  const parts = ["prepararte"];
  if (wantsBreakfast) { needed += settings.breakfast; parts.push("desayunar"); }
  if (city === "OVIEDO") { needed += settings.travelToOviedo; parts.push("ir a Oviedo"); }
  const proposed = toMin(first.time) - needed;
  const clamped = Math.max(proposed, settings.earliestWake);
  return {
    time: toHHMM(clamped),
    explanation: `Tu primera cita es «${first.title}». Cuento tiempo para ${parts.join(", ")}${clamped > proposed ? ". No te pongo la alarma antes de lo que tienes configurado." : "."}`,
  };
}

// Día de Oviedo (WEB-71): when to leave home to arrive with margin.
export function oviedoTrip({ workStart = "09:00", settings = MORNING } = {}) {
  const start = toMin(workStart);
  const arrive = start - settings.arriveEarly;
  const leave = arrive - settings.travelToOviedo;
  return { leave: toHHMM(leave), arrive: toHHMM(arrive), start: toHHMM(start), minutes: settings.travelToOviedo, to: "Oviedo", href: "https://www.google.com/maps/dir/?api=1&destination=Oviedo&travelmode=transit" };
}

// The question appears from 18:00 until going to bed, once per evening.
export function shouldAskTomorrow(now, answeredFor, tomorrowKey) {
  return now.getHours() >= 18 && answeredFor !== tomorrowKey;
}

// iOS Shortcuts bridge: runs a shortcut Manu created once, passing text.
// TEÓRICAMENTE_POSIBLE: scheme documented by Apple for Shortcuts; not tested on Manu's iPhone.
export function shortcutUrl(name, text) {
  return `shortcuts://run-shortcut?name=${encodeURIComponent(name)}&input=text&text=${encodeURIComponent(text)}`;
}
