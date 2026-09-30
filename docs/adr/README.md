# Architecture Decision Records

Los ADR conservan decisiones técnicas importantes, su contexto y sus consecuencias. Una decisión aceptada no se reescribe para ocultar cambios: si queda obsoleta, un ADR nuevo la sustituye y ambos permanecen.

Estados permitidos:

- `PROPOSED`
- `ACCEPTED`
- `SUPERSEDED`
- `REJECTED`

## Índice

- [ADR-0001 — PWA local-first como primera interfaz](0001-local-first-pwa.md) — `SUPERSEDED` por ADR-0007
- [ADR-0002 — Conocimiento basado en afirmaciones y evidencia](0002-evidence-backed-knowledge.md)
- [ADR-0003 — Cifrado del contenido antes de sincronizar](0003-client-side-encryption.md)
- [ADR-0004 — Coste operativo cero sin cobros automáticos](0004-zero-cost-guardrails.md)
- [ADR-0005 — Grafo como proyección relacional](0005-relational-graph-projection.md)
- [ADR-0006 — Agentes opcionales con aprobación de escrituras](0006-optional-agents-and-approvals.md)
- [ADR-0007 — Experiencia nativa de iPhone como prioridad](0007-native-iphone-first.md)
- [ADR-0008 — Retención, extracción y borrado controlado de fuentes](0008-source-retention-and-controlled-deletion.md) — complementa ADR-0002
- [ADR-0009 — Asistente MANU con núcleo determinista y modelos opcionales](0009-manu-assistant-without-mandatory-ai.md)
- [ADR-0010 — Contratos de conocimiento en Swift](0010-swift-knowledge-contracts.md)
- [ADR-0011 — Almacenamiento local nativo, claves y contenedor compartido (D-02)](0011-native-local-storage-and-keys.md)
- [ADR-0012 — App web instalable como vía operativa mientras la nativa no se puede instalar](0012-installable-web-app-as-operational-path.md) — modifica D-01 y ADR-0007
- [ADR-0013 — IA opcional con Gemini y servicios de Google en la app web](0013-optional-gemini-and-google-services.md) — complementa ADR-0009 y ADR-0012
- [ADR-0014 — Spotify en el altavoz «baño» y MANU como centro de accesos](0014-spotify-and-app-hub.md) — complementa ADR-0012 y ADR-0013
- [ADR-0015 — Gmail con acceso de modificación](0015-gmail-full-access.md) — complementa ADR-0013
- [ADR-0016 — Tu archivo y conectores de vida](0016-life-archive-and-connectors.md) — complementa ADR-0013 y ADR-0015
- [ADR-0017 — Tu nube: sincronización con Supabase (enmienda WEB-67: código por correo, sin cifrar)](0017-encrypted-sync-supabase.md) — complementa ADR-0012 y ADR-0013
