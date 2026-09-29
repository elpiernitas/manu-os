# QA LESSONS

Memoria acumulativa de errores confirmados y controles reutilizables para Claude Code y ChatGPT/Codex.

## Reglas

- Registrar solo fallos reproducidos o hallazgos respaldados por evidencia.
- Cada lección debe indicar el patrón, el control preventivo y la prueba asociada cuando exista.
- No incluir secretos, datos personales ni conversaciones completas.
- No sustituye a los ADR, gates, especificaciones ni criterios de aceptación.

## Lecciones confirmadas

### QAL-001 — Probar la API pública sin `@testable`

Un paquete puede pasar sus tests internos y seguir siendo inutilizable desde las apps consumidoras. Mantener al menos un target que importe el módulo como cliente externo y construya los tipos públicos necesarios.

### QAL-002 — Validar invariantes contra todos los estados

Una prueba con casos representativos puede omitir estados prohibidos. Para enums finitos que expresan seguridad o autorización, cubrir explícitamente cada caso permitido y cada caso rechazado.

### QAL-003 — Evitar diccionarios que aborten con IDs duplicados

Las entradas externas o compuestas pueden contener identificadores repetidos. La validación debe devolver un error controlado antes de construir estructuras que provoquen un fallo fatal.

### QAL-004 — Fechas estrictas en UTC y calendario real

No basta con validar el formato textual. Rechazar zonas distintas de UTC y fechas imposibles, y cubrirlas con regresiones.

### QAL-005 — Estados derivados no pueden reactivar datos inválidos

Las operaciones de sustitución o resolución temporal no deben reabrir claims rechazadas, retraídas o meramente propuestas, ni invertir o ampliar vigencias cerradas.

### QAL-006 — No confundir "necesita un proyecto Xcode" con "necesita firma o dispositivo"

Antes de declarar bloqueada por firma/Apple Developer Program/dispositivo físico cualquier tarea que solo implique compilar o probar un proyecto Xcode, comprobar primero si un build/test contra iOS Simulator basta: los runners `macos-*` de GitHub Actions ya traen Xcode y simuladores instalados, y un build de simulador (`CODE_SIGNING_ALLOWED=NO`) no exige firma, Apple ID ni Developer Program porque el simulador no aplica la autorización de entitlements por perfil de aprovisionamiento que sí exige un dispositivo físico. Esto incluye capacidades como Keychain y App Groups, ejercitables en simulador sin registrarlas contra un equipo de desarrollador real. El bloqueo real empieza donde empieza el dispositivo físico (firma, instalación, comportamiento real), no donde empieza Xcode.

### QAL-007 — Un runner de CI de pago no compra acceso a un dispositivo físico

"Aceptar el coste de un runner más grande/caro" no es una solución genérica a cualquier bloqueo de compilación o pruebas: un runner de CI, alojado o no, es una máquina virtual efímera sin acceso físico a ningún dispositivo. Para instalar o probar en un teléfono real concreto hace falta ese teléfono conectado a algo (un Mac local, o una ruta de distribución como TestFlight que el propio dispositivo instala desde los servidores de Apple). Antes de ofrecer "pagar por más CI" como opción para un bloqueo, comprobar si el bloqueo es de cómputo (un runner sí lo resuelve) o de acceso físico a hardware concreto (ningún runner lo resuelve).

Comprobación reproducible usada en MANU OS (heurística, no infalible — un grep no distingue afirmación de negación): `grep -rniE "runner[^.]*(puede|permite|instala|prueba|resuelve)[^.]*iphone" docs ai`. Cada coincidencia debe releerse: es correcta si describe lo que el runner resuelve en **simulador** o niega explícitamente que resuelva la instalación **física**; es una repetición del defecto si presenta al runner, con o sin coste, como capaz de instalar/probar en el dispositivo físico. Ver `ai/HANDOFF.md`, sección "BRAIN-02-PREP — segunda corrección tras revisión externa", para un ejemplo de esta revisión manual ya hecha.

### QAL-008 — Un disparador condicional en un documento puede contradecir una ruta ya listada en otro

