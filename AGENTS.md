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
- **Fusión (decisión de Manu, 2026-09-29).** Claude Code decide cuándo fusionar y cuándo no. Solo puede fusionar si `npm test` y los workflows remotos están en verde en el último commit, no hay conflictos y ha hecho una autorrevisión con evidencia. No fusiona si hay un defecto conocido sin corregir, un gate bloqueado o una decisión material de producto pendiente de Manu. En esos casos se detiene y pregunta.
- La revisión externa (ChatGPT/Codex) es bajo petición: Claude Code prepara el prompt, Manu lo pasa y devuelve la respuesta, y los defectos demostrables se corrigen en un PR con su prueba de regresión. Esto sustituye a la delegación del 2026-09-28 en el orquestador.
- La autorización para fusionar no cubre costes, publicación de datos personales, servicios nuevos, ampliaciones sensibles de permisos ni decisiones materiales de producto: siguen requiriendo autorización específica de Manu. Publicar la app web en GitHub Pages al fusionar en `main` ya está autorizado (ADR-0012).
- Ningún agente puede rebajar los gates ni presentar como verificado algo que no lo esté.
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

- MANU BRAIN es independiente de React, SwiftUI, Cloudflare, Google y proveedores de IA.
- La app nativa de iPhone es la experiencia principal (ADR-0007). Un componente web solo existe si D-01 lo mantiene.
- Las extensiones del sistema (widgets, controles, Live Activities, App Intents) leen solo el snapshot mínimo del modo activo y no muestran contenido sensible con el iPhone bloqueado.
- No declares funcional una capacidad de iOS probada solo en el simulador o no probada: indica `TEÓRICAMENTE_POSIBLE` o `NO_VERIFICADO`.
- Local-first y offline útil son requisitos, no mejoras opcionales.
- Las fuentes brutas son inmutables mientras se conservan; su retención y su eliminación siguen ADR-0008, con procedencia y evento de eliminación. Nunca afirmes que se conserva un original descartado.
- Los derivados deben poder regenerarse cuando el original se conserva.
- Lo etiquetado como sensible (salud, finanzas, Refugio, datos de terceros) no aparece en superficies bloqueadas ni en exportaciones compartibles, y no se envía a proveedores de modelo sin decisión específica.
- El chat MANU y todo el núcleo deben funcionar sin IA (ADR-0009). No envíes mensajes automáticos fuera de la lista blanca.
- No escribas en el repositorio nombres ni datos reales de terceros (por ejemplo, las excepciones laborales de Manu).
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
