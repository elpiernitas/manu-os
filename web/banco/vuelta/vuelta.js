// Callback page logic (script-src 'self'). Runs once, before anything else on the page.
import { parseCallback, judge } from "../../core/bankcallback.js";

const search = location.search;
// 1) The code leaves the address bar and the history entry at once.
history.replaceState(null, "", location.pathname);
const cb = parseCallback(search);
let stored = null;
try { stored = JSON.parse(localStorage.getItem("manuos.bank.state") || "null"); } catch {}
const r = judge(cb, stored);
// 2) The state is single-use whatever happens.
if (cb.present) { try { localStorage.removeItem("manuos.bank.state"); } catch {} }
// 3) A valid code waits (only in this tab, briefly) for the secure exchange on a server.
if (r.kind === "ok") { try { sessionStorage.setItem("manuos.bank.pending", JSON.stringify(r.pending)); } catch {} }

const MSG = {
  ok: ["Autorización recibida", "El banco ha aceptado. MANU todavía no canjea el código: ese paso se hará en un servidor seguro (pendiente). El código caduca solo y no se guarda en ningún registro."],
  error: ["El banco no ha dado acceso", "No se ha compartido nada. Puedes volver a intentarlo desde MANU."],
  mismatch: ["Respuesta no reconocida", "Esta respuesta no corresponde a la autorización iniciada en este dispositivo. Por seguridad se ha descartado."],
  "unknown-state": ["Respuesta no reconocida", "Este dispositivo no inició ninguna autorización (o se abrió en otro navegador). Por seguridad se ha descartado. Empieza de nuevo desde MANU en este mismo navegador."],
  expired: ["Autorización caducada", "Pasó demasiado tiempo desde que la empezaste. Por seguridad se ha descartado."],
  invalid: ["Respuesta incompleta", "Faltan datos en la respuesta del banco. Se ha descartado."],
  empty: ["Vuelta del banco", "Esta página solo recibe la respuesta del banco al autorizar el acceso de lectura a tu cuenta."],
};
const [title, text] = MSG[r.kind];
document.getElementById("t").textContent = title;
document.getElementById("m").textContent = text;
if (r.kind === "error") { const d = document.getElementById("d"); d.textContent = `Motivo: ${r.description ?? r.error}`; d.hidden = false; }
document.body.dataset.result = r.kind;
