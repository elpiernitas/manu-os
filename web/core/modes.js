// Mirrors ModeEngine in Sources/ManuOSCore/Modes.swift (brain/02d-app-core).
export const MODE_TITLES = {
  NIGHT: "Noche",
  MORNING: "Mañana",
  WORK: "Trabajo",
  AFTERNOON: "Tarde",
  WEEKEND: "Fin de semana",
};

export const DEFAULT_SCHEDULE = {
  nightStart: 22 * 60,
  morningStart: 7 * 60,
  workStart: 9 * 60,
  workEnd: 13 * 60,
  workDays: [1, 2, 3, 4, 5], // ISO: 1 = Monday … 7 = Sunday
};

const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

// `date` is read in the device's local time zone.
export function modeState(date, schedule = DEFAULT_SCHEDULE, override = null) {
  if (override && date < new Date(override.until)) {
    return { mode: override.mode, showsWorkContent: override.mode === "WORK", reason: "Elegido manualmente" };
  }
  const now = date.getHours() * 60 + date.getMinutes();
  const iso = ((date.getDay() + 6) % 7) + 1;
  if (now >= schedule.nightStart || now < schedule.morningStart) {
    return { mode: "NIGHT", showsWorkContent: false, reason: "Horario de noche" };
  }
  if (!schedule.workDays.includes(iso)) {
    return { mode: "WEEKEND", showsWorkContent: false, reason: "Día sin trabajo" };
  }
  if (now < schedule.workStart) return { mode: "MORNING", showsWorkContent: false, reason: "Antes del trabajo" };
  if (now < schedule.workEnd) return { mode: "WORK", showsWorkContent: true, reason: "Horario de trabajo" };
  return { mode: "AFTERNOON", showsWorkContent: false, reason: `Desconexión laboral desde las ${hhmm(schedule.workEnd)}` };
}
