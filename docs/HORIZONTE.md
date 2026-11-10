# Horizonte · el tema principal de MANU OS (WEB-108)

Horizonte es el diseño por defecto de la app real desde la versión 108. El diseño azul anterior sigue
completo como tema **Clásico**.

**Cambiar de tema:** Tú → Ajustes → Apariencia → Horizonte o Clásico. El cambio es inmediato: no recarga,
no cierra sesiones ni borra nada. La elección se guarda en `vault.settings.skin` (viaja con Tu nube) y en
`localStorage` «manuos.skin».

**Copia de la versión anterior:** rama `respaldo/clasico-v107`, idéntica a la v107 publicada.

## Cómo está hecho

Horizonte **no sustituye** la app por el prototipo. Es una piel con componentes propios dentro de la
misma app: el chat, el banco, Tu nube, los avisos, Google, Spotify, Atajos y el juego son los de siempre.

| Archivo | Qué hace |
|---|---|
| `web/core/horizonte.js` | Funciones puras sobre datos reales: cielo, portada, mareas, constelación, bitácora, astillero |
| `web/design/horizonte.js` | Piezas visuales (HTML y SVG). Todo el texto pasa por `esc`. Sin estilos en línea: la CSP de la app los prohíbe |
| `web/design/horizonte.css` | Todo bajo `html[data-skin="horizonte"]`. Con Clásico no se aplica ninguna regla |
| `web/design/fonts/` | Fraunces, licencia SIL OFL 1.1 (`OFL.txt`) |
| `web/app.js` | `applySkin()` en cada repintado, las pantallas eligen componente según el tema, acciones `hz-*` |
| `web/vivo/` | El prototipo aislado, **solo con datos inventados**. No lee el vault ni la red |

## Qué está conectado de verdad

| Sección | Con datos reales | Notas |
|---|---|---|
| Cielo de toda la app | Posición del sol calculada para la ciudad activa (casa o la de hoy) y tiempo real de Open-Meteo | Sin datos del tiempo, cielo despejado y la portada lo dice |
| Hoy · portada | Fecha y hora del dispositivo, agenda de hoy (Google o pegada), recordatorios de hoy, modo del día, tiempo | El dial mueve el cielo y la portada. Con el dial en otra hora usa la previsión de esa hora si la hay. No inventa eventos |
| Hoy · botella | La propuesta real del motor de propuestas (`topProposal`) | Aceptar, «Más opciones» o «Luego» usan las acciones reales (`mem-prop`). Sin propuesta, sin botella |
| Hoy · resto | Todas las tarjetas de antes (fichaje, correo, servicios, tareas…) | Igual que en Clásico, con otra piel |
| MANU · Hablar | El chat real (motor local y Gemini si está activado) | No hay respuestas de guion |
| MANU · Constelación | Las afirmaciones vivas del cerebro real (hasta 48, las más recientes) | Estado: confirmada, inferida, pendiente, contradicha o caducada (`staleness` de brain.js). Hilos: solo los que `related()` encuentra, con su motivo. Tocar una estrella abre la ficha real de Memoria: confirmar, corregir, dar por pasado, olvidar |
| Dinero · mareas | `vault.spending` y `vault.income` de los últimos 90 días | Marca HECHO, HIPÓTESIS y PENDIENTE. La marea es ingresos menos gastos apuntados, no el saldo (lo dice en pantalla). Bizum y transferencias fuera de noches y franjas |
| Dinero · noches | Secuencias de 3 o más pagos entre las 21:00 y las 06:00 | «Sí, apúntalo» guarda un recuerdo dicho por Manu; los movimientos no cambian. «No» no vuelve a preguntar |
| Dinero · Sabadell | La tarjeta de siempre: saldo, movimientos, «Importar todo (90 días)» con su confirmación y su deduplicación | Sin cambios de comportamiento |
| Proyectos · astillero | Proyectos reales, con sus fuentes y su chat intactos | Ver la regla del casco abajo |
| Tú · Bitácora | Afirmaciones vivas sobre Manu (sin terceros), por tipo | Cada frase abre su ficha real de Memoria |
| Tú · Apariencia | `vault.settings.skin` | |
| Bahía | El juego real, sin cambios en mecánicas, guardados ni dibujo | Solo cambia el marco de la página |

### Regla del casco (Astillero)

- El casco avanza **solo con piezas** que Manu crea y marca dentro del proyecto (`project.pieces`, opcional).
- Sin piezas, el proyecto es «solo el plano»: no se muestra ningún porcentaje.
- Avance = piezas hechas ÷ piezas. Como mucho 40 piezas.
- **Botar** (= terminar) exige todas las piezas hechas y un segundo toque de confirmación. Guarda
  `project.launchedAt`. Las fuentes y el chat no cambian. «Volver a ponerlo en el astillero» lo deshace.
- Los campos son opcionales: un vault antiguo no necesita migración. Viajan con Tu nube como el resto
  del proyecto (el chat del proyecto sigue sin subir).

## Lo que queda provisional o pendiente

- **Bahía no muestra todavía los proyectos botados**: el juego tiene sus propias reglas de progreso y no
  lo he tocado para no romper guardados. Es una mejora futura que hay que diseñar dentro del juego.
- **El chat no lleva sellos de certeza** (lo sé / lo sospecho): las respuestas de Gemini no traen esa
  información y no la invento. Los sellos están donde hay base: Dinero, Constelación y Bitácora.
- **La agenda de varios días** sigue siendo la pantalla Agenda de siempre, con la piel nueva. La tabla de
  mareas del prototipo no está conectada.
- **La sonda (buscar en todo, ⌘K)** del prototipo no está; la búsqueda real sigue en Tú.
- **Safari real e iPhone real: no probados.** Todo se ha visto en Chromium emulando iPhone.

## Pruebas

- `npm test` (en `web/`): incluye `tests/horizonte.test.js` (11 pruebas: tema, compatibilidad del vault y
  Tu nube, cielo, contraste AA, portada, mareas, constelación, bitácora, astillero, XSS, estados vacíos).
- `node e2e/horizonte.e2e.mjs [capturas]`: la app real con un vault inventado. Tema por defecto, dial,
  dinero, chat real, constelación con teclado, astillero y botadura, bitácora, Clásico y vuelta tras
  recargar, vault vacío, noche, 320/375/390/430 px, Mac, movimiento reducido y modo sin conexión.
