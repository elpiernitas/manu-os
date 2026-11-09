# Informe WEB-97 · MANU OS e iOS: Centro de permisos y conexiones

**Resumen:** he auditado qué puede usar MANU de tu iPhone y por qué vía, comprobándolo en fuentes públicas en vez de afirmarlo de memoria. Ahora en **Tú → Permisos y conexiones** ves cada cosa que MANU usa (o podría usar):
- para qué sirve;
- qué sale del móvil;
- su estado real en tu dispositivo;
- dónde quitarlo.

Hay tres funciones nuevas que la web sí permite: guardar tus datos sin que iOS los borre, el tiempo de donde estás y el número en el icono. No se pide nada que no tenga una función concreta.

---

## 1. La auditoría en una tabla

Detalle y fuentes en `docs/integrations/IOS_CAPABILITIES.md`.

| Vía | Qué cubre hoy | Estado |
|---|---|---|
| **Ya en la web** | Avisos con MANU abierta, fotos (solo las que eliges), voz, compartir. **Nuevo:** almacenamiento persistente, ubicación puntual y globo del icono | Funciona en el navegador de pruebas; en tu iPhone, NO_VERIFICADO |
| **Con Atajos** | Salud (pasos, sueño, peso), ciudad, llegar o salir del trabajo, Apple Pay, alarmas, recordatorios, calendario del iPhone, Siri | Ya existía. MANU no puede ver si creaste el atajo: el estado es «Lo marcas tú» |
| **Servicio externo** | Google, Gemini, Spotify, Tu nube, Open-Meteo | Estado leído de tus ajustes de MANU |
| **Solo con app nativa** | HealthKit, Calendario y Recordatorios directos, Contactos de iCloud, Casa (HomeKit), Bluetooth, red local, widgets, Siri nativo, segundo plano | Imposible desde la web. La app nativa está en pausa |
| **iOS no lo permite / MANU no lo hará** | Leer o mandar mensajes, ver otras apps, rastreo publicitario (ATT) | Nunca |

**No he pedido** sensores de movimiento, micrófono web, Contact Picker, Bluetooth web ni Wake Lock. Ninguna función de MANU los necesita, o Safari no los ofrece. Pedirlos sería un permiso decorativo.

**Avisos con MANU cerrada:**
- iOS los permite en apps de la pantalla de inicio (TEÓRICAMENTE_POSIBLE), pero hace falta un servidor que los mande.
- No lo he montado: sería conectar un servicio nuevo.
- Hoy los cubren los atajos.

## 2. Decisiones

| Decisión | Por qué |
|---|---|
| **El estado se lee, no se supone** | `probe()` lee el navegador sin mostrar ningún aviso de iOS. Si no se puede saber, dice «No se puede saber». |
| **Botones solo donde la web actúa de verdad** | Las entradas nativas y las prohibidas no tienen botón. Hay una prueba que lo comprueba. |
| **Ubicación mínima** | Una vez, cuando la tocas, sin alta precisión. Se redondea a 0,1° (unos 10 km) antes de usarla y de guardarla. Es solo para el tiempo de hoy. Para saber dónde has estado está el atajo «MANU Lugar» (solo la ciudad). |
| **El globo es opcional y discreto** | Viene desactivado. Muestra solo el número de recordatorios de hoy o atrasados, nunca su texto. iOS lo une al permiso de avisos, así que lo pide primero. |
| **ATT ≠ aprendizaje** | El rastreo publicitario es seguirte fuera de MANU para anuncios: no se usa nunca. Lo que MANU aprende dentro de MANU se queda en tu dispositivo y lo controlas en Memoria. |
| **MANU solo habla contigo** | Ninguna entrada escribe, llama ni manda nada a otras personas. Compartir lo haces tú con la hoja de iOS. |

## 3. Qué puedes probar

Cuando se fusione, desde el icono de MANU en el iPhone:
1. **Tú → Permisos y conexiones.** Mira los cuatro grupos y abre «Detalles» en cualquiera.
2. **«Guardar sin que se borre» → Pedir.** Debería pasar a «Activo» si iOS lo concede.
3. **«Número en el icono» → Activar.** Te pide avisos; luego el icono muestra los recordatorios de hoy.
4. **«Ubicación puntual» → Tiempo aquí.** iOS te pregunta y Hoy muestra el tiempo de «Donde estás».

## 4. Pruebas

| Comando | Resultado |
|---|---|
| `npm test` (en `web/`) | **323 de 323**, 10 nuevas en `tests/capacidades.test.js` |
| `node --check` de `app.js`, `sw.js` y `core/*.js` | OK |
| `node e2e/permisos.e2e.mjs` (Chromium con emulación de iPhone 14) | **18 de 18** |
| `node e2e/memoria.e2e.mjs` y `node e2e/estilo.e2e.mjs` | Sin regresión |

La e2e comprueba, entre otras cosas:
- que leer el estado no pide nada;
- que el globo no aparece hasta que lo activas y se borra al quitarlo;
- que a Open-Meteo y al almacenamiento solo llegan coordenadas redondeadas;
- que nada nativo ni prohibido tiene botón.

Chromium sin interfaz siempre dice «denied» a los avisos, así que en la prueba ese aviso de iOS está simulado y comentado (lección QAL-050).

## 5. NO_VERIFICADO

- **Nada probado en Safari ni en tu iPhone.** Lo que dicen las fuentes sobre iOS es TEÓRICAMENTE_POSIBLE.
- La Permissions API de Safari puede decir «Sin pedir» para la ubicación aunque ya la hayas concedido.
- Las rutas de Ajustes de iOS pueden llamarse distinto en tu versión.
- El Contact Picker y el Wake Lock pueden haber cambiado en 2026: las fuentes encontradas son de 2023 a 2025.

## 6. Qué necesito de ti

1. Probar los cuatro pasos del punto 3 en el iPhone y decirme qué estado te sale.
2. **Avisos con MANU cerrada:** ¿quieres que estudie un servidor gratuito para avisos push (por ejemplo, una función de tu Supabase)? Sería conectar un servicio, así que no lo hago sin tu sí.
3. Siguen pendientes: memoria y estilo en Tu nube, sí o no; las luces del modo amanecer (WEB-96); y el banco (WEB-93).

## 7. Rama

Rama `claude/magical-goodall-rf5qoo`, reiniciada desde `main` (`71ce710`, con WEB-95 fusionada). Sin servicios nuevos, sin datos reales, sin compras y sin fusionar.
