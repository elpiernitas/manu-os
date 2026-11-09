# Capacidades de iOS para MANU OS (WEB-97)

Auditoría del 2026-11-09. Qué puede usar MANU del iPhone, por qué vía, y qué no puede. Complementa `INTEGRATIONS.md` (matriz general) y es la fuente de `web/core/capabilities.js` (el «Centro de permisos y conexiones» de Tú).

Etiquetas: **VERIFICADO** (comprobado en este repositorio o en el navegador de pruebas), **TEÓRICAMENTE_POSIBLE** (lo dicen fuentes públicas; no probado en el iPhone de Manu), **NO_VERIFICADO**, **DECIDIDO**.

> Nada de este documento está probado en Safari real ni en el iPhone 14 de Manu. Las pruebas usan Chromium con emulación de iPhone 14. Las rutas de Ajustes de iOS cambian entre versiones.

## 1. Principios (DECIDIDO)

- **Sin permisos decorativos.** Cada permiso tiene una función concreta que se puede probar. Si no hay función, no se pide.
- **En contexto.** Un permiso se pide cuando Manu toca el botón de la función, nunca al abrir la app. Leer el estado no muestra ningún aviso de iOS (`probe()` no pide nada; hay una prueba).
- **Mínimos datos.** Por ejemplo, la ubicación se redondea a 0,1° (unos 10 km) antes de usarla o guardarla.
- **Revocable.** Cada entrada dice dónde se quita.
- **MANU solo habla con Manu.** Nada de lo que hay aquí escribe, llama ni manda nada a otras personas. Compartir lo hace siempre Manu, con la hoja de iOS.
- **Sin rastreo publicitario.** App Tracking Transparency (ATT) es el permiso de iOS para seguir al usuario entre apps de otras empresas con fines publicitarios. MANU no lo usa ni lo usará. Aprender de lo que Manu hace *dentro* de MANU (Memoria, estilo) no es rastreo: se queda en su dispositivo, lo ve y lo borra en Memoria.

## 2. Arquitectura actual (VERIFICADO en el código)

MANU es una app web (PWA) en GitHub Pages, sin servidor propio. Llega al iPhone por cuatro vías:

