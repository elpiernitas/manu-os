# MANU OS — Project State

Última actualización: 2026-09-28

## Estado actual

- BRAIN-00: **COMPLETED Y FUSIONADO** en `main` mediante el PR #1.
- BRAIN-01: **COMPLETED Y FUSIONADO** en `main` mediante el PR #2. La revisión externa y la revisión del orquestador cerraron 11 defectos; el resultado final supera 31/31 tests en 3 suites con Swift 6.3.3.
- BRAIN-02 y siguientes: implementación todavía bloqueada por sus decisiones y gates; se autoriza únicamente su preparación documental.
- Implementación de producto: iniciado solo el núcleo Swift de BRAIN-01. No existe UI, proyecto Xcode, base de datos, red ni infraestructura.
- Claude Code: puede implementar o revisar tareas que el orquestador le asigne dentro del alcance autorizado. Sus resultados no se aceptan automáticamente.
- Servicios externos: ninguno conectado.
- Datos personales reales: ninguno incorporado.
- Deploy: ninguno.

## Fuente de verdad

Los documentos canónicos están en `docs/`. Las tareas activas se controlan mediante `ai/CURRENT_TASK.md`.

## Siguiente gate

1. Preparar BRAIN-02 y cerrar sus decisiones bloqueantes sin iniciar código de producto.
2. Convertir cada decisión cerrada en criterios verificables y gates.
3. D-03 y D-04B siguen requiriendo datos o autorización específica de Manu si implican coste o acceso a sus dispositivos.

## Restricciones vigentes

- BRAIN-01 está cerrado. BRAIN-02 no puede implementarse hasta cerrar D-02, D-03 y D-04B y cumplir sus gates.
- No configurar OAuth, APIs, hosting o facturación.
- No crear todavía interfaz, proyecto Xcode, almacenamiento real ni integraciones de BRAIN-02.
- No activar servicios de pago ni revisiones sin límite de rondas.
- No usar exports personales como fixtures.
