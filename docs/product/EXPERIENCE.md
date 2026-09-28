# 09 — Experiencia de producto

> Requisitos comunicados directamente por Manu el 2026-09-28. Este documento describe **qué** debe hacer MANU OS. La viabilidad técnica de cada pieza se indica con las etiquetas de `AGENTS.md`, y el detalle está en `docs/integrations/INTEGRATIONS.md`. Que algo aparezca aquí no significa que esté verificado ni que entre en la Beta 1: eso lo decide `docs/product/MVP_ACCEPTANCE.md`.

## Qué es MANU OS

MANU OS no es solo una aplicación que Manu abre. Es una capa personal sobre su iPhone y su Mac cuya experiencia empieza en la pantalla bloqueada, los widgets, el Centro de Control, los modos y las automatizaciones.

La aplicación principal es la cabeza del sistema: memoria, organización, consulta, configuración y chat personal.

**Propósito central**: convertir la actividad cotidiana dispersa (capturas, mensajes compartidos, enlaces, audios, calendario, gastos, salud, archivos e ideas) en memoria organizada y siguientes pasos útiles. El sistema se organiza alrededor de Manu; Manu no mantiene la app organizada a mano.

**Criterio de permanencia**: la interfaz decide si Manu sigue usando MANU OS. Si no le gusta o es lenta, deja de usarla. El rendimiento y el acabado visual son requisitos, no pulido final.

## Identidad visual

| Elemento | Valor aproximado |
| --- | --- |
| Tipografía | del sistema, preferentemente SF Pro |
| Apariencia | modo oscuro por defecto |
| Fondo | `#050608` |
| Superficies | `#111318` |
| Texto principal | `#F7F8FA` |
| Texto secundario | `#949AA6` |
| Azul principal | `#246BFD` |
| Azul activo | `#4D8DFF` |

Reglas:

- Negro, blanco y azul eléctrico.
- Aspecto estable durante todo el día: **los modos no cambian fondos, widgets ni colores**, solo contenido y comportamiento.
- Nada de estética empresarial, dashboards densos ni ciencia ficción decorativa.
- Accesibilidad obligatoria: Dynamic Type, VoiceOver y contraste suficiente. Los valores de color deben comprobarse contra los mínimos de contraste antes de fijarse (`NO_VERIFICADO`).

## Navegación principal

Menú inferior de cinco pestañas:

| Pestaña | Contenido |
| --- | --- |
| **Hoy** | briefing, tiempo, baterías, música y contexto importante del momento |
| **Agenda** | eventos, tareas, planes, reservas y proyectos |
| **MANU** | chat principal; posición central y visualmente prioritaria; interacción habitual escribiendo |
| **Dinero** | movimientos, gastos, presupuestos, análisis e insights |
| **Tú** | estado emocional, salud, actividad, UREVO, comidas, personas importantes y hábitos |

Laboratorio y Ajustes no ocupan una pestaña principal.

## Asistente MANU

Decisión arquitectónica en [ADR-0009](../adr/0009-manu-assistant-without-mandatory-ai.md).

Comportamiento:

- Personalidad parecida a Chatty: cercana, natural, sincera y no corporativa.
- Puede llevarle la contraria a Manu cuando crea que algo no le conviene.
- Toma la iniciativa varias veces al día y aprende progresivamente los momentos adecuados a partir de sugerencias aceptadas, rechazadas o ignoradas.
- No se repite demasiado, no pregunta constantemente, no es artificialmente positivo y no llena la experiencia de estadísticas.
- Antes de recomendar qué hacer, tiene en cuenta energía, estado emocional, tiempo disponible y objetivos personales. Objetivo principal actual de Manu: **organizar mejor su vida**.
- Acciones:
  - puede automatizar rutinas repetitivas y ejecutar acciones pequeñas **previamente autorizadas**;
  - las acciones con consecuencias las prepara y pide confirmación;
  - puede redactar mensajes, abrir la app adecuada y dejar el envío preparado;
  - solo los mensajes de una lista blanca explícita podrían enviarse automáticamente. Único candidato actual: avisar de que Manu ha llegado (`NO_VERIFICADO`);
  - nunca suplanta a Manu ni envía otros mensajes automáticamente por defecto.

**Límite honesto**: sin un proveedor de modelo decidido (D-08), el chat funciona en el nivel base de ADR-0009: comandos, búsqueda con fuentes, plantillas y sugerencias. La conversación abierta con personalidad completa depende de D-08.

