# CURRENT TASK — BRAIN-01

Status: **NOT_AUTHORIZED**. Este documento es una especificación preparada, no una autorización.

> **Revisión pendiente (ADR-0007, 2026-09-28).** Esta especificación se redactó cuando la PWA era la interfaz principal y el núcleo iba a ser TypeScript. Con la app nativa de iPhone como prioridad, el lenguaje y las herramientas (TypeScript, Zod, pnpm, Vitest) dependen de **D-01**. Antes de autorizar BRAIN-01 hay que:
>
> 1. cerrar D-01 (núcleo en Swift, en TypeScript o contrato compartido en ambos);
> 2. adaptar «Alcance permitido» y «Comandos de verificación esperados» a esa decisión;
> 3. conservar sin cambios los invariantes obligatorios y los 12 tests mínimos, que no dependen del lenguaje.
>
> El resto del documento se mantiene tal como se redactó en BRAIN-00.

## Encargo para Claude Opus 5.5

**Esfuerzo recomendado: alto. No máximo.**

Trabaja en el repositorio privado de MANU OS. Crea una rama nueva llamada `brain/01-knowledge-contracts`. No modifiques `main` directamente. No despliegues nada, no conectes servicios, no uses datos personales reales y no añadas UI.

### Objetivo

Implementar y demostrar el contrato mínimo, independiente de proveedor, para fuentes, afirmaciones, evidencia y conocimiento temporal de MANU BRAIN.

### Antes de escribir

1. Lee `AGENTS.md`, `docs/product/PRODUCT_CHARTER.md`, `docs/architecture/ARCHITECTURE.md`, `docs/architecture/DATA_MODEL.md`, `docs/security/THREAT_MODEL.md` y `ai/CURRENT_TASK.md`.
2. Resume en `ai/HANDOFF.md` cualquier contradicción que encuentres. Si una contradicción impide el trabajo, detente; si no, aplica la interpretación más conservadora y documéntala.
3. Comprueba el estado del repo y no sobrescribas cambios ajenos.

### Alcance permitido

- Configurar el monorepo mínimo con pnpm workspaces, TypeScript estricto, lint/format y Vitest si aún no existe.
- Crear `packages/brain-domain` sin dependencia de React, base de datos, red ni proveedor de IA.
- Implementar schemas Zod y tipos inferidos para:
  - `Source`
  - `SourceItem`
  - `Fragment`
  - `Entity`
  - `Claim`
  - `EvidenceLink`
  - `Activity`
  - `Agent`
  - clasificación y estados
  - valores tipados de Claim
- Implementar funciones puras:
  - `validateClaimEvidence`
  - `supersedeClaim`
  - `resolveCurrentClaims(at)`
  - `detectSupersessionCycle`
- Añadir fixtures sintéticos, incluido el ejemplo «nombre de proyecto X → Everours».
- Escribir ADR breve para las decisiones del contrato que no estén ya cerradas.
- Configurar CI de checks sin deploy y con permisos mínimos.

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

Define scripts raíz equivalentes a:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Si el primer install crea lockfile, documenta el comando exacto usado y vuelve a verificar con `--frozen-lockfile`.

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
