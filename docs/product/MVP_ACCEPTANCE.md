# MVP técnico y Beta 1 — Acceptance Contract

> Revisado el 2026-09-28 por [ADR-0007](../adr/0007-native-iphone-first.md) y de nuevo por las decisiones de producto de Manu del mismo día. La versión anterior tenía un único «MVP» de 15 pasos; sus pasos se conservan dentro del **MVP técnico interno** (sección 1). Se añade la **Beta 1** (sección 2), que es lo que Manu recibe.

Ninguna entrega se declara terminada por número de pantallas. Debe completar un ciclo de información seguro, offline y recuperable. No se incluye en una entrega ninguna función inviable o no verificada: si no supera su verificación, sale de la entrega o se entrega con su alternativa documentada.

## Dos hitos distintos

| Hito | Para quién | Qué demuestra |
| --- | --- | --- |
| **MVP técnico interno** | desarrollo y QA; no se pide a Manu que lo use a diario | que el núcleo, la persistencia, las superficies básicas, el export/restore y la sincronización funcionan con datos sintéticos |
| **Beta 1** | Manu, como primera instalación de uso real | un recorrido integrado y suficientemente completo de la visión de `EXPERIENCE.md` con sus datos reales |

Entre ambos hay fases internas con QA progresiva (ver `docs/roadmap/ROADMAP.md`). Manu no instala prototipos parciales semanales.

**Pendiente**: el MVP técnico necesita pruebas en un iPhone físico. Si el único iPhone disponible es el de Manu, alguna verificación interna requerirá su dispositivo aunque no use la app a diario. Se decide junto con D-04.

## 1. MVP técnico interno

### Recorrido obligatorio

1. Instalar la app nativa en un iPhone de pruebas (o el de Manu, ver «Pendiente») y la app de Mac si D-01 la incluye en esta fase.
2. Capturar texto y enlace sin red desde la app.
3. Capturar texto o audio desde al menos una superficie del sistema disponible en iPhone 14 (widget, control del Centro de Control o App Intent/Atajo) sin abrir primero la app.
4. Importar un archivo o foto elegidos explícitamente.
5. Cerrar y reabrir la app, y reiniciar el iPhone, sin perder las capturas.
6. Conservar fuente o procedencia, fecha, autor/origen, política de retención y hash cuando sea posible.
7. Convertir una captura en entidad/Claim con evidencia visible.
8. Buscar por texto, tipo, fecha, persona o proyecto.
9. Explicar una conexión mediante la cadena de evidencia.
10. Sustituir una decisión antigua y consultar ambos estados históricos.
11. Cambiar entre al menos dos modos y comprobar que cambian el contenido de la app y de un widget, sin cambiar su apariencia.
12. Retirar un permiso y comprobar que la app sigue funcionando y lo explica.
13. Eliminar una fuente con retención `EXTRACTED_ONLY` y comprobar que quedan la procedencia y el evento de eliminación, y que nada afirma que el original existe (ADR-0008).
14. Exportar el vault.
15. Restaurarlo en una instalación limpia y obtener los mismos recuentos y hashes.
16. Seguir utilizando el núcleo con IA e integraciones desconectadas.

Todo con **datos sintéticos**.

## 2. Beta 1 (primera entrega a Manu)

### Condiciones de entrada

- MVP técnico interno superado con QA independiente.
- G-01 (restore), G-03 (datos personales) y G-09 (superficies bloqueadas) superados.
- D-01, D-02, D-03, D-04 y D-07 cerradas.
- Instrucciones de instalación y reinstalación probadas (la caducidad depende de D-03).

### Contenido

**Obligatorio** (si algo falla, la Beta 1 no se entrega):

- app de iPhone con las cinco pestañas (Hoy, Agenda, MANU, Dinero, Tú) y la identidad visual de `EXPERIENCE.md`;
- app de Mac con las funciones que D-01 fije para la Beta 1;
- chat MANU en **nivel base** (ADR-0009): comandos, búsqueda con fuentes, sugerencias y tono definido;
- captura universal: texto, audio, foto, archivo y enlaces desde Compartir;
- **bandeja diaria de capturas** con OCR, preguntas, respuesta por texto o audio, confirmación de clasificación y petición de borrado en Fotos;
- Agenda con calendario, tareas y proyectos;
- rutinas de noche, mañana y trabajo con las rutas verificadas (las no verificadas, con su alternativa manual);
- pantalla bloqueada y widgets sin contenido sensible;
- controles del Centro de Control: hablar con MANU, guardar una idea y registrar un gasto (este último solo si Finanzas entra);
- personas (perfiles a partir de lo que Manu cuente, Contactos y Calendario);
- Laboratorio sin envío automático;
- sincronización cifrada iPhone ↔ Mac, copia semanal en el Mac y restauración probada.

