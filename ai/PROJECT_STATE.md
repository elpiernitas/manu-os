# MANU OS — Project State

Última actualización: 2026-09-28

## Estado actual

- BRAIN-00: **COMPLETED Y FUSIONADO** en `main` mediante el PR #1.
- BRAIN-01: **COMPLETED Y FUSIONADO** en `main` mediante el PR #2. La revisión externa y la revisión del orquestador cerraron 11 defectos; el resultado final supera 31/31 tests en 3 suites con Swift 6.3.3.
- BRAIN-02-PREP: preparación documental ejecutada en el PR #5 (rama `brain/02-preparation`), corregida el mismo día tras una revisión externa que demostró que la verificación en CI/simulador de BRAIN-02 no necesita D-04B. D-02 queda **DECIDIDA** ([ADR-0011](../docs/adr/0011-native-local-storage-and-keys.md)) y BRAIN-02 queda dividida en subfases 02a–02d, las cuatro verificables en el runner `macos-26` contra iOS Simulator sin firma ni dispositivo (`docs/roadmap/BRAIN_02_TASK.md`). Ninguna subfase de BRAIN-02 está autorizada para implementarse todavía; sigue pendiente de que Manu o el orquestador habiliten explícitamente el código de producto.
- BRAIN-02 y siguientes: la implementación en CI/simulador no tiene bloqueos técnicos pendientes, solo falta la autorización explícita de código de producto que esta tarea no concede. Únicamente la fase de dispositivo real (firmar e instalar en el iPhone físico) sigue bloqueada por D-04B, con D-03 como pregunta condicional si esa firma falla con cuenta gratuita.
- Implementación de producto: iniciado solo el núcleo Swift de BRAIN-01. No existe UI, proyecto Xcode, base de datos, red ni infraestructura.
- Claude Code: puede implementar o revisar tareas que el orquestador le asigne dentro del alcance autorizado. Sus resultados no se aceptan automáticamente.
- Servicios externos: ninguno conectado.
- Datos personales reales: ninguno incorporado.
- Deploy: ninguno.

## Fuente de verdad

Los documentos canónicos están en `docs/`. Las tareas activas se controlan mediante `ai/CURRENT_TASK.md`.

## Siguiente gate

1. El orquestador revisa y decide el merge del PR #5 (BRAIN-02-PREP).
2. Cuando se autorice código de producto, BRAIN-02a–02d son implementables en CI/simulador sin coste ni dispositivo; el primer criterio de aceptación de BRAIN-02b es un job de CI que confirme `xcodebuild -version`/`-showsdks` y un build+test contra iOS Simulator sin firma (ver `docs/roadmap/BRAIN_02_TASK.md`).
3. D-04B solo entra en juego cuando llegue el momento de firmar e instalar en el iPhone físico (runner de pago, Mac compatible o reducir alcance). D-03 solo se pedirá si esa firma demuestra que la cuenta gratuita no permite registrar App Groups.

## Restricciones vigentes

- BRAIN-01 está cerrado. D-02 está cerrada ([ADR-0011](../docs/adr/0011-native-local-storage-and-keys.md)). BRAIN-02a–02d pueden implementarse y verificarse en CI/simulador sin D-03 ni D-04B; solo la fase de dispositivo real (firma e instalación en el iPhone) sigue bloqueada por D-04B (y, si esa firma falla, D-03).
- No configurar OAuth, APIs, hosting o facturación.
- No crear todavía interfaz, proyecto Xcode, almacenamiento real ni integraciones de BRAIN-02.
- No activar servicios de pago ni revisiones sin límite de rondas.
- No usar exports personales como fixtures.
