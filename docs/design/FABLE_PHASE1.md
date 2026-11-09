# MANU OS · Fable 5.1 / fase 1 (identidad)

**Fuente:** paquete de diseño entregado por Manu «MANU OS en revisión.zip», con 31 iconos originales, tokens CSS, prototipo y documentación. El paquete se ha examinado y no se utiliza como sustituto del núcleo real.

## Qué incorpora este PR

- `web/design/fable-icons.js`: familia original de 31 iconos Fable, además de la adaptación de Bahía que no figuraba en el prototipo de cinco pestañas.
- `web/design/fable-mark.svg`: nueva marca M modular para la pestaña del navegador; los PNG de la PWA instalable se conservan por ahora.
- `web/design/fable-tokens.css`: tokens aditivos, sin alterar los contratos visuales existentes.
- Barra de pestañas de `web/app.js`: nuevos iconos y marca MANU; se mantienen **Bahía / Hoy / MANU / Dinero / Proyectos / Tú** y todas sus acciones. Los iconos son decorativos y los nombres de las pestañas siguen siendo texto accesible.
- `web/sw.js`: precache offline de los nuevos recursos, con incremento de versión.

## Qué NO cambia

Memoria, IA opcional, acceso a Google, Spotify, push, Tu nube, dinero, Sabadell, proyecto Bahía, almacenamiento y navegación. No se incorpora el prototipo completo de Fable ni se cambian contratos de datos. No aparecen nuevos permisos, servicios, costes, secretos o datos reales.

## Diferencias entre diseño y app

El prototipo Fable tiene 5 secciones y una Agenda en el nivel principal. La app actual tiene seis pestañas, con **Bahía** y **Proyectos**. En esta fase se prioriza la navegación real y no se elimina ninguna sección existente. Una futura reorganización necesitará una decisión de producto y pruebas visuales en iPhone y Mac.

## Pruebas

`npm test` desde `web/`; comprobaciones de GitHub Actions; prueba manual en Safari iPhone instalada, Chrome Mac y anchos de 320 px / 390 px / escritorio. Las pruebas automatizadas cubren los 31 iconos más Bahía, la ausencia de SVG dinámico, la caché offline y las seis pestañas.

## Siguiente fase propuesta

Integrar gradualmente la composición editorial de **Hoy** (jerarquía, bloques de información, propuesta única), reutilizando las funciones reales del motor de propuestas. Revisar capturas antes de publicar una reforma completa. La pantalla Dinero se abordará por separado del puente bancario del PR #104.

**NO_VERIFICADO:** revisión visual real en Safari iPhone, modo PWA instalado y compatibilidad final de la futura actualización del icono de inicio iOS.
