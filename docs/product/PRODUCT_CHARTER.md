# 01 — Product Charter

## Propósito

MANU OS es la interfaz cotidiana de una infraestructura personal. MANU BRAIN conserva fuentes, contexto y conocimiento estructurado para que Manu pueda capturar información con poca fricción, recuperar por qué sabe algo, entender cambios en el tiempo y conectar sus herramientas sin entregar el núcleo a un proveedor de IA.

No pretende simular conciencia ni hablar como si fuera Manu. MIRROR responde sobre el corpus de Manu y debe separar siempre hechos, preferencias, decisiones, memorias, inferencias e hipótesis.

## Promesa de producto

> Capturo algo una vez; MANU BRAIN conserva el original, entiende de dónde salió, lo relaciona sin inventar y me lo devuelve cuando realmente es útil.

## Usuarios y dispositivo

- Usuario inicial: una sola persona, Manu.
- Dispositivo principal: iPhone.
- Segundo dispositivo: Mac.
- Interfaz V1: PWA instalable, responsive y accesible.
- Futuro: companion nativo iOS/macOS, solo si las integraciones justifican su coste y mantenimiento.

## Principios no negociables

- **Fuente antes que conclusión**: toda afirmación derivada apunta a evidencia.
- **Local-first**: capturar y consultar lo esencial no depende de la red.
- **Proveedor sustituible**: IA, hosting, almacenamiento y sync entran mediante adaptadores.
- **Privacidad por defecto**: mínimo privilegio, permisos incrementales y cifrado del contenido antes de subirlo.
- **Temporalidad real**: una afirmación puede quedar sustituida sin borrar su historia.
- **Portabilidad completa**: exportación legible y documentada, más copia de fuentes originales.
- **Coste 0 € como modo operativo**: si se agota una cuota, el servicio se degrada; no factura automáticamente.
- **Complejidad detrás**: la pantalla diaria no muestra el modelo de datos ni un dashboard empresarial.
- **No automatizar sin evidencia**: una integración o QA no se declara funcional hasta probarse.

## Capacidades del MVP

El MVP queda definido por un recorrido completo y recuperable:

1. Instalar MANU OS en iPhone y Mac.
2. Capturar texto, enlace y archivo/foto seleccionado manualmente.
3. Conservar el original, fecha, autor, origen y hash.
4. Revisar una Inbox de capturas pendientes sin exigir clasificación inmediata.
5. Crear o confirmar entidades, afirmaciones y relaciones con su evidencia.
6. Buscar por texto, tipo, fecha, persona, proyecto y estado actual/histórico.
7. Ver por qué dos elementos están relacionados.
8. Marcar una afirmación como sustituida por otra sin destruir el historial.
9. Funcionar offline; sincronizar al recuperar conectividad y abrir la app.
10. Exportar y restaurar un paquete completo y abierto.
11. Importar un ZIP de ChatGPT y una exportación de Claude conservando el contenido bruto.

HOME en el MVP será una vista de contexto muy limitada: ahora, Inbox y proyectos activos. MIND será una vista navegable con filtros y cadenas de evidencia, no un lienzo infinito. MIRROR empezará como recuperación con citas; la generación con IA será opcional y posterior.

## Métricas de éxito del MVP

- Una captura de texto tarda menos de 10 segundos desde la Home Screen.
- Ninguna captura confirmada se pierde tras cerrar la PWA o estar offline.
- El 100 % de afirmaciones derivadas tiene al menos una evidencia o queda explícitamente como hipótesis sin validar.
- Un export nuevo se restaura en una instalación limpia y conserva hashes y recuentos.
- La app sigue siendo útil con todas las integraciones e IA desconectadas.
- Una consulta de «¿por qué?» muestra la cadena fuente → fragmento → afirmación → relación.

## No se construye todavía

- Clon conversacional de Manu o generación automática en su nombre.
- Lectura automática de Mensajes, WhatsApp, Apple Notes o Screen Time.
- Grafo 3D, animaciones complejas o miles de conexiones simultáneas.
- Neo4j, microservicios, Kafka, colas distribuidas o Kubernetes.
- Vector database o embeddings obligatorios.
- App Store, Apple Developer Program o app nativa.
- Agentes con permisos de escritura autónoma sobre correo, calendario o archivos.
- Procesamiento masivo de toda la fototeca.
- Integración de salud o ubicación continua.
- Automatizaciones que publiquen, envíen mensajes o borren datos sin confirmación.
- Entrenar un modelo con el corpus personal.

## Límites honestos

- Una PWA no puede acceder a las bases privadas de la mayoría de apps de Apple.
- iOS puede interrumpir procesos; la sincronización no dependerá de tareas en segundo plano.
- El almacenamiento web local no es la única copia: exportación y backup son obligatorios.
- Google Workspace exige OAuth, scopes mínimos y, para determinados scopes, verificación.
- «Todo conectado» es una dirección estratégica, no una capacidad del primer lanzamiento.
