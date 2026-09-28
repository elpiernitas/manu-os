# Decision Register

## BRAIN-00

- PWA local-first como primera interfaz.
- MANU BRAIN independiente de proveedores de IA.
- Cifrado de contenido en el cliente antes de sync remoto.
- Fuentes originales inmutables y derivados regenerables.
- Modelo relacional con proyección de grafo; sin Neo4j.
- Búsqueda textual antes de embeddings.
- IA y MCP opcionales, con lectura mínima y aprobación para escrituras.
- Ningún servicio con facturación automática en el MVP.
- BRAIN-01 preparado, pero no autorizado hasta decisión de Manu.

Los detalles y consecuencias están en los documentos canónicos de `docs/`.

## ADRs aceptados

- `docs/adr/0001-local-first-pwa.md`
- `docs/adr/0002-evidence-backed-knowledge.md`
- `docs/adr/0003-client-side-encryption.md`
- `docs/adr/0004-zero-cost-guardrails.md`
- `docs/adr/0005-relational-graph-projection.md`
- `docs/adr/0006-optional-agents-and-approvals.md`
