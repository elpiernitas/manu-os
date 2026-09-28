# BRAIN-02-PREP — contrato técnico y desbloqueo

## Objetivo

Preparar BRAIN-02 para que su implementación pueda comenzar en unidades pequeñas, verificables y de coste 0 €, sin fingir que la firma, la instalación en iOS 27 o las pruebas en dispositivo ya están resueltas.

## Encargo para Claude Code

1. Lee completos `AGENTS.md`, `CLAUDE.md`, `ai/PROJECT_STATE.md`, `ai/CURRENT_TASK.md`, `ai/HANDOFF.md`, `ai/QA_LESSONS.md`, los ADR, el modelo de datos, el threat model, el registro de riesgos, el roadmap y los contratos de aceptación.
2. Revisa fuentes oficiales actuales de Apple y Swift para almacenamiento local, protección de archivos, Keychain, App Groups, extensiones, compatibilidad y pruebas.
3. Evalúa D-02 y escribe un ADR con recomendación, alternativas, invariantes, migración, recuperación, borrado y pruebas.
4. Descompón BRAIN-02 en subfases. Identifica una primera subfase que pueda implementarse y probarse en CI sin cuenta de pago, dispositivo, firma, servicios ni datos reales.
5. Convierte D-03 y D-04B en decisiones claras: qué bloquean realmente ahora, qué puede aplazarse y qué evidencia necesitará Manu antes de pagar o usar su dispositivo.
6. Actualiza los documentos canónicos afectados sin borrar el historial.
7. Ejecuta el check documental, valida enlaces e IDs y busca contradicciones.
8. Haz commit y push en esta rama y publica en el PR un informe con archivos, decisiones, fuentes, checks, riesgos y cualquier elemento NO VERIFICADO.

## Condiciones

- No escribas código de producto.
- No crees un proyecto Xcode.
- No uses datos personales, credenciales ni servicios.
- No generes costes.
- No hagas merge.
- No hagas preguntas rutinarias: toma decisiones técnicas reversibles dentro del alcance.
- Si necesitas a Manu, formula una sola pregunta concreta y continúa antes con todo lo que no dependa de ella.

## Resultado (2026-09-28)

### D-02 — decidida

Ver [ADR-0011](../adr/0011-native-local-storage-and-keys.md): SQLite del sistema tras el adaptador `LocalStore`, blobs fuera de la base por hash, `NSFileProtectionCompleteUntilFirstUserAuthentication`, DEK/KEK de ADR-0003 con Argon2id (dependencia mínima justificada) y clave en Keychain (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`), App Group para el contenedor compartido con las extensiones. La disponibilidad de App Groups con cuenta Apple gratuita queda `NO_VERIFICADO` y no bloquea el inicio de BRAIN-02: solo bloquea la subfase que la necesita (BRAIN-02c, más abajo).

### BRAIN-02 dividida en subfases

| Subfase | Contenido | Dónde se prueba | Bloqueada por |
| --- | --- | --- | --- |
| **BRAIN-02a — núcleo de persistencia y claves** | Swift Package nuevo (`ManuBrainStorage` o nombre equivalente) sin proyecto Xcode ni SwiftUI. Adaptador `LocalStore`/`BlobStore` sobre `sqlite3` del sistema, migraciones versionadas con test de cada versión anterior, cifrado AES-256-GCM por registro/blob con CryptoKit, derivación de KEK con Argon2id sobre un secreto de recuperación sintético, `PRAGMA secure_delete` y `VACUUM` tras `SourceDeletionEvent` (BRAIN-01). El acceso a Keychain y a App Group se define como protocolo (`KeyStore`) con una implementación en memoria para los tests; la implementación real de Keychain queda en BRAIN-02b. | Runner `macos-26` de GitHub Actions, igual que BRAIN-01. Coste 0 €. Sin firma, sin dispositivo, sin datos reales. | Nada: **es la primera unidad implementable ahora**, en cuanto se autorice código de producto para BRAIN-02. |
| **BRAIN-02b — Keychain real en un proyecto mínimo** | Proyecto Xcode mínimo (sin UI de producto) que sustituye la implementación en memoria de `KeyStore` por Keychain real (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`, sin App Group todavía). Prueba de cierre/reapertura del vault. | Xcode en un Mac real, ejecución en un iPhone o simulador. | D-04B (necesita un Mac capaz de compilar Xcode 26/27; el Mac actual de Manu no cumple los requisitos oficiales, ver más abajo). No necesita D-03: Keychain estándar de una app funciona con Personal Team. |
| **BRAIN-02c — App Group y snapshot compartido** | Contenedor compartido (`group.<bundle-id-base>`) y Keychain access group; una extensión mínima de prueba (por ejemplo un widget vacío) lee solo el snapshot que la app escribe, nunca el vault completo. | Xcode en un Mac real, ejecución en un iPhone o simulador. | D-04B, y posiblemente D-03 si se confirma en el dispositivo que Personal Team no permite registrar el App ID de App Groups (ver D-03 más abajo: se intenta primero sin coste). |
| **BRAIN-02d — apps mínimas e Inbox** | App SwiftUI de iPhone (y de Mac si D-01/D-04 lo permiten) con navegación de cinco pestañas vacía y la identidad visual, captura de texto offline, Inbox, usando `LocalStore`/`KeyStore` de las subfases anteriores. Tests de cierre/reapertura. | Xcode en un Mac real. | D-04B; hereda cualquier bloqueo no resuelto de 02b/02c. |

