# ADR-0013 — IA opcional con Gemini y servicios de Google en la app web

Status: **ACCEPTED** (decisión de Manu, 2026-09-28: «sí a Gemini y sí a todo» lo de Google)
Date: **2026-09-28**
Complementa: **ADR-0009** (asistente sin IA obligatoria), **ADR-0004** (coste cero) y **ADR-0012** (app web)

## Contexto

La app web (ADR-0012) funciona sin IA, pero el chat solo entiende órdenes concretas. Manu pide IA en el chat y conectar todo lo posible de su cuenta de Google (usa Google Calendar a diario). No hay servidor, y el coste debe ser 0 €.

## Decisión

1. **Gemini opcional** con una clave gratuita de Google AI Studio que Manu pega en la app.
   - La clave nunca está en el vault, así que nunca va en las copias.
   - Por defecto vive solo en `sessionStorage` (se pierde al cerrar la app). Con «Recordar la clave en este móvil» pasa a `localStorage`. **Riesgo aceptado de forma explícita por Manu al activarlo**: cualquier script que se ejecute en este origen podría leerla. Mitigación: la CSP solo permite scripts propios y `accounts.google.com`.
   - Se envía en la cabecera `x-goog-api-key`, nunca en la URL.
   - El modelo se elige de la lista de la cuenta, sin nombres fijos.
2. **Nada se envía automáticamente.** El núcleo determinista responde primero. Cuando no entiende una frase, la app muestra el **payload exacto** y solo lo envía si Manu pulsa «Enviar a Gemini», una confirmación por petición.
3. **Payload mínimo por defecto**: la frase de Manu y una instrucción fija. Sin historial, tareas ni agenda.
4. `isSensitive` es una **lista de bloqueo de mejor esfuerzo** (salud, medicamentos, dinero e ingresos, ánimo, teléfonos, correos, IBAN, números de tarjeta, contraseñas). Con ella la app ni siquiera ofrece el envío, pero **no es exhaustiva ni es una garantía**: la garantía es la confirmación explícita con el payload visible. Crisis y ánimo bajo nunca llegan a la IA. Las respuestas se marcan «IA» y no crean hechos, tareas ni gastos.
5. **Google con permisos incrementales** (Google Identity Services, sin servidor, un token por scope y solo en memoria). Todas las integraciones empiezan **desconectadas**; cada una tiene su interruptor y pide **solo su scope** la primera vez que se usa. Si se deniega una, las demás siguen funcionando (`runServices`).
   - `calendar.events`: agenda de hoy y mañana, y crear eventos.
   - `tasks`: sincronización de tareas en los dos sentidos con la lista por defecto.
   - `contacts.readonly`: solo nombres y cumpleaños, guardados en el dispositivo.
   - `drive.appdata`: copia **cifrada en el cliente** en la carpeta privada de la app.
6. **Copia en Drive siempre cifrada y manual.** Formato `manuos-backup` v1: AES-256-GCM (AEAD) con la cabecera autenticada como datos adicionales; KDF PBKDF2-HMAC-SHA-256 con 600 000 iteraciones y sal aleatoria de 16 bytes; IV de 12 bytes. La frase la elige Manu (mínimo 10 caracteres) y no se guarda ni se sube. Sin la frase no hay recuperación. El sobre sigue un **esquema cerrado** (`envelopeProblem`): claves exactas, algoritmos exactos, base64 con longitudes fijas de sal e IV, versión soportada e iteraciones entre 100 000 y 2 000 000. Se valida antes de subir y antes de derivar la clave, así que un archivo manipulado no puede colar campos en claro ni bloquear la interfaz con iteraciones extremas. No hay subida automática. En web se usa PBKDF2 en lugar del Argon2id de ADR-0011 porque es el KDF nativo de Web Crypto; la desviación queda documentada aquí.
7. El ID de cliente OAuth es público por diseño. El secreto de cliente no se usa ni se guarda.

## Consecuencias

- Con la clave gratuita, Google puede usar lo que se le envía para mejorar sus productos. Por eso el filtro de privacidad es obligatorio y la app lo explica. `NO_VERIFICADO`: condiciones actuales del plan gratuito.
- Si se agota el cupo gratuito (HTTP 429), el chat sigue funcionando sin IA.
- La app en modo «Prueba» de Google Cloud solo sirve para los usuarios de prueba (Manu). El permiso caduca cada hora y se vuelve a pedir al sincronizar.
- Los nombres de terceros de Contactos quedan en el dispositivo y en la copia privada de Drive; nunca en el repositorio.
- `NO_VERIFICADO`: la ventana de consentimiento de Google desde la web instalada en iOS; el cupo real gratuito de Gemini; `google.accounts.oauth2.hasGrantedAllScopes` con las cuentas reales.
- `VERIFICADO` (Chromium headless, servicios simulados): copia cifrada subida sin marcadores en claro; restauración en un perfil limpio con la frase correcta; rechazo con una frase incorrecta; una sola petición de scope por función; sin llamadas a Gemini sin confirmación.

