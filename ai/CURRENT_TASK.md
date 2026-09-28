# CURRENT TASK

Status: **IN_PROGRESS**

## Tarea activa

**WEB-05-VERIFY — runbook de activación y verificación real de Google/Gemini.**

WEB-05 quedó fusionada en `main` mediante el PR #13 (squash `7c16024`). La implementación está completa con servicios simulados; faltan únicamente comprobaciones con la cuenta y el dispositivo de Manu.

## Objetivo

Preparar una guía reproducible, segura y reversible para que Manu pueda:

- crear y pegar fuera de Git el ID público de cliente OAuth;
- activar Calendar, Tasks, People y Drive por separado y verificar el scope exacto;
- probar Gemini opcional sin persistir la clave por defecto;
- comprobar la copia cifrada y restaurarla en un perfil limpio;
- revocar accesos y volver al modo local sin pérdida de datos;
- registrar qué quedó `VERIFICADO` y qué continúa `NO_VERIFICADO`.

## Alcance autorizado

- documentación operativa y de QA;
- datos y capturas completamente sintéticos;
- comprobaciones estáticas contra ADR-0013 y el código ya fusionado;
- actualización de `ai/PROJECT_STATE.md`, `ai/HANDOFF.md` y `ai/QA_LESSONS.md` si aparece una lección confirmada.

## Criterios de aceptación

- runbook lineal con precondiciones, pasos, resultado esperado, rollback y evidencia;
- una prueba independiente por scope: Calendar, Tasks, Contacts y Drive;
- Drive verifica que el archivo remoto no contiene marcadores sintéticos en claro y que la restauración funciona en un perfil limpio;
- Gemini verifica payload visible, confirmación por petición, sesión por defecto y degradación sin IA;
- nunca pide copiar secretos, tokens ni datos personales a GitHub, logs o capturas;
- distingue claramente `VERIFICADO`, `TEÓRICAMENTE_POSIBLE` y `NO_VERIFICADO`;
- checks documentales verdes.

## Trabajo prohibido

- crear credenciales, conectar servicios o usar la cuenta real de Manu durante esta tarea;
- guardar IDs, claves, tokens, datos personales o capturas reales en el repositorio;
- cambiar código de producto, scopes, gates, costes o despliegue;
- reanudar los PR nativos #7, #8 o #9.

---

## Historial cerrado

- **WEB-05**: fusionada mediante PR #13 (`7c16024`), 45/45 pruebas y workflows `MANU OS web` y `Foundation check` verdes.
- **BRAIN-02-PREP**: fusionada mediante PR #5; la línea nativa permanece pausada.
