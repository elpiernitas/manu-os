# Auditoría de MANU OS · misión maestra (Claude, 2026-11-22)

Punto de partida: `main` en `3be4fb1` (WEB-118, v118). Contrastada con el código (`web/app.js`, 79 módulos en `web/core/`), 476 pruebas unitarias y 14 suites e2e en verde, y con las pruebas que había en `ai/HANDOFF.md`.

**Etiquetas:**
- **OK**: implementada y verificada con pruebas automáticas (Chromium; no Safari real).
- **PARCIAL**: implementada parcialmente.
- **DEFECTO**: existe pero falla.
- **DISEÑO**: diseñada, aún sin implementar.
- **BLOQUEADA**: depende de servicios o permisos.
- **DUPLICADA**: duplicada o innecesaria.

## 1. Inventario

| Capacidad | Estado al empezar | Notas y lo que se hizo |
|---|---|---|
| Memoria y aprendizaje (`brain`, `learn`, `proposals`, `memchat`) | OK | Corregible, con procedencia y confianza. Sin cambios. |
| Tu cerebro WEB-118 | PARCIAL → OK en servidor | Ver §3. Faltaban las tablas; Manu aplicó la migración el 16-11. |
| Tu nube (`sync`, `cloudprivacy`) | OK (e2e `nube`) | WEB-120: los Momentos no suben. |
| Captura de textos, enlaces y archivos (Guardar en MANU, `share_target`, `?guardar=`) | OK | WEB-120 evita duplicados. |
| Captura de imágenes (bandeja, chat) | OK con IA | Leer el texto de una imagen requiere Gemini, a petición. |
| Agenda y calendarios (Google propio/compartido, pegar, cumpleaños) | OK | Faltaba una vista semanal tipada → WEB-121. |
| Rutinas de trabajo | OK | WEB-122 añade «dejar listo» por la noche. |
| Resumen de Hoy (franjas, «Ahora», control) | OK (e2e `dia`) | WEB-120/121: Conexiones y rato reservado. |
| MANU conversacional | OK sin IA, con Gemini opcional | Distingue IA/no IA y fuentes. Sin cambios de fondo. |
| Dinero 2.0 | OK (e2e `dinero2`) | Ya detecta cargos repetidos y suscripciones (`insights.detectRecurring`). No se duplicó. |
| Proyectos | OK | WEB-120 propone proyecto para una idea repetida. |
| Personas | OK | Usadas en Momentos. |
| Biblioteca | OK | WEB-121: filtro «para leer». WEB-122: limpieza de repetidos. |
| Repasos diario y semanal | OK, solo hacia atrás | WEB-121: «Preparar la semana» rápido o completo, en el mismo Repaso. |
| Notificaciones push con la app cerrada | BLOQUEADA | WEB-99 sin fusionar. Con la app abierta funcionan los avisos. |
| Atajos de iPhone | OK, NO_VERIFICADO en el iPhone | 13 atajos guiados, buzón e `#ir=`. WEB-122 lista los enlaces directos. |
| Permisos y privacidad (centro WEB-97) | OK (e2e `permisos`) | Sin permisos nuevos en esta misión. |
| Copias y recuperación (`backup-manager`) | OK | Incluye IndexedDB: fotos de Momentos y archivos. |
| Bahía | DUPLICADA (retirada en WEB-110) | Sigue retirada; datos conservados. |
| Lista de Tú con 28 entradas | DUPLICADA de facto (difícil de recorrer) | WEB-122: agrupada en «Lo que guardas», «Tu día a día», «Trabajo» y «Ajustes». |
| Apariencia | OK | WEB-119: tema `mp.`. |

No se encontró ninguna capacidad **DEFECTO** reproducible en las suites. El contraste AA de dos iconos (`ico.orange` y `ico.green` con texto blanco, 3,4:1) existe también en los temas anteriores. En `mp.` está corregido; en los demás se deja como estaba.

## 2. Las quince ideas

