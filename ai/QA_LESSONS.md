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

### QAL-009 — Calcular el contraste de cada token de color antes de usarlo como texto

Un color de marca que «parece» legible puede no alcanzar 4,5:1 sobre el fondo real. En MANU OS, el azul principal `#246BFD` da 4,44:1 sobre `#050608` y 4,07:1 sobre `#111318`, por debajo del mínimo para texto normal; solo es válido como relleno tras texto blanco (4,57:1). Antes de fijar un token como color de texto o icono fino, calcular su contraste WCAG contra cada fondo donde aparecerá y documentar el resultado junto al token (ver `Sources/ManuOSUI/Theme.swift`). Comprobación reproducible: fórmula de luminancia relativa WCAG 2.x sobre los valores hex de los tokens.
