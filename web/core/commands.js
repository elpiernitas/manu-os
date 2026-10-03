// Barra de comandos (WEB-78), an idea from the external review: faster than
// the chat for the things Manu does every day. ⌘K / Ctrl+K or «/» on the Mac,
// the «⚡» button on the iPhone. It understands:
//   - fichaje: «entro», «pausa café», «salgo a fumar», «vuelvo», «salida»;
//   - ánimo and hábitos: «ánimo bien», «hábito leer»;
//   - short forms: «/gasto 12 café», «/tarea …», «/idea …», «/recordar …»;
//   - a screen by name: «fichaje», «hábitos», «tu nube»…;
//   - anything else goes to MANU as if typed in the chat.
// Pure: text in, a command out. The app runs it.
import { normalise } from "./text.js";
import { parse } from "./assistant.js";

export const SCREENS = [
  ["hoy", "Hoy", "inicio portada"], ["agenda", "Agenda", "calendario eventos"], ["manu", "MANU", "chat hablar"],
  ["dinero", "Dinero", "gastos cuentas banco presupuesto"], ["proyectos", "Proyectos", "proyecto"], ["tu", "Tú", "perfil ajustes"],
  ["tu/fichaje", "Fichaje", "fichar registro horas informe excel rk"], ["tu/habitos", "Hábitos", "habito"],
  ["tu/salud", "Salud", "pasos sueno peso"], ["tu/comidas", "Comidas", "comida cena"], ["tu/personas", "Personas", "contactos cumpleanos"],
  ["tu/avisos", "Avisos", "notificaciones"], ["tu/atajos", "Atajos", "shortcuts siri buzon"], ["tu/nube", "Tu nube", "sincronizar supabase mac iphone"],
  ["tu/datos", "Tus datos", "copia seguridad backup borrar"], ["tu/tiempo", "Tiempo y ciudades", "clima ciudad"], ["tu/correo", "Correo", "gmail mail"],
  ["tu/archivo", "Tu archivo", "chatgpt diario"], ["tu/capturas", "Capturas", "pantallazos"], ["tu/ia", "IA", "gemini clave"],
  ["tu/spotify", "Spotify", "musica altavoz"], ["tu/gcal", "Google", "cuenta google conectar"],
  ["tu/repaso", "Repaso", "semana revision noche plan"], ["tu/documentos", "Documentos", "seguros contratos polizas garantias vencimientos"],
  ["tu/biblioteca", "Biblioteca", "libros podcasts videos aprendi lecturas"],
];

const MOOD_WORDS = { "muy bien": 4, genial: 4, "de lujo": 4, bien: 3, regular: 2, "asi asi": 2, mal: 1, "1": 1, "2": 2, "3": 3, "4": 4 };
const WHY = { cafe: "Café", fumar: "Fumar", cigarro: "Fumar", piti: "Fumar", recado: "Recado" };

/**
 * @returns one of
 *   { type: "punch", t: "in"|"pause"|"back"|"out", why? }
 *   { type: "mood", value }   { type: "habit", name }
 *   { type: "go", target, label }   { type: "say", text }   or null (empty)
 */
export function parseCommand(input) {
  const raw = String(input ?? "").trim().slice(0, 300);
  if (!raw) return null;
  const n = normalise(raw).replace(/^\/\s*/, "").replace(/[.!¡¿?]+$/, "").trim();
  const rest = raw.replace(/^\/?\s*\S+\s*/, "").trim(); // original text after the first word

  // Fichaje. The pause goes first: «salgo a fumar» is a pause, «salgo» is leaving.
  let m = n.match(/^(?:fichar\s+|ficho\s+)?(?:pausa|parada|paro|salgo a|me bajo a|bajo a|voy a)\s*(?:para\s+|a\s+|de\s+|por\s+)?(?:el\s+|un\s+|una\s+)?(cafe|fumar|cigarro|piti|recado)?\s*$/);
  if (m && (m[1] || /^(?:fichar\s+|ficho\s+)?(?:pausa|parada|paro)$/.test(n))) return { type: "punch", t: "pause", why: WHY[m[1]] ?? (m[1] ? "Otro" : null) };
  if (/^(?:fichar\s+|ficho\s+)?(?:entro|entrada|he entrado|ya estoy dentro|empiezo)$/.test(n)) return { type: "punch", t: "in" };
  if (/^(?:fichar\s+|ficho\s+)?(?:vuelvo|he vuelto|vuelta|de vuelta|vuelvo a la oficina|ya estoy de vuelta)$/.test(n)) return { type: "punch", t: "back" };
  if (/^(?:fichar\s+|ficho\s+)?(?:salida|salgo|me voy|me piro|fin de jornada|ficho la salida)$/.test(n)) return { type: "punch", t: "out" };

  // Ánimo: only with the word «ánimo» first («estoy mal» belongs to MANU, which can open the Refugio).
  m = n.match(/^animo\s+(.+)$/);
  if (m && MOOD_WORDS[m[1]] !== undefined) return { type: "mood", value: MOOD_WORDS[m[1]] };

  m = n.match(/^(?:habito|hecho el habito|marcar habito)\s+(.+)$/);
  if (m) return { type: "habit", name: rest.replace(/^(?:el\s+)?(?:habito|hábito)\s+/i, "").trim() || m[1] };

  // Short forms → the phrase MANU already understands.
  m = n.match(/^(gasto|gaste|pague)\s+(.+)$/);
  if (m) {
    const r = rest.match(/^(\d+(?:[.,]\d{1,2})?)\s*(?:€|euros?)?\s*(?:en\s+)?(.*)$/i);
    return { type: "say", text: r ? `gasté ${r[1]}${r[2] ? ` en ${r[2]}` : ""}` : `gasté ${rest}` };
  }
  if (/^(tarea|todo)\s+/.test(n)) return { type: "say", text: `tarea: ${rest}` };
  if (/^(idea|nota)\s+/.test(n)) return { type: "say", text: `idea: ${rest}` };
  if (/^(recordar|recuerdame|aviso|avisame)\s+/.test(n)) return { type: "say", text: `recuérdame ${rest}` };

  // A screen by name.
  const screen = SCREENS.find(([, label]) => normalise(label) === n) ?? (n.length >= 4 ? SCREENS.find(([, label, kw]) => normalise(label).startsWith(n) || kw.split(" ").some((k) => k === n)) : null);
  if (screen) return { type: "go", target: screen[0], label: screen[1] };

  return { type: "say", text: raw.replace(/^\/\s*/, "") };
}

