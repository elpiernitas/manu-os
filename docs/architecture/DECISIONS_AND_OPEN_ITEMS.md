# 08 — Decisiones y puntos abiertos

> Revisado el 2026-09-28 por [ADR-0007](../adr/0007-native-iphone-first.md) y, el mismo día, por las decisiones de producto de Manu ([ADR-0008](../adr/0008-source-retention-and-controlled-deletion.md), [ADR-0009](../adr/0009-manu-assistant-without-mandatory-ai.md), `docs/product/EXPERIENCE.md`). Las decisiones sustituidas se marcan, no se borran.

## Decisiones cerradas por BRAIN-00

- ~~PWA primero; app nativa no es requisito.~~ **Sustituida por ADR-0007**: la app nativa de iPhone es la interfaz principal desde las primeras fases.
- Arquitectura local-first con sync al estar activa.
- Cifrado de contenido en cliente antes de cloud sync.
- MANU BRAIN independiente de ChatGPT, Claude y Gemini.
- Modelo relacional + proyección de grafo; no Neo4j.
- Búsqueda textual primero; embeddings después y opcionales.
- Event log incremental; no CRDT genérico en MVP.
- Fuentes brutas inmutables; derivados regenerables. *(Precisado por ADR-0008: inmutable mientras se conserva; retención por fuente; eliminación controlada con procedencia. La regeneración solo es posible con retención `FULL`.)*
- Google Drive appData es candidato preferido para backup/sync cifrado de coste cero, no acceso amplio a Drive. *(Sigue como candidato dentro de D-07.)*
- Cloudflare Worker/D1 es despliegue de referencia para servicio mínimo, no contrato del núcleo.
- R2 y servicios con cobro por exceso quedan fuera hasta verificar un límite duro.
- HOME, MIND y MIRROR se construyen después de Capture, evidencia, búsqueda y restore. *(Con la navegación nueva, HOME es la pestaña Hoy y MIRROR se integra en el chat MANU; el orden se mantiene.)*
- El primer trabajo de Claude es el contrato temporal/evidencial con tests. *(Sigue vigente; su lenguaje depende de D-01.)*

## Decisiones cerradas por ADR-0007

- La app nativa de iPhone (Swift/SwiftUI) es la experiencia principal y el centro de configuración.
- Las superficies del sistema son extensiones de esa app. *(El botón de acción no existe en el iPhone 14; ver nota en ADR-0007.)*
- Los modos cambian información, accesos y comportamiento de MANU OS; los cambios del sistema se apoyan en Focus y Atajos configurados por Manu.
- El componente web/local-first es opcional y no bloquea la experiencia nativa.
- El gate G-05 queda retirado.

## Decisiones de producto de Manu (2026-09-28)

Comunicadas directamente por Manu. Detalle en `docs/product/EXPERIENCE.md`.

- MANU OS es una capa sobre **iPhone y Mac**; la app de Mac tiene las mismas capacidades que la de iPhone.
- **Primera beta integrada**: Manu no instala prototipos parciales semanales. Se distingue MVP técnico interno de Beta 1 (`MVP_ACCEPTANCE.md`).
- Navegación de cinco pestañas: Hoy, Agenda, MANU (central), Dinero y Tú.
- Identidad visual oscura (negro, blanco, azul eléctrico) y **estable**: los modos no cambian la apariencia.
- Chat MANU con personalidad parecida a Chatty y proactividad aprendida; sin IA obligatoria (ADR-0009).
- Bandeja diaria de capturas: todas las capturas, originales no conservados en MANU OS y borrado confirmado en Fotos (ADR-0008).
- Toda clasificación de una captura nueva se confirma; en finanzas, la categoría es automática y corregible.
- Acciones: pequeñas y rutinas autorizadas, automáticas; con consecuencias, confirmadas; mensajes automáticos solo por lista blanca (candidato único: aviso de llegada).
- **Sin bloqueo interno de Face ID** dentro de la app; la seguridad depende del dispositivo y del cifrado (riesgo aceptado, R-33).
- Sincronización automática cifrada, copia semanal completa en el Mac, restauración de un iPhone nuevo desde el Mac y copia por cable opcional.
- 0 € de coste adicional; las suscripciones de consumo de ChatGPT, Claude y Gemini no se tratan como acceso API.
- Fuera de alcance: armario digital, dieta y calorías, diagnósticos o terapia.
- Mantenimiento operativo semanal por ChatGPT: requisito futuro, no se crea hasta que exista un servidor accesible.

## Decisiones cerradas tras verificar los dispositivos (2026-09-28)

