# CURRENT TASK

Status: **REVIEW_PENDING**

WEB-21 implementado por Claude Code. Se fusiona según la regla de fusión de `AGENTS.md`.

## Tarea activa

WEB-21 — estadísticas de dinero: ingresos, nómina y ahorro (`ai/HANDOFF.md`, «WEB-21»).

## Autorización

- 2026-09-28: Manu decide que la vía operativa es una app web instalable en GitHub Pages (no puede instalar la app nativa sin Mac con Xcode ni pagar). Hace público el repositorio, activa Pages y autoriza a Claude Code a fusionar los PR web #10, #11 y #12.
- 2026-09-28: Manu autoriza Gemini y «todo» lo posible de Google, a coste 0 €.
- 2026-09-28: Manu sube su extracto de Sabadell (.xls) para que la app lo lea. El archivo real no entra en el repositorio; solo se usan recuentos en local y un fixture inventado.
- 2026-09-29: Manu pide una IA integrada a la que decirle cosas de la app y con la que subir sus gastos. El envío sin preguntar queda como ajuste que decide Manu, desactivado por defecto.
- 2026-09-29: Manu ordena «cambia agents.md para que tú puedas decidir cuándo fusionar y cuándo no». `AGENTS.md` y `CLAUDE.md` recogen la regla de fusión, lo que resuelve el hallazgo 6 de la revisión de ChatGPT.
- 2026-09-29: **cambio de gobernanza decidido por Manu.** El orquestador (ChatGPT/Codex) ya no revisa automáticamente, porque frenaba el avance. Claude Code fusiona los PR web cuando `npm test` y los dos workflows remotos están en verde y no hay conflictos. Cuando haga falta una revisión, Claude Code prepara un prompt, Manu se lo pasa a ChatGPT y le devuelve la respuesta; los defectos se corrigen en un PR nuevo con su regresión. Los PR #7, #8 y #9 siguen en borrador o pausa.

## Alcance autorizado

- código en `web/` (sin servidor), tests y workflow `web.yml`;
- integración opcional con Gemini y con Google (Calendar, Tasks, Contactos, Drive) con consentimiento de Manu en su dispositivo;
- documentación canónica, ADR, threat model, handoff y QA lessons.

## Criterios de aceptación (WEB-07/08)

- accesos según el modo, sin redes sociales; Spotify con PKCE y sin secreto, tokens fuera del vault, transferencia sin reproducción automática;
- reglas importadas en el dispositivo, sin datos reales en el repositorio; las correcciones de Manu siempre ganan;
- una sola ventana de consentimiento por gesto, solo con los scopes de las funciones activadas, y degradación por función;
- `npm test` y los dos workflows remotos en verde; recorrido de navegador sin errores.

## Trabajo prohibido

- usar credenciales o datos reales en código, tests o CI; conectar servicios desde CI;
- activar facturación o servicios de pago;
- fusionar un PR con CI en rojo o con conflictos;
- subir datos reales de Manu (extractos, reglas con comercios, contactos) al repositorio.

---

## Historial (cerrado)

- **WEB-20** (fondos vivos): CERRADA. Fusionada mediante el PR #28 (`26ce9b1`).
- **WEB-19** (claves «AQ.» de Gemini): CERRADA. Fusionada mediante el PR #27 (`8e57b3c`).
- **WEB-18** (la bola con la M vuelve): CERRADA. Fusionada mediante el PR #26 (`5bad2b9`), hecha por ChatGPT/Codex.
- **WEB-17** (quitar la bola con la M por un malentendido): CERRADA. Fusionada mediante el PR #25 (`18a9c7d`); WEB-18 revierte ese cambio.
- **WEB-16** (escenas vivas): CERRADA. Fusionada mediante el PR #24 (`0caa79d`).
- **WEB-15** (Spotify con un toque): CERRADA. Fusionada mediante el PR #23 (`c657d99`).
- **WEB-14** (tutorial de Gemini): CERRADA. Fusionada mediante el PR #22 (`c8109ee`).
- **WEB-13** (revisión de ChatGPT, calendario automático, gastos del Excel, puesta a punto): CERRADA. Fusionada mediante el PR #21 (`750589e`), con el «sí» de Manu.
- **WEB-12** (IA que propone acciones): CERRADA. Fusionada mediante el PR #20 (`9a5bf6f`).
- **WEB-11** (todos los calendarios con color, WhatsApp): CERRADA. Fusionada mediante el PR #19 (`88b3df3`).
- **WEB-10** (calendario de mes, cobros fijos, cuándo gastas): CERRADA. Fusionada mediante el PR #18 (`505c6bf`).
- **WEB-09** (movimiento estilo iOS): CERRADA. Fusionada mediante el PR #17 (`8ca2bbb`).
- **WEB-07/08** (accesos, Spotify, WhatsApp, reglas, «Conectar Google», Atajos): CERRADAS. Fusionadas en `main` mediante el PR #16 (`dfb0c56`).
- **WEB-06** (Excel de Sabadell y aprendizaje por comercio): CERRADA. Fusionada en `main` mediante el PR #15 (`4b19d3e`).
- **WEB-05** (Gemini opcional y servicios de Google, ADR-0013): CERRADA. Fusionada en `main` mediante el PR #13 (`7c16024`) tras tres rondas de revisión.
- **BRAIN-02-PREP**: CERRADA. Fusionada en `main` mediante el PR #5 (commit `ff2f86a`). Su definición completa, con el alcance, los criterios y las prohibiciones de entonces, está en ese commit. Ya no rige: la línea de trabajo vigente es la web (ADR-0012 y ADR-0013).
