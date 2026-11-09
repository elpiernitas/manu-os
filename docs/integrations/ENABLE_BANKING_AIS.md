# WEB-93b · Banco Sabadell / Enable Banking (solo lectura)

**Estado: IMPLEMENTADO EN RAMA, NO DESPLEGADO, NO CONECTADO A LA CUENTA REAL.**

## Qué está preparado
- Adaptador seguro Enable Banking AIS en Supabase Edge Functions (no PWA): firma JWT RS256 en el servidor; `GET /aspsps` para confirmar el nombre exacto del Sabadell; `POST /auth`; `POST /sessions`; `GET /accounts/{uid}/balances`; `GET /accounts/{uid}/transactions`; revocación con `DELETE /sessions/{id}`.
- `public.manu_bank_ais` con RLS y sin permisos de acceso a roles del navegador; identificador de sesión y estado OAuth solo en servidor.
- El callback de autorización apunta **a la función Supabase**, NO a la página estática GitHub Pages. La función valida un state aleatorio, de 10 minutos y un solo uso; canjea el código en servidor y redirige a la PWA sin secretos en la URL.
- En Dinero aparece una tarjeta de banco con conexión, saldo, movimientos recientes y desconexión. Solo muestra los datos solicitados; **no los añade automáticamente al vault ni a Tu nube**.
- Exige un usuario autenticado en `Tu nube` para todas las operaciones salvo el callback, que valida el state.
- La función **no implementa pagos ni transferencias**.

## Qué falta antes de activar la conexión real
1. **Rotación de la clave RSA:** el archivo privado `.pem` de la aplicación se compartió en una conversación. No usarlo como secreto de producción. Generar una clave nueva y registrarla con Enable Banking antes de conectar datos reales. No pegar secretos en chats, capturas ni repositorios. Esta operación es manual de Manu.
2. Actualizar en Enable Banking la lista blanca de redirecciones y añadir **exactamente**:
   `https://xqsexjpuhvmwkclpnvjo.supabase.co/functions/v1/manu-bank`
   La URL antigua `https://elpiernitas.github.io/manu-os/banco/vuelta/` no es apropiada para un nuevo consentimiento: un `?code=` podría quedar registrado en el hosting estático. Evitar utilizarla con banca real.
3. Verificar que la aplicación de Enable Banking sigue activa y restringida únicamente a cuentas propias y que no existe ningún coste o condición comercial nueva.
4. Configurar los secretos del proyecto **personal** de Supabase (en servidor, nunca en `web/`):
   - `ENBANK_APP_ID`: UUID público de la aplicación.
   - `ENBANK_PRIVATE_KEY`: clave RSA **nueva** en PEM PKCS#8, guardada únicamente como secreto de Edge Function (con saltos de línea o secuencias `\\n`).
   - `MANU_BANK_CALLBACK_URL`: exactamente la URL de la función indicada arriba.
   Supabase aporta `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_ANON_KEY` o su equivalente disponible.
5. Verificar en el proyecto real los permisos de la migración, funciones, entorno y la ausencia de claves en logs. **No ejecutar migraciones de producción ni desplegar sin confirmación tras la rotación.**
6. Desplegar primero en entorno de pruebas con secretos ficticios. Probar la callback y el canje simulado. Solo después autorizar personalmente el consentimiento bancario desde la app.
7. Desde MANU OS: Tú → Tu nube (iniciar sesión); Dinero → Comprobar conexión → Conectar Sabadell. Manu inicia sesión en el banco exclusivamente en la web oficial. Una vez completado: Dinero → Comprobar conexión → Ver saldo / Últimos movimientos.

## Alcance y límites
- Acceso AIS exclusivamente a cuentas vinculadas a la aplicación restringida. El registro/activación previo de Enable Banking **no crea por sí mismo** la sesión de API.
- Los datos financieros se reciben en memoria al consultar, no se guardan automáticamente en el dispositivo, en Supabase o en la IA. La UI limita a 30 movimientos por pantalla y el servidor a 100 por página.
- Los importadores CSV/Excel actuales siguen funcionando sin banco.
- Los movimientos que devuelve el banco pueden incluir comercios y nombres de terceros; por eso se minimizan y se escapan al presentar HTML.
- El campo `continuation_key` existe en la API pero la primera versión muestra una sola página, sin carga incremental.
- La validez del consentimiento depende del banco. Se usa un máximo solicitado inicial de 24 horas para no exceder límites desconocidos. Se pedirá una autorización nueva cuando expire.
- Se requiere navegador y conexión a Internet. El saldo no funciona offline.
- La función no ofrece procesamiento automático en segundo plano ni sincronización de movimientos: esto requeriría otra decisión de producto.
- No se ha comprobado una sesión real, datos reales de Sabadell, ni el flujo completo de autorizaciones iOS: **NO_VERIFICADO**.

## Referencias oficiales
- https://enablebanking.com/docs/api/reference/
- https://enablebanking.com/docs/api/control-panel/
- https://enablebanking.com/docs/faq/

## Seguridad
Se prohíbe copiar la clave a GitHub, a `web/`, al vault o a la conversación. Aunque la clave se mantenga en un secreto de Supabase, el operador del proyecto con privilegios suficientes puede leerla. No se promete cifrado de extremo a extremo ni infalibilidad del proveedor. La página de callback debe responder siempre con `Cache-Control: no-store` y `Referrer-Policy: no-referrer`.
