# 06 — Roadmap, repositorio y protocolo

## Roadmap técnico

### BRAIN-00 — definición

Este expediente. Salida: charter, arquitectura, seguridad, datos, integraciones, MVP, repo y tarea inicial.

### BRAIN-01 — contratos del conocimiento

Paquete TypeScript puro con Source, Fragment, Entity, Claim, Evidence, temporalidad, sustitución y tests. Sin UI, red, OAuth ni datos reales.

### BRAIN-02 — local vault

Persistencia IndexedDB detrás de `LocalStore`, migraciones, transacciones, hashes y fixtures. Tests de cierre/reapertura y corrupción controlada.

### BRAIN-03 — Capture local

PWA instalable con captura de texto/enlace/archivo seleccionado, Inbox y funcionamiento offline. Diseño inicial Apple-like con accesibilidad.

### BRAIN-04 — búsqueda y evidencia

Índice textual local, filtros, detalle de fuente y «por qué está conectado». MIND como lista/grafo filtrado, sin visualización masiva.

### BRAIN-05 — export/restore

Portable ZIP, snapshot técnico, checksums y restauración en perfil limpio. Gate obligatorio antes de cloud sync.

### BRAIN-06 — cifrado y sync

Vault encryption, event log, adaptador de sync falso primero; después Worker/D1 mínimo y/o Drive appData. Conflictos y revocación de dispositivo.

### BRAIN-07 — Atajos iOS/Mac

Atajo firmado/documentado de captura desde Share Sheet, deep link/endpoint y onboarding de instalación.

### BRAIN-08 — importadores históricos

ChatGPT y Claude con fixtures anonimizados, preservación de raw y reportes de compatibilidad.

### BRAIN-09 — Google Calendar

OAuth incremental y calendario read-only elegido. Solo después de probar revocación y no filtrar tokens.

### BRAIN-10 — HOME contextual

Ahora, Inbox, próximos eventos y proyectos activos con ranking explicable y controles de ocultación.

### BRAIN-11 — MIRROR read-only

Recuperación con fuentes, clasificación y respuesta determinista. Modelo externo opcional solo tras aprobación del lote de evidencia.

### BRAIN-12 — hardening y companion decision

QA iPhone/Mac, threat model revisado, restore real, performance, accesibilidad y decisión basada en evidencia sobre app nativa.

## Gates

- No sync antes de export/restore probado.
- No integración OAuth antes de token threat model y revocación probada.
- No MIRROR generativo antes de evidencia visible y logs de divulgación.
- No app nativa antes de demostrar al menos dos capacidades valiosas imposibles por PWA/Atajos.
- No datos personales reales en desarrollo hasta cifrado, export y política de borrado.

## Estructura inicial del repositorio

```text
manu-os/
  AGENTS.md
  README.md
  package.json
  pnpm-workspace.yaml
  .editorconfig
  .gitignore
  .env.example
  .github/
    workflows/ci.yml
    pull_request_template.md
  apps/
    web/                       # PWA React (se crea en BRAIN-03)
    api/                       # Worker de referencia (BRAIN-06)
  packages/
    brain-domain/              # entidades, claims, reglas temporales
    brain-storage/             # puertos y adaptadores locales
    brain-sync/                # eventos y transporte
    brain-importers/           # ChatGPT/Claude/etc.
    brain-agent-protocol/      # comandos y MCP, más adelante
    shared/                    # utilidades estrictamente comunes
  docs/
    product/PRODUCT_CHARTER.md
    architecture/ARCHITECTURE.md
    architecture/DATA_MODEL.md
    security/THREAT_MODEL.md
    integrations/INTEGRATIONS.md
    roadmap/ROADMAP.md
    adr/
  ai/
    PROJECT_STATE.md
    CURRENT_TASK.md
    HANDOFF.md
    QA_REPORT.md
    DECISIONS.md
  fixtures/
    synthetic/                 # nunca datos personales reales
  tools/
    verify/
```

`apps/` puede estar vacío durante BRAIN-01. No se generarán scaffolds que todavía no se usan.

## Documentación canónica

- ADR: decisiones de arquitectura estables y sus consecuencias.
- `ai/PROJECT_STATE.md`: versión corta del estado real, actualizado después de merge.
- `ai/CURRENT_TASK.md`: un único encargo activo, con alcance y acceptance criteria.
- `ai/HANDOFF.md`: qué cambió, comandos ejecutados, resultados y NO VERIFICADO.
- `ai/QA_REPORT.md`: revisión independiente; no lo redacta como «aprobado» el mismo actor que implementa.
- Issues/PR: historial operativo; nunca reemplazan contratos canónicos.

## Protocolo ChatGPT ↔ Claude ↔ GitHub

1. ChatGPT define una tarea pequeña en `ai/CURRENT_TASK.md` y criterios verificables.
2. Manu autoriza login/acción externa solo si hace falta.
3. Claude crea rama `brain/NN-descripcion`; nunca trabaja en `main`.
4. Claude lee `AGENTS.md`, documentos canónicos y tarea antes de editar.
5. Claude implementa solo el alcance, ejecuta checks y actualiza `HANDOFF.md`.
6. Claude abre PR con evidencia exacta; marca `NO VERIFICADO` lo que no ejecutó.
7. ChatGPT revisa diff, arquitectura, seguridad y evidencia de tests por GitHub.
8. Si hay defectos, se devuelve la misma tarea con observaciones concretas.
9. QA ejecuta el recorrido relevante sin confiar solo en el handoff.
10. Tras aprobación, merge a `main`, actualización de `PROJECT_STATE.md` y selección del siguiente incremento.

## Política de esfuerzo de Claude

- Bajo/medio: formato, docs mecánicos y cambios triviales.
- Alto: implementación normal con varias capas o tests.
- Máximo: solo migraciones delicadas, criptografía, bugs no reproducibles o revisión de seguridad.

BRAIN-01 usa **alto**, no máximo: exige precisión de dominio pero tiene un alcance pequeño y sin infraestructura.

## Definition of Done general

- alcance y archivos cambiados coinciden con CURRENT_TASK;
- tests/lint/typecheck/build pasan;
- sin secretos ni datos reales;
- documentación y migraciones actualizadas;
- accesibilidad y seguridad revisadas cuando apliquen;
- handoff incluye comandos, salida resumida y limitaciones;
- QA reproduce los criterios desde un checkout limpio;
- no hay afirmaciones de funcionamiento sin evidencia.
