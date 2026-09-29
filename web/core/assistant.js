import { normalise } from "./text.js";
import { toCents, euros } from "./money.js";
import { categoryFromText } from "./budget.js";

// Deterministic MANU (ADR-0009). Mirrors Sources/ManuOSCore/Assistant.swift.
const CRISIS = ["suicid", "quiero morir", "ganas de morir", "quitarme la vida", "no quiero vivir", "matarme", "hacerme dano", "acabar con todo", "no quiero seguir viviendo"];
const LOW_MOOD = ["de bajon", "estoy mal", "me siento mal", "estoy triste", "me siento fatal", "estoy fatal", "estoy hundido", "no tengo ganas de nada"];
const EXPENSE = ["gaste", "he gastado", "pague", "he pagado", "gasto de", "registra un gasto", "me costo", "me ha costado", "compre", "he comprado"];
const IDEA = ["idea:", "guarda una idea", "guarda la idea", "apunta", "anota", "nueva idea"];

export const CRISIS_REPLY =
  "Esto es importante y no quiero que lo lleves solo. Si estás en peligro ahora mismo, llama al 112. " +
  "También puedes llamar al 024, la línea de atención a la conducta suicida: es gratuita, confidencial " +
  "y atiende las 24 horas. Si puedes, avisa también a alguien de confianza para que esté contigo. " +
  "Yo sigo aquí, pero no sustituyo a esa ayuda.";

export function amountCents(text) {
  const m = normalise(text).match(/(\d+(?:[.,]\d{1,2})?)\s*(?:€|eur|euros)?/);
  return m ? toCents(m[1]) : null;
}

// Keeps Manu's own spelling ("Café", not "cafe"); categorising normalises later.
// WEB-50: «… 30 de gasolina», «… 45,90 del gimnasio», «me costó 3 el bus»,
// «compré pan por 2» — and without the article («el mercadona» → «mercadona»).
const ARTICLE = /^(?:el|la|los|las|un|una|al|del)\s+/i;
const tidy = (v) => (v ?? "").replace(/[\s.!?,;]+$/, "").replace(ARTICLE, "").trim().slice(0, 80) || null;
export function merchant(text) {
  const t = String(text).trim();
  const after = t.match(/\d(?:[.,]\d{1,2})?\s*(?:€|eur\b|euros?\b)?\s+(?:en|de|del|al|por|para)\s+(.+)$/i) ?? t.match(/(?:me (?:ha )?cost[oó])\s+\d+(?:[.,]\d{1,2})?\s*(?:€|eur\b|euros?\b)?\s+(.+)$/i);
  if (after) return tidy(after[1]);
  const before = t.match(/^(?:compr[eé]|he comprado)\s+(.+?)\s+(?:por|a|en)\s+\d/i);
  if (before) return tidy(before[1]);
  return null;
}

const hm = (h, m) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