**Condicional** (entra solo si supera su gate a tiempo; si no, va a una beta posterior):

- Finanzas (G-07);
- salud, actividad, UREVO y comidas (G-11);
- Refugio (G-12);
- importación de WhatsApp (G-03 y revisión de datos de terceros);
- chat MANU en nivel conversacional (D-08 y G-13);
- detección de llegada a casa (D-09).

**Excluido de la Beta 1 salvo verificación previa**:

- inicio automático de Spotify DJ en el Chromecast (sin ruta documentada);
- grabación y transcripción de llamadas (G-08);
- batería de AirPods;
- interrupciones por mensajes de personas prioritarias (dependen del Focus de iOS, no de MANU OS);
- botón de acción (no existe en el iPhone 14);
- mantenimiento operativo semanal (no hay servidor).

### Recorrido de aceptación de la Beta 1

1. Instalar en el iPhone 14 y en el Mac de Manu siguiendo las instrucciones entregadas.
2. Por la noche, recibir la propuesta de ciudad, desayuno y hora de alarma, y confirmarla.
3. Por la mañana, ver el tiempo en la pantalla bloqueada y el briefing al desbloquear.
4. En horario de trabajo, ver siguiente tarea y próxima cita en un widget y en la app.
5. A las 13:00, recibir la propuesta de desconexión con nueva fecha para tareas pendientes.
6. Procesar una tanda de capturas en la bandeja diaria, responder por audio a una y confirmar la clasificación.
7. Pedir borrar los originales de Fotos, confirmar en iOS y comprobar el registro del resultado.
8. Compartir un enlace a MANU OS y ver el resumen, las ideas y las relaciones propuestas.
9. Guardar una idea desde el Centro de Control sin abrir la app.
10. Preguntar a MANU por algo capturado días antes y obtener la respuesta con su fuente o procedencia.
11. Ver en el Mac lo mismo que en el iPhone tras sincronizar.
12. Hacer la copia semanal en el Mac y restaurarla en una instalación limpia.
13. Retirar un permiso y comprobar la degradación.
14. Confirmar que ninguna superficie bloqueada muestra contenido sensible.

### Umbrales

- Captura de texto desde un widget, un control o la pantalla de inicio: objetivo inferior a 10 segundos.
- Apertura de la app y cambio de pestaña sin esperas perceptibles en el iPhone 14 (umbral numérico a fijar en BRAIN-02 con medición real).
- Claims derivadas con evidencia o marcadas claramente como hipótesis: 100 %.
- Clasificaciones de capturas aplicadas sin confirmación: 0.
- Afirmaciones de «original conservado» cuando no lo está: 0.
- Pérdida de capturas confirmadas en pruebas offline/reinicio: 0.
- Diferencias de hash tras export/restore: 0.
- Peticiones de red inesperadas en modo local: 0.
- Contenido sensible visible con el iPhone bloqueado o en exportaciones compartibles: 0.
- Mensajes enviados automáticamente fuera de la lista blanca: 0.
- Errores críticos de accesibilidad en el recorrido principal: 0.

### Evidencia requerida

- tests automatizados de invariantes de dominio, incluidas las de ADR-0008;
- test de persistencia con cierre/reapertura;
- prueba real en el iPhone 14 y el Mac de Manu, con versiones de iOS/macOS y tipo de aprovisionamiento;
- capturas de las superficies del sistema en cada modo probado;
- manifiesto y resultado de export/restore;
- informe de red en modo local;
- registro de permisos solicitados, en qué momento y con qué texto;
- lista de funciones excluidas o degradadas y su motivo;
- QA independiente del handoff del implementador.

## No cuenta como entrega

- mockups o demo sin persistencia;
- grafo visual sin procedencia;
- chat que responde sin mostrar fuentes;
- integración teórica no probada;
- backup que nunca se ha restaurado;
- experiencia que deja de funcionar al acabar una cuota de IA;
- widgets o modos que solo funcionan en el simulador;
- una app que caduca sin que Manu sepa cómo reinstalarla (D-03);
- funciones presentadas como disponibles cuando dependen de una ruta no verificada.
