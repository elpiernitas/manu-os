# La semana, el tiempo reservado y preparar la semana (WEB-121)

Misión maestra, ideas 01 (calendario), 06 (decir que no), 10 (descansar sin culpa), 12 (revisión semanal), 13 (aficiones), 14 (aprender) y 15 (lectura).

## Qué ya existía y se reutiliza
- Calendario de Google, eventos pegados y cumpleaños, a través de `eventsFor`.
- Recordatorios.
- Repaso nocturno y semanal hacia atrás (`core/review.js`).
- Cargos repetidos detectados en Dinero (`core/insights.js`).
- Biblioteca, que ya admite libros.

## Nuevo (`core/week.js`, `core/interests.js`)
- **Tu semana** (Agenda). Muestra los 7 días con cada cosa etiquetada por lo que es:
  - **Evento**: está en un calendario;
  - **Recordatorio**: lo puso Manu;
  - **Reservado**: tiempo suyo;
  - **Propuesta**: una fecha que MANU supone y que solo se acepta en Hoy.

  Los huecos libres se quedan libres. Avisa de:
  - un evento que choca con un rato reservado («Tú decides cuál se queda»);
  - tres o más días llenos sin ningún rato reservado, y entonces propone proteger una tarde.
- **Reservar un rato sin compromisos**: un día concreto o cada semana, para descansar o para una afición.
  - Durante ese rato Hoy dice «Nada que hacer» y no enseña propuestas ni conexiones.
  - Se guarda en `settings.reserved`.
- **Decir que no**: «Decir que no» en un evento prepara un texto neutro, sin excusas inventadas, para que Manu lo copie y lo mande él. MANU nunca escribe a nadie.
- **Preparar la semana** (Repaso, y botón en la tarjeta del domingo). Tiene dos modos:
  - **Rápido (10 min)**: citas, tareas, documentos con fecha, pagos que suelen llegar y tiempo reservado, con 3 elementos por bloque;
  - **Completo**: todo, más las ideas aparcadas y los proyectos.

  Cada bloque dice de dónde sale. Los pagos se marcan como estimación. No es un tercer sistema semanal: va junto al repaso que ya había.
- **Aficiones y aprender** (Tú):
  - sin metas ni rachas;
  - el siguiente paso pequeño lo escribe Manu, si quiere;
  - enlaza lo que ya hay en la Biblioteca por palabras;
  - «Reservar un rato para esto» lleva al formulario de reservar.
- **Lectura**: sin pestaña nueva. La Biblioteca gana el filtro «📚 para leer».

## Pruebas
- `web/tests/week.test.js`
- `e2e/semana.e2e.mjs`: 22 comprobaciones.
- `e2e/mp.e2e.mjs`: contraste y desbordes también en Momentos y Aficiones.