export function parse(input) {
  const text = normalise(input);
  if (!text) return { kind: "unknown" };
  if (CRISIS.some((p) => text.includes(p))) return { kind: "crisis" };
  if (LOW_MOOD.some((p) => text.includes(p))) return { kind: "lowMood" };
  const original = String(input).trim();
  // WEB-50: tasks — «tarea: renovar el dni», «añade tarea …», and short «tengo
  // que …» / «hay que …» (not «tengo que contarte algo»: that is conversation).
  const task = original.match(/^(?:(?:apunta|anota|añade|agrega|nueva|pon)(?:me)?\s+(?:una\s+)?tarea|tarea|pendiente)\s*[:,.\-]?\s+(.+)$/i)
    ?? (/^(?:tengo que|hay que)\s+/i.test(original) && !/\?/.test(original) && original.split(/\s+/).length <= 8 && !/^(?:tengo|hay) que (?:decirte|contarte|preguntarte|hablar|pensar|admitir|reconocer)\b/i.test(text) ? original.match(/^(?:tengo que|hay que)\s+(.+)$/i) : null);
  if (task && task[1].trim()) return { kind: "task", text: task[1].replace(/[\s.]+$/, "").trim().slice(0, 200) };
  const prefix = IDEA.find((p) => text.startsWith(p));
  if (prefix) {
    // Keep Manu's own wording: cut the same number of characters from the original.
    const idea = original.slice(prefix.length).replace(/^\s*(?:(?:una|la)\s+)?idea\b/i, "").replace(/^[\s:,.\-]+|[\s:,.\-]+$/g, "");
    if (idea) return { kind: "idea", text: idea };
  }
  const alarm = text.match(/^(?:(?:pon(?:me)?|poner|crea|activa) (?:una )?alarma|alarma|despiertame|levantame) (?:(manana) )?(?:a las |a la |para las |a )?(\d{1,2})(?:[:.](\d{2}))?/);
  if (alarm) {
    const h = Number(alarm[2]), m = Number(alarm[3] ?? 0);
    if (h < 24 && m < 60) return { kind: "alarm", time: hm(h, m) };
  }
  const VERB = "(?:recu[eé]rdame|av[ií]same)";
  // «recuérdame dentro de 20 minutos sacar la ropa», «avísame en 2 horas de …»
  const rel = original.match(new RegExp(`^${VERB}\\s+(?:en|dentro de)\\s+(\\d{1,3}|media)\\s*(minutos?|mins?|horas?|h)\\s+(?:de\\s+|que\\s+|para\\s+)?(.+)$`, "i"));
  if (rel) {
    const n = rel[1] === "media" ? 30 : Number(rel[1]);
    const minutes = /^h/i.test(rel[2]) && rel[1] !== "media" ? n * 60 : n;
    const what = rel[3].replace(/[\s.]+$/, "").trim();
    if (minutes > 0 && minutes <= 24 * 60 && what) return { kind: "reminder", text: what, inMinutes: minutes };
  }
  // Time after the text («recuérdame X mañana a las 9») or before it
  // («recuérdame mañana a las 9 ir al médico»).
  const remind = original.match(new RegExp(`^${VERB}\\s+(?:(ma[nñ]ana)\\s+)?(.+?)(?:\\s+(ma[nñ]ana))?\\s+a\\s+las?\\s+(\\d{1,2})(?:[:.](\\d{2}))?\\s*$`, "i"))
    ?? (() => { const b = original.match(new RegExp(`^${VERB}\\s+(?:(ma[nñ]ana)\\s+)?a\\s+las?\\s+(\\d{1,2})(?:[:.](\\d{2}))?\\s+(?:(ma[nñ]ana)\\s+)?(.+)$`, "i")); return b ? [b[0], b[1] ?? b[4], b[5], null, b[2], b[3]] : null; })();
  if (remind) {
    const h = Number(remind[4]), m = Number(remind[5] ?? 0);
    const what = remind[2].replace(/^(que|de|para)\s+/i, "").replace(/[\s.]+$/, "").trim();
    if (h < 24 && m < 60 && what) {
      return { kind: "reminder", text: what, tomorrow: Boolean(remind[1] || remind[3]), time: hm(h, m) };
    }
  }
  // WEB-50: «¿cuánto llevo gastado este mes?», «¿cuánto gasté en comida?»
  if (/^(?:cuanto|que) (?:llevo gastado|he gastado|gaste|me he gastado|llevo)(?: este mes| en| de|$)/.test(text.replace(/^[¿\s]+/, ""))) {
    return { kind: "spendQuery", category: categoryFromText(text.replace(/[¿?¡!.,]/g, " ").replace(/\b(cuanto|llevo|gastado|he|gaste|me|este|mes|en|de)\b/g, " ")) };
  }
  if (EXPENSE.some((p) => text.includes(p))) {
    const cents = amountCents(text);
    if (cents) return { kind: "expense", cents, merchant: merchant(input) };
  }
  // «12€ cine», «20 euros en cena»: an amount WITH currency at the start.
  const lead = original.match(/^(\d{1,7}(?:[.,]\d{1,2})?)\s*(?:€|eur\b|euros?\b)\s*(?:en|de|del)?\s*(.*)$/i);
  if (lead) {
    const cents = toCents(lead[1]);
    if (cents) return { kind: "expense", cents, merchant: tidy(lead[2]) };
  }
  if ((text.includes("tiempo") && (text.includes("que tiempo") || text.includes("hace"))) || text.includes("va a llover") || text.includes("llueve")) {
    return { kind: "weather" };
  }
  if (text.includes("manana") && (text.includes("que tengo") || text.includes("agenda"))) return { kind: "agenda", day: "tomorrow" };
  if (text.includes("que tengo") || text.includes("agenda") || text.includes("mi dia")) return { kind: "agenda", day: "today" };
  if (text.includes("refugio")) return { kind: "refuge" };
  // Greetings and thanks are answered by MANU itself, never sent to the AI.
  const bare = text.replace(/^[¿¡\s]+/, "");
  if (/^(hola|holi|buenas|buenos dias|buenas tardes|buenas noches|hey|ey|que tal|como estas|que pasa)\b[\s!?.,]*(manu)?[\s!?.,]*$/.test(bare)) return { kind: "greeting" };
  if (/^(gracias|muchas gracias|genial|perfecto|vale|ok|okey)\b[\s!?.,]*(manu)?[\s!?.,]*$/.test(bare)) return { kind: "thanks" };
  return { kind: "unknown" };
}

