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
