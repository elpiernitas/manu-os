import { normalise } from "./text.js";
import { toCents, euros } from "./money.js";

// Deterministic MANU (ADR-0009). Mirrors Sources/ManuOSCore/Assistant.swift.
const CRISIS = ["suicid", "quitarme la vida", "no quiero vivir", "matarme", "hacerme dano", "acabar con todo", "no quiero seguir viviendo"];
const LOW_MOOD = ["de bajon", "estoy mal", "me siento mal", "estoy triste", "me siento fatal", "estoy fatal", "estoy hundido", "no tengo ganas de nada"];
const EXPENSE = ["gaste", "he gastado", "pague", "he pagado", "gasto de", "registra un gasto"];
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
export function merchant(text) {
  const m = String(text).trim().match(/\d(?:[.,]\d{1,2})?\s*(?:€|eur|euros)?\s+en\s+(.+)$/i);
  if (!m) return null;
  const value = m[1].replace(/[\s.!?]+$/, "").trim().slice(0, 80);
  return value || null;
}

export function parse(input) {
  const text = normalise(input);
  if (!text) return { kind: "unknown" };
  if (CRISIS.some((p) => text.includes(p))) return { kind: "crisis" };
  if (LOW_MOOD.some((p) => text.includes(p))) return { kind: "lowMood" };
  const prefix = IDEA.find((p) => text.startsWith(p));
  if (prefix) {
    // Keep Manu's own wording: cut the same number of characters from the original.
    const original = String(input).trim();
    const idea = original.slice(prefix.length).replace(/^[\s:,.\-]+|[\s:,.\-]+$/g, "");
    if (idea) return { kind: "idea", text: idea };
  }
  if (EXPENSE.some((p) => text.includes(p))) {
    const cents = amountCents(text);
    if (cents) return { kind: "expense", cents, merchant: merchant(input) };
  }
  if ((text.includes("tiempo") && (text.includes("que tiempo") || text.includes("hace"))) || text.includes("va a llover") || text.includes("llueve")) {
    return { kind: "weather" };
  }
  if (text.includes("manana") && (text.includes("que tengo") || text.includes("agenda"))) return { kind: "agenda", day: "tomorrow" };
  if (text.includes("que tengo") || text.includes("agenda") || text.includes("mi dia")) return { kind: "agenda", day: "today" };
  if (text.includes("refugio")) return { kind: "refuge" };
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
    case "refuge":
      return "Abro el Refugio. Aquí no hay prisa.";
    default:
      return [
        "No te he entendido del todo. Puedo guardar una idea, apuntar un gasto o enseñarte tu agenda.",
        "Eso todavía no lo sé hacer sin un modelo de IA. Prueba con «apunta…», «gasté…» o «qué tengo hoy».",
      ][v];
  }
}
