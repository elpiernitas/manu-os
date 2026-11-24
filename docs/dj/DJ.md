# DJ de MANU (WEB-123)

**MANU OS → Hoy → 🎧 DJ → ▶︎ Reproducir.** El motor DJ-BRAIN elige la canción y Spotify la reproduce. Cada salto se nota en lo siguiente que elige.

## Cómo funciona

```
Hoy (panel) ──▶ Tú → DJ (web/dj/controller.js)
                   │  catálogo: web/dj/catalog.js  ◀── Spotify (lo que sí deja una app nueva)
                   │  cerebro:  web/dj/brain/       (DJ-BRAIN, decide)
                   ▼
              bucle: web/dj/runner.js ── reproducir / encolar ──▶ Spotify (reproduce)
                   ▲                                              │
                   └────────── cada 3 s: ¿qué suena? ◀───────────┘
```

1. **Catálogo de candidatas** (se rehace cada 20 h, o con «Actualizar desde Spotify»):
   - tus playlists (hasta 25, con 150 canciones cada una);
   - tus tops de 4 semanas, 6 meses y años;
   - 300 guardadas y lo escuchado hace poco;
   - top y últimos lanzamientos de tus 15 artistas principales (canciones **nuevas de artistas que ya te funcionan**);
   - búsqueda por los géneros de tus artistas (**artistas nuevos**).
2. **Semántica de tus playlists**: cada una tiene un papel, que se elige en el DJ, en «Tus playlists»:
   - **Núcleo**: señal fuerte de gusto;
   - **Modo triste**: solo cuenta con el modo Triste activado;
   - **Compartida**: oficina, casi no cuenta como gusto. Las playlists colaborativas empiezan así;
   - **Descubrimiento**: señal débil. Es el valor por defecto.
3. **Reproducir**: el motor elige la primera y Spotify la pone en el dispositivo activo (o en tu iPhone). Se encola **solo una** siguiente: Spotify no deja quitar canciones de su cola, y así cada salto cambia pronto lo que viene.
4. **Cada 3 s**, mientras MANU está abierta, mira qué suena. Si cambió de canción, la anterior cuenta como **entera** (≥ 90 %) o **saltada** (con los segundos escuchados), se le pasa al motor y se encola la siguiente que él elige. Las que te saltes entre dos vistazos cuentan como saltos de 0 s. Lo que pongas tú a mano en Spotify se aprende como elegido por ti.
5. **Saltos**:
   - muy fuertes para la sesión y casi nulos para tu gusto;
   - 3 rápidos (menos de 10 s) activan «Buscando lo que te apetece»: se aleja de lo saltado y sube la novedad;
   - la siguiente que dejas sonar pasa a ser el ancla («En el rollo»).
6. **Descubrimiento**:
   - reparto de 30 % conocidas, 45 % cercanas y 25 % lejanas, que se ajusta;
   - un artista nuevo que funciona dos veces abre la profundización, sin dos canciones suyas seguidas.
7. **Contexto**:
   - «En la oficina»: lo que suene no cuenta como tu gusto;
   - «Triste»: activa el modo.
8. **Idioma**:
   - «Solo inglés» es estricto: solo pone canciones con idioma conocido en inglés;
   - hoy la única fuente son las etiquetas que pones tú mientras suena una canción (no se adivina nada);
   - la fuente se cambia en `web/dj/language.js`.
9. **Lo aprendido** se queda en tu iPhone, en IndexedDB (`manuos-dj`): el registro de eventos del DJ, los papeles de las playlists, los idiomas y tu historial importado. No va a Tu nube ni a Git, y sí entra en la copia completa cifrada.
10. **Tu historial de Spotify**, opcional: DJ → «Tu historial de Spotify» → elige los `Streaming_History_Audio_*.json`.
    - Se procesan en el iPhone y solo se guarda canción, artista, ms, si terminó y la fecha.
    - Una canción que solo está en una playlist compartida cuenta como compartida.

## Lo que NO usa

Recommendations, Related Artists, Audio Features ni Audio Analysis. Si un día hay otra fuente de candidatas o de parecido (Last.fm, MusicBrainz, letras), entra en `catalog.js` o como rasgos de `Track` sin tocar el motor.

## Límites reales

- **Spotify Premium:** necesario para controlar la reproducción.
- **Con MANU cerrada o el iPhone bloqueado, iOS para el bucle.** Antes de pasar a segundo plano el DJ encola 3. Después, Spotify sigue con su reproducción automática. Al volver, «¿Ya suena Spotify? Retomar sin cortar» adopta lo que suena.
  - Solución futura: un bucle en el servidor (Supabase), no hecho.
- **Sin dispositivo abierto:** si Spotify no tiene ninguno, el DJ lo dice y abre Spotify; vuelve y pulsa «Ya está abierto: reproducir».
- **Géneros:** si Spotify no da géneros de tus artistas, el parecido entre canciones solo usa «mismo artista» y la búsqueda de artistas nuevos no tiene de dónde tirar.
- **Playlists de Spotify** (daylist, Mixes): una app nueva no puede leerlas.
- **NO_VERIFICADO contra tu cuenta real.** Las pruebas usan un Spotify falso que imita la API. Que tu app «MANU OS» de Spotify siga en modo desarrollo con tu usuario dentro y con esta web como dirección de retorno se ve al conectar.

## Pruebas

- `web/tests/dj-acceptance.test.js`: los 12 criterios de DJ-BRAIN-00.
- `web/tests/dj-unit.test.js`
- `web/tests/dj-runner.test.js`: el bucle con un Spotify falso, el catálogo y el adaptador.
- `e2e/dj.e2e.mjs`: panel → DJ → Reproducir → 3 saltos → «Buscando» → ancla → Siguiente → oficina → idioma → volver, contra un Spotify falso. Comprueba también los casos sin conexión, con permisos viejos y sin dispositivo.

## Documentos

- `DJ-BRAIN-00.md`: especificación general.
- `ARQUITECTURA-FASE0.md` y `INTERPRETACIONES.md`.

El contexto personal (`DJ-BRAIN-PRIVATE.md`) no está en este repositorio público.
