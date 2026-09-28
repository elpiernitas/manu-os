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

| Fuente | Ruta realista | Clase | V1 | Notas y límites |
| --- | --- | --- | --- | --- |
| Calendar | Atajo/ICS; EventKit nativo después | C/D; B/F | Atajo o import | la PWA no lee la base de Calendar |
| Reminders | Atajos; EventKit nativo | C; B/F | Atajo limitado | EventKit es nativo |
| Contacts | vCard/Atajo; Contacts framework | C/E; B/F | import seleccionado | no copiar agenda completa sin necesidad |
| Notes | compartir/copiar/exportar notas elegidas | C/E | sí, manual | no existe API web pública para la base completa |
| Photos | selector web/cámara/Share Sheet; PhotoKit futuro | B/C; B/F | selección manual | nunca barrer la fototeca automáticamente |
| Files / iCloud Drive | file picker y export; document picker nativo | B/C/E | sí | acceso solo a archivos elegidos por el usuario |
| Health | HealthKit en app nativa y permisos granulares | B/F | no | dato muy sensible; fase posterior y caso de uso previo |
| Location | Geolocation web con permiso; nativo futuro | B | opcional | sin tracking continuo en MVP |
| Maps | abrir URLs; MapKit/servidor según credenciales | B; A/F | enlaces | Places/servicios avanzados no son núcleo |
| Safari | Atajo desde Share Sheet; extensión nativa futura | C; B/F | sí | PWA no aparece como Web Share Target en Safari actualmente |
| Music | export manual; MusicKit/API requiere configuración y suscripción | E; A/F | no | no usar historial musical como requisito |
| Messages | compartir mensajes seleccionados | C/E | manual | lectura masiva directa: G |
| Mail | compartir/exportar; integrar proveedor (Gmail) | C/D/E; A | manual/Gmail | Apple Mail no ofrece API web de buzón |
| Screen Time | APIs nativas restringidas/entitlements | F/G | no | no promete exportación del historial personal |
| Shortcuts | POST autenticado, URL scheme y Share Sheet | C | sí | principal puente iOS V1 |
| Focus | Atajo/App Intents futuro | C; B/F | no | control/lectura limitada por diseño de iOS |
| Home | HomeKit nativo | B/F | no | requiere app nativa y permisos |
| Wallet | crear pases propios; no leer Wallet completo | B/F/G | no | acceso general al contenido: G |
| Voice Memos | compartir/exportar audio seleccionado | C/E | sí, manual | sin API para recorrer biblioteca |
| Clipboard | pegar con gesto/permiso; Atajo | B/C | sí | no vigilar portapapeles en background |
| Share extensions | Atajo ahora; extensión nativa después | C; B/F | Atajo | Web Share Target sigue sin soporte WebKit verificado |

**Conclusión Apple**: V1 será buena capturando lo que Manu elija, no espiando ni sincronizando silenciosamente todo el iPhone. El companion nativo se evalúa después del MVP.

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
- control total de Focus/Home/Wallet desde la PWA;
- Share Target nativo de la PWA en iOS;
- sync continuo fiable con la PWA cerrada;
- «conectar cualquier app del iPhone» sin API, Shortcut o export.
