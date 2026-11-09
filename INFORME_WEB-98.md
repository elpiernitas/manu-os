# Informe WEB-98 · Memoria y estilo en Tu nube; avisos con MANU cerrada

**Resumen:** tu memoria y tu estilo ya viajaban en Tu nube desde WEB-94, porque se sube todo junto. Ahora es decisión tuya y la controlas desde el iPhone:
- ves qué hay en la nube, solo en recuentos;
- puedes dejarla en cada dispositivo con un toque;
- puedes vaciar la nube sin entrar en Supabase.

También he enmascarado los nombres que se colaban en los ejemplos de tu estilo. Los avisos con MANU cerrada necesitan un servidor: te dejo la propuesta con tu Supabase, pero **no he activado nada**.

---

## 1. Revisión de seguridad de Tu nube

| Pregunta | Respuesta | Etiqueta |
|---|---|---|
| ¿Quién puede leer tu fila? | Solo tu sesión: la tabla tiene RLS por usuario | VERIFICADO en el SQL del repositorio |
| ¿Va cifrada por el camino? | Sí, HTTPS | VERIFICADO |
| ¿Va cifrada en sus discos? | Supabase dice cifrarlos con AES-256 ([su página de seguridad](https://supabase.com/security)) | Según el proveedor |
| ¿Es de extremo a extremo? | **No.** Supabase como empresa, o quien entrase en tu panel, podría leerla | VERIFICADO (no hay cifrado en el código) |
| ¿Quedan copias suyas? | Su página de precios dice que el plan gratuito no hace copias automáticas ni PITR ([precios](https://supabase.com/pricing), [copias](https://supabase.com/docs/guides/platform/backups.md)) | NO_VERIFICADO en tu proyecto |
| ¿Se borra de verdad lo que olvidas? | Sí, de la fila: se reemplaza el JSON entero en la siguiente subida (segundos). Postgres puede conservar la versión vieja internamente hasta compactarla, sin acceso por la API | VERIFICADO (fila) / TEÓRICAMENTE_POSIBLE (interno) |

**Riesgos que conviene que conozcas:**
1. **Datos de otras personas.** Si le cuentas a MANU algo sobre alguien, ese recuerdo viaja con el resto. Ahora Tu nube te dice cuántos hay para que los revises en Memoria.
2. **Ejemplos de tu estilo.** Guardaban tu mensaje literal y podían llevar nombres o cifras. **Corregido:** se enmascaran («ayer con … en el bar, qué máquina»), también los antiguos antes de subir.
3. **Conflictos.** Si eliges «Quedarme con este» en un dispositivo que aún tenía algo que habías olvidado, vuelve a subir.
4. **La cuenta.** Vaciar la nube no borra tu cuenta de Supabase (tu correo). Eso solo se hace desde su panel.

## 2. Qué puedes hacer desde el iPhone (Tú → Tu nube)

- **«Tu memoria en la nube»:**
  - recuerdos, decisiones, cuántos son de otras personas, tu estilo y tus chistes, siempre en números, nunca el texto;
  - el interruptor **«Memoria y estilo en Tu nube»**, activado por tu decisión. Si lo apagas, en la siguiente sincronización la memoria sale de la nube y cada dispositivo conserva la suya.
- **«Seguridad y borrado»:**
  - lo de arriba, contado sin adornos;
  - **«Vaciar mi nube…»**, con dos confirmaciones. Borra el contenido de la nube; este dispositivo conserva sus datos y se desconecta. El otro, al verlo, también se desconecta **sin borrar nada**.

## 3. Avisos con MANU cerrada

Detalle y fuentes en `docs/integrations/PUSH.md`.

- **Qué hace falta:** iOS los admite en apps del icono de inicio (16.4 o posterior), pero el aviso tiene que mandarlo un servidor con una clave privada. MANU no tiene ese servidor.
- **Lo que recomiendo, si lo autorizas:** usar **tu Supabase**, que ya existe:
  - una tabla con RLS;
  - una función que manda el aviso;
  - un temporizador cada minuto.

  Según su documentación cuesta 0 € en el plan gratuito, pero **activa piezas nuevas** del proyecto y hay que pegar un SQL y una función una vez en su panel.
- **Privacidad por defecto:** el servidor solo sabría a qué hora avisarte. El aviso diría «Tienes un recordatorio en MANU», sin el texto, salvo que tú elijas mostrarlo.
- **Descartado:**
  - GitHub Actions, porque el repositorio es público y la hora no es precisa;
  - servicios de terceros como OneSignal, por ser cuentas nuevas con datos fuera.
- **Mientras tanto:** «Al iPhone» en cada recordatorio y las automatizaciones de Atajos.

## 4. Pruebas

| Comando | Resultado |
|---|---|
| `npm test` (en `web/`) | **329 de 329**, 6 nuevas en `tests/nube-privacidad.test.js` |
| `node --check` de `app.js`, `sw.js` y `core/*.js` | OK |
| `node e2e/nube.e2e.mjs`, con un Supabase **falso**: nada sale a la red | **16 de 16** |
| `node e2e/permisos.e2e.mjs`, `memoria`, `estilo` | Sin regresión |

La e2e simula el iPhone y el Mac. Comprueba:
- que sube la memoria con el ejemplo enmascarado;
- que al apagar el interruptor desaparece de la nube y se queda en el dispositivo;
- que al bajar los cambios del Mac no se pierde la memoria local;
- que «Vaciar mi nube» deja la nube vacía;
- que **el otro dispositivo no pierde nada**.

## 5. NO_VERIFICADO

- Nada probado contra tu Supabase real ni en tu iPhone.
- Si tu proyecto tiene copias del proveedor.
- Si el panel de Supabase deja desplegar la función de avisos desde el iPhone.

## 6. Qué necesito de ti

1. **¿Autorizas la opción A de avisos push** con tu Supabase, con avisos sin texto por defecto? Sin tu sí no toco nada.
2. Revisa en Tú → Tu nube cuántos recuerdos son «sobre otras personas» y decide si quieres que sigan viajando. Si no, olvídalos en Memoria; si prefieres, lo hago configurable.
3. Siguen pendientes: las luces del modo amanecer (WEB-96) y el banco (WEB-93).

## 7. Rama

Rama `claude/magical-goodall-rf5qoo`, reiniciada desde `main` (`f234bb6`, con WEB-97 fusionada). Sin servicios nuevos, sin datos reales y sin fusionar.
