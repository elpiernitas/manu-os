# Decision Register

## BRAIN-00

- ~~PWA local-first como primera interfaz.~~ Sustituida por ADR-0007 (2026-09-28).
- MANU BRAIN independiente de proveedores de IA.
- Cifrado de contenido en el cliente antes de sync remoto.
- Fuentes originales inmutables y derivados regenerables. *(Precisado por ADR-0008.)*
- Modelo relacional con proyección de grafo; sin Neo4j.
- Búsqueda textual antes de embeddings.
- IA y MCP opcionales, con lectura mínima y aprobación para escrituras.
- Ningún servicio con facturación automática en el MVP.
- BRAIN-01 preparado, pero no autorizado hasta decisión de Manu.

## ADR-0007 (2026-09-28)

- App nativa de iPhone (SwiftUI) como experiencia principal y centro de configuración.
- Widgets, pantalla bloqueada, Centro de Control, Live Activities y App Intents desde las primeras fases. *(Botón de acción: no disponible en el iPhone 14.)*
- Modos que cambian contenido y comportamiento de MANU OS, no su apariencia; los cambios del sistema se apoyan en Focus y Atajos.
- Componente web/local-first opcional (D-01).
- Gate G-05 retirado; nuevos gates G-07 a G-09.

## Decisiones de producto de Manu (2026-09-28)

- Capa sobre iPhone y Mac; app de Mac con las mismas capacidades.
- Primera Beta integrada; MVP técnico interno previo.
- Cinco pestañas: Hoy, Agenda, MANU (central), Dinero y Tú.
- Identidad visual oscura y estable.
- Bandeja diaria de capturas con borrado confirmado de originales (ADR-0008).
- Chat MANU sin IA obligatoria; nivel conversacional opcional (ADR-0009).
- Clasificación de capturas siempre confirmada; en finanzas, categoría automática corregible.
- Mensajes automáticos solo por lista blanca.
- Sin bloqueo interno de Face ID (riesgo R-33 aceptado).
- Sincronización cifrada, copia semanal en el Mac y restauración desde el Mac.
- 0 € adicionales; suscripciones de consumo ≠ API.
- Fuera de alcance: armario digital, dieta, terapia.
- Nuevos gates G-10 a G-14.

## Decisiones cerradas tras verificar los dispositivos y tras BRAIN-02-PREP (2026-09-28)

- D-01: **DECIDIDA**. Núcleo Swift y apps SwiftUI para iPhone y Mac; Manu aceptó la recomendación. *(Esta sección corrige una entrada anterior de este archivo que seguía describiéndola como pendiente después de cerrarse.)*
- D-02: **DECIDIDA** ([ADR-0011](../docs/adr/0011-native-local-storage-and-keys.md)). SQLite del sistema tras `LocalStore`, Argon2id + Keychain para claves, App Group para el contenedor compartido (disponibilidad con cuenta gratuita `NO_VERIFICADO`, no bloquea el cierre de D-02).
- D-04: **PARCIALMENTE RESUELTA**. BRAIN-01 y las cuatro subfases de BRAIN-02 (incluido un proyecto Xcode real con Keychain, App Group y extensiones) se verifican en el runner `macos-26` contra iOS Simulator sin firma ni coste; solo firmar e instalar en el iPhone físico sigue bloqueado por D-04B (corrección del 2026-09-28 tras revisión externa del PR #5).

## Pendientes

- D-03: Apple Developer Program. Solo se pedirá a Manu si firmar en el iPhone físico con la cuenta gratuita demuestra que App Groups falla.
- D-04B: firma e instalación de un proyecto Xcode real en el iPhone físico (no su compilación/prueba en simulador, ya desbloqueada por D-04); gate futuro, no decisión pendiente ahora. Ningún runner de CI, gratuito o de pago, tiene acceso físico al iPhone; las rutas reales son un Mac de Manu compatible conectado al dispositivo, o TestFlight vía D-03 (con su propio gate de credenciales de firma), o reducir el alcance. El Mac de Manu no cumple hoy los requisitos oficiales de ningún Xcode actual.
- D-05: fuente de calendario.
- D-06: servicio meteorológico.
- D-07: transporte de sync.
- D-08: fuente de modelo para el nivel conversacional.
- D-09: detección de llegada a casa.

Los detalles están en `docs/architecture/DECISIONS_AND_OPEN_ITEMS.md`.

## ADRs

- `docs/adr/0001-local-first-pwa.md` — SUPERSEDED por ADR-0007
- `docs/adr/0002-evidence-backed-knowledge.md` — ACCEPTED (complementado por ADR-0008)
- `docs/adr/0003-client-side-encryption.md` — ACCEPTED
- `docs/adr/0004-zero-cost-guardrails.md` — ACCEPTED
- `docs/adr/0005-relational-graph-projection.md` — ACCEPTED
- `docs/adr/0006-optional-agents-and-approvals.md` — ACCEPTED
- `docs/adr/0007-native-iphone-first.md` — ACCEPTED (con notas posteriores)
- `docs/adr/0008-source-retention-and-controlled-deletion.md` — ACCEPTED
- `docs/adr/0009-manu-assistant-without-mandatory-ai.md` — ACCEPTED
- `docs/adr/0010-swift-knowledge-contracts.md` — ACCEPTED
- `docs/adr/0011-native-local-storage-and-keys.md` — ACCEPTED