| # | Idea | Clasificación | Dónde |
|---|---|---|---|
| 01 | Organizar el calendario | **Mejorada** | Agenda → Tu semana, con tipos, choques y semanas cargadas (WEB-121) |
| 02 | Segundo cerebro | **Mejorada** | Repeticiones, fechas como suposición y Conexiones (WEB-120); copia del cerebro (WEB-122) |
| 03 | Rutinas de mañana y noche | **Mejorada** | Mañana: Hoy por franjas (existente). Noche: repaso (existente) + «Dejar listo» (WEB-122) |
| 04 | Revisar finanzas | **Existente** | Dinero 2.0: cargos fijos, suscripciones, presupuestos y tendencias. Los pagos que suelen llegar entran en Preparar la semana |
| 05 | Limpieza digital | **Implementada** | Tú → Limpieza digital, reversible salvo fotos huérfanas, con confirmación (WEB-122) |
| 06 | Aprender a decir que no | **Implementada** | Tiempo reservado, choques y texto para copiar; MANU no envía nada (WEB-121) |
| 07 | Espacio físico | **Implementada (ligera)** | «Dejar listo para mañana» en Rutinas y en Hoy por la noche (WEB-122) |
| 08 | El móvil trabaja para mí | **Existente + mejorada** | Atajos, buzón, `share_target` y `#ir=`; enlaces directos listados (WEB-122). Ver §4 |
| 09 | Documentar mi vida | **Implementada** | Tú → Momentos (WEB-120) |
| 10 | Descansar sin culpa | **Implementada** | Rato reservado: Hoy se calla; sin rachas (WEB-121) |
| 11 | Movimiento | **Existente** | Salud (pasos y sueño por el buzón de Atajos), hábitos sin castigo. Sin cambios: no hacía falta otro sistema |
| 12 | Revisión semanal | **Mejorada** | Preparar la semana, rápido (10 min) o completo, en el Repaso existente (WEB-121) |
| 13 | Hobbies | **Implementada** | Tú → Aficiones y aprender (WEB-121) |
| 14 | Aprender | **Implementada** | La misma pantalla, con recursos de la Biblioteca (WEB-121) |
| 15 | Lectura | **Mejorada** | Biblioteca → «para leer», sin pestaña nueva (WEB-121) |

## 3. Cerebro compartido (WEB-118): lo verificado el 22-11

Pruebas de solo lectura contra `xqsexjpuhvmwkclpnvjo`, que es el proyecto que usa la app (`web/app.js`):

| Comprobación | Resultado |
|---|---|
| Las tablas existen | **VERIFICADO**: `GET /rest/v1/cerebro` y `cerebro_llaves` responden 200 (una tabla inexistente da 404). |
| RLS protege las entradas | **VERIFICADO**: la clave pública lee `[]` en las dos tablas. |
| Nadie escribe desde fuera | **VERIFICADO**: un `INSERT` con la clave pública da `42501 permission denied`. |
| La función rechaza lo que no es suyo | **VERIFICADO**: sin llave, con llave falsa o con JWT falso → 401. `?openapi` → 200. |
| Una llave por agente y revocación | Código y pruebas unitarias. **NO_VERIFICADO** con llaves reales: Manu aún no ha creado ninguna. |
| MANU recupera entradas con su sesión | **NO_VERIFICADO**: necesita la sesión de Manu. |
| Procedencia | Columna `origen` firmada por la llave, no por el cuerpo. Prueba unitaria. |
| Datos, no órdenes | Las entradas van al contexto de Gemini dentro de `<datos>` (`asData`). Prueba unitaria. |
| Archivar | Implementado en la función. **NO_VERIFICADO** en real. |
| Borrar | **No existe**: solo archivar. Añadirlo exige volver a desplegar la función: queda pendiente de autorización. |
| Exportación segura | **Nuevo (WEB-122)**: «Descargar copia» en Tu cerebro, con lo que hay en el dispositivo y sin red. |

No se creó ninguna base ni se tocó la base de producción en esta misión.

## 4. El móvil: PWA, Atajos y app nativa

| Capacidad | PWA (hoy) | Atajos de iOS | Solo app nativa |
|---|---|---|---|
| Abrir MANU en una pantalla concreta | `#ir=tab/sub` | «Abrir URL» con ese enlace | — |
| Compartir texto o enlace a MANU | `share_target` (instalada) | Sí | — |
| Apuntar un gasto con doble toque | — | Toque atrás → Atajo (WEB-86) | — |
| Apple Pay, Salud, ubicación | No | Sí, al buzón (WEB-43) | Directo |
| Accesos al mantener pulsado el icono | No (iOS ignora `manifest.shortcuts`) | — | Sí |
| Widgets y pantalla bloqueada | No | Parcial (atajo en widget de Atajos) | Sí |
| Modos de concentración | No los lee | Automatización «al activar el modo X» → `#ir=` | Focus filters |
| Avisos con la app cerrada | Web Push (iOS 16.4+, instalada) | Recordatorios de iOS | Sí |
| Leer el carrete, otras apps o Safari | **No** | No (solo lo que se comparte) | No (sandbox) |

**TEÓRICAMENTE_POSIBLE** y no probado en el iPhone de Manu: `share_target` en iOS, automatizaciones de Focus y Web Push.

## 5. Lo que queda abierto

- **Aprobaciones de Manu:**
  - visual del tema `mp.` y del avatar provisional;
  - cambiar el icono de la app.
- **El cerebro:**
  - crear llaves y el GPT;
  - acción de borrar en la función (requiere desplegar);
  - conector MCP para claude.ai.
- **Avisos push (WEB-99):** pendientes.
- **Probar en Safari real:** todas las pantallas nuevas.
