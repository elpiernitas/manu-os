# 05 — Matriz de integraciones

## Leyenda

- **A** API/OAuth directa.
- **B** API del sistema operativo o navegador.
- **C** Shortcut / Share Sheet / deep link.
- **D** importación periódica.
- **E** exportación manual.
- **F** posible, pero exige pago, cuenta de desarrollador, billing o revisión relevante.
- **G** no viable actualmente con el alcance indicado.

Una fila puede tener varias rutas. `NO VERIFICADO` significa que aún no se ha probado en los dispositivos/cuentas de Manu.

Revisado el 2026-09-28 con los dispositivos y las apps que usa Manu. Siempre se distingue la ruta: integración directa (A/B), Share Sheet (C), importación manual (D/E), Atajos (C) o enlace profundo (C).

## Dispositivos de Manu

| Dispositivo | Implicaciones |
| --- | --- |
| iPhone 14 | admite iOS 26 según Apple. **No tiene botón de acción** (solo iPhone 15 Pro y posteriores) ni, en el modelo estándar, Dynamic Island. **No admite Apple Intelligence** |
| Mac Intel (i5 de doble núcleo, 3,1 GHz) | **no admite Apple Intelligence**. Probablemente no puede instalar macOS Tahoe, que es lo que exige cualquier Xcode actual (D-04). La app de Mac debe funcionar en su versión de macOS |
| AirPods | batería no accesible para apps de terceros según lo conocido (`NO_VERIFICADO`) |
| Chromecast del baño | destino de música; control desde iOS mediante la app de la plataforma de música o el SDK de Google Cast (`NO_VERIFICADO`) |

## Apple

> Revisado el 2026-09-28 por [ADR-0007](../adr/0007-native-iphone-first.md). La columna «V1 BRAIN-00» conserva la valoración original con PWA. La columna «Con app nativa» indica la ruta prevista ahora; todo lo que contiene es `NO VERIFICADO`.

