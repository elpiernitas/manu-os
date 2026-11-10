# CLAUDE DESIGN — recuperación de la primera propuesta (2026-11-10)

## Petición de Manu
Después de ver Horizonte integrado en la versión 108, Manu prefirió **volver a la propuesta original de Claude Design**, no continuar con el estilo marítimo editorial de Horizonte.

## Fuente original inspeccionada
Archivo facilitado previamente por Manu: `MANU OS en revisión.zip` (2026-11-09), con `DESIGN_SYSTEM.md`, `INTEGRATION.md`, `MANU OS.dc.html`, 31 iconos SVG, tokens CSS, componentes y módulos de demostración.

La propuesta original usa negro `#050608`, superficies `#111318`, texto `#F7F8FA`, secundarios `#949AA6` y azul eléctrico `#246BFD / #4D8DFF`. Las superficies siguen una jerarquía editorial y los iconos modulares tienen un punto de memoria. Se prioriza la tipografía del sistema Apple y una única propuesta destacada por pantalla.

## Implementación v109 — fase visual
- Tema `design` («Claude Design») en `web/core/horizonte.js`, ahora predeterminado **cuando el usuario no había guardado una elección previa**.
- `web/design/claude-design.css`: aplicación de la paleta y reglas originales a la aplicación de verdad, con superficies limpias, botones menos redondos y navegación oscura. Reutiliza los iconos Fable originales que ya se integraron anteriormente.
- Tú → Apariencia permite elegir `design`, `clasico` (la versión azul anterior con sus tarjetas) o `horizonte` (el estilo nuevo, ahora alternativo).
- El estilo seleccionado continúa viajando en `vault.settings.skin` con Tu nube. Una elección explícita previa se respeta, sin una migración destructiva ni sobrescribir preferencias.
- PWA v109 y cache de la nueva hoja; conserva todo el backend y la estructura de app.

## Qué NO es
**No se ha insertado el prototipo HTML de 252 KB ni sus datos inventados.** Tampoco se ha reescrito el `app.js` monolítico para reproducir uno a uno todos los layouts del shell ES Modules `src/main.js`. Esta fase recupera el lenguaje de diseño original **sobre el núcleo real** sin prometer fidelidad píxel a píxel al prototipo. Una segunda fase podría portar las composiciones originales de Agenda, MANU, Dinero y Tú mediante adaptadores a los módulos actuales.

## Invariantes
Se conservan:
- Memoria, historial, aprendizaje, propuestas y fuentes.
- Banco Sabadell, acceso AIS, importación de movimientos con confirmación y deduplicación.
- Supabase, Tu nube, permisos, Google, Spotify, notificaciones y Atajos.
- Bahía, proyectos, partidas y recursos.
- Todos los datos del vault; ningún dato demo se copia en producción.

## QA
- `web/tests/claude-design.test.js` comprueba tema, controles, tokens y precaché.
- `web/tests/horizonte.test.js` comprueba los tres temas.
- `e2e/horizonte.e2e.mjs` sigue probando Horizonte como elección explícita y prueba adicional de Claude Design por defecto.
- CI del PR y revisión visual en iPhone pendientes. Un CSS puede verse distinto en Safari respecto a Chromium.
