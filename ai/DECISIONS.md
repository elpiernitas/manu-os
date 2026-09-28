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

## Pendientes

- D-01: reparto SwiftUI/web y lenguaje del núcleo. **Recomendación documentada (no cerrada): núcleo Swift y apps SwiftUI para iPhone y Mac.**
- D-02: almacenamiento local nativo y contenedor compartido con extensiones.
- D-03: Apple Developer Program.
- D-04: entorno de compilación y pruebas; faltan datos del Mac y del iPhone.
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
