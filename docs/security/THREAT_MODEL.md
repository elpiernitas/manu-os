# 04 — Privacidad, threat model, backups y exportación

> Revisado el 2026-09-28 por [ADR-0007](../adr/0007-native-iphone-first.md): se añaden activos, fronteras y amenazas de la app nativa, sus extensiones, finanzas y grabaciones. Revisado de nuevo el mismo día por las decisiones de producto de Manu ([ADR-0008](../adr/0008-source-retention-and-controlled-deletion.md), [ADR-0009](../adr/0009-manu-assistant-without-mandatory-ai.md)): borrado controlado de fuentes, asistente, Refugio, salud, personas y ausencia de bloqueo interno. Revisado de nuevo el mismo día por [ADR-0011](../adr/0011-native-local-storage-and-keys.md): diseño concreto del contenedor compartido y de la protección de archivo. Los controles nuevos están marcados `PENDIENTE`; no están implementados.

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
- snapshot compartido con las extensiones;
- datos del Refugio: estado emocional, desencadenantes, personas relacionadas y evolución;
- datos de salud: sueño, actividad, ritmo cardiaco, estado de ánimo y comidas;
- perfiles de personas y chats importados (datos de terceros);
- texto extraído de capturas de pantalla (puede contener cualquier cosa, incluidas credenciales o datos bancarios);
- registro de sugerencias y patrones aprendidos (describe hábitos);
- ubicación de casa y llegadas;
- lista blanca de mensajes automáticos.

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
| pérdida o robo del dispositivo | acceso al vault desbloqueado | passcode/biometría del SO, ~~bloqueo de sesión~~ (sustituido: sin bloqueo interno por decisión de Manu, R-33), cifrado local, revocación de dispositivo | DECIDIDO |
| dispositivo desbloqueado en manos de otra persona | acceso a Refugio, salud, finanzas y personas sin barrera adicional | riesgo aceptado por Manu (R-33); lo sensible no aparece en superficies bloqueadas ni notificaciones | ACEPTADO |
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
| extensión con acceso excesivo | una extensión comprometida o con fallo lee el vault completo | las extensiones solo leen el snapshot del modo activo; sin claves del vault en el contenedor compartido (App Group, D-02 decidida por ADR-0011) | PENDIENTE (implementación en BRAIN-02c) |
| App Intent invocado sin intención de Manu | acción ejecutada desde Siri, Atajos o automatización | intents de lectura y captura sin efectos externos; cualquier escritura sensible pide confirmación; nada destructivo sin la app desbloqueada | PENDIENTE |
| grabación sin consentimiento | infracción legal y daño a terceros | G-08; consentimiento explícito de todos los participantes; aviso visible; revisión legal aplicable | PENDIENTE |
| filtración de transcripciones | exposición de conversaciones y datos de terceros | transcripción en el dispositivo; envío a modelos solo con aprobación del lote; retención definida | PENDIENTE |
| extracción financiera errónea | decisiones basadas en datos incorrectos | movimientos `PROPOSED` hasta confirmación; original conservado con hash; insights con procedencia | PENDIENTE (G-07) |
| filtración de datos financieros | fraude o exposición | cifrado; nada en superficies bloqueadas; sin envío a modelos sin aprobación; sin credenciales bancarias en MVP | PENDIENTE (G-07) |
| pérdida de la app por caducidad del aprovisionamiento | la app deja de abrirse y el vault local queda inaccesible | export/restore probado antes de datos reales; decisión D-03; instrucciones de reinstalación | PENDIENTE (D-03) |
| dependencia Swift maliciosa | robo de datos con el vault abierto | dependencias mínimas, versiones fijadas, revisión de cambios | PENDIENTE |
| borrado erróneo de originales | pérdida de información o historial falso | G-10; confirmación en MANU OS y en iOS; texto extraído guardado antes de pedir el borrado; registro del resultado real (ADR-0008) | PENDIENTE |
| captura con credenciales o datos bancarios | secretos guardados como texto extraído | etiquetado sensible; detección básica de patrones de credenciales con aviso a Manu; nunca en superficies ni exportaciones compartibles | PENDIENTE |
| prompt injection en enlaces, capturas o chats importados | MANU sigue instrucciones escondidas en el contenido | todo contenido capturado es dato, nunca instrucción; las acciones solo salen de Manu o de reglas autorizadas | PENDIENTE |
| mensaje automático indebido | envío en nombre de Manu que él no quería | G-14; lista blanca explícita; registro de envíos; ningún otro mensaje automático | PENDIENTE |
| proveedor de modelo recibe datos sensibles | exposición de salud, finanzas, Refugio o chats | G-13; exclusión por defecto; decisión específica y revisión de condiciones | PENDIENTE |
| Refugio ante riesgo real | respuesta inadecuada en una crisis | G-12; priorizar ayuda humana inmediata (112, 024); no diagnosticar ni actuar como terapia | PENDIENTE |
| informe del Laboratorio con datos personales | datos enviados a GitHub u otro agente | nada se envía automáticamente; informe revisable; sin datos personales salvo que Manu los añada | PENDIENTE |
| aprendizaje proactivo intrusivo | perfil de hábitos visible o mal usado | aprendizaje local, visible y borrable; sin envío a terceros | PENDIENTE |

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
- MANU OS no envía mensajes automáticamente salvo los de la lista blanca explícita (G-14).
- Lo etiquetado `SENSITIVE` no entra en exportaciones compartibles; el backup completo cifrado sí lo incluye.
- Salud, finanzas, Refugio, chats privados y transcripciones no se envían a ningún proveedor de modelo sin decisión específica (G-13).

