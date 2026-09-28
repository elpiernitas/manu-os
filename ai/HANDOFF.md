# HANDOFF

## Estado

BRAIN-00 está fusionado en `main` mediante el PR #1. BRAIN-01 está **COMPLETED Y FUSIONADO** en `main` mediante el PR #2, squash commit `a6a93e0`, tras revisión externa y revisión del orquestador.

## BRAIN-01 — resultado

Se implementó un Swift Package sin dependencias externas, UI, almacenamiento, red ni proveedor de IA.

### Cambios

- `Package.swift`: paquete y módulo `ManuBrainDomain`.
- `Sources/ManuBrainDomain/ManuBrainDomain.swift`:
  - UUIDv7 y timestamps ISO-8601 UTC;
  - Source, SourceItem, Fragment y SourceDeletionEvent;
  - Entity, Claim, EvidenceLink, Activity y Agent;
  - clasificaciones, estados y valores tipados;
  - validación de evidencia/confianza/modelos;
  - sustitución, detección de ciclos y resolución temporal;
  - `StrictJSON` para campos superiores desconocidos;
  - consulta honesta de disponibilidad del original.
- `Tests/ManuBrainDomainTests/KnowledgeContractTests.swift`: 12 casos obligatorios y uno adicional de ADR-0008.
- `.github/workflows/brain-01.yml`: runner `macos-26`, permisos `contents: read`, sin deploy y timeout de 15 minutos.
- ADR-0010 y actualización de los documentos de estado/tarea.

### Decisiones

- D-01: núcleo Swift compartible por iPhone y Mac.
- ADR-0008: retención explícita y ningún original descartado se presenta como disponible.
- ADR-0010: Swift Package, structs inmutables, funciones puras y cero dependencias externas.

### Verificación real

Runner: `macos-26-arm64`, macOS 26.6.2, Apple Swift 6.3.3.

Run fallido inicial: `36446223794`. Detectó que un inicializador que lanza error no satisface `RawRepresentable`; se eliminó esa conformidad sin relajar validación.

Run corregido: `36446466658` — SUCCESS.

- `swift package dump-package`: PASS.
- `swift build --build-tests`: PASS.
- `swift test --parallel`: PASS.
- Resultado: **13 tests, 1 suite, 13/13 PASS**.
- Foundation check del mismo commit: PASS.

Commits:
- `caf146c`: implementación inicial.
- `cde9fe4`: corrección de compilación.

### Riesgos

- `StrictJSON` solo protege si las entradas externas usan ese límite; `JSONDecoder` directo sigue tolerando campos desconocidos.
- El test histórico conserva ambos structs en memoria; la persistencia real pertenece a BRAIN-02.
- El runner valida macOS ARM, no el iPhone 14 ni el Mac Intel de Manu.
- No se ha medido rendimiento porque el volumen de BRAIN-01 es mínimo.

## Revisión externa (2026-09-28)

Revisión del head `1941319` por Claude Code. Detalle completo en `ai/QA_REPORT.md`.

- Reproducido 13/13 PASS con Swift 6.3.3 en Linux x86_64.
- 10 defectos demostrados con pruebas ejecutables y corregidos en esta rama, cada uno con test de regresión: creador de la Claim no comprobado, Claims de modelo visibles, sustitución que invierte o amplía la vigencia o resucita Claims rechazadas, Claims en disputa resueltas en silencio, `hasOriginal` que ignora la política de retención, aborto con IDs duplicados en la detección de ciclos, falta de `init` públicos y timestamps no UTC o imposibles aceptados.
- Archivos: `Sources/ManuBrainDomain/ManuBrainDomain.swift`, `Package.swift` (target `ManuBrainDomainPublicAPITests`), `Tests/ManuBrainDomainTests/ReviewRegressionTests.swift`, `Tests/ManuBrainDomainPublicAPITests/PublicAPITests.swift`, `.gitignore`, `ai/QA_REPORT.md`, `ai/HANDOFF.md`.
- Comandos: `swift package dump-package` PASS; `swift build --build-tests` PASS sin warnings; `swift test --parallel` **31/31 PASS en 3 suites** (Linux x86_64 en local y GitHub Actions `macos-26`, run `36451712052`).
- Observaciones no bloqueantes documentadas en `ai/QA_REPORT.md` para BRAIN-02.
- Revisión posterior del orquestador: se cerró el último hueco para que un agente `MODEL` solo pueda crear Claims `PROPOSED`; el test parametrizado cubre `ACTIVE`, `SUPERSEDED`, `CONTESTED`, `REJECTED` y `RETRACTED`. Commit `72aa272`; CI `macos-26` (run `36452298444`) **31/31 PASS en 3 suites** y Foundation check (run `36452298319`) PASS.

