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

## Resultado (2026-09-28, corregido el mismo día tras revisión externa del PR #5)

> **Corrección aplicada.** La primera versión de esta sección declaraba BRAIN-02b–02d bloqueadas en bloque por D-04B, asumiendo que cualquier proyecto Xcode necesita el Mac de Manu o un runner de pago. Un comentario de revisión (`db3da24`, @elpiernitas) demostró con fuente primaria que eso es incorrecto: el runner `macos-26` que ya usa BRAIN-01 trae Xcode 26.6 y simuladores de iOS instalados, y `xcodebuild` compila y prueba contra un destino de iOS Simulator sin firma (`CODE_SIGNING_ALLOWED=NO`), sin Apple ID ni Developer Program — el simulador no aplica la autorización de entitlements por perfil de aprovisionamiento que sí exige un iPhone físico. La sección queda reescrita para separar correctamente qué se verifica en CI/simulador (disponible ya) de qué necesita el iPhone físico real (sigue bloqueado por D-04B). Ver también la corrección equivalente en [ADR-0011](../adr/0011-native-local-storage-and-keys.md) y `docs/research/SOURCES.md`.

### D-02 — decidida

Ver [ADR-0011](../adr/0011-native-local-storage-and-keys.md): SQLite del sistema tras el adaptador `LocalStore`, blobs fuera de la base por hash, `NSFileProtectionCompleteUntilFirstUserAuthentication`, DEK/KEK de ADR-0003 con Argon2id (dependencia mínima justificada; la alternativa de cero dependencias es PBKDF2 vía **CommonCrypto**, no CryptoKit) y clave en Keychain (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`), App Group para el contenedor compartido con las extensiones.

### Criterio de verificación obligatorio antes de cualquier otra cosa en BRAIN-02b

Antes de dar por buena cualquier otra parte de BRAIN-02b, la primera tarea debe ejecutar y publicar la salida real de un job de CI en el runner `macos-26` que:

1. corra `xcodebuild -version` y `xcodebuild -showsdks` y publique la salida (confirma versión de Xcode y SDKs/simuladores realmente disponibles en ese momento, que pueden diferir de lo documentado hoy);
2. compile y ejecute los tests de un target mínimo de app iOS (el esqueleto, sin funcionalidad de producto) con `-sdk iphonesimulator -destination 'platform=iOS Simulator,name=<modelo listado por -showsdks>,OS=<versión listada>' CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO CODE_SIGNING_ALLOWED=NO`;
3. si el paso 2 falla por cualquier motivo relacionado con firma/entitlements en vez de con el código del target, lo documenta como bloqueo real de D-04B en vez de asumir que el simulador siempre evita la firma.

Este job no se ha creado en esta tarea de preparación (sigue prohibido crear un proyecto Xcode aquí); queda como el primer criterio de aceptación de BRAIN-02b, y BRAIN-02c hereda su resultado.

### BRAIN-02 dividida en subfases

| Subfase | Contenido | Dónde se verifica | Bloqueada por |
| --- | --- | --- | --- |
| **BRAIN-02a — núcleo de persistencia y claves** | Swift Package nuevo (`ManuBrainStorage` o nombre equivalente) sin proyecto Xcode ni SwiftUI. Adaptador `LocalStore`/`BlobStore` sobre `sqlite3` del sistema, migraciones versionadas con test de cada versión anterior, cifrado AES-256-GCM por registro/blob con CryptoKit, derivación de KEK con Argon2id sobre un secreto de recuperación sintético, `PRAGMA secure_delete` y `VACUUM` tras `SourceDeletionEvent` (BRAIN-01). El acceso a Keychain y a App Group se define como protocolo (`KeyStore`) con una implementación en memoria para los tests; la implementación real de Keychain queda en BRAIN-02b. | Runner `macos-26`, igual que BRAIN-01. Coste 0 €. Sin firma, sin dispositivo, sin datos reales. | Nada: **es la primera unidad implementable ahora**, en cuanto se autorice código de producto para BRAIN-02. |
| **BRAIN-02b — proyecto Xcode mínimo con Keychain real** | Proyecto Xcode mínimo (sin UI de producto) que sustituye la implementación en memoria de `KeyStore` por Keychain real (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`, sin App Group todavía). Prueba de cierre/reapertura del vault. | **Runner `macos-26`, contra iOS Simulator, sin firma** (ver criterio de verificación arriba). No necesita Mac de Manu ni runner de pago para esta verificación. | Nada para la verificación en simulador. La instalación y prueba en el **iPhone físico** real sigue en la fase de dispositivo (más abajo), bloqueada por D-04B. |
| **BRAIN-02c — App Group y snapshot compartido** | Contenedor compartido (`group.<bundle-id-base>`) y Keychain access group; una extensión mínima de prueba (por ejemplo un widget vacío) lee solo el snapshot que la app escribe, nunca el vault completo. | **Runner `macos-26`, contra iOS Simulator, sin firma**: el simulador no aplica la autorización de entitlements por perfil de aprovisionamiento, así que puede ejercitar App Groups sin registrar nada contra un equipo de desarrollador real. | Nada para la verificación en simulador. Registrar el App Group **contra un equipo de desarrollador real** (necesario solo para firmar e instalar en el iPhone físico) sigue `NO_VERIFICADO` con cuenta gratuita — ver D-03 más abajo. |
| **BRAIN-02d — apps mínimas e Inbox** | App SwiftUI de iPhone (y de Mac si D-01/D-04 lo permiten) con navegación de cinco pestañas vacía y la identidad visual, captura de texto offline, Inbox, usando `LocalStore`/`KeyStore` de las subfases anteriores. Tests automatizados de cierre/reapertura. | **Runner `macos-26`, contra iOS Simulator**, para los tests automatizados y la compilación. | Nada para la verificación automatizada en simulador. QA manual, accesibilidad, rendimiento real y la sensación de uso en el iPhone 14 físico de Manu siguen en la fase de dispositivo. |
| **Fase de dispositivo real (transversal a 02b–02d)** | Firma, instalación y prueba en el iPhone físico de Manu con iOS 27: comportamiento real de Keychain/App Group en segundo plano, WidgetKit/Live Activities, rendimiento en el iPhone 14 y el Mac Intel, QA manual. | Xcode conectado a un Mac real y al dispositivo. | **D-04B**: el Mac de Manu no cumple los requisitos oficiales de ningún Xcode actual (ver más abajo). D-03 entra por uno de dos disparadores independientes (ver "D-03 — precisada"): el registro del App Group falla de forma demostrable al firmar con Personal Team, o se elige TestFlight como ruta. |

