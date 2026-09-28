# 08 — Decisiones y puntos abiertos

> Revisado el 2026-09-28 por [ADR-0007](../adr/0007-native-iphone-first.md). Las decisiones sustituidas se marcan, no se borran.

## Decisiones cerradas por BRAIN-00

- ~~PWA primero; app nativa no es requisito.~~ **Sustituida por ADR-0007**: la app nativa de iPhone es la interfaz principal desde las primeras fases.
- Arquitectura local-first con sync al estar activa.
- Cifrado de contenido en cliente antes de cloud sync.
- MANU BRAIN independiente de ChatGPT, Claude y Gemini.
- Modelo relacional + proyección de grafo; no Neo4j.
- Búsqueda textual primero; embeddings después y opcionales.
- Event log incremental; no CRDT genérico en MVP.
- Fuentes brutas inmutables; derivados regenerables.
- Google Drive appData es candidato preferido para backup/sync cifrado de coste cero, no acceso amplio a Drive.
- Cloudflare Worker/D1 es despliegue de referencia para servicio mínimo, no contrato del núcleo.
- R2 y servicios con cobro por exceso quedan fuera hasta verificar un límite duro.
- HOME, MIND y MIRROR se construyen después de Capture, evidencia, búsqueda y restore.
- El primer trabajo de Claude es el contrato temporal/evidencial con tests. *(Sigue vigente; su lenguaje depende de D-01.)*

## Decisiones cerradas por ADR-0007

- La app nativa de iPhone (Swift/SwiftUI) es la experiencia principal y el centro de configuración.
- Las superficies del sistema (widgets, pantalla bloqueada, Centro de Control, botón de acción, Live Activities, App Intents) son extensiones de esa app y aparecen desde BRAIN-03.
- Los modos cambian información, accesos, pantallas y comportamiento de MANU OS; los cambios del sistema se apoyan en Focus y Atajos configurados por Manu.
- El componente web/local-first es opcional y no bloquea la experiencia nativa.
- El gate G-05 queda retirado.
- Se mantienen: independencia de proveedores de IA, privacidad por diseño, cifrado, aprobación antes de escrituras sensibles y ausencia de facturación automática.

## Decisiones pendientes

| ID | Decisión | Opciones | Quién decide | Bloquea |
| --- | --- | --- | --- | --- |
| **D-01** | Qué parte será SwiftUI nativa y qué parte, si existe, seguirá siendo web. Incluye el lenguaje del núcleo MANU BRAIN y el acceso desde Mac. | (a) todo nativo: núcleo Swift, app iOS y, si hace falta, app macOS; (b) núcleo TypeScript compartido, UI nativa en iPhone y web en Mac; (c) contrato compartido (schemas y vectores de test) con implementaciones Swift y TypeScript | Manu, con propuesta técnica revisada | BRAIN-01, BRAIN-02 |
| **D-02** | Almacenamiento local nativo, desbloqueo, gestión de claves y contenedor compartido con extensiones | por evaluar tras D-01 | propuesta técnica + ADR | BRAIN-02 |
| **D-03** | Asumir o no Apple Developer Program | cuenta gratuita (perfiles que caducan, capacidades a verificar) o programa de pago (suscripción anual explícita) | Manu | BRAIN-02, parte de BRAIN-03 |
| **D-04** | Dónde se compila y se prueba la app iOS | Mac de Manu con Xcode; runner macOS en CI con coste validado; combinación | Manu | BRAIN-02 |
| D-05 | Fuente de calendario para el modo Trabajo | EventKit, Google Calendar read-only o ambos | Manu | BRAIN-09 |
| D-06 | Servicio meteorológico para el modo Mañana | ver `docs/integrations/INTEGRATIONS.md` | propuesta técnica | BRAIN-10 |

## Contradicciones resueltas

- «Conectar todas mis apps» se interpreta como una estrategia por rutas reales, no acceso automático universal.
- «PWA de altísima calidad» no implica que una PWA pueda usar frameworks nativos de Apple. *(Con ADR-0007 la PWA deja de ser la interfaz principal.)*
- «Coste 0 €» prevalece sobre integración inmediata con APIs que requieren billing o Developer Program. *(Apple Developer Program pasa a decisión explícita de Manu, D-03; sigue sin haber cobros automáticos.)*
- «Gemelo digital» significa representación informacional con fuentes, no imitación consciente ni voz autónoma.
- «Claude implementa» no convierte créditos temporales en dependencia del producto.
- «Capa sobre el iPhone» no significa sustituir el launcher ni controlar iOS: los modos actúan sobre MANU OS y se apoyan en Focus y Atajos.

## Supuestos que deben validarse durante implementación

- ~~Safari/iOS real conserva correctamente el vault dentro del patrón de uso de Manu.~~ Aplica solo si D-01 mantiene un componente web.
- El almacenamiento local nativo conserva el vault tras cierres, reinicios y actualizaciones de la app.
- Atajos y App Intents pueden entregar de forma cómoda los tipos de captura elegidos.
- Widgets, controles y Live Activities se comportan como se espera en el iPhone y la versión de iOS de Manu.
- Las capacidades necesarias están disponibles con el tipo de cuenta de desarrollador elegido (D-03).
- El flujo de Google OAuth puede pasar de Testing a producción con `drive.appdata` sin fricción relevante.
- ~~El rendimiento de IndexedDB/OPFS es suficiente para el tamaño inicial.~~ Aplica solo al componente web.
- La frase/secreto de recuperación ofrece una UX aceptable.
- El ranking contextual de HOME y la selección de modo aportan utilidad sin IA.

## Estado de acceso y autorizaciones

- El repositorio privado `elpiernitas/manu-os` existe. Claude Code tiene acceso desde el 2026-09-28 y lo usa para tareas documentales autorizadas explícitamente por Manu (revisión de BRAIN-00 y ADR-0007).
- Claude **no** está autorizado a implementar: BRAIN-01 sigue `NOT_AUTHORIZED`.
- No hacen falta todavía API keys, OAuth de Google, Apple Developer, tarjeta, dominio ni exportaciones personales.

## Intervención de Manu necesaria

- Cerrar D-01, D-03 y D-04 (D-02 depende de D-01).
- Autorizar explícitamente BRAIN-01 cuando corresponda.

## Intervenciones futuras, no ahora

- autorizar scopes Google uno por uno;
- instalar la app en el iPhone y asignar el botón de acción o los controles;
- configurar los Focus que usarán los modos;
- guardar de forma segura el secreto de recuperación;
- decidir si una integración sensible aporta suficiente valor;
- aprobar cualquier servicio con coste;
- aportar exports reales solo cuando importador, cifrado y backup estén preparados.

## Riesgos técnicos principales

1. Pérdida/evicción de almacenamiento local si no existe backup probado.
2. UX del cifrado demasiado pesada.
3. OAuth y verificaciones Google más complejos que la API técnica.
4. Expectativas de integración Apple mayores que lo permitido por el sistema.
5. Prompt injection al incorporar correo y documentos.
6. Modelo de datos demasiado genérico o demasiado rígido.
7. Sync conflictivo entre iPhone y Mac.
8. Deriva del proyecto hacia IA o superficies llamativas antes de resolver captura y recuperación.
9. Dependencias de terceros con acceso al vault desbloqueado.
10. Falta de pruebas reales de restore.
11. Aprovisionamiento y entorno de compilación iOS (D-03, D-04).
12. Datos financieros, grabaciones y superficies visibles con el iPhone bloqueado.

Cada riesgo tiene un gate correspondiente en el roadmap y una entrada en `docs/security/RISK_REGISTER.md`.
