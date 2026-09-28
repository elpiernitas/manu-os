# CURRENT TASK

Status: **IN_PROGRESS**

## Tarea activa

BRAIN-01 — contratos de conocimiento con fuentes, afirmaciones, evidencia y temporalidad.

## Autorización

Manu autorizó continuar BRAIN-01 el 2026-09-28 tras revisar y fusionar el PR #1. La implementación se realiza en `brain/01-knowledge-contracts`, no en `main`.

La especificación revalidada está en `docs/roadmap/BRAIN_01_TASK.md`. D-01 está cerrada (Swift) y D-04 permite verificar el núcleo como Swift Package en GitHub Actions.

## Alcance autorizado

- Swift Package independiente de UI;
- contratos inmutables, validación y resolución temporal;
- fixtures sintéticos y tests;
- CI de coste controlado, sin deploy;
- ADR y handoff de BRAIN-01.

## Trabajo prohibido

- añadir UI, proyecto Xcode, base de datos, red, sync o infraestructura;
- conectar servicios, credenciales o datos reales;
- instalar plugins o activar revisiones automáticas;
- hacer merge o deploy.
