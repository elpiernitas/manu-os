# 01 — Product Charter

> Revisado el 2026-09-28 dos veces: por [ADR-0007](../adr/0007-native-iphone-first.md) (experiencia nativa prioritaria) y por las decisiones de producto de Manu del mismo día, que añaden [ADR-0008](../adr/0008-source-retention-and-controlled-deletion.md), [ADR-0009](../adr/0009-manu-assistant-without-mandatory-ai.md) y `docs/product/EXPERIENCE.md`. Los cambios están en «Historial de cambios», al final.

## Propósito

MANU OS es una **capa personal sobre el iPhone y el Mac de Manu**. Su experiencia empieza en la pantalla bloqueada, los widgets, el Centro de Control, los modos y las automatizaciones. La aplicación principal es la cabeza del sistema: memoria, organización, consulta, configuración y chat personal (MANU).

MANU OS convierte la actividad cotidiana dispersa (capturas, mensajes compartidos, enlaces, audios, calendario, gastos, salud, archivos e ideas) en **memoria organizada y siguientes pasos útiles**. El sistema se organiza alrededor de Manu; Manu no mantiene la app organizada a mano.

MANU BRAIN, su núcleo, conserva fuentes o su procedencia, contexto y conocimiento estructurado para que Manu pueda capturar con poca fricción, recuperar por qué sabe algo, entender cambios en el tiempo y conectar sus herramientas sin entregar el núcleo a un proveedor de IA.

MANU no simula conciencia ni habla como si fuera Manu. Separa siempre hechos, preferencias, decisiones, memorias, inferencias e hipótesis.

El detalle funcional (navegación, rutinas, bandeja de capturas, proyectos, personas, salud, Refugio, finanzas, Laboratorio) está en [`EXPERIENCE.md`](EXPERIENCE.md).

## Promesa de producto

> Capturo algo una vez; MANU BRAIN entiende de dónde salió, lo relaciona sin inventar, me pregunta lo necesario y me lo devuelve cuando realmente es útil.

> Mi iPhone me muestra lo que importa en cada momento del día, y lo cambio yo, no un sistema que decide por mí.

## Usuarios y dispositivos

- Usuario: una sola persona, Manu.
- Dispositivos actuales: **iPhone 14**, **Mac Intel** (Intel Core i5 de doble núcleo a 3,1 GHz), AirPods y un Chromecast en el baño.
- Interfaz principal: **app nativa de iPhone (Swift/SwiftUI)** con extensiones del sistema.
- **App de Mac** con las mismas capacidades que la de iPhone. Tecnología pendiente de D-01 (recomendación: SwiftUI nativa).
- Componente web: solo si D-01 lo mantiene.

## Entrega: primera beta integrada

Manu prefiere recibir **una primera beta completa y coherente** en lugar de instalar prototipos parciales cada semana. El desarrollo se divide internamente en fases con gates y QA progresiva, pero Manu prueba cuando existe un recorrido integrado suficientemente completo. `MVP_ACCEPTANCE.md` distingue el **MVP técnico interno** de la **Beta 1** que recibe Manu.

## Modos y rutinas

Un modo es un conjunto de información, accesos y comportamiento de MANU OS asociado a un momento. Momentos definidos por Manu: noche, mañana, trabajo (lunes a viernes, 09:00–13:00), desconexión laboral (desde las 13:00), tarde y fin de semana.

Reglas:

- Un modo cambia contenido, accesos y comportamiento. **No cambia colores, fondos ni widgets**: la apariencia es estable todo el día.
- iOS no permite sustituir el launcher ni modificar globalmente el sistema, y MANU OS no lo intentará.
- Silenciar apps o contactos se apoya en los Focus de iOS configurados por Manu. MANU OS puede reaccionar al Focus activo y guiar su configuración.
- El cambio de modo es visible y reversible.

## Principios no negociables

- **Fuente antes que conclusión**: toda afirmación derivada apunta a evidencia.
- **Procedencia honesta**: MANU OS conserva el original cuando la política de retención lo dice y, si no, conserva la procedencia y nunca afirma tener un original que se ha descartado (ADR-0008).
- **Confirmar la clasificación**: toda clasificación de una captura nueva se confirma. En finanzas, la categoría se asigna automáticamente como inferencia corregible.
- **Local-first**: capturar y consultar lo esencial no depende de la red.
- **Funciona sin IA**: organización, memoria, búsqueda y automatizaciones funcionan sin ningún modelo (ADR-0009).
- **Proveedor sustituible**: IA, hosting, almacenamiento y sync entran mediante adaptadores. MANU OS no depende de ChatGPT, Claude ni Gemini.
- **Privacidad por diseño**: mínimo privilegio, permisos pedidos en el momento de uso, cifrado del contenido antes de subirlo y datos sensibles etiquetados. *Excepción decidida por Manu (2026-09-30, enmienda WEB-67 de [ADR-0017](../adr/0017-supabase-sync.md)): Tu nube guarda el vault sin cifrar, protegido por RLS y por su sesión; Supabase técnicamente puede leerlo. Las copias completas siguen cifradas por defecto.*
- **Aprobación antes de consecuencias**: acciones pequeñas y rutinas previamente autorizadas pueden ser automáticas; toda acción con consecuencias se prepara y se confirma. Ningún mensaje se envía automáticamente fuera de una lista blanca explícita.
- **Temporalidad real**: una afirmación puede quedar sustituida sin borrar su historia.
- **Portabilidad**: exportación legible y documentada, con procedencia y eventos de eliminación.
- **Coste 0 € adicional**: si se agota una cuota, el servicio se degrada; no factura automáticamente. Cualquier suscripción nueva (Apple Developer Program, API de modelos) requiere decisión explícita de Manu.
- **La interfaz es criterio de permanencia**: si es lenta o no le gusta, Manu deja de usarla.
- **Superficies discretas**: widgets, pantalla bloqueada y Live Activities no muestran contenido sensible.
- **No automatizar sin evidencia**: una integración no se declara funcional hasta probarse.

