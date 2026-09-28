# ADR-0013 — IA opcional con Gemini y servicios de Google en la app web

Status: **ACCEPTED** (decisión de Manu, 2026-09-28: «sí a Gemini y sí a todo» lo de Google)
Date: **2026-09-28**
Complementa: **ADR-0009** (asistente sin IA obligatoria), **ADR-0004** (coste cero) y **ADR-0012** (app web)

## Contexto

La app web (ADR-0012) funciona sin IA, pero el chat solo entiende órdenes concretas. Manu pide IA en el chat y conectar todo lo posible de su cuenta de Google (usa Google Calendar a diario). No hay servidor, y el coste debe ser 0 €.

## Decisión

1. **Gemini opcional** con una clave gratuita de Google AI Studio que Manu pega en la app.
   - La clave se guarda solo en el dispositivo, fuera del vault: no va en las copias JSON ni en Drive.
   - Se envía en la cabecera `x-goog-api-key`, nunca en la URL.
   - El modelo se elige de la lista de la cuenta (el «flash» estable más reciente), sin nombres fijos.
2. El núcleo determinista **responde primero**. Gemini solo recibe la frase cuando no hay intención reconocida.
3. **Nunca** se envía a Gemini nada que parezca salud, dinero, ánimo, Refugio, teléfonos, correos, IBAN o contraseñas (`isSensitive`). La crisis y el ánimo bajo no llegan a la IA. Las respuestas de IA se marcan como «IA» y no crean hechos, tareas ni gastos.
4. **Google con un único consentimiento OAuth** (Google Identity Services, sin servidor, token solo en memoria):
   - `calendar.events`: agenda de hoy y mañana, y crear eventos.
   - `tasks`: sincronización de tareas en los dos sentidos con la lista por defecto.
   - `contacts.readonly`: solo nombres y cumpleaños, guardados en el dispositivo.
   - `drive.appdata`: copia del vault en la carpeta privada de la app. La app no ve el resto de Drive.
5. El ID de cliente OAuth es público por diseño. El secreto de cliente no se usa ni se guarda.

## Consecuencias

- Con la clave gratuita, Google puede usar lo que se le envía para mejorar sus productos. Por eso el filtro de privacidad es obligatorio y la app lo explica. `NO_VERIFICADO`: condiciones actuales del plan gratuito.
- Si se agota el cupo gratuito (HTTP 429), el chat sigue funcionando sin IA.
- La app en modo «Prueba» de Google Cloud solo sirve para los usuarios de prueba (Manu). El permiso caduca cada hora y se vuelve a pedir al sincronizar.
- Los nombres de terceros de Contactos quedan en el dispositivo y en la copia privada de Drive; nunca en el repositorio.
- `NO_VERIFICADO`: la ventana de consentimiento de Google desde la web instalada en iOS; el cupo real gratuito de Gemini.

## Alternativas rechazadas

- **Correo compartido o cuenta de servicio (como el CRM)**: exige servidor y guardar credenciales.
- **Mandar todo el contexto a la IA**: incompatible con AGENTS.md (lo sensible no va a proveedores de modelo).
- **Scope `drive` completo**: da acceso a todo el Drive; `drive.appdata` basta para la copia.