### Qué debe aprender en un mes

Horarios y rutinas, cambios de energía, personas importantes, patrones de gasto, cómo trabaja y termina proyectos, y qué ayuda necesita en cada momento. Todo lo aprendido se guarda como inferencia o preferencia con procedencia, visible y corregible (ADR-0002). Nada aprendido se convierte en hecho sin confirmación.

## Rutinas del día

### Noche

1. MANU OS revisa el calendario del día siguiente.
2. Deduce si parece que Manu irá a Oviedo o se quedará en Gijón.
3. Pregunta y confirma la ciudad.
4. Pregunta si quiere desayunar.
5. Propone una hora de alarma según ciudad, desplazamiento y desayuno.
6. Manu confirma la alarma manualmente.
7. Prepara en silencio agenda, tareas y baterías.
8. No muestra un resumen nocturno obligatorio.

Viabilidad: calendario y propuesta de hora `TEÓRICAMENTE_POSIBLE`. Crear la alarma desde MANU OS depende de AlarmKit (iOS 26 o posterior, SDK de iOS 26, ver D-04) o de un Atajo (`NO_VERIFICADO`). El tiempo de desplazamiento requiere una fuente de rutas (`NO_VERIFICADO`).

### Al despertar

1. Manu apaga la alarma.
2. El sistema intenta iniciar Spotify DJ.
3. Intenta reproducirlo en el Chromecast o altavoz del baño.
4. En la pantalla bloqueada aparecen el tiempo y elementos mínimos.
5. El briefing completo aparece al desbloquear.

Viabilidad:

- Detectar que se ha detenido una alarma de la app Reloj: Atajos tiene el disparador «Is Stopped» (documentado por Apple, `TEÓRICAMENTE_POSIBLE`).
- **Spotify DJ**: preferido, pero **no hay ruta verificada** para iniciarlo automáticamente. La Web API de Spotify permite iniciar la reproducción en un dispositivo concreto solo con Spotify Premium y no documenta DJ. Iniciar DJ en el Chromecast del baño queda `NO_VERIFICADO`. Alternativa documentada: abrir Spotify o iniciar una lista concreta, y que Manu pulse DJ.
- Tiempo en pantalla bloqueada: widget de pantalla bloqueada (`TEÓRICAMENTE_POSIBLE`); la fuente de datos está en D-06.

### Briefing de la mañana

Eventos de hoy, tiempo, tareas de trabajo, citas y reuniones, mensajes que debe responder, publicaciones o campañas, archivos necesarios y baterías de dispositivos.

Límites: «mensajes que debe responder» solo puede incluir lo que MANU OS conozca (compartido por Manu, correo con permiso o recordatorios), no WhatsApp ni iMessage leídos automáticamente (G). Baterías: ver «Pantalla bloqueada».

### Trabajo

- Lunes a viernes, de 09:00 a 13:00.
- Muestra la siguiente tarea, la próxima cita, mensajes pendientes, campañas y publicaciones.
- Superficies: widget del iPhone, pantalla bloqueada, app de Mac y app principal.
- A las 13:00 activa la desconexión laboral: valora la urgencia de las tareas no terminadas, propone una nueva fecha y guarda ideas y notas.
- No muestra trabajo hasta el día siguiente, salvo excepciones.
- Excepciones actuales: **dos contactos laborales definidos por Manu**. Sus nombres se configuran en la app y no se guardan en el repositorio.
- El Focus de iOS sigue controlado por Manu. MANU OS no puede silenciar otras apps por sí mismo.
- De las llamadas laborales interesan tareas, compromisos y fechas mencionadas. La grabación y la transcripción siguen sujetas a viabilidad, consentimiento y revisión legal (G-08).

### Tardes y planes

Después del trabajo, el comportamiento depende del día: comer y descansar, siesta, caminar en la UREVO, proyectos personales o quedar con amigos. MANU pregunta brevemente cómo está Manu y aprende de elecciones anteriores.

Antes de salir: tiempo y lluvia, dinero disponible y batería del móvil y de los dispositivos.

## Pantalla bloqueada, accesos e interrupciones

Pantalla bloqueada: tiempo actual, batería de dispositivos, modo activo y acceso rápido a MANU. Sin contenido sensible (G-09).

Interrupciones prioritarias:

