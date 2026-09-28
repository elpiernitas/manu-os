# WEB-05 — Runbook de activación y verificación real

Status: **DRAFT — no ejecutar desde CI ni con datos reales en evidencias públicas**

## Propósito

Validar WEB-05 en el dispositivo de Manu sin introducir secretos ni datos personales en GitHub. La ejecución se realiza desde la app publicada; este documento solo define el procedimiento y los resultados esperados.

## Reglas de evidencia

- Usa exclusivamente textos sintéticos como `PRUEBA_MANU_2026`.
- No captures claves, tokens, correos, contactos, calendarios ni archivos reales.
- En GitHub registra solo PASS/FAIL, fecha, dispositivo/navegador y un error redactado.
- Si aparece una pantalla de consentimiento inesperada o un scope adicional, detente y revoca el acceso.

## Precondiciones

1. Confirmar que la URL publicada corresponde al commit esperado de `main`.
2. Exportar una copia local y comprobar que puede importarse.
3. Abrir un perfil/navegador de prueba sin datos personales.
4. Crear fuera de Git un cliente OAuth web limitado al origen y redirect URI publicados.
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

Crear más de 100 tareas sintéticas mediante un fixture local o cuenta de prueba preparada fuera del repositorio. Confirmar que una tarea de la segunda página permanece abierta. Interrumpir la red durante una página posterior y confirmar que la app informa «lista incompleta» y no cierra nada. Para Contacts, confirmar paginación y conservación de entradas locales ausentes.

### 4. Drive cifrado

1. Crear un vault sintético con el marcador `PRUEBA_MANU_2026`.
2. Elegir una frase larga exclusiva para la prueba y no registrarla.
3. Subir manualmente la copia.
4. Inspeccionar el contenido remoto mediante herramientas locales: el marcador no debe aparecer en claro.
5. En un perfil limpio, intentar una frase incorrecta (debe fallar) y después la correcta (debe restaurar).
6. Confirmar que la clave de Gemini no aparece en el vault restaurado.

### 5. Gemini

1. Pegar la clave con «Recordar» desactivado.
2. Enviar una frase no sensible solo después de revisar el payload.
3. Confirmar que no se incluyen historial, tareas ni agenda.
4. Probar un texto bloqueado sintético y confirmar que no se ofrece envío.
5. Cerrar la sesión y confirmar que la clave desaparece.
6. Simular falta de cuota o retirar la clave: el chat determinista debe seguir funcionando.

## Rollback y revocación

1. Desactivar todos los interruptores en la app.
2. Revocar el acceso de MANU OS desde la cuenta de Google.
3. Eliminar la clave de Gemini de la sesión y, si se activó «Recordar», del almacenamiento local.
4. Eliminar únicamente los artefactos sintéticos creados por esta prueba.
5. Restaurar la copia local exportada al inicio si fuera necesario.

## Registro de resultado

| Campo | Valor |
| --- | --- |
| Fecha | |
| Dispositivo y navegador | |
| Commit publicado | |
| Calendar / Tasks / Contacts / Drive / Gemini | PASS / FAIL / NO_VERIFICADO |
| Rollback probado | sí / no |
| Incidencias redactadas | |

Hasta completar este runbook con una cuenta real, el consentimiento en iOS, `hasGrantedAllScopes`, las cuotas reales y las llamadas reales permanecen **NO_VERIFICADO**.
