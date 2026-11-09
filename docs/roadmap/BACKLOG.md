# Backlog técnico

> Revisado el 2026-09-28 por [ADR-0007](../adr/0007-native-iphone-first.md) y, el mismo día, por las decisiones de producto de Manu. Se añaden BRAIN-15 a BRAIN-21, los gates G-10 a G-14 y las decisiones D-07 a D-09. El detalle está en `docs/roadmap/ROADMAP.md`.

## Regla de selección

Solo puede existir una tarea de implementación `IN_PROGRESS`. Una fase no empieza hasta cumplir sus dependencias y gates. Desde el 2026-09-28, Manu delega en el orquestador técnico la autorización de tareas, revisiones y merges; los costes, servicios externos, datos reales, permisos sensibles y decisiones materiales de producto siguen reservados a Manu.

| Fase | Resultado | Depende de | Beta 1 | Estado |
| --- | --- | --- | --- | --- |
| BRAIN-00 | fundación documental; revisiones ADR-0007 a ADR-0009 | — | — | COMPLETED |
| BRAIN-01 | contratos de Source (con retención), Claim, Evidence y tiempo | BRAIN-00, D-01 | sí | COMPLETED |
| BRAIN-02 | apps nativas mínimas, vault local, cinco pestañas (02a–02d verificables en CI/simulador; fase de dispositivo real aparte) | BRAIN-01; sin bloqueo adicional para 02a–02d en simulador; la fase de dispositivo real (firma/instalación en el iPhone) depende de D-04B, con D-03 activada por dos disparadores independientes (fallo de App Groups con cuenta gratuita, o elección de TestFlight), ninguno activo ahora | sí | BLOCKED (02a–02d implementables en cuanto se autorice código de producto; la fase de dispositivo real sigue BLOCKED por D-04B) |
| BRAIN-03 | superficies del sistema y modos | BRAIN-02 | sí | BLOCKED |
| BRAIN-04 | búsqueda, relaciones y explicación | BRAIN-02 | sí | BLOCKED |
| BRAIN-05 | export, restore y copia semanal en el Mac | BRAIN-04 | sí | BLOCKED |
| BRAIN-06 | cifrado y sync iPhone ↔ Mac | BRAIN-05, D-07 | sí | BLOCKED |
| BRAIN-07 | captura universal | BRAIN-03, BRAIN-05 | sí | BLOCKED |
| BRAIN-08 | importadores ChatGPT, Claude y WhatsApp | BRAIN-05 | ChatGPT/Claude sí; WhatsApp condicional | BLOCKED |
| BRAIN-09 | Agenda y modo Trabajo | BRAIN-03, BRAIN-06, D-05 | sí | BLOCKED |
| BRAIN-10 | Hoy y rutinas de noche y mañana | BRAIN-04, BRAIN-09, D-06 | sí | BLOCKED |
| BRAIN-11 | chat MANU y proactividad | BRAIN-04, BRAIN-08 | nivel base sí; conversacional condicional (D-08) | BLOCKED |
| BRAIN-12 | hardening y QA de la Beta 1 | fases incluidas en la Beta 1 | sí | BLOCKED |
| BRAIN-13 | Dinero | BRAIN-06, G-07 | condicional | BLOCKED |
| BRAIN-14 | llamadas y transcripciones | BRAIN-07, G-08 | no | BLOCKED |
| BRAIN-15 | bandeja diaria de capturas | BRAIN-07, G-10, D-09 | sí | BLOCKED |
| BRAIN-16 | personas | BRAIN-08, BRAIN-09 | sí | BLOCKED |
| BRAIN-17 | salud, actividad, UREVO y comidas | BRAIN-06, G-11 | condicional | BLOCKED |
| BRAIN-18 | Refugio | BRAIN-11, G-12 | condicional | BLOCKED |
| BRAIN-19 | proyectos e ideas | BRAIN-09, BRAIN-11 | sí | BLOCKED |
| BRAIN-20 | Laboratorio | BRAIN-02 | sí | BLOCKED |
| BRAIN-21 | mantenimiento operativo semanal | servidor accesible | no | BLOCKED |