## Retención

- Fuentes originales: según su política de retención (ADR-0008); con `FULL`, hasta borrado explícito de Manu.
- Capturas de la bandeja diaria: el original no se conserva en MANU OS (`EXTRACTED_ONLY`).
- Audios de respuesta: se descartan tras transcribirlos (`TRANSIENT`).
- Registro de procedencia y eventos de eliminación: se conservan mientras exista algún derivado de la fuente.
- Datos del Refugio y de salud: política de retención pendiente de G-12 y G-11.
- Derivados: regenerables; se pueden purgar y recalcular.
- Sync events: compactación tras snapshot verificado, conservando manifiesto e historial mínimo.
- Logs de servicio: sin contenido; retención objetivo ≤ 7 días.
- Papelera: 30 días por defecto antes de purga física.
- Tokens revocados: borrado inmediato del token, conservación de evento de revocación sin secreto.
- Grabaciones y transcripciones: política de retención pendiente de G-08.
- Datos financieros: política de retención pendiente de G-07.

## Backup 3-2-1 adaptado

- Copia 1: vault operativo local (iPhone y Mac).
- Copia 2: sync cifrado (D-07).
- Copia 3: copia completa semanal cifrada en el Mac; copia manual por cable como opción adicional. Se recomienda que Manu guarde además una copia en otra ubicación.

La copia en el Mac y el vault del Mac están en el mismo equipo: si falla el Mac, se pierden ambos. Por eso la copia 2 o una copia externa siguen siendo necesarias.

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

- **Portable ZIP**: JSONL + Markdown/CSV auxiliares + originales conservados + procedencia y eventos de eliminación. Puede ir cifrado con una contraseña diferente. Lo `SENSITIVE` solo se incluye si Manu lo elige de forma explícita.
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
- prueba de retirada de cada permiso usado en el recorrido del MVP;
- prueba de borrado controlado de fuentes con registro correcto (G-10);
- cero mensajes automáticos fuera de la lista blanca;
- cero datos sensibles enviados a proveedores de modelo sin decisión específica.

## App web (ADR-0012, ADR-0013)

| Riesgo | Impacto | Control | Estado |
|---|---|---|---|
| copia en Drive legible por Google o por quien acceda a la cuenta | filtración del vault | cifrado en el cliente AES-256-GCM + PBKDF2 (600 000 iteraciones), frase que nunca se guarda ni se sube, subida solo manual, `saveBackup` rechaza texto en claro | VERIFICADO en navegador con servicios simulados |
| envío de datos sensibles a Gemini | exposición a un proveedor de modelo | payload exacto visible; confirmación por petición, salvo que Manu active «Enviar sin preguntar» (desactivado por defecto, WEB-12); sin contexto por defecto; lista de bloqueo de mejor esfuerzo (no exhaustiva) | VERIFICADO en navegador con Gemini simulado |
| acción dañina propuesta por Gemini | cambios no deseados en los datos locales | lista cerrada de funciones; `parseCalls` valida y descarta lo desconocido; ninguna acción sin toque de Manu; sin borrar ni enviar datos; importar solo abre el selector | VERIFICADO en navegador con Gemini simulado |
| captura con datos sensibles enviada a Gemini | exposición a un proveedor de modelo | envío solo con un toque explícito y aviso junto al botón; nunca con «Enviar sin preguntar»; la imagen no se puede filtrar, así que decide Manu | VERIFICADO en navegador con Gemini simulado |
| enlace consultado en oEmbed de TikTok o YouTube | el servicio ve qué enlace consultas | solo al pulsar «✨ Que MANU lo lea»; solo el texto público del vídeo; Instagram no se consulta | DECIDIDO |
| capturas guardadas en el móvil | acceso con el móvil desbloqueado | IndexedDB local; fuera de las copias; «Borrar todos los datos» las elimina | VERIFICADO en navegador |
| sugerencia de mejora con datos personales | publicación en un repositorio público | aviso de repositorio público; no se prepara si el texto parece sensible; Manu revisa y envía la petición en GitHub | DECIDIDO |
| robo de la clave de Gemini | uso de la cuota de Manu | clave fuera del vault; `sessionStorage` por defecto; `localStorage` solo si Manu lo activa (riesgo aceptado); CSP restrictiva | DECIDIDO |
| permisos de Google excesivos | acceso innecesario a datos | un scope por función, integraciones desconectadas por defecto, `drive.appdata` en lugar de `drive`, `contacts.readonly` | VERIFICADO (petición de scope) |
| pérdida del `localStorage` en iOS | pérdida de datos | exportación manual y copia cifrada en Drive con restauración probada en perfil limpio | PARCIAL: no probado en iOS |
| robo de los tokens de Spotify | control de la reproducción de Manu | PKCE sin secreto, scopes solo de reproducción, tokens fuera del vault, CSP restrictiva, «Desconectar» los borra | DECIDIDO |
| teléfonos de terceros | exposición de datos de contacto | opcionales, solo en el dispositivo y en su copia cifrada; nunca en el repositorio; bloqueados para Gemini | DECIDIDO |

