# 01 — Product Charter

> Revisado el 2026-09-28 por [ADR-0007](../adr/0007-native-iphone-first.md): la experiencia nativa de iPhone pasa a ser prioritaria. Los cambios respecto a la versión BRAIN-00 están en «Historial de cambios», al final del documento.

## Propósito

MANU OS es una **capa visual y operativa sobre el iPhone** y la interfaz cotidiana de una infraestructura personal. Adapta el teléfono a los momentos del día de Manu y le da acceso rápido a lo que necesita en cada uno, desde la app y desde las superficies del sistema (widgets, pantalla bloqueada, Centro de Control, botón de acción, Live Activities y Atajos).

MANU BRAIN, su núcleo, conserva fuentes, contexto y conocimiento estructurado para que Manu pueda capturar información con poca fricción, recuperar por qué sabe algo, entender cambios en el tiempo y conectar sus herramientas sin entregar el núcleo a un proveedor de IA.

No pretende simular conciencia ni hablar como si fuera Manu. MIRROR responde sobre el corpus de Manu y debe separar siempre hechos, preferencias, decisiones, memorias, inferencias e hipótesis.

## Promesa de producto

> Capturo algo una vez; MANU BRAIN conserva el original, entiende de dónde salió, lo relaciona sin inventar y me lo devuelve cuando realmente es útil.

> Mi iPhone me muestra lo que importa en cada momento del día, y lo cambio yo, no un sistema que decide por mí.

## Usuarios y dispositivo

- Usuario inicial: una sola persona, Manu.
- Dispositivo principal: iPhone.
- Segundo dispositivo: Mac.
- Interfaz principal: **app nativa de iPhone (Swift/SwiftUI)**, con extensiones del sistema desde las primeras fases. La app principal es el cerebro y centro de configuración.
- Componente web/local-first: opcional, como cerebro compartido, panel o compañero para Mac, si resulta útil. No bloquea ni pospone la experiencia nativa. Queda por definir en **D-01** (ver `docs/architecture/DECISIONS_AND_OPEN_ITEMS.md`).

## Modos

Un modo es un conjunto de información, accesos, pantallas y comportamiento de MANU OS asociado a un momento. Modos iniciales:

- **Mañana**
- **Trabajo** (inicialmente de 9:00 a 13:00)
- **Fuera del trabajo**
- **Fin de semana**

Reglas:

- Un modo cambia lo que muestran la app y sus extensiones. iOS no permite sustituir el launcher ni modificar globalmente el sistema, y MANU OS no lo intentará.
- Cuando un modo requiere un cambio del sistema (por ejemplo silenciar apps o contactos laborales), se apoya en los Focus de iOS configurados por Manu. MANU OS puede reaccionar al Focus activo y guiar la configuración, pero Manu controla qué contactos y apps lo atraviesan.
- El cambio de modo es visible y reversible; nunca oculta información sin que Manu pueda recuperarla.

## Casos de uso descubiertos

Registrados el 2026-09-28. Ninguno está implementado ni verificado; su viabilidad técnica se detalla en `docs/integrations/INTEGRATIONS.md`.

| Caso | Descripción | Observaciones |
| --- | --- | --- |
| Mañana | alarma, previsión de Gijón u Oviedo y acceso para iniciar música en el baño | las alarmas, el tiempo y la música dependen de APIs y permisos a verificar |
| Trabajo (9:00–13:00) | calendario, captura rápida, llamadas grabadas con consentimiento, transcripciones, resúmenes y tareas | grabar llamadas tiene límites técnicos en iOS y requisitos legales; ver riesgos R-18 y R-19 |
| Fuera del trabajo | silenciar herramientas y contactos laborales, manteniendo excepciones concretas | depende del Focus de iOS configurado por Manu |
| Finanzas | importar capturas o extractos bancarios, extraer movimientos con confirmación y generar insights | Open Banking solo como estudio posterior; ver gate G-07 y riesgo R-17 |
| Captura universal | ideas, notas, audios, fotos y eventos | entrada principal: app, widget, App Intent, botón de acción y Share Sheet |
| Integraciones progresivas | conectar las apps y servicios que Manu use de verdad | una a una, con permiso mínimo y valor demostrado |

## Principios no negociables

- **Fuente antes que conclusión**: toda afirmación derivada apunta a evidencia.
- **Local-first**: capturar y consultar lo esencial no depende de la red.
- **Proveedor sustituible**: IA, hosting, almacenamiento y sync entran mediante adaptadores. MANU OS no depende de ChatGPT, Claude ni Gemini.
- **Privacidad por defecto**: mínimo privilegio, permisos incrementales pedidos en el momento de uso y cifrado del contenido antes de subirlo.
- **Aprobación antes de escrituras sensibles**: ninguna acción externa, comunicativa, financiera o destructiva sin confirmación explícita.
- **Temporalidad real**: una afirmación puede quedar sustituida sin borrar su historia.
- **Portabilidad completa**: exportación legible y documentada, más copia de fuentes originales.
- **Coste 0 € como modo operativo**: si se agota una cuota, el servicio se degrada; no factura automáticamente. Una suscripción explícita (como Apple Developer Program) solo con decisión de Manu (D-03).
- **Complejidad detrás**: la pantalla diaria no muestra el modelo de datos ni un dashboard empresarial.
- **No automatizar sin evidencia**: una integración o QA no se declara funcional hasta probarse.
- **Superficies discretas**: widgets, pantalla bloqueada y Live Activities no muestran contenido sensible sin que Manu lo haya permitido.

