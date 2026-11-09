# Informe de pruebas · HORIZONTE (2026-11-09)

## Ejecutado de verdad
| Comando | Resultado |
|---|---|
| `npm test` (en `web/`) | **401 de 401**. 13 son nuevas: `tests/vivo-cielo.test.js` (4) y `tests/vivo-adaptadores.test.js` (9) |
| `node e2e/vivo.e2e.mjs --capturas` (Chromium sin interfaz, iPhone 14 emulado, 320 px y 1440 px) | **68 de 68** y 17 capturas en `capturas/` |
| `node --check` de todos los módulos | Sin errores |

Qué cubren: posición del sol y fases; contraste AA de todos los pares de color y de la cabecera a cualquier
hora y tiempo; que las categorías y la caducidad coinciden con `core/money.js` y `core/brain.js`; hecho frente a
hipótesis; confirmar, corregir, dudar y olvidar (lápida sin texto); importación con confirmación y sin
duplicados; botar solo lo terminado; las siete vistas; teclado en constelación y Bahía; sin desbordes a 320 px;
que no sale ninguna petición de red y que `manuos.vault` no se toca.

Fallo real que encontraron las pruebas: dos estrellas caían una sobre otra y no se podían tocar. Corregido,
con prueba de regresión.

## NO_VERIFICADO
- **iPhone real y Safari.** Todo se ha visto en Chromium emulando un iPhone 14. Sin probar: áreas seguras reales,
  `@property` y `color-mix` en tu versión de iOS (según la documentación pública requieren Safari 16.4 y 16.2;
  no lo he comprobado en dispositivo), rendimiento de la lluvia y del desenfoque.
- **VoiceOver.** Hay roles, etiquetas y orden de foco, pero no se ha escuchado con un lector de pantalla.
- **Datos reales.** Los adaptadores se han probado con datos inventados con la forma del vault. Los conceptos
  reales de Sabadell pueden agruparse peor.
- **Citas de Google y tiempo real.** Faltan los dos pasos descritos en `ADAPTADORES.md`.
- **Las demás suites e2e de la app** (`push`, `nube`, `bankimport`…) no se han vuelto a ejecutar: este PR no
  cambia ningún archivo de la app.
- **Sin conexión.** El prototipo no tiene service worker propio.
