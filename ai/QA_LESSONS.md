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
