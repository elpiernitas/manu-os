# Auditoría completa de MANU OS web (2026-10-01)

Pedida por Manu: «revisa todo el código, haz una auditoría completa, estudia qué cambiarías, hazlo, comprueba que todo va bien y fusiónalo». Se revisa la versión 72 (unas 9.000 líneas en `web/`, 43 archivos de prueba).

## Cómo se ha auditado

Se han hecho pruebas medibles y repetibles. Los scripts de los puntos 1, 3 y 4 están en el scratchpad de la sesión. Los de los defectos corregidos se reflejan en `tests/audit.test.js`.

1. **XSS por inyección real.**
   - Se mete código de ataque (`<img onerror>`, `<svg onload>`, comillas, comillas invertidas y enlaces `javascript:`) en **todos** los campos que vienen de datos: tareas, ideas, gastos, ingresos, personas, proyectos y sus fuentes, chat, recordatorios, hábitos, comidas, lugares, capturas, calendario, agenda, correo, contactos, perfil y estado de Tu nube.
   - Después se recorren las 6 pestañas, el proyecto abierto, las 15 subpáginas de Tú, el tiempo, dos respuestas del chat y la búsqueda de contactos.
2. **Secretos y datos personales en Git.** Búsqueda de claves de API, JWT, `sb_secret_`, `service_role`, claves privadas y correos reales.
3. **Accesibilidad.** En todas las pantallas: botones y enlaces sin nombre accesible, campos sin etiqueta, imágenes sin `alt`, objetivos táctiles de menos de 24 px e `id` duplicados.
4. **Rendimiento con un año de uso intenso.** 3.000 gastos, 800 tareas e ideas, 300 personas, 30 proyectos con 40 fuentes cada uno, 1.000 datos de salud, 300 capturas y 365 ánimos: un vault de 1,1 MB.
5. **Integridad de datos.** Dos pestañas abiertas a la vez, datos locales dañados con Tu nube activa, y una sincronización mientras Manu escribe.
6. **Publicación.** Qué se sube realmente a GitHub Pages.
7. **Código muerto.** Exportaciones que la app no usa.

## Hallazgos y lo que se ha hecho

| # | Hallazgo | Gravedad | Prueba de que era real | Arreglo |
|---|---|---|---|---|
| 1 | Una fuente de proyecto con `javascript:` en la URL se pintaba como enlace pulsable. La CSP lo bloquearía, pero no debe depender solo de ella. Podía llegar desde una copia restaurada o desde la nube. | Media (seguridad) | El rastreo XSS lo encontró: 1 hallazgo en «proyecto». | `safeHref()` en `core/links.js` en los 8 enlaces que salen de datos. Solo deja pasar `https`, `http`, `mailto`, `tel`, `whatsapp`, `shortcuts`, `spotify` y rutas relativas. La baja de correo vuelve a comprobar `https:` y `mailto:`. |
| 2 | **Dos pestañas de MANU** (fácil en el Mac): cada una guardaba su copia en memoria y deshacía lo de la otra. | Alta (pérdida de datos) | Con el código anterior, e2e-audit pierde una tarea de tres. | Escuchar el evento `storage`: si otra pestaña guarda, esta toma su copia. |
| 3 | **Datos locales dañados con Tu nube activa:** MANU arrancaba vacía y el siguiente cambio podía subir ese vault casi vacío encima de la copia buena de la nube. | Alta (pérdida de datos) | Con el código anterior, la copia de la nube no se recupera. | Si el vault se aparta por dañado y hay sesión, se olvida `lastRev`, y la sincronización **baja** la copia de la nube en vez de subir. |
| 4 | Al llegar datos del otro dispositivo, la página se **recargaba** y se perdía lo que Manu estaba escribiendo. | Media | e2e-audit: el texto a medio escribir desaparecía. | El vault se cambia en memoria sin recargar, y no se repinta si hay un campo activo. |
| 5 | Sin aviso de espacio: Safari guarda unos 5 MB por web (cifra NO_VERIFICADA, varía según la versión). | Media (a medio plazo) | Un año de uso intenso ya son 1,1 MB. | Medidor en Tú → Tus datos, con avisos al 60 % y al 85 %. Respeta la CSP: el ancho va en `data-w` y se aplica con JS. |
| 6 | En la web publicada había **capturas de pruebas** (`web/caps/`, `e2e46-*.png`, `v38.png`, unos 1,6 MB, con datos inventados) y la carpeta `tests/`. | Baja (limpieza y peso) | Visto con `git ls-files`. | Se borran y se ignoran en `.gitignore`. `web.yml` publica una copia sin `tests/` ni `package.json`. |
| 7 | El botón «✕» para quitar una fuente medía 13 px de ancho. | Baja (accesibilidad) | El rastreo de accesibilidad lo detectó. | `.icon-btn`, con un mínimo de 44 × 44 px. |

## Lo que se ha revisado y está bien

- **XSS:** con los arreglos, 0 hallazgos en todas las pantallas. El resto de inserciones ya pasaban por `esc()`.
- **Secretos:** no hay ninguno en Git. Las únicas claves en el código son públicas por diseño: el ID de cliente OAuth de Google, el ID de cliente de Spotify (PKCE, sin secreto) y la clave *publishable* de Supabase. Los correos que aparecen son de prueba (`*.example`) o remitentes genéricos `no-reply`.
- **CSP:** sin `unsafe-inline` ni `unsafe-eval`. `connect-src` es una lista cerrada, con Supabase limitado al proyecto de Manu. `form-action 'none'` y `object-src 'none'`.
- **Supabase:** RLS por usuario; `anon` rechazado (comprobado contra el proyecto real: 401 «permission denied»); no se concede `DELETE`.
- **Rendimiento:** todas las pantallas se pintan en menos de 140 ms con el vault de un año. Leer y escribir el vault cuesta unos 6 ms. El primer arranque, unos 0,9 s.
- **Accesibilidad:** no hay botones sin nombre, campos sin etiqueta, imágenes sin `alt` ni `id` duplicados.

## Lo que no se ha cambiado, y por qué

- **`app.js` tiene 3.500 líneas.** Partirlo en módulos por pantalla sería lo ideal para mantenerlo, pero es un cambio grande con riesgo de romper cosas que funcionan. Se propone como tarea propia, por pasos, cuando haya calma.
- **Código muerto menor:** `systemPrompt`, `correctCategory`, algunas constantes de permisos y `deleteSource`. Son pequeños y los usan las pruebas o reflejan la versión nativa. No molestan.
- **Repintado completo** (`innerHTML` de la pantalla entera): con los tiempos medidos no hace falta optimizarlo.

## Evidencia final

- `npm test`: 212 en verde.
- Batería e2e completa en verde.
- e2e-xss: 0 hallazgos.
- e2e-audit: 7/7. Falla con el código anterior.
- Accesibilidad: sin defectos.
- Versión 73.