## Enmienda (2026-09-29, WEB-08)

- **Una sola ventana de consentimiento por toque.** En el iPhone de Manu, Tasks y Contactos fallaban con «Se cerró la ventana de Google»: iOS solo permite una ventana emergente por gesto, y la app abría una por scope en cadena. Ahora, al sincronizar, los scopes de las funciones **que Manu ha activado** se piden juntos en una ventana. Cada scope se guarda solo si Google lo concede (`hasGrantedAllScopes`), así que un «no» parcial sigue afectando únicamente a su función. Las integraciones siguen empezando desconectadas; «Conectar Google» activa Calendar, Tasks y Contactos con un único gesto explícito. Drive sigue pidiéndose solo al hacer una copia.
- **ID de cliente por defecto.** La app trae el ID de cliente OAuth del proyecto de Manu (`manu-os-510021`) para que no tenga que pegarlo. Es público por diseño, solo funciona desde el origen autorizado `https://elpiernitas.github.io` y el secreto de cliente no se usa. Manu puede sustituirlo en Tú → Google.

## Enmienda (2026-09-29, WEB-12)

- **Acciones propuestas por la IA.** Manu quiere pedirle cosas a MANU en lenguaje natural. Gemini recibe, junto a la frase, una lista fija de funciones (añadir tarea o idea, apuntar gasto, crear recordatorio, ir a una pantalla, abrir el selector del extracto, sugerir una mejora). La respuesta solo **propone**: `parseCalls` valida cada propuesta (nombres conocidos, pantallas de una lista cerrada, importes y fechas con formato estricto, textos recortados) y descarta el resto. Cada acción se ejecuta en local y solo tras un toque de Manu. Importar el extracto solo abre el selector; el archivo lo elige Manu y nunca se envía a Gemini.
- **Sugerir mejoras.** `sugerir_mejora` prepara una petición en GitHub (`issues/new` con título y texto rellenos) que Manu envía con su cuenta. El repositorio es público: la app lo avisa y no la prepara si el texto parece sensible.
- **«Enviar a Gemini sin preguntar».** Es un ajuste opcional, desactivado por defecto y que solo Manu puede activar en Tú → IA. Cuando está activo, el consentimiento por petición se sustituye por esa decisión explícita de Manu. El filtro de lo sensible sigue aplicándose antes de cualquier envío, que sigue llevando solo la frase, la instrucción fija con la fecha y hora y la lista de funciones. La burbuja indica que se envió sin preguntar y enseña lo enviado.
- NO_VERIFICADO: la llamada de funciones con la clave real de Manu y en el iPhone (probado con Gemini simulado), y que iOS abra el selector de archivos desde la acción.

## Enmienda (2026-09-29, WEB-13)

- **«Pegar y activar».** El botón lee el portapapeles solo al tocarlo, acepta solo el formato `AIza…`, prueba la clave y la guarda con «Recordar» activado, porque el botón lo dice. Es la misma opción de recordar ya aceptada en este ADR, elegida con un toque explícito. La clave sigue fuera del vault y de las copias, y «Borrar todos los datos» la elimina.
- **Descartado: proteger la app con un código o un TOTP para meter claves en el código.** El código de la web es público, así que cualquier secreto incluido, incluido el de verificación, sería legible por cualquiera. Cifrar la clave con un PIN corto permitiría romperla por fuerza bruta sin conexión. Además, AGENTS.md prohíbe secretos en Git.

## Enmienda (2026-09-29, WEB-23)

- **Capturas y enlaces a Gemini, solo con un toque explícito.** Manu eligió que la IA pueda leer capturas y vídeos compartidos.
  - Solo se envían al pulsar «✨ Que MANU lo lea y lo apunte», y el aviso junto al botón dice que va a Google y que no se use con datos del banco, de salud o de otras personas.
  - Nunca se envían con «Enviar sin preguntar».
  - Una imagen no se puede filtrar como el texto: la protección es la decisión de Manu en cada envío. El texto del vídeo pasa por el filtro de lo sensible.
  - Gemini solo propone acciones con las funciones fijas, y cada una se confirma con un toque.
- **Texto público de TikTok y YouTube.** Al pulsar ese botón con un enlace de TikTok o YouTube, MANU pide a su servicio oEmbed público el título o texto y el autor del vídeo. El servicio ve qué enlace consultas. Las dos direcciones se añadieron a `connect-src` en la CSP. Instagram exige un token de desarrollador y no se usa: para los reels se pide una captura.
- **Las capturas se quedan en el móvil**, en IndexedDB, reducidas a JPEG de como máximo 1280 px. No van en las copias exportadas ni en la copia de Drive, y «Borrar todos los datos» las elimina.
- NO_VERIFICADO: la lectura de imágenes con la clave real de Manu y en el iPhone (probado con Gemini simulado), y que el texto de TikTok traiga la información suficiente (muchos vídeos la dicen en voz y no en el texto).

