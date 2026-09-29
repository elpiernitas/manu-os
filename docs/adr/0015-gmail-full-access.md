# ADR-0015 — Gmail con acceso de modificación

Status: **ACCEPTED** (decisión de Manu, 2026-09-29: «todo, […] acceso total, que pueda borrar, archivar, etiquetar, crear etiquetas…»; y que MANU vigile «TODO el correo», newsletters y bajas, la exportación de ChatGPT, recibos y gastos, y correos importantes)
Date: **2026-09-29**
Complementa: **ADR-0013**

## Contexto

Manu quiere que MANU le hable de su correo por iniciativa propia: por ejemplo, «te llegan muchos correos de X, ¿te doy de baja?», o que le avise cuando llegue la exportación de ChatGPT. También quiere que MANU pueda actuar sobre el correo. `AGENTS.md` exige una autorización específica de Manu para los servicios nuevos y las ampliaciones sensibles de permisos. Manu la dio en la sesión del 2026-09-29, primero con las opciones del chat y después aprobando cada paso en modo manual.

## Decisión

1. **Permiso `gmail.modify`**, pedido solo cuando Manu activa Gmail (Tú → Correo o Tú → Google). Permite leer, archivar, etiquetar y mandar a la papelera. **No incluye el borrado definitivo**: MANU nunca usa `DELETE` ni `batchDelete`, y la papelera se recupera durante 30 días. Quedó fuera a propósito aunque Manu pidió «que pueda borrar», para que un error siempre tenga vuelta atrás.
2. **Lectura mínima.** Se leen los últimos 30 días, hasta 200 correos, con `format=metadata`: remitente, asunto, fecha y cabeceras de baja. En esta versión no se lee el cuerpo de los correos.
3. **Resumen en el dispositivo.** En el vault solo se guardan los remitentes masivos con sus recuentos y su enlace de baja, los importantes sin leer (remitente y asunto) y si llegó la exportación de ChatGPT. Todo queda en el móvil y en su copia cifrada.
4. **Acciones.**
   - Archivar, etiquetar y papelera se hacen con un toque de Manu, desde una tarjeta, Tú → Correo o una propuesta del chat o de Gemini. Todas se pueden deshacer: `unarchive`, `untrash` y quitar la etiqueta.
   - Las acciones de correo **no** están entre las que MANU hace sin preguntar (`AUTO_SAFE`).
   - La baja abre la página de baja del remitente (`List-Unsubscribe` https) o el correo de baja (`mailto`). La CSP mantiene `form-action 'none'`, así que no se hace un POST silencioso.
5. **Gemini.**
   - El resumen de correo es la categoría sensible «Correo» del modo conversación. Se envía solo si está marcada; «Activar con todo» la incluye.
   - Gemini puede proponer `correo_baja`, `correo_archivar`, `correo_papelera` y `correo_etiquetar`. Cada propuesta necesita el toque de Manu.

## Consecuencias

- Como la app no tiene servidor, el correo solo se lee con la app abierta y mientras el permiso de Google siga válido (alrededor de 1 hora), o al pulsar «Actualizar». No hay avisos con la app cerrada.
- Google mostrará «app no verificada» al conceder un permiso restringido. Manu es el usuario de prueba del proyecto. Es NO_VERIFICADO que pueda continuar con su cuenta.
- Pendiente en otra tarea, porque exige leer el cuerpo:
  - recibos y gastos automáticos;
  - resúmenes del contenido de los correos importantes;
  - colores de etiqueta. La API solo acepta una paleta fija que no se ha verificado.
