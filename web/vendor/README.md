# Dependencias de terceros

| Archivo | Proyecto | Versión | Licencia | Origen | SHA-256 |
|---|---|---|---|---|---|
| `xlsx.full.min.js` | SheetJS Community Edition | 0.20.3 | Apache-2.0 (`LICENSE-sheetjs.txt`) | https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js | `cc015130aa8521e7f088f88898eba949ccdcbfb38df0bd129b44b7273c3a6f41` |

Se usa solo para leer en el dispositivo los extractos .xls/.xlsx del banco (Dinero → Importar). Se carga bajo demanda y no se ejecuta al abrir la app. Se usa la build completa porque la build «mini» no lee el formato BIFF (.xls antiguo) que exporta Banco Sabadell: lo comprobamos con el fixture `web/tests/fixtures-sabadell-ejemplo.xls`, que tiene datos inventados.