| Fuente | Ruta realista | Clase | V1 BRAIN-00 (PWA) | Con app nativa (ADR-0007) | Notas y límites |
| --- | --- | --- | --- | --- | --- |
| Calendar | Atajo/ICS; EventKit nativo | C/D; B | Atajo o import | EventKit con permiso, lectura primero | la PWA no lee la base de Calendar; en nativo, permiso pedido al usar la función |
| Reminders | Atajos; EventKit nativo | C; B | Atajo limitado | EventKit con permiso | crear recordatorios es una escritura: requiere confirmación |
| Contacts | vCard/Atajo; Contacts framework | C/E; B | import seleccionado | selección de contactos concretos | no copiar la agenda completa sin necesidad |
| Notes | compartir/copiar/exportar notas elegidas | C/E | sí, manual | Share Extension | no existe API pública para la base completa |
| Photos | selector/cámara/Share Sheet; PhotoKit | B/C | selección manual | selector del sistema; captura con cámara; **bandeja diaria: lectura de capturas de pantalla nuevas y petición de borrado** (ADR-0008) | solo capturas de pantalla, no el resto de la fototeca; permiso de fototeca; el borrado muestra la confirmación de iOS |
| Files / iCloud Drive | file picker y export; document picker nativo | B/C/E | sí | document picker | acceso solo a archivos elegidos por el usuario |
| Health | HealthKit en app nativa y permisos granulares | B/F | no | sueño, pasos, actividad, estado de ánimo y ritmo cardiaco, por tipo de dato (G-11) | dato muy sensible; disponibilidad con cuenta gratuita `NO VERIFICADO` (D-03) |
| Location | Geolocation con permiso | B | opcional | llegada a casa (D-09); ciudad para la rutina nocturna | sin tracking continuo más allá de lo que Manu autorice |
| Batería | iPhone: API del sistema; Mac: app de Mac; AirPods: sin API pública conocida | B/G | no | iPhone y Mac | AirPods: `NO VERIFICADO`; alternativa: widget Baterías de Apple junto a los de MANU OS |
| Notificaciones de otras apps | — | G | no | no | una app de terceros no puede leer las notificaciones de otras apps |
| Maps | abrir URLs; MapKit/servidor según credenciales | B; A/F | enlaces | enlaces | Places/servicios avanzados no son núcleo |
| Safari | Atajo desde Share Sheet; extensión | C; B | sí | Share Extension | PWA no aparece como Web Share Target en Safari |
| Music | export manual; MusicKit/API requiere configuración y suscripción | E; A/F | no | Manu usa Spotify: ver «Servicios personales» | no usar historial musical como requisito |
| Messages | compartir mensajes seleccionados | C/E | manual | manual | lectura masiva directa: G |
| Mail | compartir/exportar; integrar proveedor (Gmail) | C/D/E; A | manual/Gmail | manual/Gmail | Apple Mail no ofrece API de buzón |
| Screen Time | APIs nativas restringidas/entitlements | F/G | no | no | no promete exportación del historial personal |
| Shortcuts / App Intents | App Intents propios; Atajos; URL scheme; Share Sheet | B/C | sí (Atajo) | sí: captura, cambio de modo, consultas | principal puente iOS V1; con app nativa pasan a ser App Intents propios |
| Focus | Focus configurado por Manu; filtros de Focus vía App Intents | B/C | no | señal de contexto para elegir modo | MANU OS no puede silenciar otras apps ni contactos por sí mismo |
| Home | HomeKit nativo | B/F | no | no en MVP | requiere permisos; valorar solo con caso de uso |
| Wallet | crear pases propios; no leer Wallet completo; disparador de transacciones de Atajos | B/C/F/G | no | posible entrada de gastos con el disparador «When I tap» de Atajos | acceso general al contenido: G. Qué datos entrega el disparador y con qué tarjetas funciona: `NO VERIFICADO` |
| Voice Memos | compartir/exportar audio seleccionado | C/E | sí, manual | Share Extension; grabación propia en la app | sin API para recorrer la biblioteca |
| Clipboard | pegar con gesto/permiso; Atajo | B/C | sí | sí | no vigilar portapapeles en background |
| Share extensions | Atajo; extensión nativa | C; B | Atajo | Share Extension propia | Web Share Target sigue sin soporte WebKit verificado |
| Widgets | WidgetKit | B | no disponible | sí | presupuesto de actualización del sistema; visibles bloqueado |
| Pantalla bloqueada | widgets de pantalla bloqueada | B | no disponible | sí | no mostrar contenido sensible |
| Centro de Control | controles de app | B | no disponible | sí, si la versión de iOS lo permite | `NO VERIFICADO` en el iPhone de Manu |
| Botón de acción | asignar App Intent o Atajo | B/C | Atajo | App Intent propio | **no disponible en el iPhone 14** |
| Toque posterior | ajuste de Accesibilidad que ejecuta un Atajo | C | no | abrir el chat de MANU como alternativa al botón de acción | lo configura Manu; `NO VERIFICADO` |
| Live Activities | ActivityKit | B | no disponible | sí, para algo en curso | duración limitada; visibles bloqueado; actualizaciones remotas pueden requerir notificaciones push y cuenta de desarrollador (`NO VERIFICADO`, D-03) |
| Alarma | AlarmKit (iOS 26 o posterior) para alarmas propias; app Reloj y Atajos; disparador «Is Stopped» de Atajos al detener una alarma | B/C | no | proponer la hora por la noche; Manu la confirma; al detenerla, lanzar la rutina de la mañana | AlarmKit requiere SDK de iOS 26 (D-04). `NO VERIFICADO` en el iPhone de Manu |
| Speech / transcripción | reconocimiento de voz en el dispositivo con permiso | B | no | transcribir audios capturados en la app | permiso de micrófono y de voz; preferir procesamiento en el dispositivo |
| Llamadas telefónicas | grabación del sistema si Manu la usa y comparte el audio; grabación propia en la app | B/C/E/G | no | solo importar audio que Manu comparta | una app de terceros no puede grabar llamadas del sistema de forma general: G. Consentimiento obligatorio; ver R-18 y R-19 |

**Conclusión Apple (BRAIN-00)**: V1 será buena capturando lo que Manu elija, no espiando ni sincronizando silenciosamente todo el iPhone. El companion nativo se evalúa después del MVP. *(Sustituida la segunda frase por ADR-0007.)*

**Conclusión Apple (ADR-0007)**: la primera frase sigue vigente. La app nativa y sus extensiones aparecen desde las primeras fases para que el iPhone se adapte a cada modo. MANU OS no controla el sistema: se apoya en Focus, Atajos y permisos que Manu concede.

## Momentos y servicios externos

Servicios necesarios para los casos de uso descubiertos. Ninguno está elegido ni verificado.

| Necesidad | Opciones candidatas | Clase | Restricciones |
| --- | --- | --- | --- |
| Previsión meteorológica de Gijón u Oviedo | WeatherKit (requiere Apple Developer Program, D-03); API pública gratuita; organismo meteorológico oficial | A/B/F | verificar condiciones y cuota; sin coste automático (ADR-0004); ciudades elegidas por Manu, sin rastreo (D-06) |
| Música en el baño | ver Spotify en «Servicios personales» | A/C | `NO VERIFICADO` |
| Tiempo de desplazamiento Gijón–Oviedo para proponer la alarma | valor fijo configurado por Manu; servicio de rutas | B/A/F | un servicio de rutas puede requerir credenciales o billing; empezar con un valor fijo |
| Calendario de trabajo | EventKit (calendarios del iPhone) o Google Calendar read-only | B; A | ver fila Calendar y sección Google |
| Resúmenes y tareas de llamadas | transcripción en el dispositivo; resumen con IA opcional mediante `AgentGateway` | B; A/F | ninguna IA es requisito; enviar una transcripción a un modelo requiere aprobación y registro de divulgación |

