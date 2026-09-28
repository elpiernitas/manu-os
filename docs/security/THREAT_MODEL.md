# 04 — Privacidad, threat model, backups y exportación

> Revisado el 2026-09-28 por [ADR-0007](../adr/0007-native-iphone-first.md): se añaden activos, fronteras y amenazas de la app nativa, sus extensiones, finanzas y grabaciones. Los controles nuevos están marcados `PENDIENTE` porque dependen de D-01 a D-04; no están implementados.

## Activos de mayor sensibilidad

- fuentes originales y conversaciones;
- relaciones, identidades, salud, ubicación y calendario;
- inferencias sobre comportamiento;
- claves del vault y secretos de recuperación;
- refresh tokens OAuth;
- prompts y datos enviados a modelos;
- exports y backups completos;
- datos financieros: capturas, extractos, movimientos e insights;
- grabaciones de audio, transcripciones y resúmenes, incluidas voces y datos de terceros;
- configuración de modos, horarios y excepciones (revela rutinas y contactos importantes);
- snapshot compartido con las extensiones.

## Fronteras de confianza

1. iPhone/Mac de Manu.
2. JavaScript y dependencias cargadas por un componente web (si D-01 lo mantiene).
3. hosting/API de referencia.
4. almacenamiento remoto cifrado.
5. proveedores OAuth.
6. modelos y servidores MCP externos.
7. repositorio/CI.
8. extensiones de la app (widgets, controles, Live Activities, App Intents, Share Extension) y el contenedor compartido con ellas.
9. superficies visibles con el iPhone bloqueado (pantalla bloqueada, notificaciones, Live Activities).
10. servicios de Apple usados por la app (Siri/Atajos, notificaciones push, iCloud si se usa) y dependencias Swift de terceros.

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
| lectura de la pantalla bloqueada por otra persona | exposición de calendario, finanzas, contactos o tareas | snapshot mínimo; clasificación de sensibilidad por tipo de dato; redacción por defecto con el iPhone bloqueado; G-09 | PENDIENTE |
| extensión con acceso excesivo | una extensión comprometida o con fallo lee el vault completo | las extensiones solo leen el snapshot del modo activo; sin claves del vault en el contenedor compartido | PENDIENTE (D-02) |
| App Intent invocado sin intención de Manu | acción ejecutada desde Siri, Atajos o automatización | intents de lectura y captura sin efectos externos; cualquier escritura sensible pide confirmación; nada destructivo sin la app desbloqueada | PENDIENTE |
| grabación sin consentimiento | infracción legal y daño a terceros | G-08; consentimiento explícito de todos los participantes; aviso visible; revisión legal aplicable | PENDIENTE |
| filtración de transcripciones | exposición de conversaciones y datos de terceros | transcripción en el dispositivo; envío a modelos solo con aprobación del lote; retención definida | PENDIENTE |
| extracción financiera errónea | decisiones basadas en datos incorrectos | movimientos `PROPOSED` hasta confirmación; original conservado con hash; insights con procedencia | PENDIENTE (G-07) |
| filtración de datos financieros | fraude o exposición | cifrado; nada en superficies bloqueadas; sin envío a modelos sin aprobación; sin credenciales bancarias en MVP | PENDIENTE (G-07) |
| pérdida de la app por caducidad del aprovisionamiento | la app deja de abrirse y el vault local queda inaccesible | export/restore probado antes de datos reales; decisión D-03; instrucciones de reinstalación | PENDIENTE (D-03) |
| dependencia Swift maliciosa | robo de datos con el vault abierto | dependencias mínimas, versiones fijadas, revisión de cambios | PENDIENTE |

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
- Los permisos del sistema se piden cuando Manu usa la función que los necesita, con un texto que explica para qué; la app sigue funcionando si se deniegan.
- Widgets, Live Activities y notificaciones visibles con el iPhone bloqueado no muestran contenido sensible sin permiso explícito por tipo de dato.
- MANU OS no inicia pagos ni transferencias ni graba llamadas sin consentimiento.

## Retención

- Fuentes originales: hasta borrado explícito de Manu.
- Derivados: regenerables; se pueden purgar y recalcular.
- Sync events: compactación tras snapshot verificado, conservando manifiesto e historial mínimo.
- Logs de servicio: sin contenido; retención objetivo ≤ 7 días.
- Papelera: 30 días por defecto antes de purga física.
- Tokens revocados: borrado inmediato del token, conservación de evento de revocación sin secreto.
- Grabaciones y transcripciones: política de retención pendiente de G-08.
- Datos financieros: política de retención pendiente de G-07.

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
- ninguna petición de red inesperada al usar el modo local;
- ningún contenido sensible visible con el iPhone bloqueado;
- prueba de retirada de cada permiso usado en el recorrido del MVP.
