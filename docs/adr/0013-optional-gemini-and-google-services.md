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

## Historial

- Ronda 1 de revisión (PR #13, 2026-09-28): la primera versión subía el vault en claro y automáticamente a Drive, enviaba a Gemini sin confirmación con un filtro de palabras presentado como garantía, y pedía los cuatro scopes de golpe. Corregido en esta versión del ADR.
- Ronda 2 (PR #13): el sobre aceptaba campos extra y cualquier número de iteraciones. Corregido con el esquema cerrado.

## Alternativas rechazadas

- **Correo compartido o cuenta de servicio (como el CRM)**: exige servidor y guardar credenciales.
- **Mandar todo el contexto a la IA**: incompatible con AGENTS.md (lo sensible no va a proveedores de modelo).
- **Scope `drive` completo**: da acceso a todo el Drive; `drive.appdata` basta para la copia.