## BRAIN-02-PREP — resultado (PR #5, 2026-09-28)

Rama: `brain/02-preparation`. SHA revisado en esta entrega: se publica tras el commit de este cambio (ver PR #5).

### Cambios

- `docs/adr/0011-native-local-storage-and-keys.md` (nuevo): cierra D-02. SQLite del sistema tras el adaptador `LocalStore`, blobs por hash fuera de la base, `NSFileProtectionCompleteUntilFirstUserAuthentication`, DEK/KEK de ADR-0003 con Argon2id (dependencia mínima justificada) y Keychain (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`) para la clave desenvuelta, App Group para el contenedor compartido con las extensiones.
- `docs/adr/README.md`: añade ADR-0011 al índice.
- `docs/roadmap/BRAIN_02_TASK.md`: reescrito. Añade el resultado de la tarea: D-02 decidida, BRAIN-02 dividida en subfases 02a (persistencia y claves, sin Xcode, implementable en CI ya) a 02d (apps mínimas), y D-03/D-04B precisadas con el punto exacto en que necesitarán a Manu.
- `docs/roadmap/ROADMAP.md`, `docs/roadmap/BACKLOG.md`: referencian las subfases y el nuevo estado de D-02/D-03/D-04B.
- `docs/architecture/DECISIONS_AND_OPEN_ITEMS.md`: mueve D-02 a decisiones cerradas; reduce D-03 a "solo si BRAIN-02c lo demuestra necesario"; D-04B pasa a fila propia con el runner `xcode-27-xlarge` descartado por coste (no por prudencia).
- `docs/architecture/ARCHITECTURE.md`: sustituye los marcadores `(D-02)` pendientes por las decisiones concretas de ADR-0011 en las tablas de estado local, blobs y cifrado, y en la lista de capacidades de la app nativa.
- `docs/security/THREAT_MODEL.md`: la fila "extensión con acceso excesivo" referencia el diseño ya decidido del contenedor compartido; sigue `PENDIENTE` de implementación.
- `docs/security/RISK_REGISTER.md`: añade R-41 (dependencia Argon2id no nativa).
- `docs/research/SOURCES.md`: añade la sección de fuentes de D-02, incluida la limitación de que `support.apple.com` está bloqueado en este entorno y de que la lectura automática de `developer.apple.com` no pudo extraer contenido real (JavaScript); cada afirmación queda marcada `NO_VERIFICADO` cuando no se pudo confirmar contra la fuente primaria.
- `ai/DECISIONS.md`: corrige una entrada desactualizada (D-01 seguía descrita como pendiente pese a estar decidida) y añade D-02 a decisiones cerradas; añade ADR-0010 y ADR-0011 a la lista de ADR, que faltaban.
- `ai/PROJECT_STATE.md`, `ai/CURRENT_TASK.md`, `ai/HANDOFF.md`, `docs/roadmap/BACKLOG.md`: reflejan el nuevo estado.

### Decisiones tomadas por Claude Code dentro del alcance autorizado

- D-02 cerrada mediante ADR-0011 (ver arriba). Se documenta como decisión técnica reversible, no como algo que requiriera a Manu.
- La entitlement App Groups con cuenta Apple gratuita no tiene fuente verificada concluyente: se documenta como bloqueo de una subfase concreta (BRAIN-02c), no de todo D-02 ni de D-03.
- El runner `xcode-27-xlarge` queda descartado por coste (evidencia: documentación de facturación de GitHub Actions sobre runners "xlarge"), cerrando esa rama de D-04B sin necesidad de involucrar a Manu.

### Fuentes consultadas

Ver `docs/research/SOURCES.md`, sección "Almacenamiento local, claves y contenedor compartido (D-02, añadidas por ADR-0011)". Limitación registrada: el entorno de Claude Code en la nube no puede leer el contenido real de `developer.apple.com` (páginas dependientes de JavaScript) ni acceder a `support.apple.com` (bloqueado por el proxy de red); las afirmaciones que dependían de esas páginas se contrastaron con resultados de búsqueda de terceros y foros oficiales de Apple Developer, y se marcan `NO_VERIFICADO` cuando no hubo una fuente primaria concluyente.

### Checks ejecutados

- Comprobación de enlaces relativos Markdown en `docs/` y `ai/` (35 archivos, script Python ad hoc con `os.path`): **0 enlaces rotos**, ejecutada dos veces (antes y después de las ediciones finales).
- Revisión manual de IDs: sin ADR duplicados (`ls docs/adr` sin colisiones de número), R-41 añadido una sola vez y coherente entre `RISK_REGISTER.md` y `ADR-0011`, D-02/D-03/D-04B con el mismo estado en `DECISIONS_AND_OPEN_ITEMS.md`, `BACKLOG.md`, `ROADMAP.md`, `BRAIN_02_TASK.md`, `ai/PROJECT_STATE.md` y `ai/DECISIONS.md`.
- No hay comandos de build/test que ejecutar: esta tarea es exclusivamente documental, sin código de producto ni cambios en `Package.swift`/`Tests/`.

### Riesgos

- R-41 (nuevo): dependencia Argon2id de terceros no fusionada en `swift-crypto`.
- La recomendación de ADR-0011 no se ha probado en ningún dispositivo ni Xcode real; todo lo que menciona Keychain, App Group o protección de archivo sigue `TEÓRICAMENTE_POSIBLE` hasta implementarse en BRAIN-02b/02c.

### NO VERIFICADO (de esta tarea)

- Si App Groups funciona con una cuenta Apple gratuita (Personal Team): evidencia contradictoria en foros oficiales, sin fuente primaria concluyente accesible desde este entorno.
- El estado exacto de deprecación de `kSecAttrAccessibleAlways`/`AlwaysThisDeviceOnly`.
- Si el Mac de Manu (`MacBookPro14,2`, Sonoma 14.8.7) rechaza instalar o ejecutar Xcode 26/27 en la práctica (la conclusión sigue apoyada solo en las listas de compatibilidad publicadas por Apple, no en una prueba directa).
- Cualquier comportamiento de SQLite, CryptoKit, Keychain o Argon2id en un binario real: nada de esto se ha compilado ni ejecutado en este entorno.

### Bloqueo humano concreto que queda abierto

Antes de empezar BRAIN-02b (primer proyecto Xcode real), Manu debe elegir entre: (a) aceptar el coste de un runner macOS de pago con un importe concreto a cotizar en ese momento, (b) posponer BRAIN-02b–02d hasta disponer de un Mac compatible con Xcode actual, o (c) reducir el alcance nativo de la Beta 1. Esta tarea no elige por él porque las tres opciones tienen coste, tiempo o alcance de producto. D-03 no se pregunta todavía: solo se convertirá en pregunta a Manu si BRAIN-02c demuestra en el dispositivo que la cuenta gratuita no permite App Groups.

## NO VERIFICADO

- Integración con almacenamiento, cifrado, sync, UI o extensiones.
- Compilación, firma o instalación de una app iOS/macOS.
- Comportamiento en dispositivos reales.

## Próximo paso

BRAIN-02-PREP quedó ejecutada por Claude Code conforme a `docs/roadmap/BRAIN_02_TASK.md` (ver sección "BRAIN-02-PREP — resultado" arriba). El orquestador revisa el PR #5 y decide el merge; si lo aprueba, debe abrir inmediatamente el siguiente trabajo autorizado (candidato natural: BRAIN-02a, ya que no tiene bloqueos técnicos pendientes, solo falta autorización explícita de código de producto) o señalar el único bloqueo humano concreto que quedó abierto (D-04B, ver arriba).
