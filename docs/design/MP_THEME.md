# Tema «mp.» en MANU OS (WEB-119)

Implementa la propuesta `docs/design/MP_BRAND_UNIFICATION_2026-11-22.md` con la guía vigente del portfolio
(`elpiernitas/manupernas-web`, rama `design/mp-identidad-2026-11-22`, commit `8b826f0`,
`docs/IDENTIDAD-VISUAL-APROBADA-2026-11-22.md`).

## Qué es

- Un cuarto tema, `mp`, junto a Claude Design, Clásico y Horizonte. Archivo: `web/design/mp.css`.
- Montserrat variable (subconjunto latino, 38 KB, licencia OFL en `web/design/fonts/montserrat/OFL.txt`), servida desde la propia app: la CSP no permite fuentes externas.
- Paleta: blanco `#FFFFFF` predominante, superficies `#F5F5F7`, texto `#0B0B0D`, azul `#0066FF`.
  - El azul de marca solo va detrás de texto blanco o en el logotipo. Sobre gris claro, `#0066FF` se queda en 4,4:1, por debajo de AA; el texto azul usa `#0057D9`.
  - Error, aviso y éxito conservan colores semánticos (`#C62F28`, `#A35F00`, `#187A4C`), todos ≥ 4,5:1.
- Logotipo `mp.` (`web/design/mp.svg` y `web/design/mp-brand.js`): la `m` toma el color del texto y la `p.` es siempre azul. Aparece en la cabecera de MANU y en Apariencia; no en cada tarjeta.
- Avatar **PROVISIONAL** (`web/design/mp-avatar-provisional.svg`): trazado automático del tablero, pendiente de validación de Manu. Solo en la cabecera de Tú. Sustituirlo es cambiar un archivo.
- Sin las tres diagonales y sin símbolos nuevos.

## Quién lo ve

| Situación | Tema |
|---|---|
| Instalación nueva (sin vault guardado) | `mp` |
| Instalación anterior sin elección guardada | sigue en Claude Design; Hoy ofrece «Probar mp.» una vez («Ahora no» se recuerda) |
| Elección guardada en `vault.settings.skin` | la elegida, siempre |

El predeterminado de las instalaciones nuevas se guarda en el dispositivo (`localStorage` `manuos.skinDefault`), no en el vault, para que Tu nube no cambie el aspecto de otro dispositivo. Cambiar de tema solo escribe `settings.skin`.

## Verificación

- `web/tests/mp-theme.test.js`: reglas de elección, logotipo, paleta con contraste calculado y precache.
- `e2e/mp.e2e.mjs` (Chromium emulando iPhone 14, no Safari real):
  - instalación nueva y anterior;
  - datos intactos tras cuatro cambios de tema;
  - contraste AA medido en el texto de las seis pantallas, el detalle de proyecto, ocho subpantallas de Tú y la barra de comandos;
  - sin desbordes a 320, 390 y 768 px;
  - texto al 130 %;
  - movimiento reducido.

## NO_VERIFICADO

- Safari real del iPhone, VoiceOver y Texto grande del sistema.
- Que Manu apruebe el avatar provisional y el resultado visual. Hasta entonces, las instalaciones anteriores no cambian solas de tema.
- El icono de la app en la pantalla de inicio sigue siendo el de siempre: cambiarlo afecta a todos los temas y obliga a reinstalar la PWA. Queda pendiente de decisión de Manu.
