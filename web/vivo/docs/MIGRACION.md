# Migración por fases

Regla: **ninguna fase toca datos**. El vault, la memoria, los proyectos, Bahía, las sesiones, Tu nube, los
conectores y las funciones de Supabase no cambian de forma. Cada fase es un PR pequeño con sus pruebas y se
puede deshacer sin perder nada.

| Fase | Qué entra | Riesgo | Vuelta atrás |
|---|---|---|---|
| 0 | Este prototipo en `web/vivo/`, aparte | Ninguno para la app | Borrar la carpeta |
| 1 | Tokens, Fraunces y `cielo.js` en la app real, como tema opcional («Horizonte») en Tú | Bajo: solo CSS | Apagar el tema |
| 2 | Portada de Hoy con datos reales (`portada` + tiempo de `weather.js`) y el dial | Bajo: solo lectura | Volver al Hoy actual |
| 3 | Dinero: mareógrafo, hallazgos con sello y «una noche en pagos», sobre los movimientos ya importados | Bajo: solo lectura. La importación y su confirmación no se tocan | Ocultar las tarjetas |
| 4 | Memoria: constelación y retrato en prosa, usando `brain.js` para confirmar, corregir y olvidar | Medio: escribe memoria (con las funciones que ya existen) | Volver a la lista de Memoria |
| 5 | MANU: cara, sellos de certeza y zasca con pruebas en el chat real | Medio: cambia la presentación de respuestas de la IA | Volver a las burbujas |
| 6 | Astillero: campos nuevos opcionales en proyectos (`area`, `tareas`, `ideas`, `botado`) y botadura | Medio: amplía el esquema (sin migración: son opcionales). Hay que revisar que Tu nube los sincroniza | Ignorar los campos |
| 7 | Bahía: el cielo compartido y los barcos botados dentro del juego real | Medio: toca el juego existente | Quitar la capa |
| 8 | Navegación nueva (dique) y service worker | Alto: cambia toda la app | Etiqueta de versión anterior |

Antes de la fase 1 hace falta que elijas: ¿Horizonte sustituye al diseño azul actual o conviven como temas?
