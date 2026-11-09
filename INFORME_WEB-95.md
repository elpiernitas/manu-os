# Informe WEB-95 · Aprender de ideas, decisiones, correcciones y conversaciones

**Resumen:** MANU ya aprende de mucho más que de los gastos:
- cómo escribes (tus expresiones, cómo te ríes, si usas emojis);
- tus chistes y juegos de palabras, cuando tú se lo dices;
- tus decisiones;
- cómo ordenas tus ideas en proyectos.

Nada de eso se usa ni se da por cierto hasta que lo confirmas, y nunca inventa una frase ni un recuerdo tuyo. El modo amanecer queda en el backlog, bloqueado hasta saber qué luces tienes.

---

## 1. Punto de partida

- WEB-94 (Memoria) estaba fusionada en `main` (PR #97).
- MANU ya aprendía categorías de gasto, por comercio y por rasgos.
- Había una pantalla Memoria, con voz (humor y franqueza) y expresiones tuyas escritas a mano.
- `autofile.js` (WEB-60) archiva ideas y capturas en proyectos según unas palabras clave que había que escribir a mano.
- MANU ya calcula y pone tu alarma (`proposeAlarm` y el atajo «MANU Alarma»).

## 2. Decisiones técnicas

| Decisión | Por qué |
|---|---|
| **El estilo es un recuento, no un recuerdo** | Lo que MANU observa de cómo escribes no se guarda como «hecho sobre Manu». Son contadores, con un ejemplo corto para que veas de dónde sale. Solo cambia la voz de MANU cuando dices que sí; un «no» es definitivo. |
| **Solo tus palabras, sin terceros** | Corta en lo que parece un nombre (mayúscula dentro de una frase), en las cifras, los enlaces y los correos. Descarta temas sensibles (dinero, salud, sexo, drogas, parejas…). No observa el Refugio ni las crisis, ni las órdenes a MANU (gastos, recordatorios, tareas). |
| **El humor no se adivina** | Detectar un juego de palabras automáticamente sería inventar. Lo marcas tú con «guárdate esa» y se guarda tal cual, con su fecha. MANU solo te lo recuerda si se lo pides. |
| **Las decisiones se ofrecen, no se suponen** | «He decidido…» muestra un botón «Guardar decisión». Una frase dicha de pasada no se convierte en decisión sin tu toque. |
| **Ideas: aprender de lo que ya haces** | Las notas que metes tú en un proyecto enseñan sus palabras. Lo que sacas después de un archivado automático cuenta en contra. MANU propone añadir o quitar palabras clave, y el archivado automático mejora con ello. |
| **Proactividad con freno** | Las propuestas de estilo solo salen en Tú → Memoria, nunca en Hoy. Se mantienen el presupuesto diario y el silencio tras un «Luego» de WEB-94. |
| **Modo amanecer sin código** | Depende de tus luces y de su app. Programarlo sin saberlo sería fingir. Queda especificado en el backlog con sus preguntas abiertas. |

## 3. Qué funciona ya

**En el chat:**
- Tus mensajes enseñan tu estilo, sin hacer nada especial. Las órdenes a MANU no cuentan.
- «guárdate esa» o «eso es un juego de palabras», justo después de uno bueno, lo guarda literal.
- «cuéntame uno de mis chistes» te devuelve uno *tuyo*, con su fecha. Si no hay ninguno, te lo dice.
- «He decidido no pedir comida a domicilio entre semana» te ofrece guardarlo como decisión. Luego, «¿qué decidí sobre la comida?» lo encuentra.

**En Tú → Memoria:**
- **Propuestas nuevas**, siempre con su recuento y su «por qué»:
  - *«Escribes mucho «qué máquina» (3 veces, en 2 días distintos). ¿Es una expresión tuya?»*
  - *«Cuando algo te hace gracia escribes «jajaja». ¿Me río igual?»*
  - *«Casi nunca usas emojis. ¿Prefieres que yo tampoco?»*
  - *«Cuando apuntas algo de Onda Norte sueles usar «jingle». ¿La añado a sus palabras?»*
  - *«Una palabra clave falla, ¿la quito?»*
- **Tarjeta «Tu estilo»:**
  - lo observado (mensajes, días, risa, emojis);
  - el interruptor «Aprender de cómo escribo»;
  - «Olvidar lo observado» (tus «sí» y «no» se mantienen);
  - tus chistes guardados, con «Quitar».

**Cómo cambia MANU:**
- Usa tus expresiones aceptadas, escritas como tú (con acentos), solo en el momento que eliges y de vez en cuando.
- Se ríe a tu manera de vez en cuando, si el humor está activado.
- Tras aceptar una palabra clave, la idea siguiente que la lleve se archiva sola en el proyecto.

**Backlog:** WEB-96 «Modo amanecer» en `docs/roadmap/BACKLOG.md`, con el diseño (empieza N minutos antes de la alarma que pone MANU y llega al 100 % a esa hora) y las preguntas pendientes.

## 4. Pruebas

| Comando | Resultado |
|---|---|
| `npm test` (en `web/`) | **313 de 313**, 13 pruebas nuevas en `tests/estilo.test.js` |
| `node --check` de `app.js`, `sw.js` y `core/*.js` | OK |
| `node e2e/estilo.e2e.mjs` (Chromium con emulación de iPhone 14) | **16 de 16** |
| `node e2e/memoria.e2e.mjs` y `node e2e/bahia.e2e.mjs` | Sin regresiones |

`e2e/estilo.e2e.mjs` comprueba el chat, el chiste, la decisión, las propuestas, el interruptor, la palabra clave y el archivado automático.

Entre los casos límite probados:
- los nombres y la salud nunca forman expresiones;
- tres veces el mismo día no es una costumbre;
- un «no» no se repite;
- con el aprendizaje apagado no cuenta nada;
- las palabras del nombre del proyecto nunca se quitan;
- las propuestas no cambian nada por sí solas;
- «recuérdame» sigue siendo un recordatorio.

**Encontrados y corregidos:**
1. La nota de un proyecto se aprendía *después* de redibujar la pantalla, y no se guardaba nada (lección QAL-049).
2. La expresión aceptada salía sin acentos («que maquina»). Ahora sale como la escribes.
3. En el formulario «Tus expresiones» de WEB-94, el botón «Añadir» salía aplastado en el móvil.

## 5. Qué puedes probar

PR en borrador (enlace en el mensaje de la sesión). Hasta que se fusione, no está en tu MANU publicado. En el Mac:

```sh
python3 -m http.server 8765 --directory web
```

Después abre http://localhost:8765 y prueba en el chat «guárdate esa», «He decidido…» o «¿qué decidí sobre…?», o entra en Tú → Memoria → Tu estilo.

## 6. Pendiente o bloqueado

- **Nada probado en Safari ni en tu iPhone** (NO_VERIFICADO).
- **Filtro de nombres:** se basa en las mayúsculas. Un nombre escrito en minúscula podría acabar como expresión candidata, aunque solo como propuesta que ves y puedes rechazar.
- **Aprendizaje de tus correcciones de memoria:** cuando corriges un recuerdo, queda el historial, pero aún no se extraen patrones («siempre corriges la misma cosa»). Es la siguiente extensión natural.
- **Modo amanecer:** bloqueado por las preguntas del punto 7.

## 7. Qué necesito de ti

1. **Las luces del modo amanecer:**
   - ¿qué marca y modelo son, y con qué app las controlas?
   - ¿aparecen en la app Casa o en Atajos?
   - ¿cuántos minutos de amanecer quieres, y solo entre semana o siempre?
2. **¿Fusiono WEB-95** cuando lo hayas probado?
3. **Pendiente de WEB-94:** ¿la memoria (y ahora tu estilo) debe viajar en Tu nube o quedarse solo en el dispositivo?

## 8. Rama y commits

Rama `claude/magical-goodall-rf5qoo`, reiniciada desde `main` (`293485a`, con WEB-94 ya fusionada):

| Commit | Contenido |
|---|---|
| `4a45ba3` | WEB-95: aprender de ideas, decisiones, correcciones y conversaciones |
| (siguiente) | WEB-95: acentos, formulario, modo amanecer en el backlog, documentación e informe |

Nada fuera de este repositorio: sin servicios externos, datos sensibles, compras ni fusiones.