Al describir una decisión pendiente (D-03, D-04B...) con "solo se activa si X falla", comprobar primero si el propio documento (u otro relacionado) ya lista una ruta alternativa que activa esa misma decisión por un motivo distinto e independiente de X. "Solo si falla la cuenta gratuita" y "TestFlight es una ruta real" no pueden coexistir si TestFlight exige esa misma decisión por sí sola, sin relación con si la cuenta gratuita falló. Antes de escribir "solo si", releer todas las rutas/alternativas ya documentadas para la misma fase y comprobar que ninguna activa la decisión por un camino distinto; si hay más de una, listarlas como disparadores independientes en vez de uno exclusivo. Comprobación reproducible usada en MANU OS: `grep -rn "solo si.*falla" docs ai` — cada coincidencia debe releerse junto con el resto del documento para confirmar que ninguna otra ruta ya documentada activa la misma decisión por un motivo distinto.

### QAL-010 — Una lista de palabras no es una garantía de privacidad

Un clasificador por palabras clave siempre deja pasar textos sensibles que no las contienen («tengo VIH», «me recetaron sertralina», «cobro 1500 al mes», un número de tarjeta). Si una función envía datos a un tercero, la garantía debe ser una confirmación explícita con el payload visible y un contexto mínimo por defecto. La lista de bloqueo solo reduce errores obvios y nunca se presenta como detección exhaustiva. Prueba: `web/tests/ai-google.test.js` («nothing is sent without explicit confirmation»).

### QAL-011 — Comprobar la arquitectura canónica antes de subir datos a la nube

Antes de implementar cualquier copia o sincronización remota, releer `ARCHITECTURE.md` y `THREAT_MODEL.md`: en MANU OS lo remoto es siempre texto cifrado. Un scope restringido (`drive.appdata`) limita quién ve el archivo, pero no sustituye al cifrado en el cliente. Prueba: `web/tests/ai-google.test.js` («remote backup never contains sensitive markers in clear») y la restauración en perfil limpio en el navegador.

### QAL-012 — Permisos incrementales: un scope por función

Pedir todos los scopes en el primer consentimiento contradice el mínimo privilegio y hace que una denegación rompa todo. Cada función pide su scope cuando se usa y falla de forma aislada. Prueba: `runServices` en `web/tests/ai-google.test.js`.

### QAL-013 — Tras una fusión squash, crear la rama siguiente desde el `main` remoto actualizado

Si la rama siguiente parte del commit previo a la fusión squash, el PR nuevo queda en conflicto («dirty») y GitHub no ejecuta los workflows de `pull_request`, así que no hay checks recuperables. Antes de empezar: `git fetch origin main && git checkout -B <rama> origin/main`, y comprobar `git log origin/main..HEAD` antes de abrir el PR.

### QAL-014 — No inferir borrado ni cierre desde un listado parcial

Si una sincronización deduce «ya no existe» o «se cerró» porque un elemento no aparece en la respuesta remota, antes tiene que haber leído la colección completa: paginar hasta agotar el token, protegerse de tokens repetidos y de un límite de páginas, y tratar cualquier listado incompleto como «no sé» (no cerrar ni borrar nada). Prueba: `web/tests/ai-google.test.js` («round 3: tasks on page 2 are never closed»).

### QAL-015 — En iOS, una ventana emergente por gesto

Safari de iOS solo permite abrir una ventana emergente, como el consentimiento OAuth, dentro del gesto del usuario. Encadenar varias peticiones de permiso tras `await` de red hace que la segunda y las siguientes fallen con «ventana cerrada». Hay que pedir en una sola ventana todo lo que ese gesto necesita, precargar el script del proveedor antes del toque y no abrir ventanas desde procesos en segundo plano. Evidencia: captura del iPhone de Manu (2026-09-29, Tasks y Contactos con «Se cerró la ventana de Google»). Prueba: el recorrido de navegador de WEB-08, «ONE consent window».


### QAL-016 — «Borrar todo» cubre también lo que vive fuera del vault

Si hay secretos guardados a propósito fuera del almacén principal, para que no entren en las copias (clave de Gemini, tokens y PKCE de Spotify), la acción «Borrar todos los datos» tiene que eliminarlos explícitamente de `localStorage` y `sessionStorage`. Reiniciar el vault no basta. Prueba: `web/tests/review-web06-08.test.js` (1) y el recorrido de navegador de WEB-13.

### QAL-017 — Distinguir la decisión humana de la inferencia importada

Un mismo campo (`inferred: false`) no puede significar a la vez «lo decidió Manu» y «lo dijo una regla importada»: la segunda regla corregida ya no se aplicaba. Las procedencias se marcan por separado (`ruled`) y solo la corrección de Manu es definitiva. Prueba: `review-web06-08.test.js` (3).

### QAL-018 — Identidades que no se reducen a un hash corto

