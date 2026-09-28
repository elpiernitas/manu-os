# 06 — Roadmap, repositorio y protocolo

> Revisado el 2026-09-28 por [ADR-0007](../adr/0007-native-iphone-first.md) y, el mismo día, por las decisiones de producto de Manu (`docs/product/EXPERIENCE.md`, [ADR-0008](../adr/0008-source-retention-and-controlled-deletion.md), [ADR-0009](../adr/0009-manu-assistant-without-mandatory-ai.md)). Las versiones anteriores del roadmap se conservan al final.

## Principio de entrega

Manu recibe **una primera beta integrada** (Beta 1), no prototipos parciales semanales. Internamente el trabajo sigue dividido en fases pequeñas con gates, QA independiente y un **MVP técnico interno** previo. Cada fase necesita autorización explícita de Manu. Ninguna fase está autorizada salvo BRAIN-00, que está completada.

```text
BRAIN-00 ─► [D-01, D-03, D-04 cerradas] ─► BRAIN-01 … BRAIN-06 ─► MVP técnico interno
        ─► BRAIN-07 … BRAIN-12, 15, 16, 19, 20 (+13, 17, 18 si pasan sus gates) ─► QA ─► Beta 1
        ─► betas posteriores: lo condicional no entregado, BRAIN-14, BRAIN-21
```

## Fases

### BRAIN-00 — definición

