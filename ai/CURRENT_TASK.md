# CURRENT TASK

Status: **REVIEW_PENDING**

WEB-06 implementado por Claude Code en el PR #15 y pendiente de la revisión del orquestador.

## Tarea activa

WEB-06 — importar en el dispositivo el Excel (.xls) de movimientos de Banco Sabadell y aprender categorías por comercio (`ai/HANDOFF.md`, «WEB-06»), dentro de la línea web ([ADR-0012](../docs/adr/0012-installable-web-app-as-operational-path.md)).

## Autorización

- 2026-09-28: Manu decide que la vía operativa es una app web instalable en GitHub Pages (no puede instalar la app nativa sin Mac con Xcode ni pagar). Hace público el repositorio, activa Pages y autoriza a Claude Code a fusionar los PR web #10, #11 y #12.
- 2026-09-28: Manu autoriza Gemini y «todo» lo posible de Google, a coste 0 €.
- 2026-09-28: Manu sube su extracto de Sabadell (.xls) para que la app lo lea. El archivo real no entra en el repositorio; solo se usan recuentos en local y un fixture inventado.
- El orquestador (ChatGPT/Codex) revisa el PR #15. Claude Code **no fusiona** sin su aprobación. Los PR #7, #8 y #9 quedan en borrador o pausa.

## Alcance autorizado

- código en `web/` (sin servidor), tests y workflow `web.yml`;
- integración opcional con Gemini y con Google (Calendar, Tasks, Contactos, Drive) con consentimiento de Manu en su dispositivo;
- documentación canónica, ADR, threat model, handoff y QA lessons.

## Criterios de aceptación (WEB-06)

- el .xls BIFF de Sabadell se lee en el dispositivo, sin red; la dependencia de terceros está fijada por SHA-256 y con licencia;
- no se pierden movimientos idénticos del mismo día, y reimportar no duplica nada;
- las correcciones de categoría de Manu se aplican por comercio sin sobrescribir entradas ya confirmadas;
- ningún dato real en el repositorio; fixture inventado; `npm test` y los dos workflows remotos en verde.

## Trabajo prohibido

- usar credenciales o datos reales en código, tests o CI; conectar servicios desde CI;
- activar facturación o servicios de pago;
- fusionar el PR #15 sin la aprobación del orquestador.

---

## Historial (cerrado)

- **WEB-05** (Gemini opcional y servicios de Google, ADR-0013): CERRADA. Fusionada en `main` mediante el PR #13 (`7c16024`) tras tres rondas de revisión.
- **BRAIN-02-PREP**: CERRADA. Fusionada en `main` mediante el PR #5 (commit `ff2f86a`). Su definición completa, con el alcance, los criterios y las prohibiciones de entonces, está en ese commit. Ya no rige: la línea de trabajo vigente es la web (ADR-0012 y ADR-0013).