// What Enter will do, in words (shown first in the list).
export function describe(cmd) {
  if (!cmd) return null;
  if (cmd.type === "punch") return { pause: `⏸ Pausa${cmd.why ? ` (${cmd.why.toLowerCase()})` : ""}`, in: "🟢 Fichar la entrada", back: "🏢 Vuelvo a la oficina", out: "🚪 Fichar la salida" }[cmd.t];
  if (cmd.type === "mood") return `🙂 Ánimo de hoy: ${["", "mal", "regular", "bien", "muy bien"][cmd.value]}`;
  if (cmd.type === "habit") return `✅ Marcar el hábito «${cmd.name}»`;
  if (cmd.type === "go") return `→ Abrir ${cmd.label}`;
  const p = parse(cmd.text);
  const euros = (c) => `${(c / 100).toFixed(2).replace(".", ",")} €`;
  return ({
    expense: () => `💶 Gasto de ${euros(p.cents)}${p.merchant ? ` · ${p.merchant}` : ""}`,
    task: () => `☑️ Tarea: ${p.text}`,
    idea: () => `💡 Idea: ${p.text}`,
    reminder: () => `⏰ Recordatorio: ${p.text}${p.time ? ` a las ${p.time}` : ""}`,
  }[p.kind] ?? (() => `💬 Preguntar a MANU: «${cmd.text.slice(0, 60)}»`))();
}

// Suggestions while typing: the command itself first, then matching screens.
// `clock`: today's fichaje state, so the empty bar offers what makes sense now.
export function suggest(input, { clock = "off" } = {}) {
  const text = String(input ?? "").trim();
  if (!text) {
    const punch = {
      off: [{ label: "🟢 Entro", run: "entro" }],
      working: [{ label: "⏸ Pausa café", run: "pausa café" }, { label: "⏸ Salgo a fumar", run: "salgo a fumar" }, { label: "🚪 Salida", run: "salida" }],
      paused: [{ label: "🏢 Vuelvo a la oficina", run: "vuelvo" }],
      done: [],
    }[clock] ?? [];
    return [
      ...punch,
      { label: "💶 Gasto… (escribe «gasto 12 café»)", fill: "gasto " }, { label: "⏰ Recuérdame…", fill: "recuérdame " },
      { label: "→ Fichaje", run: "fichaje" }, { label: "→ Hábitos", run: "hábitos" },
    ];
  }
  const cmd = parseCommand(text);
  const own = { label: describe(cmd), run: text };
  const n = normalise(text).replace(/^\//, "");
  const screens = [];
  if (n.length >= 2) {
    // Names first («háb» → Hábitos), then keywords («excel» → Fichaje).
    const byName = SCREENS.filter(([, label]) => normalise(label).startsWith(n));
    const byWord = SCREENS.filter(([, label, kw]) => !normalise(label).startsWith(n) && kw.split(" ").some((k) => k.startsWith(n)));
    for (const [target, label] of [...byName, ...byWord]) if (!(cmd?.type === "go" && cmd.target === target)) screens.push({ label: `→ ${label}`, run: label });
  }
  // Typing the start of a screen's name and nothing MANU would do: open it on Enter.
  const vague = cmd?.type === "say" && !["expense", "task", "idea", "reminder"].includes(parse(cmd.text).kind);
  const first = vague && screens.length && SCREENS.some(([, label]) => normalise(label).startsWith(n)) ? [screens.shift(), own] : [own];
  return [...first, ...screens].slice(0, 6);
}