BRAIN-02a cumple el criterio de aceptación "primera unidad implementable sin coste ni datos reales" de `ai/CURRENT_TASK.md`, y ahora también lo cumplen 02b–02d en su verificación de simulador. Ninguna subfase se implementa en esta tarea de preparación (sigue prohibido crear el proyecto Xcode aquí): todas quedan documentadas, a la espera de que se autorice código de producto.

### D-03 — precisada

**No bloquea** ninguna subfase en su verificación por CI/simulador (02a–02d): ni Keychain estándar ni App Group necesitan firma real ni cuenta de pago para compilarse y probarse contra el simulador, porque el simulador no aplica la autorización de entitlements por perfil de aprovisionamiento.

**Solo entra en juego en la fase de dispositivo real**, y por dos disparadores independientes — no uno solo, y ninguno activo ahora mismo:

1. **Fallo demostrado de App Groups con cuenta gratuita en la Ruta 1** (Mac conectado directamente al iPhone, ver D-04B más abajo): si al firmar con Personal Team Xcode rechaza registrar el App ID con la capacidad App Groups (evidencia contradictoria en foros oficiales, sin fuente primaria concluyente en esta revisión — `docs/research/SOURCES.md`), se documenta el error exacto y **entonces** se formula la pregunta concreta a Manu: *"App Groups no funciona con tu cuenta Apple gratuita en este proyecto; Apple Developer Program cuesta una suscripción anual explícita (importe a confirmar en el momento, no es un cobro automático) y desbloquea además TestFlight y WeatherKit. ¿Autorizas ese gasto o prefieres que las extensiones (widgets, controles, Live Activities) se aplacen para una beta posterior?"*
2. **Elegir la Ruta 2 de D-04B (TestFlight) como vía de distribución/prueba física**, se haya intentado o no la Ruta 1: TestFlight exige Apple Developer Program por sí mismo, sin relación con si App Groups funciona o no con la cuenta gratuita. Elegir esta ruta activa D-03 de inmediato, y además el gate separado de credenciales/perfiles de firma para subir el build a App Store Connect (ver D-04B).

