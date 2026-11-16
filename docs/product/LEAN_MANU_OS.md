# WEB-110 · MANU OS ligero: Bahía fuera, Agenda dentro

## Decisión del usuario
Manu descarta Bahía 00 como un impulso experimental y pide quitar de MANU OS lo que no aporte utilidad. Mantener los datos personales existentes y la funcionalidad del núcleo.

Inspiración adicional: un vídeo de Víctor sobre un panel de vida cotidiana con agenda, vencimientos, renovaciones, dinero y hábitos. La prioridad es **conectar lo útil**, no acumular pantallas o gamificación.

## Implementado
- Se sustituye Bahía por Agenda en las seis pestañas: **Hoy · Agenda · MANU · Dinero · Proyectos · Tú**.
- Un dispositivo nuevo abre Hoy. Una sesión guardada como Bahía se redirige a Hoy sin borrar su vault.
- El router rechaza pestañas retiradas y las manda a Hoy.
- Se retira de `app.js` la pantalla de Bahía, sus controles, dibujo, temporizador, importaciones y acciones.
- Se retiran los estilos `.bz-*` y los módulos de juego del precache de la PWA.
- **No se borra `vault.settings.game`** ni se hace migración destructiva; esos guardados se quedan en las copias del usuario por si decide exportarlos o restaurarlos posteriormente.
- Archivos de fuente del minijuego permanecen en el repositorio para historia y posible rescate, pero la app no los carga ni ofrece controles para jugar.

## Qué no se ha hecho
- No se han borrado proyectos, gastos ni memoria.
- No se han reestructurado cuentas bancarias, notificaciones, Google, Gemini, Spotify ni permisos.
- No se han retirado otras funciones sin que Manu las haya señalado explícitamente como prescindibles.
- No se ha implantado un panel de nuevas métricas; es una oportunidad de producto posterior, usando **datos reales** y evitando rachas punitivas.

## Criterio de simplificación futura
1. Una función merece presencia principal si ayuda a decidir o actuar en el día, al menos de forma recurrente.
2. Si duplica otra, se fusiona.
3. Si exige registrar todo manualmente para funcionar, se prioriza la automatización o se mantiene secundaria.
4. La IA propone y explica; el usuario confirma. Nada de rachas que castiguen descansos ni de datos inventados.
5. Antes de retirar otra capacidad, auditar su uso y dependencias. Preservar datos y un camino de exportación.

## Verificación
- `web/tests/fable-icons.test.js`: contrato de seis pestañas actualizado.
- `e2e/horizonte.e2e.mjs`: navegación y anchos con Agenda en vez de Bahía.
- `e2e/bahia.e2e.mjs`: convertido en prueba de retiro: sesión antigua, ausencia de canvas, acceso a Agenda y preservación del guardado antiguo.
- `web/sw.js`: v110 para renovar recursos offline.
- CI remoto y Safari real: pendientes de ejecución/verificación.
