import { normalise } from "./text.js";
import { toCents, euros } from "./money.js";
import { categoryFromText } from "./budget.js";
import { dayFromText, dayKeyOf } from "./diary.js";

// ---- WEB-51: days and times in what Manu says ----
const WEEKDAYS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };

// The next day Manu means (for reminders and the agenda). Returns
// { day: "YYYY-MM-DD", match: "…text that said it…" } or null.
export function futureDay(text, now = new Date()) {
  const t = normalise(text).replace(/de la manana|por la manana/g, "_am_");
  let m;
  if ((m = t.match(/\bpasado manana\b/))) return { day: dayKeyOf(addDays(now, 2)), match: m[0] };
  if ((m = t.match(/\bmanana\b/))) return { day: dayKeyOf(addDays(now, 1)), match: m[0] };
  if ((m = t.match(/\b(?:hoy|esta tarde|esta noche)\b/))) return { day: dayKeyOf(now), match: m[0] };
  if ((m = t.match(new RegExp(`\\b(?:el |este |el proximo |el que viene )?(${WEEKDAYS.join("|")})(?: que viene| proximo)?\\b`)))) {
    const wd = WEEKDAYS.indexOf(m[1]);
    const ahead = (wd - now.getDay() + 7) % 7 || 7;
    return { day: dayKeyOf(addDays(now, ahead)), match: m[0] };
  }
  if ((m = t.match(new RegExp(`\\bel (\\d{1,2})(?: de (${MONTHS.join("|")}))?\\b`)))) {
    const d = Number(m[1]);
    if (d >= 1 && d <= 31) {
      let month = m[2] ? MONTHS.indexOf(m[2]) : now.getMonth();
      let x = new Date(now.getFullYear(), month, d);
      if (x.getDate() !== d) return null;
      if (x < new Date(now.getFullYear(), now.getMonth(), now.getDate())) x = m[2] ? new Date(now.getFullYear() + 1, month, d) : new Date(now.getFullYear(), now.getMonth() + 1, d);
      return { day: dayKeyOf(x), match: m[0] };
    }
  }
  return null;
}

// «a las 5», «a las 17:30», «a las 5 y media», «a las 8 menos cuarto de la
// tarde». Hours 1–6 without «de la mañana» mean the afternoon (a reminder at
// «las 5» is 17:00, not 05:00). Returns { h, m, match } or null.
export function timeIn(text, { morningIsDefault = false } = {}) {
  const t = normalise(text);
  const m = t.match(/\ba las? (\d{1,2})(?:[:.](\d{2}))?(?: (y media|y cuarto|menos cuarto))?(?: (de la manana|de la tarde|de la noche|de la madrugada|am|pm))?\b/);
  if (!m) return null;
  let h = Number(m[1]), min = Number(m[2] ?? 0);
  if (m[3] === "y media") min = 30; else if (m[3] === "y cuarto") min = 15; else if (m[3] === "menos cuarto") { h -= 1; min = 45; }
  const part = m[4];
  if ((part === "de la tarde" || part === "de la noche" || part === "pm") && h < 12) h += 12;
  else if (!part && !morningIsDefault && h >= 1 && h <= 6) h += 12;
  if (h < 0 || h > 23 || min > 59) return null;
  return { h, m: min, match: m[0] };
}

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

