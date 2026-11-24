# DJ-BRAIN · Fase 0: diseño antes del código

Alcance: **solo la Fase 0** de `DJ-BRAIN-00.md`, un motor offline que procesa eventos y puntúa candidatas.

Queda fuera:
- interfaz y PWA;
- MANU OS;
- Spotify;
- reproducción.

## 1. Arquitectura propuesta

```
            eventos (JSON)                        candidatas (Track[])
                 │                                        │
                 ▼                                        ▼
        ┌──────────────────┐   lee/escribe   ┌──────────────────────────┐
        │  DjBrain.process │ ───────────────▶│  Memorias (estado puro)  │
        │  (validación +   │                 │  explicit · playlists    │
        │   despacho)      │                 │  taste/fatigue · session │
        └──────────────────┘                 │  context                 │
                 │ explicación               └──────────────────────────┘
                 ▼                                        │
          log de decisiones          DjBrain.rank()  ◀────┘
                                     1. filtros duros (antes de todo)
                                     2. grupo de cada candidata (A–F)
                                     3. factores × y desglose
                                     4. mezcla por cuotas de grupo
```

**Principios:**
- **Núcleo puro y determinista.** Sin red, sin reloj implícito (la hora la trae cada evento) y sin azar: los empates se resuelven por id. Mismo estado y mismos eventos → mismo resultado.
- **Independiente del proveedor.** El motor solo conoce `Track`. Un adaptador de catálogo, en fases futuras, traduce Spotify, Last.fm, MusicBrainz o lo que sea a `Track`. La similitud usa `tags` y `traits` que aporte cualquier fuente; no hay llamadas a Recommendations, Related Artists, Audio Features ni Audio Analysis.
- **Configuración fuera del código.**
  - Pesos y umbrales en `config/defaults.js`, todos marcados como [PROPUESTA].
  - El significado de las playlists es un dato de entrada.
- **Explicable.** Cada evento devuelve `explanation[]` y cada candidata un desglose de factores.
- **Datos reales solo en local.**
  - `web/dj/brain/importers/` convierte exportaciones a eventos sin guardar IP ni país.
  - `DjBrain.exportState()` y `DjBrain.fromState()` permiten guardar el cerebro en `data/`, que Git ignora.

## 2. Modelo de datos

```js
Track = {
  id, title, artistId, artistName, durationMs,
  language: "en" | "es" | "multi" | "instrumental" | "unknown",
  tags: string[],            // rasgos legibles de cualquier fuente (género, ánimo, tempo…)
  traits?: { [k]: number },  // vector numérico opcional, misma escala en todo el catálogo
  popularity?: number,       // 0–1, solo para preferir canciones menos obvias al profundizar
}

PlaylistSemantics = { [playlistId]: { role: "core" | "mode" | "shared" | "discovery", mode?: string, label?: string } }

Event = { type, at: ISO, ...campos según el tipo }
  session_started        { context? }
  session_ended          {}
  track_started          { trackId, source?: { playlistId?, shared? } }
  track_skipped          { trackId, msPlayed }
  track_completed        { trackId, msPlayed? }
  track_repeated         { trackId }                 // repetición inmediata
  track_saved_to_playlist{ trackId, playlistId }
  context_changed        { context: { device?, shared?, label?, mode? } }
  explicit_preference    { rule }
     rule = { kind: "artist", artistId, stance: "love"|"like"|"neutral"|"not_now"|"block" }
          | { kind: "language", only: "en"|"es"|null, allowMultilingual?, instrumental?: "allow"|"exclude" }
          | { kind: "mode", mode: string|null }            // activar o desactivar un modo («triste»)
          | { kind: "playlist", playlistId, role, mode? }  // corregir la semántica de una playlist

Taste (por canción y por artista) = {
  personal,         // evidencia personal acumulada (decae con el tiempo)
  modes: {modo: n}, // afinidad con modos
  shared,           // evidencia contextual (no personal)
  plays, firstAt, lastAt, days[],
  quickSkipDays[],  // días distintos con salto rápido fuera de SEARCHING
}
Fatigue (por canción) = { value 0–1, at }   // decae con el tiempo; separada del gusto
Session = { state, anchor, recent[], skipStreak, quickSkipsWindow[], tempBlocked{}, failedArtists{},
            deepDive{ artistId, hits, open }, consecutiveAccepts, directionAccepts }
Context = { device, shared, label, mode, confidence }
```

## 3. Estructura del repositorio

```
DJ-BRAIN-00.md            especificación general (sin datos personales)
DJ-BRAIN-PRIVATE.md       contexto personal y ejemplos reales — IGNORADO por Git
docs/ARQUITECTURA.md      este documento
docs/INTERPRETACIONES.md  dónde se interpretó la especificación en vez de seguir una regla explícita
config/defaults.js        pesos y umbrales [PROPUESTA]
web/dj/brain/
  brain.js                DjBrain: process(evento), rank(candidatas), exportState/fromState
  events.js               tipos y validación de eventos
  signals.js              clasificación del salto y de la escucha
  similarity.js           similitud independiente del proveedor (tags y traits)
  scoring.js              factores y puntuación
  pools.js                grupos A–F y mezcla por cuotas
  playlistRefresh.js      sugerencias ilimitadas para una playlist
  memory/explicit.js      reglas explícitas
  memory/playlists.js     semántica de playlists
  memory/taste.js         gusto a largo plazo y fatiga
  memory/session.js       estado de sesión (máquina de estados)
  memory/context.js       contexto
  importers/spotifyHistory.js   exportación → eventos (solo en local, descarta IP y país)
bin/simulate.js           ejecuta un escenario JSON y muestra estados y ranking por consola
fixtures/                 SOLO datos ficticios (catálogo y escenarios), marcados "ficticio": true
test/                     node:test
data/                     IGNORADO: aquí van los datos reales en local
```

## 4. Estrategia de pruebas

- **Criterios de aceptación** (`test/acceptance.test.js`): los 12 de DJ-BRAIN-00, cada uno con un escenario ficticio y el porqué en el nombre.
- **Unidades:**
  - clasificación de saltos;
  - máquina de estados (todas las transiciones);
  - memorias;
  - filtros duros;
  - grupos;
  - fatiga y su caída;
  - refresco de playlists;
  - importador (que descarta IP y país);
  - exportar y volver a importar el estado.
- **Determinismo:** el mismo escenario se ejecuta dos veces y da el mismo resultado.
- **Higiene de privacidad** (`test/privacy.test.js`), sobre los archivos que Git sigue:
  - `.gitignore` incluye `data/` y `DJ-BRAIN-PRIVATE.md`;
  - ningún archivo seguido tiene IPs, correos, URIs reales del proveedor ni campos de exportación con valores;
  - todos los fixtures llevan `"ficticio": true`.
- **Simulador:** `bin/simulate.js` sobre `fixtures/scenarios/*.json` muestra cómo cambian el estado y el ranking.

## 5. Dependencias mínimas

**Ninguna.** Node ≥ 20 con `node:test` y `node:assert`, y módulos ES. Sin `package-lock`, sin red y sin compilación.