## Finanzas

| Ruta | Clase | Fase | Política |
| --- | --- | --- | --- |
| Captura de pantalla o foto de movimientos | B/C | después de G-07 | OCR en el dispositivo; importe, fecha y comercio se confirman (por lotes si se quiere) |
| Foto de ticket | B/C | después de G-07 | OCR en el dispositivo; mismas reglas |
| Entrada por voz | B | después de G-07 | transcripción con permiso; se confirma antes de guardar |
| Disparador de transacciones de Wallet (Atajos) | C | estudio | solo pagos con tarjetas de Wallet; datos disponibles `NO VERIFICADO` |
| Notificaciones de pago del banco | G | — | una app de terceros no puede leerlas |
| Extracto bancario exportado (PDF/CSV) | E | después de G-07 | se conserva el original con hash; el parser falla de forma visible ante un formato desconocido |
| Categoría del movimiento | — | después de G-07 | asignada automáticamente, marcada como inferida y corregible |
| Insights y avisos | — | después de datos confirmados | solo sobre movimientos confirmados; cada insight muestra de qué movimientos sale; primero aprende, luego propone límites |
| Open Banking / agregadores | A/F | estudio posterior | no entra en la Beta 1; implica credenciales o consentimientos bancarios, proveedores regulados y posibles costes; requiere ADR propio |

Reglas: MANU OS no inicia pagos, transferencias ni cambios en cuentas. Ningún dato financiero se envía a un modelo externo sin aprobación explícita del lote concreto. Los datos financieros no aparecen en superficies visibles con el iPhone bloqueado.

## Servicios de trabajo

| Servicio | Ruta realista | Clase | Límites |
| --- | --- | --- | --- |
| WhatsApp | exportación de chats elegidos (texto, sin multimedia inicialmente); compartir mensajes concretos; abrir chat con mensaje preparado mediante enlace | C/E | sin lectura continua ni API personal (G). La importación contiene datos de terceros |
| Instagram | compartir enlaces, texto o capturas a MANU OS | C | no se promete acceso a contenido ni a métricas. APIs para cuentas profesionales: `NO VERIFICADO` y fuera de la Beta 1 |
| TikTok | compartir enlaces, vídeo o capturas | C | transcripción solo si el contenido es accesible; no se promete |
| ManyChat | enlaces y capturas; API propia `NO VERIFICADO` (posible requisito de plan de pago) | C/F | fuera de la Beta 1 salvo verificación a 0 € |
| Correo | Gmail con OAuth y scopes mínimos (sección Google); compartir correos concretos | A/C | scopes de Gmail sensibles o restringidos |
| Google Drive | `drive.file` + selector (sección Google) | A | acceso amplio fuera de la Beta 1 |
| Canva | compartir diseños o enlaces | C | API propia `NO VERIFICADO` |

## Servicios personales

| Servicio | Ruta realista | Clase | Límites |
| --- | --- | --- | --- |
| Spotify | abrir la app o una lista mediante enlace profundo; Web API de Spotify para iniciar reproducción en un dispositivo concreto | C; A | según la documentación de Spotify, la Web API de reproducción **solo funciona con Spotify Premium** y requiere OAuth con permiso de control de reproducción. **No documenta Spotify DJ**. Iniciar DJ automáticamente: `NO VERIFICADO` |
| Chromecast / Google Home | Spotify Connect si el Chromecast aparece como dispositivo de Spotify; SDK de Google Cast | A/B | `NO VERIFICADO`; no se promete control de Google Home |
| Banco | ver «Finanzas» | E/G | sin conexión directa en la Beta 1 |
| Tiempo | ver «Momentos y servicios externos» (D-06) | A/B/F | — |

## Google Workspace

