# MANU OS — Project State

Última actualización: 2026-09-28

## Estado actual

- BRAIN-00: **COMPLETED Y FUSIONADO** en `main` mediante el PR #1.
- BRAIN-01: **IN PROGRESS**, autorizado por Manu el 2026-09-28 en la rama `brain/01-knowledge-contracts`, revalidado para Swift y ADR-0008.
- BRAIN-02 y siguientes: no autorizados.
- Implementación de producto: iniciado solo el núcleo Swift de BRAIN-01. No existe UI, proyecto Xcode, base de datos, red ni infraestructura.
- Claude Code: con acceso al repositorio desde el 2026-09-28, solo para tareas documentales autorizadas por Manu.
- Servicios externos: ninguno conectado.
- Datos personales reales: ninguno incorporado.
- Deploy: ninguno.

## Fuente de verdad

Los documentos canónicos están en `docs/`. Las tareas activas se controlan mediante `ai/CURRENT_TASK.md`.

## Siguiente gate

1. Implementar y verificar BRAIN-01 con los tests obligatorios.
2. Revisión externa del PR de BRAIN-01; no fusionarlo automáticamente.
3. D-03 y D-04B siguen aplazadas hasta BRAIN-02.

## Restricciones vigentes

- BRAIN-01 está autorizado; BRAIN-02 y siguientes no.
- No configurar OAuth, APIs, hosting o facturación.
- No crear interfaz, proyecto Xcode ni código fuera del núcleo BRAIN-01.
- No instalar plugins ni activar revisiones automáticas que consuman créditos.
- No usar exports personales como fixtures.
