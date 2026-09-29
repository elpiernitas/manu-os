// «Modo conversación» (WEB-27): MANU talks through Gemini, remembers the
// conversation and knows the parts of Manu's life he chose to share. Each
// category is Manu's explicit decision; secrets and the Refugio never go.
import { sensitiveKinds, TOOLS, BASE_SYSTEM, NEVER } from "./ai.js";
import { euros, CATEGORIES } from "./money.js";

export const CONTEXT_CATEGORIES = [
  { key: "agenda", label: "Agenda y recordatorios", sensitive: false, note: "Los títulos pueden incluir nombres de otras personas." },
  { key: "tasks", label: "Tareas e ideas", sensitive: false },
  { key: "weather", label: "Tiempo", sensitive: false },
  { key: "habits", label: "Hábitos", sensitive: false },
  { key: "money", label: "Dinero (gastos, ingresos, saldo)", sensitive: true },
  { key: "health", label: "Salud (sueño, pasos, peso)", sensitive: true },
  { key: "mood", label: "Ánimo", sensitive: true },
  { key: "people", label: "Personas y cumpleaños", sensitive: true },
  { key: "mail", label: "Correo (remitentes y asuntos)", sensitive: true },
];
export const BASIC_CONTEXT = { agenda: true, tasks: true, weather: true, habits: true, money: false, health: false, mood: false, people: false, mail: false };
export const FULL_CONTEXT = Object.fromEntries(CONTEXT_CATEGORIES.map((c) => [c.key, true]));

// A message may go if every sensitive category it touches was allowed.
export function allowedToSend(text, context = {}) {
  const kinds = sensitiveKinds(text);
  const blocked = [...kinds].filter((k) => NEVER.includes(k) || !context[k]);
  return { ok: blocked.length === 0, blocked };
}

const day = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hm = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

// What MANU knows, as short plain text. `data` is a snapshot the app builds.
export function buildContext(data, context, now = new Date()) {
  const out = [];
  if (context.agenda) {
    const tk = day(now), tm = new Date(now); tm.setDate(tm.getDate() + 1);
    const ev = (k) => (data.events?.[k] ?? []).map((e) => `${e.time ?? "todo el día"} ${e.title}`).join("; ") || "nada";
    out.push(`AGENDA hoy: ${ev(tk)}. Mañana: ${ev(day(tm))}.`);
    const rems = (data.reminders ?? []).filter((r) => !r.done).slice(0, 12).map((r) => { const d = new Date(r.at); return `${day(d)} ${hm(d)} ${r.text}`; });
    if (rems.length) out.push(`RECORDATORIOS: ${rems.join("; ")}.`);
  }
  if (context.tasks) {
    const t = (data.tasks ?? []).slice(0, 20).map((x) => x.text);
    const i = (data.ideas ?? []).slice(0, 10).map((x) => x.text);
    out.push(`TAREAS pendientes: ${t.join("; ") || "ninguna"}.${i.length ? ` IDEAS: ${i.join("; ")}.` : ""}`);
  }
  if (context.weather && data.weather) out.push(`TIEMPO en ${data.weather.city}: ${data.weather.text}, ${data.weather.temp}° (mín ${data.weather.min}°, máx ${data.weather.max}°)${data.weather.rain !== null && data.weather.rain !== undefined ? `, lluvia ${data.weather.rain} %` : ""}.`);
  if (context.habits && data.habits?.length) out.push(`HÁBITOS: ${data.habits.map((h) => `${h.name}${h.doneToday ? " (hecho hoy)" : ""}`).join("; ")}.`);
  if (context.money && data.money) {
    const m = data.money;
    out.push(`DINERO este mes: gastado ${euros(m.spent)}, ingresado ${euros(m.earned)}${m.payroll ? `, nómina ${euros(m.payroll)}` : ""}${m.balance !== null && m.balance !== undefined ? `, saldo ${euros(m.balance)}` : ""}. Por categoría: ${m.byCategory.slice(0, 6).map(([c, v]) => `${CATEGORIES[c] ?? c} ${euros(v)}`).join("; ") || "sin gastos"}.`);
  }
  if (context.health && data.health) out.push(`SALUD (media semanal): sueño ${data.health.sleep ?? "?"} h, pasos ${data.health.steps ?? "?"}.`);
  if (context.mood && data.mood) out.push(`ÁNIMO de hoy: ${data.mood}.`);
  if (context.people && data.birthdays?.length) out.push(`CUMPLEAÑOS próximos: ${data.birthdays.map((b) => `${b.name} (${b.days === 0 ? "hoy" : `en ${b.days} días`})`).join("; ")}.`);
  if (context.mail && data.mail) {
    const m = data.mail;
    out.push(`CORREO (últimos 30 días, Gmail): quien más escribe: ${m.senders.slice(0, 10).map((s) => `${s.name} <${s.email}> ${s.count}${s.unsub ? " (tiene baja)" : ""}`).join("; ") || "nadie"}.${m.important.length ? ` Importantes sin leer: ${m.important.slice(0, 6).map((x) => `${x.name}: ${x.subject}`).join("; ")}.` : ""}${m.chatgptExport ? " Ha llegado la exportación de datos de ChatGPT." : ""} Para actuar usa correo_baja, correo_archivar, correo_papelera o correo_etiquetar con el remitente.`);
  }
  return out.join("\n");
}

export function conversationSystem(contextText, now = new Date(), autoActions = false) {
  return `${BASE_SYSTEM.replace("(máximo 4 frases)", "(normalmente 1 a 4 frases)")}
Eres la IA integrada en la app MANU OS de Manu: conversas con él y gestionas sus cosas con las funciones disponibles.${autoActions ? " Las acciones sencillas (tareas, ideas, recordatorios, completar tareas, ir a una pantalla) se hacen al momento y Manu puede deshacerlas; los gastos y lo demás los confirma él." : " Manu confirma cada acción con un toque; no digas que ya está hecha."}
Usa lo que sabes de Manu (abajo) solo cuando sea útil. Si algo no está ahí, no lo inventes: dilo.
Fecha y hora: ${now.toLocaleString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}.
LO QUE SABES DE MANU:
${contextText || "(Manu no ha compartido datos.)"}`;
}

// History: the last turns that are themselves allowed to go.
export function buildConversationPayload({ message, history = [], contextText = "", context = {}, now = new Date(), autoActions = false }) {
  const turns = history.filter((m) => m.text && m.text !== "Pensando…" && allowedToSend(m.text, context).ok).slice(-10)
    .map((m) => ({ role: m.from === "me" ? "user" : "model", parts: [{ text: String(m.text).slice(0, 1500) }] }));
  return {
    systemInstruction: { parts: [{ text: conversationSystem(contextText, now, autoActions) }] },
    contents: [...turns, { role: "user", parts: [{ text: String(message).slice(0, 2000) }] }],
    tools: TOOLS,
    generationConfig: { maxOutputTokens: 600, temperature: 0.6 },
  };
}

// Actions MANU may run by itself when Manu enabled it (all undoable).
export const AUTO_SAFE = new Set(["anadir_tarea", "anadir_idea", "crear_recordatorio", "completar_tarea", "ir_a"]);
