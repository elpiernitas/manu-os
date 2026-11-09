# Fable 5.1 · Fase 2: Hoy + conexiones (2026-11-09)

## Alcance publicado al fusionar
- Nuevo encabezado editorial de **Hoy**, adaptado del paquete de Fable 5.1 aportado por Manu: fecha y contexto reales, saludo, temperatura y previsión de Open-Meteo solo si están presentes, siguiente evento realmente registrado, recuento de tareas/recordatorios sin estimaciones.
- Propuesta de MANU en primer plano con el motor y los botones actuales: no se han sustituido por las simulaciones de Fable.
- Menos duplicación: el evento «Próximo» y la tarjeta de tiempo antiguo desaparecen si el resumen real ya los muestra. Si no hay previsión, el componente anterior se conserva para permitir cambiar ciudad y ver el error auténtico.
- Nueva sección **Conexiones** en Hoy:
  - **Tu nube (Supabase)**: usa el estado de sesión y la última sincronización persistidos, los conflictos y los errores del dispositivo. Una sesión iniciada no se anuncia como sincronización reciente.
  - **Notificaciones**: usa el ajuste de push y la existencia de una suscripción de este dispositivo. No afirma que un aviso se haya entregado sin comprobación.
  - **Banco Sabadell**: enlace a Dinero y estado «Integración de lectura pendiente»; NO se afirma que MANU esté conectado por API solo porque Enable Banking haya activado la app restringida. PR #104 separado, sin desplegar.
- Navegación intacta: Bahía, Hoy, MANU, Dinero, Proyectos y Tú. Se mantienen fichaje, recordatorios, tareas, ideas, datos locales, Google y demás contenido de Hoy.
- `web/design/fable-today.js` módulo de presentación puro; `web/design/fable-today.css` estilos exclusivos de Hoy. Ambos en la caché offline de la PWA.

## Seguridad y privacidad
- No se han añadido secretos, tokens, permisos, accesos de banco, llamadas a APIs, ni servicios nuevos.
- Las etiquetas no exponen saldo, movimientos bancarios ni datos sensibles en el encabezado.
- Texto de la agenda/tiempo pasa por HTML escaping. La página no recoge datos del demo de Fable.
- Los indicadores se derivan de **estado local** de Tu nube y push: para saber si el servidor está activo hay que abrir la pantalla correspondiente y comprobarlo. No son monitorización continua.
- **No fusionar ni desplegar PR #104** como parte del rediseño: requiere cerrar la protección de la clave bancaria y comprobar la API real.

## QA
- Nuevas pruebas unitarias en `web/tests/fable-today.test.js`: entradas reales, vacíos, XSS, estados y enlaces, integración PWA, caché.
- Suite completa + controles de GitHub Actions.
- Pendientes visuales: Safari iPhone instalado, modo offline, anchos 320/390 px y escritorio.

## Siguiente fase
- En una rama distinta, integrar los componentes de Fable para Agenda y Tú sin copiar datos ficticios.
- En banco, validar por separado la función, callback, claves, políticas y consentimientos antes de cualquier despliegue real.
