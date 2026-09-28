# CURRENT TASK

Status: **REVIEW_PENDING**

Correcciones de la ronda 1 de revisión del PR #13 implementadas por Claude Code y pendientes de la revisión del orquestador.

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

## Criterios de aceptación (ronda 1 del PR #13)

- toda copia en Drive se cifra en el cliente (formato versionado, AEAD, KDF, recuperación documentada); sin subida automática; restauración probada en un perfil limpio;
- ningún envío automático a Gemini: payload exacto visible y confirmación por petición; sin historial, tareas ni agenda por defecto; no se afirma detección exhaustiva; riesgo de la clave documentado;
- scopes de Google incrementales por función, con interruptores y degradación si se deniegan;
- regresiones de los cuatro puntos y check de CI recuperable.

## Trabajo prohibido

- usar credenciales o datos reales en código, tests o CI; conectar servicios desde CI;
- activar facturación o servicios de pago;
- fusionar el PR #13 sin la aprobación del orquestador.

---

## Historial: tarea anterior (BRAIN-02-PREP)

Estado al cerrarse: REVIEW_PENDING (BRAIN-02-PREP, PR #5).

Implementación de esta tarea de preparación completada por Claude Code, con tres rondas de corrección tras revisión externa. Ver `ai/HANDOFF.md` para el resultado completo (D-02 decidida por ADR-0011, BRAIN-02 dividida en subfases 02a–02d verificables en CI/simulador, D-03/D-04B precisadas) y el PR #5 para la evidencia. No hay ninguna decisión pendiente de Manu ahora: D-04B queda modelado como un gate futuro (fase de dispositivo real), no como un bloqueo humano actual. Pendiente de revisión del orquestador.

## Tarea activa

BRAIN-02-PREP — cerrar el contrato técnico y reducir los bloqueos de BRAIN-02 sin iniciar todavía la implementación de las apps.

## Autorización

Manu delegó en ChatGPT/Codex la orquestación técnica, las revisiones y los merges ordinarios. Esta tarea documental está autorizada porque prepara decisiones y criterios verificables sin generar costes, conectar servicios ni usar datos reales.

Claude Code actúa como implementador y revisor externo en la rama `brain/02-preparation`. ChatGPT/Codex verificará el resultado y decidirá el merge.

## Alcance autorizado

- investigar con fuentes oficiales actuales las opciones de almacenamiento local nativo, claves y contenedor compartido;
- proponer y documentar D-02 mediante un ADR con una recomendación técnica;
- separar claramente qué parte de BRAIN-02 puede construirse y probarse con coste 0 € sin firma ni dispositivo;
- convertir D-03 y D-04B en decisiones pequeñas, fechadas y verificables, sin decidir por Manu ningún gasto;
- crear `docs/roadmap/BRAIN_02_TASK.md` con alcance, fases internas, criterios de aceptación, checks y gates;
- actualizar documentación canónica, riesgos, threat model, fuentes y handoff cuando sea necesario;
- detectar contradicciones y corregirlas dentro de este alcance.

## Criterios de aceptación

- D-02 queda decidida técnicamente o se documenta un bloqueo demostrable;
- D-03 y D-04B muestran opciones, consecuencias y el punto exacto en que necesitarán a Manu;
- BRAIN-02 queda dividida en unidades comprobables y existe una primera unidad implementable sin coste ni datos reales;
- todos los enlaces, IDs y checks documentales pasan;
- no se inicia código de producto;
- el PR termina con evidencia reproducible y PASS o con un único bloqueo humano concreto.

## Trabajo prohibido

- crear proyectos Xcode, UI, almacenamiento real o código de BRAIN-02;
- activar Apple Developer Program, runners de pago, TestFlight, WeatherKit, OAuth o facturación;
- conectar servicios, credenciales, dispositivos o datos personales;
- resolver por Manu una decisión material de producto o cualquier gasto;
- hacer merge;
- iniciar BRAIN-03 o fases posteriores.
