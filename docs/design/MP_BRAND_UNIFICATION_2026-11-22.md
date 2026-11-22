# MANU OS × Manu Pernas — Propuesta de unificación visual

**Fecha:** 22/11/2026 · **Estado:** PROPUESTA PARA REVISIÓN, sin cambios de aplicación ni publicación.

**Petición de Manu:** quiere que su portfolio profesional y la aplicación MANU OS se reconozcan como parte de una misma identidad. No quiere otra aplicación que parezca de una empresa distinta ni un rediseño que destruya lo que ya funciona.

**Fuente de marca (no reinterpretar):**
- Repositorio de portfolio: `elpiernitas/manupernas-web`
- Rama de diseño: `design/mp-identidad-2026-11-22`
- Commit auditado por Claude: `8b826f0` (verificar si existe otro posterior antes de extraer recursos)
- Guía: `docs/IDENTIDAD-VISUAL-APROBADA-2026-11-22.md`
- La decisión posterior y vigente de Manu: **Montserrat** (no Inter).
- Logotipo: `mp.`, `m` negra sobre blanco o blanca sobre negro, `p.` azul eléctrico; sin símbolo adicional.
- Avatar: cabeza, cabello con flequillo en ola, gafas y aro; personaje negro/blanco, anillo azul. **El archivo `src/assets/marca/avatar-provisional.svg` es PROVISIONAL, pendiente de validación de Manu.**
- **Eliminadas** las tres rayas diagonales y cualquier símbolo secundario.
- Paleta: azul `#0066FF`, negro `#0B0B0D`, blanco `#FFFFFF`, gris claro `#F5F5F7`. Blanco predominante en el portfolio.

## 1. Principio de producto

Compartir **ADN de marca**, no confundir funciones:

- Portfolio: escaparate público de trabajo, editorial, blanco predominante, foto y proyectos.
- MANU OS: asistente personal privado, una herramienta de uso diario. Mantener las seis áreas actuales: `Hoy`, `Agenda`, `MANU`, `Dinero`, `Proyectos`, `Tú`. Mantener local-first, cerebro, sincronización, rutinas, permisos, gastos y acceso al Tablero con sus controles de privacidad.
- La interfaz de MANU OS NO debe convertirse en el portfolio ni publicar contenido del vault. No enlazar ni exponer sesiones, datos personales, médicos, bancarios, laborales o de terceros a través del portfolio.
- Mantener contenido y propuestas discretos: una prioridad por pantalla; sin gamificación Bahía, sin tarjetas decorativas repetitivas ni estadísticas artificiales.

## 2. Tema nuevo, reversible

Crear un tema **`mp`**, separado de los temas existentes `design` (Claude Design), `clasico` y `horizonte`.

- Propuesta de apariencia: **modo claro de marca** con fondo blanco, texto `#0B0B0D`, azul `#0066FF`, superficies `#F5F5F7`; mantener contraste AA en todo el texto y controles.
- Tema oscuro opcional en etapa posterior, derivado de los mismos tokens. No imponer el blanco cuando resulte incómodo; validar la app en el iPhone real.
- Montserrat: pesos 400/500 para cuerpo, 600 para botones, 700/800 para encabezados, 900 solo en momentos editoriales destacados; contrastar tamaños con accesibilidad y rendimiento.
- Elementos: la firma `mp.` puede aparecer en pantalla de bienvenida, ajustes/Tú y encabezados clave; **no repetir logotipo en todas las tarjetas**. El avatar, si está aprobado, puede aparecer en MANU y perfil.
- Sin icono de tres diagonales ni crear otro símbolo; iconografía de funciones de la app puede seguir existiendo, porque un icono funcional (calendario, búsqueda) no es un logotipo secundario.
- Estados de aviso/error/éxito pueden usar colores semánticos distintos al azul para seguridad y comprensión; la regla de paleta corporativa no debe impedir informar de un error.
- Respetar movimiento reducido, tamaño de letra, contraste, foco, lector de pantalla, barra inferior iOS, áreas seguras y brillo nocturno.
- No cambiar el tema activo guardado en `vault.settings.skin` ni migrar preferencias sin revisión. Ofrecer `mp` como **opción** hasta aprobación expresa de Manu.