| Interrupción | Viabilidad |
| --- | --- |
| mensaje de una persona prioritaria | MANU OS no puede leer mensajes de WhatsApp ni iMessage. Solo iOS, mediante Focus y contactos permitidos, puede dejarlos pasar (G para MANU OS) |
| batería muy baja | iPhone: `TEÓRICAMENTE_POSIBLE`; Mac: con la app de Mac; AirPods: sin API pública conocida para apps de terceros (`NO_VERIFICADO`) |
| gasto o cobro importante | depende de las entradas de Finanzas (G-07) |
| cambio fuerte del tiempo | depende de D-06 |
| algo importante que MANU cree que se está olvidando | `TEÓRICAMENTE_POSIBLE` con reglas locales |

Accesos:

- **Botón de acción → abrir chat de MANU**: **no viable en el iPhone 14**, que no tiene botón de acción. Se sustituye por un control del Centro de Control o de la pantalla bloqueada y, como opción `NO_VERIFICADO`, Toque posterior con un Atajo. Aplicable si Manu cambia a un iPhone con botón de acción.
- **Centro de Control**: hablar con MANU, registrar un gasto y guardar una idea. Los controles de terceros existen desde iOS 18 (`TEÓRICAMENTE_POSIBLE`; requieren SDK de iOS 18 o posterior, ver D-04).

## Bandeja diaria de capturas

Función central y distintiva. Manu hace muchas capturas y quiere procesarlas **todas**, no solo las de proyectos. Decisión de retención en [ADR-0008](../adr/0008-source-retention-and-controlled-deletion.md).

| Paso | Requisito | Viabilidad |
| --- | --- | --- |
| 1 | Detectar que Manu ha llegado y permanece en casa | ubicación con permiso «Siempre» o automatización de Atajos por llegada (`NO_VERIFICADO`); D-09 |
| 2 | Proponer revisar todas las capturas nuevas desde la última revisión | acceso a la fototeca con permiso y filtro de capturas de pantalla (`TEÓRICAMENTE_POSIBLE`) |
| 3 | Agrupar capturas consecutivas del mismo tema | agrupación por tiempo y texto en el dispositivo (`TEÓRICAMENTE_POSIBLE`); por tema real, calidad `NO_VERIFICADO` sin modelo |
| 4 | Crear una historia cronológica del grupo | `TEÓRICAMENTE_POSIBLE` |
| 5 | Extraer texto mediante OCR | reconocimiento de texto en el dispositivo (`TEÓRICAMENTE_POSIBLE`; calidad en español `NO_VERIFICADO`) |
| 6 | Describir lo que contienen | **limitado**: sin modelo multimodal solo hay texto extraído y clasificación básica. Una descripción rica requiere un modelo (D-08) y no puede enviar capturas sensibles a un proveedor externo sin decisión específica |
| 7 | Preguntar por qué hizo la captura | `TEÓRICAMENTE_POSIBLE` |
| 8 | Responder por texto o audio | `TEÓRICAMENTE_POSIBLE` |
| 9 | Transcribir la respuesta | reconocimiento de voz con permiso (`TEÓRICAMENTE_POSIBLE`; en el dispositivo en español `NO_VERIFICADO`) |
| 10 | Borrar el audio después de comprenderlo | retención `TRANSIENT` (ADR-0008) |
| 11 | Relacionar con temas, proyectos, personas y fechas | propuestas `PROPOSED` |
| 12 | Proponer tareas o eventos y esperar confirmación | `TEÓRICAMENTE_POSIBLE` |
| 13 | Confirmar siempre la clasificación | regla de producto |
| 14 | Conservar texto, ideas, etiquetas, contexto y relaciones aprobadas | retención `EXTRACTED_ONLY` |
| 15 | No conservar la captura original dentro de MANU OS | ADR-0008 |
| 16 | Solicitar eliminar los originales de Fotos | la API de la fototeca permite pedir el borrado (`TEÓRICAMENTE_POSIBLE`) |
| 17 | Respetar la confirmación obligatoria de iOS | iOS muestra su propia confirmación; MANU OS registra el resultado real |
| 18 | Sin motivo recordado: conservar el texto como contexto sin clasificar | `TEÓRICAMENTE_POSIBLE` |

Contenido sensible: se procesa localmente igual que el resto, pero se etiqueta internamente para que no aparezca por accidente en widgets, pantalla bloqueada ni exportaciones compartibles (ver `DATA_MODEL.md`, «Sensibilidad»).

