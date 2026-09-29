# CURRENT TASK

Status: **REVIEW_PENDING**

WEB-55 implementado por Claude Code. Se fusiona según la regla de fusión de `AGENTS.md`.

## Tarea activa

WEB-55 — la conversación normal no se toma por una orden (falsos positivos) (`ai/HANDOFF.md`, «WEB-55»).

## Autorización

- 2026-09-28: Manu decide que la vía operativa es una app web instalable en GitHub Pages (no puede instalar la app nativa sin Mac con Xcode ni pagar). Hace público el repositorio, activa Pages y autoriza a Claude Code a fusionar los PR web #10, #11 y #12.
- 2026-09-28: Manu autoriza Gemini y «todo» lo posible de Google, a coste 0 €.
- 2026-09-28: Manu sube su extracto de Sabadell (.xls) para que la app lo lea. El archivo real no entra en el repositorio; solo se usan recuentos en local y un fixture inventado.
- 2026-09-29: Manu pide una IA integrada a la que decirle cosas de la app y con la que subir sus gastos. El envío sin preguntar queda como ajuste que decide Manu, desactivado por defecto.
- 2026-09-29: Manu ordena «cambia agents.md para que tú puedas decidir cuándo fusionar y cuándo no». `AGENTS.md` y `CLAUDE.md` recogen la regla de fusión, lo que resuelve el hallazgo 6 de la revisión de ChatGPT.
- 2026-09-29: Manu elige que la IA pueda leer capturas y vídeos compartidos (TikTok, reels), con el aviso de que la imagen se envía a Google.
- 2026-09-29: Manu quiere «conectar su vida entera». Autoriza exportaciones, Atajos, Spotify y YouTube, y Drive completo (ADR-0016). La primera entrega es «Tu archivo» con ChatGPT.
- 2026-09-29: Manu autoriza acceso total a Gmail y que MANU vigile todo el correo (ADR-0015). Se implementa `gmail.modify` sin borrado definitivo.
- 2026-09-29: Manu pide quitar el «+» y que Agenda no espere a verificar Google al abrir. Esto sustituye la conducta de WEB-24.
- 2026-09-29: Manu decide «que lo sensible vaya a la IA me da igual». Se implementa con un interruptor en su dispositivo; secretos, crisis y Refugio siguen sin enviarse.
- 2026-09-29: Manu pide hablar con MANU «como si fuera Gemini integrado, que lo sepa todo y lo maneje él». Se implementa como un modo que Manu activa, con las categorías sensibles solo si él las marca.
- 2026-09-29: Manu acepta «todo»: la copia completa cifrada (WEB-44, con `backup-manager.js`) y después el borrador del chat, el tiempo y Gmail (WEB-45).
- 2026-09-29: Manu pide seguir sin parar: probar, encontrar fallos, mejorar y publicar en ciclos. Cada ciclo es una tarea WEB-NN con su PR, dentro del alcance autorizado (sin servicios nuevos, costes ni permisos nuevos).
- 2026-09-29: **cambio de gobernanza decidido por Manu.** El orquestador (ChatGPT/Codex) ya no revisa automáticamente, porque frenaba el avance. Claude Code fusiona los PR web cuando `npm test` y los dos workflows remotos están en verde y no hay conflictos. Cuando haga falta una revisión, Claude Code prepara un prompt, Manu se lo pasa a ChatGPT y le devuelve la respuesta; los defectos se corrigen en un PR nuevo con su regresión. Los PR #7, #8 y #9 siguen en borrador o pausa.

## Alcance autorizado

- código en `web/` (sin servidor), tests y workflow `web.yml`;
- integración opcional con Gemini y con Google (Calendar, Tasks, Contactos, Drive) con consentimiento de Manu en su dispositivo;
- documentación canónica, ADR, threat model, handoff y QA lessons.

## Criterios de aceptación (WEB-07/08)

- accesos según el modo, sin redes sociales; Spotify con PKCE y sin secreto, tokens fuera del vault, transferencia sin reproducción automática;
- reglas importadas en el dispositivo, sin datos reales en el repositorio; las correcciones de Manu siempre ganan;
- una sola ventana de consentimiento por gesto, solo con los scopes de las funciones activadas, y degradación por función;
- `npm test` y los dos workflows remotos en verde; recorrido de navegador sin errores.

## Trabajo prohibido

- usar credenciales o datos reales en código, tests o CI; conectar servicios desde CI;
- activar facturación o servicios de pago;
- fusionar un PR con CI en rojo o con conflictos;
- subir datos reales de Manu (extractos, reglas con comercios, contactos) al repositorio.

---

## Historial (cerrado)