## Identidad y navegación

Modo oscuro por defecto; negro, blanco y azul eléctrico; tipografía del sistema. Menú inferior de cinco pestañas: **Hoy, Agenda, MANU (central), Dinero y Tú**. Laboratorio y Ajustes quedan fuera del menú principal. Valores y detalle en `EXPERIENCE.md`.

## Qué incluye la Beta 1

Definido y verificable en `MVP_ACCEPTANCE.md`. Resumen: núcleo con evidencia y búsqueda, app de iPhone con las cinco pestañas, superficies del sistema viables en iPhone 14, modos y rutinas de noche, mañana y trabajo, captura universal, bandeja diaria de capturas, chat MANU en nivel base, proyectos, personas, Laboratorio, sincronización cifrada y copia semanal en el Mac, y restauración probada. Finanzas, salud y Refugio entran solo si superan sus gates; si no, se entregan en betas posteriores.

## No se construye todavía

- Clon conversacional de Manu o mensajes enviados en su nombre fuera de la lista blanca.
- Lectura automática de Mensajes, WhatsApp, Apple Notes, Screen Time o notificaciones de otras apps.
- Grafo 3D, animaciones complejas o miles de conexiones simultáneas.
- Neo4j, microservicios, Kafka, colas distribuidas o Kubernetes.
- Vector database o embeddings obligatorios.
- Publicación en App Store. Apple Developer Program queda pendiente de D-03.
- Agentes con escritura autónoma sobre correo, calendario o archivos.
- Procesamiento de toda la fototeca: la bandeja diaria procesa **capturas de pantalla** nuevas, no el resto de fotos.
- Ubicación continua salvo para detectar la llegada a casa, si Manu lo autoriza (D-09).
- Automatizaciones que publiquen, envíen mensajes, muevan dinero o borren datos sin confirmación.
- Conexión directa con bancos u Open Banking.
- Grabación de llamadas sin consentimiento de todos los participantes.
- Armario digital, catálogo de prendas o recomendaciones de conjuntos.
- Dieta, calorías o recomendaciones nutricionales.
- Diagnósticos psicológicos o terapia.
- Entrenar un modelo con el corpus personal.

## Límites honestos

- El **iPhone 14 no tiene botón de acción**; el acceso rápido a MANU usa Centro de Control y pantalla bloqueada.
- **Apple Intelligence no está disponible** en el iPhone 14 ni en el Mac Intel de Manu.
- Las suscripciones ChatGPT Plus, Claude Pro y Gemini Pro son de consumo: no dan acceso por API a una app propia. Sin un proveedor de modelo decidido, el chat MANU funciona en su nivel base (ADR-0009).
- iOS no permite sustituir el launcher ni cambiar globalmente el sistema.
- MANU OS no puede leer mensajes de WhatsApp o iMessage ni las notificaciones de otras apps.
- Las extensiones tienen presupuestos de actualización y memoria; no son pantallas en tiempo real.
- iOS puede interrumpir procesos; la sincronización no depende de tareas en segundo plano.
- Cada permiso lo concede Manu y puede retirarlo; la app sigue funcionando sin él.
- Spotify DJ no tiene una ruta de automatización documentada; la Web API de Spotify exige Premium y no menciona DJ.
- Grabar llamadas desde una app de terceros tiene fuertes límites técnicos y requisitos legales (`NO_VERIFICADO`).
- Con el Mac actual, compilar la app con las herramientas vigentes de Apple probablemente no es posible (D-04).
- «Todo conectado» es una dirección estratégica: cada integración entra por su ruta real (API, Share Sheet, importación, Atajos o enlace profundo).

## Historial de cambios

| Fecha | Cambio | Motivo |
| --- | --- | --- |
| 2026-09-28 | Versión BRAIN-00: PWA instalable como interfaz V1; companion nativo «futuro»; App Store, Apple Developer Program y app nativa fuera del MVP. | ADR-0001 |
| 2026-09-28 | App nativa de iPhone como interfaz principal; modos; casos de uso descubiertos; componente web opcional (D-01); Apple Developer Program a decisión (D-03). | ADR-0007 |
| 2026-09-28 | Capa sobre iPhone **y Mac**; chat MANU como pestaña central; cinco pestañas; identidad visual; rutinas; bandeja diaria de capturas; retención controlada de fuentes; asistente sin IA obligatoria; Beta 1 integrada frente a MVP técnico; dispositivos concretos (iPhone 14, Mac Intel); nuevas exclusiones (armario, dieta, terapia). Se sustituye la promesa «MANU BRAIN conserva el original» por «entiende de dónde salió», por ADR-0008. La tabla «Casos de uso descubiertos» de la revisión anterior queda absorbida por `EXPERIENCE.md`. | decisiones de Manu, ADR-0008, ADR-0009 |