**Corrección (2026-09-28, tercera revisión externa del PR #5)**: una versión anterior de esta sección presentaba el disparador 1 como si fuera el único ("solo entra en juego... si falla"), lo que contradecía a D-04B, que ya listaba TestFlight como ruta real independientemente de ese fallo. Quedan ambos disparadores explícitos y ninguno exclusivo del otro.

Ninguno de los dos disparadores está activo hoy: no se ha intentado nada en el iPhone físico (BRAIN-02b–02d ni siquiera están implementadas) y nadie ha elegido todavía la ruta TestFlight. Por tanto no hay pregunta pendiente a Manu sobre D-03 en este momento.

TestFlight, App Store Connect, notarización de la app de Mac y WeatherKit (D-06) siguen necesitando D-03 sin ambigüedad, según la comparación oficial de tipos de cuenta ya citada en `DECISIONS_AND_OPEN_ITEMS.md`; eso no cambia con esta revisión.

### D-04B — precisada

**No bloquea** ninguna subfase en su verificación por CI/simulador (02a–02d): todas se compilan y prueban en el runner `macos-26`, que ya trae Xcode y simuladores, sin firma ni Apple ID.

**Bloquea únicamente la fase de dispositivo real**: firmar, instalar y probar en el iPhone físico de Manu con iOS 27 requiere Xcode conectado a un Mac real y al dispositivo; el entorno de Claude Code en la nube no lo hace, y un job de CI sin dispositivo conectado tampoco.

Reducción del bloqueo, sin pedir nada a Manu todavía:

1. El runner `xcode-27-xlarge` de GitHub Actions es un runner "xlarge": según la documentación de facturación de GitHub, los runners más grandes se cobran independientemente de si el repositorio es público o privado y no consumen las cuotas de minutos incluidos. **Queda descartado por ADR-0004 (coste 0 €) sin necesidad de decisión de Manu**, no solo por prudencia como se anotaba antes. (Nota: el runner `macos-26` usado en 02a–02d trae SDKs de iOS hasta 26.5, no 27; la verificación en simulador de esas subfases no depende de `xcode-27-xlarge`, pero certificar comportamiento específico de iOS 27 sigue perteneciendo a la fase de dispositivo real.)
2. Sigue sin confirmarse en el propio dispositivo si el Mac de Manu (`MacBookPro14,2`, macOS Sonoma 14.8.7) puede instalar o ejecutar alguna versión de Xcode compatible con macOS Tahoe (requisito mínimo de todas las versiones actuales de Xcode). La documentación pública de compatibilidad de macOS Tahoe no incluye ese modelo. Esto era ya la conclusión de `DECISIONS_AND_OPEN_ITEMS.md`; esta revisión no encontró ninguna fuente nueva que lo cambie.
3. Las restricciones vigentes ya excluyen usar un Mac prestado o actualizar el Mac actual a Tahoe para este proyecto (`ai/PROJECT_STATE.md`). Con (1) y (2), no queda ninguna ruta de coste 0 € pendiente de explorar para firmar e instalar en el iPhone físico fuera del propio Mac de Manu.

**No hay pregunta pendiente a Manu antes de empezar BRAIN-02b**, y D-04B no es una decisión que Manu deba tomar ahora: es un **gate futuro** que solo se activa cuando BRAIN-02b–02d estén verificadas en simulador y el equipo llegue de verdad a intentar la fase de dispositivo real.

**Corrección (2026-09-28, segunda revisión externa del PR #5)**: una versión anterior de esta sección ofrecía "aceptar el coste de un runner macOS de pago" como una de las opciones para resolver esa fase. Es un error de categoría: un runner de GitHub Actions, por grande o caro que sea, es una máquina virtual efímera sin acceso físico al iPhone de Manu. Ningún runner, gratuito o de pago, puede conectar, instalar ni ejecutar QA en un dispositivo físico que no tiene enchufado. Esperar a que GitHub ofrezca Xcode 27 como imagen estándar tampoco resuelve esto: en el mejor de los casos permitiría compilar contra el SDK de iOS 27 específicamente, no instalar en el iPhone físico.

Las rutas que de verdad pueden completar la fase de dispositivo real, dentro de los límites vigentes, son solo estas:

1. **Un Mac de Manu compatible con Xcode actual, conectado directamente (USB o red local) al iPhone.** Es la única ruta que instala y ejecuta QA con Xcode en el dispositivo. Sigue sin resolverse: el Mac actual de Manu no cumple los requisitos oficiales (ver D-04B más abajo), y las restricciones vigentes ya excluyen un Mac prestado o actualizar el actual a Tahoe. Depende de que Manu disponga en el futuro de hardware compatible; no es una compra que este documento proponga ni decida.
2. **Distribución por TestFlight**, una vez resuelta D-03 a favor del programa de pago. No necesita un Mac conectado al iPhone en el momento de instalar (Manu instala desde la app TestFlight en su propio dispositivo), pero introduce un gate nuevo y separado: subir un build a App Store Connect exige gestionar credenciales y perfiles de firma en algún entorno (CI o un Mac), lo que cuenta como "conectar servicios"/"ampliar permisos sensibles" bajo `AGENTS.md` y requeriría autorización específica de Manu en el momento en que se intente, no algo que esta tarea de preparación resuelva, active o autorice.
3. **Posponer o reducir el alcance nativo de la Beta 1**, sin instalar en el iPhone físico por ahora.

Ninguna de las tres exige una decisión de Manu hoy: (1) depende de hardware futuro, (2) solo se activa si se decide intentar esa ruta más adelante, y (3) es una salida siempre disponible. Por eso esta tarea no formula ninguna pregunta a Manu: no hay nada que decidir todavía, solo un gate documentado para cuando llegue el momento.