BRAIN-02a cumple el criterio de aceptación "primera unidad implementable sin coste ni datos reales" de `ai/CURRENT_TASK.md`. Las subfases 02b–02d quedan documentadas pero no se implementan en esta tarea de preparación: siguen bloqueadas por D-04B como el resto de BRAIN-02 en `ai/PROJECT_STATE.md`.

### D-03 — precisada

**No bloquea** BRAIN-02a ni BRAIN-02b (Keychain estándar sin App Group funciona con una cuenta Apple gratuita/Personal Team, según la documentación de Apple sobre firma con Personal Team).

**Puede bloquear** BRAIN-02c: la evidencia sobre si App Groups funciona con Personal Team es contradictoria en los foros oficiales de Apple Developer y no se ha podido verificar con una fuente primaria concluyente en esta revisión (`docs/research/SOURCES.md`). Antes de pedir una decisión a Manu, BRAIN-02c debe **intentarlo primero con la cuenta gratuita** en el Mac o iPhone reales y registrar el resultado exacto (captura del error de Xcode si falla). Solo si falla de forma demostrable se formula la pregunta concreta a Manu: *"App Groups no funciona con tu cuenta Apple gratuita en este proyecto; Apple Developer Program cuesta una suscripción anual explícita (importe a confirmar en el momento, no es un cobro automático) y desbloquea además TestFlight y WeatherKit. ¿Autorizas ese gasto o prefieres que las extensiones (widgets, controles, Live Activities) se aplacen para una beta posterior?"*

TestFlight, App Store Connect, notarización de la app de Mac y WeatherKit (D-06) siguen necesitando D-03 sin ambigüedad, según la comparación oficial de tipos de cuenta ya citada en `DECISIONS_AND_OPEN_ITEMS.md`; eso no cambia con esta revisión.

### D-04B — precisada

**No bloquea** BRAIN-02a: se verifica en el runner `macos-26` igual que BRAIN-01, sin cambios.

**Bloquea** BRAIN-02b, 02c y 02d por igual: todas requieren compilar un proyecto Xcode real, y el entorno de Claude Code en la nube no compila apps de Apple.

Reducción del bloqueo, sin pedir nada a Manu todavía:

1. El runner `xcode-27-xlarge` de GitHub Actions es un runner "xlarge": según la documentación de facturación de GitHub, los runners más grandes se cobran independientemente de si el repositorio es público o privado y no consumen las cuotas de minutos incluidos. **Queda descartado por ADR-0004 (coste 0 €) sin necesidad de decisión de Manu**, no solo por prudencia como se anotaba antes.
2. Sigue sin confirmarse en el propio dispositivo si el Mac de Manu (`MacBookPro14,2`, macOS Sonoma 14.8.7) puede instalar o ejecutar alguna versión de Xcode compatible con macOS Tahoe (requisito mínimo de todas las versiones actuales de Xcode). La documentación pública de compatibilidad de macOS Tahoe no incluye ese modelo. Esto era ya la conclusión de `DECISIONS_AND_OPEN_ITEMS.md`; esta revisión no encontró ninguna fuente nueva que lo cambie.
3. Las restricciones vigentes ya excluyen usar un Mac prestado o actualizar el Mac actual a Tahoe para este proyecto (`ai/PROJECT_STATE.md`). Con (1) y (2), no queda ninguna ruta de coste 0 € pendiente de explorar para compilar un proyecto Xcode real fuera del propio Mac de Manu.

**Bloqueo humano concreto que sigue en pie** (no resuelto por esta tarea, y es la única pregunta que este PR deja abierta): antes de empezar BRAIN-02b, Manu debe decidir entre (a) aceptar el coste de un runner macOS de pago con un importe concreto a cotizar en ese momento, (b) posponer BRAIN-02b–02d hasta disponer de un Mac compatible con Xcode actual, o (c) reducir el alcance de la Beta 1 nativa. Esta tarea de preparación no elige por Manu ninguna de las tres porque las tres tienen coste, tiempo o alcance de producto — son decisiones materiales reservadas a Manu según `AGENTS.md`.
