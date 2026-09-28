# 06 — Roadmap, repositorio y protocolo

> Revisado el 2026-09-28 por [ADR-0007](../adr/0007-native-iphone-first.md): la app nativa de iPhone aparece desde BRAIN-02. El roadmap BRAIN-00 original se conserva al final, en «Roadmap BRAIN-00 (sustituido)».

## Roadmap técnico

Ninguna fase está autorizada salvo BRAIN-00, que está completada. Cada fase necesita autorización explícita de Manu.

### BRAIN-00 — definición

Charter, arquitectura, seguridad, datos, integraciones, MVP, repo y tarea inicial. Revisión posterior por ADR-0007 (visión nativa de iPhone).

### BRAIN-01 — contratos del conocimiento

Source, Fragment, Entity, Claim, Evidence, temporalidad, sustitución y tests. Sin UI, red, OAuth ni datos reales. **El lenguaje (TypeScript, Swift o contrato compartido) depende de D-01** y debe decidirse antes de autorizar la tarea.

### BRAIN-02 — app nativa mínima y vault local

App SwiftUI instalable en el iPhone de Manu. Persistencia local detrás de `LocalStore` (tecnología según D-02), migraciones, transacciones, hashes y fixtures sintéticos. Captura de texto offline e Inbox. Tests de cierre/reapertura y corrupción controlada. Requiere D-01, D-02, D-03 y D-04 resueltas.

### BRAIN-03 — superficies del sistema y modos

Motor de modos determinista con al menos dos modos. Widget de inicio y de pantalla bloqueada con snapshot mínimo. App Intent de captura usable desde Atajos y botón de acción. Control del Centro de Control si la versión de iOS lo permite. Sin datos reales en superficies bloqueadas hasta G-09.

### BRAIN-04 — búsqueda y evidencia

Índice textual local, filtros, detalle de fuente y «por qué está conectado». MIND como lista/grafo filtrado, sin visualización masiva.

### BRAIN-05 — export/restore

Portable ZIP, snapshot técnico, checksums y restauración en instalación limpia. Gate obligatorio antes de cloud sync y de datos personales reales.

### BRAIN-06 — cifrado y sync

Vault encryption, event log, adaptador de sync falso primero; después servicio mínimo y/o Drive appData. Conflictos y revocación de dispositivo.

### BRAIN-07 — captura universal

Share Extension, captura de audio en la app, fotos y archivos elegidos, y transcripción en el dispositivo de audios propios. (Sustituye a «Atajos iOS/Mac», que con app nativa pasan a ser App Intents en BRAIN-03.)

### BRAIN-08 — importadores históricos

ChatGPT y Claude con fixtures anonimizados, preservación de raw y reportes de compatibilidad.

### BRAIN-09 — calendario y modo Trabajo

Calendario read-only (EventKit y/o Google Calendar, según decisión). Modo Trabajo de 9:00 a 13:00 con calendario, captura rápida y tareas. Modo Fuera del trabajo apoyado en el Focus configurado por Manu. OAuth solo después de probar revocación y no filtrar tokens.

### BRAIN-10 — HOME contextual y modo Mañana

Modo activo, ahora, Inbox, próximos eventos y proyectos activos con ranking explicable. Modo Mañana: alarma o acceso a ella, previsión de Gijón u Oviedo y acceso para iniciar música. Live Activity para un bloque en curso si aporta valor.

### BRAIN-11 — MIRROR read-only

Recuperación con fuentes, clasificación y respuesta determinista. Resúmenes con modelo externo opcionales, solo tras aprobación del lote de evidencia.

### BRAIN-12 — hardening y decisión Mac/web

QA en iPhone (y Mac si aplica), threat model revisado, restore real, rendimiento, accesibilidad y decisión final sobre el componente web o la app para Mac (cierre de D-01 si sigue abierta en esa parte).

### BRAIN-13 — finanzas (tras G-07)

Importar capturas o extractos, extraer movimientos como `PROPOSED`, confirmarlos y generar insights con procedencia. Open Banking solo como estudio con ADR propio.

### BRAIN-14 — llamadas y transcripciones (tras G-08)

Estudio de rutas reales para grabar llamadas con consentimiento, requisitos legales, transcripción, resúmenes y tareas. Puede concluir que la ruta no es viable.

## Gates

- No sync antes de export/restore probado.
- No integración OAuth antes de token threat model y revocación probada.
- No MIRROR generativo antes de evidencia visible y logs de divulgación.
- ~~No app nativa antes de demostrar al menos dos capacidades valiosas imposibles por PWA/Atajos.~~ Retirado por ADR-0007: widgets, App Intents, Live Activities y controles ya son esas capacidades.
- No datos personales reales en desarrollo hasta cifrado, export y política de borrado.
- No datos financieros hasta G-07.
- No grabaciones ni transcripciones de llamadas hasta G-08.
- No contenido sensible en superficies visibles con el iPhone bloqueado hasta G-09.

## Estructura inicial del repositorio

> Estructura BRAIN-00 con las carpetas nativas añadidas por ADR-0007. Las partes web dependen de D-01.

