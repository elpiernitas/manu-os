# 03 — Modelo de datos, procedencia y tiempo

> Revisado el 2026-09-28 por [ADR-0008](../adr/0008-source-retention-and-controlled-deletion.md) (retención y borrado controlado de fuentes) y por las decisiones de producto de Manu del mismo día (`docs/product/EXPERIENCE.md`). Se añaden retención, sensibilidad y entidades de producto; el modelo de conocimiento no cambia.

## Regla central

Las fuentes son inmutables; las interpretaciones son revisables.

Precisión de ADR-0008: «inmutable» significa que el contenido de una fuente no se modifica mientras se conserva. Una fuente puede no conservar su original (según su política de retención) o eliminarse por decisión confirmada de Manu; en ambos casos se conservan la procedencia y el evento de eliminación, y nunca se afirma que el original existe.

MANU BRAIN no guarda «Miguel vive en Vigo» como un texto suelto. Guarda una afirmación tipada, quién o qué la originó, el fragmento exacto que la respalda, cuándo era válida, cuándo se registró, su confianza y si fue reemplazada.

## Vocabulario

| Concepto | Uso |
| --- | --- |
| Source | contenedor original: ZIP, chat, API, archivo, captura manual |
| SourceItem | elemento dentro de una fuente: conversación, mensaje, documento, evento |
| Fragment | rango direccionable y hasheado dentro de un SourceItem |
| Entity | persona, proyecto, lugar, documento, evento, idea, organización, etc. |
| Claim | afirmación sobre una entidad o entre entidades |
| EvidenceLink | vínculo entre Claim y Fragment, con rol de soporte o contradicción |
| Activity | proceso que generó o transformó datos: import, parser, modelo, humano |
| Agent | Manu, una integración, un modelo o un componente responsable |
| Decision | entidad de decisión con alternativas, resultado y vigencia |
| Conflict | dos cambios que no deben resolverse silenciosamente |
| SyncEvent | cambio inmutable para réplica entre dispositivos |
| SourceDeletionEvent | registro de que un original se eliminó o no se conservó: qué, cuándo, dónde, decidido por quién y resultado real |
| CaptureGroup | grupo de capturas consecutivas del mismo tema con su historia cronológica (bandeja diaria) |
| Mode / Routine | momento del día con horario o disparador, contenido, accesos, comportamiento y excepciones |
| Suggestion | propuesta proactiva de MANU con su resultado (aceptada, rechazada, ignorada), base del aprendizaje de momentos |
| AutomationRule | rutina o acción pequeña previamente autorizada por Manu; incluye la lista blanca de mensajes automáticos |
| Transaction | movimiento financiero con importe, fecha, comercio, categoría inferida y estado de confirmación |
| LabEntry | error, mejora o idea del Laboratorio con estado y contexto técnico |

El diseño se inspira en W3C PROV —entidades, actividades y agentes— sin convertir el producto en un sistema RDF.

## Clasificación obligatoria

`FACT | INFERENCE | PREFERENCE | DECISION | MEMORY | HYPOTHESIS`

`SOURCE` no es una clasificación de Claim; es evidencia. Así se evita mezclar «el usuario dijo X» con «X es objetivamente cierto».

Reglas:

- FACT necesita evidencia directa o confirmación explícita de Manu.
- INFERENCE incluye método/modelo y confianza; nunca se promociona sola a FACT.
- PREFERENCE tiene vigencia y fuerza opcional (`like`, `avoid`, `require`).
- DECISION registra alternativas y quién decidió.
- MEMORY expresa recuerdo atribuido, no prueba externa.
- HYPOTHESIS puede carecer de soporte, pero se muestra como no confirmada.

## Esquema lógico inicial

