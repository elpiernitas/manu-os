// Centro de permisos y conexiones (WEB-97).
//
// Un catálogo honesto de lo que MANU puede usar del iPhone y de fuera, con la vía real por la
// que llega cada cosa y su estado real en este dispositivo. Reglas:
// - Ningún permiso «decorativo»: cada entrada tiene una función concreta que se puede probar.
//   Lo que no tiene función no se pide (y se dice por qué).
// - El estado sale del navegador o de los ajustes de MANU, nunca de una suposición. Si el
//   navegador no deja saberlo, se dice «no se puede saber desde la web».
// - MANU solo habla con Manu: nada aquí contacta con otras personas.
// - Nada de rastreo publicitario (ATT): MANU no lo usa ni lo usará.
// Las afirmaciones sobre iOS están en docs/integrations/IOS_CAPABILITIES.md con sus fuentes.

// Por dónde llega cada capacidad.
export const ROUTES = {
  web: { label: "Ya en la web", hint: "Funciona en MANU tal como es hoy (Safari o icono de inicio)." },
  atajos: { label: "Con Atajos", hint: "Un atajo de tu iPhone lee el dato y se lo pasa a MANU. MANU no ve nada más." },
  externa: { label: "Servicio externo", hint: "Una cuenta o API de fuera, conectada solo si tú la conectas." },
  nativa: { label: "Requiere app nativa", hint: "Solo una app de iOS instalada (Swift) puede usarlo. MANU web no." },
  no: { label: "iOS no lo permite", hint: "Ni una app nativa puede hacerlo, o MANU ha decidido no hacerlo nunca." },
};

// Estados que se muestran. «manual» = lo marca Manu (MANU no puede comprobarlo por sí mismo).
export const STATES = {
  on: "Activo",
  off: "Desactivado",
  ask: "Sin pedir",
  denied: "Bloqueado",
  manual: "Lo marcas tú",
  pending: "Pendiente",
  unavailable: "No disponible aquí",
  unknown: "No se puede saber",
  never: "Nunca",
};

// Badge: reminders still to do today or overdue. Count only, never their text.
export function badgeCount(reminders = [], now = new Date()) {
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  return reminders.filter((r) => r && !r.done && Number.isFinite(Date.parse(r.at)) && Date.parse(r.at) <= end.getTime()).length;
}

// Coordinates are only used for the weather: one decimal (≈ 11 km in latitude) is enough
// and says little about where exactly Manu is.
export const roundCoord = (x) => (Number.isFinite(x) ? Math.round(x * 10) / 10 : null);

/**
 * Reads the real state of the web capabilities in this browser. Never asks for anything:
 * no prompt is shown by calling this. Each field is null when the browser does not tell.
 */
export async function probe(env = globalThis) {
  const nav = env.navigator ?? {};
  const out = {
    installed: Boolean(env.matchMedia?.("(display-mode: standalone)")?.matches || nav.standalone),
    notification: !("Notification" in env) || !nav.serviceWorker ? "unsupported" : env.Notification.permission,
    persisted: null,
    persistSupported: typeof nav.storage?.persist === "function",
    estimate: null,
    geo: "geolocation" in nav ? null : "unsupported",
    badgeSupported: typeof nav.setAppBadge === "function",
    shareSupported: typeof nav.share === "function",
    speechSupported: "speechSynthesis" in env,
    bluetooth: "bluetooth" in nav,
    contactPicker: Boolean(nav.contacts && typeof nav.contacts.select === "function"),
    push: "PushManager" in env && Boolean(nav.serviceWorker),
  };
  try { if (typeof nav.storage?.persisted === "function") out.persisted = await nav.storage.persisted(); } catch {}
  try { if (typeof nav.storage?.estimate === "function") { const e = await nav.storage.estimate(); out.estimate = { usage: e.usage ?? null, quota: e.quota ?? null }; } } catch {}
  // The Permissions API exists in recent Safari, but it may say «prompt» until the page has
  // used geolocation once (reported in WebKit's bug tracker; NO_VERIFICADO on Manu's iPhone). So «prompt» means «sin pedir o no se sabe».
  if (out.geo === null) {
    try { out.geo = (await nav.permissions?.query?.({ name: "geolocation" }))?.state ?? null; } catch { out.geo = null; }
  }
  return out;
}

