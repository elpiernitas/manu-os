# Avisos con MANU cerrada (push) — investigación WEB-98

Estado: **PROPUESTA, sin implementar.** Hace falta la autorización de Manu para activar algo en Supabase.

Etiquetas: VERIFICADO, TEÓRICAMENTE_POSIBLE, NO_VERIFICADO, DECIDIDO. Nada de esto se ha probado en el iPhone de Manu.

## 1. Qué hace falta de verdad

Un aviso con la app cerrada no lo puede crear la propia app: tiene que llegar del **servicio push de Apple**, y a ese servicio solo le escribe un **servidor** que tenga la clave privada VAPID de MANU. Por tanto:

1. **En el iPhone** (MANU desde el icono de inicio, iOS 16.4 o posterior, con permiso de avisos), MANU se suscribe con `PushManager.subscribe()` y obtiene un *endpoint*. TEÓRICAMENTE_POSIBLE ([Pushpad: requisitos en iOS](https://pushpad.xyz/blog/ios-special-requirements-for-web-push-notifications)).
2. **En un servidor** se guarda ese endpoint y *cuándo* avisar.
3. **A esa hora**, algo despierta al servidor, que firma con VAPID y manda el aviso.

Desde iOS 18.4, el mensaje puede ser **Declarative Web Push**: un JSON con `"web_push": 8030` y un objeto `notification` con `title` y `navigate`. iOS lo muestra aunque falle el service worker ([WebKit: Meet Declarative Web Push](https://webkit.org/?p=16535), [Pushpad](https://pushpad.xyz/blog/declarative-web-push)). TEÓRICAMENTE_POSIBLE.

Hoy MANU no tiene ese servidor (ADR-0012). Lo que sí funciona con la app cerrada es **Atajos**: el botón «Al iPhone» de cada recordatorio lo pasa a la app Recordatorios, y las automatizaciones de hora o de llegada.

## 2. Opciones

| Opción | Qué es | A favor | En contra | Valoración |
|---|---|---|---|---|
| **A. El Supabase de Manu** (ya existe, Tu nube) | Tabla `manu_push` con su RLS, una Edge Function que envía (VAPID), `pg_cron` + `pg_net` que la llaman cada minuto | Reutiliza la cuenta, el inicio de sesión y la RLS que ya tiene; 0 € en el plan gratuito según la documentación | Activa **piezas nuevas** del proyecto (Edge Functions, `pg_cron`, `pg_net`, un secreto VAPID); hay que desplegar la función una vez; el plan gratuito **pausa los proyectos inactivos una semana** | **Recomendada**, si Manu la autoriza |
| B. Seguir solo con Atajos | Recordatorios del iPhone y automatizaciones | Ya funciona; sin servidor; los datos no salen | No es dinámico: MANU no puede decidir «avísame ahora» con la app cerrada | Es lo que hay hoy |
| C. GitHub Actions programado | Un workflow `schedule` que mande los avisos | Ya existe el repositorio | El repositorio es **público** (registros visibles), la hora no es precisa y habría que guardar fuera las suscripciones y los horarios | Descartada |
| D. Servicio de terceros (OneSignal y similares) | Un proveedor de push | Fácil de integrar | Servicio y cuenta nuevos, SDK de terceros, datos fuera de Manu | Descartada |

Fuentes sobre Supabase: [programar Edge Functions con pg_cron](https://supabase.com/docs/guides/functions/schedule-functions), [Supabase Cron](https://supabase.com/modules/cron), [límites de las funciones](https://supabase.com/docs/guides/functions/limits.md), [precios](https://supabase.com/pricing). El cupo gratuito de invocaciones varía según la fuente (de 500.000 al mes en adelante): hay que comprobarlo en el panel. Un aviso por minuto como máximo son unas 43.200 al mes.

## 3. Diseño propuesto para la opción A (privacidad primero)

- **Qué guarda el servidor:**
  - el endpoint de cada dispositivo (es un secreto del dispositivo);
  - la lista de próximos avisos `{ at, kind }` de las 48 h siguientes;
  - **por defecto, sin texto:** el aviso dice «Tienes un recordatorio en MANU» y al tocarlo se abre MANU.
  - Mostrar el texto del recordatorio sería un ajuste que activa Manu, sabiendo que entonces ese texto se guarda en Supabase.
- **Quién escribe:** solo la sesión de Manu (RLS por `auth.uid()`), igual que `manu_sync`.
- **Qué manda:** la Edge Function solo envía a los endpoints de Manu y borra cada aviso ya enviado. Nunca escribe a otras personas (DECIDIDO: MANU solo habla con Manu).
- **Revocar:**
  - «Desactivar avisos con MANU cerrada» borra el endpoint y los avisos pendientes;
  - quitar el permiso en iOS invalida el endpoint, y la función lo borra al recibir un `410`.
- **Claves:**
  - la clave privada VAPID vive **solo** como secreto de la Edge Function;
  - nunca en el repositorio ni en el navegador;
  - la pública va en la app.

## 4. Qué tendría que hacer Manu (una vez)

Objetivo: lo mínimo y desde el iPhone si se puede, pero hay pasos que hoy exigen el panel de Supabase:

1. Autorizar la opción A.
2. En el panel de Supabase:
   - pegar un SQL (tabla, RLS, `pg_cron`);
   - crear la función pegando su código;
   - pegar la clave VAPID como secreto.

   Que todo esto se pueda hacer desde el navegador del iPhone, sin la CLI de Supabase, está NO_VERIFICADO.
3. En MANU: Tú → Avisos → «Avisos con MANU cerrada» → Activar.

## 5. Riesgos

- **Pausa por inactividad del plan gratuito:** si Tu nube no se usa en una semana, los avisos dejan de salir. Con el uso diario de MANU no debería pasar (NO_VERIFICADO).
- **Hora:** `pg_cron` cada minuto da hasta un minuto de retraso.
- **Apple puede limitar o descartar avisos** sin dar el motivo. Los atajos siguen como red de seguridad.
