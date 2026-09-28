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

## Apple

> Revisado el 2026-09-28 por [ADR-0007](../adr/0007-native-iphone-first.md). La columna «V1 BRAIN-00» conserva la valoración original con PWA. La columna «Con app nativa» indica la ruta prevista ahora; todo lo que contiene es `NO VERIFICADO`.

| Fuente | Ruta realista | Clase | V1 BRAIN-00 (PWA) | Con app nativa (ADR-0007) | Notas y límites |
| --- | --- | --- | --- | --- | --- |
| Calendar | Atajo/ICS; EventKit nativo | C/D; B | Atajo o import | EventKit con permiso, lectura primero | la PWA no lee la base de Calendar; en nativo, permiso pedido al usar la función |
| Reminders | Atajos; EventKit nativo | C; B | Atajo limitado | EventKit con permiso | crear recordatorios es una escritura: requiere confirmación |
| Contacts | vCard/Atajo; Contacts framework | C/E; B | import seleccionado | selección de contactos concretos | no copiar la agenda completa sin necesidad |
| Notes | compartir/copiar/exportar notas elegidas | C/E | sí, manual | Share Extension | no existe API pública para la base completa |
| Photos | selector/cámara/Share Sheet; PhotoKit | B/C | selección manual | selector del sistema; captura con cámara | nunca barrer la fototeca automáticamente |
| Files / iCloud Drive | file picker y export; document picker nativo | B/C/E | sí | document picker | acceso solo a archivos elegidos por el usuario |
| Health | HealthKit en app nativa y permisos granulares | B/F | no | no | dato muy sensible; fase posterior y caso de uso previo |
| Location | Geolocation con permiso | B | opcional | ubicación puntual con permiso, si un caso lo necesita | sin tracking continuo en MVP |
| Maps | abrir URLs; MapKit/servidor según credenciales | B; A/F | enlaces | enlaces | Places/servicios avanzados no son núcleo |
| Safari | Atajo desde Share Sheet; extensión | C; B | sí | Share Extension | PWA no aparece como Web Share Target en Safari |
| Music | export manual; MusicKit/API requiere configuración y suscripción | E; A/F | no | acceso para iniciar música en modo Mañana: Atajo o App Intent del sistema | no usar historial musical como requisito; reproducir en un altavoz concreto depende de la ruta, `NO VERIFICADO` |
| Messages | compartir mensajes seleccionados | C/E | manual | manual | lectura masiva directa: G |
| Mail | compartir/exportar; integrar proveedor (Gmail) | C/D/E; A | manual/Gmail | manual/Gmail | Apple Mail no ofrece API de buzón |
| Screen Time | APIs nativas restringidas/entitlements | F/G | no | no | no promete exportación del historial personal |
| Shortcuts / App Intents | App Intents propios; Atajos; URL scheme; Share Sheet | B/C | sí (Atajo) | sí: captura, cambio de modo, consultas | principal puente iOS V1; con app nativa pasan a ser App Intents propios |
| Focus | Focus configurado por Manu; filtros de Focus vía App Intents | B/C | no | señal de contexto para elegir modo | MANU OS no puede silenciar otras apps ni contactos por sí mismo |
| Home | HomeKit nativo | B/F | no | no en MVP | requiere permisos; valorar solo con caso de uso |
| Wallet | crear pases propios; no leer Wallet completo | B/F/G | no | no | acceso general al contenido: G |
| Voice Memos | compartir/exportar audio seleccionado | C/E | sí, manual | Share Extension; grabación propia en la app | sin API para recorrer la biblioteca |
| Clipboard | pegar con gesto/permiso; Atajo | B/C | sí | sí | no vigilar portapapeles en background |
| Share extensions | Atajo; extensión nativa | C; B | Atajo | Share Extension propia | Web Share Target sigue sin soporte WebKit verificado |
| Widgets | WidgetKit | B | no disponible | sí | presupuesto de actualización del sistema; visibles bloqueado |
| Pantalla bloqueada | widgets de pantalla bloqueada | B | no disponible | sí | no mostrar contenido sensible |
| Centro de Control | controles de app | B | no disponible | sí, si la versión de iOS lo permite | `NO VERIFICADO` en el iPhone de Manu |
| Botón de acción | asignar App Intent o Atajo | B/C | Atajo | App Intent propio | solo en modelos con botón de acción |
| Live Activities | ActivityKit | B | no disponible | sí, para algo en curso | duración limitada; visibles bloqueado; actualizaciones remotas pueden requerir notificaciones push y cuenta de desarrollador (`NO VERIFICADO`, D-03) |
| Alarma | app Reloj del sistema; API de alarmas de terceros si existe en la versión de iOS usada | B/C | no | acceso o Atajo; alarma propia solo si la API está disponible | `NO VERIFICADO`; no prometer sustituir la app Reloj |
| Speech / transcripción | reconocimiento de voz en el dispositivo con permiso | B | no | transcribir audios capturados en la app | permiso de micrófono y de voz; preferir procesamiento en el dispositivo |
| Llamadas telefónicas | grabación del sistema si Manu la usa y comparte el audio; grabación propia en la app | B/C/E/G | no | solo importar audio que Manu comparta | una app de terceros no puede grabar llamadas del sistema de forma general: G. Consentimiento obligatorio; ver R-18 y R-19 |