// WEB-51: «1.200» and «1.450,50» are thousands (Spanish), not 1,20 €.
const AMOUNT = /(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?![\d])/;
export function amountCents(text) {
  const m = normalise(text).match(AMOUNT);
  if (!m) return null;
  const v = /^\d{1,3}(?:\.\d{3})+/.test(m[1]) ? m[1].replace(/\./g, "") : m[1];
  return toCents(v);
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

export function parse(input, now = new Date()) {
  const text = normalise(input);
  if (!text) return { kind: "unknown" };
  if (CRISIS.some((p) => text.includes(p))) return { kind: "crisis" };
  if (LOW_MOOD.some((p) => text.includes(p))) return { kind: "lowMood" };
  const original = String(input).trim();
  // WEB-50: tasks — «tarea: renovar el dni», «añade tarea …», and short «tengo
  // que …» / «hay que …» (not «tengo que contarte algo»: that is conversation).
  const task = original.match(/^(?:(?:apunta|anota|añade|agrega|nueva|pon)(?:me)?\s+(?:una\s+)?tarea|tarea|pendiente|(?:apunta|anota)(?:me)?\s+que\s+(?:tengo|hay)\s+que)\s*[:,.\-]?\s+(.+)$/i)
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
  // WEB-51: the day and the time can be anywhere: «recuérdame el viernes a las
  // 10 llamar al banco», «recuérdame llamar a mamá mañana a las 5 y media»,
  // «recuérdame esta tarde llamar a Pedro» (18:00), «esta noche» (21:00).
  const rb = original.replace(/\s+/g, " ").match(new RegExp(`^${VERB}\\s+(.+)$`, "i"));
  if (rb) {
    let body = rb[1];
    const cut = (frag) => { if (!frag) return; const i = normalise(body).indexOf(frag); if (i >= 0) body = `${body.slice(0, i)} ${body.slice(i + frag.length)}`.replace(/\s+/g, " ").trim(); };
    const tm = timeIn(body);
    const fd = futureDay(body, now);
    const nb = normalise(body);
    const part = /\besta tarde\b/.test(nb) ? [18, 0] : /\besta noche\b/.test(nb) ? [21, 0] : /\bpor la manana\b/.test(nb) ? [9, 0] : null;
    if (tm || part) {
      cut(tm?.match); if (fd) cut(fd.match.replace("_am_", "")); cut(part ? (nb.match(/\b(esta tarde|esta noche|por la manana)\b/) ?? [])[0] : null);
      const what = body.replace(/^(?:que|de|para)\s+/i, "").replace(/^[\s,.]+|[\s,.]+$/g, "").trim();
      const [h, mm] = tm ? [tm.h, tm.m] : part;
      if (what) {
        const today = dayKeyOf(now), tomorrow = dayKeyOf(addDays(now, 1));
        const out = { kind: "reminder", text: what, tomorrow: fd?.day === tomorrow, time: hm(h, mm) };
        if (fd && fd.day !== today && fd.day !== tomorrow) out.day = fd.day;
        return out;
      }
    }
  }
  // WEB-50: «¿cuánto llevo gastado este mes?», «¿cuánto gasté en comida?»
  if (/^(?:cuanto|que) (?:llevo gastado|he gastado|gaste|me he gastado|llevo)(?: este mes| en| de|$)/.test(text.replace(/^[¿\s]+/, ""))) {
    return { kind: "spendQuery", category: categoryFromText(text.replace(/[¿?¡!.,]/g, " ").replace(/\b(cuanto|llevo|gastado|he|gaste|me|este|mes|en|de)\b/g, " ")) };
  }
  // WEB-51: income — «cobré 200», «me han pagado la nómina 1450», «ingresé 50 de bizum»
  const inc = original.match(/^(?:hoy\s+|ayer\s+)?(?:cobr[eé]|he cobrado|me (?:han )?pagado|me pagaron|ingres[eé]|me (?:han )?ingresado|me ingresaron)(?=\s|$)\s*(.*)$/i); // (?=\s): \b does not work after «é»
  if (inc) {
    const cents = amountCents(inc[1]);
    if (cents) {
      const concept = tidy(inc[1].replace(/(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d{1,7}(?:[.,]\d{1,2})?)\s*(?:€|eur\b|euros?\b)?/i, " ").replace(/^\s*(?:de|del|por|en)\s+/i, "").replace(/\s+(?:de|del|por|en)\s*$/i, "").replace(/\s+/g, " "));
      const d = dayFromText(text, now);
      return { kind: "income", cents, concept, ...(d && d !== dayKeyOf(now) ? { day: d } : {}) };
    }
  }
  // WEB-51: health — «dormí 7 horas», «peso 72,5», «he andado 8000 pasos»
  const sleep = text.match(/\b(?:dormi|he dormido|dormido)\s+(\d{1,2}(?:[.,]\d)?)\s*(?:h|horas?)\b/);
  if (sleep) return { kind: "health", metric: "SLEEP", value: Number(sleep[1].replace(",", ".")) };
  const weight = text.match(/^(?:hoy\s+)?(?:peso|pese|he pesado|me he pesado,?)\s+(\d{2,3}(?:[.,]\d{1,2})?)\s*(?:kg|kilos?)?\s*$/);
  if (weight) return { kind: "health", metric: "WEIGHT", value: Number(weight[1].replace(",", ".")) };
  const steps = text.match(/(?:^|\s)(\d{3,6})\s*pasos\b/);
  if (steps) return { kind: "health", metric: "STEPS", value: Number(steps[1]) };
  // WEB-51: mood — «hoy estoy bien», «me siento genial» (the low ones are above)
  const mood = text.match(/^(?:hoy\s+)?(?:estoy|me siento|me encuentro|ando)\s+(genial|muy bien|fenomenal|de lujo|contento|feliz|bien|regular|normal|mas o menos|cansado|cansada)\b/);
  // Only a short statement («hoy estoy bien»); «estoy cansado desde el lunes, ¿por qué…?» is conversation.
  if (mood && !/[?¿]/.test(original) && text.split(/\s+/).length <= 5) return { kind: "mood", value: { genial: 4, "muy bien": 4, fenomenal: 4, "de lujo": 4, contento: 4, feliz: 4, bien: 3 }[mood[1]] ?? 2 };
  // WEB-52: several in one go — «gasté 12 en café y 5 en pan», «hoy: 3 de café,
  // 12 de comida y 40 de gasolina». Each part needs its own amount.
  if ((EXPENSE.some((p) => text.includes(p)) || /^(?:hoy|ayer)\s*:/.test(text)) && (text.match(/\d+(?:[.,]\d+)*/g) ?? []).length >= 2) {
    const body = original.replace(/^[^\d]*?(?=\d)/, "");
    const parts = body.split(/\s*,\s+|\s+y\s+/i) // «45,90» is one amount: split on «, » and « y ».map((x) => x.trim()).filter(Boolean);
    const items = parts.map((part) => ({ cents: amountCents(part), merchant: tidy(part.replace(/^(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:€|eur\b|euros?\b)?\s*(?:en|de|del|al|por|para)?\s*/i, "")) }));
    if (items.length >= 2 && items.every((x) => x.cents)) {
      const d = dayFromText(text, now);
      return { kind: "expenses", items, ...(d && d !== dayKeyOf(now) ? { day: d } : {}) };
    }
  }
  if (EXPENSE.some((p) => text.includes(p)) || /^gasto\s+\d/.test(text)) {
    const cents = amountCents(text);
    if (cents) {
      // WEB-51: «ayer gasté 20 en la cena», «el lunes pagué 12 de gasolina»
      const d = dayFromText(text, now);
      const place = merchant(input.replace(/\s+(?:ayer|anteayer|hoy|el (?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)(?: pasado)?)\s*$/i, "")) ?? (/^gasto\s+\d/.test(text) ? tidy(input.replace(/^\s*gasto\s+\d{1,7}(?:[.,]\d{1,2})?\s*(?:€|eur\b|euros?\b)?\s*/i, "")) : null);
      return { kind: "expense", cents, merchant: place, ...(d && d !== dayKeyOf(now) ? { day: d } : {}) };
    }
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
  if (/\b(que tengo|tengo algo|agenda|mi dia|que hay)\b/.test(text) && !/\b(que tengo que (?!hacer)|agenda de contactos)/.test(text)) {
    if (/\b(esta semana|la semana|semana que viene|proximos dias)\b/.test(text)) return { kind: "agenda", day: "week" };
    const fd = futureDay(text, now);
    if (!fd || fd.day === dayKeyOf(now)) return { kind: "agenda", day: "today" };
    return fd.day === dayKeyOf(addDays(now, 1)) ? { kind: "agenda", day: "tomorrow" } : { kind: "agenda", day: fd.day };
  }
  if (text.includes("refugio")) return { kind: "refuge" };
  // Greetings and thanks are answered by MANU itself, never sent to the AI.
  const bare = text.replace(/^[¿¡\s]+/, "");
  if (/^(hola|holi|buenas|buenos dias|buenas tardes|buenas noches|hey|ey|que tal|como estas|que pasa)\b[\s!?.,]*(manu)?[\s!?.,]*$/.test(bare)) return { kind: "greeting" };
  if (/^(gracias|muchas gracias|genial|perfecto|vale|ok|okey)\b[\s!?.,]*(manu)?[\s!?.,]*$/.test(bare)) return { kind: "thanks" };
  return { kind: "unknown" };
}

// «el viernes 2 de octubre»
const dayWords = (key) => { const [y, m, d] = key.split("-").map(Number); const dt = new Date(y, m - 1, d); return `el ${["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][dt.getDay()]} ${d} de ${MONTHS[m - 1]}`; };

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
      const place = `${intent.merchant ? ` en ${intent.merchant}` : ""}${intent.day ? ` (${dayWords(intent.day)})` : ""}`;
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
      return `Apuntado: «${intent.text}» ${intent.day ? dayWords(intent.day) : intent.tomorrow ? "mañana" : "hoy"} a las ${intent.time}. Te aviso si tienes MANU abierta; para que suene siempre, añádelo al iPhone.`;
    case "expenses":
      return `Anotados ${intent.items.length} gastos${intent.day ? ` (${dayWords(intent.day)})` : ""}: ${intent.items.map((x) => `${euros(x.cents)}${x.merchant ? ` en ${x.merchant}` : ""}`).join(", ")}. Total ${euros(intent.items.reduce((s, x) => s + x.cents, 0))}.`;
    case "income":
      return `Anotado: ingreso de ${euros(intent.cents)}${intent.concept ? ` (${intent.concept})` : ""}.`;
    case "health":
      return { SLEEP: `Apuntado: has dormido ${String(intent.value).replace(".", ",")} h.`, WEIGHT: `Apuntado: ${String(intent.value).replace(".", ",")} kg.`, STEPS: `Apuntado: ${intent.value} pasos.` }[intent.metric];
    case "mood":
      return ["", "Apuntado. Si quieres hablarlo, aquí estoy.", "Apuntado: un día regular. Si puedo ayudarte con algo, dímelo.", "¡Me alegro! Lo apunto en tu ánimo.", "¡Genial! Lo apunto en tu ánimo. 🎉"][intent.value];
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
  const intent = parse(raw, now);
  if (intent.kind === "idea") return { kind: "IDEA", text: intent.text };
  if (intent.kind === "task") return { kind: "TASK", text: intent.text };
  if (intent.kind === "reminder" && intent.inMinutes) return { kind: "REMINDER", text: intent.text, at: new Date(now.getTime() + intent.inMinutes * 60000) };
  if (intent.kind === "reminder" || intent.kind === "alarm") {
    const [h, m] = intent.time.split(":").map(Number);
    let at = new Date(now); at.setHours(h, m, 0, 0);
    if (intent.day) { const [y, mo, d] = intent.day.split("-").map(Number); at = new Date(y, mo - 1, d, h, m); } // WEB-52: «el viernes a las 10»
    else if (intent.tomorrow) at.setDate(at.getDate() + 1);
    else if (at <= now) at.setDate(at.getDate() + 1);
    return { kind: "REMINDER", text: intent.kind === "alarm" ? "Alarma" : intent.text, at };
  }
  if (intent.kind === "expense") return { kind: "EXPENSE", cents: intent.cents, merchant: intent.merchant, ...(intent.day ? { day: intent.day } : {}) };
  if (intent.kind === "expenses") return { kind: "EXPENSE", cents: intent.items[0].cents, merchant: intent.items[0].merchant, ...(intent.day ? { day: intent.day } : {}) };
  // «12,50 café», «café 3€», «20 euros gasolina»: an amount with a currency, or a
  // leading number followed by words, reads as an expense.
  const NUM = "(\\d{1,3}(?:\\.\\d{3})+(?:,\\d{1,2})?|\\d{1,7}(?:[.,]\\d{1,2})?)";
  const withCurrency = raw.match(new RegExp(`${NUM}\\s*(?:€|eur\\b|euros?\\b)`, "i"));
  const leading = raw.match(new RegExp(`^${NUM}\\s+(\\D.*)$`));
  const m = withCurrency ?? leading;
  if (m) {
    const cents = amountCents(m[1]);
    const rest = raw.replace(m[0], m === leading ? m[2] : "").replace(/\s+/g, " ").replace(/^(en|de)\s+/i, "").trim();
    if (cents) return { kind: "EXPENSE", cents, merchant: rest.slice(0, 80) || null };
  }
  return { kind: "TASK", text: raw };
}