## Enlaces, Reels y TikTok

Desde Compartir → MANU OS:

- recibir el enlace y conservarlo como fuente cuando sea posible (retención `REFERENCE_ONLY` o `FULL`);
- extraer un resumen y las ideas aplicables;
- relacionarlo con tareas y proyectos;
- transcribir solo cuando la plataforma y la ruta técnica lo permitan.

No se promete acceso completo a Instagram ni a TikTok. Si bloquean el contenido, las alternativas son compartir el vídeo, el texto o una captura. Resumir e identificar ideas sin modelo se limita al texto disponible (D-08).

## Proyectos

Tipos: personales, RK Iglesias, estudios y formación, contenido y redes, aplicaciones y webs, planes y viajes.

Problemas de Manu que MANU debe tener en cuenta: empieza ideas nuevas, los proyectos crecen demasiado, pierde motivación y depende de otras personas.

- **Idea nueva**: se guarda sin convertirse automáticamente en proyecto activo; MANU la compara con los proyectos actuales, investiga si merece la pena y ayuda a desarrollarla. Es sincero sobre la carga actual sin impedir ideas nuevas.
- **Proyecto sin actividad**: pregunta si sigue interesado, recuerda por qué lo empezó y propone un paso muy pequeño.
- **Motivación**: mostrar progreso, siguiente paso fácil, resultado final, fecha límite, acompañamiento y reconocimiento.

«Investigar si merece la pena» con fuentes externas depende de D-08 y de las reglas de ADR-0006.

## Captura y organización general

Lo que Manu pierde más: capturas, notas e ideas, fotos con información, archivos, enlaces y contexto de proyectos.

Organización por proyecto y por tema, con varias etiquetas a la vez. **Toda clasificación de una captura nueva debe confirmarse.**

## Personas y WhatsApp

MANU recuerda: cumpleaños y fechas, planes y conversaciones pendientes, gustos e ideas de regalo, tiempo sin hablar, planes prometidos y posibles propuestas para quedar.

Los perfiles se forman con lo que Manu cuente, Contactos y Calendario.

Importación voluntaria de exportaciones de WhatsApp:

- almacena todo el texto original cifrado (retención `FULL`);
- no incluye multimedia inicialmente;
- extrae gustos, ideas de regalo, planes, promesas, fechas, personas, relaciones, recuerdos y temas que preocupan, como `PROPOSED`;
- permite preguntar sobre el chat;
- conserva la evidencia del mensaje original;
- no convierte bromas o hipótesis en hechos sin contexto.

Los chats contienen datos de terceros; se tratan como sensibles (ver `THREAT_MODEL.md`). «Tiempo sin hablar» solo puede calcularse con lo que Manu importe o cuente: MANU OS no lee WhatsApp de forma continua.

## Salud, actividad y comidas

Datos autorizables: sueño, pasos y actividad, tiempo caminando en la UREVO, estado de ánimo y ritmo cardiaco. Entrada mediante HealthKit con permiso por tipo de dato (`TEÓRICAMENTE_POSIBLE`; disponibilidad con cuenta gratuita `NO_VERIFICADO`, D-03). Si la UREVO no escribe en Salud, el tiempo se mide desde MANU OS (`NO_VERIFICADO`).

UREVO: recordar caminar, proponer sesión según el día, preparar música o una serie, medir tiempo y progreso, y reconocer la constancia sin presionar.

Comidas: registro por foto, elección entre comidas habituales o entrada rápida escrita. **No** se ha pedido dieta, calorías ni recomendaciones nutricionales.

El tiempo solo ayuda con frío, lluvia, abrigo y paraguas. Manu elige la ropa según el tiempo y su estado de ánimo.

## Refugio (acompañamiento emocional)

Espacio de acompañamiento emocional. **No sustituye a la psicología profesional y no hace diagnósticos.**

