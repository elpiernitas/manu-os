# ADR-0017 — Tu nube: sincronización cifrada con Supabase

Status: **ACCEPTED** (decisión de Manu, 2026-09-30: «todo lo que sea gratis te doy permiso para hacerlo tú libremente». Manu crea él mismo el proyecto Supabase gratuito `manu-os`, en la región West EU)
Date: **2026-09-30**
Complementa: **ADR-0012** y **ADR-0013**

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
