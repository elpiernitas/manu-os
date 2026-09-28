# MANU OS — Project State

Última actualización: 2026-09-29

## Estado actual

- **Línea web (ADR-0012)**: app web instalable publicada en GitHub Pages desde `main`. WEB-01 a WEB-05 están fusionadas. WEB-05 entró mediante el PR #13 (squash `7c16024`) con 45/45 pruebas y los workflows `MANU OS web` y `Foundation check` verdes.
- WEB-05 integra Gemini opcional y Google Calendar, Tasks, Contacts y Drive con confirmación explícita, scopes incrementales y copia cifrada. Las llamadas reales siguen `NO_VERIFICADO` hasta que Manu configure sus credenciales fuera del repositorio.
- **WEB-05-VERIFY**: tarea documental activa para preparar el runbook seguro y reversible de validación real. No conecta servicios ni usa credenciales.
- BRAIN-00 y BRAIN-01: **COMPLETED Y FUSIONADOS**.
- BRAIN-02-PREP: **COMPLETED Y FUSIONADO** mediante PR #5.
- BRAIN-02 nativo: **PAUSADO**; PR #7, #8 y #9 en borrador.
- Servicios externos: ninguno conectado desde el repositorio ni desde CI.
- Datos personales reales: ninguno incorporado.
- Deploy: GitHub Pages está autorizado; solo publica contenido estático de `web/` desde `main`.

## Fuente de verdad

Los documentos canónicos están en `docs/`. La tarea activa se controla mediante `ai/CURRENT_TASK.md`.

## Siguiente gate

1. Revisar y fusionar el runbook WEB-05-VERIFY.
2. Manu decide cuándo crear, fuera de Git, el ID OAuth de Google y la clave opcional de Gemini.
3. Ejecutar el runbook en su dispositivo sin publicar secretos ni datos personales.
4. Mantener la línea nativa pausada hasta que exista una vía de instalación sin coste o Manu decida otra cosa.

## Restricciones vigentes

- No activar facturación ni servicios de pago.
- No introducir credenciales, tokens ni datos personales en Git, CI, issues o PRs.
- No presentar como verificado el comportamiento con cuentas reales hasta ejecutar el runbook.
- No reanudar BRAIN-02 nativo mientras siga pausado.
