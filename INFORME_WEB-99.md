# Informe WEB-99 · Avisos con MANU cerrada, sincronización selectiva y recuerdos que no vuelven

**Resumen:** los avisos push están **implementados y probados**, y he comprobado tu Supabase real: plan gratuito, sin complementos de pago, **sin riesgo de facturación**.

Pero tu proyecto está **pausado**: el plan gratuito lo pausa tras una semana sin uso. Para activar los avisos hay que reactivarlo, y el sistema de permisos de mi entorno lo bloqueó. **Necesito tu permiso explícito** para ese paso. Después, todo lo demás es un solo comando: sin SQL ni panel.

Además:
- Tus conversaciones ya no suben a Tu nube.
- Los recuerdos sobre otras personas solo viajan si los autorizas; los íntimos, nunca.
- Lo que olvidas no reaparece en un conflicto.

---

## 1. Lo verificado en tu Supabase (API real, solo lectura)

| Comprobación | Resultado |
|---|---|
| Plan | **Gratuito** (`free`) |
| Complementos de pago | **Ninguno** |
| Proyecto `manu-os` | **Pausado** (`INACTIVE`). Por eso Tu nube tampoco sincroniza ahora mismo |
| Copias de seguridad / PITR | **Ninguna** (lo que se borra no queda en una copia del proveedor) |
| Funciones desplegadas | Ninguna |
| Cuotas gratuitas ([precios de Supabase](https://supabase.com/pricing)) | 500.000 invocaciones al mes, 500 MB de base de datos y 2 proyectos activos (tienes 1) |

**Consumo esperado:** el temporizador solo llama a la función cuando hay un aviso pendiente. Con unos pocos recordatorios al día son decenas de invocaciones al mes, muy lejos de 500.000. Esto es una estimación; el número real lo verás en el panel.

**Recomendación de seguridad:** tu cuenta de Supabase **no tiene la verificación en dos pasos** activada. Te recomiendo activarla. Y cuando terminemos, borra el token de acceso que me diste (Account → Access Tokens).

## 2. Avisos con MANU cerrada: qué hay

**En la app (Tú → Avisos → «Avisos con MANU cerrada»):**
- «Activar en este dispositivo», «Quitar de este dispositivo» y «Desactivar en todos mis dispositivos».
- «Mostrar el texto del recordatorio»: **apagado por defecto**. El aviso dice «Tienes un recordatorio en MANU» y tu Supabase solo guarda la hora.
- «Probar»: llega en 1–2 minutos.
- «Comprobar la seguridad de mi nube». Mira, sin escribir nada, que sin sesión no se ve nada y que ni tu propia sesión puede leer las claves privadas.
- «Al iPhone» sigue en cada recordatorio como alternativa.

**En el servidor:**
- Las tablas tienen RLS: solo tu cuenta ve tus suscripciones y tu cola.
- Las claves privadas las **genera el propio servidor** y ninguna clave de la app puede leerlas.
- **Sin duplicados:** cada aviso se reclama y se borra en un solo paso antes de enviarse.
- Solo se envía a los servicios push reales (Apple, Google, Mozilla, Microsoft), y las suscripciones caducadas se borran solas.
- Límites: 100 avisos pendientes y 5 dispositivos.
- El cifrado del aviso (estándar RFC 8291) reproduce **byte a byte** el ejemplo oficial.

## 3. Tu nube: sincronización selectiva

| Qué | Antes | Ahora |
|---|---|---|
| Conversaciones (chat y chat de proyectos) | Subían | **No suben**: cada dispositivo guarda las suyas |
| Recuerdos tuyos | Suben | Suben |
| Recuerdos sobre otras personas | Subían | **Solo si los autorizas** en Memoria («Sincronizar entre mis dispositivos») |
| Recuerdos íntimos de otras personas (salud, pareja, dinero, religión, política, justicia…) | Subían | **Nunca**, aunque los autorices |
| Lo que olvidas | Podía volver en un conflicto | **No vuelve**: queda una marca sin texto que gana en cualquier conflicto |

Límite: las marcas protegen la memoria. En las tareas y otras listas, un conflicto sigue quedándose con la versión que elijas.

## 4. Cifrado de extremo a extremo

Detalle en `docs/integrations/E2E_CIFRADO.md`. **No está implementado.** Propuesta, como WEB-100:
- una clave generada en tu dispositivo, sin frase que recordar;
- se pasa del Mac al iPhone con el Portapapeles universal, **sin cable**;
- Supabase solo vería datos ilegibles.

Riesgo: si pierdes los dos dispositivos sin copia de la clave, los datos no se recuperan. Hay que elegir un método de recuperación, por ejemplo guardarla en Contraseñas de iCloud.

## 5. Pruebas

| Comando | Resultado |
|---|---|
| `npm test` (en `web/`) | **347 de 347**: cifrado RFC (5), avisos (7), auditoría (3) y privacidad (+3) |
| `node e2e/push.e2e.mjs` (Supabase falso + PushManager simulado) | **18 de 18** |
| `node e2e/nube.e2e.mjs` (dos dispositivos, Supabase falso) | **25 de 25**: chat que no sube, autorización, conflicto sin resurrección |
| `node e2e/permisos.e2e.mjs`, `memoria`, `estilo` | Sin regresión |
| `node tools/supabase/desplegar.mjs` contra tu Supabase real | Se detuvo, como debía, en «INACTIVE» |

**NO_VERIFICADO:**
- Un aviso real en tu iPhone.
- La función y el temporizador desplegados.
- Si el temporizador evita que el proyecto se vuelva a pausar.

## 6. Qué necesito de ti

1. **Permiso para reactivar el proyecto `manu-os`.** Es gratis en el plan gratuito y vuelve a poner en marcha Tu nube. Dos formas de darlo:
   - Dime «reactiva y despliega», y apruébalo cuando te salga la petición de permiso.
   - O, en tu Mac, desde la carpeta del repositorio: `SUPABASE_ACCESS_TOKEN=… node tools/supabase/desplegar.mjs --aplicar --restaurar`. Necesita Node 18 o posterior; no lo he comprobado en tu Mac.
2. Después: en el iPhone, desde el icono de MANU, Tú → Avisos → «Activar en este dispositivo» → «Probar», y cierra MANU.
3. ¿Hacemos el cifrado de extremo a extremo (WEB-100)? ¿Con qué método de recuperación?
4. Activa la verificación en dos pasos en Supabase y borra el token al terminar.

## 7. Rama

`claude/magical-goodall-rf5qoo`, desde `main` (`028f43e`, con WEB-98 fusionada). Ningún cambio en tu Supabase real: todo fue lectura. Sin fusionar.
