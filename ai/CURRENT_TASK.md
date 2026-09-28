# CURRENT TASK

Status: **REVIEW_PENDING**

Correcciones de las rondas 1, 2 y 3 de revisión del PR #13 implementadas por Claude Code y pendientes de la revisión del orquestador.

## Tarea activa

WEB-05 — IA opcional con Gemini y servicios de Google en la app web ([ADR-0013](../docs/adr/0013-optional-gemini-and-google-services.md)), dentro de la línea web autorizada por Manu ([ADR-0012](../docs/adr/0012-installable-web-app-as-operational-path.md)).

## Autorización

- 2026-09-28: Manu decide que la vía operativa es una app web instalable en GitHub Pages (no puede instalar la app nativa sin Mac con Xcode ni pagar). Hace público el repositorio, activa Pages y autoriza a Claude Code a fusionar los PR web #10, #11 y #12.
- 2026-09-28: Manu autoriza Gemini y «todo» lo posible de Google, a coste 0 €.
- El orquestador (ChatGPT/Codex) revisa el PR #13. Claude Code **no fusiona** el #13 hasta que la revisión lo apruebe. Los PR #7, #8 y #9 quedan en borrador o pausa.

## Alcance autorizado

- código en `web/` (sin servidor), tests y workflow `web.yml`;
- integración opcional con Gemini y con Google (Calendar, Tasks, Contactos, Drive) con consentimiento de Manu en su dispositivo;
- documentación canónica, ADR, threat model, handoff y QA lessons.

## Criterios de aceptación (rondas 1 a 3 del PR #13)

- toda copia en Drive se cifra en el cliente (formato versionado, AEAD, KDF, recuperación documentada); sin subida automática; restauración probada en un perfil limpio;
- ningún envío automático a Gemini: payload exacto visible y confirmación por petición; sin historial, tareas ni agenda por defecto; no se afirma detección exhaustiva; riesgo de la clave documentado;
- scopes de Google incrementales por función, con interruptores y degradación si se deniegan;
- regresiones de los cuatro puntos y check de CI recuperable;
- ronda 2: el sobre cifrado se valida con esquema cerrado (sin campos extra, algoritmos exactos, base64 y longitudes válidas, versión soportada, iteraciones en rango) antes de subir o de derivar la clave; una sola tarea activa y una sola semántica vigente en `CURRENT_TASK`, `PROJECT_STATE` y `HANDOFF`;
- ronda 3: Google Tasks y People paginados hasta agotar `nextPageToken`, con protección ante bucles y límites; ningún cierre inferido desde un listado incompleto.

## Trabajo prohibido

- usar credenciales o datos reales en código, tests o CI; conectar servicios desde CI;
- activar facturación o servicios de pago;
- fusionar el PR #13 sin la aprobación del orquestador.

---

## Historial (cerrado)

- **BRAIN-02-PREP**: CERRADA. Fusionada en `main` mediante el PR #5 (commit `ff2f86a`). Su definición completa, con el alcance, los criterios y las prohibiciones de entonces, está en ese commit. Ya no rige: la línea de trabajo vigente es la web (ADR-0012 y ADR-0013).