/**
 * One-shot location for «el tiempo donde estás». Only on Manu's tap (it shows the iOS prompt
 * the first time), never in the background, never stored with full precision.
 */
export function locateOnce(env = globalThis, { timeout = 10000 } = {}) {
  const geo = env.navigator?.geolocation;
  if (!geo) return Promise.reject(new Error("Este navegador no da la ubicación."));
  return new Promise((resolve, reject) => {
    geo.getCurrentPosition(
      (p) => resolve({ latitude: roundCoord(p.coords.latitude), longitude: roundCoord(p.coords.longitude) }),
      (e) => reject(new Error(e?.code === 1 ? "Ubicación denegada. Puedes permitirla en Ajustes → Privacidad y seguridad → Localización." : "No he podido saber dónde estás ahora.")),
      { enableHighAccuracy: false, maximumAge: 15 * 60000, timeout },
    );
  });
}

// Asks the browser not to evict MANU's storage. WebKit decides by heuristics (e.g. whether
// MANU is opened from the home screen): the answer is what we show, never assumed.
export async function requestPersist(env = globalThis) {
  const s = env.navigator?.storage;
  if (typeof s?.persist !== "function") return null;
  try { return Boolean(await s.persist()); } catch { return false; }
}

// Sets or clears the app icon badge. Returns false when it could not.
export async function setBadge(n, env = globalThis) {
  const nav = env.navigator ?? {};
  if (typeof nav.setAppBadge !== "function") return false;
  try { if (n > 0) await nav.setAppBadge(n); else await (nav.clearAppBadge ? nav.clearAppBadge() : nav.setAppBadge(0)); return true; } catch { return false; }
}

const DENIED_NOTIF = "Ajustes → Notificaciones → MANU";

/**
 * The catalog. `ctx` is { probe, settings, google, ai, spotify, nube, shortcutsDone, style }.
 * Each item: { id, group, route, title, what, data, state, detail, action?, settings }.
 *  - what: the concrete function it enables
 *  - data: what leaves the device (or «nada»)
 *  - settings: where to revoke it
 *  - action: { act, label } a button MANU can offer (only for things the web can really do)
 */
