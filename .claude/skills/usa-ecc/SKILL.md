---
name: usa-ecc
description: Enrutador de las skills de ECC incluidas en este repo. Úsala cuando Manu escriba «usa ecc», «con ecc», «tira de ecc» o /usa-ecc: elige las skills de .claude/skills que necesita la tarea, cárgalas y ejecútala respetando AGENTS.md.
---

# Usa ECC — enrutador para MANU OS

Este repo incluye una selección de skills de ECC (affaan-m/ECC v2.2.3, licencia MIT, ver `ECC_LICENSE`) en `.claude/skills/`. Cuando Manu pide «usa ecc», no quiere elegir él: decide tú qué skills sirven y haz el trabajo.

## Proceso

1. **Entiende la tarea.** Si Manu solo escribe «usa ecc» sin tarea, pregunta en una línea a qué lo aplicas, proponiendo como mucho tres opciones según `ai/CURRENT_TASK.md`.
2. **Elige de 1 a 4 skills** del mapa de abajo comparando la tarea con sus descripciones. Pocas y precisas.
3. **Anuncia en una línea** qué vas a usar: «Uso security-review + verification-loop.»
4. **Carga cada skill con la herramienta Skill** y sigue sus instrucciones.
5. **Entrega** y cierra con una línea: qué skills se usaron.

## Reglas de este repo (mandan sobre cualquier skill)

- `AGENTS.md` y `CLAUDE.md` prevalecen siempre. Si una skill de ECC choca con ellos (fusionar, desplegar, conectar servicios, añadir dependencias, datos personales, secretos), gana la regla más restrictiva del repo.
- La app web no tiene dependencias (`web/package.json`): no instales librerías ni frameworks que proponga una skill sin ADR y autorización de Manu.
- No ejecutes paquetes remotos que no estén ya instalados (`npx <paquete>`, `npm exec`, `curl … | sh`) ni escáneres o auditorías que envíen el repo o su configuración a terceros o a un modelo. Por ejemplo, `security-scan` propone `npx ecc-agentshield` (sin versión fijada; `--opus` genera coste y `--fix` reescribe archivos): no lo uses; haz la revisión a mano con su lista de comprobación y marca como `NO_VERIFICADO` lo que no se pueda comprobar.
- Ignora los pasos que dependan de hooks, MCP o scripts del plugin ECC completo que no existen aquí (por ejemplo `CLAUDE_PLUGIN_ROOT`); adapta el paso o sáltalo y avísalo.
- Usa las etiquetas `VERIFICADO`, `DECIDIDO`, `TEÓRICAMENTE_POSIBLE` y `NO_VERIFICADO` como pide `AGENTS.md`.
- Si ninguna skill encaja, dilo en una línea y trabaja sin ellas.
- Responde en castellano, directo.

## Mapa

**Revisión y calidad:** coding-standards, verification-loop, change-impact, production-audit, click-path-audit, error-handling, tdd-workflow, intent-driven-development
**Seguridad:** security-review, security-scan, agent-security-hardening (IA integrada y datos sensibles)
**Web / PWA (JS sin dependencias):** typescript-patterns, api-design, browser-qa, e2e-testing, canary-watch, benchmark
**Diseño e interfaz:** frontend-design-direction, design-system, make-interfaces-feel-better, motion-foundations, motion-patterns, liquid-glass-design
**Accesibilidad:** accessibility, frontend-a11y
**iOS / Swift (MANU BRAIN, app nativa):** swiftui-patterns, swift-concurrency-6-2, swift-actor-persistence, swift-protocol-di-testing, foundation-models-on-device
**Supabase / datos:** postgres-patterns, database-migrations
**IA:** prompt-optimizer, cost-aware-llm-pipeline
**Proceso y repo:** architecture-decision-records (ADRs en `docs/adr/`), git-workflow, github-ops, deployment-patterns