| Servicio | Clase | Prioridad | Scope/estrategia mínima | Riesgo de verificación |
| --- | --- | --- | --- | --- |
| Google Identity | A | alta | OIDC para identificar cuenta; separado de permisos de datos | bajo |
| Drive appDataFolder | A | alta | `drive.appdata`; blobs/eventos cifrados de MANU OS | scope no sensible; basic verification |
| Calendar | A | alta | empezar read-only y calendarios elegidos | scope sensible |
| Gmail | A | media | metadata primero; mensajes solo con caso de uso | scopes sensibles/restringidos |
| Drive archivos | A | media | `drive.file` + Picker antes de acceso amplio | `drive.file` recomendado; amplio puede ser restringido |
| Docs | A | media | documentos elegidos vía Drive; export versionada | depende del scope Drive/Docs |
| Sheets | A | media | hojas elegidas, lectura por rango | depende del scope |
| Tasks | A | media | listas elegidas, read-only primero | confirmar clasificación al implementar |
| Contacts / People | A | baja-media | read-only y selección | sensible |
| Maps / Places | A/F | baja | enlaces gratuitos; API solo tras aceptar billing | billing normalmente requerido |
| YouTube | A | baja | historial/datos solo si aporta valor demostrado | cuotas y OAuth |

Reglas Google:

- OAuth web-server con PKCE/state, librería mantenida y tokens fuera del frontend.
- Incremental authorization: no pedir Calendar/Gmail/Drive juntos.
- App en `Testing` expira refresh tokens a los 7 días; para uso estable debe publicarse/configurarse correctamente. El scope `drive.appdata` es no sensible, pero sigue necesitando configuración básica.
- Acceso amplio a Gmail/Drive puede exigir verificación y, si datos restringidos pasan por servidor, evaluación de seguridad. No entra en el MVP.
- Revocación, expiración y cuenta equivocada son estados normales de producto.

## IA y agentes

Decisión en [ADR-0009](../adr/0009-manu-assistant-without-mandatory-ai.md).

Manu tiene ChatGPT Plus, Claude Pro y Gemini Pro. Son **suscripciones de consumo**: no equivalen necesariamente a acceso API para una app propia, y MANU OS no las usará como si lo fueran. Según Apple, **Apple Intelligence no está disponible** en el iPhone 14 ni en Macs Intel.

| Integración | Clase | Papel | Política |
| --- | --- | --- | --- |
| Apps oficiales de ChatGPT, Claude y Gemini | C | tareas complejas: MANU prepara el contexto y abre la app | Manu decide qué comparte; sin automatizar cuentas |
| ChatGPT/OpenAI API | A/F o MCP | lectura/propuestas; nivel conversacional | solo con decisión explícita (D-08); nunca requisito |
| Claude API | A/F o MCP | análisis opcional | créditos temporales no son arquitectura; D-08 |
| Gemini API | A/F | agente opcional | una opción gratuita, si existe, no recibe salud, finanzas, Refugio ni chats privados sin decisión específica (G-13) |
| Apple Intelligence | B | — | no disponible en los dispositivos actuales de Manu |
| modelo local en el Mac | B | privacidad para tareas pequeñas | `NO VERIFICADO`; probablemente lento en un i5 de doble núcleo |
| MCP de MANU BRAIN | A/B | interfaz estándar de herramientas | read-only inicialmente, approvals para write |

MANU BRAIN nunca entrega el vault entero a un modelo. Recupera el mínimo conjunto de fragmentos, muestra el destino y registra la divulgación. Organización, memoria, búsqueda y automatizaciones funcionan sin ningún modelo.

## Importación histórica

| Fuente | Clase | Estrategia |
| --- | --- | --- |
| ChatGPT | E/D | ZIP oficial; preservar archivos; parser versionado |
| Claude | E/D | export oficial; preservar y parsear por versión |
| documentos/archivos | C/E | import explícito y hash |
| Notes | C/E | compartir o export manual |
| WhatsApp | E/D | export de chats elegido; texto completo cifrado (retención `FULL`); sin multimedia inicialmente; nunca acceso oculto |
| Google Workspace | A/D | sync incremental con cursor y scopes mínimos |

## Integraciones que no se prometerán

- leer todo iMessage/Messages;
- leer automáticamente Apple Notes;
- historial completo de Screen Time;
- control total de Focus/Home/Wallet desde la PWA ni desde la app nativa;
- Share Target nativo de la PWA en iOS;
- sync continuo fiable con la PWA o la app cerradas;
- «conectar cualquier app del iPhone» sin API, Shortcut o export;
- sustituir el launcher o cambiar globalmente el comportamiento de iOS;
- silenciar otras apps o contactos sin un Focus configurado por Manu;
- grabar automáticamente llamadas telefónicas del sistema;
- conexión directa con bancos, pagos o transferencias;
- leer notificaciones de otras apps (pagos, mensajes);
- detectar mensajes de personas prioritarias en WhatsApp o iMessage;
- iniciar Spotify DJ automáticamente sin una ruta verificada;
- batería de AirPods sin una API verificada;
- acceso completo a Instagram o TikTok;
- usar las suscripciones de consumo de ChatGPT, Claude o Gemini como API.
