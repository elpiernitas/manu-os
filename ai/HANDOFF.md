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

> **Corregido más abajo.** Esta sección de "bloqueo humano concreto" quedó desmentida por la revisión externa que sigue: no hacía falta esperar a un dispositivo real para BRAIN-02b–02d. Se conserva sin editar por trazabilidad; ver "BRAIN-02-PREP — corrección tras revisión externa" para el estado correcto.

## BRAIN-02-PREP — corrección tras revisión externa (mismo PR #5, commit posterior a `db3da24`)

Comentario de revisión de @elpiernitas (rol de orquestador ChatGPT/Codex delegado, ver `AGENTS.md`) en `db3da24e28c38135103238e8fcf4edb609456d0a`: señaló, con evidencia primaria, que la entrega anterior sobredimensionaba D-04B.

### Defecto confirmado

La versión anterior de esta tarea asumía que **cualquier** proyecto Xcode real necesita el Mac de Manu o un runner de pago, y bloqueaba BRAIN-02b–02d en bloque por D-04B, pidiendo además una decisión a Manu antes de empezar BRAIN-02b. Eso es incorrecto:

- El runner `macos-26` (el mismo que ya usa BRAIN-01) trae Xcode 26.6 con SDKs e imágenes de iOS Simulator instalados ([runner-images, README de `macos-26`](https://github.com/actions/runner-images/blob/main/images/macos/macos-26-Readme.md)).
- `xcodebuild` compila y ejecuta tests contra un destino de iOS Simulator sin firma, fijando `CODE_SIGNING_ALLOWED=NO` (y `CODE_SIGNING_REQUIRED=NO`, `CODE_SIGN_IDENTITY=""`), sin necesidad de Apple ID ni Developer Program.
- El simulador no aplica la autorización de entitlements por perfil de aprovisionamiento que sí exige un dispositivo físico, así que un build de simulador puede declarar y ejercitar Keychain, App Group y una extensión mínima sin registrarlos contra un equipo de desarrollador real.

Además, se corrigió una atribución técnica incorrecta: CryptoKit **no** expone PBKDF2 (solo AES-GCM/ChaChaPoly, SHA-2, HMAC, HKDF y firmas/acuerdo de claves); la implementación de Apple para PBKDF2 es `CCKeyDerivationPBKDF` en CommonCrypto. Una versión anterior de ADR-0011 atribuía la alternativa de cero dependencias a "CryptoKit/CommonCrypto" de forma intercambiable.

### Corrección aplicada

- `docs/adr/0011-native-local-storage-and-keys.md`: reescritas las secciones "Fuentes consultadas", "Gestión de claves" (atribución PBKDF2 → CommonCrypto), "Contenedor compartido con extensiones", "Consecuencias" y "Verificación" para separar (a) build/test en simulador dentro de `macos-26`, sin firma ni dispositivo, ya disponible; de (b) firma, instalación y comportamiento en el iPhone físico real, la única parte que sigue bloqueada por D-04B.
- `docs/roadmap/BRAIN_02_TASK.md`: reescrita la sección "Resultado". Las cuatro subfases (02a–02d) pasan a verificarse en simulador dentro de `macos-26`; se añade una fase transversal explícita "dispositivo real" como la única bloqueada por D-04B; se añade un criterio de verificación obligatorio (reproducible, no ejecutado todavía) como primer paso de BRAIN-02b: un job de CI que publique `xcodebuild -version`/`-showsdks` y compile+pruebe un target mínimo contra `iphonesimulator` con `CODE_SIGNING_ALLOWED=NO`; se elimina la petición a Manu antes de BRAIN-02b, movida a la fase de dispositivo real.
- `docs/architecture/DECISIONS_AND_OPEN_ITEMS.md`: D-02, D-04, D-03 y D-04B reescritas para la misma separación; D-04B pasa a describir específicamente "firma e instalación en el iPhone físico", no "compilación de un proyecto Xcode real".
- `docs/roadmap/BACKLOG.md`, `docs/roadmap/ROADMAP.md`: filas y descripción de BRAIN-02/D-03/D-04B actualizadas.
- `docs/security/RISK_REGISTER.md`: R-25 corregido (el runner gratuito sí compila y prueba en simulador, incluido App Group y extensiones; lo que no garantiza es firmar e instalar en el iPhone físico). R-22 no se tocó: describe el entorno de Claude Code en la nube, no el runner de GitHub Actions, y esa afirmación seguía siendo correcta.
- `docs/research/SOURCES.md`: nueva sección "Correcciones tras revisión externa del PR #5" con las fuentes que sustentan el fix (README del runner `macos-26`, TN2339 de Apple, foros oficiales sobre firma de simulador, y las fuentes sobre CryptoKit/CommonCrypto y PBKDF2).
- `ai/PROJECT_STATE.md`, `ai/DECISIONS.md`: actualizados a la misma separación.

### Verificación de la corrección

- Reproducido con búsquedas independientes: contenido del README de `macos-26` (Xcode 26.0.1–26.6, SDKs iOS 26.0–26.5, simuladores iPhone 17 Pro/Max e iPad instalados) y múltiples fuentes coincidentes (foros oficiales de Apple Developer, guías de CI de Codemagic/Bitrise) sobre `CODE_SIGNING_ALLOWED=NO` y sobre que el simulador no aplica la autorización de entitlements por perfil de aprovisionamiento.
- Reproducido que CryptoKit no expone PBKDF2 y que `CCKeyDerivationPBKDF` (CommonCrypto) es la función de Apple para ese caso.
- **No se ha creado ni ejecutado ningún job de CI real en este repositorio que confirme el build+test en simulador**: sigue prohibido crear un proyecto Xcode en esta tarea de preparación. Por eso la corrección documenta el hallazgo como razonamiento apoyado en fuentes primarias de GitHub y de Apple, y añade el job descrito arriba como criterio de aceptación obligatorio y reproducible de BRAIN-02b, en vez de declarar el build en simulador como ya verificado.
- Repetida la comprobación de enlaces relativos Markdown tras esta corrección: **0 enlaces rotos**.

### NO VERIFICADO (de esta corrección)

- El job de CI descrito como criterio de verificación de BRAIN-02b no se ha ejecutado: es razonamiento, no evidencia reproducida en este repositorio.
- Si registrar el App Group **contra un equipo de desarrollador real** (necesario solo para firmar e instalar en el iPhone físico) funciona con cuenta gratuita sigue sin fuente primaria concluyente, igual que antes de esta corrección.

### Bloqueo humano concreto (corregido)

Ya no hay ninguna pregunta pendiente a Manu antes de empezar BRAIN-02b: la verificación en CI/simulador de las cuatro subfases no tiene bloqueos técnicos. El único bloqueo humano concreto que queda es, exclusivamente, la fase de dispositivo real: cuando BRAIN-02b–02d estén verificadas en simulador y llegue el momento de firmar e instalar en el iPhone físico de Manu con iOS 27, deberá elegir entre (a) un runner macOS de pago con importe a cotizar en ese momento, (b) esperar a un Mac compatible, o (c) reducir el alcance nativo de la Beta 1.

> **Corregido más abajo.** La opción (a) de este párrafo es un error de categoría: ningún runner de CI, gratuito o de pago, tiene acceso físico al iPhone. Se conserva sin editar por trazabilidad; ver "BRAIN-02-PREP — segunda corrección tras revisión externa" para el estado correcto.

## BRAIN-02-PREP — segunda corrección tras revisión externa (mismo PR #5, commit posterior a `f82a16a`)

Segundo comentario de revisión de @elpiernitas en `f82a16a3e20288694378eb05ef78dc58b784143e` (ronda 2/6 del PR, ronda 1/3 sobre ese head): la separación CI/simulador vs. dispositivo físico y la corrección de PBKDF2 quedaron bien aplicadas, pero D-04B seguía describiendo una salida técnicamente inválida.

### Defecto confirmado

Varios documentos (`docs/roadmap/BRAIN_02_TASK.md`, `ai/PROJECT_STATE.md`, `ai/HANDOFF.md`, `docs/architecture/DECISIONS_AND_OPEN_ITEMS.md`) ofrecían "aceptar el coste de un runner macOS de pago" como una opción para firmar, instalar y probar en el iPhone físico de Manu. Es un error de categoría: un runner de GitHub Actions, por grande o caro que sea, es una máquina virtual efímera sin ningún acceso físico al iPhone. Ningún runner, gratuito o de pago, puede conectar, instalar ni ejecutar QA en un dispositivo que no tiene enchufado. Esperar a que GitHub ofrezca Xcode 27 como imagen estándar tampoco resuelve la instalación física: en el mejor caso solo ampliaría el SDK de simulador disponible en CI.

### Corrección aplicada

- `docs/roadmap/BRAIN_02_TASK.md`: la sección "D-04B — precisada" reemplaza la opción inválida por las tres rutas reales: (1) un Mac de Manu compatible conectado directamente al iPhone (la única con acceso físico real); (2) TestFlight vía D-03, que no necesita un Mac conectado pero introduce un gate propio de credenciales/perfiles de firma, con autorización específica pendiente para cuando se intente; (3) posponer o reducir el alcance nativo de la Beta 1. Se aclara explícitamente que D-04B es un **gate futuro**, no una decisión pendiente de Manu ahora.
- `docs/architecture/DECISIONS_AND_OPEN_ITEMS.md`: filas D-04 y D-04B reescritas con la misma separación; se aclara que el descarte de `xcode-27-xlarge` por coste es un hecho aparte (afecta al SDK de simulador en CI) y no implica que un runner de pago resolviera la instalación física.
- `ai/PROJECT_STATE.md`, `ai/DECISIONS.md`, `ai/CURRENT_TASK.md`: alineados a la misma separación; se sustituye "bloqueo humano concreto que queda abierto" por lenguaje de "gate futuro" donde correspondía, para no dar la impresión de que existe una acción pendiente de Manu hoy.
- `ai/QA_LESSONS.md`: añadida QAL-007 con la distinción generalizable (más abajo) y un comando reproducible de comprobación.

### Comprobación de regresión reproducible

Primer intento de esta corrección: un `grep` que combinaba "runner" y "pago/xlarge" con "iphone/dispositivo físico" en la misma frase. Al ejecutarlo dio **falsos positivos** (coincide también con frases que explican correctamente que el runner *no* resuelve la instalación física) — no se puede afirmar "cero coincidencias" con ese comando, así que se sustituye por uno más preciso en vez de dejar la afirmación incorrecta.

Comando usado (heurística, no infalible):

```bash
grep -rniE "runner[^.]*(puede|permite|instala|prueba|resuelve)[^.]*iphone" docs ai
```

Sobre el estado final de esta corrección devuelve coincidencias en `docs/adr/0011-native-local-storage-and-keys.md` (dos), `docs/security/RISK_REGISTER.md`, `ai/DECISIONS.md` y en este mismo `ai/HANDOFF.md` (el propio relato de esta corrección, incluida esta frase, coincide consigo mismo por usar las mismas palabras — eso es un efecto secundario esperable del comando, no una coincidencia nueva que revisar cada vez). Se releyeron todas: hablan de lo que el runner sí resuelve en **simulador** (compilar/probar sin firma) o niegan explícitamente que resuelva la instalación **física** ("no garantiza", "no aplica", "tampoco resuelve"); ninguna repite el error de presentar un runner como capaz de instalar o probar en el iPhone físico. El comando no distingue automáticamente afirmación de negación por sí solo — requiere esta revisión manual de cada coincidencia, documentada aquí como evidencia reproducible en vez de una cifra sin verificar.

Comprobación complementaria, esta sí sin ambigüedad: la frase literal que causó el defecto ("aceptar el coste de un runner ... de pago" como opción) ya no aparece fuera de los dos bloques de `ai/HANDOFF.md` explícitamente marcados como historia superada (líneas 117 y, en esta misma corrección, la cita entre comillas de la línea "Defecto confirmado" de arriba, que la nombra para describir el error, no para repetirlo como recomendación).

### Verificación de la corrección

- Releído cada documento señalado por el revisor y confirmado que la opción "runner de pago" para instalación física no aparece ya como recomendación en ningún documento activo (los bloques de `ai/HANDOFF.md` marcados como superados se conservan sin editar, con una nota que remite a esta sección).
- Comprobación de enlaces relativos Markdown repetida tras esta corrección: **0 enlaces rotos**.
- Comando de regresión de arriba ejecutado sobre el estado final: 6 coincidencias, las seis revisadas manualmente y confirmadas como correctas (simulador o negación explícita), no como repetición del defecto.

### NO VERIFICADO (de esta corrección)

- No cambia respecto a la corrección anterior: sigue sin fuente primaria concluyente si registrar App Groups contra un equipo real funciona con cuenta gratuita, y sigue sin ejecutarse el job de CI descrito como criterio de BRAIN-02b.

### Bloqueo humano concreto (estado vigente)

No hay ninguna decisión pendiente de Manu ahora. D-04B es un gate futuro que solo se activará cuando BRAIN-02b–02d estén verificadas en simulador y el equipo intente de verdad la fase de dispositivo real; en ese momento las opciones son (a) que Manu disponga de un Mac compatible conectado al iPhone, (b) TestFlight vía D-03 con su propio gate de credenciales, o (c) posponer/reducir el alcance nativo de la Beta 1 — ninguna resoluble comprando más CI.

## NO VERIFICADO

- Integración con almacenamiento, cifrado, sync, UI o extensiones.
- Compilación, firma o instalación de una app iOS/macOS.
- Comportamiento en dispositivos reales.

## Próximo paso

BRAIN-02-PREP quedó ejecutada por Claude Code conforme a `docs/roadmap/BRAIN_02_TASK.md`, con dos rondas de corrección tras revisión externa (ver "BRAIN-02-PREP — segunda corrección tras revisión externa" arriba, que es el estado vigente). El orquestador revisa el PR #5 y decide el merge; si lo aprueba, debe abrir inmediatamente el siguiente trabajo autorizado (candidato natural: cualquiera de BRAIN-02a–02d, ninguna con bloqueos técnicos pendientes en CI/simulador, solo falta autorización explícita de código de producto). No hay ningún bloqueo humano que señalar ahora: D-04B queda como gate futuro documentado, no como pregunta activa.
