# QA visual de iPhone — capturas 2026-11-09

## Evidencia
Manu mostró capturas reales de MANU OS instalado en un iPhone: Bahía, Hoy, MANU, Dinero, Proyectos y Tú. La navegación inferior, la nueva M y la estética Fable aparecen correctamente. Los indicadores de Tu nube (última sincronización) y de push (suscripción activada) son **estados locales mostrados en la app**, no una nueva auditoría del backend.

## Problemas corregidos
1. **Dinero / Sabadell:** la PWA devolvía el error inespecífico «Error de conexión bancaria» cuando la función `manu-bank` no estaba publicada. Ahora distingue HTTP 404 (función no publicada), 503 (sin configurar) y 401 (sesión Tu nube caducada). Un problema de red se describe como conexión con el servidor MANU, sin implicar que haya fallado Sabadell ni afirmar que se hayan leído cuentas.
2. **MANU:** con Gemini activo, la bienvenida vacía decía simultáneamente «Aún funciono sin IA». Ahora depende de los estados reales `aiReady()` y `aiMode().on`. Los chats existentes no se modifican.
3. **Barra superior:** el vidrio translúcido al desplazarse desdibujaba las cabeceras de Proyectos y Bahía a través de la capa y podía suavizar la etiqueta superpuesta. Se usa fondo casi opaco y desactivación de backdrop-filter **solo en `.topbar.show`**. La barra de pestañas mantiene su efecto y los seis iconos de Fable.
4. **Gastos de Dinero:** nueva nota «Gastos registrados en MANU, no es el saldo de Sabadell», para no confundir un total local de 0 € con el saldo real.

## No se ha cambiado
Sin nuevos permisos, servicios, conexión a bancos, secretos, credenciales ni despliegues Supabase. Las funciones de Sabadell todavía no están publicadas. No se han tocado push, memoria, seguridad, IA real o los datos del vault.

## Verificación
Pruebas unitarias `web/tests/ios-screenshot-qa.test.js` y suite CI completa del repositorio. **Aún falta volver a mirar en Safari/iPhone** si el título de la topbar se ve nítido tras el cambio; las capturas anteriores no prueban el resultado nuevo.

## Observaciones para fase posterior
- Proyectos conserva tarjetas altas en dos columnas; los títulos largos caben pero ocupan 2–3 líneas.
- «Tu nube» y push muestran estados locales, no una garantía continua de disponibilidad del servidor.
- «0 recuerdos» y «¿Cómo quieres que te llame?» son coherentes con un vault local aún sin esa respuesta; no se deben rellenar automáticamente con datos de otro servicio.
