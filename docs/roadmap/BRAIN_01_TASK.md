# CURRENT TASK — BRAIN-01

Status: **IMPLEMENTED_AWAITING_REVIEW**. Los 13 tests pasan en el run `36446466658`; falta revisión externa y merge.

> **Revalidación cerrada (2026-09-28).** D-01 elige un núcleo Swift y apps SwiftUI. BRAIN-01 se implementa como Swift Package independiente de UI y se verifica en GitHub Actions `macos-26`. Se conservan los invariantes y los 12 tests, y se añaden los contratos de retención de ADR-0008.


## Encargo autorizado para el implementador

Trabaja en el repositorio privado de MANU OS. Crea una rama nueva llamada `brain/01-knowledge-contracts`. No modifiques `main` directamente. No despliegues nada, no conectes servicios, no uses datos personales reales y no añadas UI.

### Objetivo

Implementar y demostrar el contrato mínimo, independiente de proveedor, para fuentes, afirmaciones, evidencia y conocimiento temporal de MANU BRAIN.

### Antes de escribir

1. Lee `AGENTS.md`, `docs/product/PRODUCT_CHARTER.md`, `docs/architecture/ARCHITECTURE.md`, `docs/architecture/DATA_MODEL.md`, `docs/security/THREAT_MODEL.md` y `ai/CURRENT_TASK.md`.
2. Resume en `ai/HANDOFF.md` cualquier contradicción que encuentres. Si una contradicción impide el trabajo, detente; si no, aplica la interpretación más conservadora y documéntala.
3. Comprueba el estado del repo y no sobrescribas cambios ajenos.

### Alcance permitido

- Crear un Swift Package raíz sin dependencias externas.
- Crear el módulo `ManuBrainDomain`, sin SwiftUI, base de datos, red ni proveedor de IA.
- Implementar contratos `Codable` y `Sendable` para Source, SourceItem, Fragment, SourceDeletionEvent, Entity, Claim, EvidenceLink, Activity, Agent, clasificaciones, estados y valores tipados.
- Implementar las funciones puras obligatorias de validación, sustitución, resolución temporal y detección de ciclos.
- Añadir fixtures totalmente sintéticos, incluido «X → Everours».
- Añadir ADR-0010 y CI sin deploy, con permisos mínimos y gasto 0 €.


### Fuera de alcance

- React/PWA, diseño, Home, MIND o MIRROR.
- IndexedDB, base de datos, Cloudflare, Google, OAuth o sync.
- cifrado real o gestión de claves.
- MCP o llamadas a modelos.
- generadores de embeddings.
- importadores de exports reales.
- subir datos personales de Manu.

### Invariantes obligatorios

- IDs UUIDv7 validados; timestamps ISO-8601 UTC.
- `valid_until >= valid_from`.
- HYPOTHESIS puede no tener evidencia; las demás clasificaciones requieren al menos una EvidenceLink para activarse.
- INFERENCE y HYPOTHESIS requieren `confidence` y `confidence_reason`.
- Una Claim creada por modelo entra como `PROPOSED`, nunca `ACTIVE` automáticamente.
- `supersedes_claim_id` no puede apuntar a sí misma ni formar ciclo.
- Superseder y superseded deben compartir subject + predicate, salvo error explícito.
- Source y SourceItem se modelan como contenido inmutable.
- No usar `any`; los JSON externos entran como `unknown` y se validan.

### Tests mínimos

1. Acepta FACT activa con evidencia.
2. Rechaza FACT activa sin evidencia.
3. Acepta HYPOTHESIS propuesta sin evidencia y con confianza.
4. Rechaza INFERENCE sin confianza o motivo.
5. Rechaza fechas de vigencia invertidas.
6. Rechaza autosustitución y ciclo A → B → A.
7. Cierra correctamente la vigencia de X al sustituirse por Everours.
8. `resolveCurrentClaims` devuelve X antes de la fecha del cambio y Everours después.
9. Conserva ambos claims en consulta histórica.
10. Un output de agente/modelo no queda ACTIVE automáticamente.
11. Los schemas rechazan campos desconocidos donde afecten a seguridad/integridad.
12. Serialización/deserialización mantiene igualdad semántica.

### Comandos de verificación esperados

```bash
swift package dump-package
swift build --build-tests
swift test --parallel
```

Se ejecutan en GitHub Actions `macos-26`. No se declara PASS hasta que los tres terminen con éxito.


### Entrega

- PR con título: `BRAIN-01: add evidence-backed temporal knowledge contracts`.
- `ai/HANDOFF.md` debe incluir:
  - resumen de cambios;
  - archivos añadidos/modificados;
  - decisiones/ADR;
  - comandos ejecutados y resultado real;
  - riesgos;
  - lista explícita de `NO VERIFICADO`;
  - commit y rama.
- No hagas merge.
- No declares PASS si un comando no terminó con éxito.

### Criterio de aceptación

La tarea termina cuando el paquete de dominio puede validar y resolver el ejemplo temporal usando solo funciones puras, los 12 casos mínimos pasan en CI y no existe ninguna dependencia de UI, nube, almacenamiento ni IA.