Charter, arquitectura, seguridad, datos, integraciones, experiencia, MVP/Beta, repo y tarea inicial. Revisada por ADR-0007, ADR-0008 y ADR-0009. **COMPLETED** (pendiente de revisión y merge del PR #1).

### BRAIN-01 — contratos del conocimiento

Source (con retención), Fragment, Entity, Claim, Evidence, temporalidad, sustitución, eventos de eliminación y tests. Sin UI, red, OAuth ni datos reales. **El lenguaje depende de D-01** (recomendación: Swift).

### BRAIN-02 — apps nativas mínimas y vault local

App SwiftUI de iPhone y, según D-01, app de Mac. Persistencia local detrás de `LocalStore` (D-02, decidida por [ADR-0011](../adr/0011-native-local-storage-and-keys.md)), migraciones, transacciones y hashes. Captura de texto offline e Inbox. Navegación de cinco pestañas vacía con la identidad visual. Tests de cierre/reapertura. Dividida en subfases 02a–02d en `BRAIN_02_TASK.md`; las cuatro se compilan y prueban en el runner `macos-26` contra iOS Simulator sin firma ni dispositivo (el simulador no aplica la autorización de entitlements por perfil de aprovisionamiento). Solo la fase de dispositivo real (firmar e instalar en el iPhone físico con iOS 27) depende de D-04B y, si esa firma falla con cuenta gratuita, de D-03.

### BRAIN-03 — superficies del sistema y modos

Motor de modos determinista. Widgets de inicio y de pantalla bloqueada con snapshot mínimo y sin contenido sensible. Controles del Centro de Control (hablar con MANU, guardar idea). App Intents para Atajos. Toque posterior como alternativa documentada. Nada de botón de acción en el iPhone 14.

### BRAIN-04 — búsqueda y evidencia

Índice textual local, filtros, detalle de fuente o procedencia y «por qué está conectado».

### BRAIN-05 — export, restore y copia semanal

Portable ZIP, snapshot técnico, checksums, exportación compartible sin datos sensibles, copia completa semanal en el Mac y restauración en instalación limpia. Gate obligatorio antes de sync y de datos reales.

### BRAIN-06 — cifrado y sync

Cifrado del vault, event log, adaptador falso primero y después el transporte elegido en D-07. Conflictos y revocación de dispositivo. Restaurar un iPhone nuevo desde el Mac.

**Hito: MVP técnico interno** (ver `MVP_ACCEPTANCE.md`, sección 1).

### BRAIN-07 — captura universal

Share Extension (enlaces, Reels, TikTok, texto, archivos), audio, fotos, entrada rápida, transcripción en el dispositivo y retención `TRANSIENT` para audios de respuesta.

### BRAIN-08 — importadores históricos

ChatGPT, Claude y WhatsApp (texto cifrado, sin multimedia), con fixtures anonimizados.

### BRAIN-09 — Agenda y modo Trabajo

Calendario y tareas (D-05), proyectos en Agenda, modo Trabajo de lunes a viernes de 09:00 a 13:00, desconexión laboral con reprogramación propuesta, dos excepciones configurables y Focus de iOS controlado por Manu.

### BRAIN-10 — Hoy y rutinas de noche y mañana

Pestaña Hoy (briefing, tiempo, baterías, música, contexto), rutina nocturna (ciudad, desayuno, propuesta de alarma confirmada por Manu), mañana (tiempo en pantalla bloqueada, briefing al desbloquear, música por la ruta verificada), tardes y «antes de salir». D-06 para el tiempo.

### BRAIN-11 — chat MANU y proactividad

Motor de conversación en nivel base, respuestas con fuentes, personalidad por plantillas, motor de proactividad con registro de sugerencias y presupuesto de interrupciones, niveles de acción y lista blanca de mensajes. Nivel conversacional solo si D-08 y G-13 lo permiten.

### BRAIN-12 — hardening y QA de la Beta 1

QA en el iPhone 14 y el Mac, rendimiento, accesibilidad, threat model revisado, restore real, instrucciones de instalación y lista de funciones excluidas o degradadas.

### BRAIN-13 — Dinero (tras G-07)

Capturas, tickets y voz; confirmación de importe, fecha y comercio; categoría automática corregible; suscripciones, recurrentes, comparación mensual, «cuánto puedo gastar hoy» y avisos. Open Banking solo como estudio con ADR propio. **Condicional para la Beta 1.**

### BRAIN-14 — llamadas y transcripciones (tras G-08)

Estudio de rutas reales, consentimiento y revisión legal. Interesan tareas, compromisos y fechas. Puede concluir que no es viable. **Fuera de la Beta 1.**

### BRAIN-15 — bandeja diaria de capturas (tras G-10)

Detección de llegada (D-09) o activación manual, agrupación, historia cronológica, OCR, descripción disponible, pregunta del motivo, respuesta por texto o audio, confirmación, relaciones, tareas o eventos propuestos, retención `EXTRACTED_ONLY` y petición de borrado en Fotos. **Obligatoria para la Beta 1.**

### BRAIN-16 — personas

Perfiles a partir de lo que Manu cuente, Contactos, Calendario e importaciones de WhatsApp: fechas, planes, promesas, gustos e ideas de regalo, tiempo sin hablar (según los datos disponibles).

### BRAIN-17 — Tú: salud, actividad, UREVO y comidas (tras G-11)

HealthKit por tipo de dato, sesiones de UREVO, comidas por foto, habituales o texto. Sin dieta ni calorías. **Condicional para la Beta 1.**

### BRAIN-18 — Refugio (tras G-12)

Acompañamiento emocional sin diagnóstico, fases entender/resolver/cambiar de aire, memoria protegida y protocolo de ayuda humana ante riesgo. **Condicional para la Beta 1.**

### BRAIN-19 — proyectos e ideas

Tipos de proyecto, ideas que no se activan solas, comparación con la carga actual, proyectos inactivos con paso pequeño y motivación.

### BRAIN-20 — Laboratorio

Entradas de errores, mejoras e ideas con contexto técnico, estados, e informes preparados que solo se envían con aprobación.

**Hito: Beta 1** (ver `MVP_ACCEPTANCE.md`, sección 2).

### BRAIN-21 — mantenimiento operativo semanal (futuro)

Revisión semanal por ChatGPT de disponibilidad, errores, backups, sync, almacenamiento, seguridad, dependencias, integraciones y costes, con resultado correcto / necesita atención / urgente. Nunca modifica producción ni despliega sin aprobación. **Bloqueada** hasta que exista un servidor accesible mediante una integración.

## Gates

- No sync antes de export/restore probado (G-01).
- No integración OAuth antes de token threat model y revocación probada (G-02).
- No datos personales reales antes de cifrado, export y política de borrado (G-03).
- No acciones externas sin propuesta, auditoría y aprobación (G-04).
- ~~No app nativa antes de demostrar dos capacidades imposibles por PWA/Atajos (G-05).~~ Retirado por ADR-0007.
- No servicios sin barrera de gasto (G-06).
- No datos financieros hasta G-07.
- No grabaciones ni transcripciones de llamadas hasta G-08.
- No contenido sensible en superficies bloqueadas hasta G-09.
- No borrado de originales hasta G-10.
- No datos de salud hasta G-11.
- No Refugio hasta G-12.
- No datos sensibles a proveedores de modelo hasta G-13.
- No mensajes automáticos hasta G-14.

Definición completa de los gates en `BACKLOG.md`.

## Estructura inicial del repositorio

> Estructura orientativa. Las partes TypeScript y web solo existen si D-01 las mantiene.

```text
manu-os/
  AGENTS.md
  README.md
  .editorconfig
  .gitignore
  .env.example
  .github/
    workflows/foundation-check.yml
    pull_request_template.md
  apps/
    ios/                       # app SwiftUI y extensiones
    macos/                     # app de Mac (según D-01)
    web/                       # solo si D-01 lo mantiene
    api/                       # servicio mínimo, solo si D-07 lo elige
  packages/
    brain-domain/              # contratos del conocimiento (lenguaje según D-01)
    brain-storage/             # puertos y adaptadores locales
    brain-sync/                # eventos y transporte
    brain-importers/           # ChatGPT, Claude, WhatsApp, capturas
    brain-agent-protocol/      # comandos y MCP, más adelante
  docs/
  ai/
  fixtures/
    synthetic/                 # nunca datos personales reales
  tools/
    verify/
```

`apps/` puede estar vacío durante BRAIN-01. No se generarán scaffolds que todavía no se usan.

## Documentación canónica

- ADR: decisiones de arquitectura estables y sus consecuencias.
- `docs/product/EXPERIENCE.md`: requisitos funcionales de Manu.
- `ai/PROJECT_STATE.md`: versión corta del estado real, actualizada después de merge.
- `ai/CURRENT_TASK.md`: un único encargo activo, con alcance y criterios.
- `ai/HANDOFF.md`: qué cambió, comandos, resultados y NO VERIFICADO.
- `ai/QA_REPORT.md`: revisión independiente.
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
10. Tras aprobación, merge a `main`, actualización de `PROJECT_STATE.md` y siguiente incremento.

La verificación en dispositivo la ejecuta Manu o un entorno macOS (D-04): el entorno de Claude Code en la nube no compila apps de Apple.

## Política de esfuerzo de Claude

- Bajo/medio: formato, docs mecánicos y cambios triviales.
- Alto: implementación normal con varias capas o tests.
- Máximo: solo migraciones delicadas, criptografía, bugs no reproducibles o revisión de seguridad.

BRAIN-01 usa **alto**, no máximo.

## Definition of Done general

- alcance y archivos cambiados coinciden con CURRENT_TASK;
- tests/lint/typecheck/build pasan;
- sin secretos ni datos reales;
- documentación y migraciones actualizadas;
- accesibilidad, rendimiento y seguridad revisados cuando apliquen;
- handoff incluye comandos, salida resumida y limitaciones;
- QA reproduce los criterios desde un checkout limpio;
- no hay afirmaciones de funcionamiento sin evidencia.

## Historial del roadmap

### Roadmap ADR-0007 (sustituido el 2026-09-28 por las decisiones de producto de Manu)

| Fase | Contenido en la versión ADR-0007 | Qué ha cambiado |
| --- | --- | --- |
| BRAIN-01 | contratos, lenguaje pendiente | añade retención y eventos de eliminación (ADR-0008) |
| BRAIN-02 | app nativa mínima + vault | añade app de Mac y navegación de cinco pestañas |
| BRAIN-03 | superficies y modos, incluido botón de acción | sin botón de acción (iPhone 14); controles del Centro de Control |
| BRAIN-05 | export/restore | añade copia semanal en el Mac y exportación compartible sin sensibles |
| BRAIN-06 | cifrado y sync | transporte en D-07; restaurar iPhone desde el Mac |
| BRAIN-07 | captura universal | añade enlaces de Reels/TikTok |
| BRAIN-08 | importadores ChatGPT/Claude | añade WhatsApp |
| BRAIN-09 | calendario y modo Trabajo | pasa a Agenda y modo Trabajo con desconexión |
| BRAIN-10 | HOME contextual y modo Mañana | pasa a Hoy y rutinas de noche y mañana |
| BRAIN-11 | MIRROR read-only | pasa a chat MANU y proactividad (ADR-0009) |
| BRAIN-12 | hardening y decisión Mac/web | pasa a hardening y QA de la Beta 1 |
| BRAIN-13, 14 | finanzas, llamadas | sin cambios de fondo |
| — | — | nuevas BRAIN-15 a BRAIN-21 |

### Roadmap BRAIN-00 (sustituido por ADR-0007)

| Fase | Contenido original |
| --- | --- |
| BRAIN-01 | paquete TypeScript puro de contratos |
| BRAIN-02 | persistencia IndexedDB detrás de `LocalStore` |
| BRAIN-03 | PWA instalable con captura e Inbox offline |
| BRAIN-04 | búsqueda y evidencia |
| BRAIN-05 | export/restore |
| BRAIN-06 | cifrado y sync |
| BRAIN-07 | Atajo iOS/Mac de captura |
| BRAIN-08 | importadores ChatGPT/Claude |
| BRAIN-09 | Google Calendar read-only |
| BRAIN-10 | HOME contextual |
| BRAIN-11 | MIRROR read-only |
| BRAIN-12 | hardening y decisión sobre companion nativo |
