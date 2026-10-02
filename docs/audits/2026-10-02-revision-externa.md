# Revisión externa (Gemini y ChatGPT), 2026-10-02

Manu pasó a Gemini y a ChatGPT los prompts preparados por Claude Code. Claude Code comprobó cada punto en el código antes de cambiar nada.

## ChatGPT (leyó el repositorio en `7992c29`)

| # | Hallazgo | Veredicto | Qué se hizo (WEB-76) |
|---|---|---|---|
| 1 | Una edición durante la descarga de la nube se pierde | **Confirmado** (e2e falla en v75) | `nubePull()` compara lo que escribe Manu antes y después de esperar a la red. Si cambió, hay conflicto. No cuentan el tiempo, Google ni las marcas del dispositivo. |
| 2 | La descarga que no cabe se da por buena | **Confirmado** (e2e falla en v75) | Primero se guarda; si falla, no cambian ni la memoria ni `lastRev` ni `dirty`, y aparece «No cabe en este dispositivo». |
| 3 | La restauración afirma «como estaban» aunque deshacer falle | **Confirmado** | Se cuentan los fallos al deshacer y el mensaje lo dice («pueden haber quedado a medias»). El vault se escribe el último. Test unitario. |
| 4 | El texto de Atajos y el código OAuth acaban en Cache Storage | **Confirmado** | El SW guarda las páginas con una clave fija y nunca guarda URLs con `?`. Atajos usa `#di=` y `#manana=1`, que no llegan al servidor; lo viejo (`?di=`) sigue funcionando. e2e del SW. |
| 5 | GitHub Pages comparte origen con otros proyectos de `elpiernitas.github.io` | **Correcto en teoría**. Solo es un riesgo real si Manu publica en ese dominio código que no controla. | **Decidido por Manu (2026-10-02): se queda en `elpiernitas.github.io`.** Hoy el dominio solo tiene MANU y `save-slot-02`, las dos suyas. Manu no va a publicar más webs ahí. Se revisa si eso cambia o si `save-slot-02` empieza a cargar código de terceros que no se revise. Precaución: en el Mac, abrir `save-slot-02` en otro navegador. |
| 6 | Corregir un fichaje permite días imposibles | **Confirmado** | `editPunch()` valida la secuencia y rechaza el cambio con un mensaje. La ordenación es por hora real. Test unitario. |
| 7 | El SW borra cachés ajenas y devuelve HTML a scripts sin red | **Confirmado** | Solo borra las cachés `manuos-*`; `index.html` solo sirve para navegar. e2e sin red. |
| 8 | Las fotos y «Tu archivo» no se sincronizan | Ya documentado en Tu nube | Se corrige el subtítulo de Tú, que decía «cifrados» (falso desde WEB-67). |
| 9 | La copia completa usa mucha memoria con archivos grandes | Plausible (el algoritmo guarda varias copias en memoria) | Pendiente: formato por bloques con Streams. |
| 10 | `app.js` es demasiado grande y la orquestación no tiene tests | De acuerdo | Pendiente: extraer controladores. De momento, e2e de la orquestación (QAL-044). |
| — | `APP_VERSION` y la caché del SW pueden desincronizarse | Aceptado | Nuevo test que los ata. |
| — | Dos pestañas guardando a la vez | Plausible | Pendiente (Web Locks). |

## Gemini (no pudo abrir la web ni el código)

Gemini respondió solo a partir de la descripción del prompt. Lo útil:
- comandos rápidos en vez de chat;
- más proactividad con Atajos;
- usar la IA para extraer datos y no para cálculos.

Lo que no aplica o es incorrecto:
- «La clave de Gemini está en el código»: no. La pega Manu y se guarda en su dispositivo; no está en el repositorio (`tests/gemini-key.test.js`).
- «Usa Gemini 1.5 Flash»: es una recomendación desfasada. MANU elige el modelo con `freshModel`.
- Edge Functions y quitar Gmail: son decisiones de producto que tiene que tomar Manu.
