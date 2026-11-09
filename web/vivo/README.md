# MANU OS · HORIZONTE (prototipo)

Prototipo navegable del rediseño de MANU OS. **No sustituye a la app**: vive aparte en `web/vivo/`,
no lee `manuos.vault`, no llama a ninguna red y solo usa **datos inventados** (`src/demo.js`).

**Idea:** todo MANU OS es un único horizonte. Arriba, el cielo real de Gijón (la hora y el tiempo
deciden la luz de la interfaz). Abajo, papel y tinta. MANU es tu reflejo: dos ojos asomados a la línea.

## Abrirlo

```
python3 -m http.server 8766 --directory web/vivo     # y abre http://localhost:8766/
```
Parámetros para probar: `?hora=17:50&tiempo=lluvia` (tiempos: despejado, nubes, lluvia, niebla).

## Qué hay

| Sección | Nombre | Qué es |
|---|---|---|
| Hoy | La portada | Una revista sobre tu día: cabecera, titular, sumario. El sol se arrastra |
| Agenda | Tabla de mareas | Cada día es un arco con sus citas |
| MANU | Tu reflejo | Habla con tres voces: lo sé / lo sospecho / confírmamelo. Y dice «no lo sé» |
| Dinero | Mareas | Mareógrafo, hallazgos con sello, «una noche en pagos», ticket |
| Bahía | El pueblo | Mismo cielo; cada proyecto botado es un barco y enciende el faro |
| Proyectos | Astillero | Cada proyecto es un casco sobre su plano; cada área, un muelle |
| Tú | Bitácora | Quién cree MANU que eres, en prosa tocable; decisiones; lo borrado |

## Nueve inventos (todos funcionan en el prototipo)

1. **El cielo es la interfaz.** Color, tema claro/oscuro, sol o luna salen de la posición real del sol.
2. **Arrastrar el día.** Un dial mueve el sol: la portada te enseña cualquier hora de hoy.
3. **La botella.** MANU no avisa: deja una botella en la orilla. Aceptar, devolver al mar o «nunca más».
4. **Constelación.** Cada recuerdo es una estrella; su forma dice la certeza. Toca dos y ves el hilo.
5. **Zasca con recibo.** Un zasca siempre trae pruebas, y puedes decir «touché» o «recurro».
6. **Una noche en pagos.** Los pagos seguidos de madrugada se cuentan como ruta. Hecho ≠ hipótesis.
7. **Botadura.** Terminar un proyecto no dice «Completado»: el barco cae al agua y aparece en Bahía.
8. **La sonda.** Buscar en todo a la vez (⌘K), con resultados por profundidad.
9. **Retrato en prosa.** Tu perfil es un párrafo; cada frase se confirma, corrige, duda o borra.

## Carpetas

- `src/cielo.js` · sol, fases, colores, contraste (puro)
- `src/adaptadores.js` · del vault real al modelo de cada pantalla (puro)
- `src/acciones.js` · lo único que cambia datos (puro)
- `src/demo.js` · datos inventados, con la forma del vault real
- `src/ui.js` · iconos, cara de MANU, sellos, hojas, estados
- `src/vistas/*.js` · una por sección · `src/main.js` · estado, navegación y eventos
- `css/tokens.css` · tokens · `base.css` · cielo y armazón · `piezas.css` · componentes · `mundos.css` · secciones
- `fonts/` · Fraunces (licencia SIL OFL 1.1, incluida)
- `docs/` · sistema de diseño, adaptadores, migración e informe de pruebas · `capturas/` · iPhone y Mac