```text
vaults(id, schema_version, created_at)
devices(id, vault_id, public_key, first_seen_at, revoked_at)

sources(id, kind, provider, external_id, imported_at, content_hash,
        raw_blob_id, author_agent_id, metadata_json,
        retention_policy, original_retained, original_hash,
        sensitivity)                                   -- añadidos por ADR-0008
source_items(id, source_id, parent_item_id, external_id, occurred_at,
             author_agent_id, raw_text, content_hash, metadata_json,
             sensitivity)
fragments(id, source_item_id, selector_json, excerpt_hash,
          derived_from_original)                       -- false si procede de un derivado
source_deletion_events(id, source_id, scope, requested_at, confirmed_by_agent_id,
                       result, completed_at, note)     -- scope: MANU_OS | PHOTOS | ...

entities(id, entity_type, canonical_label, status, created_at, updated_at)
entity_aliases(id, entity_id, alias, valid_from, valid_until, source_fragment_id)

claims(id, subject_entity_id, predicate, object_kind, object_entity_id,
       object_value_json, classification, confidence, status,
       valid_from, valid_until, observed_at, recorded_at,
       supersedes_claim_id, created_by_agent_id, activity_id)
evidence_links(id, claim_id, fragment_id, role, weight, note)

activities(id, kind, tool_name, tool_version, model_id, prompt_hash,
           parameters_json, started_at, ended_at, status)
agents(id, kind, label, provider, external_id)

decisions(id, entity_id, decided_at, status, rationale_claim_id)
decision_options(id, decision_id, label, selected, metadata_json)

conflicts(id, aggregate_id, left_event_id, right_event_id, status, resolution_event_id)
sync_events(id, device_id, aggregate_type, aggregate_id, operation,
            encrypted_payload, payload_hash, hlc, created_at)
tombstones(id, aggregate_type, aggregate_id, deleted_at, purge_after)

-- Entidades de producto (2026-09-28). Esquema orientativo; se concreta en su fase.
capture_groups(id, first_captured_at, last_captured_at, story_text, status,
               reason_text, reason_source_item_id)     -- status: PENDING | CONFIRMED | UNCLASSIFIED
modes(id, label, schedule_json, trigger_json, content_json, exceptions_json, enabled)
suggestions(id, kind, created_at, shown_at, context_json, outcome, outcome_at)
                                                      -- outcome: ACCEPTED | REJECTED | IGNORED
automation_rules(id, kind, description, authorized_at, scope_json, enabled,
                 message_whitelist)                   -- solo aplica a mensajes permitidos
transactions(id, occurred_at, amount, currency, merchant, category,
             category_inferred, confirmed, source_item_id, sensitivity)
lab_entries(id, kind, status, text, app_version, screen, created_at, context_json)
```

Los proyectos, personas, ideas, eventos y tareas se modelan como `Entity` con tipo, más `Claim` para sus atributos y relaciones. Una idea no se convierte en proyecto activo sin confirmación.

Los blobs grandes están fuera de la base estructurada. Cada blob conservado tiene hash SHA-256, tamaño, MIME, algoritmo de cifrado y referencia de almacenamiento.

## Retención de fuentes (ADR-0008)

| Política | Qué se conserva | Uso típico |
| --- | --- | --- |
| `FULL` | bytes originales, procedencia y derivados | texto de exportaciones de WhatsApp, documentos importados, exportaciones de ChatGPT y Claude |
| `EXTRACTED_ONLY` | procedencia, hash del original si fue posible, derivados aprobados | capturas de pantalla de la bandeja diaria |
| `REFERENCE_ONLY` | URL o identificador externo, procedencia y derivados | enlaces compartidos cuyo contenido no se puede descargar |
| `TRANSIENT` | solo la transcripción y la procedencia; el original se descarta al terminar | audio con el que Manu explica una captura |

Reglas:

- El contenido de una fuente conservada no se edita nunca.
- La eliminación de un original, dentro de MANU OS o en otra app, genera un `SourceDeletionEvent` con el resultado real.
- Si `original_retained = false`, ninguna vista ni respuesta puede afirmar que el original existe.
- Las `Claim` apoyadas en derivados de una fuente sin original siguen siendo válidas; su evidencia indica `derived_from_original = false`.

## Sensibilidad

Etiqueta por dato: `NORMAL | PERSONAL | SENSITIVE`.

- `SENSITIVE` por defecto: salud, finanzas, estado emocional y Refugio, datos de terceros (chats importados, perfiles de personas), transcripciones y cualquier captura que Manu marque.
- Lo `SENSITIVE` se procesa en el dispositivo igual que lo demás, pero:
  - no entra en el snapshot de widgets, pantalla bloqueada, controles ni Live Activities;
  - no aparece en notificaciones con contenido;
  - no entra en exportaciones compartibles; en el backup completo cifrado sí se incluye;
  - no se envía a proveedores de modelo sin decisión específica (ADR-0009, G-13).
