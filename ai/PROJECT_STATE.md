# MANU OS — Project State

Última actualización: 2026-09-28

## Estado actual

- BRAIN-00: **COMPLETED**, revisado por ADR-0007 (experiencia nativa de iPhone como prioridad). La revisión está en el PR #1, en borrador y sin fusionar.
- BRAIN-01: **NOT AUTHORIZED**. Su especificación debe revalidarse contra D-01 antes de autorizarse.
- Implementación de producto: no iniciada
- Claude Code: con acceso al repositorio desde el 2026-09-28, solo para tareas documentales autorizadas por Manu. No autorizado a implementar.
- Servicios externos: ninguno conectado
- Datos personales reales: ninguno incorporado
- Deploy: ninguno

## Fuente de verdad

Los documentos canónicos están en `docs/`. Las tareas activas se controlan mediante `ai/CURRENT_TASK.md`.

## Siguiente gate

1. Revisión y merge del PR #1 por Manu (o revisor externo).
2. Decisiones D-01, D-03 y D-04 (ver `docs/architecture/DECISIONS_AND_OPEN_ITEMS.md`).
3. Manu debe autorizar explícitamente el inicio de BRAIN-01 cuando Claude termine el proyecto de la web de Luis. Hasta entonces solo se permite preparar y revisar documentación fundacional.

## Restricciones vigentes

- No usar Claude ni otro implementador para implementación sin autorización explícita de Manu.
- No configurar OAuth, APIs, hosting o facturación.
- No crear interfaz ni código de producto.
- No usar exports personales como fixtures.
