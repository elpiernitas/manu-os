# DJ-BRAIN-00 · Especificación general del motor

**Estado:** especificación de comportamiento v0.1 (versión general, sin datos personales).
**Objetivo:** definir cómo piensa y aprende el DJ antes de diseñar interfaz o reproducir música.

> El contexto personal y los ejemplos reales viven en `DJ-BRAIN-PRIVATE.md`, que **no** entra en Git
> (`.gitignore`). Este documento usa roles genéricos: «playlist núcleo», «playlist de modo»,
> «sesión compartida», «transporte». Los ejemplos con nombres son ficticios.

**Principio rector:** no adivinar «qué música le gusta al usuario» como una lista fija. Modelar por separado **identidad musical**, **estado actual** y **contexto**, y adaptarse en tiempo real sin confundir una reacción momentánea con un cambio permanente de gusto.

## 0. Etiquetas

- **[REQUISITO]**: regla expresada explícitamente por el usuario. No se negocia.
- **[OBSERVACIÓN]**: patrón observado en sus datos (el detalle está en el documento privado).
- **[PROPUESTA]**: decisión de diseño a probar. Los pesos, umbrales y transiciones son valores iniciales experimentales, nunca verdades del usuario.

## 1. Visión

El usuario pulsa **Reproducir DJ** y suena música que encaja con lo que le apetece ahora. Si falla, pasa canciones y el sistema corrige rápido; si acierta, mantiene el rollo. Aprende a largo plazo sin confundir música contextual (por ejemplo, una sesión compartida de oficina) con gusto personal. No es un chatbot, ni un generador de playlists estáticas, ni una copia del DJ de Spotify: es un **motor de selección musical continuo, contextual, adaptativo y con memoria**. No habla durante la reproducción (voz fuera del MVP).

## 2. Requisitos del usuario

- [REQUISITO] Lo que suena en una sesión compartida (oficina) no se convierte automáticamente en gusto personal.
- [REQUISITO] Muchos saltos seguidos significan «busco lo que me apetece ahora», no «odio esto».
- [REQUISITO] Si una canción funciona, seguir en ese rollo hasta que los saltos digan lo contrario.
- [REQUISITO] Descubrir bastante más música diferente que la que ofrecen los DJ comerciales.
- [REQUISITO] Si un artista nuevo funciona, explorar más canciones suyas.
- [REQUISITO] «Solo en inglés» se cumple estrictamente según el idioma real de la letra (no título, país ni nacionalidad).
- [REQUISITO] Las recomendaciones para añadir a una playlist nunca se agotan.

## 3. Fuentes de datos (genéricas)

| Fuente | Uso | Límite |
|---|---|---|
| Historial ampliado del proveedor (exportación) | Evolución, horarios, saltos, persistencia | Solo en local (`data/`); se descartan IP y país al importar |
| Registro continuo de escuchas (tipo scrobbling) | Nuevas escuchas | No sirve para saltos muy tempranos |
| Playlists actuales | Semántica de cada playlist | — |
| Señales de contexto (dispositivo, transporte, hora) | Inferir contexto | El contexto no es un género |

**Independencia del proveedor [REQUISITO técnico]:** el motor no depende de endpoints de recomendaciones, artistas relacionados, características ni análisis de audio de ningún proveedor. Para una app nueva no se asume que existan. La similitud se calcula con rasgos (`traits`) y etiquetas (`tags`) que aporta cualquier adaptador de catálogo.

## 4. Jerarquía de verdad musical

1. Instrucción explícita actual.
2. Regla explícita persistente.
3. Acción explícita de alto significado (añadir a una playlist con semántica conocida, bloquear, favorito).
4. Patrón reciente repetido.
5. Comportamiento histórico.
6. Inferencia algorítmica.

Ejemplo ficticio: el histórico muestra muchas escuchas de «Artista Antiguo», pero el usuario dice hoy «ya no me da más». Manda la declaración.

## 5. Tres capas que nunca se mezclan

- **Identidad musical** (lenta): playlist núcleo, artistas confirmados, repeticiones en periodos separados, exploraciones profundas, guardados, correcciones.
- **Estado actual** (rapidísimo): saltos inmediatos, escuchas completas, la canción que rompe una racha de saltos, repeticiones, cambios de dirección.
- **Contexto** (modifica la interpretación, no define el gusto): casa/altavoz, móvil/auriculares, sesión compartida, transporte, deporte, modo emocional explícito.

## 6. Memorias

- `ExplicitPreferenceMemory`: reglas del usuario, editables y de máxima prioridad (posturas sobre artistas, idioma, contextos).
- `PlaylistSemanticMemory`: el significado de cada playlist, por configuración (no por código).

  | Rol | Significado | Peso en gusto personal |
  |---|---|---|
  | `core` | gusto sonoro central («me mola el rollo») | muy alto |
  | `mode` | modo emocional/contextual (p. ej. tristeza) | bajo fuera de ese modo |
  | `shared` | contexto compartido (p. ej. oficina) | casi cero |
  | `discovery` | fuente de descubrimiento del proveedor | señal indirecta |

