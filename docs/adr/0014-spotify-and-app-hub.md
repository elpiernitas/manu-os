# ADR-0014 — Spotify en el altavoz «baño» y MANU como centro de accesos

Status: **ACCEPTED** (decisión de Manu, 2026-09-29: «que me redirija a Spotify y ya elijo yo, pero conectado al altavoz baño»; y «una única aplicación que una todas las que no sean redes sociales»)
Date: **2026-09-29**
Complementa: **ADR-0012** y **ADR-0013**

## Contexto

Manu quiere que MANU abra sus apps según el momento del día y que la música empiece en el altavoz del baño sin tener que buscarlo. Una web no puede lanzar apps nativas con control total; sí puede abrir enlaces universales y usar la API web de Spotify.

## Decisión

1. **Accesos por modo** (`web/core/hub.js`): enlaces `https` a Spotify, WhatsApp, Calendar, Gmail, Drive, Docs, Hojas, Maps, ALSA, Gemini, ChatGPT y Claude, elegidos según el modo del día. Por ejemplo, las mañanas en que Manu trabaja en Oviedo, primero la ruta y ALSA. No incluye redes sociales.
2. **Spotify con Authorization Code + PKCE** (sin secreto de cliente), con los scopes mínimos `user-read-playback-state` y `user-modify-playback-state`.
   - «Música en el baño» busca el dispositivo cuyo nombre contiene «baño» (configurable), le **transfiere** la reproducción **sin empezar a reproducir** (`play: false`) y abre Spotify para que Manu elija.
   - Los tokens se guardan en el almacenamiento del dispositivo, fuera del vault: nunca van en copias.
   - El `state` y el `code_verifier` se guardan como mucho 15 minutos y se validan al volver.
3. **WhatsApp** mediante `wa.me` con el texto prellenado (felicitar un cumpleaños, saludar). El teléfono es opcional, lo introduce Manu y solo se guarda en su dispositivo. No se lee ni se envía nada automáticamente.
4. **Otros asistentes**: desde la propuesta de IA, «Preguntar en ChatGPT/Claude» copia la frase y abre el asistente. Es una alternativa a Gemini y también exige un gesto explícito de Manu.

## Consecuencias

- Transferir la reproducción desde la API suele requerir **Spotify Premium**. Sin Premium, MANU solo abre Spotify. `NO_VERIFICADO` con la cuenta de Manu.
- El altavoz tiene que estar visible en Spotify Connect en ese momento. Si no lo está, MANU lo explica y abre Spotify.
- `NO_VERIFICADO`:
  - si iOS abre las apps nativas desde enlaces universales lanzados por una web instalada, o pasa antes por Safari;
  - el prellenado `?q=` de ChatGPT y Claude;
  - la vuelta del redirect de Spotify dentro de la web instalada: el almacenamiento de Safari y el de la web instalada podrían ser distintos.
- Los números de teléfono son datos de terceros. Se quedan en el dispositivo y en su copia cifrada, nunca en el repositorio, y `isSensitive` los bloquea para Gemini.

## Estado real (2026-09-29)

- Al crear la app en el panel de Spotify for Developers aparece «App creation is not available. Please try again later.» La cuenta de Manu es Premium (plan Familiar), así que no es por eso. Información aportada por la sesión de Claude en Chrome de Manu; `NO_VERIFICADO` desde este entorno.
- Según esa misma sesión, desde febrero de 2026 Spotify exige Premium en el modo Development, limita a un Client ID por desarrollador y reduce los endpoints disponibles en ese modo. No está comprobado que la transferencia de reproducción (`PUT /v1/me/player`) siga disponible.
- Mientras no haya Client ID, «Música» solo abre Spotify, que es el comportamiento previsto sin configuración. El código PKCE queda inactivo hasta que Manu pegue un Client ID.

## Alternativas rechazadas

- **Reproducir automáticamente una lista concreta**: Manu prefiere elegir él.
- **Controlar el Chromecast directamente (Cast SDK)**: requiere Chrome o un SDK nativo; no funciona en Safari de iOS.

## Enmienda (2026-09-29, WEB-15)

- Manu creó (con Claude en Chrome) la app de Spotify for Developers «MANU OS» en modo Development: redirección `https://elpiernitas.github.io/manu-os/`, solo Web API y Manu como único usuario autorizado. El secreto de cliente no se abrió ni se copió.
- La web trae su Client ID por defecto (`DEFAULT_SPOTIFY_CLIENT_ID`), igual que el de Google (enmienda WEB-08 de ADR-0013). Con PKCE es público por diseño y solo acepta esa redirección. Manu puede usar otro en «Ajustes avanzados»; al cambiarlo se borran los tokens, porque pertenecen a la app que los emitió.
- «Puesta a punto» ofrece «Conectar» Spotify con un toque.
- NO_VERIFICADO: que el modo Development de Spotify permita cambiar de altavoz, y que en el iPhone la vuelta desde Spotify llegue a la app instalada con su almacenamiento, donde se guarda el PKCE. Si iOS devuelve a Safari en lugar de a la app instalada, la conexión fallará con «sesión caducada».