## Capacidades del MVP

El MVP queda definido por un recorrido completo y recuperable:

1. Instalar la app nativa de MANU OS en el iPhone de Manu. El acceso desde Mac depende de D-01.
2. Capturar texto, enlace, audio y archivo/foto seleccionado manualmente, desde la app y al menos desde una superficie del sistema (widget, App Intent o botón de acción).
3. Conservar el original, fecha, autor, origen y hash.
4. Revisar una Inbox de capturas pendientes sin exigir clasificación inmediata.
5. Crear o confirmar entidades, afirmaciones y relaciones con su evidencia.
6. Buscar por texto, tipo, fecha, persona, proyecto y estado actual/histórico.
7. Ver por qué dos elementos están relacionados.
8. Marcar una afirmación como sustituida por otra sin destruir el historial.
9. Cambiar entre al menos dos modos y ver cómo cambian la app y un widget.
10. Funcionar offline; sincronizar al recuperar conectividad y abrir la app.
11. Exportar y restaurar un paquete completo y abierto.
12. Importar un ZIP de ChatGPT y una exportación de Claude conservando el contenido bruto.

HOME en el MVP será una vista de contexto muy limitada: modo activo, ahora, Inbox y proyectos activos. MIND será una vista navegable con filtros y cadenas de evidencia, no un lienzo infinito. MIRROR empezará como recuperación con citas; la generación con IA será opcional y posterior.

## Métricas de éxito del MVP

- Una captura de texto tarda menos de 10 segundos desde un widget, el botón de acción o la pantalla de inicio.
- Ninguna captura confirmada se pierde tras cerrar la app o estar offline.
- El 100 % de afirmaciones derivadas tiene al menos una evidencia o queda explícitamente como hipótesis sin validar.
- Un export nuevo se restaura en una instalación limpia y conserva hashes y recuentos.
- La app sigue siendo útil con todas las integraciones e IA desconectadas.
- Una consulta de «¿por qué?» muestra la cadena fuente → fragmento → afirmación → relación.
- Ninguna superficie visible con el iPhone bloqueado muestra contenido marcado como sensible.

## No se construye todavía

- Clon conversacional de Manu o generación automática en su nombre.
- Lectura automática de Mensajes, WhatsApp, Apple Notes o Screen Time.
- Grafo 3D, animaciones complejas o miles de conexiones simultáneas.
- Neo4j, microservicios, Kafka, colas distribuidas o Kubernetes.
- Vector database o embeddings obligatorios.
- Publicación en App Store. (La app nativa sí se construye; Apple Developer Program queda pendiente de D-03.)
- Agentes con permisos de escritura autónoma sobre correo, calendario o archivos.
- Procesamiento masivo de toda la fototeca.
- Integración de salud o ubicación continua.
- Automatizaciones que publiquen, envíen mensajes, muevan dinero o borren datos sin confirmación.
- Conexión directa con bancos u Open Banking.
- Grabación de llamadas sin consentimiento de todos los participantes.
- Entrenar un modelo con el corpus personal.

## Límites honestos

- iOS no permite sustituir el launcher ni cambiar globalmente el comportamiento del sistema; los modos actúan sobre MANU OS y se apoyan en Focus y Atajos para lo demás.
- Las extensiones (widgets, Live Activities, controles) tienen presupuestos de actualización y memoria limitados por el sistema; no son pantallas en tiempo real.
- iOS puede interrumpir procesos; la sincronización no dependerá de tareas en segundo plano.
- Cada permiso (calendario, micrófono, fotos, voz, ubicación) lo concede Manu y puede retirarlo; la app debe seguir funcionando sin él.
- Grabar llamadas telefónicas desde una app de terceros tiene fuertes límites técnicos en iOS; la grabación y transcripción de llamadas queda como `NO_VERIFICADO` hasta estudiar rutas reales y requisitos legales.
- Una PWA no puede acceder a las bases privadas de la mayoría de apps de Apple ni a las superficies del sistema.
- El almacenamiento local no es la única copia: exportación y backup son obligatorios.
- Google Workspace exige OAuth, scopes mínimos y, para determinados scopes, verificación.
- «Todo conectado» es una dirección estratégica, no una capacidad del primer lanzamiento.

## Historial de cambios

| Fecha | Cambio | Motivo |
| --- | --- | --- |
| 2026-09-28 | Versión BRAIN-00: PWA instalable como interfaz V1; companion nativo «futuro» si las integraciones lo justifican; App Store, Apple Developer Program y app nativa fuera del MVP. | ADR-0001 |
| 2026-09-28 | App nativa de iPhone como interfaz principal desde las primeras fases; modos; casos de uso descubiertos; componente web opcional (D-01); la app nativa entra en el MVP; Apple Developer Program pasa a decisión pendiente (D-03). | ADR-0007 |
