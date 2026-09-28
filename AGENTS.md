# AGENTS.md — MANU OS

Estas instrucciones se aplican a todo el repositorio.

## Autoridad y orden de lectura

Antes de editar, lee en este orden:

1. `docs/product/PRODUCT_CHARTER.md`
2. `docs/architecture/ARCHITECTURE.md`
3. `docs/architecture/DATA_MODEL.md`
4. `docs/security/THREAT_MODEL.md`
5. `ai/PROJECT_STATE.md`
6. `ai/CURRENT_TASK.md`

Si `ai/CURRENT_TASK.md` está marcado como `PAUSED`, `BLOCKED` o `NOT_AUTHORIZED`, no implementes la tarea.

## Flujo obligatorio

- Nunca hagas cambios sustanciales directamente sobre la rama por defecto.
- Crea una rama por tarea y mantén el alcance pequeño.
- No hagas merge sin revisión externa.
- No despliegues, conectes servicios ni actives facturación sin autorización explícita de Manu.
- No añadas datos personales reales a código, fixtures, logs, issues o PRs.
- No guardes secretos, API keys, tokens OAuth ni credenciales en Git.
- No declares una capacidad como funcional si no la has comprobado.

Usa estas etiquetas con precisión:

- `VERIFICADO`: probado con evidencia reproducible.
- `DECIDIDO`: decisión aceptada, aún no necesariamente implementada.
- `TEÓRICAMENTE_POSIBLE`: permitido por la plataforma, no probado en MANU OS.
- `NO_VERIFICADO`: no se pudo comprobar.

## Arquitectura

- MANU BRAIN es independiente de React, Cloudflare, Google y proveedores de IA.
- Local-first y offline útil son requisitos, no mejoras opcionales.
- Las fuentes brutas son inmutables; los derivados deben poder regenerarse.
- Ninguna inferencia se convierte automáticamente en hecho.
- Todo conocimiento derivado debe conservar procedencia y evidencia.
- No introduzcas microservicios, bases de grafos, embeddings o IA obligatoria sin un ADR aprobado.
- Mantén interfaces de adaptador para almacenamiento, sync, integraciones y agentes.

## Calidad y handoff

Cada tarea debe terminar con:

- tests, lint, typecheck y build aplicables;
- actualización de `ai/HANDOFF.md`;
- lista de archivos cambiados;
- comandos ejecutados y resultados reales;
- riesgos y regresiones posibles;
- sección explícita `NO_VERIFICADO`;
- ninguna modificación fuera del alcance.

El implementador no puede autodeclarar la QA final como aprobada.
