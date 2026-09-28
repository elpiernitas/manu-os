# CURRENT TASK

Status: **REVIEW_PENDING**

## Tarea activa

BRAIN-01 — contratos de conocimiento con fuentes, afirmaciones, evidencia y temporalidad.

## Autorización

Manu autorizó continuar BRAIN-01 el 2026-09-28 tras revisar y fusionar el PR #1. La implementación se realiza en `brain/01-knowledge-contracts`, no en `main`.

La implementación y sus 13 tests han pasado en GitHub Actions con Swift 6.3.3. El PR #2 está pendiente de revisión externa y no está autorizado a fusionarse.

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
