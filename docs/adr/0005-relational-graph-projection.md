# ADR-0005 — Grafo como proyección relacional

Status: **ACCEPTED**  
Date: **2026-09-28**

## Contexto

MIND necesita navegar entidades y relaciones, pero el proyecto todavía no ha demostrado una escala o patrón de consultas que justifique una base de grafos especializada.

## Decisión

Las entidades, claims, evidencias y relaciones viven en un modelo relacional portable. La vista de grafo se deriva de esas tablas y cada arista debe señalar la Claim o actividad que la origina.

## Consecuencias

- No se introduce Neo4j en el MVP.
- La visualización puede filtrar conexiones sin cambiar el conocimiento canónico.
- `explain_path` debe devolver una cadena de evidencia, no solo IDs conectados.
- Una base de grafos solo se reconsidera con benchmarks y consultas reales que no se resuelvan bien.

## Alternativas rechazadas

- Grafo como fuente de verdad desde el inicio: añade operación y duplicación prematuras.
- Líneas visuales generadas por similitud sin procedencia: no son explicables.
