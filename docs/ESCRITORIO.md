# MANU OS en escritorio: centro de operaciones (WEB-124)

## Qué es

A partir de 1024 px de ancho, con el tema mp. o Claude Design, MANU OS deja de ser una pantalla de móvil estirada. Tiene tres zonas:

1. **Barra lateral fija**, a la izquierda:
   - las seis áreas oficiales (Hoy, Agenda, MANU, Dinero, Proyectos, Tú);
   - debajo, las subpantallas del área actual, por ejemplo Momentos o Limpieza en Tú, y en Proyectos la lista de tus proyectos;
   - abajo, «Buscar ⌘K» y «MANU ⌘J»;
   - se contrae a 76 px con el botón «« y el estado se recuerda en este dispositivo.
2. **Zona central** de hasta 1180 px (1320 px a partir de 1680 px):
   - Agenda: la semana en 7 columnas;
   - Dinero: dos columnas de tarjetas si caben;
   - Tú: sus grupos en dos columnas.
3. **Panel de MANU**, a la derecha:
   - se abre con ⌘J o Ctrl+J y se cierra con Esc, que devuelve el foco al botón;
   - a partir de 1280 px se acopla sin tapar la zona central; entre 1024 y 1279 px se superpone;
   - su estado se recuerda.

Por debajo de 1024 px no cambia nada: barra inferior, pantallas y gestos de siempre. Los temas clásico y Horizonte no usan este diseño.

## El panel de MANU no se inventa nada

`web/shell/context.js` es puro: recibe un modelo y lo pinta, escapado, en cuatro cajas.

| Caja | Contiene | Ejemplo |
|---|---|---|
| **Lo sé** | Datos del vault, cada uno con su fuente | «09:30 · Reunión · Agenda pegada» |
| **Lo deduzco** | Inferencias con su porqué | «Martes va lleno · 6 cosas con hora» |
| **Te propongo** | Acciones que Manu confirma con un toque | Las de Conexiones: pasar a Agenda, añadir a un proyecto, preparar la semana |
| **Me falta** | Lo que no está conectado o no sabe | «Tu calendario de Google no está conectado» |

Sin datos, el panel lo dice: «No me lo invento». Lo que se escribe en el panel va al chat de MANU por el camino normal (`say`). Si el texto activa el Refugio, la app lleva a la pestaña MANU en lugar de responder en el panel.

El modelo de cada vista lo arma `ctxModelFor()` en `app.js`:

- **Hoy**: eventos, recordatorios y tareas con su fuente; la franja del día como deducción; las tres primeras Conexiones.
- **Agenda**:
  - recuento de la semana;
  - choques entre un evento y tu tiempo reservado;
  - días llenos (deducción);
  - propuestas con fecha y «Preparar la semana».
- **Proyectos**:
  - lista: proyectos sin nada nuevo en tres semanas, como deducción;
  - proyecto abierto: para qué se creó, fuentes, tareas e ideas;
  - las **decisiones** de la memoria con fecha y de dónde salen, y lo que hay en Tu cerebro;
  - si no hay decisiones, lo dice;
  - las ideas sueltas que podrían ir a este proyecto (flujo A).
- **Dinero**:
  - consumo del mes con su nivel de fiabilidad;
  - el movimiento abierto y cuántas veces aparece;
  - cargos fijos detectados, como deducción;
  - «No hago operaciones con el banco».
- **Biblioteca y Momentos**: lo guardado y lo enlazado; los Momentos dicen que no suben a Tu nube.
- **Resto de Tú**: **qué se sincroniza y qué se queda en el dispositivo** (Tu nube, memoria, cerebro). Esto es la sección 8 de la misión.

## ⌘K: buscar o hacer algo, sin IA

La barra de comandos ya existía (WEB-76). Ahora:

- tiene las pantallas nuevas: Momentos, Aficiones, Limpieza, DJ, Tu cerebro, Memoria, Apariencia, Permisos y Rutinas;
- con dos letras o más, añade resultados de `findEverywhere`: ideas, tareas, gastos, personas, proyectos, biblioteca, documentos, Momentos, Tu cerebro y Tu archivo;
- cada resultado lleva una línea de procedencia («Proyecto», «Cerebro · Trabajo · ChatGPT», «Momento · 2026-05-01»);
- elegir un resultado lo abre.