| Vía | Qué es | Ejemplos |
|---|---|---|
| **Web** | APIs del navegador | avisos locales, compartir, portapapeles, selector de fotos, voz (`speechSynthesis`) |
| **Atajos** | Un atajo lee el dato del iPhone y lo deja en `MANU-buzon.txt` (iCloud) o abre una URL de MANU | Salud (pasos, sueño, peso), ciudad, Apple Pay, alarmas, recordatorios, calendario, Siri |
| **Servicio externo** | Cuenta de Manu conectada por OAuth o clave | Google (Calendar, Tasks, Contactos, Drive, Gmail), Gemini, Spotify, Supabase (Tu nube), Open-Meteo |
| **App nativa** | No existe. La línea nativa está en pausa (ADR-0007, PR #7–#9) | — |

Antes de WEB-97, MANU no usaba geolocalización, sensores de movimiento, micrófono (`getUserMedia`), reconocimiento de voz web, almacenamiento persistente, globo del icono, Wake Lock, Contact Picker ni Bluetooth (VERIFICADO con `grep`).

## 3. Capacidades web en Safari/iOS (con fuentes)

| Capacidad | Estado en iOS | ¿La usa MANU? | Fuente |
|---|---|---|---|
| **Avisos web (Notification / Push)** | Solo en apps añadidas a la pantalla de inicio, iOS 16.4 o posterior. Push con servidor; Declarative Web Push desde iOS 18.4. TEÓRICAMENTE_POSIBLE | Sí, avisos **locales** con MANU abierta (ya existía). **Push con MANU cerrada: no**, haría falta un servidor (ADR-0012) | [WebKit: Badging for Home Screen Web Apps](https://webkit.org/blog/14112/badging-for-home-screen-web-apps/), [Pushpad: requisitos en iOS](https://pushpad.xyz/blog/ios-special-requirements-for-web-push-notifications), [Progressier: Declarative Web Push](https://progressier.com/pwa-capabilities/declarative-web-push) |
| **Globo del icono (`setAppBadge`)** | Solo en apps de la pantalla de inicio, iOS 16.4 o posterior. Va unido al permiso de avisos. TEÓRICAMENTE_POSIBLE | **Sí, nuevo y opcional:** el número de recordatorios que quedan hoy | [WebKit: Badging](https://webkit.org/blog/14112/badging-for-home-screen-web-apps/), [MDN: badge en el icono](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Display_badge_on_app_icon) |
| **Almacenamiento persistente (`storage.persist`)** | WebKit lo concede por heurística, por ejemplo si se abre desde la pantalla de inicio. Las apps de la pantalla de inicio no siguen el límite de 7 días de Safari. TEÓRICAMENTE_POSIBLE | **Sí, nuevo:** botón «Pedir»; se muestra la respuesta real | [WebKit: Updates to Storage Policy](https://webkit.org/?p=14403), [OSnews sobre la aclaración de WebKit](https://www.osnews.com/?p=131566) |
| **Geolocalización** | Con permiso, en primer plano. La Permissions API puede decir «prompt» hasta el primer uso. TEÓRICAMENTE_POSIBLE | **Sí, nuevo:** «Tiempo aquí», una vez y redondeada. Nunca en segundo plano | [WebKit Bugzilla 182638](https://bugs.webkit.org/show_bug.cgi?id=182638) (Permissions API) |
| **Sensores de movimiento** | `DeviceMotionEvent.requestPermission()` tras un gesto. TEÓRICAMENTE_POSIBLE | **No:** ninguna función lo necesita | [WebKit Bugzilla 269706](https://bugs.webkit.org/show_bug.cgi?id=269706), [yal.cc](https://yal.cc/js-device-motion/) |
| **Wake Lock** | Roto en apps de la pantalla de inicio hasta iOS 18.4, según fuentes secundarias. NO_VERIFICADO | **No:** ninguna función lo necesita aún | [WebKit Bugzilla 254545](https://bugs.webkit.org/show_bug.cgi?id=254545), [Progressier: Wake Lock](https://progressier.com/pwa-capabilities/screen-wake-lock) |
| **Contact Picker** | Solo tras una opción experimental de Safari, según fuentes de 2023–2024. NO_VERIFICADO en 2026 | **No:** los cumpleaños llegan por Google; además, no se toca la agenda | [W3C Contact Picker](https://www.w3.org/TR/contact-picker-1/), [Evil Martians](https://evilmartians.com/chronicles/dont-wait-lets-use-browser-contact-picker-api-now) |
| **Web Bluetooth** | No soportado. WebKit no lo considera (WONTFIX) | **No** (solo con app nativa) | [Can I use: Web Bluetooth](https://caniuse.com/web-bluetooth), [WebKit Bugzilla 101034](https://bugs.webkit.org/show_bug.cgi?id=101034) |
| **Fotos y cámara** | `<input type="file" accept="image/*">` abre el selector o la cámara de iOS sin permiso de fototeca | Sí (ya existía): solo la foto elegida | Comportamiento estándar de HTML (VERIFICADO en el código) |
| **Micrófono** | `getUserMedia` existe, pero no hay función que lo necesite | **No:** el dictado del teclado de iOS ya lo cubre | — |

## 4. Lo que solo puede hacer una app nativa

Requieren una app de iOS instalada (Swift), con su propia revisión de permisos. Ninguno es posible desde la web:

- HealthKit directo.
- EventKit (calendario y recordatorios sin atajo).
- Contactos de iCloud.
- HomeKit (luces del modo amanecer).
- CoreBluetooth.
- Red local.
- Widgets.
- App Intents (Siri nativo).
- Ubicación o tareas en segundo plano.

Hoy **Atajos cubre la mayor parte** de esto sin app nativa (sección 2). La línea nativa sigue en pausa por D-04: Mac Intel sin Xcode actual.

## 5. Lo que iOS no permite o MANU no hará

- **Leer o mandar mensajes** (WhatsApp, iMessage, llamadas). iOS no expone esos datos a terceros (NO_VERIFICADO que no exista ninguna vía). Y MANU **nunca contacta a nadie por su cuenta** (DECIDIDO).
- **Ver otras apps** o el historial de navegación. iOS no lo permite.
- **ATT.** DECIDIDO: no se usa.

## 6. Qué se ha implementado (WEB-97)

- `web/core/capabilities.js` contiene:
  - el catálogo: vía, función, qué sale del móvil, estado y dónde quitarlo;
  - `probe()`, que lee el estado real sin pedir nada;
  - `locateOnce()`, `requestPersist()`, `setBadge()` y `badgeCount()`.
- **Tú → Permisos y conexiones:**
  - todo agrupado: del iPhone, conexiones, solo nativa, nunca;
  - estado por entrada;
  - «Detalles» con los datos que salen y cómo revocar;
  - botones solo donde la web puede hacer algo de verdad.
- Pruebas:
  - `web/tests/capacidades.test.js` (10);
  - `e2e/permisos.e2e.mjs` (18 comprobaciones). En Chromium sin interfaz, el aviso de permisos se simula porque siempre responde «denied».

## 7. Pendiente de verificar en el iPhone de Manu

1. Que «Guardar sin que se borre» devuelva «Activo» abriendo MANU desde el icono.
2. Que el globo aparezca con avisos activados, y que se borre al quitarlo.
3. Que «Tiempo aquí» muestre el aviso de iOS la primera vez y el tiempo después.
4. Que el estado de ubicación se lea bien (la Permissions API de Safari puede decir «Sin pedir» aunque esté concedida).
5. Que las rutas de Ajustes coincidan con su versión de iOS.