- `LongTermTasteMemory`: afinidad por canción y artista, recencia, **fatiga separada del gusto**, contexto en que funciona y confianza.
- `SessionMemory`: ventana corta (últimos 20–30 candidatos): tiempo escuchado, motivo de fin, dirección, racha de saltos, ancla, artistas probados, descartes temporales, restricciones activas. Se degrada al acabar la sesión.
- `ContextMemory`: probabilidades de contexto; nunca declara un contexto cierto por una sola pista ambigua.

## 7. El salto: regla central

Cada salto tiene dos impactos: **de sesión (fuerte)** y **a largo plazo (muy débil)**.

Umbrales iniciales [PROPUESTA]:

| Escuchado | Señal |
|---|---|
| 0–5 s | rechazo fuerte de sesión |
| 5–15 s | rechazo moderado de sesión |
| 15–45 s | ambigua |
| > 50 % | positiva moderada |
| > 85 % | positiva fuerte |
| repetición inmediata | positiva muy fuerte |

**SEARCHING** [PROPUESTA]:
- 3 saltos de menos de 10 s en una ventana corta activan el modo.
- Con 5, la diversidad aumenta mucho.
- Con 10, la dirección se reinicia, pero se conservan las restricciones duras.

Mientras dura:
- no se penaliza a largo plazo, salvo patrones repetidos en días distintos;
- el DJ se aleja del último grupo musical;
- evita los artistas recién fallidos;
- sube la novedad.

Una canción escuchada lo suficiente rompe la búsqueda, pasa a ser **ancla** y la sesión entra en `LOCKED_IN`.

## 8. Estados de sesión

- `START`: aún no hay información de la sesión. Usa hora, contexto, gusto, restricciones y variedad controlada.
- `STABLE`: varias escuchas aceptadas y pocos saltos. Mantiene la dirección con variaciones pequeñas.
- `SEARCHING`: hay una racha de saltos. El objetivo es encontrar un ancla, no ser coherente.
- `LOCKED_IN`: un ancla funciona. Mantiene el rollo con variedad.
- `FATIGUE`: se saltan canciones que antes funcionaban en esa dirección. Se desplaza poco a poco a otra zona.
- `HARD_FILTER`: hay instrucciones explícitas (idioma, exclusiones, contexto). Se evalúan **antes** del ranking.

## 9. Grupos de candidatos

| Grupo | Qué contiene |
|---|---|
| A · `KnownCore` | Afinidad personal actual alta |
| B · `Rediscovery` | Canciones conocidas que hace tiempo que no suenan. No resucita lo que el usuario corrigió. |
| C · `ArtistDeepDive` | Más canciones de un artista nuevo que acaba de funcionar |
| D · `AdjacentDiscovery` | Canciones nuevas cerca de las anclas |
| E · `FarDiscovery` | Canciones nuevas más lejos, pero plausibles. Obligatorio: el usuario quiere descubrir más. |
| F · `Contextual` | Solo cuando ese modo está activo explícitamente |

## 10. Exploración frente a familiaridad [PROPUESTA]

Reparto de una sesión normal:
- 20–35 % de conocidas o anclas;
- 40–55 % de descubrimiento cercano;
- 15–30 % de descubrimiento lejano.

El reparto se ajusta según la respuesta. Regla anti-burbuja: siempre hay capacidad reservada para **sorpresas plausibles**.

## 11. Profundizar en un artista

1. Un artista nuevo que funciona genera el evento `new_artist_hit`.
2. Durante las siguientes canciones entran 1–2 canciones suyas, nunca cinco seguidas.
3. Si vuelve a funcionar, se abre `ArtistDeepDive`, priorizando canciones menos obvias.
4. Varios saltos rápidos lo cierran.

## 12. Fatiga

`fatigue_score` va separado de `taste_score` y disminuye con el tiempo. Una canción con mucho gusto y mucha fatiga deja de sonar un tiempo sin perder su gusto base.

## 13. Guardar en una playlist

El destino importa:

| Destino | Señal |
|---|---|
| `core` | Señal personal muy fuerte |
| `mode` | Afinidad con el modo, poco con el DJ normal |
| `shared` | Contextual |

Se pueden definir playlists nuevas sin tocar código.

## 14. Recomendaciones para playlists: ilimitadas

Cada vez que se refresca:
- excluye lo ya mostrado y lo rechazado;
- usa lo añadido como señal positiva;
- respeta la semántica de la playlist;
- solo reintroduce algo antiguo tras un tiempo de espera o un cambio de contexto.

No existe el estado «se acabaron» mientras haya catálogo.

## 15. Idioma real

Clasificación por canción:
- `en`;
- `es`;
- `multi`;
- `instrumental`;
- `unknown`.

Con «solo inglés» estricto:
- se permite `en`;
- se excluyen `es` y `multi` (salvo indicación contraria) y `unknown`;
- los instrumentales siguen una política explícita y configurable.

De dónde sale el idioma se decide en otra especificación.

## 16. Sesiones compartidas (oficina)

