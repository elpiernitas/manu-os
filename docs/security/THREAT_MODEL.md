# 04 — Privacidad, threat model, backups y exportación

## Activos de mayor sensibilidad

- fuentes originales y conversaciones;
- relaciones, identidades, salud, ubicación y calendario;
- inferencias sobre comportamiento;
- claves del vault y secretos de recuperación;
- refresh tokens OAuth;
- prompts y datos enviados a modelos;
- exports y backups completos.

## Fronteras de confianza

1. iPhone/Mac de Manu.
2. JavaScript y dependencias cargadas por la PWA.
3. hosting/API de referencia.
4. almacenamiento remoto cifrado.
5. proveedores OAuth.
6. modelos y servidores MCP externos.
7. repositorio/CI.

## Amenazas y controles

| Amenaza | Riesgo | Controles BRAIN-00 | Estado |
| --- | --- | --- | --- |
| pérdida o robo del dispositivo | acceso al vault desbloqueado | passcode/biometría del SO, bloqueo de sesión, cifrado local razonable, revocación de dispositivo | DECIDIDO |
| proveedor cloud comprometido | filtración de corpus | cifrado en cliente; servidor recibe ciphertext y metadatos mínimos | DECIDIDO |
| XSS o dependencia maliciosa | robo de datos/clave con vault abierto | CSP estricta, sin scripts remotos, lockfile, auditoría, Trusted Types cuando sea viable, escapar HTML | DECIDIDO |
| secreto en Git | toma de cuentas | `.env.example`, secret scanning, CI sin volcar entorno, rotación y revisión de commits | DECIDIDO |
| robo de refresh token | acceso a integración | cifrado en reposo, scopes mínimos, revocación, no exponer al frontend si no es necesario | DECIDIDO |
| prompt injection en email/documento | agente ejecuta instrucciones hostiles | tratar fuentes como datos, herramientas allowlist, lectura por defecto, aprobación antes de escritura, logs | DECIDIDO |
| MCP malicioso/alterado | exfiltración o acción inesperada | servidores oficiales/auditados, aprobación, pin/registro de versión, mostrar argumentos y destino | DECIDIDO |
| sync corrupto/replay | pérdida o rollback | hashes, IDs idempotentes, reloj lógico, firma por dispositivo, cursores y detección de replay | DECIDIDO |
| borrado accidental | pérdida de memoria | tombstones, papelera, backup cifrado y pruebas de restauración | DECIDIDO |
| cuota o cierre de proveedor | indisponibilidad | local-first, adaptadores, export abierto, modo offline y degradación visible | DECIDIDO |
| modelo inventa conocimiento | falsedad presentada como hecho | salida `PROPOSED`, clasificación visible, evidencia obligatoria, revisión humana | DECIDIDO |
| telemetría revela intimidad | metadatos sensibles | sin analítica de terceros; logs minimizados, redacción y corta retención | DECIDIDO |

## Políticas obligatorias

- Sin Google Analytics, trackers publicitarios ni session replay.
- Sin claves de IA o secrets OAuth en el frontend o repositorio.
- CSP sin `unsafe-eval`; cualquier excepción requiere ADR y fecha de retirada.
- Dependencias mínimas, versiones fijadas y actualizaciones revisadas.
- El contenido de notificaciones push es genérico; los detalles se descifran al abrir.
- Las integraciones empiezan desconectadas y solicitan un scope cuando una función lo necesita.
- Export y borrado están en Ajustes, no ocultos.
- Cada envío a una IA o MCP registra proveedor, propósito, categorías, IDs de origen y consentimiento; nunca el secreto.
- Nunca se sube una exportación personal real a fixtures o CI.

## Retención

- Fuentes originales: hasta borrado explícito de Manu.
- Derivados: regenerables; se pueden purgar y recalcular.
- Sync events: compactación tras snapshot verificado, conservando manifiesto e historial mínimo.
- Logs de servicio: sin contenido; retención objetivo ≤ 7 días.
- Papelera: 30 días por defecto antes de purga física.
- Tokens revocados: borrado inmediato del token, conservación de evento de revocación sin secreto.

## Backup 3-2-1 adaptado

- Copia 1: vault operativo local.
- Copia 2: sync/backup remoto cifrado.
- Copia 3: export cifrado periódico guardado por Manu en otra ubicación (por ejemplo iCloud Drive o disco externo).

El producto no declarará backup funcional hasta superar una restauración completa en un perfil limpio. Cada backup incluye:

- `manifest.json` versionado;
- tablas en JSONL;
- originales y blobs por hash;
- checksums;
- historial de migraciones;
- versión mínima del importador;
- informe de elementos omitidos y motivo.

## Exportación abierta

Dos modos:

- **Portable ZIP**: JSONL + Markdown/CSV auxiliares + originales. Puede ir cifrado con una contraseña diferente.
- **Snapshot técnico**: conserva eventos, ciphertext y metadatos para restauración exacta.

Exportar todo no significa exportar credenciales. OAuth tokens, claves privadas, cookies y claves de servidor nunca se incluyen. El manifiesto enumera integraciones y cómo volver a autorizarlas.

## Respuesta a incidentes

1. Bloquear sync y revocar el dispositivo/integración.
2. Conservar logs mínimos y hashes de evidencia.
3. Rotar secrets de servicio y OAuth.
4. Invalidar sesiones.
5. Comparar con último snapshot válido.
6. Restaurar sin sobrescribir la única copia.
7. Documentar causa, alcance y prevención en un ADR de incidente.

## Criterios de salida de seguridad del MVP

- threat model revisado tras implementar auth/sync;
- pruebas de cifrado, nonces e integridad;
- test de XSS/CSP básico;
- secret scanning en CI;
- revocación OAuth probada;
- export/restauración comprobado con fixture y después con una copia real controlada;
- ninguna petición de red inesperada al usar el modo local.
