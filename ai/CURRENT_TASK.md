# CURRENT TASK

Status: **IN_PROGRESS**

## Corrección activa — D-03 y TestFlight

La revisión del PR #5 detectó una tercera contradicción bloqueante sobre el head `2530652`.

D-03 debe tener dos disparadores independientes:

- la cuenta gratuita falla de forma demostrable y se quieren conservar las capacidades afectadas;
- se elige TestFlight como ruta de distribución o prueba física, lo que exige por sí mismo Apple Developer Program y después autorización específica para credenciales, perfiles y App Store Connect.

No es válido mantener simultáneamente “TestFlight vía D-03” y “D-03 solo si falla la cuenta gratuita”.

Claude Code debe alinear `docs/roadmap/BRAIN_02_TASK.md`, `ai/DECISIONS.md`, `ai/PROJECT_STATE.md`, `docs/architecture/DECISIONS_AND_OPEN_ITEMS.md`, `docs/roadmap/BACKLOG.md` y `ai/HANDOFF.md`; añadir una comprobación documental de regresión y una lección en `ai/QA_LESSONS.md`; repetir Foundation check, enlaces e IDs; y publicar evidencia con el nuevo SHA.

D-03 y D-04B siguen siendo gates futuros. No existe una decisión pendiente de Manu ahora y BRAIN-02a–02d siguen desbloqueadas para CI/simulador.

## Tarea activa

BRAIN-02-PREP — cerrar el contrato técnico y reducir los bloqueos de BRAIN-02 sin iniciar todavía la implementación de las apps.

## Autorización

Manu delegó en ChatGPT/Codex la orquestación técnica, las revisiones y los merges ordinarios. Esta corrección documental está autorizada y no genera costes, conecta servicios ni usa datos reales.

Claude Code implementa la corrección en `fix/brain-02-prep-d03-gates`. ChatGPT/Codex verificará el resultado, fusionará este PR de corrección en `brain/02-preparation` y después cerrará el PR #5 si todo queda demostrado.

## Criterios de aceptación

- D-03 queda descrita con los dos disparadores independientes en todos los documentos activos;
- no queda ninguna frase “solo si falla” que contradiga la alternativa TestFlight;
- D-03/D-04B se conservan como gates futuros sin pedir una decisión actual a Manu;
- BRAIN-02a–02d siguen desbloqueadas para CI/simulador;
- existe una regresión documental y una lección generalizable;
- Foundation check, enlaces e IDs pasan;
- el PR termina con evidencia reproducible y PASS.

## Trabajo prohibido

- crear código de producto o proyecto Xcode;
- activar Apple Developer Program, TestFlight, servicios, credenciales o facturación;
- usar dispositivos o datos personales;
- hacer merge;
- iniciar BRAIN-03 o fases posteriores.
