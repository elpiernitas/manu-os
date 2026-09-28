# HANDOFF

## Estado

BRAIN-00 está fusionado en `main` mediante el PR #1. BRAIN-01 fue autorizado por Manu el 2026-09-28 y está en curso en `brain/01-knowledge-contracts`.

## Tarea activa: BRAIN-01

Objetivo: contratos Swift independientes de UI para fuentes, afirmaciones, evidencia, retención y temporalidad.

### Decisiones aplicadas

- D-01: núcleo Swift y futuras apps SwiftUI.
- ADR-0008: retención por fuente, `originalRetained`, `originalHash` y `SourceDeletionEvent`.
- ADR-0010: Swift Package sin dependencias externas y funciones puras.
- D-04: verificación en GitHub Actions `macos-26`; sin Xcode local.

### Estado de verificación

Pendiente del primer run de CI. No hay PASS declarado todavía.

### Riesgos

- La API pública puede necesitar ajustes tras compilar con Swift 6.1/6.2.
- La CI valida el paquete, no una app instalada en el iPhone.
- `StrictJSON` debe usarse en límites externos porque `Codable` tolera campos desconocidos por defecto.

## NO VERIFICADO

- Compilación y tests hasta que finalice GitHub Actions.
- Integración con almacenamiento, UI, extensiones, sync o dispositivos.
- Rendimiento y compatibilidad con la futura app de Mac e iPhone.

## Próximo paso

Subir la implementación inicial, abrir PR, corregir cualquier fallo de CI y completar este handoff con resultados reales.
