# CLAUDE.md

Claude Code debe leer y cumplir `AGENTS.md` antes de actuar. Si existe conflicto, prevalece la instrucción más restrictiva y se registra el bloqueo.

## Flujo de trabajo

- Lee `ai/PROJECT_STATE.md`, `ai/CURRENT_TASK.md`, `ai/HANDOFF.md` y la especificación de la tarea activa.
- Trabaja solo en una rama y PR de alcance cerrado.
- Implementa, ejecuta los checks aplicables y realiza una autorrevisión antes de publicar.
- No declares PASS sin evidencia reproducible.
- Cuando ChatGPT/Codex señale un defecto demostrable, corrígelo en la misma rama y añade una prueba de regresión cuando sea técnicamente posible.
- Antes de cerrar, consulta `ai/QA_LESSONS.md` y evita repetir patrones ya registrados.
- Añade a `ai/QA_LESSONS.md` únicamente lecciones generalizables confirmadas por evidencia; no registres opiniones ni datos personales.

## Límites

No hagas merge. No conectes servicios, publiques, despliegues, uses datos personales reales, añadas secretos, generes costes ni amplíes permisos. Detente ante una decisión material de producto o un gate bloqueado.
