# Decision Register

## BRAIN-00

- ~~PWA local-first como primera interfaz.~~ Sustituida por ADR-0007 (2026-09-28).
- MANU BRAIN independiente de proveedores de IA.
- Cifrado de contenido en el cliente antes de sync remoto.
- Fuentes originales inmutables y derivados regenerables.
- Modelo relacional con proyección de grafo; sin Neo4j.
- Búsqueda textual antes de embeddings.
- IA y MCP opcionales, con lectura mínima y aprobación para escrituras.
- Ningún servicio con facturación automática en el MVP.
- BRAIN-01 preparado, pero no autorizado hasta decisión de Manu.

## ADR-0007 (2026-09-28)

- App nativa de iPhone (SwiftUI) como experiencia principal y centro de configuración.
- Widgets, pantalla bloqueada, Centro de Control, botón de acción, Live Activities y App Intents desde las primeras fases.
- Modos (mañana, trabajo, fuera del trabajo, fin de semana) que cambian MANU OS; los cambios del sistema se apoyan en Focus y Atajos.
- Componente web/local-first opcional (D-01).
- Gate G-05 retirado; nuevos gates G-07 (finanzas), G-08 (grabaciones) y G-09 (superficies bloqueadas).

## Pendientes

- D-01: qué parte es SwiftUI nativa y qué parte, si existe, sigue siendo web; lenguaje del núcleo.
- D-02: almacenamiento local nativo y contenedor compartido con extensiones.
- D-03: Apple Developer Program.
- D-04: entorno de compilación y pruebas iOS.
- D-05: fuente de calendario del modo Trabajo.
- D-06: servicio meteorológico del modo Mañana.

Los detalles y consecuencias están en los documentos canónicos de `docs/`, sobre todo `docs/architecture/DECISIONS_AND_OPEN_ITEMS.md`.

## ADRs

- `docs/adr/0001-local-first-pwa.md` — SUPERSEDED por ADR-0007
- `docs/adr/0002-evidence-backed-knowledge.md` — ACCEPTED
- `docs/adr/0003-client-side-encryption.md` — ACCEPTED
- `docs/adr/0004-zero-cost-guardrails.md` — ACCEPTED
- `docs/adr/0005-relational-graph-projection.md` — ACCEPTED
- `docs/adr/0006-optional-agents-and-approvals.md` — ACCEPTED
- `docs/adr/0007-native-iphone-first.md` — ACCEPTED
