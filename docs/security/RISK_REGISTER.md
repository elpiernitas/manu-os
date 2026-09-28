# Risk Register

Escala: probabilidad e impacto de 1 (bajo) a 5 (crítico). El score inicial es `P × I` y no sustituye la revisión cualitativa.

Los riesgos R-15 a R-23 se añadieron el 2026-09-28 por [ADR-0007](../adr/0007-native-iphone-first.md). Sus valores de P e I son estimaciones iniciales sin evidencia y deben revisarse al cerrar D-01 a D-04.

Los riesgos R-24 a R-40 se añadieron el mismo día tras las decisiones de producto de Manu (`docs/product/EXPERIENCE.md`, ADR-0008, ADR-0009). También son estimaciones iniciales. R-33 está `ACCEPTED` porque Manu decidió explícitamente no usar bloqueo interno de Face ID.

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
| R-24 | el iPhone 14 no tiene botón de acción ni (modelo estándar) Dynamic Island; funciones pensadas para ellos no están disponibles | 5 | 2 | 10 | Centro de Control, pantalla bloqueada y Toque posterior; documentado como límite | OPEN |
| R-25 | el Mac Intel no puede ejecutar oficialmente el Xcode vigente; el runner gratuito permite verificar el núcleo pero no garantiza compilar, firmar e instalar la Beta en iOS 27 | 4 | 5 | 20 | D-04: `macos-26`/Xcode 26.6 para BRAIN-01; D-04B antes de BRAIN-02; presupuesto 0 € y sin Mac prestado | OPEN |
| R-26 | el chat MANU sin modelo no alcanza la naturalidad esperada y Manu deja de usarlo | 4 | 4 | 16 | ADR-0009; expectativas explícitas en la Beta 1; D-08 | OPEN |
| R-27 | datos sensibles enviados a un proveedor de modelo (gratuito o de pago) | 2 | 5 | 10 | G-13; contexto mínimo; registro de divulgación; exclusión por defecto de datos sensibles | OPEN |
| R-28 | borrado de originales con error: se borra lo que no se quería, se pierde contexto o el registro no refleja el resultado real | 3 | 4 | 12 | G-10; doble confirmación (MANU OS e iOS); registro del resultado real; conservar texto antes de borrar | OPEN |
| R-29 | descripción de capturas pobre sin modelo multimodal; la bandeja pierde valor | 4 | 3 | 12 | OCR + preguntas a Manu como fuente principal; D-08 | OPEN |
| R-30 | Refugio: daño emocional, respuesta inadecuada o crisis no detectada | 2 | 5 | 10 | G-12; no diagnosticar; priorizar ayuda humana (112, 024); revisión del protocolo | OPEN |
| R-31 | exposición o mal uso de datos de salud | 2 | 5 | 10 | G-11; permisos por tipo; etiquetado sensible; sin envío a proveedores | OPEN |
| R-32 | proactividad molesta o repetitiva que lleva a abandonar la app | 4 | 4 | 16 | presupuesto diario de interrupciones; aprendizaje de aceptadas/ignoradas; respetar Focus; nunca repetir | OPEN |
| R-33 | sin bloqueo interno de Face ID (decisión de Manu): quien tenga el iPhone o el Mac desbloqueado accede a todo, incluido Refugio y finanzas | 3 | 4 | 12 | riesgo **aceptado por Manu** (2026-09-28; responsable: Manu; decisión registrada en `DECISIONS_AND_OPEN_ITEMS.md`, sin ADR propio porque no cambia la arquitectura de cifrado de ADR-0003); depende del bloqueo del dispositivo y del cifrado; lo sensible no aparece en superficies bloqueadas | ACCEPTED |
| R-34 | datos de terceros (chats de WhatsApp, perfiles de personas, llamadas) tratados sin cuidado | 3 | 4 | 12 | etiquetado sensible; importación voluntaria; no convertir bromas en hechos; sin envío a proveedores | OPEN |
| R-35 | Spotify DJ y el Chromecast no se pueden automatizar como espera Manu | 4 | 2 | 8 | alternativa manual documentada; no prometer DJ; comprobar si Manu tiene Premium | OPEN |
| R-36 | el etiquetado de sensibilidad falla y lo sensible aparece en widgets, notificaciones o exportaciones compartibles | 3 | 4 | 12 | reglas deterministas; ante la duda, la etiqueta más protectora; tests de redacción | OPEN |
| R-37 | Beta 1 integrada: feedback tardío de Manu y muchas piezas a la vez | 3 | 4 | 12 | MVP técnico interno con QA; contenido condicional que puede salir de la beta; lista de exclusiones | OPEN |
| R-38 | interfaz lenta en el iPhone 14 o en el Mac Intel; Manu deja de usarla | 3 | 4 | 12 | presupuesto de rendimiento medido en BRAIN-02; pruebas en los dispositivos reales | OPEN |
| R-39 | detectar la llegada a casa exige ubicación en segundo plano: privacidad y batería | 3 | 3 | 9 | D-09; preferir automatización de Atajos o activación manual; permiso explícito | OPEN |
| R-40 | con cuenta gratuita, el límite de 10 App IDs y la caducidad de 7 días chocan con una app con varias extensiones | 4 | 3 | 12 | D-03; contar extensiones antes de BRAIN-03 | OPEN |
| R-41 | la derivación de clave Argon2id (D-02, [ADR-0011](../adr/0011-native-local-storage-and-keys.md)) depende de una dependencia Swift de terceros no fusionada todavía en `swift-crypto`; una vulnerabilidad o abandono de ese paquete afecta directamente a la protección del secreto de recuperación | 2 | 5 | 10 | fijar versión exacta y revisar el código antes de integrarla; alternativa nativa documentada (PBKDF2-HMAC-SHA256) si se prefiere cero dependencias; migrar a Argon2id nativo si `swift-crypto` lo incorpora | OPEN |

## Revisión

Este registro se actualiza al cerrar cada fase. Un riesgo pasa a `MITIGATED` solo con evidencia. Si se acepta conscientemente, debe enlazar un ADR y responsable.
