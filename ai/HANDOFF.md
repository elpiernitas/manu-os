# HANDOFF

## Estado

No hay una implementación activa. BRAIN-00 dejó preparada la documentación fundacional; el 2026-09-28 se revisó para reflejar la nueva visión (ADR-0007: experiencia nativa de iPhone como prioridad). BRAIN-01 sigue `NOT_AUTHORIZED`.

## Última tarea: revisión documental ADR-0007

Autorizada explícitamente por Manu. Ejecutada por Claude Code en la rama `chore/brain-00-foundation` (PR #1, en borrador). Solo documentación; sin código de producto.

### Cambios realizados

- `docs/adr/0007-native-iphone-first.md`: nuevo ADR aceptado; sustituye a ADR-0001.
- `docs/adr/0001-local-first-pwa.md`: estado `SUPERSEDED`, contenido original conservado.
- `docs/adr/README.md`, `ai/DECISIONS.md`: índice y registro de decisiones actualizados.
- `docs/product/PRODUCT_CHARTER.md`: propósito, modos, casos de uso descubiertos, MVP, límites y tabla de historial de cambios.
- `docs/product/MVP_ACCEPTANCE.md`: recorrido centrado en la app nativa, modos, superficies y retirada de permisos.
- `docs/architecture/ARCHITECTURE.md`: diagrama, superficies nativas y modos, filas de la tabla marcadas como sustituidas o pendientes (D-01/D-02), distribución y aprovisionamiento (D-03/D-04); secciones PWA y companion conservadas como sustituidas.
- `docs/architecture/DECISIONS_AND_OPEN_ITEMS.md`: decisiones sustituidas, decisiones ADR-0007, decisiones pendientes D-01 a D-06, estado de acceso de Claude.
- `docs/integrations/INTEGRATIONS.md`: columna nueva «Con app nativa», filas de superficies del sistema, alarma, voz y llamadas; secciones «Momentos y servicios externos» y «Finanzas».
- `docs/roadmap/ROADMAP.md`, `docs/roadmap/BACKLOG.md`: fases reordenadas, BRAIN-13 y BRAIN-14, G-05 retirado, gates G-07 a G-09, tabla del roadmap original sustituido.
- `docs/roadmap/BRAIN_01_TASK.md`: estado explícito `NOT_AUTHORIZED` y nota de revalidación contra D-01; especificación original intacta.
- `docs/security/RISK_REGISTER.md`: R-01, R-11 y R-13 ajustados; nuevos R-15 a R-23.
- `docs/security/THREAT_MODEL.md`: activos, fronteras, amenazas y políticas de la app nativa, extensiones, finanzas y grabaciones.
- `docs/research/SOURCES.md`: fuentes Apple añadidas y lista de capacidades sin fuente verificada.
- `README.md`, `AGENTS.md`, `ai/PROJECT_STATE.md`, `ai/CURRENT_TASK.md`: visión nueva y referencias a Claude actualizadas.

### Verificación ejecutada

- Pasos de `.github/workflows/foundation-check.yml` reproducidos localmente con bash: documentos canónicos presentes, sin `.env` versionados, `Status` válido en `ai/CURRENT_TASK.md`. Resultado: PASS en los tres pasos.
- Comprobación de enlaces Markdown relativos: sin enlaces rotos.
- Comprobación de que todos los IDs R-xx, G-0x y D-0x citados están definidos: sin IDs huérfanos.
- Búsqueda de referencias obsoletas («Claude no conectado», «PWA primera interfaz»): solo quedan en ADR-0001 sustituido y en el contexto de ADR-0007.

### Riesgos

- Los valores P/I de R-15 a R-23 son estimaciones iniciales sin evidencia.
- Parte de la documentación (DATA_MODEL, detalles de cifrado) sigue escrita pensando en la web; se ha marcado lo que depende de D-01/D-02, pero puede quedar algún detalle sin marcar.

## NO VERIFICADO

- No se ha implementado ni probado MANU BRAIN.
- No se han probado app nativa, widgets, App Intents, Centro de Control, botón de acción, Live Activities, Focus, almacenamiento, cifrado, sync ni integraciones.
- Qué capacidades funcionan con cuenta Apple gratuita frente a Apple Developer Program.
- Existencia y condiciones de una API de alarmas para terceros, controles del Centro de Control en la versión de iOS de Manu y rutas reales para grabar llamadas.
- El resultado del workflow de GitHub Actions tras el push (se comprueba en el PR).

## Próximo paso

Revisión del PR #1 por Manu. Después, cerrar D-01, D-03 y D-04 y, solo con autorización explícita, revalidar y autorizar BRAIN-01.
