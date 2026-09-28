# ADR-0002 — Conocimiento basado en afirmaciones y evidencia

Status: **ACCEPTED**  
Date: **2026-09-28**  
Complementado por: **[ADR-0008](0008-source-retention-and-controlled-deletion.md)** (2026-09-28)

> Nota posterior (ADR-0008): «fuentes inmutables» significa que su contenido no se modifica mientras se conserva. Una fuente puede tener retención `EXTRACTED_ONLY`, `REFERENCE_ONLY` o `TRANSIENT`, o eliminarse por decisión confirmada de Manu, dejando registro de procedencia y del evento de eliminación. La regeneración de derivados desde el original solo es posible para fuentes con retención `FULL`. El texto de este ADR se conserva sin cambios.

## Contexto

MANU BRAIN debe distinguir hechos, recuerdos, decisiones, preferencias, inferencias e hipótesis. La información cambia y una conclusión automática nunca puede presentarse como verdad sin explicar su procedencia.

## Decisión

El conocimiento se modela mediante `Claim` tipadas enlazadas a `Fragment` de fuentes inmutables. Cada Claim conserva clasificación, estado, vigencia, confianza, actividad que la generó y evidencia que la apoya o contradice.

Las salidas de un modelo entran como `PROPOSED`. Una decisión posterior puede activarlas, rechazarlas o sustituirlas sin borrar el historial.

## Consecuencias

- La UI debe mostrar «por qué» y fuentes.
- Los parsers y modelos pueden regenerarse sin destruir originales.
- BRAIN-01 se centra en invariantes del dominio antes de crear una interfaz.
- El historial requiere tiempo válido y tiempo de registro.

## Alternativas rechazadas

- Guardar resúmenes como texto plano: no permite comprobar ni corregir afirmaciones.
- Usar solo embeddings: recupera similitud, pero no verdad, vigencia ni procedencia.
