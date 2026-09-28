# Backlog técnico

> Revisado el 2026-09-28 por [ADR-0007](../adr/0007-native-iphone-first.md). Las fases BRAIN-02, 03, 07, 09, 10 y 12 cambian de contenido y se añaden BRAIN-13 y BRAIN-14. El detalle del cambio está en `docs/roadmap/ROADMAP.md`.

## Regla de selección

Solo puede existir una tarea de implementación `IN_PROGRESS`. Una fase no empieza hasta cumplir sus dependencias y gates.

| Fase | Resultado | Depende de | Estado |
| --- | --- | --- | --- |
| BRAIN-00 | charter, arquitectura, seguridad y roadmap; revisión ADR-0007 | — | COMPLETED |
| BRAIN-01 | contratos de Source, Claim, Evidence y tiempo | BRAIN-00, D-01 | NOT_AUTHORIZED |
| BRAIN-02 | app nativa mínima, vault local y migraciones | BRAIN-01, D-02, D-03, D-04 | BLOCKED |
| BRAIN-03 | superficies del sistema y modos | BRAIN-02 | BLOCKED |
| BRAIN-04 | búsqueda, relaciones y explicación | BRAIN-02 | BLOCKED |
| BRAIN-05 | export y restore verificado | BRAIN-04 | BLOCKED |
| BRAIN-06 | cifrado y sync | BRAIN-05 | BLOCKED |
| BRAIN-07 | captura universal (Share Extension, audio, transcripción local) | BRAIN-03, BRAIN-05 | BLOCKED |
| BRAIN-08 | importadores ChatGPT/Claude | BRAIN-05 | BLOCKED |
| BRAIN-09 | calendario y modo Trabajo | BRAIN-03, BRAIN-06 | BLOCKED |
| BRAIN-10 | HOME contextual y modo Mañana | BRAIN-04, BRAIN-09 | BLOCKED |
| BRAIN-11 | MIRROR con fuentes | BRAIN-04, BRAIN-08 | BLOCKED |
| BRAIN-12 | hardening y decisión Mac/web | BRAIN-03–11 | BLOCKED |
| BRAIN-13 | finanzas | BRAIN-06, G-07 | BLOCKED |
| BRAIN-14 | llamadas y transcripciones | BRAIN-07, G-08 | BLOCKED |

## Gates transversales

- **G-01 Restore**: no cloud sync antes de restauración probada.
- **G-02 OAuth**: no scopes reales antes de revocación y token threat model.
- **G-03 Personal data**: no corpus real antes de export, borrado y cifrado aplicables.
- **G-04 Agent writes**: no acciones externas sin propuesta, auditoría y aprobación.
- ~~**G-05 Native**: no companion nativo sin dos capacidades de valor imposibles por PWA/Atajos.~~ Retirado por ADR-0007 (2026-09-28).
- **G-06 Cost**: no servicio sin degradación por cuota y barrera de gasto. Una suscripción explícita (Apple Developer Program) requiere decisión de Manu (D-03).
- **G-07 Finance**: no datos financieros reales antes de cifrado, export/restore, confirmación de cada movimiento extraído, exclusión de superficies bloqueadas y política de envío a modelos.
- **G-08 Recordings**: no grabación ni transcripción de llamadas antes de ruta técnica verificada, consentimiento de todos los participantes, revisión legal aplicable y política de retención.
- **G-09 Lock-screen surfaces**: no datos personales en widgets, Live Activities o notificaciones visibles con el iPhone bloqueado antes de clasificar la sensibilidad por tipo de dato y probar la redacción.

## Decisiones pendientes que bloquean fases

Detalle en `docs/architecture/DECISIONS_AND_OPEN_ITEMS.md`.

| ID | Decisión | Bloquea |
| --- | --- | --- |
| D-01 | qué parte es SwiftUI nativa y qué parte, si existe, sigue siendo web; lenguaje del núcleo | BRAIN-01, BRAIN-02 |
| D-02 | almacenamiento local nativo y contenedor compartido con extensiones | BRAIN-02 |
| D-03 | Apple Developer Program: sí o no | BRAIN-02 (aprovisionamiento), BRAIN-03 (algunas capacidades) |
| D-04 | entorno de compilación y pruebas iOS | BRAIN-02 |

## Preparado, no iniciado

La especificación de BRAIN-01 existe en `BRAIN_01_TASK.md`. Su existencia no autoriza ejecutarla, y debe revalidarse contra D-01 antes de autorizarse.