**Conclusión Apple (BRAIN-00)**: V1 será buena capturando lo que Manu elija, no espiando ni sincronizando silenciosamente todo el iPhone. El companion nativo se evalúa después del MVP. *(Sustituida la segunda frase por ADR-0007.)*

**Conclusión Apple (ADR-0007)**: la primera frase sigue vigente. La app nativa y sus extensiones aparecen desde las primeras fases para que el iPhone se adapte a cada modo. MANU OS no controla el sistema: se apoya en Focus, Atajos y permisos que Manu concede.

## Momentos y servicios externos

Servicios necesarios para los casos de uso descubiertos. Ninguno está elegido ni verificado.

| Necesidad | Opciones candidatas | Clase | Restricciones |
| --- | --- | --- | --- |
| Previsión meteorológica de Gijón u Oviedo | servicio meteorológico del sistema de Apple; API pública gratuita sin clave; organismo meteorológico oficial | A/B/F | verificar condiciones, cuota y si alguna requiere cuenta de desarrollador de pago; sin coste automático (ADR-0004); ubicación fija elegida por Manu, sin rastreo |
| Música en el baño | Atajo o App Intent que abre la app de música o reproduce en un altavoz | C | depende de la app de música y del altavoz que use Manu; `NO VERIFICADO` |
| Calendario de trabajo | EventKit (calendarios del iPhone) o Google Calendar read-only | B; A | ver fila Calendar y sección Google |
| Resúmenes y tareas de llamadas | transcripción en el dispositivo; resumen con IA opcional mediante `AgentGateway` | B; A/F | ninguna IA es requisito; enviar una transcripción a un modelo requiere aprobación y registro de divulgación |

## Finanzas

| Ruta | Clase | Fase | Política |
| --- | --- | --- | --- |
| Captura de pantalla o foto de movimientos | B/C | después de G-07 | OCR en el dispositivo; cada movimiento extraído entra como `PROPOSED` hasta que Manu lo confirma |
| Extracto bancario exportado (PDF/CSV) | E | después de G-07 | se conserva el original con hash; el parser falla de forma visible ante un formato desconocido |
| Insights | — | después de datos confirmados | solo sobre movimientos confirmados; cada insight muestra de qué movimientos sale |
| Open Banking / agregadores | A/F | estudio posterior | no entra en MVP; implica credenciales o consentimientos bancarios, proveedores regulados y posibles costes; requiere ADR propio |

Reglas: MANU OS no inicia pagos, transferencias ni cambios en cuentas. Ningún dato financiero se envía a un modelo externo sin aprobación explícita del lote concreto. Los datos financieros no aparecen en superficies visibles con el iPhone bloqueado.

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

| Integración | Clase | Papel | Política |
| --- | --- | --- | --- |
| ChatGPT/OpenAI | A/F o MCP | lectura/propuestas | BYO API opcional; nunca requisito |
| Claude | A/F o MCP | implementador y análisis opcional | créditos temporales no son arquitectura |
| Gemini | A/F | agente opcional cercano a Google | adapter; desactivado sin cuota/clave |
| modelo local en Mac | B | privacidad para tareas pequeñas | investigar después del MVP |
| MCP de MANU BRAIN | A/B | interfaz estándar de herramientas | read-only inicialmente, approvals para write |

MANU BRAIN nunca entrega el vault entero a un modelo. Recupera el mínimo conjunto de fragmentos, muestra el destino y registra la divulgación.

## Importación histórica

| Fuente | Clase | Estrategia |
| --- | --- | --- |
| ChatGPT | E/D | ZIP oficial; preservar archivos; parser versionado |
| Claude | E/D | export oficial; preservar y parsear por versión |
| documentos/archivos | C/E | import explícito y hash |
| Notes | C/E | compartir o export manual |
| WhatsApp | E/D | export de chats elegido; nunca acceso oculto |
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
- conexión directa con bancos, pagos o transferencias.
