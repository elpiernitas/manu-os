# Sistema de diseño HORIZONTE

## Principios
1. **Un horizonte.** Toda pantalla tiene cielo (contexto) arriba, olas, y papel (contenido) debajo.
2. **Papel y tinta.** Sin sombras, sin esquinas redondas, líneas de 1,5 px. Solo son redondos los astros, las boyas y las estrellas.
3. **Una sola tinta de acento: la boya.** Marca dónde estás y qué te pide atención.
4. **La certeza se ve.** Hecho / hipótesis / por confirmar se distinguen por forma y palabra, nunca solo por color.
5. **Cada animación dice algo.** La boya flota (estás aquí), los ojos parpadean (MANU está), el anillo late (te espera).

## Tokens (`css/tokens.css`)
| Grupo | Tokens |
|---|---|
| Color día | `--papel #f3eee3`, `--papel-2 #e9e2d3`, `--tinta #15120e`, `--tinta-2 #5a5348`, `--boya #ff4b1f`, `--boya-tinta #b02a07`, `--sobre-boya #15120e` |
| Color noche | `--papel #0a0f1e`, `--papel-2 #141b30`, `--tinta #eef0f6`, `--tinta-2 #a3abc2`, `--boya #ff6a3d`, `--boya-tinta #ff8a66` |
| Cielo (los pone `cielo.js`) | `--cielo-1`, `--cielo-2`, `--mar`, `--astro-x`, `--astro-y` |
| Tipografía | `--f-titular` Fraunces variable (ejes opsz, SOFT, WONK), `--f-texto` sistema, `--f-dato` monoespaciada del sistema |
| Tamaños | `--t-ante .72rem`, `--t-nota .875rem`, `--t-texto 1rem`, `--t-2`, `--t-titular`, `--t-cabecera` (fluidos con `clamp`) |
| Espacio | `--e1 4` · `--e2 8` · `--e3 12` · `--e4 16` · `--e5 24` · `--e6 40` · `--e7 64` px |
| Medidas | `--borde 1.5px`, `--toque 44px`, `--dique 64px`, `--ancho 1120px` |
| Movimiento | `--d1 140ms`, `--d2 320ms`, `--d3 700ms`, `--curva`, `--rebote` |

El tema (`data-tema="dia|noche"`) no lo elige el usuario ni el sistema: lo decide la luminancia del cielo.
Contraste: todos los pares texto/fondo ≥ 4,5:1 y la cabecera sobre el cielo ≥ 3:1 a cualquier hora y tiempo (probado).

## Tipografía
- **Titular:** Fraunces 600, `WONK 1`, interlineado 0,98. Cabecera «MANU»: 900 cursiva, `SOFT 100`.
- **Antetítulo y datos:** monoespaciada, versalitas con espaciado .12em.
- **Texto:** fuente del sistema (San Francisco en iPhone y Mac).

## Iconos e ilustración (`src/ui.js`, `src/vistas/bahia.js`)
Iconos propios, trazo 1,75 sobre 24 px: faro (Bahía), sol en el horizonte (Hoy), moneda sobre ola (Dinero),
velero (Astillero), rosa de los vientos (Tú), tabla de mareas (Agenda), sonda, estrella, botella.
La cara de MANU tiene cinco gestos: calma, piensa, duda, zasca, feliz. La Bahía es un SVG propio.

## Componentes (`css/piezas.css`)
`boton` (+ `-linea`, `-mini`, `-peligro`) · `pildora` · `chapa` · `sello` (hecho, hipótesis, sabe, sospecha, confirmar) ·
`demo` · `tarjeta` · `lista` · `linea` (cronología) · `pestanas` · `barra` · `hoja` (diálogo nativo) · `aviso` ·
`estado` (vacío, cargando con `marea-carga`, error) · `dial` · `botella` · `sumario` · `ticket` · `mareografo` · `momentos` · `plano`.

## Estados
Vacío («Día en blanco», «Mar en calma», «Gradas vacías»), cargando, error con reintento, éxito (aviso),
banco desconectado / caducado, y «no lo sé» de MANU (texto en niebla).

## Accesibilidad
Enlace «Saltar al contenido», un `h1` por vista, foco visible de 3 px, objetivos táctiles ≥ 44 px,
diálogos nativos (foco atrapado y Esc), estrellas y lugares de la Bahía operables con teclado,
tablas con encabezados, `aria-live` en respuestas, áreas seguras de iOS, y todo el movimiento se apaga con
«Reducir movimiento».

## Mac
Desde 960 px el dique pasa a muelle lateral con etiquetas, Agenda y Sonda (⌘K), y el papel va a dos columnas.
