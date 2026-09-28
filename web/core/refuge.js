import { normalise } from "./text.js";
import { parse, CRISIS_REPLY } from "./assistant.js";

// Refugio (docs/product/EXPERIENCE.md): no diagnosis; crisis always wins.
export const DISTRACTIONS = [
  "Poner música",
  "Salir a caminar un rato",
  "Hablar o quedar con alguien",
  "Ver una serie o vídeos",
  "Salir sin plan",
  "Hacer algo creativo",
];

export const initialRefuge = () => ({ phase: "CHOOSING", turn: 0 });

export function refugeReply(state, text) {
  if (parse(text).kind === "crisis") return { state: { ...state, phase: "HUMAN_HELP" }, reply: CRISIS_REPLY };
  if (state.phase === "HUMAN_HELP") {
    return { state, reply: "Antes de seguir: ¿has podido hablar con el 112, el 024 o con alguien de confianza? Eso es lo primero." };
  }
  let phase = state.phase;
  const t = normalise(text);
  if (phase === "CHOOSING") {
    if (t.includes("entender") || t.includes("por que")) phase = "UNDERSTAND";
    else if (t.includes("solucion") || t.includes("arreglar") || t.includes("resolver")) phase = "SOLVE";
    else if (t.includes("distraer") || t.includes("desconectar") || t.includes("cambiar de aire")) phase = "CHANGE_OF_AIR";
    else return { state, reply: "¿Qué te vendría mejor ahora: entender por qué estás así, buscar una solución o cambiar de aire?" };
  }
  const turn = state.turn + 1;
  const pick = (list) => list[(turn - 1) % list.length];
  let reply;
  if (phase === "UNDERSTAND") {
    reply = pick([
      "Vale. ¿Desde cuándo lo notas y qué ha pasado justo antes?",
      "¿Hay alguna persona o situación que tenga que ver con esto?",
      "Si tuvieras que ponerle nombre a lo que sientes, ¿cuál sería?",
    ]);
  } else if (phase === "SOLVE") {
    reply = pick([
      "Vamos a lo práctico. ¿Cuál es la parte que más te pesa ahora mismo?",
      "¿Qué es lo más pequeño que podrías hacer hoy para que pese un poco menos?",
      "¿Quieres que lo apunte como tarea para no tener que acordarte?",
    ]);
  } else {
    reply = `Propuesta: ${pick(DISTRACTIONS).toLowerCase()}. Si no te encaja, te propongo otra.`;
  }
  return { state: { phase, turn }, reply };
}