- **WEB-54** (deslizar entre ciudades): CERRADA. Fusionada mediante el PR #61 (`e115cc5`).
- **WEB-53** (seguridad y textos largos): CERRADA. Fusionada mediante el PR #60 (`c69c0d8`).
- **WEB-52** (varios gastos y hoja rápida): CERRADA. Fusionada mediante el PR #59 (`1816ae5`).
- **WEB-51** (fechas, miles, ingresos, salud y ánimo): CERRADA. Fusionada mediante el PR #58 (`7079ee9`).
- **WEB-50** (frases sin IA): CERRADA. Fusionada mediante el PR #57 (`ba66180`).
- **WEB-49** (rendimiento): CERRADA. Fusionada mediante el PR #56 (`20a4a7f`).
- **WEB-48** (buscar en todo): CERRADA. Fusionada mediante el PR #55 (`c0974ff`).
- **WEB-47** (presupuestos): CERRADA. Fusionada mediante el PR #54 (`a9fa039`).
- **WEB-46** (resumen del día y auditoría): CERRADA. Fusionada mediante el PR #53 (`22479a3`).
- **WEB-45** (chat, luz del día, Gmail y órdenes de correo): CERRADA. Fusionada mediante el PR #52 (`d7781f5`).
- **WEB-44** (copia completa cifrada): CERRADA. Fusionada mediante el PR #51 (`ea9f790`).
- **WEB-42/43** (aviso de la exportación de ChatGPT y buzón de Atajos): CERRADAS. Fusionadas mediante el PR #50 (`f268c32`).
- **WEB-41** (Tu diario): CERRADA. Fusionada mediante el PR #49 (`8aa480a`).
- **WEB-40** (chat, luz del día y Gmail): CERRADA. Fusionada mediante el PR #48 (`4bc7841`).
- **WEB-39** (Refugio limpio): CERRADA. Fusionada mediante el PR #47 (`4572d06`).
- **WEB-38** (Personas y cumpleaños): CERRADA. Fusionada mediante el PR #46 (`42bbc61`).
- **WEB-37** (conversaciones nuevas): CERRADA. Fusionada mediante el PR #45 (`46f5829`).
- **WEB-36** (escenas del tiempo): CERRADA. Fusionada mediante el PR #44 (`7f14488`).
- **WEB-35** (preguntar, perfil y recuerdos): CERRADA. Fusionada mediante el PR #43 (`9729316`).
- **WEB-34** (Tu archivo): CERRADA. Fusionada mediante el PR #42 (`1165404`).
- **WEB-33** (Gmail): CERRADA. Fusionada mediante el PR #41 (`1f69e4e`).
- **WEB-32** (sin «+», Agenda al instante): CERRADA. Fusionada mediante el PR #40 (`f3eb67e`).
- **WEB-31** (páginas cortas en iOS): CERRADA. Fusionada mediante el PR #39 (`fb4f555`).
- **WEB-30** (zona inferior): CERRADA. Fusionada mediante el PR #38 (`2f5fdad`).
- **WEB-29** (chat con teclado y caché sin conexión): CERRADA. Fusionada mediante el PR #37 (`ffbcf52`).
- **WEB-28** (datos sensibles permitidos por Manu): CERRADA. Fusionada mediante el PR #36 (`f1cd738`).
- **WEB-27** (modo conversación): CERRADA. Fusionada mediante el PR #35 (`fbc1f60`).
- **WEB-26** (chat y teclado): CERRADA. Fusionada mediante el PR #34 (`1a02cd9`).
- **WEB-25** (proyectos y capturas en el chat): CERRADA. Fusionada mediante el PR #33 (`a6a7a01`).
- **WEB-24** (calendario al abrir): CERRADA. Fusionada mediante el PR #32 (`817802b`).
- **WEB-23** (capturas y enlaces): CERRADA. Fusionada mediante el PR #31 (`6b95cf1`).
- **WEB-22** (hoja «+»): CERRADA. Fusionada mediante el PR #30 (`a86c01a`); su fallo en Dinero se corrigió en WEB-23.
- **WEB-21** (estadísticas de dinero): CERRADA. Fusionada mediante el PR #29 (`f375782`).
- **WEB-20** (fondos vivos): CERRADA. Fusionada mediante el PR #28 (`26ce9b1`).
- **WEB-19** (claves «AQ.» de Gemini): CERRADA. Fusionada mediante el PR #27 (`8e57b3c`).
- **WEB-18** (la bola con la M vuelve): CERRADA. Fusionada mediante el PR #26 (`5bad2b9`), hecha por ChatGPT/Codex.
- **WEB-17** (quitar la bola con la M por un malentendido): CERRADA. Fusionada mediante el PR #25 (`18a9c7d`); WEB-18 revierte ese cambio.
- **WEB-16** (escenas vivas): CERRADA. Fusionada mediante el PR #24 (`0caa79d`).
- **WEB-15** (Spotify con un toque): CERRADA. Fusionada mediante el PR #23 (`c657d99`).
- **WEB-14** (tutorial de Gemini): CERRADA. Fusionada mediante el PR #22 (`c8109ee`).
- **WEB-13** (revisión de ChatGPT, calendario automático, gastos del Excel, puesta a punto): CERRADA. Fusionada mediante el PR #21 (`750589e`), con el «sí» de Manu.
- **WEB-12** (IA que propone acciones): CERRADA. Fusionada mediante el PR #20 (`9a5bf6f`).
- **WEB-11** (todos los calendarios con color, WhatsApp): CERRADA. Fusionada mediante el PR #19 (`88b3df3`).
- **WEB-10** (calendario de mes, cobros fijos, cuándo gastas): CERRADA. Fusionada mediante el PR #18 (`505c6bf`).
- **WEB-09** (movimiento estilo iOS): CERRADA. Fusionada mediante el PR #17 (`8ca2bbb`).
- **WEB-07/08** (accesos, Spotify, WhatsApp, reglas, «Conectar Google», Atajos): CERRADAS. Fusionadas en `main` mediante el PR #16 (`dfb0c56`).
- **WEB-06** (Excel de Sabadell y aprendizaje por comercio): CERRADA. Fusionada en `main` mediante el PR #15 (`4b19d3e`).
- **WEB-05** (Gemini opcional y servicios de Google, ADR-0013): CERRADA. Fusionada en `main` mediante el PR #13 (`7c16024`) tras tres rondas de revisión.
- **BRAIN-02-PREP**: CERRADA. Fusionada en `main` mediante el PR #5 (commit `ff2f86a`). Su definición completa, con el alcance, los criterios y las prohibiciones de entonces, está en ese commit. Ya no rige: la línea de trabajo vigente es la web (ADR-0012 y ADR-0013).