## Backlog de la línea web

Tareas candidatas de la app web (ADR-0012). Ninguna empieza sin cumplir sus dependencias.

### WEB-96 (candidata) — Modo amanecer

**Estado:** `BLOCKED`, a la espera de que Manu confirme qué luces LED y qué app usa. Añadida a petición de Manu el 2026-11-09.

**Qué quiere Manu:** luces LED que suben poco a poco de intensidad antes de su alarma y se adaptan a la hora de esa alarma.

**Qué hay ya en MANU:**
- `proposeAlarm` (`core/night.js`) calcula la alarma de mañana según su primera cita.
- El atajo «MANU Alarma» la pone en el iPhone. La hora es conocida la noche anterior.

**Diseño propuesto, por confirmar:**
1. Cuando MANU pone la alarma (HH:MM), calcula el amanecer: empieza N minutos antes (30 por defecto, ajustable) y llega al 100 % a la hora de la alarma.
   - La curva es suave: poco brillo al principio y más hacia el final.
   - El color pasa de cálido a neutro si la luz lo admite.
2. Ese plan se entrega a quien maneja las luces, y solo hay dos caminos posibles:
   - **(a) La rutina de despertar de la propia app de las luces**, si existe y se puede programar desde Atajos con una hora variable.
   - **(b) Un atajo «MANU Amanecer»** que sube el brillo por pasos con esperas entre ellos, lanzado a la hora de inicio.
3. Si Manu pospone o apaga la alarma, el amanecer no continúa más allá del 100 %. Nunca se encienden luces de madrugada sin una alarma puesta.
4. Sin servidor ni coste (ADR-0004, ADR-0012). Si hiciera falta un puente de pago o una cuenta nueva, se le pregunta antes a Manu.

**Preguntas abiertas para Manu (bloquean la tarea):**
- ¿Qué marca y modelo son las luces, y con qué app las controlas? Por ejemplo Apple Casa (HomeKit), Philips Hue, Govee, Tuya o Smart Life, o una tira con mando.
- ¿Aparecen en la app Casa del iPhone o en las acciones de Atajos?
- ¿Cuántos minutos de amanecer quieres?
- ¿Solo entre semana o todos los días con alarma?

**Viabilidad:** todo está `NO_VERIFICADO`, porque depende de las luces concretas de Manu.
- Lanzar un atajo a una hora que cambia cada día es `TEÓRICAMENTE_POSIBLE`. Las automatizaciones personales de Atajos se configuran a mano con hora fija. Hay que comprobar si una automatización puede programarse con la hora que calcula MANU o si hace falta otro disparador.
- Que una rutina de despertar con amanecer gradual pueda programarse desde Atajos también está por verificar con la app de las luces.

**Hecho cuando** (criterios de aceptación):
- Con la alarma puesta desde MANU, las luces empiezan a subir N minutos antes y llegan al máximo a la hora de la alarma.
- Cambiar la alarma cambia el amanecer.
- Funciona sin abrir MANU por la mañana.
- Lo comprueba Manu en su dormitorio.

## Gates transversales

