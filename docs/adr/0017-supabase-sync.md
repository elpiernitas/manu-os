# ADR-0017 — Tu nube: sincronización con Supabase

Status: **ACCEPTED** (decisión de Manu, 2026-09-30: «todo lo que sea gratis te doy permiso para hacerlo tú libremente». Manu crea él mismo el proyecto Supabase gratuito `manu-os`, en la región West EU)
Date: **2026-09-30**
Complementa: **ADR-0012** y **ADR-0013**

> **Nota (WEB-87, 2026-10-04):** el archivo se llamaba `0017-encrypted-sync-supabase.md`. Se renombra porque, desde la enmienda WEB-67, Tu nube **no cifra** el vault (decisión de Manu). La decisión 2 de abajo es histórica; lo vigente está en las enmiendas.

## Contexto

MANU guarda todo en el dispositivo (ADR-0012). Manu quiere tener lo mismo en el iPhone y en el Mac, y un sitio privado para sus datos que no sea el repositorio público. Netlify con un «enlace privado» no es privado, así que se descarta. Supabase tiene un plan gratuito. Sus límites (unos 500 MB y pausa tras una semana sin uso) son NO_VERIFICADOS y hay que comprobarlos en su web.

## Decisión

1. **Proyecto de Manu.** Manu crea el proyecto y le pertenece; la app se conecta a él con la clave *publishable*. La clave secreta (`sb_secret_`, `service_role`) nunca entra en la app ni en el repositorio, y la app la rechaza si se pega.
2. **Cifrado en el dispositivo.**
   - El vault se cifra con AES-256-GCM antes de salir, igual que la copia completa (`core/crypto.js`).
   - La clave se deriva con PBKDF2 (600 000 rondas) de una frase que solo sabe Manu y de una sal fija por cuenta.
   - Se guarda como `CryptoKey` no extraíble en la base IndexedDB `manu-sync-key`, que queda fuera de las copias.
   - Cada subida usa un IV nuevo. Supabase solo ve datos ilegibles.
3. **Nada de secretos guardados.** La frase y la contraseña no se guardan. La sesión va en `manuos.nube.token`, que las copias excluyen por su nombre. «Borrar todo» también borra la clave.
4. **Tabla `manu_sync` con RLS.** Cada usuario solo ve su fila. Se revoca `anon` y no se concede `DELETE`. Un `rev` entero hace que ningún dispositivo sobrescriba a otro en silencio: si hay cambios en los dos, MANU pregunta con cuál quedarse.
5. **CSP.** `connect-src` permite solo el host del proyecto de Manu, no `*.supabase.co`. Un XSS no puede enviar datos a otro proyecto.
6. **Alcance v1.** Se sincroniza el vault. «Tu archivo» (ChatGPT) y las fotos siguen en cada dispositivo; subirlos exigiría Supabase Storage, en otra tarea.

## Consecuencias

- Si Manu olvida la frase, lo de la nube no se recupera. Lo de cada dispositivo sigue intacto.
- La sincronización ocurre con la app abierta: al abrirla, al volver a ella y unos segundos después de cada cambio. No hay sincronización en segundo plano.
- Si Manu cambia de proyecto, hay que cambiar la CSP y `NUBE_URL`.
- Mientras la tabla no esté creada (el SQL está en Tú → Tu nube), la app lo dice.
- Recomendación a Manu: después de crear su cuenta, desactivar en Supabase «Allow new users to sign up».

## Enmienda (2026-09-30, WEB-67) — código por correo y sin frase

En la primera prueba real, la frase del iPhone no coincidió con la del Mac. Manu pidió algo más fácil: «dime el código que te llega al correo». Se le presentaron tres opciones:
- código por correo y emparejamiento con cifrado;
- código por correo **sin cifrar**;
- dejarlo como estaba.

**Manu eligió «Solo código por correo, sin cifrar».**

Cambia lo siguiente:
- **Acceso:** código de un solo uso por correo (`/auth/v1/otp` con `create_user: false` y `/auth/v1/verify`). No hay contraseña. Si la plantilla aún manda un enlace, la app acepta la sesión que llega en el fragmento de la URL.
- **Sin cifrado de extremo a extremo:** el vault va tal cual en la fila `manu_sync`, protegido por RLS (solo su usuario) y por su sesión. Supabase, como empresa, técnicamente puede leerlo; la pantalla Tu nube lo dice.
- **Clave publishable en el código** (`NUBE_KEY`): es pública por diseño y la usan todas las webs con Supabase. Lo que protege es la RLS. La clave secreta sigue fuera, y `configProblem` la rechaza.
- **Migración:** la fila cifrada de WEB-64 (un vault vacío del Mac) no se puede leer, así que los datos de un dispositivo la sustituyen. La base IndexedDB `manu-sync-key` se borra.

Siguen igual: RLS por usuario, `rev` con aviso de conflicto, CSP limitada al host de Manu, sesión en `manuos.nube.token` fuera de las copias, y que Tu archivo y las fotos se quedan en cada dispositivo.

## Enmienda WEB-86 (2026-10-03): buzón del atajo «MANU Dinero»

El atajo del doble toque no puede abrir la app instalada. Por eso deja su línea en una tabla `manu_inbox` del Supabase de Manu, y MANU la recoge al abrirse y la borra.

- **Permiso nuevo, solo si Manu lo activa:** el rol `anon` (la clave publishable) puede **insertar** en `manu_inbox` las columnas `token` y `line`. No puede leer ni borrar nada.
- **Quién lee:** solo la sesión de Manu puede leer o borrar, y solo las líneas con el código de su cuenta (`manu_inbox_owner`, con RLS por `auth.uid()`).
- **El código:**
  - lo genera el dispositivo de Manu (24 bytes aleatorios);
  - se copia a mano en el atajo;
  - se guarda en el vault, que es local y va a Tu nube.
- **Riesgo aceptado:** quien tenga la clave publishable, que es pública, podría llenar la tabla de líneas. Nadie las leería sin el código, y cada línea está limitada a 300 caracteres.
- **Cómo se activa:** el SQL está en `web/core/sync.js` (`INBOX_SQL`) y Manu lo ejecuta una vez en el SQL Editor. Sin él, el atajo puede escribir en `MANU-buzon.txt`.
- **Comprobado (2026-10-05):** Manu ejecutó el SQL y un gasto enviado desde el atajo llegó a MANU una sola vez. El atajo se genera con `tools/shortcuts/atajos.py` (sin el código, que pide el iPhone).
