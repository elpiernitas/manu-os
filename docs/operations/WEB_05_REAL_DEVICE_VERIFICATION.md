# WEB-05 — Runbook de activación y verificación real

Status: **REVISADO CONTRA EL CÓDIGO DE `main` (PR #13, `7c16024`) — pendiente de ejecución por Manu. No ejecutar desde CI ni con datos reales en evidencias públicas.**

## Propósito

Validar WEB-05 en el dispositivo de Manu sin introducir secretos ni datos personales en GitHub. La ejecución se realiza desde la app publicada; este documento solo define el procedimiento y los resultados esperados.

## Niveles de evidencia

| Nivel | Significado |
| --- | --- |
| `VERIFICADO` | Comprobado con evidencia reproducible. Hoy solo cubre lo probado con **mocks**: 45/45 pruebas unitarias (`cd web && npm test`) y Chromium headless con Google, Drive y Gemini simulados (scopes por función, payload visible, confirmación por petición, sobre cifrado, paginación sin cierres falsos). |
| `TEÓRICAMENTE_POSIBLE` | Se deduce del código o de la documentación de Google, sin haberlo ejecutado: CORS hacia las APIs (preflight comprobado sin credenciales), comportamiento del consentimiento, cupos gratuitos. |
| `NO_VERIFICADO` | Requiere cuenta o dispositivo reales: llamadas reales a Calendar, Tasks, People, Drive y Gemini; consentimiento en iOS; `hasGrantedAllScopes` con Google real; cuotas reales; borrado de datos ocultos de Drive. |

Este runbook solo puede cambiar un `NO_VERIFICADO` a `VERIFICADO` cuando Manu lo ejecute y registre el resultado. Los mocks no lo sustituyen.

## Reglas de evidencia

- Usa exclusivamente textos sintéticos como `PRUEBA_MANU_2026`.
- No captures claves, tokens, correos, contactos, calendarios ni archivos reales.
- En GitHub registra solo PASS/FAIL, fecha, dispositivo/navegador y un error redactado.
- Usa una cuenta de Google de prueba dedicada, no la principal, sobre todo para el fixture de más de 100 tareas.
- No pegues en GitHub ni en capturas cabeceras `Authorization`, respuestas de red sin redactar ni el ID de cliente OAuth. El ID no es secreto, pero identifica tu proyecto.
- Si aparece una pantalla de consentimiento inesperada o un scope adicional, detente y revoca el acceso.

## Precondiciones

1. Confirmar que el workflow `MANU OS web` de `main` terminó en verde para el commit esperado (`7c16024` o posterior) y que Pages está publicado. La app no muestra el SHA: compara la fecha del despliegue en Actions y, tras recargar, la versión de la caché del service worker (`manuos-v5` en `web/sw.js`).
2. En «Tú», «Descargar copia» y guardarla fuera de Git. Comprobar que «Restaurar copia» la acepta (es el punto de retorno del rollback).
3. Abrir un perfil/navegador de prueba sin datos personales.
4. Crear fuera de Git un cliente OAuth web con «Orígenes de JavaScript autorizados» = `https://elpiernitas.github.io`. La app usa Google Identity Services en modo token: no hay redirect URI. No crees ni pegues el «secreto de cliente»; no se usa.
5. Mantener la clave de Gemini fuera de Git; no activar «Recordar» en la primera prueba.

## Matriz de validación

| Función | Permiso esperado | Prueba sintética | PASS |
| --- | --- | --- | --- |
| Calendar | `calendar.events` | crear y leer un evento `PRUEBA_MANU_2026` | solo se pide ese scope y el evento aparece |
| Tasks | `tasks` | crear, completar y traer una tarea sintética | sincronización bidireccional sin cierres falsos |
| Contacts | `contacts.readonly` | usar un contacto de prueba sin notas reales | solo lectura; no se borra ningún contacto local ausente |
| Drive | `drive.appdata` | subir y restaurar un vault sintético | archivo cifrado, sin marcador en claro, restauración correcta |
| Gemini | clave de sesión | enviar una frase no sensible | payload visible, confirmación por petición y clave no persistente |

## Procedimiento

### 1. Modo local

1. Arrancar sin Google ni Gemini.
2. Crear una tarea, gasto y recordatorio sintéticos.
3. Recargar y confirmar que siguen disponibles.
4. Resultado esperado: todas las funciones locales siguen operativas.

### 2. Permisos incrementales

Para cada función de Google, partir de una sesión revocada o limpia, activar solo esa función y comprobar que la pantalla de consentimiento contiene únicamente el scope de la matriz. Denegar una vez y confirmar que las demás funciones y el modo local siguen funcionando.

### 3. Tasks y Contacts

Crear más de 100 tareas sintéticas en la cuenta de prueba (fuera del repositorio; los mocks ya cubren la paginación, aquí se comprueba con Google real). Confirmar que una tarea de la segunda página permanece abierta. Interrumpir la red durante una página posterior y confirmar que la app informa «lista incompleta» y no cierra nada. Para Contacts, confirmar paginación y conservación de entradas locales ausentes.

### 4. Drive cifrado

1. Crear un vault sintético con el marcador `PRUEBA_MANU_2026`.
2. Elegir una frase larga exclusiva para la prueba y no registrarla.
3. Subir manualmente la copia.
4. El archivo vive en `appDataFolder`, que no aparece en la interfaz de Drive. Inspecciónalo en las herramientas de desarrollo del navegador (pestaña Red, respuesta de la descarga): debe ser un JSON con `format`, `v`, `kdf` y `ct` en base64 y sin `PRUEBA_MANU_2026`. No copies ni captures la cabecera `Authorization`.
5. En un perfil limpio, intentar una frase incorrecta (debe fallar) y después la correcta (debe restaurar).
6. Confirmar que la clave de Gemini no aparece en el vault restaurado.

### 5. Gemini

1. Pegar la clave con «Recordar» desactivado.
2. Enviar una frase no sensible solo después de revisar el payload.
3. Confirmar que no se incluyen historial, tareas ni agenda.
4. Probar un texto bloqueado sintético (por ejemplo `PRUEBA me duele la cabeza, cita con el médico`, nunca datos reales) y confirmar que no se ofrece envío. El filtro es de mejor esfuerzo: lo que protege es la confirmación por petición.
5. Pulsar «Borrar clave» y comprobar que desaparece. Después cerrar la app por completo, reabrirla y comprobar que, sin «Recordar», la clave no vuelve.
6. Simular falta de cuota o retirar la clave: el chat determinista debe seguir funcionando.

## Rollback y revocación

1. Desactivar todos los interruptores en la app.
2. Revocar el acceso de MANU OS desde la cuenta de Google.
3. Los archivos de `appDataFolder` no se borran al revocar. Eliminarlos desde la cuenta de Google (Seguridad → Conexiones de terceros → MANU OS → gestión de datos de la app), si esa opción aparece; si no aparece, dejarlo como `NO_VERIFICADO`. Un archivo cifrado sin la frase no es legible.
4. Eliminar la clave de Gemini de la sesión y, si se activó «Recordar», del almacenamiento local.
5. Eliminar únicamente los artefactos sintéticos creados por esta prueba.
6. Restaurar la copia local exportada al inicio si fuera necesario.

## Registro de resultado

| Campo | Valor |
| --- | --- |
| Fecha | |
| Dispositivo y navegador | |
| Commit publicado | |
| Calendar | PASS / FAIL / NO_VERIFICADO |
| Tasks | PASS / FAIL / NO_VERIFICADO |
| Contacts | PASS / FAIL / NO_VERIFICADO |
| Drive | PASS / FAIL / NO_VERIFICADO |
| Gemini | PASS / FAIL / NO_VERIFICADO |
| Rollback probado | sí / no |
| Incidencias redactadas | |

Hasta completar este runbook con una cuenta real, el consentimiento en iOS, `hasGrantedAllScopes`, las cuotas reales y las llamadas reales permanecen **NO_VERIFICADO**.
