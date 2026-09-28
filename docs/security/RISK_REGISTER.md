# Risk Register

Escala: probabilidad e impacto de 1 (bajo) a 5 (crítico). El score inicial es `P × I` y no sustituye la revisión cualitativa.

Los riesgos R-15 a R-23 se añadieron el 2026-09-28 por [ADR-0007](../adr/0007-native-iphone-first.md). Sus valores de P e I son estimaciones iniciales sin evidencia y deben revisarse al cerrar D-01 a D-04.

| ID | Riesgo | P | I | Score | Mitigación/gate | Estado |
| --- | --- | ---: | ---: | ---: | --- | --- |
| R-01 | pérdida o evicción del almacenamiento local (web o nativo; en nativo también por borrar la app o por caducidad de la instalación, ver R-21) | 3 | 5 | 15 | export/restore antes de datos reales; sync posterior | OPEN |
| R-02 | UX de claves demasiado compleja | 4 | 4 | 16 | prototipo y prueba real antes de fijar esquema | OPEN |
| R-03 | XSS con vault desbloqueado | 3 | 5 | 15 | CSP, sin scripts remotos, dependencias mínimas | OPEN |
| R-04 | scope Google excesivo | 3 | 5 | 15 | OAuth incremental y read-only primero | OPEN |
| R-05 | refresh token expira/revoca | 4 | 3 | 12 | estado de reconexión como flujo normal | OPEN |
| R-06 | sync crea conflictos silenciosos | 3 | 5 | 15 | event log, idempotencia y conflictos visibles | OPEN |
| R-07 | prompt injection desde corpus | 4 | 5 | 20 | datos ≠ instrucciones; allowlist y approvals | OPEN |
| R-08 | inferencia presentada como hecho | 3 | 5 | 15 | clasificación, estado PROPOSED y evidencia | OPEN |
| R-09 | dependencia del proveedor cloud | 2 | 4 | 8 | adaptadores y export abierto | OPEN |
| R-10 | cobro automático inesperado | 2 | 5 | 10 | sin billing; hard limits; G-06 | OPEN |
| R-11 | deriva hacia UI/IA antes del núcleo; con ADR-0007, también hacia widgets y modos antes de captura, evidencia y restore | 4 | 4 | 16 | roadmap secuencial, CURRENT_TASK único, BRAIN-05 como gate de datos reales | OPEN |
| R-12 | secretos o datos reales en Git | 2 | 5 | 10 | gitignore, revisión, secret scanning | OPEN |
| R-13 | app nativa duplica lógica (reevaluado por ADR-0007: antes P=2, score 8) | 3 | 4 | 12 | cerrar D-01; si hay dos implementaciones del núcleo, mismos vectores de test en ambas | OPEN |
| R-14 | backup existe pero no restaura | 3 | 5 | 15 | prueba en perfil limpio como gate | OPEN |
| R-15 | límites de iOS: sin launcher propio, sin cambios globales del sistema, extensiones con presupuesto de actualización y memoria, ejecución en segundo plano no garantizada, capacidades distintas según versión de iOS y modelo de iPhone | 4 | 3 | 12 | modos actúan sobre MANU OS; Focus y Atajos para lo demás; toda función accesible desde la app; probar en el iPhone real | OPEN |
| R-16 | permisos denegados, retirados o pedidos de forma que generen desconfianza (calendario, micrófono, voz, fotos, ubicación, notificaciones) | 3 | 3 | 9 | pedir al usar la función, texto claro, degradación visible, test de retirada de permiso en el MVP | OPEN |
| R-17 | información financiera: extracción errónea de movimientos, exposición de datos bancarios, envío a modelos externos o insights presentados como hechos | 3 | 5 | 15 | G-07; movimientos `PROPOSED` hasta confirmación; nada en superficies bloqueadas; sin Open Banking en MVP | OPEN |
| R-18 | grabaciones y transcripciones: grabar sin consentimiento de todos los participantes, requisitos legales, datos de terceros, retención excesiva | 3 | 5 | 15 | G-08; consentimiento explícito; revisión legal aplicable; retención definida; procesamiento en el dispositivo | OPEN |
| R-19 | la grabación de llamadas telefónicas no es viable técnicamente desde una app de terceros en iOS | 4 | 3 | 12 | BRAIN-14 como estudio; aceptar importar solo audio que Manu comparta; no prometer la función | OPEN |
| R-20 | dependencia de integraciones externas (Apple, Google, tiempo, música, bancos): cambios de API, cuotas, costes, revocaciones o cierre | 3 | 4 | 12 | adaptadores, degradación visible, integraciones de una en una, sin integraciones obligatorias para el núcleo | OPEN |
| R-21 | aprovisionamiento: con cuenta gratuita la app puede dejar de abrirse al caducar el perfil; sin Apple Developer Program algunas capacidades pueden no estar disponibles | 4 | 4 | 16 | decidir D-03; export/restore probado antes de datos reales; instrucciones de reinstalación | OPEN |
| R-22 | el entorno de Claude Code en la nube no compila ni prueba apps iOS; riesgo de declarar como funcional algo no probado | 5 | 3 | 15 | decidir D-04; verificación en dispositivo por Manu o runner macOS; `NO_VERIFICADO` explícito en cada handoff | OPEN |
| R-23 | exposición de datos en widgets, pantalla bloqueada, Live Activities y notificaciones | 3 | 4 | 12 | G-09; snapshot mínimo; clasificación de sensibilidad por tipo de dato; redacción por defecto | OPEN |

## Revisión

Este registro se actualiza al cerrar cada fase. Un riesgo pasa a `MITIGATED` solo con evidencia. Si se acepta conscientemente, debe enlazar un ADR y responsable.
