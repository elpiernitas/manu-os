# ADR-0012 — Núcleo de almacenamiento BRAIN-02a y dependencia Argon2id

- Status: **ACCEPTED** (pendiente de revisión externa)
- Date: **2026-09-28**

## Decisión

- Módulo `ManuBrainStorage` (Swift Package) con puertos `LocalStore`, `BlobStore` y `KeyStore`; SQLite del sistema, AES-256-GCM (CryptoKit), HKDF para subclaves.
- Argon2id mediante la implementación de referencia P-H-C (`https://github.com/P-H-C/phc-winner-argon2`), fijada por **revisión exacta** `f57e61e19229e23c4445b85494dbf7c07de721cb` (sin etiqueta de versión que incluya `Package.swift`; la etiqueta `20190702` no lo trae).
- Alternativa descartada: `Argon2Swift 1.0.4`, que depende de la rama `master` de la misma librería y SPM no admite ramas en dependencias transitivas.

## Superficie y riesgo (R-41)

- Código C compilado desde fuente por SwiftPM en tiempo de build (`ref.c`, sin optimizaciones SIMD); nada se descarga en ejecución. Se usa solo `argon2id_hash_raw`.
- Sin actividad de releases desde 2021: se acepta porque el algoritmo es estable (RFC 9106) y la validación se apoya en vectores conocidos (`test.c` de la referencia). Riesgo residual: la revisión no está firmada ni etiquetada; se documenta para revisión.
- Parámetros: perfil `standard` 64 MiB / 3 pasadas / 1 carril; límites 8·p ≤ memoria ≤ 256 MiB, ≤ 10 pasadas, ≤ 8 carriles; sal ≥ 16 bytes. Los parámetros de un `WrappedKey` se validan al decodificar.

## Diseño

- Registros: `AES-GCM(nonce aleatorio de 12 bytes)`, AAD = `collection|id`; mover un ciphertext a otro registro falla. Colección e id quedan en claro.
- Blobs: archivos `<HMAC-SHA256(subclave, contenido)>.blob`, cifrados con AAD = dirección; se verifica la dirección al leer. No se usa SHA-256 sin clave para no revelar el hash del contenido.
- Migraciones: `PRAGMA user_version`, v1 (registros) y v2 (`blob_refs` con clave foránea y cascada). Una versión futura se rechaza sin modificar el archivo.
- Borrado (`SourceDeletionService`): borra blobs exclusivos, registro + evento COMPLETED en una transacción, `secure_delete=ON` y `VACUUM`. Sin garantías sobre SSD/APFS más allá de lo que las pruebas comprueban sobre el archivo SQLite.
