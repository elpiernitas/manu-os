# Dónde se interpretó DJ-BRAIN-00 (Fase 0)

Decisiones tomadas porque la especificación no daba una regla exacta. Todas son [PROPUESTA] y se pueden cambiar en `config/defaults.js` o en el código indicado.

1. **HARD_FILTER no es un estado.** La especificación lo pone entre los estados, pero la misión pide la secuencia START → STABLE → SEARCHING → LOCKED_IN → FATIGUE, y un filtro debe valer en cualquier estado. Se aplica como una capa antes del ranking (`scoring.hardFilter`). Una sesión puede estar en SEARCHING con «solo inglés» activo.
2. **START → STABLE:** con 2 escuchas aceptadas. **STABLE → LOCKED_IN:** con 3 aceptadas seguidas. La especificación dice «varias»; los números son míos.
3. **FATIGUE:** 2 saltos (rápidos o moderados) de canciones parecidas al ancla, dentro de las últimas 4 escuchas, en una dirección que ya había funcionado al menos 2 veces. Se sale con la siguiente aceptada, que pasa a ser el ancla nueva.
4. **«Aceptada»:** más del 50 % de la canción, completa o repetida. **Ambigua:** entre 15–45 s y hasta el 50 %. No suma ni resta, pero descarta la canción para esa sesión.
5. **«Salto rápido»:** menos de 10 s, como pide §7.4 para SEARCHING. Coincide con los rangos de 0–5 s y de 5–10 s de §7.3.
6. **Ventana corta de SEARCHING:** las últimas 6 escuchas en 15 min, o la racha seguida desde el último positivo. Con 5 saltos la diversidad sube a 2; con 10, a 3 y se borra el ancla.
7. **Largo plazo de un salto rápido:** **cero**. Solo resta (−0,08) cuando se repite en 3 días distintos fuera de SEARCHING. La especificación dice «muy débil inicialmente»; con −0,01 el criterio 1 fallaba porque los dos primeros saltos ocurren antes de entrar en SEARCHING.
8. **Sesión compartida:** la escucha aporta un 5 % de evidencia personal (no 0 %) y además se apunta como evidencia «compartida». Es un descuento, no una lista negra (§16). Cuenta como compartida si la playlist tiene el papel `shared`, si el evento lo marca o si el contexto activo es compartido.
9. **Guardar en una playlist de modo:** +1 de afinidad con el modo y +0,08 de evidencia personal («principalmente el modo», criterio 5). Fuera de ese modo, una canción que solo tiene afinidad de modo puntúa ×0,6.
10. **Corrección explícita contra histórico** (criterio 6): la postura sobre el artista multiplica su afinidad personal (`not_now` ×0,05, `block` lo excluye, `love` ×2). Además, la evidencia antigua pierde la mitad de su peso cada 240 días.
11. **Política de instrumentales con «solo inglés»:** por defecto se **excluyen**. La regla puede permitirlas (`instrumental: "allow"`). Los bilingües se excluyen salvo `allowMultilingual`, y los de idioma `unknown` siempre.
12. **Fatiga:** sube +0,3 al saltar algo que gusta y +0,08 con cada escucha. Pierde la mitad cada 4 días. Por encima de 0,6 la canción casi no se recomienda (×0,08). El gusto base no se toca.
13. **Profundizar en un artista:** un artista «nuevo» es uno con 1 escucha previa o ninguna. El primer acierto da un empujón ×1,25; el segundo abre la profundización (×1,6 y preferencia por canciones menos populares). Se cierra con 2 saltos rápidos. En una tanda nunca hay dos canciones seguidas del mismo artista, ni más de 2 en cada 5.
14. **Reparto conocidas/cerca/lejos:** 30/45/25 %, dentro de los rangos de §10. Más lejos en SEARCHING (+10 % por nivel de diversidad) y si se aceptan descubrimientos (+5 %). En una tanda se descarta lo que puntúa menos del 8 % de la mejor: una cuota no se rellena con canciones malas.
15. **Cambio de dispositivo:** nunca reinicia la sesión. Solo la reinicia un hueco de más de 45 min o `session_started`. Una sesión caducada tampoco cuenta al puntuar.
16. **Similitud:** se calcula con etiquetas (Jaccard) y, si hay rasgos numéricos, con coseno. Dos canciones del mismo artista valen al menos 0,6. Está pensada para cualquier fuente que no sea la API retirada de Spotify.
17. **Refresco de playlists:** «ilimitado» significa que no se repite nada mientras quede catálogo sin enseñar. Lo enseñado y no rechazado vuelve a los 30 días o con un cambio de contexto. Lo rechazado no vuelve en ese refresco. En la Fase 0 el catálogo es finito: sin una fuente de catálogo real no hay «infinito» de verdad.
