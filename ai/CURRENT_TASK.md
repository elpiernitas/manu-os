# CURRENT TASK

Status: **REVIEW_PENDING**

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