## mp. claro y oscuro

Se elige en **Tú → Apariencia → Claro u oscuro**: Claro, Oscuro o Como el sistema.

- El valor por defecto es **Claro**, para que quien ya usaba mp. lo siga viendo igual. Se guarda en `settings.mpLook`.
- Los temas anteriores (Claude Design, clásico, Horizonte) siguen disponibles.
- `design/mp.css` usa ahora variables: `--mp-ink`, `--mp-paper`, `--mp-soft`, `--mp-ink-rgb`, `--mp-paper-rgb`, `--mp-shadow` y `--mp-mark`.
- El modo oscuro solo redefine esas variables, en `html[data-skin="mp"][data-look="dark"]` y en `[data-look="auto"]` con `prefers-color-scheme: dark`.
- Paleta oscura:
  - fondo `#0B0B0D`;
  - superficies `#17171A`;
  - texto `#F5F5F7`;
  - texto secundario `#A3A7B2`;
  - texto azul `#6EA6FF`;
  - el azul `#0066FF` sigue como fondo de los botones con texto blanco.
- El contraste AA está medido en la app, en las seis áreas, en móvil y escritorio, en claro, oscuro y sistema (`e2e/escritorio.e2e.mjs`).
- El avatar provisional es un SVG negro: en oscuro se invierte con un filtro. Cuando llegue el vector original, conviene pasarlo a `currentColor`.

## Flujos del segundo cerebro (fase E)

- **A · Idea → proyecto.** `conexiones()` propone añadir una idea suelta al proyecto con el que comparte palabras (nombre, para qué, títulos de fuentes):
  - dice qué palabras comparten y que es una suposición;
  - aceptar la enlaza (`filed`) y la añade como fuente, sin duplicar la idea;
  - descartar hace que no vuelva.
- **B · Fecha explícita o interpretada.** `whenIn()` devuelve `certainty` y `how`:
  - es explícita cuando el texto dice el día del calendario de este año o con año;
  - es interpretada en casos como «mañana», «el viernes» o un día sin año que pasa al año siguiente;
  - la propuesta lo dice, y el recordatorio creado guarda `from` y `dateFrom`;
  - en «Lo próximo» se lee «de una idea o tarea guardada · fecha interpretada».
- **C · Semana con MANU.** Agenda en 7 columnas y panel con choques, días llenos y propuestas. Nada se aplica sin un toque.
- **D · Decisiones de un proyecto.** El panel enseña las decisiones de la memoria con fecha y origen, y lo que dice Tu cerebro.
- **E · Momentos.** El panel enseña cuántos hay, que no suben a Tu nube y «tal día como hoy».
- **F · Dinero.** El panel enseña la categoría, cuántas veces aparece un movimiento y los cargos fijos (deducción). No hay operaciones bancarias.

## Archivos

- `web/index.html`: `<aside class="sidebar">` envuelve la barra de pestañas (`#sideHead`, `#tabs`, `#sideSub`, `#sideFoot`) y `<aside class="ctx-panel">`.
- `web/shell/context.js`: modelo y HTML del panel, y enlaces de la barra lateral. Es puro y tiene tests (`tests/shell-context.test.js`).
- `web/shell/shell.css`: el diseño de escritorio. Por debajo de 1024 px, `.sidebar` usa `display: contents` y la barra de pestañas queda como siempre.
- `web/app.js`: `shellUi` (en `localStorage` como `manuos.shell`), `applyShell()` (se llama desde `render()`), `toggleCtx()`, `ctxModelFor()`, las acciones `side-*` y `ctx-*`, y ⌘J y Esc.
- `web/sw.js`: `shell/` en la caché sin conexión. `tests/sw-shell.test.js` comprueba que todo lo que enlaza `index.html`, y todo `shell/` y `dj/`, está en la caché.

## NO_VERIFICADO

- Safari y WebKit: solo hay Chromium instalado. No se afirma nada de Safari en Mac ni en iPad.
- Un Mac o un PC reales con trackpad o ratón, y un lector de pantalla real (VoiceOver o NVDA). Las pruebas cubren teclado, foco, `aria-expanded` y Esc en Chromium.
- La aprobación visual de Manu del modo oscuro y del escritorio.