- La etiqueta la asigna una regla determinista y Manu puede corregirla. Ante la duda, se usa la más protectora.

## Objetos de Claim

`object_kind` admite:

- `entity_ref`
- `string`
- `number`
- `boolean`
- `date`
- `datetime`
- `duration`
- `money`
- `location`
- `json_typed`

El valor JSON siempre incluye una versión de schema. No se guardan campos críticos únicamente dentro de un JSON opaco.

## Tiempo bitemporal simplificado

MANU BRAIN distingue:

- **tiempo válido**: `valid_from` / `valid_until`, cuándo la afirmación describe el mundo;
- **tiempo de registro**: `recorded_at`, cuándo entró en el cerebro;
- **tiempo observado**: `observed_at`, cuándo ocurrió la captura o evidencia.

Una consulta «actual» selecciona claims activos cuya vigencia incluya el instante consultado y que no estén sustituidos. Una consulta histórica puede reconstruir lo que el sistema sabía en una fecha usando `recorded_at` y eventos.

## Sustitución

Ejemplo:

```text
Claim A: project.name = "X"
classification = DECISION
valid_from = 2026-06-01
valid_until = 2026-09-08

Claim B: project.name = "Everours"
classification = DECISION
valid_from = 2026-09-09
supersedes_claim_id = A
```

Al aceptar B:

- A no se borra;
- se cierra su `valid_until` si no existía;
- B apunta a A;
- la vista actual devuelve B;
- la vista de historia explica la transición y sus fuentes.

No todas las contradicciones son sustituciones. Si dos fuentes discrepan sobre un nacimiento, ambas claims pueden coexistir como `CONTESTED` hasta resolución.

## Estado de Claim

`PROPOSED | ACTIVE | SUPERSEDED | CONTESTED | REJECTED | RETRACTED`

- Un modelo solo crea `PROPOSED`.
- Manu o una regla determinista auditada activa/rechaza.
- `SUPERSEDED` requiere claim sucesora.
- `RETRACTED` mantiene el registro pero deja de presentarse como válido.

## Confianza

La confianza es una estimación explícita entre 0 y 1, no una probabilidad científica. Se acompaña de `confidence_reason`. No se usará como sustituto del estado ni de la clasificación.

## Grafo explicable

No hay tabla de «líneas visuales». Una arista visible procede de:

- claim cuyo objeto es otra entidad;
- EvidenceLink;
- derivación entre SourceItem/Claim;
- relación de temporalidad o sustitución;
- participación de agente/actividad.

La operación `explain_path(A, B)` devuelve una ruta corta con IDs de claims y evidencias. La UI puede ocultar aristas de baja relevancia, pero no inventarlas.

## Reglas de integridad BRAIN-01

- IDs en UUIDv7 y timestamps ISO-8601 UTC.
- Source/SourceItem inmutables salvo metadatos administrativos separados. Su eliminación es un evento, no una edición (ADR-0008).
- Hash obligatorio para contenido bruto conservado; recomendado antes de descartar un original. *(Antes: «hash obligatorio para contenido bruto».)*
- Toda Source declara `retention_policy`; si el original no se conserva, `original_retained = false` y existe un `SourceDeletionEvent` o la política lo explica.
- Claim derivada debe tener Activity.
- FACT, INFERENCE, PREFERENCE, DECISION y MEMORY requieren evidencia; HYPOTHESIS puede no tenerla.
- `confidence` obligatorio para INFERENCE/HYPOTHESIS.
- Una Claim no puede sustituirse a sí misma ni formar ciclos.
- `valid_until` no puede preceder a `valid_from`.
- El borrado no elimina inmediatamente fuentes citadas, salvo decisión confirmada de Manu; en ese caso quedan la procedencia, los derivados aprobados y el evento de eliminación.
- Toda clasificación de una captura nueva requiere confirmación de Manu; en finanzas, la categoría puede asignarse automáticamente marcada como inferida (`category_inferred = true`).
- Toda migración de schema es versionada y reversible mediante export previo.
