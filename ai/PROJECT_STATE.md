# MANU OS — Project State

Última actualización: 2026-09-28

## Estado actual

- BRAIN-00: **COMPLETED Y FUSIONADO** en `main` mediante el PR #1.
- BRAIN-01: **COMPLETED Y FUSIONADO** en `main` mediante el PR #2. La revisión externa y la revisión del orquestador cerraron 11 defectos; el resultado final supera 31/31 tests en 3 suites con Swift 6.3.3.
- BRAIN-02-PREP: **COMPLETED Y FUSIONADO** en `main` mediante el PR #5, squash commit `ff2f86a`. D-02 queda **DECIDIDA** por [ADR-0011](../docs/adr/0011-native-local-storage-and-keys.md); BRAIN-02 está dividida en 02a–02d y su verificación de CI/simulador no requiere firma ni dispositivo.
- BRAIN-02a: **IN_PROGRESS** en la rama `brain/02a-persistence-and-keys`. Está autorizado únicamente el núcleo Swift Package de persistencia y claves descrito en `ai/CURRENT_TASK.md`.
- BRAIN-02b–02d: documentadas y aún no iniciadas.
- Implementación de producto: núcleo de dominio BRAIN-01 fusionado; BRAIN-02a es la única tarea de implementación activa. No existe todavía UI, proyecto Xcode, red ni infraestructura.
- Claude Code: implementa o revisa tareas cerradas que el orquestador le asigne. Sus resultados no se aceptan automáticamente.
- Servicios externos: ninguno conectado.
- Datos personales reales: ninguno incorporado.
- Deploy: ninguno.

## Fuente de verdad

Los documentos canónicos están en `docs/`. La única tarea activa se controla mediante `ai/CURRENT_TASK.md`.

## Siguiente gate

1. Claude implementa BRAIN-02a en el PR activo con datos sintéticos y CI `macos-26`.
2. El orquestador verifica independientemente arquitectura, privacidad, migraciones, cifrado, borrado, regresiones y CI.
3. BRAIN-02b solo podrá comenzar después del merge de BRAIN-02a y mediante un nuevo PR de alcance cerrado. Su primer criterio será verificar Xcode/SDK reales y build+tests en iOS Simulator sin firma.
4. La fase de dispositivo físico continúa bloqueada por D-04B. D-03 solo se activa si falla App Groups con Personal Team o si se elige TestFlight.

## Restricciones vigentes

- Solo puede existir una tarea de implementación `IN_PROGRESS`.
- BRAIN-02a no autoriza proyecto Xcode, UI, Keychain real, App Groups, firma, dispositivo ni servicios.
- No configurar OAuth, APIs, hosting, publicación o facturación.
- No usar datos personales reales ni exports como fixtures.
- No activar Apple Developer Program, TestFlight ni runners de pago.
- No iniciar BRAIN-02b, BRAIN-03 o fases posteriores desde la tarea actual.
