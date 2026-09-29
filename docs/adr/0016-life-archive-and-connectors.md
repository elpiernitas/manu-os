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

## Consecuencias

- El archivo puede ocupar decenas de MB en el iPhone. La cuota de IndexedDB en Safari es NO_VERIFICADO con exportaciones reales grandes.
- Los datos de terceros de las conversaciones (nombres, detalles) se quedan en el dispositivo. Enviar fragmentos a Gemini será una acción explícita de Manu en la siguiente entrega.