- **D-01 — DECIDIDA**: núcleo MANU BRAIN en Swift y apps SwiftUI para iPhone y Mac, sin componente web en la Beta 1. Manu delegó la elección técnica y aceptó la recomendación.
- **D-04 — PARCIALMENTE RESUELTA**: el Mac local no es entorno de compilación. BRAIN-01 se compila y prueba como Swift Package en un runner estándar `macos-26` de GitHub Actions con Xcode 26.6, ejecución manual o por PR y presupuesto de gasto 0 €. Esto desbloquea BRAIN-01. La compilación y prueba de la app en el iPhone con iOS 27 sigue bloqueada: Xcode 27 está en vista previa en un runner `xcode-27-xlarge`, que no se adopta por coste, y TestFlight requiere D-03. No se usará un Mac prestado y no se actualizará el Mac actual a Tahoe para este proyecto.
- Si el runner gratuito deja de estar disponible o consume los minutos incluidos, el workflow se detiene; no se activa facturación automáticamente.

## Decisiones pendientes

| ID | Decisión | Opciones | Quién decide | Bloquea |
| --- | --- | --- | --- | --- |
| **D-02** | Almacenamiento local nativo, gestión de claves y contenedor compartido con extensiones | por evaluar tras D-01 | propuesta técnica + ADR | BRAIN-02 |
| **D-03** | Asumir o no Apple Developer Program | cuenta gratuita (perfiles de 7 días, 10 App IDs, sin TestFlight ni WeatherKit) o programa de pago | Manu | BRAIN-02, parte de BRAIN-03, D-06, D-07 |
| **D-04B** | Ruta de compilación, firma e instalación de la app integrada en el iPhone con iOS 27 | esperar runner estándar con Xcode 27; aprobar runner de pago; aprobar Apple Developer Program/TestFlight; reducir o retrasar la Beta nativa | Manu cuando BRAIN-02 la necesite | BRAIN-02 y Beta 1 |
| D-05 | Fuente de calendario para Agenda y el modo Trabajo | EventKit, Google Calendar read-only o ambos | Manu | BRAIN-09 |
| D-06 | Servicio meteorológico | WeatherKit (requiere D-03), API pública gratuita, organismo oficial | propuesta técnica + Manu | BRAIN-10 |
| D-07 | Transporte de la sincronización cifrada iPhone ↔ Mac | Drive `appDataFolder`, servicio mínimo propio, servicio de Apple (puede requerir D-03) | propuesta técnica + Manu | BRAIN-06 |
| D-08 | Fuente de modelo para el nivel conversacional de MANU y para descripciones ricas | ninguna (solo nivel base); API gratuita con restricciones de datos; API de pago (decisión explícita); modelo local en el Mac (`NO_VERIFICADO`) | Manu | nivel conversacional (BRAIN-11) |
| D-09 | Detección de llegada a casa | automatización de Atajos por llegada; ubicación «Siempre» en la app; activación manual | Manu | bandeja diaria automática, aviso de llegada |

### Decisión técnica D-01 (cerrada)

**DECIDIDO**: núcleo MANU BRAIN en **Swift** y apps **SwiftUI** para iPhone y Mac, sin duplicar el núcleo en TypeScript y sin componente web en la Beta 1.

Motivos:

- Las dos interfaces que Manu quiere (iPhone y Mac) son de Apple. Un único lenguaje evita mantener dos núcleos y el riesgo R-13.
- Las extensiones (widgets, controles, intents, Share Extension) son Swift y necesitan leer datos del núcleo sin puentes.
- OCR, reconocimiento de voz, fototeca, calendario, salud y alarmas son frameworks de Apple accesibles directamente desde Swift.
- Un núcleo TypeScript dentro de la app nativa añadiría un motor JavaScript y una capa de puente sin beneficio para dos plataformas Apple.
- Local-first y offline siguen igual; los contratos de BRAIN-01 (invariantes y 12 tests) no dependen del lenguaje.

Evidencia en contra o riesgos que hay que aceptar:

- **El Mac actual de Manu probablemente no puede ejecutar ningún Xcode actual** (todos requieren macOS Tahoe 26.2 o posterior, y Tahoe no parece admitir un Intel i5 de doble núcleo). Esto afecta a **cualquier opción** que incluya app nativa, no solo a la (a); por eso D-04 debe resolverse a la vez.
- La app de Mac debe funcionar en la versión de macOS del Mac Intel de Manu. Si es antigua, limita las APIs de SwiftUI disponibles en Mac. Una app de Mac antigua y la de iPhone pueden compartir núcleo, pero no necesariamente toda la interfaz.
- El entorno de Claude Code en la nube no compila Swift para Apple; la verificación depende de D-04.
- Se pierde la opción de una versión web accesible desde cualquier navegador. No es un requisito actual de Manu.

