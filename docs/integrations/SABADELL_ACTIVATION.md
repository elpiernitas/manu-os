# Sabadell AIS · Puesta en marcha (2026-11-09)

## Estado confirmado
- Enable Banking: aplicación personal de PRODUCCIÓN, restringida a las cuentas propias, activada tras vincular Banco Sabadell en el panel.
- MANU OS: interfaz Dinero y código de Edge Function `manu-bank` publicados en GitHub; **NO hay evidencia de una Edge Function bancaria desplegada en el Supabase real, ni de una sesión AIS activa ni de consulta de saldos**.
- En este chat, la conexión Supabase disponible **no devuelve** el proyecto personal `manu-os` (ref público: `xqsexjpuhvmwkclpnvjo`). No modificar ningún otro proyecto ni asumir que uno es equivalente.
- URL de callback que debe constar en Enable Banking:
  `https://xqsexjpuhvmwkclpnvjo.supabase.co/functions/v1/manu-bank`

## Estado real (2026-11-09, verificado por la API de gestión de Supabase)
- Proyecto `manu-os` (`xqsexjpuhvmwkclpnvjo`): `ACTIVE_HEALTHY`, plan `free`, sin complementos.
- Desplegado: migración `20261109140000_bank_ais.sql`, con RLS en `manu_bank_ais`, sin permisos para `anon`/`authenticated`; auditoría sin hallazgos. También `manu-bank` (v2, `verify_jwt=false`) y el secreto `MANU_BANK_CALLBACK_URL`.
- Desde fuera, con la clave pública, `manu_bank_ais` responde *permission denied*. La función responde 503 («todavía no configurada») a todo mientras falten `ENBANK_APP_ID` y `ENBANK_PRIVATE_KEY`. Esos dos los introduce el titular en Supabase → Edge Functions → Secrets.
- Correcciones de la auditoría:
  - `AccountResource.name` es el **nombre del titular**: ya no se guarda; la etiqueta es la descripción o `Cuenta ···1234`.
  - `status` y `start` comprueban `GET /application` (activa, `PRODUCTION`, AIS y callback registrado) antes de ir al banco.
  - La app atiende `#banco=connected|error`.
- Riesgo no resuelto: la clave RSA se compartió y el titular decidió no rotarla. Quien la tenga puede firmar peticiones como la aplicación. Sin el `session_id`, que solo está en el servidor, no puede leer cuentas, pero la conexión **no debe considerarse segura** mientras no se rote. El consentimiento se limita a 24 h para acotar ese riesgo.

## Corrección de callback implementada
El banco redirige por GET con `?code=...&state=...` sin JWT de Supabase. Dejar el valor por defecto `verify_jwt = true` hace que la plataforma bloquee esa vuelta antes de ejecutar la función. El archivo `supabase/config.toml` aplica `verify_jwt = false` **solo a manu-bank**.

La función, no la plataforma, autentica el regreso con un state aleatorio y de un uso, comparando su SHA-256 con el dato temporal almacenado en base de datos. Todos los POST que pueden acceder a una sesión bancaria exigen un JWT válido de usuario y llaman a `/auth/v1/user` antes de leer la tabla. `public.manu_bank_ais` tiene RLS y permisos de navegador revocados. La función no permite transferencias ni iniciación de pagos.

## Pasos para el proyecto correcto (aún no ejecutados)
1. Conectar el proyecto de Supabase correcto al entorno que vaya a desplegarlo. **Identificar mediante URL/ref**, no por parecido de nombres. No realizar cambios en proyectos que no correspondan.
2. Confirmar proyecto activo, plan/coste y que la URL de retorno de Enable Banking coincide exactamente con la anterior.
3. Ejecutar la migración versionada `supabase/migrations/20261109140000_bank_ais.sql` en el proyecto `manu-os`. Consultar advisers de seguridad y revisar que roles anon/authenticated NO pueden consultar la tabla.
4. Implantar la Edge Function `supabase/functions/manu-bank` con `verify_jwt = false` **solo para esta función**, teniendo presente que la protección de POST es la validación propia del handler.
5. Configurar en **secretos de Supabase** (nunca en GitHub, MANU web o chats):
   - `ENBANK_APP_ID` = UUID público de la aplicación Enable Banking.
   - `ENBANK_PRIVATE_KEY` = PEM PKCS#8 asociado al certificado de esa aplicación.
   - `MANU_BANK_CALLBACK_URL` = URL exacta de la Edge Function.
   - Comprobar los valores estándar de Supabase `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` o equivalentes compatibles.
   La primera clave RSA se compartió previamente en una conversación; **la recomendación sigue siendo rotarla**. El titular ha dicho expresamente que no quiere hacerlo. No se debe afirmar que esa clave sigue siendo privada; si decide continuar, debe introducirla directamente en el gestor de secretos del proveedor, sin pasársela a ningún asistente ni repositorio.
6. Prueba de seguridad **sin datos bancarios**: `POST /manu-bank` sin identidad retorna 401; `GET /manu-bank` sin state válido no abre sesión; `POST` autenticado con acción `status` devuelve `connected: false`. Comprobar CORS desde la PWA.
7. Solo cuando la prueba anterior pase: desde MANU OS → Tú → Tu nube (sesión iniciada) → Dinero → «Comprobar servidor» → «Conectar Sabadell». El titular realiza el consentimiento personal en el dominio oficial. Comprobar que tras el retorno aparece `connected: true` y **solo entonces** consultar un saldo o movimiento. No guardar movimientos en el vault.
8. Verificar cancelación de consentimiento y desconexión; probar iPhone/Safari real.

## Barreras honestas
- Los tests de GitHub/Node son estáticos o de módulos puros: no prueban una conexión bancaria real.
- Ningún coste/cargo se autoriza por estas instrucciones.
- La configuración `verify_jwt = false` no debe aplicarse globalmente ni a `manu-push`.
- No solicitar al usuario que pegue en chats el PEM, códigos de banco, IBAN o credenciales.
