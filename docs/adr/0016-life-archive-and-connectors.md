# ADR-0016 — Tu archivo y conectores de vida

Status: **ACCEPTED** (decisión de Manu, 2026-09-29: «quiero conectar mi vida entera»; autorizó importar exportaciones, Atajos del iPhone, Spotify y YouTube, y Drive completo, para tener un perfil de quién es, poder preguntarle a MANU lo que sea y recibir un resumen diario)
Date: **2026-09-29**
Complementa: **ADR-0013** y **ADR-0015**

## Contexto

Manu quiere que MANU «tenga su cerebro»: acceso a toda su vida digital. MANU es una app web sin servidor, así que hay dos vías:
- **Conectores en directo**, cuando el servicio permite OAuth desde el navegador: Google, Spotify.
- **Exportaciones de datos** que Manu descarga una vez: ChatGPT, Google Takeout, Spotify, redes. Esta es la vía más rica y no necesita servidor.

## Decisión

1. **«Tu archivo»** (WEB-34) guarda las exportaciones como documentos buscables en IndexedDB (`manuos-archive`), **solo en el dispositivo**:
   - no va al vault, a las copias ni a Drive, y nunca al repositorio;
   - «Borrar todos los datos» también lo borra, y tiene su propio «Borrar el archivo».
2. **Primera fuente: ChatGPT.**
   - Se importa el `.zip` tal cual llega (con un lector ZIP propio: `stored` y `deflate` mediante `DecompressionStream`) o `conversations.json`.
   - Se sigue la rama que Manu mantuvo en cada conversación. No se guardan los turnos de sistema ni los ocultos.
3. **Búsqueda local** sin IA (en «Tu archivo» y en el chat: «¿qué hablé con ChatGPT de …?»).
4. **Siguientes entregas**, en este orden y cada una con su PR:
   - preguntar lo que sea y perfil, con Gemini sobre fragmentos del archivo. Solo se envía lo necesario para cada pregunta, y el envío sigue el interruptor de datos sensibles;
   - Atajos del iPhone (Salud, Apple Pay, ubicación);
   - Spotify y YouTube;
   - Drive completo;
   - resumen diario.

## Enmienda (2026-09-29, WEB-35): preguntar, perfil y recuerdos

Manu dijo «sí» a «preguntar lo que sea» y al perfil.
- **Preguntar:** la búsqueda se hace en el dispositivo y a Gemini solo le llegan los fragmentos relevantes, como máximo 6 conversaciones y unas 9.000 letras, con su título y fecha. Cada mensaje y cada título pasa por `mayGo`: crisis, Refugio y secretos nunca; salud, dinero y ánimo solo con el interruptor de datos sensibles. El control global de `askWithActions` sigue de red de seguridad.
- **Perfil:** Gemini recibe los títulos de las conversaciones y la primera frase permitida de Manu en cada una, hasta unas 40.000 letras, y devuelve un retrato por secciones. Se guarda en el vault; Manu lo puede corregir o borrar.
- **Modo conversación:** hay dos categorías sensibles nuevas, «Tu perfil» y «Recuerdos de tu archivo». «Con todo» las incluye. Los recuerdos son como máximo 3 fragmentos relacionados con cada mensaje.

## Consecuencias

- El archivo puede ocupar decenas de MB en el iPhone. La cuota de IndexedDB en Safari es NO_VERIFICADO con exportaciones reales grandes.
- Los datos de terceros de las conversaciones (nombres, detalles) se quedan en el dispositivo. Enviar fragmentos a Gemini será una acción explícita de Manu en la siguiente entrega.