export function catalog(ctx = {}) {
  const p = ctx.probe ?? {};
  const s = ctx.settings ?? {};
  const g = ctx.google ?? {};
  const done = ctx.shortcutsDone ?? {};
  const items = [];
  const add = (x) => items.push(x);
  const sc = (id) => (done[id] ? "manual" : "pending");
  const scDetail = (id) => (done[id] ? "Marcado como creado por ti (MANU no puede ver tus atajos)." : "Atajo aún sin crear.");

  // ---------- Ya en la web ----------
  const n = p.notification;
  add({ id: "notificaciones", group: "iphone", route: "web", title: "Avisos", what: "Avisos de fichar, de la noche y de tus recordatorios mientras MANU está abierta.", data: "Nada: los avisos se crean en el propio iPhone.",
    state: n === "granted" ? "on" : n === "denied" ? "denied" : n === "default" ? "ask" : "unavailable",
    detail: n === "unsupported" ? (p.installed ? "Este dispositivo no permite avisos web." : "Solo desde el icono de la pantalla de inicio (iOS 16.4 o posterior).") : n === "denied" ? `Bloqueados. Se cambian en ${DENIED_NOTIF}.` : "Con MANU cerrada no suenan: para eso están los atajos (no hay servidor de avisos).",
    action: n === "default" ? { act: "notify-on", label: "Activar" } : n === "granted" ? { act: "notify-test", label: "Probar" } : null, settings: DENIED_NOTIF });
  add({ id: "almacenamiento", group: "iphone", route: "web", title: "Guardar sin que se borre", what: "Pedir al iPhone que no borre los datos de MANU si falta espacio.", data: "Nada.",
    state: p.persisted === true ? "on" : !p.persistSupported ? "unavailable" : p.persisted === false ? "off" : "unknown",
    detail: p.persisted === true ? "El iPhone ha aceptado guardarlos de forma persistente." : !p.persistSupported ? "Este navegador no deja pedirlo." : "Lo decide iOS (suele aceptarlo si abres MANU desde el icono). Aun así, haz copias.",
    action: p.persistSupported && p.persisted !== true ? { act: "cap-persist", label: "Pedir" } : null, settings: "Se quita al borrar los datos de MANU (Tú → Tus datos)." });
  add({ id: "ubicacion", group: "iphone", route: "web", title: "Ubicación puntual", what: "«El tiempo donde estoy»: una sola vez, cuando lo tocas. Nunca en segundo plano.", data: "Tu posición redondeada (≈ 10 km) va a Open-Meteo para pedir el tiempo. No se guarda la exacta.",
    state: p.geo === "granted" ? "on" : p.geo === "denied" ? "denied" : p.geo === "unsupported" ? "unavailable" : "ask",
    detail: p.geo === "denied" ? "Bloqueada. Se cambia en Ajustes → Privacidad y seguridad → Localización." : "iOS te pregunta la primera vez. Para saber dónde has estado, mejor el atajo «MANU Lugar» (solo ciudad).",
    action: p.geo !== "unsupported" && p.geo !== "denied" ? { act: "cap-here", label: "Tiempo aquí" } : null, settings: "Ajustes → Privacidad y seguridad → Localización" });
  add({ id: "globo", group: "iphone", route: "web", title: "Número en el icono", what: "El icono de MANU muestra cuántos recordatorios te quedan hoy (solo el número).", data: "Nada.",
    state: !p.badgeSupported ? "unavailable" : s.badge === true ? (n === "granted" ? "on" : "pending") : "off",
    detail: !p.badgeSupported ? "Solo en el icono de la pantalla de inicio (iOS 16.4 o posterior)." : n !== "granted" ? "iOS lo une al permiso de avisos: actívalos primero." : "Se actualiza mientras MANU está abierta.",
    action: p.badgeSupported ? { act: "cap-badge", label: s.badge === true ? "Quitar" : "Activar" } : null, settings: `${DENIED_NOTIF} → Globos` });
  add({ id: "fotos", group: "iphone", route: "web", title: "Fotos y cámara", what: "Adjuntar una captura, una foto o un PDF (chat, capturas, documentos, proyectos).", data: "Solo la foto que eliges, y se queda en el móvil salvo que la mandes a Gemini.",
    state: "on", detail: "Usa el selector del iPhone: MANU nunca ve tu fototeca, solo lo que eliges cada vez. No hace falta permiso.", settings: "No hay permiso que quitar." });
  add({ id: "dictado", group: "iphone", route: "web", title: "Voz", what: "Dictar con el micrófono del teclado y que MANU te lea el «Buenos días».", data: "El dictado lo hace iOS; MANU no graba audio.",
    state: p.speechSupported === false ? "unavailable" : "on", detail: "MANU no pide el micrófono: el dictado del teclado ya lo tienes. iOS solo deja hablar a MANU tras un toque.", settings: "Ajustes → General → Teclado → Dictado" });
  add({ id: "compartir", group: "iphone", route: "web", title: "Compartir y portapapeles", what: "Compartir un texto o copiar un código cuando tú pulsas el botón.", data: "Lo que eliges compartir, a quien eliges tú en la hoja de iOS.",
    state: p.shareSupported ? "on" : "unavailable", detail: "MANU nunca comparte ni manda nada por su cuenta: la hoja de iOS la abres tú y eliges tú.", settings: "No hay permiso que quitar." });

  // ---------- Con Atajos (vía buzón o URL) ----------
  add({ id: "salud", group: "iphone", route: "atajos", title: "Salud", what: "Pasos (y si quieres sueño o peso) de cada día en Tú → Salud.", data: "Solo el número del día, a un archivo de tu iCloud que MANU importa cuando tú lo pides.", state: sc("salud"), detail: scDetail("salud"), shortcut: "salud", settings: "Ajustes → Salud → Acceso a datos → Atajos" });
  add({ id: "lugar", group: "iphone", route: "atajos", title: "Dónde has estado", what: "La ciudad de cada momento, para tu diario y tus repasos.", data: "Solo el nombre de la ciudad (o la calle, si lo eliges).", state: sc("lugar"), detail: scDetail("lugar"), shortcut: "lugar", settings: "Ajustes → Privacidad y seguridad → Localización → Atajos" });
  add({ id: "llegada", group: "iphone", route: "atajos", title: "Llegar y salir del trabajo", what: "Aviso de fichar al llegar o salir.", data: "Nada: la ubicación se queda en el iPhone.", state: sc("llegada"), detail: scDetail("llegada"), shortcut: "llegada", settings: "Atajos → Automatización" });
  add({ id: "applepay", group: "iphone", route: "atajos", title: "Pagos con Apple Pay", what: "Cada pago se apunta solo como gasto.", data: "Importe y comercio, al buzón.", state: sc("applepay"), detail: scDetail("applepay"), shortcut: "applepay", settings: "Atajos → Automatización → Transacción" });
  add({ id: "alarmas", group: "iphone", route: "atajos", title: "Alarmas", what: "Poner la alarma que MANU te calcula.", data: "Nada.", state: sc("alarm"), detail: scDetail("alarm"), shortcut: "alarm", settings: "Atajos" });
  add({ id: "recordatorios", group: "iphone", route: "atajos", title: "Recordatorios del iPhone", what: "Recordatorios que suenan aunque MANU esté cerrada.", data: "El texto y la hora del recordatorio, a tu app Recordatorios.", state: sc("reminder"), detail: scDetail("reminder"), shortcut: "reminder", settings: "Ajustes → Privacidad y seguridad → Recordatorios → Atajos" });
  add({ id: "calendario", group: "iphone", route: "atajos", title: "Calendario del iPhone", what: "Traer tus eventos de hoy si no usas Google.", data: "Hora y título de los eventos de hoy, por el portapapeles.", state: sc("agenda"), detail: scDetail("agenda"), shortcut: "agenda", settings: "Ajustes → Privacidad y seguridad → Calendarios → Atajos" });
  add({ id: "siri", group: "iphone", route: "atajos", title: "Siri", what: "Dictarle algo a MANU sin mirar el móvil.", data: "Lo que dictas, al buzón.", state: done.dictado || done.siri ? "manual" : "pending", detail: done.dictado || done.siri ? "Marcado como creado por ti." : "Atajo aún sin crear.", shortcut: "dictado", settings: "Atajos" });

  // ---------- Servicios externos ----------
  const gOn = ["calendar", "tasks", "contacts", "drive", "gmail"].filter((k) => g[k]);
  add({ id: "google", group: "fuera", route: "externa", title: "Google", what: "Agenda, tareas, cumpleaños de tus contactos, copia cifrada en Drive y tu Gmail.", data: "Lo que cada servicio necesita, solo con el permiso de ese servicio.", state: gOn.length ? "on" : "off", detail: gOn.length ? `Activos: ${gOn.join(", ")}.` : "Sin conectar.", sub: "gcal", settings: "myaccount.google.com → Seguridad → Aplicaciones de terceros" });
  add({ id: "gemini", group: "fuera", route: "externa", title: "IA (Gemini)", what: "Entender lo que MANU no entiende y leer capturas.", data: "Solo la frase o captura que apruebas (por defecto, te lo enseña antes).", state: ctx.ai ? "on" : "off", detail: ctx.ai ? "Activada con tu clave." : "Sin clave.", sub: "ia", settings: "Tú → IA → Borrar clave" });
  add({ id: "spotify", group: "fuera", route: "externa", title: "Spotify", what: "Poner música en tu altavoz.", data: "Órdenes de reproducción a tu cuenta.", state: ctx.spotify ? "on" : "off", detail: ctx.spotify ? "Conectado." : "Sin conectar.", sub: "spotify", settings: "spotify.com → Cuenta → Aplicaciones" });
  add({ id: "nube", group: "fuera", route: "externa", title: "Tu nube", what: "Los mismos datos en el iPhone y el Mac.", data: `Todo MANU (salvo fotos y «Tu archivo»)${ctx.nubeBrain === false ? ", sin tu memoria ni tu estilo" : ", con tu memoria y tu estilo"}. Protegido por tu cuenta; no es cifrado de extremo a extremo.`, state: ctx.nube ? "on" : "off", detail: ctx.nube ? "Sincronizando este dispositivo." : "Solo en este dispositivo.", sub: "nube", settings: "Tú → Tu nube → Desconectar o «Vaciar mi nube»" });
  add({ id: "tiempo", group: "fuera", route: "externa", title: "El tiempo (Open-Meteo)", what: "La previsión de tus ciudades.", data: "Solo las coordenadas de la ciudad. Sin cuenta.", state: "on", detail: "Sin cuenta ni clave.", sub: "tiempo", settings: "No hay cuenta." });
  add({ id: "estilo", group: "fuera", route: "web", title: "Aprender de cómo escribes", what: "Que MANU aprenda tus expresiones y tu risa (te pregunta antes de usarlas).", data: "Nada sale: son contadores en tu dispositivo (y en Tu nube si la usas).", state: ctx.style === false ? "off" : "on", detail: ctx.style === false ? "Apagado." : "Encendido.", sub: "memoria", settings: "Tú → Memoria → Tu estilo" });
  add({ id: "banco", group: "fuera", route: "externa", title: "Banco", what: "Tus movimientos sin importar el extracto.", data: "—", state: "pending", detail: "No conectado. Pendiente de tu decisión (WEB-93).", settings: "—" });
  add({ id: "luces", group: "fuera", route: "externa", title: "Luces (modo amanecer)", what: "Que las luces suban antes de la alarma.", data: "—", state: "pending", detail: "Bloqueado hasta saber qué luces tienes (WEB-96).", settings: "—" });
  add({ id: "push", group: "fuera", route: "externa", title: "Avisos con MANU cerrada", what: "Que MANU te avise aunque no esté abierta.", data: "Necesitaría un servidor que guarde a qué hora avisarte.", state: "pending", detail: `${p.push ? "Este dispositivo admite avisos push" : p.push === false ? "Aquí no hay avisos push (en el iPhone, solo desde el icono de inicio)" : "Avisos push"}, pero hace falta un servidor que los mande: no está montado y necesita tu autorización (docs/integrations/PUSH.md). Hoy lo cubren los atajos y «Al iPhone» en cada recordatorio.`, settings: "—" });

  // ---------- Requiere app nativa ----------
  for (const [id, title, what] of [
    ["healthkit", "Salud directa (HealthKit)", "Leer pasos, sueño o entrenos sin atajo y al momento."],
    ["eventkit", "Calendario y Recordatorios directos", "Leer y crear eventos y recordatorios sin atajo."],
    ["contactos", "Contactos del iPhone", "Cumpleaños desde tus contactos de iCloud (hoy llegan por Google)."],
    ["homekit", "Casa (HomeKit)", "Encender luces o escenas directamente (modo amanecer)."],
    ["bluetooth", "Bluetooth", "Hablar con aparatos cercanos. Safari no lo permite (Web Bluetooth)."],
    ["redlocal", "Red local", "Descubrir aparatos de tu wifi. Una web no puede."],
    ["widgets", "Widgets y Siri nativo", "Widgets de pantalla de inicio o bloqueo y órdenes de Siri sin atajo."],
    ["segundoplano", "Ubicación o tareas en segundo plano", "Hacer cosas con MANU cerrada sin atajos."],
  ]) add({ id, group: "nativa", route: "nativa", title, what, data: "—", state: "unavailable", detail: "Haría falta una app de iOS instalada (con su propia revisión de permisos). No existe todavía.", settings: "—" });

  // ---------- iOS no lo permite / MANU no lo hará ----------
  add({ id: "mensajes", group: "nunca", route: "no", title: "Leer o mandar mensajes", what: "WhatsApp, iMessage, llamadas…", data: "—", state: "never", detail: "iOS no deja leerlos a ninguna app. Y MANU nunca escribe a nadie por su cuenta: solo habla contigo.", settings: "—" });
  add({ id: "att", group: "nunca", route: "no", title: "Rastreo publicitario (ATT)", what: "Seguirte entre apps y webs para anuncios.", data: "—", state: "never", detail: "MANU no lo usa ni lo usará. Aprender de lo que haces dentro de MANU no es rastreo: se queda en tu dispositivo y lo controlas en Memoria.", settings: "—" });
  add({ id: "otrasapps", group: "nunca", route: "no", title: "Ver otras apps", what: "Leer lo que haces en otras apps o tu historial.", data: "—", state: "never", detail: "iOS no lo permite. Lo que quieras compartir, se lo pasas tú (atajos, compartir, pegar).", settings: "—" });
  return items;
}

export const GROUPS = [
  ["iphone", "Del iPhone"],
  ["fuera", "Conexiones"],
  ["nativa", "Solo con una app nativa"],
  ["nunca", "No se puede o no se hará"],
];

// A short summary for the Tú list item.
export function summary(items) {
  const on = items.filter((x) => x.state === "on" || x.state === "manual").length;
  const ask = items.filter((x) => (x.state === "ask" || x.state === "pending") && (x.route === "web" || x.route === "atajos")).length;
  return `${on} activos${ask ? ` · ${ask} por activar` : ""}`;
}