- Activación posible: «MANU, estoy de bajón».
- Lo que Manu necesita: entender por qué está así, buscar una solución o distraerse.
- Tono: amigo cercano, preguntas profundas, directo y práctico, adaptado al momento.
- Fases: entender, resolver, cambiar de aire.
- Distracciones útiles: música, caminar, hablar o quedar con alguien, serie o vídeos, salir sin plan, actividad creativa.
- Recuerda, con protección especial: desencadenantes, personas relacionadas, qué ayudó y evolución.
- Puede preguntar proactivamente cómo está si detecta señales **autorizadas**. El seguimiento depende de la intensidad del bajón.
- **Ante un posible riesgo real**, prioriza la ayuda humana inmediata y no continúa como si fuera terapia. En España: **112** (emergencias) y **024** (Línea de atención a la conducta suicida del Ministerio de Sanidad, 24 horas, gratuita). Los recursos deben revisarse periódicamente.

Gate propio: G-12. Los datos del Refugio nunca se envían a proveedores externos sin decisión específica (ADR-0009).

## Finanzas

Entradas deseadas y viabilidad:

| Entrada | Viabilidad |
| --- | --- |
| capturas bancarias | OCR en el dispositivo (`TEÓRICAMENTE_POSIBLE`) |
| notificaciones de pago | una app de terceros no puede leer las notificaciones de otras apps (G). Atajos tiene un disparador de transacciones de Wallet al pagar con una tarjeta; qué datos entrega y con qué tarjetas funciona está `NO_VERIFICADO` |
| fotos de tickets | OCR en el dispositivo (`TEÓRICAMENTE_POSIBLE`) |
| entrada por voz | transcripción con permiso (`TEÓRICAMENTE_POSIBLE`) |
| importación bancaria futura | extractos exportados (E); Open Banking solo como estudio con ADR propio |

Objetivos iniciales: entender en qué se va el dinero, cuánto puede gastar hoy, gastos evitables, gasto al salir, suscripciones, pagos recurrentes y comparación mensual.

Avisos: gasto anormal, cobro próximo, exceso respecto al patrón o al presupuesto, y suscripción olvidada.

Reglas:

- No hay todavía objetivo de ahorro. MANU primero aprende y después propone límites.
- **Clasificación**: la categoría de cada movimiento se asigna automáticamente, se muestra como inferida y se puede corregir. El importe, la fecha y el comercio extraídos de una captura o ticket se confirman (se puede confirmar por lotes).
- Tono sin juzgar, con datos y algo de humor.
- Se mantienen los gates técnicos y de seguridad antes de conectar bancos (G-07).

## Laboratorio

Sección (fuera del menú principal) para errores, mejoras e ideas sobre MANU OS.

Cada entrada puede incluir captura, texto, audio, versión, pantalla, hora y contexto técnico disponible. Estados: pendiente, arreglando, listo para probar y resuelto.

Nada se envía automáticamente a GitHub, Claude ni otro agente: MANU prepara un informe y pide aprobación. Los informes no incluyen datos personales salvo que Manu los añada explícitamente.

## Mac

La app de Mac permite lo mismo que la de iPhone: hablar con MANU, proyectos y tareas, archivos y chats, finanzas e informes, y configuración de automatizaciones. El Mac actual de Manu es un Intel i5 de doble núcleo a 3,1 GHz; esto limita qué versión de macOS puede ejecutar y qué versión de Xcode puede compilar la app (ver D-01 y D-04).

## Sincronización y copias

Preferencias de Manu:

- sincronización automática cifrada entre iPhone y Mac;
- copia completa semanal en el Mac;
- restaurar un iPhone nuevo desde el Mac;
- copia manual por cable como opción adicional.

El transporte de sincronización está en D-07.

Manu **no quiere bloqueos internos de Face ID dentro de la app**. La seguridad depende del bloqueo del dispositivo y del cifrado. Riesgo aceptado y documentado en R-33.

## Mantenimiento operativo (requisito futuro)

Cuando exista un servidor o servicio de sincronización accesible mediante una integración, ChatGPT podrá hacer una revisión **semanal** de disponibilidad, errores, backups y restauración, sincronización, almacenamiento, seguridad, dependencias, integraciones rotas y costes inesperados. Resultado: correcto, necesita atención o urgente.

Nunca modifica producción, borra datos ni despliega arreglos sin aprobación de Manu. **No se crea todavía**: no existe servidor ni plataforma conectada.

## Fuera del alcance

- Armario digital, catálogo de prendas y recomendaciones completas de conjuntos.
- Dieta, calorías y recomendaciones nutricionales.
- Diagnósticos psicológicos o terapia.
- Envío automático de mensajes fuera de la lista blanca.
- Lectura automática de WhatsApp, iMessage o notificaciones de otras apps.