## 3. Alcance sugerido para una primera implementación aislada

1. Leer `AGENTS.md`, `docs/product/PRODUCT_CHARTER.md`, `docs/product/EXPERIENCE.md`, `docs/design/CLAUDE_DESIGN_RESTORE.md`, `docs/product/LEAN_MANU_OS.md` y `docs/CEREBRO.md`.
2. Investigar dónde están los tokens reales y cómo se cambia de tema (`web/styles.css`, `web/design/claude-design.css`, `web/core/horizonte.js` y funciones de apariencia). Verificar nombres/rutas antes de editar.
3. Añadir tokens y componentes del tema `mp` reutilizando los SVG oficiales aprobados del portfolio; no rasterizar el mockup ni inventar avatar. Si solo existe `avatar-provisional.svg`, dejarlo claramente provisional.
4. Preparar visualmente las seis pantallas **sin datos reales**, usando fixtures sintéticos: Hoy, Agenda, MANU, Dinero, Proyectos, Tú.
5. Mantener las decisiones de privacidad, permisos, RLS, cifrado/retención y confirmación de efectos externos intactas. La identidad visual **no requiere** acceder a Gmail, bancos, Netflix, Supabase ni otros servicios.
6. Probar en 320, 390, 768 px y Safari real cuando se pueda. Ejecutar pruebas unitarias, e2e, accesibilidad, vistas con texto grande y modo reducido; revisar gasto de red y funcionamiento offline.
7. Comparar capturas con el portfolio: logo, avatar, familia tipográfica, color y sensación visual. La app no necesita replicar el hero del portfolio.
8. Entregar capturas + informe de diferencias para **aprobación visual antes de fusionar**.

## 4. Coordinación de agentes y límites

- Compartir decisiones estables por **archivos de GitHub y commits**, no asumir que dos ventanas de navegador pueden hablar o actuar solas entre sí.
- Cada agente trabaja en ramas separadas. **No tocar `main`, GitHub Pages, Netlify ni la rama de portfolio de otro agente** sin autorización. No mezclar repos ni alterar funcionalidad de MANU OS durante la revisión de marca.
- No ampliar permisos ni conectar cuentas por esta misión. Nada de costes, envíos de mensajes, cambios bancarios, escrituras en bases, borrado de datos, publicaciones o gestión de credenciales sin una autorización distinta.
- MANU OS está en un repositorio GitHub **público**: solo documentos de marca, código y datos ficticios. Nunca registrar chats privados, capturas personales, datos de clientes, tokens, memoria ni nombres de terceros.
- El cerebro compartido WEB-118 (`docs/CEREBRO.md`) **no está verificado operativo**: migración pendiente, llaves por IA no verificadas y conector remoto de Claude pendiente. No dar por hecho que ChatGPT y Claude se sincronizan automáticamente.
- El estado de la conexión Supabase debe verificarse en la cuenta adecuada; no hacer inferencias sobre proyectos ausentes de una conexión.

## 5. Definición de terminado

- Se ve claramente como la misma marca `mp.`, pero sigue siendo un asistente personal cómodo y útil.
- Los seis destinos actuales siguen funcionando y las preferencias, datos, sync, memoria y permisos sobreviven a cambio de tema.
- Sin nuevas dependencias, claves ni proveedores innecesarios.
- Accesibilidad y rendimiento comprobados; diferencia visual documentada con capturas.
- Manu valida el resultado **antes** de elegirlo como apariencia predeterminada.

**Esta rama solo contiene documentación. No es una app rediseñada ni una garantía de implementación.**
