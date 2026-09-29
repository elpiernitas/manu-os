# HANDOFF

## Próximo paso vigente

1. WEB-07/08 fusionadas (PR #16). WEB-09 (movimiento) fusionada (PR #17); WEB-10 sigue el mismo flujo: Claude Code fusiona con CI en verde y `web.yml` publica. La revisión de ChatGPT es bajo petición.
2. Manu, en su dispositivo y fuera del repositorio, crea el ID de cliente OAuth de Google (Calendar, Tasks, People y Drive, cada uno activable por separado) y, si quiere, la clave gratuita de Gemini.
3. La línea nativa (PR #7, #8 y #9) sigue en pausa. D-04B y D-03 son gates futuros.

## Estado

BRAIN-00 está fusionado en `main` mediante el PR #1. BRAIN-01 está **COMPLETED Y FUSIONADO** en `main` mediante el PR #2, squash commit `a6a93e0`, tras revisión externa y revisión del orquestador.

## WEB-34 — Tu archivo: importar la exportación de ChatGPT y buscar en ella

Manu (2026-09-29): «quiero conectar mi vida entera». Autorizó exportaciones, Atajos, Spotify y YouTube, y Drive completo, con tres objetivos: perfil, preguntar lo que sea y resumen diario (ADR-0016). Esta es la primera entrega.

### Cambios

- `web/core/archive.js`:
  - `unzip`: lector ZIP propio, `stored` y `deflate-raw` con `DecompressionStream`;
  - `parseChatgpt`: sigue la rama `current_node` y quita sistema y ocultos;
  - `readChatgptExport`: acepta el `.zip` o `conversations.json`;
  - `search`: sin acentos, el título pesa el triple, fragmento alrededor del acierto;
  - `stats`.
- `web/core/archivestore.js`: IndexedDB `manuos-archive`, solo en el dispositivo.
- `web/app.js`:
  - Tú → Tu archivo: importar, resumen, buscar, ver la conversación y borrar el archivo;
  - chat: «¿qué hablé con ChatGPT de …?» y «busca en mi archivo …»;
  - «Borrar todos los datos» también borra el archivo;
  - se usa `window.confirm` y `window.prompt`, porque `confirm` está importado de `inbox.js` (QAL-026);
  - versión 34.
- ADR-0016 y threat model.

### Resultados

- `npm test`: 116/116 PASS (`web/tests/archive.test.js`: rama correcta, ZIP real con `deflate` creado en el test y búsqueda). `node --check` pasa.
- e2e34 con una exportación sintética de 42 conversaciones: 11/11. Cubre:
  - la importación del `.zip`;
  - que no queda nada en localStorage y que no hay peticiones externas al importar;
  - la búsqueda, abrir una conversación y que persiste al recargar;
  - las dos órdenes del chat y el borrado.
- El recorrido encontró que `confirm` era la función de `inbox.js` y no el diálogo del navegador. Se arregló también en el `prompt` de Gmail, por precaución.
- e2e3, e2e4 y e2e10–e2e33 en PASS, salvo las 3 expectativas antiguas de e2e18.

### NO_VERIFICADO

- Con la exportación real de Manu: el tamaño, la cuota de IndexedDB en Safari y posibles cambios de formato de OpenAI.

### Siguiente

- Preguntar lo que sea y perfil con Gemini sobre el archivo (ADR-0016).

## WEB-33 — Gmail: MANU vigila el correo y actúa

Manu (2026-09-29): quiere que MANU le diga «te llegan muchos correos de X, ¿te desuscribes?» y le avise cuando llegue la exportación de ChatGPT. Autorizó acceso total al correo (ADR-0015). El modo automático bloqueó el paso de permisos y Manu pasó a modo manual y aprobó cada paso.

### Cambios

- `web/core/gmail.js`:
  - scope `gmail.modify`;
  - `fetchSnapshot` (30 días, 200 correos, solo metadatos);
  - `summarize` (remitentes masivos, importantes sin leer, exportación de ChatGPT) y `mailSuggestions`;
  - `findSender`;
  - acciones `archive`/`unarchive`, `trash`/`untrash` (nunca borrado definitivo) y `ensureLabel`/`addLabel`/`removeLabel`.
- `web/app.js`:
  - Gmail como quinto servicio de Google, con su sincronización;
  - tarjetas de MANU en Hoy y en el chat: «Este mes te han llegado N correos de X» (baja, archivar, papelera o dejarlo) y «Te ha llegado la exportación de ChatGPT» (abrir el correo);
  - tarjeta de importantes en Hoy y la página Tú → Correo;
  - órdenes del chat: «¿de quién me llegan más correos?», «dame de baja de X», «archiva los de X», «a la papelera los de X»;
  - «Deshacer» en el chat;
  - versión 33.
- `web/core/ai.js`: funciones `correo_baja`, `correo_archivar`, `correo_papelera` y `correo_etiquetar` (12 en total); `ir_a` incluye «correo».
- `web/core/converse.js`: categoría sensible «Correo». Las elecciones anteriores de «Con todo» la incluyen.
- CSP: `connect-src` añade `https://gmail.googleapis.com`; `form-action` sigue en `'none'`.
- `sw.js`: `core/gmail.js` en la caché.
- ADR-0015 y threat model.

### Resultados

- `npm test`: 113/113 PASS (`web/tests/gmail.test.js`, 7 tests). `node --check` pasa.
- e2e33 (Chromium con Gmail simulado): 14/14. Cubre:
  - que se pide `gmail.modify` y nunca el scope total, y que solo se piden metadatos;
  - la página Correo y que el vault solo guarda el resumen;
  - las tarjetas de Hoy (exportación, remitente ruidoso e importante);
  - el chat («¿de quién…?» y «archiva los de tienda»);
  - archivar (quita INBOX), «Deshacer» (lo devuelve), etiquetar (crea y aplica), papelera (por mensaje, nunca DELETE) y la baja (abre la página del remitente).
- El recorrido detectó que la baja «one-click» por POST chocaba con la CSP (`form-action 'none'`). Se cambió a abrir la página del remitente en vez de relajar la CSP.
- e2e3, e2e4 y e2e10–e2e32 en PASS. Se actualizaron las expectativas de 5 servicios de Google y 12 acciones. Siguen las 3 expectativas antiguas de e2e18.

### NO_VERIFICADO

- Con el Gmail real de Manu. Antes hay que activar la API de Gmail en su proyecto de Google Cloud.
- Que Google le deje continuar tras el aviso de «app no verificada».

### Pendiente (otra tarea)

- Recibos y gastos desde el cuerpo de los correos.
- Resúmenes del contenido.
- Colores de etiqueta.

## WEB-32 — sin «+» y Agenda al instante

Manu (2026-09-29): «quiero quitar el +», y no quiere que Agenda «tarde en cargar para verificar que Calendar siga activado».

### Cambios

- **«+» retirado** (`index.html`, `app.js`).
  - Cada sección conserva su «Añadir»: Tareas, Recordatorios, Ideas, «Nuevo evento» y Movimientos en Dinero.
  - El chat sigue apuntando lo mismo.
  - La barra de pestañas ocupa todo el ancho (`styles.css`).
- **Agenda al instante.**
  - Esto sustituye la decisión de WEB-24. Abrir Agenda u Hoy ya no pide permiso a Google (ya no se abre la ventana de verificación): se ve lo guardado al momento.
  - Mientras el permiso de Google (alrededor de 1 hora, sin servidor) siga válido, se sincroniza sola en segundo plano, como antes.
  - Cuando caduca, el texto dice «toca «Actualizar» para traer cambios»; el botón se llama ahora «Actualizar».
- Versión 32.

### Resultados

- `npm test`: 106/106 PASS. `node --check` pasa.
- e2e32 (4 checks): sin «+», barra centrada a todo el ancho y «Añadir» de Dinero abre el gasto.
- e2e12 y e2e24 actualizados a la nueva conducta: abrir Agenda no abre ninguna ventana de Google, «Actualizar» renueva y sincroniza, y la sincronización silenciosa sigue funcionando con el permiso válido.
- e2e22 y demás recorridos que usaban «+» ahora usan los «Añadir» de cada sección. Todos en PASS, salvo las 3 expectativas antiguas de e2e18.

### NO_VERIFICADO

- En el iPhone real.

## WEB-31 — la barra sube en las páginas cortas (iPhone)

Manu (2026-09-29, capturas): «en proyecto la barra sube». En Proyectos, la barra de pestañas y el «+» aparecen unos 46 pt más arriba que en Dinero, con una franja negra debajo.

### Causa probable

Proyectos es la única pantalla más corta que el móvil (en Chromium mide 664 de alto frente a una ventana de 664; Dinero mide 1666). En la app instalada con `black-translucent`, iOS coloca un documento corto como si la pantalla midiera una barra de estado menos (47 pt en un iPhone 14). La desviación de las capturas coincide con eso. Es una deducción a partir de las capturas; no se ha reproducido en Safari.

### Cambios

- `web/styles.css`:
  - `html { min-height: calc(100% + env(safe-area-inset-top)) }`, con fondo `--bg`;
  - `.app { min-height: 100dvh }`.
  Así ninguna página es más corta que la pantalla, igual que las largas, que se ven bien.
- Versión 31.

### Resultados

- `npm test`: 106/106 PASS. `node --check` pasa.
- e2e3, e2e4 y e2e10–e2e30 en PASS, salvo las 3 expectativas antiguas de e2e18, que también fallan en `main`.

### NO_VERIFICADO

- En el iPhone real. Chromium no reproduce este comportamiento de iOS: allí `env(safe-area-inset-top)` vale 0.

## WEB-30 — zona inferior: chat, barra y pestañas

Manu (2026-09-29, captura): «y las posiciones de abajo también».

La captura muestra tres problemas:
- el contenido del chat se leía entre la barra de escribir y la de pestañas;
- el último mensaje podía quedar debajo de las barras;
- la etiqueta «MANU» estaba 3 px más baja que las demás.

### Cambios

- `web/styles.css`:
  - un degradado fijo (`body::after`) bajo las barras flotantes. Es más alto en el chat y, con el teclado abierto, se coloca justo encima del teclado;
  - el composer y la captura adjunta quedan por encima del degradado;
  - `scroll-margin-bottom` en los mensajes, para que el último siempre quede por encima de las barras;
  - la «M» de la pestaña pasa a 26 px con margen negativo, así que todas las etiquetas quedan en la misma línea.
- Versión 30.

### Resultados

- `npm test`: 106/106 PASS. `node --check` pasa.
- e2e30 (iPhone 14, 4 checks): etiquetas alineadas (antes 630 frente a 627), último mensaje por encima del composer, composer por encima de la barra sin solaparse y degradado presente.
- e2e3, e2e4 y e2e10–e2e29 en PASS, salvo las 3 expectativas antiguas de e2e18, que también fallan en `main`.

### NO_VERIFICADO

- En el iPhone real.

## WEB-29 — chat con el teclado del iPhone y caché sin conexión

Manu (2026-09-29, con capturas): «el chat se buguea un poco». Con el teclado abierto, la barra de escribir quedaba tapada por el teclado o flotando a media pantalla.

### Causa

En iOS, el teclado encoge solo el viewport visual; el layout viewport sigue a pantalla completa. Un composer `position: sticky; bottom` se ancla al layout viewport, así que quedaba detrás del teclado. Si el chat era corto, se quedaba en su sitio del flujo, a media pantalla.

### Cambios

- `web/app.js`:
  - `placeComposer` fija la variable `--kb-bottom` al borde inferior del viewport visual (`offsetTop + height`). Se recalcula al redimensionar y al desplazar el viewport visual;
  - al abrirse el teclado, el chat baja al último mensaje;
  - versión 29.
- `web/styles.css`: con `body.kb`, el composer y la captura adjunta pasan a `position: fixed` justo encima del teclado. El chat reserva sitio (`padding-bottom` y `scroll-margin-bottom`) para que el último mensaje no quede debajo.
- `web/sw.js`: faltaban 5 módulos en la caché de instalación (`converse`, `imagestore`, `links`, `projects` y `scene`). Sin ellos, la app podía no arrancar sin conexión justo tras actualizarse. `web/tests/sw-shell.test.js` impide que vuelva a pasar.

### Resultados

- `npm test`: 106/106 PASS. `node --check` pasa.
- Chromium con un viewport visual simulado como el de iOS (e2e29, 8 checks):
  - con el código anterior, el composer quedaba en y=656 bajo un teclado que empieza en y=430 (FAIL reproducido);
  - con el arreglo queda justo encima (bottom 420), sigue al viewport visual cuando se desplaza, mantiene el foco al enviar y vuelve a su sitio al cerrar el teclado.
- e2e3, e2e4 y e2e10–e2e28 en PASS. e2e18 mantiene las 3 expectativas antiguas que también fallan en `main`.

### NO_VERIFICADO

- En el iPhone real. La simulación reproduce el modelo de viewports de iOS, pero no es Safari.

## WEB-28 — «Permitir datos sensibles» en la IA

Manu (2026-09-29): «que lo sensible vaya a la IA me da igual».

### Cambios

- `web/core/ai.js`:
  - `setSensitiveOk` y `mayGo` gobiernan todos los envíos: `ask`, `askWithActions` por defecto, el historial y `systemPrompt`;
  - la nueva categoría `crisis` (suicidio, morir, Refugio…) y `secret` nunca se permiten (`NEVER`);
  - «morir» y «refugio» salen de ánimo.
- `web/core/projects.js`: la pregunta y las fuentes usan `mayGo`.
- `web/core/converse.js`: `allowedToSend` bloquea siempre `NEVER`.
- `web/core/assistant.js`: «quiero morir» y «ganas de morir» se detectan ya como crisis. Antes no abrían la ayuda.
- `web/app.js`:
  - interruptor «Permitir datos sensibles» en Tú → IA; «Activar con todo» también lo activa;
  - con el interruptor activo, el modo conversación deja pasar mensajes sensibles aunque la categoría de contexto no esté marcada. El contexto sigue siendo solo lo marcado;
  - versión 28.
- Enmienda WEB-28 de ADR-0013, fila del threat model y QAL-023.

### Resultados

- `npm test`: 105/105 PASS. `node --check` pasa.
- Chromium con Gemini simulado: 10 checks en PASS. Cubren que el interruptor esté desactivado por defecto; que sin él no se ofrece lo sensible; que «Activar con todo» lo activa; que un mensaje de salud y dinero se envía sin añadir el contexto de dinero no marcado; que un secreto no se envía; que «quiero morir» abre la ayuda y no va a Gemini; que el historial conserva lo sensible y quita el secreto y la crisis; y que al desactivarlo se vuelve a bloquear.
- e2e10–e2e27: todos en PASS. En e2e18 fallan 3 expectativas antiguas (escenas y orbe) que también fallan en `main`: quedaron desfasadas por WEB-19/20, no por este cambio.

### NO_VERIFICADO

- Comportamiento con la clave real en el iPhone.

## WEB-27 — modo conversación: MANU con Gemini integrado

Manu (2026-09-29): «quiero hablar con MANU como si fuera Gemini integrado dentro y que lo sepa todo, que lo maneje él las cosas».

### Cambios

- `web/core/ai.js`:
  - `sensitiveKinds` agrupa lo sensible en salud, dinero, ánimo y secreto (`isSensitive` no cambia);
  - `askWithActions` acepta `permit`;
  - nueva función `completar_tarea`; ya hay 8 funciones.
- `web/core/converse.js`:
  - `CONTEXT_CATEGORIES`, `BASIC_CONTEXT` y `FULL_CONTEXT`;
  - `allowedToSend` (lo secreto nunca), `buildContext` (texto breve por categoría) y `buildConversationPayload` (instrucción con el contexto, historial filtrado de 10 turnos y funciones);
  - `AUTO_SAFE`.
- `web/app.js`:
  - en modo conversación, `say` envía a Gemini lo que MANU no resuelve sola, incluidas las frases de más de 8 palabras. Las órdenes cortas siguen siendo locales, y la crisis y el Refugio también;
  - `converse` envía la conversación; `lifeSnapshot` recoge los datos para el contexto;
  - con acciones sin preguntar, las seguras se ejecutan y muestran «✓ … Deshacer» (`undoCall`);
  - `completar_tarea` busca la tarea por su texto;
  - hay tarjeta del modo en Tú → IA (activar, categorías con 🔒 en las sensibles, acciones sin preguntar) e invitación en el chat; el subtítulo pasa a «Gemini integrado · conversación»;
  - en modo conversación, «qué tengo hoy» ya no te saca a Agenda;
  - versión 27.
- Enmienda WEB-27 de ADR-0013 y threat model.

### Resultados

- `npm test`: 104/104 PASS (`web/tests/converse.test.js`). `node --check` pasa.
- Chromium con Gemini simulado: 14 checks en PASS. Cubren la invitación; el modo básico; el envío directo sin propuesta; que el contexto trae las tareas y no el dinero; que recuerda la conversación; que una pregunta de dinero no se envía en el modo básico y se explica el motivo; que un secreto nunca se envía; que con dinero permitido va el contexto de dinero; que completa y crea tareas solo, mientras el gasto pide confirmación; y que «Deshacer» reabre la tarea. Todos los recorridos anteriores en PASS.

### NO_VERIFICADO

- Con la clave real de Manu: la calidad de las respuestas y el consumo del cupo gratuito, porque cada mensaje es una llamada.

## WEB-26 — chat más claro y teclado

Capturas de Manu (2026-09-29, aún con una versión antigua en caché):
- «hola» acababa en una propuesta de Gemini que mostraba un JSON técnico;
- con el teclado abierto, la barra de pestañas y el «+» flotaban sobre el chat.
Las capturas confirman además que su clave de Gemini ya funciona, porque aparece «Enviar a Gemini».

### Cambios

- `web/core/assistant.js`: los saludos («hola», «buenas», «¿qué tal?»…) y los agradecimientos los responde MANU sin IA.
- `web/app.js`:
  - `localAnswer` responde «qué tengo hoy/mañana» con los eventos y recordatorios reales, y «qué tiempo hace» con el tiempo cargado. Las respuestas antiguas decían, en falso, que no podía leerlos;
  - la propuesta de Gemini se explica en palabras normales («Se enviará a Google solo tu frase: «…»») y el JSON queda en «Ver detalles técnicos»;
  - `keyboardMode`: con el teclado abierto se ocultan la barra y el «+», y el campo de escribir baja justo encima del teclado;
  - versión 26.

### Resultados

- `npm test`: 100/100 PASS. `node --check` pasa en todos los archivos.
- Chromium: 6 checks en PASS; todos los recorridos anteriores en PASS.

## WEB-25 — proyectos tipo NotebookLM y capturas en el chat

Manu (2026-09-29): «quiero que a la IA (Gemini) MANU pueda adjuntarle capturas de pantalla para que las lea, y quiero otro icono de proyectos como si fuera Google NotebookLM».

### Cambios

- `web/core/projects.js`:
  - `newProject` y `addSource`, con límites: 40 fuentes y 20.000 caracteres por nota;
  - `buildProjectPayload`: fuentes numeradas [n], hasta 4 capturas en línea y un tope total; las fuentes sensibles se excluyen, una pregunta sensible se bloquea y no se envían las funciones de acción;
  - `citations` extrae las [n] de la respuesta; `PRESETS` son Resumen, Puntos clave y Preguntas de repaso.
- `web/app.js`:
  - sexta pestaña «Proyectos» con su icono de cuaderno;
  - la lista es una cuadrícula de proyectos con emoji; la página de cada proyecto permite preguntar (con botones rápidos), ver las respuestas con las citas como fichas y avisa de las fuentes excluidas;
  - se pueden añadir fuentes de tipo nota, enlace (con el texto de TikTok o YouTube) y captura, y quitarlas o borrar el proyecto;
  - el chat de MANU tiene un 📎: vista previa, aviso y botón «Enviar a Gemini». Reutiliza `shareToAi`, que ahora acepta `{ note, link, image }`;
  - versión 25.
- `web/core/storage.js`: `projects` es una lista opcional validada.
- `web/styles.css`: 6 columnas en la barra de pestañas (etiquetas de 9,5 px) y los estilos de proyectos y del adjunto del chat.
- Enmienda WEB-25 de ADR-0013 y threat model.

### Resultados

- `npm test`: 99/99 PASS (`web/tests/projects.test.js`).
- Chromium con Gemini y TikTok simulados: 15 checks en PASS. Cubren las 6 pestañas sin que se corten las etiquetas; crear un proyecto y añadir 4 fuentes (entre ellas el texto de TikTok y una captura); que sin IA no se envía nada; una sola petición con las fuentes numeradas y la imagen; que la fuente con teléfono no se envía y se avisa; las fichas de cita; el botón «Resumen»; la captura en el chat; que el adjunto se limpia; la persistencia; y que no hay desplazamiento horizontal.
- Todos los recorridos anteriores en PASS.

### NO_VERIFICADO

- Con la clave real de Gemini y en el iPhone. La calidad de las respuestas depende de Gemini.

## WEB-24 — el calendario se actualiza al abrir Agenda u Hoy; la hoja cabe con el teclado

Capturas de Manu (2026-09-29): «quiero que el calendar se actualice siempre», con la última sincronización a la 01:10. Además, con el teclado abierto, la hoja «+» perdía su parte de arriba (el título y la ✕).

### Límites comprobados

- Sin servidor, el permiso de Google dura aproximadamente una hora y en iOS solo se renueva dentro de un toque. La dirección iCal secreta de Google Calendar no sirve: su respuesta no lleva cabeceras CORS, comprobado con curl, así que la web no puede leerla.

### Cambios

- `web/app.js`:
  - `syncOnOpen`: al tocar Agenda u Hoy, si han pasado más de 10 minutos, sincroniza en silencio si el permiso sigue vigente y, si ha caducado, lo renueva con ese mismo toque. Nunca se abre ninguna ventana de Google solo por abrir la app;
  - el interruptor «Actualizar al abrir Agenda u Hoy» en Tú → Google está activado por defecto;
  - `fitSheet` ajusta la hoja al área visible (`visualViewport`) cuando sale el teclado, y la cabecera de la hoja queda fija;
  - versión 24.

### Resultados

- `npm test`: 96/96 PASS.
- Chromium con GIS y Calendar simulados: 8 checks en PASS (al abrir la app no pasa nada; el toque en Agenda renueva y sincroniza con una ventana; no repite antes de 10 min; con el permiso vigente sincroniza sin ventana; cuando caduca, el toque lo renueva; el interruptor lo desactiva; con el área visible reducida se ven el título y la ✕).
- Todos los recorridos anteriores en PASS. El de WEB-13 se actualizó al comportamiento nuevo: ahora entrar en Agenda ya sincroniza.

### NO_VERIFICADO

- En el iPhone: si la ventana de Google aparece un instante o pide elegir la cuenta al renovar el permiso.

## WEB-23 — capturas y enlaces (TikTok, YouTube, reels)

Manu (2026-09-29): quiere añadir capturas para guardarlas como notas y para que la IA las lea, y compartir vídeos de TikTok o reels para que MANU «saque la info y la meta donde debería».

### Cambios

- `web/core/links.js`: `detectLink` (tiktok, youtube, instagram o web), `oembedUrl`, `parseOembed` y `linkInfo`. Antes de usarlos se comprobó el CORS con curl: TikTok responde `*` y YouTube devuelve el origen; Instagram pide token.
- `web/core/ai.js`: `buildImagePayload` (imagen en `inlineData` y la lista fija de funciones) y `buildLinkPayload` (texto del vídeo y funciones).
- `web/core/imagestore.js`: las capturas se guardan en IndexedDB.
- `web/app.js`:
  - en el «+», el botón «📎 Añadir captura» reduce la imagen a JPEG de 1280 px y muestra una vista previa;
  - con captura o con enlace de TikTok o YouTube aparece «✨ Que MANU lo lea y lo apunte», con el aviso de que va a Google. El resultado llega al chat como propuestas que confirmas con un toque, y lo creado lleva la captura o el enlace;
  - con Instagram, MANU explica que hace falta una captura;
  - sin IA, se guarda como nota con miniatura o «Abrir», y al tocar la miniatura se ve en grande;
  - «Borrar todo» elimina las imágenes;
  - versión 23.
- `web/index.html`: `connect-src` añade `https://www.tiktok.com` y `https://www.youtube.com`.
- Corrección de WEB-22: la hoja solo cambia de tipo sola si reconoce uno (gasto, aviso o idea), así que en Dinero escribir primero el concepto ya no la convierte en tarea (QAL-021).
- Enmienda WEB-23 de ADR-0013 y threat model.

### Resultados

- `npm test`: 96/96 PASS (`web/tests/shared.test.js`).
- Chromium con Gemini y TikTok simulados: 15 checks en PASS. Cubren la captura como nota con miniatura en IndexedDB y el visor; que no se envía nada sin IA ni antes del toque; que la imagen se envía una vez y el gasto se crea con la captura; que el texto de TikTok se lee y propone un aviso; Instagram; «Abrir»; que «Borrar todo» elimina las imágenes; y que no hay desplazamiento horizontal. También pasan todos los recorridos anteriores (de WEB-03 a WEB-22), incluido el de Drive, que destapó el fallo de WEB-22.

## WEB-22 — hoja «+» rediseñada

Manu (2026-09-29), con captura de la hoja antigua: «no me gusta esto del +». Eligió rediseñar la hoja, no quitar el botón.

### Cambios

- `web/core/assistant.js`: `quickDetect` adivina el tipo a partir de un texto libre:
  - gasto: «gasté 3,20 en café», «12,50 gasolina» o «cena 30€»;
  - aviso, con su fecha: hoy si la hora aún no ha pasado y, si no, mañana;
  - idea: «idea: …»;
  - tarea, en cualquier otro caso.
  Los números que no son dinero, como «2 kilos», siguen siendo tareas.
- `web/app.js`:
  - la hoja tiene título «Añadir» y botón ✕ (ya no hay «Cancelar»), un único campo grande, una línea que dice lo que MANU ha entendido, 4 fichas con emoji (✅ 💡 💸 🔔) y solo los campos necesarios, ya rellenados: importe grande en € o fecha y hora;
  - el botón dice la acción («Apuntar gasto», «Crear aviso»…) e Intro guarda;
  - el tipo cambia solo mientras escribes, sin perder el teclado ni el cursor;
  - si eliges una ficha a mano, o abres la hoja desde el «Añadir» de una sección, se respeta tu elección;
  - se guarda el texto limpio («sacar la basura», no la frase entera);
  - versión 22.
- `web/styles.css`: estilos `.qa-*`, con un rebote de la ficha al detectarla y «Reducir movimiento» respetado.

### Resultados

- `npm test`: 91/91 PASS (`web/tests/quick-add.test.js`).
- Chromium: 13 checks en PASS. Durante las pruebas apareció un fallo real y se corrigió: al elegir una ficha a mano, el cursor saltaba al principio y lo escrito después quedaba delante. Regresiones en PASS.

## WEB-21 — estadísticas de dinero: ingresos, nómina y ahorro

Petición de Manu (2026-09-29), con captura de Dinero: «no solo quiero tener lo gastado, quiero muchas más estadísticas, nómina, ingresado…».

### Cambios

- `web/core/bank.js`:
  - el extracto importa también los ingresos, en `vault.income` y separados de los gastos, sin duplicarlos al reimportar;
  - guarda el último saldo del archivo;
  - `incomeKind` clasifica cada ingreso como nómina, Bizum, transferencia, devolución u otros. Sabadell escribe «ABONO BIZUM»: se comprueba Bizum primero, y «abono» solo no cuenta como devolución.
- `web/core/insights.js`:
  - `markPayroll` detecta la nómina por palabra clave, o por un mismo pagador de 600 € o más en 2 meses o más. Es una inferencia, no una decisión;
  - `monthStats` calcula ingresado, gastado, ahorro y tasa, nómina y su día, la comparación con el mes anterior, la media diaria, la proyección a fin de mes, el mayor gasto, los 5 comercios principales y los ingresos por tipo;
  - `monthlySeries` da los datos de los últimos 6 meses.
- `web/core/storage.js`: `income` es una lista opcional validada (importe entero positivo y fecha); las copias antiguas siguen siendo válidas.
- `web/app.js`:
  - Dinero tiene una sección «Estadísticas»: 4 fichas (ingresado, gastado, ahorrado y nómina), el saldo en cuenta y la gráfica de ingresos frente a gastos de 6 meses;
  - la gráfica tiene un solo eje, leyenda y tabla; al tocar un mes se ven sus cifras;
  - le siguen el ritmo del mes, los comercios donde más gastas y los ingresos del mes;
  - versión 21.
- Colores de ingreso y gasto (`#24A86F` / `#4D8DFF`) validados con el validador de la skill dataviz en modo oscuro: todos los checks en PASS.

### Resultados

- `npm test`: 88/88 PASS. Tiene tests nuevos en `web/tests/money-stats.test.js`; los dos tests de importación que esperaban «ingresos ignorados» se actualizaron al nuevo comportamiento.
- Con el .xls real de Manu, en local y solo con recuentos: 368 gastos y 80 ingresos (61 Bizum, 10 devoluciones, 4 transferencias, 3 nóminas y 2 otros), y saldo del 29/09.
- Chromium con un extracto inventado: 15 checks en PASS (fichas, nómina y día, comparación, saldo, gráfica y tabla, toque en un mes, ritmo, comercios, desglose de ingresos, reimportación sin duplicados y persistencia).

### Para Manu

- Los ingresos solo llegan con el extracto del banco (el .xls de Sabadell). Hay que volver a elegirlo en Dinero: los gastos no se duplican y los ingresos se añaden.

## WEB-20 — fondos vivos en todas las pantallas

Petición de Manu (2026-09-29), con capturas de la app Tiempo del iPhone: «quiero animaciones en el fondo, algo más dinámico, y eso en todas».

### Cambios

- `web/index.html`: el fondo (`.ambient`) tiene 3 manchas de luz y una capa `#sky`.
- `web/app.js`: `body[data-screen]` indica la pantalla. `#sky` pone la escena del tiempo a pantalla completa en Hoy y en la página del tiempo, y solo se reconstruye cuando cambia la escena, así que la animación no se reinicia al repintar. La cabecera del tiempo pasa a ser parte del cielo. Versión 20.
- `web/styles.css`:
  - manchas de luz que se desplazan lentamente (26 a 41 s), con colores por pantalla: Dinero verde y dorado, Agenda azul y violeta, MANU azul y cian, Tú violeta con el tono del ánimo;
  - en Hoy y en la página del tiempo, nubes, lluvia, nieve, estrellas o sol a pantalla completa;
  - la página del tiempo tiene un cielo con degradado según el clima y tarjetas translúcidas, como la app Tiempo, y Hoy tiene una versión más oscura del mismo cielo;
  - las tarjetas son semitransparentes para que se vea el fondo;
  - con «Reducir movimiento», todo queda quieto.

### Error encontrado y corregido antes de publicar

- La primera versión marcaba la pantalla con `body[data-tab]`. El manejador de las pestañas usa `closest("[data-tab]")`, así que cualquier toque encontraba el `body` y volvía a Hoy: la página del tiempo no se abría. Se renombró a `data-screen` (QAL-020).

### Resultados

- `npm test`: 84/84 PASS.
- Chromium: 13 checks en PASS. Cubren el cielo a pantalla completa en Hoy, que las nubes y las manchas se mueven, que repintar no reinicia el cielo, el degradado de la página del tiempo, los fondos animados de Dinero, Agenda, MANU y Tú sin partículas del tiempo, «Reducir movimiento» y que no hay desplazamiento horizontal.

### NO_VERIFICADO

- El rendimiento y la batería en el iPhone real (las animaciones solo usan `transform`, sin `filter: blur` a pantalla completa).

## WEB-19 — claves de Gemini con el formato nuevo «AQ.»

Capturas de Manu (2026-09-29): AI Studio le da una clave que empieza por «AQ.», no por «AIza». MANU la rechazaba con «No veo una clave de Gemini copiada» porque solo aceptaba el formato antiguo.

### Cambios

- `web/core/ai.js`: `isGeminiKey` acepta `AIza…` y `AQ.…`. `isSensitive` bloquea cualquiera de los dos si se pega en el chat, para que nunca se ofrezca a Gemini.
- `web/app.js`:
  - usa `isGeminiKey` en «Pegar y activar» y en el campo manual;
  - el paso 3 del tutorial explica el formato nuevo y avisa de no copiar el nombre ni el número del proyecto;
  - el aviso de portapapeles explica el «Pegar» de iOS;
  - versión 19.

### Resultados

- `npm test`: 84/84 PASS (`web/tests/gemini-key.test.js`, con claves inventadas).
- Chromium: el tutorial activa una clave inventada con formato `AQ.` (Gemini simulado).

### NO_VERIFICADO

- Que la API de Gemini acepte las claves `AQ.` en la cabecera `x-goog-api-key`. MANU prueba la clave al activarla (`listModels`); si Google la rechaza, se verá «La clave de Gemini no es válida».

## WEB-18 — la bola con la M vuelve

Manu aclara el 2026-09-29 que WEB-17 interpretó mal su petición: no quiere un avatar con cara ni aspecto humano, pero sí quiere la esfera animada con la M. Se revierte el commit `18a9c7d` del PR #25 y vuelven `.orb`, `.manu-head` y sus estados de respirar, escuchar mientras Manu escribe y pensar mientras responde la IA. No se crea ninguna figura humana. Versión 18 (`manuos-v18`).

### Archivos y alcance

- El revert recupera la esfera y sus animaciones en `web/app.js` y `web/styles.css`.
- `web/app.js` pasa a versión 18 y `web/sw.js` a caché `manuos-v18`.
- `ai/HANDOFF.md`, `ai/CURRENT_TASK.md` y `ai/PROJECT_STATE.md` registran WEB-18 y conservan WEB-17 y WEB-16 como historial.
- No hay nuevas dependencias, peticiones de red, datos personales ni secretos.

### Verificación

- `cd web && npm test`: 81/81 PASS.
- `node --check` en `web/app.js`, `web/sw.js` y `web/core/*.js`: PASS.
- Comprobaciones locales equivalentes a `repository-contract`: PASS.

### Riesgos y regresiones posibles

- El cambio es visual y recupera código ya probado en WEB-16. `prefers-reduced-motion` sigue desactivando las animaciones de la esfera.

### NO_VERIFICADO

- El aspecto y las animaciones en el iPhone real.
- Los workflows remotos, hasta publicar el PR.

## WEB-17 — sin avatar en MANU

Manu (2026-09-29): «yo con avatar no, qué vergüenza, esa parte elimínala». Se quitó la esfera con la M de la pantalla MANU (HTML, CSS y los eventos «escuchando» y «pensando») por un malentendido aclarado en WEB-18. Se mantuvieron las tarjetas rápidas con emoji y el resto de WEB-16. Versión 17.

- `npm test`: 81/81 PASS.
- Chromium: sin `.orb` y con 6 tarjetas; la tarjeta rellena la frase; regresiones en PASS.

## WEB-16 — escenas vivas

Propuesta de ChatGPT que Manu pasó el 2026-09-29: una app oscura y elegante, pero con color, movimiento y humor que reaccionen a su vida. Se siguió su orden de prioridad.

### Cambios

- `web/core/scene.js` (nuevo): `weatherEmoji`, `sceneFor`, `PARTICLES` y `MONEY_EMOJI`. `CATEGORY_EMOJI` en `money.js` y `emoji` en `MOODS` (`life.js`).
- **Tiempo:**
  - emojis grandes en lugar de iconos de línea, y la temperatura cuenta desde 0;
  - la tarjeta y la cabecera del tiempo tienen una escena: sol con halo, nubes que se desplazan, lluvia (14 gotas), tormenta con relámpago, nieve, niebla y noche con estrellas;
  - el fondo de toda la app hereda el clima (`body[data-wx]`).
- **Dinero:**
  - al entrar, una lluvia breve de 💶 💸 🪙 (unos 3 s, sin repetirse);
  - el total sube desde 0 y las barras se llenan;
  - las categorías llevan emoji en las barras, los movimientos y el selector.
- **MANU:**
  - una esfera con la M que respira; va más rápido mientras escribes y gira mientras la IA piensa;
  - 6 tarjetas con emoji que empiezan la frase o la envían.
- **Ánimo:** 😣 😕 🙂 🤩, con un rebote al elegir y un tono de fondo (`body[data-mood]`).
- **Agenda:** «Lo próximo» (48 h de eventos y recordatorios en línea temporal) antes del mes. El mes se compacta cuando no tiene eventos.
- Todo el movimiento se desactiva con «Reducir movimiento». La barra inferior no cambia. Versión 16.

### Resultados

- `npm test`: 81/81 PASS (2 tests nuevos en `web/tests/scene.test.js`).
- Chromium con Open-Meteo simulado: 13 checks en PASS. Cubren las escenas de lluvia y noche, el fondo según el clima, los emojis de los 7 días, la lluvia de dinero, los emojis de categoría, la esfera y las tarjetas, el emoji y el tono del ánimo, «Lo próximo» y «Reducir movimiento» sin animaciones ni lluvia. Regresiones de WEB-03 a WEB-15 en PASS.

### NO_VERIFICADO

- El rendimiento y el aspecto en el iPhone real: los emojis de Apple se ven distintos a los de Chromium.

## WEB-15 — Spotify conectado con un toque

Manu creó con Claude en Chrome la app «MANU OS» en Spotify for Developers (2026-09-29): modo Development, redirección a la web publicada, solo Web API y un usuario, el propio Manu. El secreto no se copió.

### Cambios

- `web/app.js`:
  - `DEFAULT_SPOTIFY_CLIENT_ID` y `spClientId()`;
  - la página de Spotify tiene un solo botón «Conectar Spotify», con el altavoz y un Client ID alternativo en «Ajustes avanzados»;
  - Spotify aparece en «Puesta a punto»;
  - versión 15 (`manuos-v15`).
- Enmienda WEB-15 de ADR-0014.

### Resultados

- `npm test`: 79/79 PASS.
- Chromium: Spotify en «Puesta a punto»; la página ya no pide el Client ID; «Conectar» va a `accounts.spotify.com/authorize` con el Client ID de Manu, PKCE S256, los scopes de reproducción y sin secreto. Regresiones en PASS.

### NO_VERIFICADO

- El intercambio real de tokens y cambiar al altavoz «baño» con la cuenta de Manu en modo Development.
- En iOS, que la vuelta de Spotify llegue a la app instalada.

## WEB-14 — tutorial paso a paso para activar Gemini

Petición de Manu (2026-09-29): al pulsar «Activar» de Gemini quiere un tutorial paso a paso, con enlace a «Create API key» y con «Pegar y activar» en el mismo sitio, y que después desaparezca de su vista.

### Cambios

- `web/app.js`: la vista `gemini` (`geminiGuide`) se abre desde «Puesta a punto» y desde Tú → IA. Tiene 4 pasos:
  1. abrir `aistudio.google.com/apikey` (el paso se marca como hecho al pulsarlo);
  2. crear la clave, sin activar la facturación;
  3. copiarla;
  4. «Pegar y activar», con un campo manual de respaldo.
- Al activar la clave, el tutorial se cierra, vuelve a Tú, y la fila de «Puesta a punto» y la tarjeta de IA desaparecen. Versión 14 (`manuos-v14`).

### Resultados

- `npm test`: 79/79 PASS.
- Chromium headless con AI Studio y Gemini simulados:
  - 4 pasos; el enlace abre `https://aistudio.google.com/apikey` en una ventana nueva;
  - el paso 1 queda marcado; una clave manual inválida se rechaza;
  - al pegar una válida se cierra y vuelve a Tú sin la fila de IA, y la página de IA ya no muestra el tutorial;
  - regresiones en PASS.

### NO_VERIFICADO

- En el iPhone: cómo se ve AI Studio desde la app instalada y que funcione «Pegar» con el portapapeles de iOS. Los nombres exactos de los botones de AI Studio pueden cambiar, por eso el tutorial menciona las dos variantes.

## WEB-13 — correcciones de la revisión de ChatGPT (PR #15/#16)

Revisión pedida por Manu y devuelta el 2026-09-29 sobre `4b19d3e` y `dfb0c56`.

### Cambios

1. «Borrar todos los datos» elimina además todas las claves `manuos.*` de `localStorage` y `sessionStorage`: la clave, el modelo y el «recordar» de Gemini, y los tokens y el PKCE de Spotify. También vacía los tokens de Google en memoria (`wipeDeviceKeys`).
2. `merchantKey` usa el nombre completo limpio, no sus 4 primeras palabras. Las reglas guardadas con la clave antigua se siguen leyendo, pero ya no se escriben.
3. Las entradas categorizadas por una regla importada llevan `ruled: true` y siguen aceptando versiones nuevas de la regla. Solo la corrección de Manu es definitiva (`isConfirmed`). En Dinero se muestran como «según tus reglas».
4. Id bancario sin hash (`bank:fecha|importe|concepto|saldo|n`). Los ids antiguos (`bank-…`) solo cuentan como duplicado si el gasto guardado coincide en día, importe y concepto.
5. `pkceValid`: el estado tiene que coincidir, y la hora tiene que ser un número finito, no futura y de 15 minutos como máximo.
6. **Gobernanza:** Manu decidió el 2026-09-29 («cambia agents.md para que tú puedas decidir cuándo fusionar y cuándo no») y `AGENTS.md` y `CLAUDE.md` ya recogen la regla de fusión. HANDOFF y AGENTS.md dejan de contradecirse.

7. **Sincronización automática de Google** (petición de Manu con captura de la Agenda, 2026-09-29). Mientras MANU está abierta y el permiso sigue vigente (unos 60 min tras tocar «Sincronizar»), se resincroniza sola cada 10 minutos y al volver a la app, sin abrir nunca una ventana de Google. Cuando el permiso caduca, espera al siguiente toque. Los tokens siguen solo en memoria (ADR-0013). Sincronizar en segundo plano o con la app cerrada no es posible sin un servidor que guarde un token de refresco.

8. **Excel de ChatGPT con sus gastos** (captura de Manu, 2026-09-29: tras importar las 143 reglas, Dinero seguía a 0 € y sin nada que ver). El Excel trae además la hoja «Gastos clasificados», que MANU ignoraba.
   - `classifiedFromRows` importa esos gastos como propuestas de regla (`ruled`, `source: "CHATGPT"`), marca «revisar» cuando la hoja dice «Sí» y respeta las correcciones de Manu.
   - `dropCrossSource` empareja por día e importe, contando repeticiones, para que el extracto del banco y la hoja no se dupliquen, en cualquier orden.
   - Dinero tiene flechas de mes, salta al último mes con movimientos después de importar y muestra un resumen de la importación. Si solo hay reglas, avisa de que las reglas solas no son gastos.

9. **Configurar con pocos toques** (petición de Manu: «que solo tuviera que pulsar unos pocos botones»).
   - Tú muestra «Puesta a punto» con lo que falta, cada cosa con su botón: Google, IA, Avisos y Atajos.
   - «Conectar» de Google es un solo toque. El script de Google se precarga una vez al abrir Tú o Google, para que la ventana se abra dentro del toque (QAL-015).
   - IA: «1. Crear mi clave» abre `aistudio.google.com/apikey` y «2. Pegar y activar» lee el portapapeles, comprueba el formato `AIza…`, prueba la clave y la **recuerda en este móvil**, como dice el botón (enmienda WEB-13 de ADR-0013). Sigue fuera del vault y de las copias.
   - Una app protegida con código o Google Authenticator **no** permitiría meter claves en el código: el código de la web es público y el secreto de verificación también estaría en él. Se descartó.
10. **Gobernanza:** `AGENTS.md` y `CLAUDE.md` recogen la regla de fusión decidida por Manu. Después, el 2026-09-29 a las 00:43 UTC, un comentario de Manu en el PR #21 pidió no fusionar. Prevalece lo más restrictivo: este PR queda listo y **no se fusiona** hasta que Manu lo confirme.

### Resultados

- `npm test`: 79/79 PASS (6 tests nuevos en `web/tests/review-web06-08.test.js`).
- Con los archivos reales de Manu, en local y solo con recuentos (nada entra en el repositorio):
  - con el Excel de ChatGPT primero, 368 gastos (138 por revisar, 0 en «Otros»); al importar después el .xls de Sabadell, 0 nuevos y 368 repetidos;
  - en el orden inverso, 368 del banco y luego 0 nuevos del Excel;
  - reimportar no añade nada.
- Navegador: «Puesta a punto», pegar una clave inválida (rechazada) y una válida (activada y recordada, fuera del vault), y conectar Google con 1 script cargado y 1 ventana.
- Navegador con un Excel inventado: resumen, salto a septiembre, agosto con 75,20 €, reimportación sin duplicados.
- Chromium con reloj simulado: sin ventana ni sincronización al abrir sin permiso; la sincronización manual abre 1 ventana; nada antes de 10 min; a los 11 min trae el evento cambiado sin ventana nueva; al caducar se detiene sin abrir ventanas.
- El ejemplo de colisión de la revisión **no colisiona** en `4b19d3e` ni en `dfb0c56`: se obtienen 2 entradas y 0 duplicados. Se buscó por fuerza bruta una colisión real, que con el importador antiguo da 1 entrada y 1 «duplicado», y es la que usa el test (QAL-019).
- Navegador: tras borrar solo queda `manuos.vault` vacío, e IA muestra «Sin clave». Las regresiones de WEB-03 a WEB-12 pasan.

### Límite conocido

- Las entradas ya importadas antes de WEB-13 con una regla sin «preguntar» quedaron como `inferred: false` sin marca de procedencia. No se pueden distinguir de una corrección de Manu, así que se tratan como suyas. Solo afecta a movimientos ya importados.

## WEB-12 — IA integrada que propone acciones

Petición de Manu (2026-09-29): una IA integrada a la que ir diciéndole cosas de la app para mejorarla en el momento, o para subir sus gastos.

### Cambios

- `web/core/ai.js`:
  - `TOOLS`: lista fija de 7 funciones;
  - `actionSystem` y `buildActionPayload`: la frase, la instrucción fija con la fecha y hora, y las funciones;
  - `parseCalls` valida las propuestas y descarta lo desconocido o mal formado;
  - `issueUrl` prepara la petición de GitHub;
  - `askWithActions` aplica las mismas puertas que `ask`: consentimiento y filtro de lo sensible.
- `web/app.js`:
  - el chat enseña cada acción propuesta con «Hacer» o «Ir» y «No»; se ejecuta en local tras el toque y su estado se guarda;
  - «Mejora» abre GitHub con la petición rellena y avisa de que el repositorio es público;
  - la carga útil que se ve es la misma que se envía (se construye con la hora de la propuesta); una vez enviada, queda plegada en «Ver lo enviado»;
  - ajuste «Enviar a Gemini sin preguntar» en Tú → IA, desactivado por defecto;
  - versión 12.
- `web/styles.css`, `web/sw.js` (`manuos-v12`), `web/tests/ai-actions.test.js`, enmienda WEB-12 de ADR-0013.

### Resultados

- `npm test`: 70/70 PASS.
- Chromium headless con Gemini simulado:
  - sin envío antes de confirmar; 1 envío con las funciones y solo la frase;
  - de 3 propuestas, la función desconocida se descarta;
  - tarea creada tras «Hacer» y recordatorio descartado sin crear;
  - enlace de GitHub relleno y aviso de repositorio público;
  - navegación a Hábitos y selector de archivos en Dinero;
  - con envío automático: se envía sin toque, pero dos frases sensibles no se envían;
  - los estados persisten tras recargar.
- Regresiones e2e de WEB-03 a WEB-11 en PASS.

### NO_VERIFICADO

- La llamada de funciones con la clave real de Gemini de Manu, que aún no la ha pegado.
- En iOS: que el selector de archivos se abra desde la acción y que el enlace de GitHub abra la app o la web de GitHub.

## WEB-11 — todos los calendarios con color, eventos de varios días y acceso a WhatsApp

Capturas de Manu (2026-09-29):
- Su Google Calendar muestra eventos de varios calendarios como barras de color, entre ellos «Vacaciones…» y «Campaña…». MANU solo leía el calendario principal y mostraba puntos.
- El acceso de WhatsApp abría `wa.me/` sin número y WhatsApp respondía «No se pudo abrir este enlace».
- Las mismas capturas confirman que los enlaces universales (Google Calendar) abren la app nativa desde la web instalada, con «◀ MANU» para volver.

### Cambios

- `web/core/gcal.js`:
  - `listCalendars`: calendarios visibles con su color, con el scope de solo lectura `calendar.calendarlist.readonly`;
  - `listEvents` por calendario;
  - `groupByDay` reparte los eventos de varios días por cada día que ocupan (`end.date` exclusivo; un evento que termina a las 00:00 no pasa al día siguiente), con color, calendario y marcas first/last;
  - `mergeDays`;
  - colores saneados (`#rrggbb`).
- `web/core/google.js`: `SCOPE.calendarList`, que se pide junto a Calendar en la misma ventana.
- `web/core/hub.js`: WhatsApp con `whatsapp://`.
- `web/app.js`: el mes muestra dentro de cada día hasta 3 eventos de color con su título; los eventos de varios días se dibujan como una barra continua; la lista del día indica el calendario; el color se aplica con una variable CSS desde JS, respetando la CSP; versión 11.
- `web/styles.css`, `web/sw.js` (`manuos-v11`).

### Resultados

- `npm test`: 66/66 PASS.
- Preflight CORS de `calendarList`: permitido.
- Chromium headless (Europe/Madrid): 2 calendarios; vacaciones de 3 días como barra; 3 eventos hoy; color del calendario aplicado; estado «2 calendarios»; regresiones de WEB-03 a WEB-10 en PASS.

### NO_VERIFICADO

- El scope `calendarlist.readonly` con la cuenta real (Google volverá a pedir permiso una vez).
- `whatsapp://` en el iPhone de Manu.

## WEB-10 — calendario de mes, cobros fijos, «cuándo gastas» y contactos explicados

Prueba real de Manu con la versión 8: Google sincroniza (Calendar sí, Tasks trae su tarea, Contactos «0 nuevos»).

### Cambios

- `web/core/gcal.js`: `listEvents` paginado (hasta 10 páginas de 250) y `monthGrid` (semanas de lunes a domingo).
- `web/core/insights.js` (nuevo):
  - `detectRecurring`: cobros cada 25–35 días con importe estable ±15 %; 2 repeticiones para suscripciones, servicios, casa y finanzas, 3 para el resto; día del mes, próximo cobro y «vencido»;
  - `upcomingRecurring`;
  - `spendingPattern`: por día de la semana, por tercio del mes y por momento del día, este último solo en gastos apuntados a mano porque el banco no da la hora.
- `web/core/google.js`: `contactBirthdays` devuelve también el total leído. El estado pasa a ser «N leídos · M con cumpleaños · K nuevos», porque «0 nuevos» confundía: solo se importan los contactos con cumpleaños.
- `web/app.js`:
  - Agenda con **calendario de mes estilo Apple**: puntos por evento, hoy resaltado, día elegido, flechas y deslizamiento para cambiar de mes, animación suave y lista del día con ubicación y recordatorios;
  - la sincronización trae del mes anterior al siguiente (`vault.calendar`);
  - pegar eventos queda como opción plegada si no se usa Google;
  - Dinero con «Cobros fijos» y «Cuándo gastas»;
  - versión 10.
- `web/core/storage.js` valida `calendar`. También cambian `web/styles.css` y `web/sw.js` (`manuos-v10`).

### Decisión de privacidad

Manu pidió que su Excel (gastos y reglas) viniera «de serie» en la app. **No se incluye en el código**, porque el repositorio es público. La importación es una sola vez en su móvil, persiste en el dispositivo y en su copia cifrada de Drive.

### Resultados

- `npm test`: 64/64 PASS.
- En local, con los datos reales de Manu y solo recuentos: 3 cobros fijos (días 8, 11 y 23).
- Chromium headless, con zona Europe/Madrid: calendario (rejilla, 2 puntos hoy, lista del día, cambio de mes), estado de contactos, cobros fijos y «Cuándo gastas» en PASS; regresiones de WEB-03 a WEB-09 en PASS. Un primer fallo del test del calendario venía de que el script calculaba las fechas en UTC y el navegador estaba en Madrid pasada la medianoche; no era un fallo de la app.

### NO_VERIFICADO

- El calendario con la cuenta real de Manu.
- El deslizamiento táctil en su iPhone.

## WEB-09 — movimiento estilo iOS y detalles

Manu pidió animaciones y detalles como en el iPhone. Se aplicaron las reglas de la skill de animación: la frecuencia de uso decide si algo se anima; curvas `ease-out` en las entradas, 300 ms como máximo en la interfaz, una curva de tipo cajón para las hojas, sin `scale(0)`, transiciones y no fotogramas clave en lo que se dispara a menudo, y `prefers-reduced-motion` desde el primer momento.

### Cambios

- `web/app.js`:
  - pestañas construidas una sola vez, con una cápsula de cristal que se desliza (320 ms);
  - entrada suave al cambiar de pestaña (220 ms);
  - entrada escalonada solo en lo ocasional: primera apertura, página del tiempo y subpáginas;
  - hoja del «+» con apertura y cierre animados;
  - contadores del tiempo y del gasto del mes en la entrada de página;
  - las burbujas nuevas del chat aparecen suavemente;
  - avisos que entran y salen, uno cada vez;
  - versión 9.
- `web/styles.css`:
  - tokens `--ease-out`, `--ease-in-out` y `--ease-drawer`;
  - pulsación a `scale(.97)` y check que se dibuja;
  - iconos del tiempo con movimiento ambiental lento (sol, nubes, lluvia, luna);
  - variante de movimiento reducido sin desplazamientos;
  - los botones hechos con `label` quedan centrados.
- `web/core/weather.js`: un día con probabilidad de lluvia de al menos el 50 % muestra el icono de lluvia. Venía de la captura de Manu, que marcaba 70 % con icono de nube; tiene su regresión.
- `web/sw.js` (`manuos-v9`).

### Resultados

- `npm test`: 59/59 PASS.
- Chromium headless, con y sin movimiento reducido: la cápsula se desplaza (0,32 s, y 0 s con movimiento reducido), la hoja abre y cierra, entrada escalonada y 0 errores. Las regresiones de WEB-03 a WEB-08 pasan.

### NO_VERIFICADO

- Cómo se sienten las animaciones en el iPhone real (fluidez a 60/120 Hz y rendimiento del `backdrop-filter`).

## WEB-08 — reglas de categorías de ChatGPT, «Conectar Google» en un paso y sección de Atajos

### Contexto

Prueba real de Manu en su iPhone con la versión 5: Calendar funciona («0 hoy · 1 mañana»); Tasks y Contactos fallan con «Se cerró la ventana de Google» (QAL-015). ChatGPT generó un Excel con 152 reglas de categorías a partir del extracto de Sabadell de Manu. Ni el Excel ni sus reglas están en el repositorio: la app las importa en el dispositivo.

### Archivos cambiados

- `web/core/money.js`: taxonomía ampliada (Ocio nocturno, Tabaco, Viajes, Servicios, Finanzas, Administración, Donaciones), subcategoría, `ruleFor`, `categoryId` (nombres en español a IDs), `rulesFromRows` (hoja «Reglas MANU OS»), `applyRules` (reclasifica solo propuestas y marca «revisar» cuando «¿Preguntar?» es «Sí»). Las correcciones de Manu siempre ganan.
- `web/app.js`:
  - Dinero: «Importar reglas (Excel de ChatGPT)», filtro «Por revisar», subcategoría visible.
  - Google: ID de cliente por defecto; «Conectar Google» (Calendar, Tasks y Contactos con un gesto); `googleConsent` pide juntos los scopes activados en una ventana; `cachedToken` para no abrir ventanas durante la sincronización; GIS precargado.
  - Tú → **Atajos** con pendientes y creados, «Probar» y «Ya lo tengo».
  - Versión 8.
- `web/sw.js` (`manuos-v8`), `web/styles.css`, `web/tests/rules.test.js` y el fixture **inventado** `web/tests/fixtures-reglas-ejemplo.xlsx`.
- ADR-0013 (enmienda) y QAL-015.

### Comandos ejecutados y resultados reales

- `cd web && npm test`: 58/58 PASS.
- En local, sin subir nada, con el extracto real y las reglas reales de Manu (solo recuentos): 143 reglas importadas; de 368 gastos, **5 quedan en «Otros»** y 124 se marcan «revisar».
- Chromium headless: 8/8 PASS.
  - ID prellenado; todo desconectado al empezar.
  - **Una sola** ventana de consentimiento con los tres scopes activados, sin Drive.
  - Calendar y Tasks correctos aunque se deniegue Contactos (sin llamar a People).
  - Reglas importadas y aplicadas (subcategoría y «revisar»); el filtro «Por revisar» funciona.
  - Atajos: 4 pendientes; marcar uno lo mueve a «Creados».
- Regresiones de WEB-03, WEB-05, WEB-06 y WEB-07: PASS. Se actualizó una expectativa de WEB-03: con el ID por defecto, un ID inválido no se guarda, pero los servicios se muestran.

### NO_VERIFICADO

- Consentimiento conjunto en el iPhone real.
- Instalar atajos automáticamente: Apple no lo permite desde una web, así que se crean a mano y la app lleva la lista.

## WEB-07 — accesos por modo, Spotify en el altavoz «baño», WhatsApp y otros asistentes (ADR-0014)

### Archivos cambiados

- `web/core/spotify.js` (nuevo): PKCE S256 (verificado con el vector de la RFC 7636, apéndice B, y con Python), URL de autorización, intercambio y refresco de tokens sin secreto, `findSpeaker` sin distinguir mayúsculas ni tildes, `transferTo` con `play: false`, errores 401/403/404 explicados.
- `web/core/hub.js` (nuevo): accesos por modo (las mañanas de Oviedo, primero la ruta y ALSA; en modo Trabajo no hay música), `wa.me` con número español normalizado, «preguntar en ChatGPT/Claude».
- `web/app.js`: tarjeta «Accesos» en Hoy con «Música en el baño»; Tú → Spotify (Client ID, altavoz, conectar y desconectar, guía); vuelta del redirect PKCE con validación de `state` y caducidad de 15 minutos; teléfono opcional en Personas y «Felicitar por WhatsApp» el día del cumpleaños; «Preguntar en ChatGPT/Claude» en la propuesta de IA. Versión 7.
- `web/index.html` (CSP con `accounts.spotify.com` y `api.spotify.com`), `web/sw.js` (`manuos-v7`), `web/styles.css`, `web/tests/spotify-hub.test.js` (nuevo).
- `docs/adr/0014-spotify-and-app-hub.md`, `docs/adr/README.md`, `docs/security/THREAT_MODEL.md`.

### Comandos ejecutados y resultados reales

- `cd web && npm test`: 55/55 PASS.
- Preflight CORS hacia `accounts.spotify.com/api/token` y `api.spotify.com/v1/me/player*` con `Origin: https://elpiernitas.github.io`: permitido.
- Chromium headless con Spotify simulado: 6/6 PASS.
  - tarjeta de accesos visible;
  - ida y vuelta PKCE (`code_verifier` enviado, sin `client_secret`) y URL limpia al volver;
  - los tokens no están en el vault;
  - transferencia `PUT` a «Baño» con `play: false` y el token correcto.
- Las regresiones de WEB-03, WEB-05 y WEB-06 siguen en PASS.

### NO_VERIFICADO

- Cuenta real de Spotify (requisito de Premium y visibilidad del altavoz en Connect).
- El redirect dentro de la web instalada en iOS.
- La apertura de apps nativas desde enlaces universales.
- El prellenado `?q=` de ChatGPT y Claude.

## WEB-06 — importar el Excel de Sabadell y aprender categorías por comercio

Hecho sobre WEB-05 (PR #13). Manu subió su extracto real de Sabadell al chat. **No está en el repositorio**: solo se usó en local para ver la estructura con los valores ocultos y para contar resultados.

### Archivos cambiados

- `web/vendor/xlsx.full.min.js`: SheetJS CE 0.20.3, Apache-2.0, con licencia, origen y SHA-256 en `web/vendor/README.md`. Se carga bajo demanda. La build «mini» no lee el .xls antiguo (BIFF); comprobado.
- `web/core/bank.js`: `importStatementRows` (filas de hoja de cálculo); cabeceras de Sabadell «F. Operativa / Concepto / F. Valor / Importe / Saldo»; fechas en número de serie de Excel. Identidad de cada línea: fecha, importe, concepto, **saldo** y número de repetición, para no perder dos compras iguales del mismo día. Reimportar el mismo archivo sigue sin duplicar.
- `web/core/money.js`: coincidencia por palabras o frases completas; categorías nuevas: Compras, Bizum y transferencias, Efectivo; `merchantKey` y `learnCategory`, para que una corrección de Manu se aplique a todas las propuestas del mismo comercio y a las importaciones futuras. Las entradas ya confirmadas no se sobrescriben.
- `web/app.js` (Excel o CSV en Dinero, aprendizaje al corregir, versión 6), `web/sw.js` (`manuos-v6`).
- Tests: `web/tests/bank-xls.test.js` con el fixture **inventado** `web/tests/fixtures-sabadell-ejemplo.xls`; `web/tests/weather-bank.test.js` y `core.test.js` ampliados.

### Comandos ejecutados y resultados reales

- `cd web && npm test`: 50/50 PASS.
- Archivo real de Manu, solo recuentos y solo en local:
  - **antes**: 359 gastos, 80 ingresos ignorados, 0 filas inválidas y **9 descartadas por error como «duplicadas»**;
  - **después**: 368 gastos, 80 ingresos, 0 inválidas, 0 duplicadas;
  - reimportar el mismo archivo: 0 nuevas, 368 duplicadas;
  - «Otros» baja de 299 a 190. El resto son comercios locales, que se resuelven con el aprendizaje por comercio.
- Chromium headless: el fixture .xls se importa (2 gastos, 1 ingreso ignorado), SheetJS se carga bajo demanda y corregir un comercio aprende las dos compras. La regresión de WEB-03 y la de las rondas 1–3 de WEB-05 siguen en PASS.

### NO_VERIFICADO

- Otros bancos o formatos .xlsx reales.
- La importación de Excel en Safari de iOS.
- La divergencia con el categorizador Swift (nativo en pausa): las categorías nuevas no existen en Swift.

## WEB-05 ronda 3 — paginación de Google Tasks y People sin cierres falsos

Defecto demostrado en la ronda 3: `listOpenTasks` leía solo la primera página (100 tareas) y `planTaskSync` marcaba como hecha cualquier tarea enlazada que no apareciera en ella.

Corrección:

- `paginate()` sigue `nextPageToken` hasta agotarlo. Se detiene como incompleto ante un token repetido, más de 20 páginas o el fallo de una página posterior. Si falla la primera página, es un error, no una lista vacía.
- `planTaskSync(..., { complete })` solo infiere cierres si el listado está completo. Por defecto se considera incompleto.
- People también se pagina. `mergePeople` nunca borra a quien no aparece, así que un listado parcial es inocuo.
- La app muestra «lista incompleta: no cierro nada» cuando ocurre.
- Actualizados el próximo paso vigente del handoff (el antiguo, del PR #5, queda marcado SUPERSEDED), el cuerpo del PR #13 y QAL-014.

Comandos: `cd web && npm test` → 45/45 PASS. Regresiones:

- 150 tareas en dos páginas: la tarea enlazada `g120` de la segunda página no entra en `closedRemotely`, y sí la que no existe;
- si falla la segunda página, no se cierra nada;
- con un token en bucle, se para en 3 llamadas como mucho y no cierra nada;
- con el límite de páginas, queda incompleto;
- si falla la primera página, es un error;
- Contactos se leen en dos páginas y los ausentes se conservan.

## WEB-05 ronda 2 — esquema cerrado del sobre cifrado y estado canónico único

Defectos demostrados en la ronda 2 y corregidos:

1. `isEnvelope` aceptaba campos extra (un marcador en claro podía subirse) y `decryptBackup` usaba sin validar las iteraciones del archivo remoto. Ahora `envelopeProblem` aplica un esquema cerrado: claves exactas en cada nivel, `format` y `v` soportados, `PBKDF2`/`SHA-256`/`AES-GCM` exactos, base64 válido con sal de 16 B, IV de 12 B y texto cifrado de al menos 16 B, e iteraciones enteras entre 100 000 y 2 000 000. `saveBackup` y `decryptBackup` lo aplican antes de cualquier `fetch` o PBKDF2; `encryptBackup` rechaza iteraciones fuera de rango.
2. Estado canónico con dos semánticas. `ai/CURRENT_TASK.md` tiene ahora una sola tarea activa, y BRAIN-02-PREP queda como historial cerrado que apunta al PR #5. En `ai/PROJECT_STATE.md`, BRAIN-02-PREP figura como fusionada, BRAIN-02 como pausada y el «Siguiente gate» está actualizado. En este handoff, el bloque original de WEB-05 queda marcado como SUPERSEDED.

Comandos y resultados:

- `cd web && npm test`: 43/43 PASS. Nueva regresión: un campo extra con marcador no llega a `fetch` (0 llamadas); iteraciones fuera de rango (`1e12`, 1, 0, −5, 1,5, `"600000"`, 99 999) se rechazan en menos de 50 ms; nombres, IV, sal, versión y texto cifrado inválidos fallan; una cabecera manipulada no se descifra.

## WEB-05 ronda 1 — correcciones de la revisión del PR #13

Defectos demostrados por el orquestador y corregidos:

1. **La copia de Drive iba en claro y automática.** Ahora `web/core/crypto.js` usa AES-256-GCM con la cabecera autenticada y PBKDF2-SHA-256 con 600 000 iteraciones. La frase la elige Manu y no se guarda. `saveBackup` rechaza el texto en claro. Ya no hay subida automática: se sube y restaura a mano, con la frase.
2. **Gemini recibía mensajes automáticamente, con un filtro que no garantiza nada.** Ahora la app enseña el payload exacto y pide confirmación en cada petición (`ask` exige `confirmed: true`). Por defecto solo va la frase y una instrucción fija. `isSensitive` se amplía con los cuatro ejemplos de la revisión y queda documentado como lista de mejor esfuerzo. La clave vive en `sessionStorage` salvo que Manu active «Recordar»; ese riesgo queda documentado.
3. **Se pedían los cuatro scopes de golpe.** Ahora hay `SCOPE` por función, interruptores desconectados por defecto, un token por scope y `runServices`, que aísla las denegaciones.
4. **Estado canónico desactualizado.** Actualizados `ai/CURRENT_TASK.md` (conserva el historial de BRAIN-02-PREP), `ai/PROJECT_STATE.md`, `docs/security/THREAT_MODEL.md`, ADR-0013 y `ai/QA_LESSONS.md` (QAL-010 a QAL-013). La rama estaba creada desde el commit anterior a la fusión squash, así que el PR quedó en conflicto y sin checks (QAL-013). Rebasada sobre `main`; `web.yml` también se ejecuta en `push` a ramas `claude/**` para que el check sea recuperable.

Comandos y resultados:

- `cd web && npm test`: 42/42 PASS.
- Chromium headless con Google, Drive y Gemini simulados (script de prueba fuera del repo): 15/15 PASS.
  - Clave de Gemini solo en la sesión por defecto.
  - Sin llamada a Gemini hasta confirmar; el payload visible no lleva contexto; los cuatro ejemplos sensibles ni se ofrecen ni se envían.
  - Integraciones desconectadas por defecto; Drive pide solo `drive.appdata`.
  - La copia subida no contiene marcadores en claro.
  - En un perfil limpio, la frase incorrecta no restaura y la correcta sí; la copia restaurada no lleva la clave de Gemini.
  - 0 errores de página.
- Recorrido general: 21/21 PASS en dos ejecuciones. Una ejecución falló en «birthday soon» porque el script calculaba la fecha en UTC mientras el navegador estaba en Europe/Madrid pasada la medianoche. Corregido en el script calculando la fecha en el propio navegador. No es un fallo de la app.

## [SUPERSEDED] WEB-05 — primera versión, sustituida por las rondas 1 y 2

> **SUPERSEDED.** Este bloque describe la primera versión del PR #13, rechazada en la ronda 1. Ya **no** es el contrato vigente: no hay respaldo automático de IA (se envía solo con confirmación y el payload visible), no se pide un consentimiento con los cuatro scopes (se pide uno por función) y no hay copia en Drive automática ni en claro (es manual y cifrada). La semántica vigente está en «WEB-05 ronda 1», «WEB-05 ronda 2» y en ADR-0013. Se conserva solo como trazabilidad.


Rama `claude/magical-goodall-rf5qoo`, desde `main` (`be88f9c`).

### Archivos cambiados

- `web/core/ai.js` (nuevo): filtro `isSensitive`, elección de modelo por lista, `systemPrompt` filtrado, cuerpo de petición sin turnos sensibles, errores 429 y de clave.
- `web/core/google.js` (nuevo): scopes, plan de sincronización de Tasks en los dos sentidos, cumpleaños desde People API sin duplicados, copia en `appDataFolder` (crear o actualizar) y restauración.
- `web/app.js`: la IA en el chat solo actúa cuando no hay intención y el texto no es sensible, con etiqueta «IA»; Tú → IA (clave fuera del vault) y Tú → Google (estado por servicio, copia y restauración de Drive con confirmación en la página); la sincronización incluye Tasks, Contactos (cada 24 h) y Drive (cada 6 h).
- `web/index.html` (CSP con `tasks`, `people` y `generativelanguage`), `web/sw.js` (`manuos-v5`), `web/styles.css`, `web/tests/ai-google.test.js` (nuevo).
- `docs/adr/0013-optional-gemini-and-google-services.md`, `docs/adr/README.md`.

### Comandos ejecutados y resultados reales

- `cd web && npm test`: 40/40 PASS.
- Preflight CORS con `Origin: https://elpiernitas.github.io` hacia Calendar, Tasks, People, Drive y Gemini (con cabecera `x-goog-api-key`): permitido. Gemini con clave inválida responde 400 con CORS.
- Chromium headless con Gemini y Open-Meteo simulados: 26/26 PASS en tres ejecuciones. Comprueba que la clave se prueba y elige `gemini-2.5-flash` de la lista simulada, que la IA responde a lo no reconocido, que el mensaje del médico no sale hacia la IA, que la clave no va en la URL ni en el vault, y la regresión completa.

### NO_VERIFICADO

- Llamadas reales a Gemini, Tasks, People y Drive (sin credenciales de Manu en este entorno).
- El cupo gratuito y las condiciones actuales de Gemini.
- El consentimiento de Google en iOS.

## WEB-04 — tiempo completo, Google Calendar y hora de entrada

Rama `claude/magical-goodall-rf5qoo`, desde `main` (`9ee852d`). Tras probarlo Manu en su iPhone (2026-09-28): el tiempo carga y `shortcuts://run-shortcut` abre Atajos. Falla solo porque el atajo aún no existe.

### Archivos cambiados

- `web/core/weather.js`: previsión por horas (24 h) y 7 días, sensación térmica, humedad, viento, UV, amanecer y atardecer, iconos de noche. El consejo ya no dice «Lluvia» si la probabilidad es baja: corrige la contradicción de la captura de Manu, con test de regresión.
- `web/core/gcal.js` (nuevo): Google Calendar con el modelo de token de Google Identity Services (sin servidor), lectura de hoy y mañana, creación de eventos y detección de `Client ID`.
- `web/app.js`: pantalla del tiempo al tocar la tarjeta; tira horaria en Hoy; conexión con Google Calendar (Tú → Google Calendar) con guía; botón de sincronizar en Agenda; «Nuevo evento» en Google; los eventos reales de mañana alimentan la pregunta de la noche y la alarma; hora de entrada configurable; «+» al lado de la barra de pestañas para que no tape contenido; los enlaces con estilo de botón ya no salen subrayados.
- `web/core/storage.js` (valida `agendaTomorrow`), `web/index.html` (CSP: `accounts.google.com`, `www.googleapis.com`), `web/sw.js` (`manuos-v4`), `web/styles.css`, `web/tests/gcal.test.js` (nuevo), `web/tests/weather-bank.test.js`.

### Comandos ejecutados y resultados reales

- `cd web && npm test`: 33/33 PASS.
- `curl` a Open-Meteo con los campos ampliados: 200 (valores reales de Gijón).
- Chromium headless con Open-Meteo simulado: tarjeta del tiempo, pantalla completa con 7 días y tarjetas, validación y guardado del ID de Google, botón de sincronizar en Agenda y el resto del recorrido de WEB-03: todo PASS, 0 errores de consola.

### NO_VERIFICADO

- El inicio de sesión real con Google y la lectura y escritura en su calendario: depende de que Manu cree el ID de cliente.
- Si Safari en iOS permite la ventana de Google desde la web instalada en la pantalla de inicio.
- Los nombres exactos de los menús de Google Cloud.

## WEB-03 — rediseño Liquid Glass, tiempo, noche, alarmas, recordatorios, banco y «Tú» completo

Rama `claude/magical-goodall-rf5qoo`, encima de WEB-02 (mismo PR). Pedido por Manu el 2026-09-28: tiempo de Gijón por defecto y de Oviedo cuando trabaja allí, la pregunta de la noche, alarmas, recordatorios, Salud, Comidas, Personas, Hábitos y Liquid Glass.

### Archivos cambiados

- `web/core/weather.js`: Open-Meteo (sin clave), códigos WMO, consejo del día y adaptador `fetch` inyectable.
- `web/core/bank.js`: CSV del banco (delimitador `;`, `,` o tabulador; comillas; BOM), importes y fechas en formato español, solo gastos, deduplicación por huella.
- `web/core/night.js`: port de `NightPlanner` (ciudad y alarma), la pregunta desde las 18:00 y el enlace `shortcuts://run-shortcut`.
- `web/core/life.js`: hábitos con racha, cumpleaños, «hace tiempo que no hablas», comidas por franja y habituales, medias de salud, ánimo y recordatorios vencidos.
- `web/core/assistant.js`: intenciones `alarm` («pon una alarma a las 7:15») y `reminder` («recuérdame X mañana a las 9»); la crisis sigue ganando.
- `web/core/storage.js`: secciones opcionales nuevas, compatibles con copias antiguas, con validación de IDs duplicados entre secciones.
- `web/app.js`, `web/styles.css`, `web/index.html`: barra de pestañas flotante, botón «+», hoja modal y barra superior al hacer scroll en Liquid Glass (solo en la capa funcional, según la guía HIG), fondo por modo, «+» para tarea/idea/gasto/aviso, «Tú» con subpáginas. La CSP permite solo los dos hosts de Open-Meteo.
- `web/sw.js`: caché `manuos-v3`.
- Tests: `web/tests/weather-bank.test.js`, `web/tests/night-life.test.js`, y ampliación de `core.test.js`.

### Comandos ejecutados y resultados reales

- `cd web && npm test`: 29/29 PASS.
- `curl` a `geocoding-api.open-meteo.com` y `api.open-meteo.com`: 200 con `access-control-allow-origin: *` (2026-09-28). Coordenadas de Gijón y Oviedo sacadas de esa API.
- Chromium headless (perfil iPhone 13, Europe/Madrid), 16 comprobaciones PASS en dos ejecuciones: tarea, gasto y aviso con «+»; recordatorio con enlace a Atajos; alarma desde el chat; importación CSV y deduplicación; ánimo, hábito, persona con cumpleaños, comida y salud; persistencia tras recargar; sin scroll horizontal; 0 errores de consola.
- En el navegador del sandbox, el tiempo no carga porque el proxy intercepta TLS. No se probó la carga real del tiempo en navegador.

### Riesgos y regresiones posibles

- Los atajos «MANU Alarma» y «MANU Recordatorio» dependen de que Manu los cree con esos nombres. Los nombres de las acciones de Atajos en español no están verificados.
- La alarma supone entrada a las 09:00 porque la web no conoce el horario real.
- El CSV de cada banco es distinto: los formatos no reconocidos se rechazan con un motivo.

### NO_VERIFICADO

- El tiempo en el iPhone real.
- El esquema `shortcuts://run-shortcut` y los atajos en iOS.
- Las notificaciones de recordatorios en iOS con la app abierta o en segundo plano.
- El CSV concreto del banco de Manu.

## WEB-02 — agenda pegada, enlaces de Atajos y aviso de actualización

Rama `claude/magical-goodall-rf5qoo`, desde `main` (`e797aba`, WEB-01 ya publicada en GitHub Pages).

### Archivos cambiados

- `web/core/intake.js` (nuevo): lee `?di=` y `?eventos=`, interpreta líneas de eventos («09:30 Dentista», «10:00-11:00 Reunión», «todo el día X»), limita tamaños y quita caracteres de control; calcula el próximo evento de hoy.
- `web/core/assistant.js`: el comercio conserva la escritura original («Café Central»); la categoría sigue normalizando. **Diverge de Swift** (`IntentParser.merchant` normaliza): hay que portar el cambio al núcleo Swift.
- `web/core/storage.js`: valida el campo opcional `agenda`.
- `web/app.js`: tarjeta «Próximo» en Hoy; agenda de hoy en Agenda con formulario para pegarla; guía de Atajos en Tú; versión visible; aviso «MANU se ha actualizado»; los parámetros de URL se procesan una vez y se eliminan de la URL.
- `web/sw.js` (caché `manuos-v2`, incluye `intake.js`), `web/styles.css`, `web/tests/intake.test.js` (nuevo), `web/tests/core.test.js`.

### Comandos ejecutados y resultados reales

- `cd web && npm test`: 17/17 PASS.
- `node --check` de todos los scripts: sin errores.
- Chromium headless (perfil iPhone 13): `?di=` registra el gasto con «Café Central» y limpia la URL; tras recargar no se repite; `?eventos=` abre Agenda con los eventos; pegar eventos reemplaza la agenda de hoy; Hoy muestra el próximo evento; sin scroll horizontal; 0 errores de consola; la regresión de WEB-01 sigue pasando.

### Riesgos y regresiones posibles

- Cualquiera que te envíe un enlace `?di=` puede añadir un mensaje o un gasto a tu MANU si lo abres. Se ve en el chat y se puede borrar, pero no hay confirmación.
- La agenda pegada solo vale para el día en que se guarda.

### NO_VERIFICADO

- Los nombres exactos de las acciones de Atajos en iOS en español.
- Si abrir una URL desde Atajos entra en la web del icono o en Safari (con datos separados).
- El aviso de actualización en iOS.

## WEB-01 — app web instalable (ADR-0012)

Rama `claude/magical-goodall-rf5qoo`, desde `main` (`ff2f86a`). Decisión de Manu: sin Mac capaz de ejecutar Xcode y sin pagar el Apple Developer Program, la app nativa no se puede instalar; se añade una web instalable publicada con GitHub Pages.

### Archivos cambiados

- `web/`: `index.html`, `styles.css`, `app.js`, `sw.js`, `manifest.webmanifest`, `package.json`, `icons/` (PNG generados), `core/` (`text`, `money`, `modes`, `assistant`, `inbox`, `refuge`, `storage`, `notify`) y `tests/core.test.js`.
- `.github/workflows/web.yml`: tests en PR; despliegue a Pages solo desde `main`.
- `docs/adr/0012-installable-web-app-as-operational-path.md`, `docs/adr/README.md`, `docs/architecture/DECISIONS_AND_OPEN_ITEMS.md` (nota en D-01).

### Comandos ejecutados y resultados reales

- `cd web && npm test`: 11/11 PASS (Node 22.22.2).
- `node --check` de `app.js`, `sw.js` y `core/*.js`: sin errores.
- Prueba en Chromium headless (Playwright 1.56.1, perfil iPhone 13, servidor local): gasto por chat → Dinero y total del mes; idea → bandeja → tarea → Agenda; persistencia tras recargar; corrección de categoría; crisis con 112/024 y burbuja de seguridad; la crisis no se guarda tras recargar; *service worker* registrado; sin scroll horizontal; 0 errores de consola (la CSP no bloquea nada). El script de la prueba no se incluye en el repo.

### Riesgos y regresiones posibles

- La lógica está duplicada en Swift (`brain/02d-app-core`) y JavaScript: pueden divergir.
- `localStorage` puede perderse si Manu borra los datos de Safari; hay copia en JSON manual.
- El despliegue falla hasta que Manu haga público el repositorio y active Pages con «GitHub Actions» como fuente.

### NO_VERIFICADO

- Instalación en la pantalla de inicio y funcionamiento en el iPhone 14 real.
- Avisos web en iOS (requiere la web añadida a la pantalla de inicio, iOS 16.4 o posterior).
- Conservación a largo plazo del `localStorage` en iOS.
- Despliegue real en GitHub Pages (depende de ajustes que solo Manu puede cambiar).
- Descarga de la copia en JSON desde Safari de iOS.

## BRAIN-01 — resultado

Se implementó un Swift Package sin dependencias externas, UI, almacenamiento, red ni proveedor de IA.

### Cambios

- `Package.swift`: paquete y módulo `ManuBrainDomain`.
- `Sources/ManuBrainDomain/ManuBrainDomain.swift`:
  - UUIDv7 y timestamps ISO-8601 UTC;
  - Source, SourceItem, Fragment y SourceDeletionEvent;
  - Entity, Claim, EvidenceLink, Activity y Agent;
  - clasificaciones, estados y valores tipados;
  - validación de evidencia/confianza/modelos;
  - sustitución, detección de ciclos y resolución temporal;
  - `StrictJSON` para campos superiores desconocidos;
  - consulta honesta de disponibilidad del original.
- `Tests/ManuBrainDomainTests/KnowledgeContractTests.swift`: 12 casos obligatorios y uno adicional de ADR-0008.
- `.github/workflows/brain-01.yml`: runner `macos-26`, permisos `contents: read`, sin deploy y timeout de 15 minutos.
- ADR-0010 y actualización de los documentos de estado/tarea.

### Decisiones

- D-01: núcleo Swift compartible por iPhone y Mac.
- ADR-0008: retención explícita y ningún original descartado se presenta como disponible.
- ADR-0010: Swift Package, structs inmutables, funciones puras y cero dependencias externas.

### Verificación real

Runner: `macos-26-arm64`, macOS 26.6.2, Apple Swift 6.3.3.

Run fallido inicial: `36446223794`. Detectó que un inicializador que lanza error no satisface `RawRepresentable`; se eliminó esa conformidad sin relajar validación.

Run corregido: `36446466658` — SUCCESS.

- `swift package dump-package`: PASS.
- `swift build --build-tests`: PASS.
- `swift test --parallel`: PASS.
- Resultado: **13 tests, 1 suite, 13/13 PASS**.
- Foundation check del mismo commit: PASS.

Commits:
- `caf146c`: implementación inicial.
- `cde9fe4`: corrección de compilación.

### Riesgos

- `StrictJSON` solo protege si las entradas externas usan ese límite; `JSONDecoder` directo sigue tolerando campos desconocidos.
- El test histórico conserva ambos structs en memoria; la persistencia real pertenece a BRAIN-02.
- El runner valida macOS ARM, no el iPhone 14 ni el Mac Intel de Manu.
- No se ha medido rendimiento porque el volumen de BRAIN-01 es mínimo.

## Revisión externa (2026-09-28)

Revisión del head `1941319` por Claude Code. Detalle completo en `ai/QA_REPORT.md`.

- Reproducido 13/13 PASS con Swift 6.3.3 en Linux x86_64.
- 10 defectos demostrados con pruebas ejecutables y corregidos en esta rama, cada uno con test de regresión: creador de la Claim no comprobado, Claims de modelo visibles, sustitución que invierte o amplía la vigencia o resucita Claims rechazadas, Claims en disputa resueltas en silencio, `hasOriginal` que ignora la política de retención, aborto con IDs duplicados en la detección de ciclos, falta de `init` públicos y timestamps no UTC o imposibles aceptados.
- Archivos: `Sources/ManuBrainDomain/ManuBrainDomain.swift`, `Package.swift` (target `ManuBrainDomainPublicAPITests`), `Tests/ManuBrainDomainTests/ReviewRegressionTests.swift`, `Tests/ManuBrainDomainPublicAPITests/PublicAPITests.swift`, `.gitignore`, `ai/QA_REPORT.md`, `ai/HANDOFF.md`.
- Comandos: `swift package dump-package` PASS; `swift build --build-tests` PASS sin warnings; `swift test --parallel` **31/31 PASS en 3 suites** (Linux x86_64 en local y GitHub Actions `macos-26`, run `36451712052`).
- Observaciones no bloqueantes documentadas en `ai/QA_REPORT.md` para BRAIN-02.
- Revisión posterior del orquestador: se cerró el último hueco para que un agente `MODEL` solo pueda crear Claims `PROPOSED`; el test parametrizado cubre `ACTIVE`, `SUPERSEDED`, `CONTESTED`, `REJECTED` y `RETRACTED`. Commit `72aa272`; CI `macos-26` (run `36452298444`) **31/31 PASS en 3 suites** y Foundation check (run `36452298319`) PASS.

## BRAIN-02-PREP — resultado (PR #5, 2026-09-28)

Rama: `brain/02-preparation`. SHA revisado en esta entrega: se publica tras el commit de este cambio (ver PR #5).

### Cambios

- `docs/adr/0011-native-local-storage-and-keys.md` (nuevo): cierra D-02. SQLite del sistema tras el adaptador `LocalStore`, blobs por hash fuera de la base, `NSFileProtectionCompleteUntilFirstUserAuthentication`, DEK/KEK de ADR-0003 con Argon2id (dependencia mínima justificada) y Keychain (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`) para la clave desenvuelta, App Group para el contenedor compartido con las extensiones.
- `docs/adr/README.md`: añade ADR-0011 al índice.
- `docs/roadmap/BRAIN_02_TASK.md`: reescrito. Añade el resultado de la tarea: D-02 decidida, BRAIN-02 dividida en subfases 02a (persistencia y claves, sin Xcode, implementable en CI ya) a 02d (apps mínimas), y D-03/D-04B precisadas con el punto exacto en que necesitarán a Manu.
- `docs/roadmap/ROADMAP.md`, `docs/roadmap/BACKLOG.md`: referencian las subfases y el nuevo estado de D-02/D-03/D-04B.
- `docs/architecture/DECISIONS_AND_OPEN_ITEMS.md`: mueve D-02 a decisiones cerradas; reduce D-03 a "solo si BRAIN-02c lo demuestra necesario"; D-04B pasa a fila propia con el runner `xcode-27-xlarge` descartado por coste (no por prudencia).
- `docs/architecture/ARCHITECTURE.md`: sustituye los marcadores `(D-02)` pendientes por las decisiones concretas de ADR-0011 en las tablas de estado local, blobs y cifrado, y en la lista de capacidades de la app nativa.
- `docs/security/THREAT_MODEL.md`: la fila "extensión con acceso excesivo" referencia el diseño ya decidido del contenedor compartido; sigue `PENDIENTE` de implementación.
- `docs/security/RISK_REGISTER.md`: añade R-41 (dependencia Argon2id no nativa).
- `docs/research/SOURCES.md`: añade la sección de fuentes de D-02, incluida la limitación de que `support.apple.com` está bloqueado en este entorno y de que la lectura automática de `developer.apple.com` no pudo extraer contenido real (JavaScript); cada afirmación queda marcada `NO_VERIFICADO` cuando no se pudo confirmar contra la fuente primaria.
- `ai/DECISIONS.md`: corrige una entrada desactualizada (D-01 seguía descrita como pendiente pese a estar decidida) y añade D-02 a decisiones cerradas; añade ADR-0010 y ADR-0011 a la lista de ADR, que faltaban.
- `ai/PROJECT_STATE.md`, `ai/CURRENT_TASK.md`, `ai/HANDOFF.md`, `docs/roadmap/BACKLOG.md`: reflejan el nuevo estado.

### Decisiones tomadas por Claude Code dentro del alcance autorizado

- D-02 cerrada mediante ADR-0011 (ver arriba). Se documenta como decisión técnica reversible, no como algo que requiriera a Manu.
- La entitlement App Groups con cuenta Apple gratuita no tiene fuente verificada concluyente: se documenta como bloqueo de una subfase concreta (BRAIN-02c), no de todo D-02 ni de D-03.
- El runner `xcode-27-xlarge` queda descartado por coste (evidencia: documentación de facturación de GitHub Actions sobre runners "xlarge"), cerrando esa rama de D-04B sin necesidad de involucrar a Manu.

### Fuentes consultadas

Ver `docs/research/SOURCES.md`, sección "Almacenamiento local, claves y contenedor compartido (D-02, añadidas por ADR-0011)". Limitación registrada: el entorno de Claude Code en la nube no puede leer el contenido real de `developer.apple.com` (páginas dependientes de JavaScript) ni acceder a `support.apple.com` (bloqueado por el proxy de red); las afirmaciones que dependían de esas páginas se contrastaron con resultados de búsqueda de terceros y foros oficiales de Apple Developer, y se marcan `NO_VERIFICADO` cuando no hubo una fuente primaria concluyente.

### Checks ejecutados

- Comprobación de enlaces relativos Markdown en `docs/` y `ai/` (35 archivos, script Python ad hoc con `os.path`): **0 enlaces rotos**, ejecutada dos veces (antes y después de las ediciones finales).
- Revisión manual de IDs: sin ADR duplicados (`ls docs/adr` sin colisiones de número), R-41 añadido una sola vez y coherente entre `RISK_REGISTER.md` y `ADR-0011`, D-02/D-03/D-04B con el mismo estado en `DECISIONS_AND_OPEN_ITEMS.md`, `BACKLOG.md`, `ROADMAP.md`, `BRAIN_02_TASK.md`, `ai/PROJECT_STATE.md` y `ai/DECISIONS.md`.
- No hay comandos de build/test que ejecutar: esta tarea es exclusivamente documental, sin código de producto ni cambios en `Package.swift`/`Tests/`.

### Riesgos

- R-41 (nuevo): dependencia Argon2id de terceros no fusionada en `swift-crypto`.
- La recomendación de ADR-0011 no se ha probado en ningún dispositivo ni Xcode real; todo lo que menciona Keychain, App Group o protección de archivo sigue `TEÓRICAMENTE_POSIBLE` hasta implementarse en BRAIN-02b/02c.

### NO VERIFICADO (de esta tarea)

- Si App Groups funciona con una cuenta Apple gratuita (Personal Team): evidencia contradictoria en foros oficiales, sin fuente primaria concluyente accesible desde este entorno.
- El estado exacto de deprecación de `kSecAttrAccessibleAlways`/`AlwaysThisDeviceOnly`.
- Si el Mac de Manu (`MacBookPro14,2`, Sonoma 14.8.7) rechaza instalar o ejecutar Xcode 26/27 en la práctica (la conclusión sigue apoyada solo en las listas de compatibilidad publicadas por Apple, no en una prueba directa).
- Cualquier comportamiento de SQLite, CryptoKit, Keychain o Argon2id en un binario real: nada de esto se ha compilado ni ejecutado en este entorno.

### Bloqueo humano concreto que queda abierto

Antes de empezar BRAIN-02b (primer proyecto Xcode real), Manu debe elegir entre: (a) aceptar el coste de un runner macOS de pago con un importe concreto a cotizar en ese momento, (b) posponer BRAIN-02b–02d hasta disponer de un Mac compatible con Xcode actual, o (c) reducir el alcance nativo de la Beta 1. Esta tarea no elige por él porque las tres opciones tienen coste, tiempo o alcance de producto. D-03 no se pregunta todavía: solo se convertirá en pregunta a Manu si BRAIN-02c demuestra en el dispositivo que la cuenta gratuita no permite App Groups.

> **Corregido más abajo.** Esta sección de "bloqueo humano concreto" quedó desmentida por la revisión externa que sigue: no hacía falta esperar a un dispositivo real para BRAIN-02b–02d. Se conserva sin editar por trazabilidad; ver "BRAIN-02-PREP — corrección tras revisión externa" para el estado correcto.

## BRAIN-02-PREP — corrección tras revisión externa (mismo PR #5, commit posterior a `db3da24`)

Comentario de revisión de @elpiernitas (rol de orquestador ChatGPT/Codex delegado, ver `AGENTS.md`) en `db3da24e28c38135103238e8fcf4edb609456d0a`: señaló, con evidencia primaria, que la entrega anterior sobredimensionaba D-04B.

### Defecto confirmado

La versión anterior de esta tarea asumía que **cualquier** proyecto Xcode real necesita el Mac de Manu o un runner de pago, y bloqueaba BRAIN-02b–02d en bloque por D-04B, pidiendo además una decisión a Manu antes de empezar BRAIN-02b. Eso es incorrecto:

- El runner `macos-26` (el mismo que ya usa BRAIN-01) trae Xcode 26.6 con SDKs e imágenes de iOS Simulator instalados ([runner-images, README de `macos-26`](https://github.com/actions/runner-images/blob/main/images/macos/macos-26-Readme.md)).
- `xcodebuild` compila y ejecuta tests contra un destino de iOS Simulator sin firma, fijando `CODE_SIGNING_ALLOWED=NO` (y `CODE_SIGNING_REQUIRED=NO`, `CODE_SIGN_IDENTITY=""`), sin necesidad de Apple ID ni Developer Program.
- El simulador no aplica la autorización de entitlements por perfil de aprovisionamiento que sí exige un dispositivo físico, así que un build de simulador puede declarar y ejercitar Keychain, App Group y una extensión mínima sin registrarlos contra un equipo de desarrollador real.

Además, se corrigió una atribución técnica incorrecta: CryptoKit **no** expone PBKDF2 (solo AES-GCM/ChaChaPoly, SHA-2, HMAC, HKDF y firmas/acuerdo de claves); la implementación de Apple para PBKDF2 es `CCKeyDerivationPBKDF` en CommonCrypto. Una versión anterior de ADR-0011 atribuía la alternativa de cero dependencias a "CryptoKit/CommonCrypto" de forma intercambiable.

### Corrección aplicada

- `docs/adr/0011-native-local-storage-and-keys.md`: reescritas las secciones "Fuentes consultadas", "Gestión de claves" (atribución PBKDF2 → CommonCrypto), "Contenedor compartido con extensiones", "Consecuencias" y "Verificación" para separar (a) build/test en simulador dentro de `macos-26`, sin firma ni dispositivo, ya disponible; de (b) firma, instalación y comportamiento en el iPhone físico real, la única parte que sigue bloqueada por D-04B.
- `docs/roadmap/BRAIN_02_TASK.md`: reescrita la sección "Resultado". Las cuatro subfases (02a–02d) pasan a verificarse en simulador dentro de `macos-26`; se añade una fase transversal explícita "dispositivo real" como la única bloqueada por D-04B; se añade un criterio de verificación obligatorio (reproducible, no ejecutado todavía) como primer paso de BRAIN-02b: un job de CI que publique `xcodebuild -version`/`-showsdks` y compile+pruebe un target mínimo contra `iphonesimulator` con `CODE_SIGNING_ALLOWED=NO`; se elimina la petición a Manu antes de BRAIN-02b, movida a la fase de dispositivo real.
- `docs/architecture/DECISIONS_AND_OPEN_ITEMS.md`: D-02, D-04, D-03 y D-04B reescritas para la misma separación; D-04B pasa a describir específicamente "firma e instalación en el iPhone físico", no "compilación de un proyecto Xcode real".
- `docs/roadmap/BACKLOG.md`, `docs/roadmap/ROADMAP.md`: filas y descripción de BRAIN-02/D-03/D-04B actualizadas.
- `docs/security/RISK_REGISTER.md`: R-25 corregido (el runner gratuito sí compila y prueba en simulador, incluido App Group y extensiones; lo que no garantiza es firmar e instalar en el iPhone físico). R-22 no se tocó: describe el entorno de Claude Code en la nube, no el runner de GitHub Actions, y esa afirmación seguía siendo correcta.
- `docs/research/SOURCES.md`: nueva sección "Correcciones tras revisión externa del PR #5" con las fuentes que sustentan el fix (README del runner `macos-26`, TN2339 de Apple, foros oficiales sobre firma de simulador, y las fuentes sobre CryptoKit/CommonCrypto y PBKDF2).
- `ai/PROJECT_STATE.md`, `ai/DECISIONS.md`: actualizados a la misma separación.

### Verificación de la corrección

- Reproducido con búsquedas independientes: contenido del README de `macos-26` (Xcode 26.0.1–26.6, SDKs iOS 26.0–26.5, simuladores iPhone 17 Pro/Max e iPad instalados) y múltiples fuentes coincidentes (foros oficiales de Apple Developer, guías de CI de Codemagic/Bitrise) sobre `CODE_SIGNING_ALLOWED=NO` y sobre que el simulador no aplica la autorización de entitlements por perfil de aprovisionamiento.
- Reproducido que CryptoKit no expone PBKDF2 y que `CCKeyDerivationPBKDF` (CommonCrypto) es la función de Apple para ese caso.
- **No se ha creado ni ejecutado ningún job de CI real en este repositorio que confirme el build+test en simulador**: sigue prohibido crear un proyecto Xcode en esta tarea de preparación. Por eso la corrección documenta el hallazgo como razonamiento apoyado en fuentes primarias de GitHub y de Apple, y añade el job descrito arriba como criterio de aceptación obligatorio y reproducible de BRAIN-02b, en vez de declarar el build en simulador como ya verificado.
- Repetida la comprobación de enlaces relativos Markdown tras esta corrección: **0 enlaces rotos**.

### NO VERIFICADO (de esta corrección)

- El job de CI descrito como criterio de verificación de BRAIN-02b no se ha ejecutado: es razonamiento, no evidencia reproducida en este repositorio.
- Si registrar el App Group **contra un equipo de desarrollador real** (necesario solo para firmar e instalar en el iPhone físico) funciona con cuenta gratuita sigue sin fuente primaria concluyente, igual que antes de esta corrección.

### Bloqueo humano concreto (corregido)

Ya no hay ninguna pregunta pendiente a Manu antes de empezar BRAIN-02b: la verificación en CI/simulador de las cuatro subfases no tiene bloqueos técnicos. El único bloqueo humano concreto que queda es, exclusivamente, la fase de dispositivo real: cuando BRAIN-02b–02d estén verificadas en simulador y llegue el momento de firmar e instalar en el iPhone físico de Manu con iOS 27, deberá elegir entre (a) un runner macOS de pago con importe a cotizar en ese momento, (b) esperar a un Mac compatible, o (c) reducir el alcance nativo de la Beta 1.

> **Corregido más abajo.** La opción (a) de este párrafo es un error de categoría: ningún runner de CI, gratuito o de pago, tiene acceso físico al iPhone. Se conserva sin editar por trazabilidad; ver "BRAIN-02-PREP — segunda corrección tras revisión externa" para el estado correcto.

## BRAIN-02-PREP — segunda corrección tras revisión externa (mismo PR #5, commit posterior a `f82a16a`)

Segundo comentario de revisión de @elpiernitas en `f82a16a3e20288694378eb05ef78dc58b784143e` (ronda 2/6 del PR, ronda 1/3 sobre ese head): la separación CI/simulador vs. dispositivo físico y la corrección de PBKDF2 quedaron bien aplicadas, pero D-04B seguía describiendo una salida técnicamente inválida.

### Defecto confirmado

Varios documentos (`docs/roadmap/BRAIN_02_TASK.md`, `ai/PROJECT_STATE.md`, `ai/HANDOFF.md`, `docs/architecture/DECISIONS_AND_OPEN_ITEMS.md`) ofrecían "aceptar el coste de un runner macOS de pago" como una opción para firmar, instalar y probar en el iPhone físico de Manu. Es un error de categoría: un runner de GitHub Actions, por grande o caro que sea, es una máquina virtual efímera sin ningún acceso físico al iPhone. Ningún runner, gratuito o de pago, puede conectar, instalar ni ejecutar QA en un dispositivo que no tiene enchufado. Esperar a que GitHub ofrezca Xcode 27 como imagen estándar tampoco resuelve la instalación física: en el mejor caso solo ampliaría el SDK de simulador disponible en CI.

### Corrección aplicada

- `docs/roadmap/BRAIN_02_TASK.md`: la sección "D-04B — precisada" reemplaza la opción inválida por las tres rutas reales: (1) un Mac de Manu compatible conectado directamente al iPhone (la única con acceso físico real); (2) TestFlight vía D-03, que no necesita un Mac conectado pero introduce un gate propio de credenciales/perfiles de firma, con autorización específica pendiente para cuando se intente; (3) posponer o reducir el alcance nativo de la Beta 1. Se aclara explícitamente que D-04B es un **gate futuro**, no una decisión pendiente de Manu ahora.
- `docs/architecture/DECISIONS_AND_OPEN_ITEMS.md`: filas D-04 y D-04B reescritas con la misma separación; se aclara que el descarte de `xcode-27-xlarge` por coste es un hecho aparte (afecta al SDK de simulador en CI) y no implica que un runner de pago resolviera la instalación física.
- `ai/PROJECT_STATE.md`, `ai/DECISIONS.md`, `ai/CURRENT_TASK.md`: alineados a la misma separación; se sustituye "bloqueo humano concreto que queda abierto" por lenguaje de "gate futuro" donde correspondía, para no dar la impresión de que existe una acción pendiente de Manu hoy.
- `ai/QA_LESSONS.md`: añadida QAL-007 con la distinción generalizable (más abajo) y un comando reproducible de comprobación.

### Comprobación de regresión reproducible

Primer intento de esta corrección: un `grep` que combinaba "runner" y "pago/xlarge" con "iphone/dispositivo físico" en la misma frase. Al ejecutarlo dio **falsos positivos** (coincide también con frases que explican correctamente que el runner *no* resuelve la instalación física) — no se puede afirmar "cero coincidencias" con ese comando, así que se sustituye por uno más preciso en vez de dejar la afirmación incorrecta.

Comando usado (heurística, no infalible):

```bash
grep -rniE "runner[^.]*(puede|permite|instala|prueba|resuelve)[^.]*iphone" docs ai
```

Sobre el estado final de esta corrección devuelve coincidencias en `docs/adr/0011-native-local-storage-and-keys.md` (dos), `docs/security/RISK_REGISTER.md`, `ai/DECISIONS.md` y en este mismo `ai/HANDOFF.md` (el propio relato de esta corrección, incluida esta frase, coincide consigo mismo por usar las mismas palabras — eso es un efecto secundario esperable del comando, no una coincidencia nueva que revisar cada vez). Se releyeron todas: hablan de lo que el runner sí resuelve en **simulador** (compilar/probar sin firma) o niegan explícitamente que resuelva la instalación **física** ("no garantiza", "no aplica", "tampoco resuelve"); ninguna repite el error de presentar un runner como capaz de instalar o probar en el iPhone físico. El comando no distingue automáticamente afirmación de negación por sí solo — requiere esta revisión manual de cada coincidencia, documentada aquí como evidencia reproducible en vez de una cifra sin verificar.

Comprobación complementaria, esta sí sin ambigüedad: la frase literal que causó el defecto ("aceptar el coste de un runner ... de pago" como opción) ya no aparece fuera de los dos bloques de `ai/HANDOFF.md` explícitamente marcados como historia superada (líneas 117 y, en esta misma corrección, la cita entre comillas de la línea "Defecto confirmado" de arriba, que la nombra para describir el error, no para repetirlo como recomendación).

### Verificación de la corrección

- Releído cada documento señalado por el revisor y confirmado que la opción "runner de pago" para instalación física no aparece ya como recomendación en ningún documento activo (los bloques de `ai/HANDOFF.md` marcados como superados se conservan sin editar, con una nota que remite a esta sección).
- Comprobación de enlaces relativos Markdown repetida tras esta corrección: **0 enlaces rotos**.
- Comando de regresión de arriba ejecutado sobre el estado final: todas las coincidencias revisadas manualmente y confirmadas como correctas (simulador o negación explícita), no como repetición del defecto.

### NO VERIFICADO (de esta corrección)

- No cambia respecto a la corrección anterior: sigue sin fuente primaria concluyente si registrar App Groups contra un equipo real funciona con cuenta gratuita, y sigue sin ejecutarse el job de CI descrito como criterio de BRAIN-02b.

### Bloqueo humano concreto (estado vigente)

No hay ninguna decisión pendiente de Manu ahora. D-04B es un gate futuro que solo se activará cuando BRAIN-02b–02d estén verificadas en simulador y el equipo intente de verdad la fase de dispositivo real; en ese momento las opciones son (a) que Manu disponga de un Mac compatible conectado al iPhone, (b) TestFlight vía D-03 con su propio gate de credenciales, o (c) posponer/reducir el alcance nativo de la Beta 1 — ninguna resoluble comprando más CI.

> **Corregido más abajo.** Este párrafo describía D-03 (dentro de la opción (b)) como si solo se activara por el fallo de App Groups en otras partes del documento, lo que contradecía que TestFlight (esta misma opción (b)) exige D-03 por sí sola. Se conserva sin editar por trazabilidad; ver "BRAIN-02-PREP — tercera corrección tras revisión externa" para el estado correcto.

## BRAIN-02-PREP — tercera corrección tras revisión externa (mismo PR #5, commit posterior a `2530652`)

Tercer comentario de revisión de @elpiernitas en `253065243e243c410628498b33ca9faf03317a09`: la separación runner/dispositivo físico quedó bien aplicada y Foundation check `36459911067` en verde, pero la nueva ruta TestFlight dejó D-03 internamente contradictoria.

### Defecto confirmado

`docs/roadmap/BRAIN_02_TASK.md` decía en la sección D-04B que TestFlight es una ruta real hacia la fase de dispositivo, gateada por D-03 "sin ambigüedad". Pero la sección D-03 del mismo documento (y `ai/DECISIONS.md`, `ai/PROJECT_STATE.md`, `DECISIONS_AND_OPEN_ITEMS.md` en dos sitios, `BACKLOG.md` y `ROADMAP.md`) decían que D-03 "solo entra en juego" o "solo se pedirá" si firmar con la cuenta gratuita demuestra que App Groups falla. Esas dos afirmaciones no pueden ser ciertas a la vez: se puede elegir TestFlight sin haber intentado nunca Personal Team/App Groups, y esa elección por sí sola exige Apple Developer Program.

### Corrección aplicada

D-03 queda modelada con **dos disparadores independientes**, ninguno excluyente del otro y ninguno activo ahora mismo:

1. Firmar en el iPhone físico con la cuenta gratuita (Ruta 1 de D-04B) demuestra de forma reproducible que App Groups falla.
2. Se elige TestFlight (Ruta 2 de D-04B) como vía de distribución/prueba física, se haya intentado o no la Ruta 1 — TestFlight exige el programa de pago por sí solo.

Actualizados con esta misma redacción: `docs/roadmap/BRAIN_02_TASK.md` (sección D-03, con nota de corrección explícita), `docs/adr/0011-native-local-storage-and-keys.md`, `docs/architecture/DECISIONS_AND_OPEN_ITEMS.md` (fila D-03 y "Intervención de Manu necesaria"), `docs/roadmap/BACKLOG.md` (dos sitios), `docs/roadmap/ROADMAP.md`, `ai/PROJECT_STATE.md` (dos sitios) y `ai/DECISIONS.md`. Se mantiene explícito en cada uno que ningún disparador está activo hoy (no se ha intentado nada en el dispositivo, nadie ha elegido TestFlight todavía) y que BRAIN-02a–02d siguen desbloqueadas en CI/simulador sin relación con esto.

`ai/QA_LESSONS.md`: añadida QAL-008 (un disparador condicional en un documento puede contradecir una ruta ya listada en otro) con un comando de comprobación (`grep -rn "solo si.*falla" docs ai`, cada coincidencia a releer junto con el resto del documento).

### Verificación de la corrección

- Búsqueda repetida tras la corrección de `"solo si.*falla"` y `"solo si.*App Groups"` en `docs/` y `ai/` (excluyendo los bloques de `ai/HANDOFF.md` ya marcados como historia superada): la única coincidencia activa que queda es la fila D-03 de `DECISIONS_AND_OPEN_ITEMS.md`, donde "solo si" ya califica correctamente "uno de dos disparadores independientes", no una condición exclusiva. `ai/QA_LESSONS.md` también coincide, pero por citar la propia frase corregida como ejemplo de la lección (QAL-008), no por repetir el defecto.
- Comprobación de enlaces relativos Markdown repetida: **0 enlaces rotos**.
- No se ha creado ni ejecutado código de producto en esta corrección; sigue siendo un cambio exclusivamente documental.

### NO VERIFICADO (de esta corrección)

- No cambia respecto a las correcciones anteriores.

### Bloqueo humano concreto (estado vigente, sin cambios de fondo)

Sigue sin haber ninguna decisión pendiente de Manu ahora. D-04B y D-03 son gates futuros: D-04B se activa al intentar de verdad la fase de dispositivo real; D-03 se activa por cualquiera de los dos disparadores anteriores, ninguno ocurrido todavía.

## NO VERIFICADO

- Integración con almacenamiento, cifrado, sync, UI o extensiones.
- Compilación, firma o instalación de una app iOS/macOS.
- Comportamiento en dispositivos reales.

## [SUPERSEDED] Próximo paso de BRAIN-02-PREP

> **SUPERSEDED.** El PR #5 está fusionado (`ff2f86a`) y la línea nativa (BRAIN-02) está pausada. El próximo paso vigente está en la sección «Próximo paso vigente» al principio de este archivo.

BRAIN-02-PREP quedó ejecutada por Claude Code conforme a `docs/roadmap/BRAIN_02_TASK.md`, con tres rondas de corrección tras revisión externa. El orquestador revisó el PR #5 y lo fusionó.