```text
manu-os/
  AGENTS.md
  README.md
  package.json                 # solo si D-01 mantiene TypeScript
  pnpm-workspace.yaml          # solo si D-01 mantiene TypeScript
  .editorconfig
  .gitignore
  .env.example
  .github/
    workflows/foundation-check.yml
    pull_request_template.md
  apps/
    ios/                       # app SwiftUI y extensiones (BRAIN-02/03)
    web/                       # componente web, solo si D-01 lo mantiene
    api/                       # Worker de referencia (BRAIN-06)
  packages/
    brain-domain/              # entidades, claims, reglas temporales (lenguaje según D-01)
    brain-storage/             # puertos y adaptadores locales
    brain-sync/                # eventos y transporte
    brain-importers/           # ChatGPT/Claude/etc.
    brain-agent-protocol/      # comandos y MCP, más adelante
    shared/                    # utilidades estrictamente comunes
  docs/
    product/PRODUCT_CHARTER.md
    architecture/ARCHITECTURE.md
    architecture/DATA_MODEL.md
    security/THREAT_MODEL.md
    integrations/INTEGRATIONS.md
    roadmap/ROADMAP.md
    adr/
  ai/
    PROJECT_STATE.md
    CURRENT_TASK.md
    HANDOFF.md
    QA_REPORT.md
    DECISIONS.md
  fixtures/
    synthetic/                 # nunca datos personales reales
  tools/
    verify/
```

`apps/` puede estar vacío durante BRAIN-01. No se generarán scaffolds que todavía no se usan.

## Documentación canónica

- ADR: decisiones de arquitectura estables y sus consecuencias.
- `ai/PROJECT_STATE.md`: versión corta del estado real, actualizado después de merge.
- `ai/CURRENT_TASK.md`: un único encargo activo, con alcance y acceptance criteria.
- `ai/HANDOFF.md`: qué cambió, comandos ejecutados, resultados y NO VERIFICADO.
- `ai/QA_REPORT.md`: revisión independiente; no lo redacta como «aprobado» el mismo actor que implementa.
- Issues/PR: historial operativo; nunca reemplazan contratos canónicos.

## Protocolo ChatGPT ↔ Claude ↔ GitHub

1. ChatGPT define una tarea pequeña en `ai/CURRENT_TASK.md` y criterios verificables.
2. Manu autoriza login/acción externa solo si hace falta.
3. Claude crea rama `brain/NN-descripcion` para tareas de implementación; nunca trabaja en `main`. Las tareas documentales pueden usar `chore/` o `docs/`.
4. Claude lee `AGENTS.md`, documentos canónicos y tarea antes de editar.
5. Claude implementa solo el alcance, ejecuta checks y actualiza `HANDOFF.md`.
6. Claude abre PR con evidencia exacta; marca `NO VERIFICADO` lo que no ejecutó.
7. ChatGPT revisa diff, arquitectura, seguridad y evidencia de tests por GitHub.
8. Si hay defectos, se devuelve la misma tarea con observaciones concretas.
9. QA ejecuta el recorrido relevante sin confiar solo en el handoff.
10. Tras aprobación, merge a `main`, actualización de `PROJECT_STATE.md` y selección del siguiente incremento.

Con app nativa, la verificación en dispositivo (paso 9) la ejecuta Manu o un entorno macOS, porque el entorno de Claude Code en la nube no compila apps iOS (D-04).

## Política de esfuerzo de Claude

- Bajo/medio: formato, docs mecánicos y cambios triviales.
- Alto: implementación normal con varias capas o tests.
- Máximo: solo migraciones delicadas, criptografía, bugs no reproducibles o revisión de seguridad.

BRAIN-01 usa **alto**, no máximo: exige precisión de dominio pero tiene un alcance pequeño y sin infraestructura.

## Definition of Done general

- alcance y archivos cambiados coinciden con CURRENT_TASK;
- tests/lint/typecheck/build pasan;
- sin secretos ni datos reales;
- documentación y migraciones actualizadas;
- accesibilidad y seguridad revisadas cuando apliquen;
- handoff incluye comandos, salida resumida y limitaciones;
- QA reproduce los criterios desde un checkout limpio;
- no hay afirmaciones de funcionamiento sin evidencia.

## Roadmap BRAIN-00 (sustituido)

Conservado por trazabilidad. Sustituido por ADR-0007 el 2026-09-28.

| Fase | Contenido original | Qué ha cambiado |
| --- | --- | --- |
| BRAIN-01 | paquete TypeScript puro de contratos | lenguaje pendiente de D-01 |
| BRAIN-02 | persistencia IndexedDB detrás de `LocalStore` | ahora app nativa mínima + vault local (tecnología D-02) |
| BRAIN-03 | PWA instalable con captura e Inbox offline | ahora superficies del sistema y modos |
| BRAIN-04 | búsqueda y evidencia | sin cambios |
| BRAIN-05 | export/restore | sin cambios |
| BRAIN-06 | cifrado y sync | sin cambios de fondo |
| BRAIN-07 | Atajo iOS/Mac de captura | ahora captura universal nativa |
| BRAIN-08 | importadores ChatGPT/Claude | sin cambios |
| BRAIN-09 | Google Calendar read-only | ahora calendario y modo Trabajo |
| BRAIN-10 | HOME contextual | añade modo Mañana y Live Activities |
| BRAIN-11 | MIRROR read-only | sin cambios |
| BRAIN-12 | hardening y decisión sobre companion nativo | ahora decisión sobre Mac/web |
| — | — | nuevas BRAIN-13 (finanzas) y BRAIN-14 (llamadas) |
