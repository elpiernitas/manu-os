# ADR-0008 — Retención, extracción y borrado controlado de fuentes

Status: **ACCEPTED**  
Date: **2026-09-28**  
Complementa: **ADR-0002** (precisa qué significa «fuente inmutable»; no lo sustituye)

## Contexto

ADR-0002, `DATA_MODEL.md` y `ARCHITECTURE.md` establecen que las fuentes brutas son inmutables y que los importadores «preservan bytes originales». El Product Charter prometía «conservar el original».

El 2026-09-28 Manu definió la bandeja diaria de capturas (ver `docs/product/EXPERIENCE.md`) con requisitos que chocan con esa regla si se lee de forma literal:

- MANU OS procesa todas las capturas de pantalla nuevas, extrae su texto, las describe y pregunta por qué se hicieron.
- La respuesta de Manu puede ser un audio, que se transcribe y **se borra después de comprenderlo**.
- **La captura original no se conserva dentro de MANU OS.**
- MANU OS **solicita eliminar los originales de Fotos**, y iOS pide su propia confirmación.
- Si Manu no recuerda el motivo, se conserva el texto como contexto sin clasificar.

También hay fuentes que sí deben conservarse completas, como el texto de las exportaciones de WhatsApp (cifrado) o los enlaces compartidos.

## Decisión

1. **Inmutable significa «no se modifica», no «no se borra nunca».** Mientras se conserva, el contenido de una fuente no se edita. La eliminación es un evento explícito, auditable y confirmado por Manu, nunca una edición silenciosa.
2. Cada `Source` tiene una **política de retención** explícita:
   - `FULL`: se conservan los bytes originales (por ejemplo, el texto de un chat de WhatsApp o un documento importado).
   - `EXTRACTED_ONLY`: se conservan solo los derivados aprobados (texto extraído, descripción, respuesta transcrita, etiquetas, relaciones) y la procedencia. Los bytes originales no se guardan en MANU OS. Es el valor por defecto de las capturas de pantalla de la bandeja diaria.
   - `REFERENCE_ONLY`: se guarda una referencia (URL, identificador externo) y los derivados, no el contenido. Es el caso de un enlace cuyo contenido no se puede descargar.
   - `TRANSIENT`: el original solo existe mientras se procesa y se descarta automáticamente al terminar (por ejemplo, el audio con el que Manu explica una captura). Solo se permite para entradas que Manu produce para MANU OS, y siempre se conserva su transcripción.
3. Siempre se conserva un **registro de procedencia** aunque el original desaparezca:
   - tipo y origen de la fuente, fecha de captura y fecha de ingreso;
   - hash del contenido original **cuando sea técnicamente posible** calcularlo antes de descartarlo;
   - actividad de extracción (herramienta, versión y, si hubo modelo, cuál);
   - evento de eliminación: qué se eliminó, cuándo, por decisión de quién y dónde (dentro de MANU OS o en Fotos).
4. **Eliminar un original en otra app** (por ejemplo, Fotos) es una acción destructiva externa: MANU OS la propone, Manu la confirma en MANU OS y además iOS muestra su propia confirmación. MANU OS registra el resultado real (eliminado, cancelado o fallido), no el deseado.
5. MANU OS **nunca afirma que conserva un original** cuando la política es `EXTRACTED_ONLY`, `REFERENCE_ONLY` o `TRANSIENT`, o cuando se ha borrado. La UI, las respuestas de MANU y las exportaciones muestran «original no conservado» y la fecha de eliminación.
6. Las **Claims** apoyadas en una fuente sin original siguen siendo válidas si su evidencia es un derivado aprobado (texto extraído o transcripción). Su `EvidenceLink` indica que el fragmento procede de un derivado y no puede volver a verificarse contra el original.
7. Borrar **derivados** o la procedencia sigue las reglas de papelera y tombstone de `THREAT_MODEL.md`. El registro mínimo del evento de eliminación (sin contenido) se conserva para que el historial no mienta.

## Consecuencias

- `DATA_MODEL.md` añade `retention_policy`, `original_retained`, `original_hash` opcional y `source_deletion_events`.
- La regla de integridad «hash obligatorio para contenido bruto» pasa a «hash obligatorio para contenido bruto conservado; recomendado antes de descartar».
- Los importadores siguen el esquema «preservar → derivar» solo con política `FULL`. Con `EXTRACTED_ONLY`, «preservar» significa guardar la procedencia y el hash, no los bytes.
- Un derivado de una fuente sin original **no puede regenerarse** desde el original. Esto limita la promesa de ADR-0002 («los parsers y modelos pueden regenerarse sin destruir originales») a las fuentes `FULL`.
- La exportación completa incluye procedencia y eventos de eliminación, no los originales descartados.
- BRAIN-01, cuando se autorice, debe incluir estas invariantes en el contrato.

## Alternativas consideradas

- **Conservar siempre el original, cifrado**: rechazada para la bandeja de capturas porque contradice la decisión explícita de Manu de no guardar las capturas en MANU OS y de limpiarlas de Fotos.
- **Borrar sin dejar rastro**: rechazada; rompe la procedencia y permitiría afirmar cosas sin poder explicar de dónde salieron.
- **Mover la captura a una carpeta oculta en lugar de borrarla**: no cumple la intención de Manu y duplica almacenamiento; puede ofrecerse como opción futura si Manu la pide.

## Verificación

Nada de este ADR está implementado. La eliminación en Fotos depende de la API de la fototeca y de la confirmación del sistema; está documentada por Apple, pero no se ha probado en el iPhone de Manu (`NO_VERIFICADO`).
