# Segundo cerebro: capturar una vez y relacionar (WEB-120)

Misión maestra, idea 02 («crear un segundo cerebro») e idea 09 («documentar mi vida»).
Antes de escribir código se revisó lo que ya existía, para no duplicarlo:

| Pieza | Dónde | Qué hace |
|---|---|---|
| Memoria | `core/brain.js` | hechos, preferencias, decisiones; con procedencia, corregible y borrable |
| Guardar en MANU | `core/saveitem.js` | enlaces, notas y archivos a la Biblioteca |
| Archivado automático | `core/autofile.js` | lleva ideas y tareas al proyecto cuyas palabras mencionan |
| Documentos | `core/docs.js` | vencimientos y avisos |
| Cerebro compartido | `core/cerebro.js` | lo que guardan las IAs |

WEB-120 añade lo que faltaba: **relacionar** esas piezas y no repetirlas.

## Nuevo

- **Repeticiones** (`core/relate.js`: `findRepeat` y `addRepeat`):
  - si Manu guarda otra vez la misma idea (casi las mismas palabras) o el mismo enlace, se junta con el registro que ya existe;
  - se guarda la fecha en `repeats` y el texto nuevo como nota;
  - nada se borra;
  - funciona en el chat, la bandeja, la hoja rápida y Guardar en MANU;
  - Agenda enseña `×N`;
  - deshacer desde el chat quita la repetición, no la idea.
- **Fechas en lo guardado** (`whenIn`): «el 3 de diciembre a las 21:00», «mañana a las 10», «el viernes», «4/1».
  - Es una **suposición**: se enseña así y nunca crea nada sola.
  - No propone fechas pasadas.
- **Conexiones** (tarjeta en Hoy, fuera del horario de trabajo), con un máximo de tres propuestas, cada una con su porqué:
  - algo guardado con fecha → recordatorio en Agenda, que conserva su origen en `from`;
  - una idea guardada tres veces sin proyecto → proyecto con la idea dentro;
  - un documento que vence en 45 días o menos sin aviso → recordatorio una semana antes.

  «No, gracias» se recuerda en `settings.relDismissed`.
- **Momentos** (`core/moments.js`, Tú → Momentos): recuerdos de días normales, con estos campos:
  - una frase;
  - la fecha;
  - el lugar;
  - las personas de Personas;
  - una foto elegida, opcional, que se vuelve a codificar en el dispositivo, sin ubicación ni datos de cámara.

  Además:
  - enseña lo que había en la agenda ese día, sin copiarlo;
  - incluye «Tal día como hoy»;
  - aparece en «Buscar en todo».

  Privacidad:
  - la foto vive en IndexedDB y en la copia completa cifrada;
  - **los momentos no suben a Tu nube** (`cloudprivacy.js`) ni a ninguna IA.

## Límites honestos

- La detección de repeticiones es por palabras, no por significado: dos ideas iguales dichas de forma muy distinta seguirán separadas. El umbral es alto a propósito: es peor juntar dos ideas distintas.
- MANU no lee el texto de las fotos sin IA. Para que «comparto una captura de una cita → Agenda» funcione con una imagen hace falta Gemini (ya existente, a petición de Manu). Con texto o enlace compartido, funciona sin IA.

## Pruebas

- `web/tests/relate.test.js`
- `web/tests/moments.test.js`
- `e2e/relaciones.e2e.mjs`: 29 comprobaciones.
