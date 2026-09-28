# CURRENT TASK

Status: **IN_PROGRESS**

## Tarea activa

BRAIN-02a — núcleo de persistencia y claves, implementado como Swift Package y verificable íntegramente en CI.

Rama: `brain/02a-persistence-and-keys`.

Claude Code actúa como implementador. ChatGPT/Codex revisará de forma independiente el alcance, la arquitectura, la privacidad, las migraciones, las pruebas y CI antes de decidir el merge.

## Autorización

El orquestador autoriza esta subfase de código de producto porque está definida por ADR-0011 y `docs/roadmap/BRAIN_02_TASK.md`, tiene coste 0 €, usa solo datos sintéticos y no requiere firma, dispositivo, cuenta Apple, credenciales ni servicios externos.

## Alcance obligatorio

- Añadir un producto y target Swift Package `ManuBrainStorage` (o nombre equivalente claramente justificado) que dependa de `ManuBrainDomain`.
- Definir adaptadores públicos y pequeños para `LocalStore`, `BlobStore` y `KeyStore`; las capas superiores no deben depender directamente de SQLite, del sistema de archivos ni de una implementación concreta de claves.
- Implementar almacenamiento SQLite usando el `sqlite3` del sistema, transacciones explícitas, claves foráneas y migraciones versionadas. Debe rechazar de forma segura una versión futura/desconocida.
- Implementar blobs fuera de SQLite con nombre o dirección por hash y verificación de integridad.
- Cifrar cada registro y blob con AES-256-GCM, nonce único y metadatos relevantes autenticados. No debe persistirse texto sensible en claro.
- Derivar la KEK con Argon2id a partir de un secreto de recuperación exclusivamente sintético. Seleccionar una dependencia Swift mínima y mantenida, fijar una versión exacta, justificarla y registrar su superficie/riesgo; no se autoriza código nativo descargado en tiempo de ejecución.
- Mantener `KeyStore` como protocolo e incluir solo una implementación en memoria para tests. Keychain y App Groups reales pertenecen a BRAIN-02b/02c.
- Implementar el borrado derivado de `SourceDeletionEvent`: eliminación lógica y física aplicable, `PRAGMA secure_delete` y compactación controlada con `VACUUM`, sin afirmar garantías superiores a las que SQLite y el sistema de archivos pueden demostrar.
- Actualizar el workflow de CI, documentación técnica y `ai/HANDOFF.md` con evidencia reproducible.

## Criterios de aceptación

- `swift package dump-package`, `swift build --build-tests` y `swift test --parallel` pasan en `macos-26`.
- Existe un test de migración desde cada versión anterior soportada y un test que rechaza una versión futura.
- Hay tests de commit y rollback transaccional, reapertura del almacén, integridad de blobs y colisiones/duplicados relevantes.
- Hay tests negativos para clave incorrecta, ciphertext/metadatos manipulados y nonce no reutilizado.
- Una prueba inspecciona los archivos SQLite/blob y demuestra que los valores sensibles sintéticos usados en el test no aparecen en claro.
- El flujo de `SourceDeletionEvent` tiene una regresión que demuestra que el registro y blob dejan de ser accesibles, que la política de borrado está activa y que la compactación se ejecuta de forma comprobable.
- Argon2id tiene vectores de prueba conocidos o evidencia equivalente de interoperabilidad, parámetros explícitos y límites razonables para CI.
- No se rompe la API ni las 31 pruebas existentes de BRAIN-01.
- CI usa permisos mínimos, timeout finito, versiones fijadas cuando aplique y no imprime secretos ni material de claves.
- `ai/HANDOFF.md` enumera archivos, comandos, resultados, riesgos y una sección `NO_VERIFICADO`.
- Todo defecto confirmado durante la revisión deja prueba de regresión cuando sea técnicamente posible y lección generalizable en `ai/QA_LESSONS.md`.

## Trabajo prohibido

- Crear proyecto Xcode, app, SwiftUI, navegación o UI.
- Implementar Keychain real, App Groups, widgets, extensiones o firma.
- Usar el iPhone o Mac de Manu, datos personales reales, exports, credenciales, secretos o identificadores reales.
- Conectar servicios, publicar, desplegar, activar Apple Developer Program, TestFlight, runners de pago o facturación.
- Iniciar BRAIN-02b, BRAIN-03 o fases posteriores.
- Rebajar gates, borrar historial documental o hacer merge.
- Modificar semántica pública de `ManuBrainDomain` salvo necesidad demostrada y acompañada de regresiones.
