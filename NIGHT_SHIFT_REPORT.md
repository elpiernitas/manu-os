# Informe del turno de noche · 2026-11-09

**Resumen:** MANU ya tiene memoria de verdad. Le puedes contar cosas, preguntarle qué sabe, corregirle y hacer que olvide. Te señala cuándo te contradices, citando tus palabras y la fecha. Aprende de tus respuestas sobre los gastos y te propone reglas, sin decidir por ti. Todo funciona sin IA, está probado y está en un PR en borrador sin fusionar.

---

## 1. Qué encontré

- **Un modelo de conocimiento definido** (`docs/architecture/DATA_MODEL.md`, ADR-0002): afirmaciones tipadas con estado, vigencia, confianza, procedencia y sustitución. Solo existía en el núcleo Swift (BRAIN-01), que está en pausa con la app nativa.
- **En la web, que es la app que usas**, la «memoria» se reducía a dos cosas:
  - un **perfil en texto libre** (`vault.profile.text`), que se corrige reescribiéndolo entero;
  - la búsqueda en «Tu archivo» (ChatGPT).

  No había hechos separados de deducciones, ni historial, ni contradicciones, ni vigencia.
- **El dinero ya aprende** una categoría por comercio a partir de cada corrección tuya (`money.js`). Lo respeté y lo complementé en vez de duplicarlo.
- **Rama `claude/magical-goodall-rf5qoo`**, con un commit WIP previo (`bahia-svg.js`, sin conectar). Ese commit **ya tenía una prueba en rojo** (`sw-shell`), que he arreglado.
- **No hay ningún documento llamado «BRAIN-00».** BRAIN-00 es la fase de fundación documental, ya cerrada. Su contenido (charter, arquitectura, modelo de datos, ADR) es lo que he seguido.

## 2. Decisiones técnicas y por qué

| Decisión | Por qué |
|---|---|
| **Llevar el modelo de DATA_MODEL a la web** (`vault.brain`), en vez de inventar otro | Ya estaba decidido (ADR-0002) y encaja con tus reglas nuevas: hechos frente a hipótesis, procedencia, correcciones con historial. |
| **Una sola vertical coherente**, no siete prototipos | Núcleo → aprendizaje → propuestas → conocernos → voz → chat → pantalla. Todo usa el mismo almacén y las mismas reglas. |
| **Sin IA** (ADR-0009) | Funciona sin Gemini y no envía la memoria a ningún proveedor. |
| **«Olvidar» borra de verdad** | Pediste poder borrar. Se elimina el texto de todas las versiones y queda solo un evento sin contenido («se borraron 2 versiones»). |
| **Una deducción nunca se vuelve hecho sola** | Lo que deduce una regla entra como «sin confirmar», con su confianza, nunca del 100 %. Solo pasa a hecho si tú lo confirmas. |
| **Contradicciones en duda** | Si dices dos cosas distintas sobre lo mismo, las dos quedan «en duda» hasta que eliges. MANU no elige por ti. |
| **Proactividad con freno** | Como mucho una propuesta en Hoy, un presupuesto diario de 3 respuestas y silencio de 4 horas tras un «Luego». Un «no» no se repite. |
| **Sin temas sentimentales espontáneos** | La vigencia nunca pregunta por recuerdos, terceros ni nada marcado como sensible. |
| **Personalidad sin inventar** | MANU reutiliza **tus** expresiones tal cual, solo donde tú digas y de vez en cuando. No se inventa frases tuyas ni recuerdos. |
| **El «zasca» siempre con fundamento** | Cita lo que dijiste y cuándo. |

## 3. Qué he implementado (funciona)

**En el chat (pestaña MANU):**
- «recuerda que mi café favorito es el cortado» → lo guarda como *preferencia*.
- «recuerda que el 3 de marzo de 2024 fui a Oviedo al concierto» → lo guarda como *recuerdo*, con fecha y lugar.
- Si luego dices «recuerda que mi café favorito es el solo», con franqueza al máximo responde: *«El 9 de noviembre de 2026 era «el cortado». Hoy es «el solo». Alguien ha cambiado, y no he sido yo. Los dejo los dos en duda hasta que elijas…»*
- «¿qué sabes de mí?» y «¿qué sabes del café?» → responde separando *hechos y recuerdos*, *en duda* y *deducciones sin confirmar*, cada uno con su origen.
- «¿qué recuerdas de marzo de 2024?» → busca por fecha.
- «olvida lo del concierto» → te enseña qué borraría y solo borra si pulsas «Sí».

**Tú → Memoria:**
- **Para ti:** las propuestas, cada una con su «Por qué»:
  - gastos que no entiendo («¿Qué es este gasto?»);
  - patrones («los gastos de noche de 5 a 15 € suelen ser ocio nocturno, ¿te los propongo así?»);
  - dudas que resolver;
  - deducciones por confirmar;
  - «¿sigue siendo así?».
