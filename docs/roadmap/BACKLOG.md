# Backlog técnico

## Regla de selección

Solo puede existir una tarea de implementación `IN_PROGRESS`. Una fase no empieza hasta cumplir sus dependencias y gates.

| Fase | Resultado | Depende de | Estado |
| --- | --- | --- | --- |
| BRAIN-00 | charter, arquitectura, seguridad y roadmap | — | COMPLETED |
| BRAIN-01 | contratos de Source, Claim, Evidence y tiempo | BRAIN-00 | NOT_AUTHORIZED |
| BRAIN-02 | vault local y migraciones | BRAIN-01 | BLOCKED |
| BRAIN-03 | PWA y Capture local | BRAIN-02 | BLOCKED |
| BRAIN-04 | búsqueda, relaciones y explicación | BRAIN-03 | BLOCKED |
| BRAIN-05 | export y restore verificado | BRAIN-04 | BLOCKED |
| BRAIN-06 | cifrado y sync | BRAIN-05 | BLOCKED |
| BRAIN-07 | Atajo iOS/Mac | BRAIN-03, BRAIN-06 | BLOCKED |
| BRAIN-08 | importadores ChatGPT/Claude | BRAIN-05 | BLOCKED |
| BRAIN-09 | Google Calendar read-only | BRAIN-06 | BLOCKED |
| BRAIN-10 | HOME contextual | BRAIN-04, BRAIN-09 | BLOCKED |
| BRAIN-11 | MIRROR con fuentes | BRAIN-04, BRAIN-08 | BLOCKED |
| BRAIN-12 | hardening y decisión nativa | BRAIN-03–11 | BLOCKED |

## Gates transversales

- **G-01 Restore**: no cloud sync antes de restauración probada.
- **G-02 OAuth**: no scopes reales antes de revocación y token threat model.
- **G-03 Personal data**: no corpus real antes de export, borrado y cifrado aplicables.
- **G-04 Agent writes**: no acciones externas sin propuesta, auditoría y aprobación.
- **G-05 Native**: no companion nativo sin dos capacidades de valor imposibles por PWA/Atajos.
- **G-06 Cost**: no servicio sin degradación por cuota y barrera de gasto.

## Preparado, no iniciado

La especificación de BRAIN-01 existe en `BRAIN_01_TASK.md`. Su existencia no autoriza ejecutarla.