Si Manu no acepta la recomendación, la alternativa menos costosa es (c) solo si aparece un requisito web real; (b) no se recomienda porque la app de Mac perdería integración con el sistema.

### Datos verificados para D-04

- MacBook Pro (13 pulgadas, 2017, cuatro puertos Thunderbolt 3), identificador `MacBookPro14,2`.
- Intel Core i5 de doble núcleo a 3,1 GHz, 8 GB de RAM y unos 36,9 GB libres.
- macOS Sonoma 14.8.7 instalado. Apple fija macOS Ventura como última versión oficialmente compatible con este modelo; el mecanismo usado para ejecutar Sonoma no está verificado.
- Actualización de software ofrece macOS Tahoe 26.7, pero Apple no incluye este modelo entre los compatibles. No se actualizará para MANU OS.
- Xcode no está instalado y no aparece en la App Store para esta configuración.
- iPhone 14 estándar con iOS 27.0 y unos 4,4 GB libres.
- GitHub ofrece el runner estándar `macos-26` con Xcode 26.6. Xcode 27 está en vista previa mediante `xcode-27-xlarge`; no se adopta porque puede generar coste.
- Conclusión: el Mac sirve para Git, documentación y gestión del proyecto; el núcleo Swift se verifica en CI. La app integrada y la instalación real quedan en D-04B.

## Contradicciones resueltas

- «Conectar todas mis apps» se interpreta como una estrategia por rutas reales, no acceso automático universal.
- «PWA de altísima calidad» no implica que una PWA pueda usar frameworks nativos de Apple. *(Con ADR-0007 la PWA deja de ser la interfaz principal.)*
- «Coste 0 €» prevalece sobre integración inmediata con APIs que requieren billing o Developer Program. *(Apple Developer Program pasa a decisión explícita de Manu, D-03.)*
- «Gemelo digital» significa representación informacional con fuentes, no imitación consciente ni voz autónoma.
- «Claude implementa» no convierte créditos temporales en dependencia del producto.
- «Capa sobre el iPhone» no significa sustituir el launcher ni controlar iOS.
- **«Fuentes inmutables» frente a «no conservar las capturas»**: resuelto por ADR-0008 (retención por fuente, borrado confirmado y procedencia).
- **«Chat tipo JARVIS» frente a «0 € y sin IA obligatoria»**: resuelto por ADR-0009 (nivel base determinista; nivel conversacional opcional en D-08). Se documenta que la naturalidad completa depende de un modelo.
- **«Toda clasificación se confirma» frente a «Finanzas clasifica automáticamente»**: las capturas nuevas se confirman; en finanzas, importe, fecha y comercio se confirman y la categoría es automática, marcada como inferida y corregible.
- **«Portabilidad completa» frente a «lo sensible no aparece en exportaciones»**: el backup completo cifrado incluye todo; las exportaciones compartibles excluyen lo sensible por defecto.
- **«Bloqueo local configurable» (BRAIN-00) frente a «sin Face ID interno»**: prevalece la decisión de Manu; riesgo residual en R-33.
- **«Botón de acción → chat MANU» frente al iPhone 14**: el iPhone 14 no tiene botón de acción; se usa Centro de Control y pantalla bloqueada.
- **«Modos que cambian pantallas» (ADR-0007) frente a «aspecto estable»**: los modos cambian contenido y comportamiento, no colores, fondos ni widgets.
- **«Ubicación continua fuera del MVP» frente a «detectar que ha llegado a casa»**: la ubicación se limita a la llegada a casa, con autorización específica (D-09).
- **«Procesamiento masivo de la fototeca fuera» frente a «procesar todas las capturas»**: solo capturas de pantalla nuevas desde la última revisión, no el resto de fotos.

## Contradicciones y preguntas abiertas

