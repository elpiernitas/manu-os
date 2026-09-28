# ADR-0011 — Almacenamiento local nativo, claves y contenedor compartido (D-02)

- Status: **ACCEPTED**
- Date: **2026-09-28**

## Contexto

D-01 decidió el núcleo MANU BRAIN en Swift, sin componente web en la Beta 1 ([DECISIONS_AND_OPEN_ITEMS.md](../architecture/DECISIONS_AND_OPEN_ITEMS.md)). ADR-0010 implementó BRAIN-01 como Swift Package sin dependencias externas, sin almacenamiento ni interfaz. D-02 queda como la decisión pendiente que bloquea BRAIN-02: qué usa MANU OS para persistir el vault en iOS/macOS, cómo gestiona sus claves y cómo comparte un subconjunto mínimo con las extensiones del sistema (ADR-0007).

Restricciones que siguen vigentes y condicionan la decisión:

- Cifrado en cliente obligatorio (ADR-0003): DEK de 256 bits por vault, AES-256-GCM, KEK envuelta derivada del secreto de recuperación de Manu.
- Sin bloqueo interno de Face ID (decisión de producto, R-33 `ACCEPTED`): la protección del sistema operativo (passcode/Face ID del dispositivo) es la única barrera adicional a la del cifrado propio; MANU OS no puede asumir que el vault está "cerrado" mientras el dispositivo está desbloqueado.
- Coste 0 €, sin dependencias que exijan facturación (ADR-0004).
- El entorno de Claude Code en la nube no compila para Apple; BRAIN-01 se verifica en el runner `macos-26` de GitHub Actions sin firma ni dispositivo (D-04). D-02 debe separar qué puede probarse ahí de lo que necesita un iPhone real con iOS 27 (D-04B). **Corrección (2026-09-28, revisión externa del PR #5)**: esa separación no coincide con "sin proyecto Xcode / con proyecto Xcode". El runner `macos-26` ya trae Xcode 26.6 con SDKs e imágenes de iOS Simulator instaladas, y un build o test dirigido al simulador no exige firma ni Apple ID (`CODE_SIGNING_ALLOWED=NO`). Un proyecto Xcode real, incluidas sus extensiones y capacidades como App Groups, puede compilarse y probarse en simulador dentro de ese mismo runner, sin coste adicional. Lo que de verdad sigue bloqueado por D-04B es instalar, firmar y probar en el **iPhone físico** de Manu con iOS 27, no la existencia de un proyecto Xcode en sí. Ver la sección "Fuentes consultadas" y `docs/roadmap/BRAIN_02_TASK.md` para la subfase corregida.
- Las extensiones solo pueden leer un snapshot mínimo, nunca el vault completo (ARCHITECTURE.md, THREAT_MODEL.md).

### Fuentes consultadas (2026-09-28)

Registradas también en `docs/research/SOURCES.md`. Resumen relevante:

- Apple documenta cuatro clases de protección de archivos (`NSFileProtectionComplete`, `CompleteUnlessOpen`, `CompleteUntilFirstUserAuthentication`, `NoProtection`); `CompleteUntilFirstUserAuthentication` es la que Apple aplica por defecto a los contenedores de datos de apps y de grupo, y permite acceso continuo tras el primer desbloqueo, incluida ejecución en segundo plano de extensiones y posibles daemons.
- Los atributos `kSecAttrAccessible*` de Keychain Services siguen existiendo como familia con y sin sufijo `ThisDeviceOnly` (sincronizable vía iCloud Keychain o no). No se encontró una fuente primaria concluyente en esta revisión sobre el estado exacto de deprecación de `kSecAttrAccessibleAlways`/`kSecAttrAccessibleAlwaysThisDeviceOnly`; se tratan como **no recomendados** por buenas prácticas (accesibles incluso antes del primer desbloqueo) y no se usan.
- App Groups es el mecanismo estándar de Apple para compartir un contenedor de archivos, `UserDefaults` y un grupo de acceso de Keychain entre una app y sus extensiones.
- Sobre si la entitlement de App Groups funciona con una cuenta Apple gratuita (Personal Team, la que usaría Manu mientras D-03 no esté decidida): la evidencia encontrada es contradictoria entre foros oficiales de Apple Developer y no hay una fuente primaria concluyente verificada en esta revisión. Queda como `NO_VERIFICADO`.
- CryptoKit de Apple ofrece AES-GCM, SHA-2 y HKDF de forma nativa, pero **no** ofrece Argon2id: hay una propuesta abierta (no fusionada) para añadirlo a `swift-crypto`. Argon2id sigue sin estar disponible como API nativa de Apple en esta revisión.
- SwiftData exige iOS 17+/macOS 14+ como mínimo de despliegue y está pensado para sincronizar con CloudKit; Core Data comparte el mismo motor SQLite subyacente pero con un modelo de objetos administrados más pesado. Ambos son soluciones de Apple, no dependencias externas, pero ninguno es requisito para usar SQLite directamente.
- **CryptoKit no ofrece PBKDF2.** Corrección de esta misma revisión: una versión anterior de este ADR atribuía PBKDF2-HMAC-SHA256 indistintamente a "CryptoKit/CommonCrypto". La API pública de CryptoKit cubre AES-GCM/ChaChaPoly, SHA-2, HMAC, HKDF y firmas/acuerdo de claves, pero no expone PBKDF2. La única implementación de Apple para PBKDF2 es `CCKeyDerivationPBKDF` en CommonCrypto (framework C, sin puente Swift oficial, requiere un header bridging o un wrapper). La alternativa de cero dependencias descrita en la sección de gestión de claves usa CommonCrypto, no CryptoKit.
- **El runner `macos-26` ya incluye Xcode 26.6, SDKs de iOS 26.0–26.5 y simuladores instalados** (`actions/runner-images`, README de la imagen `macos-26`), y `xcodebuild` puede compilar y ejecutar tests contra un destino de iOS Simulator (`-sdk iphonesimulator -destination 'platform=iOS Simulator,...'`) sin firma: fijando `CODE_SIGNING_ALLOWED=NO` (documentado en foros oficiales de Apple Developer y en guías de CI de varios proveedores) el build no necesita Apple ID, provisioning profile ni Developer Program. El simulador **no aplica** la autorización de entitlements por perfil de aprovisionamiento que sí exige un dispositivo físico: un build de simulador puede declarar App Groups, Keychain access groups u otras capacidades sin que Xcode las registre contra un equipo de desarrollador. Esto cambia qué puede probarse en CI sin dispositivo: no solo la lógica pura de BRAIN-02a, sino también un proyecto Xcode real con Keychain, App Group y extensiones, mientras la verificación se limite al simulador.

Ninguna de estas fuentes se ha probado en el iPhone o el Mac de Manu; se documentan como lectura de documentación oficial (o de la propia documentación de GitHub Actions) o de foros oficiales, no como comportamiento verificado en el dispositivo. La afirmación sobre el simulador tampoco se ha ejecutado todavía en este repositorio: queda como primer criterio de aceptación obligatorio de BRAIN-02b (ver `docs/roadmap/BRAIN_02_TASK.md`), no como hecho ya comprobado aquí.

## Decisión

### 1. Persistencia estructurada: SQLite del sistema tras un adaptador `LocalStore`

MANU OS usa la librería `sqlite3` ya incluida en iOS y macOS (no es una dependencia nueva, es parte del sistema operativo) a través de un wrapper Swift propio y mínimo, detrás del puerto `LocalStore` ya previsto en `ARCHITECTURE.md`. No se adopta SwiftData ni Core Data para el MVP:

- SwiftData exige una versión mínima de iOS/macOS más alta de la necesaria y está orientado a sincronizar con CloudKit, que no es el transporte elegido para D-07 hoy.
- Core Data añade un modelo de objetos administrados y un runtime que MANU OS no necesita; su generación de esquema es más difícil de auditar campo a campo que SQL explícito.
- Ambos atarían el motor de datos a frameworks de Apple con menos control sobre migraciones deterministas, que BRAIN-01 ya exige por contrato (StrictJSON, validación en el límite del dominio).

**Regla de salida reversible**: si el wrapper manual sobre `sqlite3` crece de forma desproporcionada o aparecen errores de gestión de memoria/hilos difíciles de mantener, se adopta `GRDB.swift` (una única dependencia Swift delgada y ampliamente auditada) como sustituto del wrapper, manteniendo el mismo contrato `LocalStore`. Esta decisión queda documentada aquí para no reabrir D-02 solo por ese motivo.

### 2. Blobs fuera de la base estructurada

Los blobs (originales con retención `FULL`, adjuntos) se guardan como archivos independientes en el contenedor de la app, referenciados por hash SHA-256 desde SQLite, no como columnas `BLOB`. Evita inflar la base y bloquear operaciones de lectura/escritura durante backups o VACUUM. Coincide con lo ya anotado en `ARCHITECTURE.md`.

### 3. Protección de archivo del sistema

Cada archivo del vault (base de datos y blobs) se marca con `NSFileProtectionCompleteUntilFirstUserAuthentication`, no con `NSFileProtectionComplete`:

- Es el valor por defecto de Apple para contenedores de datos de apps y de grupo, y es compatible con acceso en segundo plano de extensiones tras el primer desbloqueo del dispositivo.
- `NSFileProtectionComplete` bloquearía la lectura mientras el dispositivo está bloqueado, lo que rompería widgets, Live Activities y sincronización en segundo plano.
- Como R-33 acepta que cualquier persona con el dispositivo desbloqueado accede a todo, la protección de archivo del sistema es una capa adicional (protege el dato en reposo si el dispositivo está apagado, en reinicio o robado y bloqueado), no la barrera principal. La barrera principal sigue siendo el cifrado propio de contenido (ADR-0003) y el bloqueo del propio dispositivo.

### 4. Gestión de claves

- Se mantiene el esquema ya decidido en ADR-0003: DEK de 256 bits por vault, AES-256-GCM con nonce único por registro/blob, KEK envuelta derivada del secreto de recuperación.
- **Derivación de la KEK**: se recomienda Argon2id (RFC 9106) mediante una única dependencia Swift Package mínima y auditada, por su resistencia a ataques con GPU/ASIC frente a PBKDF2. Esta es la única excepción de dependencia externa que este ADR autoriza, justificada por seguridad; se fija la versión exacta y se revisa su código antes de integrarla en la subfase que la implemente. Si en esa subfase Manu prefiere cero dependencias externas sin excepción, la alternativa nativa es PBKDF2-HMAC-SHA256 con un número alto de iteraciones vía **CommonCrypto** (`CCKeyDerivationPBKDF`; CryptoKit no expone PBKDF2, ver "Fuentes consultadas"), documentando el cambio como debilidad aceptada frente a Argon2id.
- **Persistencia de la clave desenvuelta**: Keychain de iOS/macOS, atributo `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` — no sincronizable con iCloud Keychain, ligado a este dispositivo, accesible tras el primer desbloqueo sin exigir que la app esté en primer plano. Se descarta `WhenUnlocked` (impediría operar en segundo plano tras el primer desbloqueo) y se descartan `Always`/`AlwaysThisDeviceOnly` (expondrían la clave incluso antes del primer desbloqueo tras un reinicio).
- La KEK-wrapped DEK (la clave todavía envuelta) puede guardarse también como archivo si conviene evitar una dependencia total de Keychain para el arranque; la clave sin envolver nunca se escribe en disco fuera de Keychain.

### 5. Contenedor compartido con extensiones

El contenedor compartido usa un **App Group** (`group.<bundle-id-base>`) con su Keychain access group asociado, siguiendo el patrón estándar de Apple. Las extensiones no reciben el vault ni la DEK: reciben solo el snapshot mínimo (cifrado o en claro según la sensibilidad del dato, ver `DATA_MODEL.md`) que la app principal escribe explícitamente para el modo activo — mismo principio ya fijado en `ARCHITECTURE.md` y `THREAT_MODEL.md`.

**Corrección (2026-09-28, revisión externa del PR #5)**: una versión anterior de este ADR daba por bloqueado el contenedor compartido hasta un dispositivo real, razonando que el runner de CI "no firma código ni tiene dispositivo". Eso es cierto pero irrelevante para el simulador: el iOS Simulator no aplica la autorización de entitlements por perfil de aprovisionamiento, así que un build de simulador puede declarar y ejercitar App Groups, Keychain access groups y una extensión mínima sin firma, Apple ID ni Developer Program — build y tests corren en el mismo runner `macos-26` que BRAIN-01, coste 0 €. Esto se documenta como el nuevo alcance de BRAIN-02c (ver `docs/roadmap/BRAIN_02_TASK.md`).

Lo que sigue sin verificar y sin fuente primaria concluyente es distinto de lo anterior: (a) si la entitlement de App Groups se puede **registrar contra un equipo de desarrollador real** (necesario para firmar e instalar en un iPhone físico) con una cuenta Apple gratuita (Personal Team) — evidencia contradictoria en foros oficiales, sin fuente primaria concluyente en esta revisión; y (b) el comportamiento del contenedor compartido en un dispositivo físico real, que ningún simulador reproduce con certeza (rendimiento, límites de memoria de extensión, comportamiento exacto de `NSFileProtectionCompleteUntilFirstUserAuthentication` en segundo plano). Ambos puntos quedan `NO_VERIFICADO` y gateados por D-04B (instalación real). D-03 se activa por dos disparadores independientes: (a) falla de forma demostrada, o se elige TestFlight como ruta de distribución/prueba física, que exige D-03 por sí sola sin relación con si (a) falló o no (ver `docs/roadmap/BRAIN_02_TASK.md`).

### 6. Migraciones

Cada base de datos lleva `schema_version`. Las migraciones son funciones puras y versionadas, aplicadas en orden, con un test de migración desde cada versión anterior soportada — mismo patrón de disciplina que StrictJSON en BRAIN-01.

### 7. Borrado

`SourceDeletionEvent` (BRAIN-01) para una fuente con retención no-`FULL` se traduce en: borrado físico del blob referenciado y `DELETE` de la fila correspondiente con `PRAGMA secure_delete = ON` activado para minimizar restos recuperables en el archivo de base de datos. SQLite no garantiza por sí solo que un `DELETE` borre físicamente el contenido sin `secure_delete` o `VACUUM`; se documenta como paso explícito y comprobable por test (el archivo no contiene el texto borrado en claro tras la operación).

### 8. Recuperación y backup

No cambia lo ya descrito en `THREAT_MODEL.md` (manifest.json, JSONL, blobs por hash, checksums): se genera leyendo SQLite con la DEK en memoria durante la operación de export.

## Alternativas consideradas

- **SwiftData**: rechazada para el MVP por el mínimo de versión de SO y el acoplamiento a CloudKit; puede reconsiderarse si D-07 elige iCloud como transporte y si el Mac de Manu deja de limitar la versión mínima de despliegue.
- **Core Data**: descartada por complejidad de un modelo administrado que MANU OS no necesita, con el mismo argumento de control fino que llevó a BRAIN-01 a un Swift Package puro (ADR-0010).
- **Realm u otro motor NoSQL embebido**: descartado; añade una dependencia binaria grande sin ventaja clara sobre SQLite más un wrapper propio para el volumen de datos esperado.
- **Cifrar la base completa con SQLCipher** en vez de cifrar campo a campo con AES-GCM: no se elige ahora porque duplicaría la gestión de claves (clave de SQLCipher además de la DEK de ADR-0003) sin necesidad clara; puede revisarse si el cifrado campo a campo demuestra ser demasiado costoso en dispositivo.

## Consecuencias

- BRAIN-02 se divide por **dónde se verifica**, no por si usa un proyecto Xcode: (1) lógica y persistencia como Swift Package sin Xcode (BRAIN-02a); (2) proyecto Xcode real — Keychain, App Group, extensión mínima — construido y probado en iOS Simulator dentro del mismo runner `macos-26` (BRAIN-02b/02c), sin firma, Apple ID ni coste adicional; (3) firma, instalación y prueba en el iPhone físico real de Manu con iOS 27, que sigue bloqueada por D-04B. Solo (3) necesita device/D-04B; (1) y (2) no.
- Se añade una dependencia externa mínima y justificada (Argon2id) al proyecto, rompiendo por primera vez el "cero dependencias" de ADR-0010; ese ADR seguía limitado a BRAIN-01 y no impedía esta excepción puntual y documentada. La alternativa de cero dependencias (PBKDF2) usa CommonCrypto, no CryptoKit.
- La disponibilidad de App Groups **registrado contra un equipo de desarrollador real** con cuenta gratuita sigue como bloqueo `NO_VERIFICADO`, pero solo condiciona la firma/instalación en un iPhone físico (D-04B y, si falla, D-03), no la construcción ni las pruebas de lógica en simulador.
- Se añade R-41 al registro de riesgos (dependencia de terceros para Argon2id) y se actualiza R-40/D-02 en `DECISIONS_AND_OPEN_ITEMS.md`. Se corrige además R-22/R-25, que sobrestimaban lo que el runner de CI no puede probar.

## Verificación

Nada de este ADR está implementado. Se considera comprobable en el runner `macos-26` sin dispositivo, Apple ID ni firma: la lógica de persistencia y cifrado (BRAIN-02a) y, contra el iOS Simulator, un proyecto Xcode real con Keychain, App Group y una extensión mínima (BRAIN-02b/02c) — pendiente de que el primer job de CI que lo intente lo confirme (ver el criterio de verificación del runner en `docs/roadmap/BRAIN_02_TASK.md`). Solo la firma, instalación y comportamiento en el iPhone y el Mac físicos de Manu queda `TEÓRICAMENTE_POSIBLE` hasta probarse en el dispositivo real.
