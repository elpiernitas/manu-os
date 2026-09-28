# MANU OS — Project State

Última actualización: 2026-09-28

## Estado actual

- BRAIN-00: **COMPLETED Y FUSIONADO** en `main` mediante el PR #1.
- BRAIN-01: **REVIEW PENDING** en el PR #2. Compila y supera 13/13 tests en GitHub Actions con Swift 6.3.3; no está fusionado.
- BRAIN-02 y siguientes: no autorizados.
- Implementación de producto: iniciado solo el núcleo Swift de BRAIN-01. No existe UI, proyecto Xcode, base de datos, red ni infraestructura.
- Claude Code: con acceso al repositorio desde el 2026-09-28, solo para tareas documentales autorizadas por Manu.
- Servicios externos: ninguno conectado.
- Datos personales reales: ninguno incorporado.
- Deploy: ninguno.

## Fuente de verdad

Los documentos canónicos están en `docs/`. Las tareas activas se controlan mediante `ai/CURRENT_TASK.md`.

## Siguiente gate

1. Revisión externa del PR #2; no fusionarlo automáticamente.
2. Tras aprobación, merge y cierre de BRAIN-01.
3. D-03 y D-04B siguen aplazadas hasta BRAIN-02.

## Restricciones vigentes

- BRAIN-01 está autorizado; BRAIN-02 y siguientes no.
- No configurar OAuth, APIs, hosting o facturación.
- No crear interfaz, proyecto Xcode ni código fuera del núcleo BRAIN-01.
- No instalar plugins ni activar revisiones automáticas que consuman créditos.
- No usar exports personales como fixtures.
