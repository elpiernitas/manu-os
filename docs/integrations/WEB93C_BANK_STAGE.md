# WEB-93c — integración bancaria preparada sobre la versión con Fable

Implementación de solo lectura de Enable Banking, actualizada desde el PR #104 para no sobrescribir el rediseño de Hoy ni la lógica ya publicada.

## Incluido
- Backend Edge Function `manu-bank`, JWT firmado en servidor, autorización mediante `POST /auth`, callback de Supabase que canjea `code` con `POST /sessions`, lectura `GET /accounts/{uid}/balances` y `GET /accounts/{uid}/transactions`, revocación.
- Tabla con RLS y sin permisos de lectura/escritura para el cliente autenticado; uso exclusivo de service role de servidor.
- Pantalla Dinero: conexión opcional, saldo, movimientos bajo demanda, desconexión. Ningún movimiento se incorpora automáticamente a la memoria, gráficos o nube. Sin pagos, transferencias ni modificación de cuentas.
- Hoy: la fila Sabadell refleja únicamente un estado positivo si la app ha consultado con éxito al backend en esta sesión. Activar una aplicación restringida en el panel Enable Banking no se equipara a una sesión AIS real.
- Nuevas pruebas de aislamiento de secretos, RLS, y conservación de la navegación de Fable.
- Se reutiliza código validado por las pruebas del PR #104 y se mantiene el diseño Fable de Hoy.

## ESTADO
**No desplegado, no hay secretos instalados, no se ha usado la clave RSA aportada y no se ha consultado Sabadell**. La función está en GitHub, no ejecutándose en el Supabase real. El código de frontend puede publicarse sin claves: muestra el servidor como pendiente hasta que esté realmente disponible. La activación de la conexión bancaria real sigue bloqueada por seguridad; ningún despliegue de Supabase ni credencial se incluye en el merge de GitHub Pages.

## Antes de la puesta en producción
1. Reemplazar la clave privada RSA expuesta en la conversación por una nueva y verificar el certificado registrado en Enable Banking. Manu ha manifestado que no quiere hacerlo. En consecuencia no se utilizará dicha clave en esta implementación hasta resolver el riesgo. Esta decisión no impide seguir probando con claves ficticias.
2. Comprobar en Enable Banking que la redirección registrada coincide con `https://xqsexjpuhvmwkclpnvjo.supabase.co/functions/v1/manu-bank`.
3. Revisar contrato, plan y costes de uso personal restringido.
4. Desplegar migración y función solo con autorización de cambio en Supabase. Activar callback sin JWT, pero validar el state de un solo uso; el resto de operaciones valida el usuario autenticado en Supabase.
5. Configurar secretos en Supabase de manera que no aparezcan en git, frontend, informes ni chat. Probar primero con credenciales ficticias y un mock de la API oficial.
6. Autorizar personalmente el acceso en Sabadell a través del flujo oficial y comprobar el resultado con el usuario. No afirmar que hay saldo real hasta verificarlo.

## NO_VERIFICADO
Despliegue, verificación del binario Deno, prueba E2E real de callback, consumo de la API Sabadell, recepción en Safari/iPhone. Los tests de Node solo prueban partes aisladas; nunca constituyen autorización a producción.

Ver también `docs/integrations/ENABLE_BANKING_AIS.md`.