1. **Entorno de compilación de la Beta** (D-04B): BRAIN-01 sí tiene ruta con GitHub Actions, pero la app integrada para iOS 27 todavía necesita un Xcode 27 aceptable dentro de coste 0 € o una aprobación explícita de coste.
2. **Pruebas en dispositivo antes de la Beta 1**: si el único iPhone es el de Manu, parte de la QA interna necesita su dispositivo aunque no quiera instalar prototipos semanales.
3. **Coste 0 € frente a Apple Developer Program**: sin él, la Beta 1 caduca cada 7 días, no hay TestFlight ni WeatherKit y puede faltar alguna capacidad (D-03).
4. **Personalidad «tipo Chatty» sin modelo** (D-08): el nivel base no alcanzará la misma naturalidad.
5. **Descripción de capturas sin modelo**: sin D-08, se limita a OCR y clasificación básica.
6. **Spotify DJ y Chromecast**: no hay ruta documentada para iniciar DJ; la Web API requiere Premium (se desconoce si Manu lo tiene).
7. **Mensajes que debe responder y personas prioritarias**: MANU OS no lee WhatsApp ni iMessage; solo puede usar lo que Manu comparta o el correo con permiso.
8. **Batería de AirPods**: no hay API pública conocida para apps de terceros.
9. **Notificaciones de pago**: no se pueden leer las de otras apps; el disparador de transacciones de Wallet solo cubre pagos con tarjetas de Wallet y sus datos disponibles están por verificar.
10. **Grabación de llamadas**: sigue sin ruta técnica verificada y requiere revisión legal (G-08).
11. **Excepciones laborales**: son dos contactos concretos; se guardan en la app, no en el repositorio.
12. **Interrupciones proactivas frente a Focus**: MANU no debe saltarse un Focus salvo con los niveles de interrupción que Manu permita.

## Supuestos que deben validarse durante implementación

- ~~Safari/iOS real conserva correctamente el vault dentro del patrón de uso de Manu.~~ Aplica solo si D-01 mantiene un componente web.
- El almacenamiento local nativo conserva el vault tras cierres, reinicios y actualizaciones.
- Atajos, App Intents y controles entregan de forma cómoda los tipos de captura elegidos.
- Widgets, controles y Live Activities funcionan en el iPhone 14 con su versión de iOS.
- Las capacidades necesarias están disponibles con el tipo de cuenta elegido (D-03).
- El OCR y el reconocimiento de voz en el dispositivo tienen calidad suficiente en español.
- La petición de borrado en Fotos muestra la confirmación del sistema y devuelve el resultado.
- El flujo de Google OAuth puede pasar de Testing a producción con `drive.appdata` sin fricción relevante.
- ~~El rendimiento de IndexedDB/OPFS es suficiente para el tamaño inicial.~~ Aplica solo al componente web.
- La frase/secreto de recuperación ofrece una UX aceptable.
- La selección de modo y las sugerencias aportan utilidad sin IA.
- La app es fluida en el iPhone 14 y en el Mac Intel.

## Estado de acceso y autorizaciones

- El repositorio privado `elpiernitas/manu-os` existe. Claude Code tiene acceso desde el 2026-09-28 y lo usa para tareas documentales autorizadas explícitamente por Manu.
- Claude **no** está autorizado a implementar: BRAIN-01 y BRAIN-02 siguen sin autorizar.
- No hacen falta todavía API keys, OAuth, Apple Developer, tarjeta, dominio ni exportaciones personales.

## Intervención de Manu necesaria

- D-01 ya está decidida y D-04 resuelta para BRAIN-01.
- Decidir D-03 y D-04B cuando sean necesarias para instalar la app integrada. D-02 se definirá para Swift.
- Indicar si tiene Spotify Premium (afecta a la rutina de la mañana).
- Autorizar explícitamente BRAIN-01 cuando corresponda.

## Intervenciones futuras, no ahora

- autorizar scopes Google uno por uno;
- instalar la Beta 1 en el iPhone y el Mac y configurar controles y Toque posterior;
- configurar los Focus que usarán los modos y las dos excepciones laborales;
- guardar de forma segura el secreto de recuperación;
- decidir D-05 a D-09;
- aprobar cualquier servicio con coste;
- aportar exportaciones reales solo cuando importador, cifrado y backup estén preparados.

## Riesgos técnicos principales

1. Pérdida de almacenamiento local si no existe backup probado.
2. Entorno de compilación y aprovisionamiento (D-03, D-04).
3. Expectativas de integración Apple mayores que lo permitido por el sistema y por el iPhone 14.
4. Chat MANU por debajo de lo esperado sin modelo (D-08).
5. Proactividad molesta que lleve a abandonar la app.
6. Borrado de originales con pérdida de contexto o registro incorrecto.
7. Datos sensibles (salud, finanzas, Refugio, terceros) expuestos en superficies, exportaciones o proveedores.
8. Prompt injection al incorporar correo, enlaces y documentos.
9. Sync conflictivo entre iPhone y Mac.
10. Beta integrada que llegue tarde o con demasiadas piezas a la vez.
11. Interfaz lenta en el iPhone 14 o el Mac Intel.

Cada riesgo tiene un gate o una decisión en el roadmap y una entrada en `docs/security/RISK_REGISTER.md`.
