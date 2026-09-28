# MANU OS — Project State

Última actualización: 2026-09-28

## Estado actual

- **Línea web (ADR-0012)**: app web instalable publicada en GitHub Pages (`https://elpiernitas.github.io/manu-os/`) desde `main`. WEB-01 a WEB-04 están fusionadas (PR #10, #11 y #12, con fusión autorizada por Manu). Local-first, sin servidor. Incluye Open-Meteo para el tiempo y la conexión opcional con Google Calendar. WEB-05 (Gemini y más Google, ADR-0013) está en revisión en el PR #13.
- Servicios externos que la **web** puede usar desde el dispositivo de Manu y con su consentimiento: Open-Meteo (sin clave), Google (OAuth del propio Manu, un scope por función) y Gemini (clave de Manu, envío solo confirmado). El repositorio no guarda credenciales.

- BRAIN-00: **COMPLETED Y FUSIONADO** en `main` mediante el PR #1.
- BRAIN-01: **COMPLETED Y FUSIONADO** en `main` mediante el PR #2. La revisión externa y la revisión del orquestador cerraron 11 defectos; el resultado final supera 31/31 tests en 3 suites con Swift 6.3.3.
- BRAIN-02-PREP: preparación documental ejecutada en el PR #5 (rama `brain/02-preparation`), corregida el mismo día tras una revisión externa que demostró que la verificación en CI/simulador de BRAIN-02 no necesita D-04B. D-02 queda **DECIDIDA** ([ADR-0011](../docs/adr/0011-native-local-storage-and-keys.md)) y BRAIN-02 queda dividida en subfases 02a–02d, las cuatro verificables en el runner `macos-26` contra iOS Simulator sin firma ni dispositivo (`docs/roadmap/BRAIN_02_TASK.md`). Ninguna subfase de BRAIN-02 está autorizada para implementarse todavía; sigue pendiente de que Manu o el orquestador habiliten explícitamente el código de producto.
- BRAIN-02 y siguientes: la implementación en CI/simulador no tiene bloqueos técnicos pendientes, solo falta la autorización explícita de código de producto que esta tarea no concede. Únicamente la fase de dispositivo real (firmar e instalar en el iPhone físico) sigue bloqueada por D-04B, con D-03 activada por dos disparadores independientes (esa firma falla con cuenta gratuita, o se elige TestFlight como ruta), ninguno activo ahora.
- Implementación de producto (nativa): núcleo Swift de BRAIN-01 fusionado; la app SwiftUI (PR #9) está en pausa. *(Antes: «No existe UI…»; sustituido el 2026-09-28 por la línea web de ADR-0012.)*
- Claude Code: puede implementar o revisar tareas que el orquestador le asigne dentro del alcance autorizado. Sus resultados no se aceptan automáticamente.
- Servicios externos: ninguno conectado desde el repositorio ni desde CI. La web se conecta a Open-Meteo y, si Manu lo activa en su dispositivo, a Google y Gemini (ver arriba).
- Datos personales reales: ninguno incorporado.
- Deploy: GitHub Pages (solo contenido estático de `web/`), autorizado por Manu el 2026-09-28.

## Fuente de verdad

Los documentos canónicos están en `docs/`. Las tareas activas se controlan mediante `ai/CURRENT_TASK.md`.

## Siguiente gate

1. El orquestador revisa y decide el merge del PR #5 (BRAIN-02-PREP).
2. Cuando se autorice código de producto, BRAIN-02a–02d son implementables en CI/simulador sin coste ni dispositivo; el primer criterio de aceptación de BRAIN-02b es un job de CI que confirme `xcodebuild -version`/`-showsdks` y un build+test contra iOS Simulator sin firma (ver `docs/roadmap/BRAIN_02_TASK.md`).
3. D-04B es un **gate futuro**, no una decisión pendiente ahora: solo entra en juego cuando BRAIN-02b–02d estén verificadas en simulador y se intente de verdad firmar e instalar en el iPhone físico. Ningún runner de CI, gratuito o de pago, tiene acceso físico al dispositivo; las rutas reales son un Mac de Manu compatible conectado al iPhone, o TestFlight vía D-03 (con su propio gate de credenciales de firma), o reducir el alcance. D-03 se pedirá si se activa uno de dos disparadores independientes: intentar firmar con la cuenta gratuita demuestra que no permite registrar App Groups, o se elige TestFlight como ruta (la exige por sí sola). Ninguno activo ahora.

## Restricciones vigentes

- BRAIN-01 está cerrado. D-02 está cerrada ([ADR-0011](../docs/adr/0011-native-local-storage-and-keys.md)). BRAIN-02a–02d pueden implementarse y verificarse en CI/simulador sin D-03 ni D-04B; solo la fase de dispositivo real (firma e instalación en el iPhone) sigue bloqueada por D-04B, con D-03 activada por dos disparadores independientes (fallo demostrado de App Groups con cuenta gratuita, o elección de TestFlight como ruta), ninguno activo ahora.
- Nativo: no configurar OAuth, APIs, hosting o facturación. Web: solo lo recogido en ADR-0012 y ADR-0013; sin facturación.
- No crear todavía interfaz, proyecto Xcode, almacenamiento real ni integraciones de BRAIN-02.
- No activar servicios de pago ni revisiones sin límite de rondas.
- No usar exports personales como fixtures.
