# HANDOFF

## Estado

No hay una implementación activa. BRAIN-00 dejó preparada la documentación fundacional, revisada el 2026-09-28 por ADR-0007 y, el mismo día, por las decisiones de producto de Manu. BRAIN-01 sigue `NOT_AUTHORIZED`.

## Última tarea: decisiones de producto de Manu (2026-09-28)

Autorizada explícitamente por Manu, solo para documentación. Ejecutada por Claude Code en la rama `chore/brain-00-foundation` (PR #1, en borrador), sobre el commit `3158903`.

### Cambios realizados

- Nuevos:
  - `docs/product/EXPERIENCE.md`: visión funcional completa con la viabilidad de cada pieza.
  - `docs/adr/0008-source-retention-and-controlled-deletion.md`: retención por fuente y borrado controlado.
  - `docs/adr/0009-manu-assistant-without-mandatory-ai.md`: chat MANU con nivel base sin IA y nivel conversacional opcional.
- Modificados:
  - `docs/product/PRODUCT_CHARTER.md`, `docs/product/MVP_ACCEPTANCE.md` (MVP técnico interno frente a Beta 1).
  - `docs/architecture/ARCHITECTURE.md`, `docs/architecture/DATA_MODEL.md`, `docs/architecture/DECISIONS_AND_OPEN_ITEMS.md` (recomendación D-01, datos para D-04, D-07 a D-09).
  - `docs/integrations/INTEGRATIONS.md`, `docs/roadmap/ROADMAP.md`, `docs/roadmap/BACKLOG.md`, `docs/roadmap/BRAIN_01_TASK.md` (solo nota).
  - `docs/security/RISK_REGISTER.md` (R-24 a R-40), `docs/security/THREAT_MODEL.md`, `docs/research/SOURCES.md`.
  - `docs/adr/README.md`, `docs/adr/0002-evidence-backed-knowledge.md` y `docs/adr/0007-native-iphone-first.md` (solo notas añadidas; su decisión no se reescribe).
  - `README.md`, `AGENTS.md`, `ai/*.md` salvo `QA_REPORT.md`.

### Verificación ejecutada

Ver la sección de verificación del PR #1 y el informe de la tarea. Comprobaciones: pasos de `foundation-check.yml` reproducidos en local, enlaces Markdown relativos, IDs R-xx/G-xx/D-xx definidos y ausencia de archivos de código o infraestructura en el diff.

### Riesgos

- Los valores P/I de R-15 a R-40 son estimaciones iniciales sin evidencia.
- Varias conclusiones técnicas dependen de documentación de Apple y Spotify consultada el 2026-09-28; pueden cambiar.
- El entorno local está verificado: `MacBookPro14,2` de 2017, oficialmente limitado a Ventura, ejecutando Sonoma 14.8.7 mediante un mecanismo no verificado. No se usará para compilar ni se actualizará a Tahoe para este proyecto.

## NO VERIFICADO

- No se ha implementado ni probado nada de MANU BRAIN, las apps ni sus extensiones.
- Compilación, firma e instalación de la app integrada en el iPhone 14 con iOS 27 (D-04B).
- Compatibilidad real de la futura app de Mac con `MacBookPro14,2`.
- Capacidades disponibles con cuenta gratuita (HealthKit, contenedor compartido, notificaciones push) frente a Apple Developer Program.
- Controles del Centro de Control, AlarmKit, disparadores de Atajos y borrado en Fotos en el iPhone de Manu.
- Spotify DJ, Chromecast, batería de AirPods, Toque posterior y disparador de transacciones de Wallet.
- Calidad del OCR y del reconocimiento de voz en español.
- Grabación de llamadas y detección de llegada a casa.
- Utilidad del chat MANU sin modelo.

## Próximo paso

Revisión y merge del PR #1. D-01 está decidida (Swift/SwiftUI) y D-04 permite verificar BRAIN-01 en GitHub Actions. D-03 y D-04B se aplazan hasta BRAIN-02. Solo con autorización explícita, revalidar y autorizar BRAIN-01.
