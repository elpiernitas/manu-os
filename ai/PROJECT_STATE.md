# MANU OS — Project State

Última actualización: 2026-09-28

## Estado actual

- **Línea web (ADR-0012)**: app web instalable publicada en GitHub Pages (`https://elpiernitas.github.io/manu-os/`) desde `main`. WEB-01 a WEB-04 están fusionadas (PR #10, #11 y #12, con fusión autorizada por Manu). Local-first, sin servidor. Incluye Open-Meteo para el tiempo y la conexión opcional con Google Calendar. WEB-05 (Gemini y más Google, ADR-0013) está fusionada (PR #13). WEB-06 (Excel de Sabadell) está fusionada (PR #15). WEB-07/08 están en curso. Gobernanza desde el 2026-09-29: Claude Code fusiona con CI en verde y la revisión del orquestador es bajo petición.
- Servicios externos que la **web** puede usar desde el dispositivo de Manu y con su consentimiento: Open-Meteo (sin clave), Google (OAuth del propio Manu, un scope por función) y Gemini (clave de Manu, envío solo confirmado). El repositorio no guarda credenciales.

- BRAIN-00: **COMPLETED Y FUSIONADO** en `main` mediante el PR #1.
- BRAIN-01: **COMPLETED Y FUSIONADO** en `main` mediante el PR #2. La revisión externa y la revisión del orquestador cerraron 11 defectos; el resultado final supera 31/31 tests en 3 suites con Swift 6.3.3.
- BRAIN-02-PREP: **COMPLETED Y FUSIONADO** en `main` mediante el PR #5 (`ff2f86a`). D-02 decidida ([ADR-0011](../docs/adr/0011-native-local-storage-and-keys.md)).
- BRAIN-02 (app nativa): **PAUSADO**. Los PR #7, #8 y #9 siguen en borrador. La vía de uso diario es la web (ADR-0012), porque Manu no puede instalar la app nativa sin coste. La fase de dispositivo real sigue dependiendo de D-04B.
- Implementación de producto (nativa): núcleo Swift de BRAIN-01 fusionado; la app SwiftUI (PR #9) está en pausa. *(Antes: «No existe UI…»; sustituido el 2026-09-28 por la línea web de ADR-0012.)*
- Claude Code: puede implementar o revisar tareas que el orquestador le asigne dentro del alcance autorizado. Sus resultados no se aceptan automáticamente.
- Servicios externos: ninguno conectado desde el repositorio ni desde CI. La web se conecta a Open-Meteo y, si Manu lo activa en su dispositivo, a Google y Gemini (ver arriba).
- Datos personales reales: ninguno incorporado.
- Deploy: GitHub Pages (solo contenido estático de `web/`), autorizado por Manu el 2026-09-28.

## Fuente de verdad

Los documentos canónicos están en `docs/`. Las tareas activas se controlan mediante `ai/CURRENT_TASK.md`.

## Siguiente gate

1. Claude Code fusiona WEB-07/08 con CI en verde. Después, Manu puede pedir a ChatGPT una revisión con el prompt que prepara Claude Code.
2. Manu, en su dispositivo y fuera del repositorio, crea el ID de cliente OAuth de Google y, si quiere, la clave gratuita de Gemini. Ningún secreto entra en Git.
3. Nativo: sin cambios hasta que exista una vía de instalación sin coste (D-04B) o Manu decida otra cosa.

## Restricciones vigentes

- BRAIN-01 está cerrado. D-02 está cerrada ([ADR-0011](../docs/adr/0011-native-local-storage-and-keys.md)). BRAIN-02 (nativo) está pausado; si se reanuda, 02a–02d pueden verificarse en CI/simulador sin D-03 ni D-04B, y solo la fase de dispositivo real (firma e instalación en el iPhone) sigue bloqueada por D-04B, con D-03 activada por dos disparadores independientes (fallo demostrado de App Groups con cuenta gratuita, o elección de TestFlight como ruta), ninguno activo ahora.
- Nativo: no configurar OAuth, APIs, hosting o facturación. Web: solo lo recogido en ADR-0012 y ADR-0013; sin facturación.
- Nativo: no avanzar la interfaz, el proyecto Xcode, el almacenamiento ni las integraciones de BRAIN-02 mientras esté pausado. La interfaz vigente es la web (`web/`).
- No activar servicios de pago ni revisiones sin límite de rondas.
- No usar exports personales como fixtures.