- **G-01 Restore**: no cloud sync antes de restauración probada.
- **G-02 OAuth**: no scopes reales antes de revocación y token threat model.
- **G-03 Personal data**: no corpus real antes de export, borrado y cifrado aplicables.
- **G-04 Agent writes**: no acciones externas sin propuesta, auditoría y aprobación.
- ~~**G-05 Native**: no companion nativo sin dos capacidades de valor imposibles por PWA/Atajos.~~ Retirado por ADR-0007 (2026-09-28).
- **G-06 Cost**: no servicio sin degradación por cuota y barrera de gasto. Cualquier suscripción (Apple Developer Program, API de modelos, servicio macOS) requiere decisión de Manu.
- **G-07 Finance**: no datos financieros reales antes de cifrado, export/restore, confirmación de importe/fecha/comercio, categoría marcada como inferida, exclusión de superficies bloqueadas y política de envío a modelos.
- **G-08 Recordings**: no grabación ni transcripción de llamadas antes de ruta técnica verificada, consentimiento de todos los participantes, revisión legal aplicable y política de retención.
- **G-09 Lock-screen surfaces**: no datos personales en widgets, Live Activities, controles o notificaciones visibles con el iPhone bloqueado antes de clasificar la sensibilidad y probar la redacción.
- **G-10 Source deletion**: no borrar originales (en MANU OS o en Fotos) antes de implementar ADR-0008 con tests: procedencia, hash cuando sea posible, evento de eliminación con resultado real y ninguna afirmación de original conservado.
- **G-11 Health**: no datos de salud antes de permisos por tipo de dato, etiquetado sensible, exclusión de superficies y exportaciones compartibles, y cifrado.
- **G-12 Refugio**: no acompañamiento emocional antes de protocolo de ayuda humana ante riesgo (112 y 024 en España) revisado, avisos de que no sustituye a un profesional, datos protegidos y ningún envío a proveedores externos.
- **G-13 External AI data**: ningún proveedor de modelo, gratuito o de pago, recibe salud, finanzas, Refugio, chats privados ni transcripciones sin decisión específica de Manu y revisión de condiciones y privacidad.
- **G-14 Automatic messages**: ningún mensaje automático sin lista blanca explícita, prueba técnica de la ruta y registro de cada envío.

## Decisiones pendientes que bloquean fases

Detalle y recomendación en `docs/architecture/DECISIONS_AND_OPEN_ITEMS.md`.

| ID | Decisión | Bloquea |
| --- | --- | --- |
| D-01 | reparto SwiftUI/web, lenguaje del núcleo y tecnología de la app de Mac | BRAIN-01, BRAIN-02 |
| ~~D-02~~ | ~~almacenamiento local nativo y contenedor compartido con extensiones~~ **DECIDIDA** ([ADR-0011](../adr/0011-native-local-storage-and-keys.md)) | — |
| D-03 | Apple Developer Program: sí o no | fase de dispositivo real de BRAIN-02 (dos disparadores independientes: firmar con la cuenta gratuita en el iPhone físico falla, o se elige TestFlight como ruta), parte de BRAIN-03, D-06, D-07 |
| D-04B | firma e instalación de un proyecto Xcode real en el iPhone físico (su compilación/prueba en simulador no la necesita, ver D-04) | fase de dispositivo real de BRAIN-02b, 02c, 02d |
| D-05 | fuente de calendario | BRAIN-09 |
| D-06 | servicio meteorológico | BRAIN-10 |
| D-07 | transporte de sync cifrado | BRAIN-06 |
| D-08 | fuente de modelo para el nivel conversacional | nivel conversacional de BRAIN-11 |
| D-09 | detección de llegada a casa | activación automática de BRAIN-15 |

## Completado

BRAIN-01 fue fusionado mediante el PR #2 tras revisión externa, corrección de 11 defectos y 31/31 tests en 3 suites. BRAIN-02-PREP (PR #5) cerró D-02 ([ADR-0011](../adr/0011-native-local-storage-and-keys.md)) y dividió BRAIN-02 en subfases 02a–02d, verificables en CI/simulador sin firma ni dispositivo (tres rondas de corrección tras revisión externa del propio PR #5, ver `ai/HANDOFF.md`). Ninguna subfase está autorizada para implementarse todavía; solo la fase de dispositivo real (firma e instalación en el iPhone físico) sigue bloqueada por D-04B, con D-03 activada por dos disparadores independientes (fallo demostrado de App Groups con cuenta gratuita, o elección de TestFlight como ruta), ninguno activo ahora.