Si un id sirve para descartar duplicados, un hash de 32 bits puede hacer que dos registros distintos colisionen y uno se pierda en silencio. Se usa la identidad completa como id, y los ids antiguos solo se aceptan si el registro guardado coincide de verdad. Prueba: `review-web06-08.test.js` (4 y 4b), con una colisión real encontrada por fuerza bruta.

### QAL-019 — Reproducir el ejemplo de un hallazgo externo antes de usarlo como fixture

En la revisión de ChatGPT del 2026-09-29, el defecto (posible colisión) era real, pero la pareja de filas de ejemplo no colisionaba en los commits revisados. Un fixture sin comprobar habría dado una regresión que pasa sin probar nada. Antes de convertir el ejemplo de un hallazgo en test, hay que ejecutarlo contra el código antiguo y ver que falla.

### QAL-020 — No reutilizar en contenedores globales un atributo que busca un manejador delegado

Si un manejador delegado usa `e.target.closest("[data-x]")` y se pone `data-x` en `body` o en otro ancestro común, cualquier toque coincide con ese ancestro y dispara la acción equivocada. En WEB-20, `body[data-tab]` hacía que tocar cualquier cosa volviese a Hoy. El estado global lleva un nombre propio (`data-screen`). Prueba: recorrido de navegador de WEB-20 («weather page: whole screen is the sky»).

### QAL-021 — Pasar todos los recorridos de navegador antes de fusionar, no solo los del cambio

WEB-22 se fusionó tras pasar su recorrido nuevo y 5 regresiones, pero no el recorrido de Drive, que apunta un gasto desde Dinero escribiendo primero el concepto. Ese recorrido habría mostrado que la hoja nueva cambiaba sola a «Tarea» y el gasto no se guardaba. Se detectó en WEB-23 y se corrigió con una regresión en el recorrido de la hoja. Antes de fusionar hay que ejecutar todos los recorridos existentes.

### QAL-022 — Ejecutar en local las mismas comprobaciones que CI antes del navegador

`npm test` no importa `web/app.js`, así que un error de sintaxis en una plantilla solo aparece al cargar la página. El CI ya ejecuta `node --check` sobre `app.js`, `sw.js` y `core/*.js`. En WEB-26, un recorrido de navegador falló por esa causa antes de publicar. Antes de los recorridos, hay que ejecutar en local el mismo bucle de `node --check`.


### QAL-023 — Al relajar un filtro de privacidad, separar antes lo que nunca debe salir

En WEB-28, al dejar que el ánimo fuera a la IA, «morir» y «refugio» estaban dentro del grupo «ánimo» y se habrían relajado con él. Además, «quiero morir» no activaba la ayuda de crisis. Antes de ampliar lo que se envía, hay que sacar a una categoría que nunca se permite lo que debe quedarse en el móvil (crisis y secretos), y probar frases reales de crisis contra el detector.

### QAL-024 — Probar el teclado de iOS con un viewport visual simulado, no solo con un viewport pequeño

WEB-26 dio por bueno el composer con el teclado abierto, pero en el iPhone quedaba tapado. En iOS, el teclado encoge solo `visualViewport`; `innerHeight` y el layout viewport no cambian, y `sticky` y `fixed` se anclan al layout viewport. Un recorrido de navegador que solo reduce la ventana no reproduce el fallo. Hay que simular `visualViewport` (altura y `offsetTop`) y comprobar la posición real del elemento frente al borde del teclado.

### QAL-025 — Cada módulo nuevo debe entrar en la caché de instalación del service worker

Cinco módulos añadidos entre WEB-22 y WEB-27 no estaban en `SHELL`, así que sin conexión la app podía no arrancar. Lo comprueba `web/tests/sw-shell.test.js`.

### QAL-026 — No usar globales del navegador cuyo nombre está importado

`app.js` importa `confirm` de `core/inbox.js`. En WEB-34, `confirm("¿Borrar…?")` llamó a esa función y lanzó «Unknown kind», en lugar de abrir el diálogo. Para los diálogos del navegador hay que usar `window.confirm` y `window.prompt`, y un recorrido debe pulsar cada botón de confirmación nuevo.

### QAL-027 — Al filtrar para un modelo, filtrar también lo que acompaña al texto (títulos, etiquetas)

En WEB-35 se filtraban los mensajes de cada fragmento, pero el título de la conversación («Claves») viajaba con él y hacía saltar el control global. Todo el texto que forma parte de la petición debe pasar el mismo filtro que el contenido. Y hay que probar con datos sintéticos que contengan crisis y secretos.
