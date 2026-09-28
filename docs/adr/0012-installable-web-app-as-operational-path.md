# ADR-0012 — App web instalable como vía operativa mientras la nativa no se puede instalar

Status: **ACCEPTED** (decisión de Manu, 2026-09-28)
Date: **2026-09-28**
Modifica: **D-01** (se añade un componente web a la Beta) y **ADR-0007** (la app nativa sigue siendo el objetivo, pero no la única vía de uso)

## Contexto

La app nativa de iPhone compila en el simulador de GitHub Actions, pero Manu no puede instalarla en su iPhone 14:

- su Mac (Intel, Core i5 de doble núcleo) no puede instalar el Xcode necesario, según Manu;
- sin Mac con Xcode, la única vía para instalar una app nativa es firmarla en CI y distribuirla por TestFlight, lo que exige el Apple Developer Program (de pago). Esta ruta es `TEÓRICAMENTE_POSIBLE` y no está verificada;
- Manu quiere 0 € de coste (ADR-0004) y ha rechazado pagar.

Un runner de CI no instala nada en un teléfono físico (QAL-007). Sin otra vía, MANU OS no se podría usar.

## Decisión

1. MANU OS tiene una **app web instalable** en `web/`, que se añade a la pantalla de inicio desde Safari. Es la vía de uso diario mientras la app nativa no se pueda instalar.
2. Es **local-first**: los datos se guardan solo en el dispositivo (`localStorage` detrás del adaptador `LocalStore`), funciona sin conexión mediante un *service worker* y no hace ninguna llamada de red a terceros. La CSP solo permite recursos del propio origen.
3. Funciona **sin IA** (ADR-0009). Su lógica replica la del núcleo Swift de `brain/02d-app-core` (intenciones, modos, dinero, bandeja, Refugio) y la cubren tests propios (`web/tests`).
4. El Refugio y los mensajes de ánimo o de crisis **no se guardan**. La respuesta de crisis (112, 024) siempre gana.
5. Se publica con **GitHub Pages** desde `main` mediante `.github/workflows/web.yml`. Manu acepta que el repositorio sea público para usar Pages sin coste. El repositorio sigue sin contener datos personales reales ni secretos.
6. Los **avisos programados** necesitan un servidor de *push* con claves VAPID. Queda fuera de esta decisión: exige un ADR propio con servicio, límites de cuota, barrera de gasto (ADR-0004) y claves fuera de Git. Esta versión solo pide permiso de avisos y muestra un aviso de prueba.
7. El código Swift y la app nativa **se conservan**. Si en el futuro hay forma de instalarla (otro Mac, o pagar el programa), se retoma sin rehacer el núcleo.

## Consecuencias

- Hasta que exista un núcleo compartido, la lógica está **duplicada** en Swift y JavaScript. Todo cambio de comportamiento debe hacerse en ambos lados, con un test en cada uno.
- Una web no puede ofrecer widgets, pantalla bloqueada, Live Activities, App Intents/Siri, controles del Centro de Control, ni acceso a Salud, Calendario, Recordatorios o Contactos de Apple. Esas funciones siguen dependiendo de la app nativa.
- `NO_VERIFICADO`: que iOS conserve el `localStorage` de una web añadida a la pantalla de inicio sin borrarlo por su cuenta. Por eso la app ofrece exportar y restaurar una copia en JSON.
- `TEÓRICAMENTE_POSIBLE`: avisos web en iPhone con iOS 16.4 o posterior, solo desde la web añadida a la pantalla de inicio. No se ha probado en el iPhone de Manu.
- Con el repositorio público, cualquiera puede leer el código, los documentos y el historial, y abrir la web (vacía: los datos de Manu nunca están en el servidor).

## Alternativas rechazadas

- **Pagar el Apple Developer Program**: Manu lo rechaza (0 €).
- **GitHub Pages desde repositorio privado**: requiere un plan de pago de GitHub, hasta donde se sabe (verificar en la documentación de GitHub).
- **Maqueta privada en claude.ai**: sirve para anotar cambios, pero no guarda datos de uso y depende de la cuenta de Claude.