export function reply(intent, variant = 0) {
  const v = Math.abs(variant) % 2;
  switch (intent.kind) {
    case "crisis":
      return CRISIS_REPLY;
    case "lowMood":
      return [
        "Vaya. Cuéntame un poco: ¿quieres entender por qué estás así, buscar una solución o desconectar un rato?",
        "Estoy aquí. ¿Te apetece hablarlo, arreglar algo concreto o cambiar de aire?",
      ][v];
    case "expense": {
      const place = intent.merchant ? ` en ${intent.merchant}` : "";
      const amount = euros(intent.cents);
      return [
        `Anotado: ${amount}${place}. Lo dejo pendiente de que confirmes la categoría.`,
        `Hecho, ${amount}${place} apuntados. Luego revisas la categoría.`,
      ][v];
    }
    case "idea":
      return [
        `Guardada: «${intent.text}». No la convierto en proyecto; la vemos cuando quieras.`,
        `Apuntada: «${intent.text}». Queda en la bandeja para clasificarla contigo.`,
      ][v];
    case "agenda":
      return intent.day === "tomorrow"
        ? "Todavía no puedo leer tu calendario. Mira la pestaña Agenda para tus tareas."
        : "Todavía no puedo leer tu calendario. Te llevo a Agenda con tus tareas.";
    case "weather":
      return "Aún no tengo servicio del tiempo (decisión D-06 pendiente), así que no te lo puedo decir.";
    case "alarm":
      return `Te preparo la alarma de las ${intent.time}. Toca «Poner en el iPhone» para crearla con tu atajo «MANU Alarma».`;
    case "reminder":
      if (intent.inMinutes) return `Apuntado: «${intent.text}» dentro de ${intent.inMinutes >= 60 && intent.inMinutes % 60 === 0 ? `${intent.inMinutes / 60} h` : `${intent.inMinutes} min`}. Te aviso si tienes MANU abierta; para que suene siempre, añádelo al iPhone.`;
      return `Apuntado: «${intent.text}» ${intent.tomorrow ? "mañana" : "hoy"} a las ${intent.time}. Te aviso si tienes MANU abierta; para que suene siempre, añádelo al iPhone.`;
    case "task":
      return [`Tarea apuntada: «${intent.text}».`, `Hecho, «${intent.text}» en tus tareas.`][v];
    case "refuge":
      return "Abro el Refugio. Aquí no hay prisa.";
    case "greeting":
      return ["¡Hola, Manu! ¿Qué apunto? Un gasto, una tarea, un recordatorio… o pregúntame qué tienes hoy.", "¡Buenas! Aquí estoy. Dime qué necesitas."][v];
    case "thanks":
      return ["¡A mandar!", "Nada, para eso estoy."][v];
    default:
      return [
        "No te he entendido del todo. Puedo guardar una idea, apuntar un gasto o enseñarte tu agenda.",
        "Eso todavía no lo sé hacer sin un modelo de IA. Prueba con «apunta…», «gasté…» o «qué tengo hoy».",
      ][v];
  }
}

// Quick add («+»): one free-text field; MANU guesses what it is. The guess is
// only a suggestion shown on the type tiles — Manu can always pick another.
export function quickDetect(input, now = new Date()) {
  const raw = String(input ?? "").trim();
  if (!raw) return { kind: "TASK" };
  const intent = parse(raw);
  if (intent.kind === "idea") return { kind: "IDEA", text: intent.text };
  if (intent.kind === "task") return { kind: "TASK", text: intent.text };
  if (intent.kind === "reminder" && intent.inMinutes) return { kind: "REMINDER", text: intent.text, at: new Date(now.getTime() + intent.inMinutes * 60000) };
  if (intent.kind === "reminder" || intent.kind === "alarm") {
    const [h, m] = intent.time.split(":").map(Number);
    const at = new Date(now); at.setHours(h, m, 0, 0);
    if (intent.tomorrow) at.setDate(at.getDate() + 1);
    else if (at <= now) at.setDate(at.getDate() + 1);
    return { kind: "REMINDER", text: intent.kind === "alarm" ? "Alarma" : intent.text, at };
  }
  if (intent.kind === "expense") return { kind: "EXPENSE", cents: intent.cents, merchant: intent.merchant };
  // «12,50 café», «café 3€», «20 euros gasolina»: an amount with a currency, or a
  // leading number followed by words, reads as an expense.
  const withCurrency = raw.match(/(\d{1,7}(?:[.,]\d{1,2})?)\s*(?:€|eur\b|euros?\b)/i);
  const leading = raw.match(/^(\d{1,7}(?:[.,]\d{1,2})?)\s+(\D.*)$/);
  const m = withCurrency ?? leading;
  if (m) {
    const cents = toCents(m[1]);
    const rest = raw.replace(m[0], m === leading ? m[2] : "").replace(/\s+/g, " ").replace(/^(en|de)\s+/i, "").trim();
    if (cents) return { kind: "EXPENSE", cents, merchant: rest.slice(0, 80) || null };
  }
  return { kind: "TASK", text: raw };
}
