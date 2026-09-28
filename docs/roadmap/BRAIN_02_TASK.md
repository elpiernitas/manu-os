# BRAIN-02-PREP — contrato técnico y desbloqueo

## Objetivo

Preparar BRAIN-02 para que su implementación pueda comenzar en unidades pequeñas, verificables y de coste 0 €, sin fingir que la firma, la instalación en iOS 27 o las pruebas en dispositivo ya están resueltas.

## Encargo para Claude Code

1. Lee completos `AGENTS.md`, `CLAUDE.md`, `ai/PROJECT_STATE.md`, `ai/CURRENT_TASK.md`, `ai/HANDOFF.md`, `ai/QA_LESSONS.md`, los ADR, el modelo de datos, el threat model, el registro de riesgos, el roadmap y los contratos de aceptación.
2. Revisa fuentes oficiales actuales de Apple y Swift para almacenamiento local, protección de archivos, Keychain, App Groups, extensiones, compatibilidad y pruebas.
3. Evalúa D-02 y escribe un ADR con recomendación, alternativas, invariantes, migración, recuperación, borrado y pruebas.
4. Descompón BRAIN-02 en subfases. Identifica una primera subfase que pueda implementarse y probarse en CI sin cuenta de pago, dispositivo, firma, servicios ni datos reales.
5. Convierte D-03 y D-04B en decisiones claras: qué bloquean realmente ahora, qué puede aplazarse y qué evidencia necesitará Manu antes de pagar o usar su dispositivo.
6. Actualiza los documentos canónicos afectados sin borrar el historial.
7. Ejecuta el check documental, valida enlaces e IDs y busca contradicciones.
8. Haz commit y push en esta rama y publica en el PR un informe con archivos, decisiones, fuentes, checks, riesgos y cualquier elemento NO VERIFICADO.

## Condiciones

- No escribas código de producto.
- No crees un proyecto Xcode.
- No uses datos personales, credenciales ni servicios.
- No generes costes.
- No hagas merge.
- No hagas preguntas rutinarias: toma decisiones técnicas reversibles dentro del alcance.
- Si necesitas a Manu, formula una sola pregunta concreta y continúa antes con todo lo que no dependa de ella.