Una escucha en un contexto compartido no aumenta automáticamente la afinidad personal. Es un **descuento de evidencia**, no una lista negra. Si la canción tiene señales independientes (está en la playlist núcleo, se escucha voluntariamente fuera, se repite o se guarda personalmente), sí cuenta como gusto personal.

## 17. Hora y dispositivo

Sirven para inferir **contexto**, no un contenido obligatorio. Cambiar de dispositivo (por ejemplo, del altavoz al móvil al salir de casa) no cambia el estilo, y el estado de la sesión sobrevive a un cambio razonable de dispositivo.

## 18. Primera conversación con el usuario

1. Analizar antes de preguntar.
2. Formular hipótesis concretas («este artista crece mucho en tus datos este año: ¿es tuyo o viene de una sesión compartida?»).
3. Guardar las respuestas como reglas explícitas.
4. No preguntar lo que se puede deducir.

## 19. Puntuación [PROPUESTA]

`score = hard_filters × session_fit × personal_fit × discovery_value × context_fit × fatigue_penalty × repetition_penalty`

`hard_filters` vale 0 o 1. Cada factor se registra para poder explicar la decisión.

## 20. Casos ficticios

- **A.** Tres saltos rápidos seguidos (Artista Uno, Dos, Tres) → `SEARCHING`. No significa «ya no le gustan». Después, una canción completa pasa a ser el ancla, sin convertir a su artista en preferencia universal.
- **B.** 30 escuchas en la sesión compartida sin otras señales → la afinidad personal no sube. Si la canción está además en la playlist núcleo, sí es gusto.
- **C.** Dos canciones completas de un artista nuevo → `ArtistDeepDive` progresivo, sin monopolizar la sesión.
- **D.** Una candidata compatible pero bilingüe con «solo inglés» estricto → se descarta antes del ranking.
- **E.** Una canción de la playlist núcleo saltada varias veces esta semana → sube la fatiga, el gusto apenas cambia.

## 21. Qué NO hace el DJ

- Tratar cada escucha como un «me gusta» o cada salto como un «no me gusta».
- Dejar que el histórico antiguo domine.
- Asumir que lo compartido es personal.
- Preguntar constantemente.
- Cambiar de rollo porque cambia el dispositivo.
- Repetir por inercia.
- Pasar de «me gusta una canción de X» a «me gusta toda su discografía».
- Ignorar filtros explícitos.
- Quedarse sin recomendaciones.
- Hablar durante la reproducción.

## 22. Métricas

- `time_to_first_hit`
- `search_recovery`
- `session_skip_rate` (con contexto)
- `discovery_accept_rate`
- `discovery_save_rate`
- `new_artist_depth`
- `context_leakage`
- `hard_filter_violation` (debe ser 0)
- `repetition_fatigue`

## 23. Hipótesis pendientes

1. Qué rasgos explican pertenecer a la playlist núcleo.
2. Cuánto pesa una escucha completa frente a un guardado.
3. Cuándo una racha de saltos es un cambio de rollo y cuándo impaciencia.
4. Qué proporción de descubrimiento funciona mejor.
5. Cuánto dura la fatiga.
6. Cómo detectar una sesión compartida.
7. Cuánta distancia recorrer en `SEARCHING`.
8. Cuándo profundizar en un artista y cuándo volver a explorar.
9. Cómo distinguir «funciona de fondo» de «entusiasma».
10. De dónde sacar un idioma fiable.

## 24. Fases

- **0. Simulador offline.** Eventos → estado, memoria, grupos y explicación. Sin interfaz. **← fase actual**
- **1. Perfil y primera conversación.**
- **2. DJ en modo sombra:** recomienda, pero no controla el reproductor.
- **3. Reproducción real.**
- **4. Descubrimiento continuo y editor de playlists.**
- **5. Integración con MANU OS.**

## 25. Criterios de aceptación del primer cerebro

1. Tres saltos rápidos no degradan permanentemente a los artistas.
2. Una canción aceptada tras una racha de saltos cambia la dirección.
3. La música marcada como compartida no domina las recomendaciones personales.
4. Añadir a la playlist núcleo aumenta mucho la evidencia personal.
5. Añadir a una playlist de modo aumenta sobre todo la afinidad con ese modo.
6. El histórico antiguo no supera una corrección explícita reciente.
7. Puede recomendar música nunca escuchada.
8. Tras un artista nuevo que funciona, puede profundizar en su catálogo.
9. Un filtro de idioma estricto no se puede saltar por el ranking.
10. Las recomendaciones de playlist se pueden refrescar repetidamente.
11. Gusto alto con fatiga alta deja de recomendarse un tiempo sin perder el gusto base.
12. Un cambio de dispositivo no reinicia obligatoriamente el rollo de la sesión.

## 26. Resumen

> Lo que se escucha no siempre es lo que gusta. Lo que gusta no siempre es lo que apetece ahora. Y lo que apetece ahora puede cambiar en tres saltos.

La identidad es lenta, la sesión rapidísima, el contexto modifica la interpretación y las reglas explícitas mandan sobre todo lo demás.
