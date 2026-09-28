# Risk Register

Escala: probabilidad e impacto de 1 (bajo) a 5 (crítico). El score inicial es `P × I` y no sustituye la revisión cualitativa.

| ID | Riesgo | P | I | Score | Mitigación/gate | Estado |
| --- | --- | ---: | ---: | ---: | --- | --- |
| R-01 | pérdida o evicción del almacenamiento web | 3 | 5 | 15 | export/restore antes de datos reales; sync posterior | OPEN |
| R-02 | UX de claves demasiado compleja | 4 | 4 | 16 | prototipo y prueba real antes de fijar esquema | OPEN |
| R-03 | XSS con vault desbloqueado | 3 | 5 | 15 | CSP, sin scripts remotos, dependencias mínimas | OPEN |
| R-04 | scope Google excesivo | 3 | 5 | 15 | OAuth incremental y read-only primero | OPEN |
| R-05 | refresh token expira/revoca | 4 | 3 | 12 | estado de reconexión como flujo normal | OPEN |
| R-06 | sync crea conflictos silenciosos | 3 | 5 | 15 | event log, idempotencia y conflictos visibles | OPEN |
| R-07 | prompt injection desde corpus | 4 | 5 | 20 | datos ≠ instrucciones; allowlist y approvals | OPEN |
| R-08 | inferencia presentada como hecho | 3 | 5 | 15 | clasificación, estado PROPOSED y evidencia | OPEN |
| R-09 | dependencia del proveedor cloud | 2 | 4 | 8 | adaptadores y export abierto | OPEN |
| R-10 | cobro automático inesperado | 2 | 5 | 10 | sin billing; hard limits; G-06 | OPEN |
| R-11 | deriva hacia UI/IA antes del núcleo | 4 | 4 | 16 | roadmap secuencial y CURRENT_TASK único | OPEN |
| R-12 | secretos o datos reales en Git | 2 | 5 | 10 | gitignore, revisión, secret scanning | OPEN |
| R-13 | app nativa duplica lógica | 2 | 4 | 8 | MANU BRAIN independiente y bridge definido | OPEN |
| R-14 | backup existe pero no restaura | 3 | 5 | 15 | prueba en perfil limpio como gate | OPEN |

## Revisión

Este registro se actualiza al cerrar cada fase. Un riesgo pasa a `MITIGATED` solo con evidencia. Si se acepta conscientemente, debe enlazar un ADR y responsable.
