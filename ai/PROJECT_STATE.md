# MANU OS — Project State

Última actualización: 2026-09-28

## Estado actual

- BRAIN-00: **COMPLETED**, revisado por ADR-0007 (experiencia nativa), ADR-0008 (retención de fuentes), ADR-0009 (asistente sin IA obligatoria) y las decisiones de producto de Manu (`docs/product/EXPERIENCE.md`). La revisión está en el PR #1, en borrador y sin fusionar.
- BRAIN-01: **NOT AUTHORIZED**. Debe revalidarse contra D-01 y ADR-0008 antes de autorizarse.
- BRAIN-02 y siguientes: no autorizados.
- Implementación de producto: no iniciada. No existe código Swift, TypeScript, proyecto Xcode ni infraestructura.
- Claude Code: con acceso al repositorio desde el 2026-09-28, solo para tareas documentales autorizadas por Manu.
- Servicios externos: ninguno conectado.
- Datos personales reales: ninguno incorporado.
- Deploy: ninguno.

## Fuente de verdad

Los documentos canónicos están en `docs/`. Las tareas activas se controlan mediante `ai/CURRENT_TASK.md`.

## Siguiente gate

1. Revisión y merge del PR #1 por Manu (o revisor externo).
2. Datos del Mac y del iPhone para D-04 (lista en `docs/architecture/DECISIONS_AND_OPEN_ITEMS.md`).
3. Decisiones D-01 (hay recomendación documentada), D-03 y D-04.
4. Manu debe autorizar explícitamente el inicio de BRAIN-01 cuando Claude termine el proyecto de la web de Luis. Hasta entonces solo se permite preparar y revisar documentación fundacional.

## Restricciones vigentes

- No usar Claude ni otro implementador para implementación sin autorización explícita de Manu.
- No configurar OAuth, APIs, hosting o facturación.
- No crear interfaz ni código de producto.
- No instalar plugins ni activar revisiones automáticas que consuman créditos.
- No usar exports personales como fixtures.