## Enmienda (2026-09-29, WEB-25)

- **Capturas en el chat de MANU.** El 📎 del chat adjunta una captura. El botón pasa a decir «Enviar a Gemini» y el aviso de que va a Google queda visible, así que ese toque es el consentimiento explícito. Nunca se envía con «Enviar sin preguntar».
- **Proyectos (tipo NotebookLM).** Cada proyecto tiene fuentes: notas, enlaces (con el texto de TikTok o YouTube) y capturas guardadas en IndexedDB. Al pulsar «Preguntar» o un botón de resumen, se envían a Gemini la pregunta, las fuentes de texto numeradas y hasta 4 capturas, y la respuesta cita las fuentes. Las fuentes de texto que parecen sensibles no se envían, y la respuesta dice cuáles se quedaron fuera. Una pregunta sensible no se envía. Las capturas no se pueden filtrar: el aviso lo dice.
- Los proyectos están en el vault (`projects`) y entran en las copias. Sus capturas no, porque están en IndexedDB.

## Enmienda (2026-09-29, WEB-28): datos sensibles permitidos por Manu

Manu decidió de forma expresa: «que lo sensible vaya a la IA me da igual». Esta es la «decisión específica» que exige `AGENTS.md`, pero se aplica solo en su dispositivo y con un interruptor que él controla:
- Tú → IA → «Permitir datos sensibles». Viene desactivado por defecto y se activa también con «Activar con todo». Mientras está activo, la salud, el dinero, el ánimo y las personas pueden ir a Gemini en el chat, el modo conversación, las capturas, los enlaces y los proyectos (`mayGo`).
- El contexto del modo conversación sigue saliendo solo de las categorías que Manu marca. El interruptor deja pasar lo que él escribe, pero no añade más datos de su vida.
- **Nunca se envían, aunque el interruptor esté activo**: contraseñas, tarjetas, IBAN, teléfonos, correos, claves de API (`secret`) y las frases de crisis y del Refugio (`crisis`). Las crisis se atienden en local con el 112 y el 024.
- Las sugerencias de mejora para GitHub siguen bloqueando todo lo sensible, porque los issues son públicos.

## Enmienda (2026-09-29, WEB-27): modo conversación

Manu pidió «hablar con MANU como si fuera Gemini integrado dentro, que lo sepa todo y que maneje él las cosas». Es una decisión material de privacidad, así que es Manu quien la toma en la app y no se aplica sola:
- **Activación explícita.** Está desactivado por defecto. Se activa en el chat o en Tú → IA con «Activar con todo» o «Solo lo básico». Mientras está activo, **cada mensaje** que MANU no resuelve sola (saludos, preguntas, el día, el tiempo, frases largas) va a Gemini, con los últimos 10 turnos y el contexto elegido. El texto lo dice antes de activarlo.
- **Contexto por categorías.** Agenda y recordatorios, tareas e ideas, tiempo y hábitos forman el nivel básico. Dinero, salud, ánimo y personas son sensibles: solo se envían si Manu los marca, que es la «decisión específica» que exige AGENTS.md. Un mensaje o un turno del historial que toque una categoría no permitida no se envía, y MANU explica por qué.
- **Nunca se envían** contraseñas, tarjetas, IBAN, teléfonos, correos, claves de API ni el Refugio. `sensitiveKinds` las marca como «secret», y esa categoría no se puede permitir.
- **Acciones sin preguntar**, desactivado por defecto: crear tareas, ideas y recordatorios y completar tareas, siempre con «Deshacer». Los gastos, las sugerencias de mejora y la importación siguen pidiendo el toque de Manu.
- Las órdenes cortas («gasté 3 en café») las sigue resolviendo MANU en local, al instante. La crisis y el Refugio nunca pasan por la IA.

## Historial

- Ronda 1 de revisión (PR #13, 2026-09-28): la primera versión subía el vault en claro y automáticamente a Drive, enviaba a Gemini sin confirmación con un filtro de palabras presentado como garantía, y pedía los cuatro scopes de golpe. Corregido en esta versión del ADR.
- Ronda 2 (PR #13): el sobre aceptaba campos extra y cualquier número de iteraciones. Corregido con el esquema cerrado.

## Alternativas rechazadas

- **Correo compartido o cuenta de servicio (como el CRM)**: exige servidor y guardar credenciales.
- **Mandar todo el contexto a la IA**: incompatible con AGENTS.md (lo sensible no va a proveedores de modelo).
- **Scope `drive` completo**: da acceso a todo el Drive; `drive.appdata` basta para la copia.
