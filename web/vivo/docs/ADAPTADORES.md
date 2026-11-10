# Adaptadores: cómo se conecta con la app real

El prototipo ya consume la **forma real** de `manuos.vault`. `src/adaptadores.js` solo lee; `src/acciones.js`
son los cambios, que al integrar se sustituyen por los módulos que ya existen.

## Lectura
| Función | Entra (real) | Sale | Estado |
|---|---|---|---|
| `dinero(vault)` | `vault.spending`, `vault.income` (`at`, `cents`, `merchant`, `category`, `source`) | mes, marea, categorías, sitios, momentos, noches, hallazgos | Encaja tal cual. Categorías = `CATEGORIES` de `core/money.js` (probado) |
| `noches(spending)` | igual | secuencias de ≥ 3 pagos 21:00–06:00 | Nuevo. No existe equivalente |
| `constelacion(brain)` | `vault.brain.claims` (`id`, `text`, `kind`, `status`, `validFrom`, `confirmedAt`, `reason`, `confidence`) | estrellas, hilos, recuento | Encaja. Caducidad = `FRESH_DAYS` de `core/brain.js` (probado). `tags` es opcional: si falta, se deduce por palabras |
| `astillero(projects)` | `vault.projects` (`id`, `name`, `emoji`, `sources`) | muelles, barcos, flota | Encaja, pero **`area`, `tareas`, `ideas`, `botado` son campos nuevos**. Sin ellos el proyecto sale como «solo el plano» (probado) |
| `semana(eventos, reminders)` | citas `{id, title, at, minutes}` y `vault.reminders` | 7 días con sus citas | Recordatorios: encaja. **Citas: falta un paso** que convierta la salida de `groupByDay` (`core/gcal.js`) a esa lista. No verificado |
| `portada(vault)` | lo anterior + `vault.inbox` | titular, antes/luego, tareas | Encaja. El tiempo debe venir de `core/weather.js` (ver abajo) |
| `bahia(vault)` | proyectos + inbox | nivel, flota, faro | Fórmula propia y simple. **No es** la de `core/bahia.js` (`town`, `vitality`): al integrar se usa la real |
| `sonda(q, vault)` | todo | resultados por capa | Nuevo. Existe `core/find.js`: no he comprobado si sirve de base |
| `cielo(fecha, tiempo)` | hora + `despejado/nubes/lluvia/niebla` | colores y tema | Falta el paso `icon` de `parseForecast` (`core/weather.js`) → uno de los cuatro tiempos. No verificado |

## Escritura
| Acción del prototipo | Módulo real que la sustituye |
|---|---|
| `confirmar`, `corregir`, `olvidar` | `confirm`, `correct` y la función de olvido de `core/brain.js` (lápidas en `brain.forgotten`, como WEB-99) |
| `dudar` | estado `CONTESTED` de `core/brain.js` |
| `recordar` | `remember` de `core/brain.js` |
| `importarDemo` | `planImport` de `core/bankimport.js` + `bankAisImport()` de `app.js`, con su confirmación |
| `marcarTarea`, `botar`, `cambiarMuelle` | Nuevos: hay que añadirlos a `core/projects.js` |
| `citar` | `newEventBody` de `core/gcal.js` |
| `responder` | Es un **guion de demo**. El real es el asistente (`core/assistant.js`, `core/converse.js`) |
| botella | `topProposal` / `applyProposal` / `recordOutcome` de `core/proposals.js` |

## Lo que el prototipo no cubre
Tu nube, avisos push, permisos y conexiones, Google, Spotify, Atajos, Refugio, diario, archivo. Siguen como
están en la app; en Tú aparecen como «Sala de máquinas».