- **Conocernos:** 17 preguntas por niveles, como mucho 3 al día. Cada una tiene «Otro día» y «Prefiero no responder», que se respeta para siempre. Solo preguntan por ti.
- **Apuntar algo:** a mano, con tipo, fecha, lugar y la casilla «sensible».
- **Tus recuerdos:**
  - búsqueda y filtros (vigentes, sin confirmar, en duda, por revisar, historial);
  - una ficha por recuerdo con origen, fechas, confianza, **historial** y «relacionado» (cada vínculo dice por qué);
  - acciones: corregir, «ya no es así», olvidar para siempre.
- **Lo que he aprendido:** las reglas, con en qué se basan, sus aciertos y correcciones, y botones para pausar u olvidar.
- **Cómo te hablo:** humor (sobrio, natural, con chispa), franqueza (suave, directo, zasca con fundamento) y tus expresiones.

**En el resto de la app:**
- **Hoy:** una sola propuesta, con «Responder» y «Luego».
- **Dinero:**
  - cuando aceptas una regla, los gastos nuevos de «Otros» que encajan salen como «deducción aprendida (N %)», y los puedes corregir;
  - cada corrección tuya también enseña, y si una regla falla a menudo se pausa sola.

**Archivos:**

| Archivo | Contenido |
|---|---|
| `web/core/brain.js` | La memoria |
| `web/core/learn.js` | El aprendizaje |
| `web/core/proposals.js` | El motor de propuestas |
| `web/core/conocernos.js` | Las preguntas |
| `web/core/voice.js` | La voz |
| `web/core/memchat.js` | El chat |
| `web/core/memview.js` | La pantalla |

Además he tocado `app.js`, `storage.js`, `sync.js`, `sw.js`, `styles.css`, las pruebas y la documentación.

## 4. Pruebas ejecutadas

| Comando | Resultado |
|---|---|
| `npm test` (en `web/`) | **300 de 300 OK**, 24 pruebas nuevas en `tests/memoria.test.js` |
| `node --check` de `app.js`, `sw.js` y `core/*.js` | OK |
| `node e2e/memoria.e2e.mjs`, Chromium con emulación de iPhone 14 | **23 de 23 OK**: Hoy, gasto desconocido, regla, Dinero, conocernos, voz, chat con contradicción, resolver, corregir, buscar, recargar, olvidar |
| `node e2e/bahia.e2e.mjs` | OK, sin regresiones |

Lo que comprueban las pruebas nuevas, además de lo normal:
- olvidar no deja el texto **en ningún sitio** del almacenamiento;
- construir propuestas no cambia nada;
- un «no» no se repite;
- una regla no llega nunca al 100 %;
- no hay preguntas sobre otras personas;
- «recuérdame» sigue siendo un recordatorio.

La autorrevisión encontró **3 fallos reales**, ya corregidos y con prueba:
1. Repetir un dato lo duplicaba. Ahora lo reconfirma.
2. Un gasto que habías corregido seguía marcado como «deducción aprendida».
3. **Tu nube podía sobrescribir un dispositivo que solo tuviera recuerdos**, porque lo consideraba vacío.

## 5. Qué puedes probar al despertar

Rama `claude/magical-goodall-rf5qoo`, PR en borrador (enlace en el mensaje de la sesión). Al no estar fusionado, **no está en tu MANU publicado**. Para probarlo en el Mac:

```sh
python3 -m http.server 8765 --directory web
# abre http://localhost:8765 → Tú → Memoria, o habla en MANU:
#   «recuerda que…», «¿qué sabes de mí?», «olvida lo de…»
```

Prueba de navegador:

```sh
node e2e/memoria.e2e.mjs /ruta/para/capturas
```

## 6. Pendiente o bloqueado

- **Nada probado en Safari ni en tu iPhone real** (NO_VERIFICADO). Todo es Chromium con emulación.
- **El aprendizaje solo cubre gastos.** El mismo motor sirve para capturas, ideas o momentos del día, pero no lo he extendido para no abrir frentes a medias.
- **La memoria no se envía a la IA** a propósito. Si algún día quieres que Gemini la use al conversar, sería otra decisión tuya.
- **Aviso de CSP previo y ajeno a esta tarea:** al abrir Tú, la librería de Google intenta añadir estilos que la política de seguridad bloquea. Pasa también en `main`.

## 7. Qué necesito que decidas

1. **¿Fusiono WEB-94 en `main`** (y por tanto se publica en tu MANU) cuando lo hayas probado?
2. **¿La memoria viaja en Tu nube?** Ahora sí, como el resto de tus datos y como tu perfil, protegida por tu cuenta (RLS) pero sin cifrado de extremo a extremo (ADR-0017). Si prefieres que se quede solo en el dispositivo, es un cambio pequeño.
3. **¿Extiendo el aprendizaje** a capturas e ideas («esto suele ser del proyecto X»)?

## 8. Rama y commits

Rama `claude/magical-goodall-rf5qoo`, sobre `main` (`02ebf48`) más el commit WIP anterior:

| Commit | Contenido |
|---|---|
| `2975bda` | WEB-94: Memoria — MANU BRAIN en la web |
| `5bcfd6c` | WEB-94: autorrevisión — repetir confirma, etiqueta de deducción y Tu nube |
| (siguiente) | WEB-94: documentación e informe del turno de noche |

No he hecho nada fuera de este repositorio. Sin fusiones, compras, servicios nuevos, datos reales ni mensajes a nadie.
