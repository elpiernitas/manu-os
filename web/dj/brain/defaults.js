// Pesos y umbrales iniciales. TODOS son [PROPUESTA] (DJ-BRAIN-00 §0): valores para experimentar,
// no verdades del usuario. Se pueden sobrescribir al crear el cerebro: new DjBrain({ config }).
export const DEFAULTS = Object.freeze({
  skip: {
    strongMs: 5_000,        // 0–5 s: rechazo fuerte de sesión
    moderateMs: 15_000,     // 5–15 s: rechazo moderado
    ambiguousMs: 45_000,    // 15–45 s: ambiguo
    quickMs: 10_000,        // «salto rápido» para SEARCHING (<10 s)
    acceptRatio: 0.5,       // >50 %: positiva moderada
    strongAcceptRatio: 0.85,// >85 %: positiva fuerte
  },
  searching: {
    windowEvents: 6,        // ventana corta: últimas N escuchas
    windowMs: 15 * 60_000,  // …dentro de 15 min
    enter: 3,               // 3 saltos rápidos → SEARCHING
    widen: 5,               // 5 → diversidad agresiva
    reset: 10,              // 10 → reiniciar dirección (se conservan filtros duros)
  },
  states: {
    stableAfterAccepts: 2,          // START → STABLE
    lockAfterConsecutiveAccepts: 3, // STABLE → LOCKED_IN
    fatigueSkipsInDirection: 2,     // saltos en la dirección del ancla…
    fatigueWindow: 4,               // …dentro de las últimas N
    fatigueMinDirectionAccepts: 2,  // la dirección tiene que haber funcionado antes
    directionSimilarity: 0.5,       // similitud mínima para «misma dirección»
  },
  session: { idleResetMs: 45 * 60_000 }, // un hueco mayor → sesión nueva; un cambio de dispositivo NO reinicia
  taste: {
    halfLifeDays: 240,       // la evidencia personal antigua pierde peso
    complete: 0.12, strongComplete: 0.2, repeat: 0.3, partial: 0.05,
    longTermQuickSkip: 0,       // un salto rápido suelto no toca el largo plazo (§7.2, criterio 1)
    repeatedDaysPenalty: -0.08, // solo si el salto rápido se repite en días distintos fuera de SEARCHING
    repeatedDaysMin: 3,
    sharedDiscount: 0.05,    // escucha en contexto compartido: 5 % de la evidencia personal
    save: { core: 1.0, mode: 0.08, shared: 0.0, discovery: 0.15 },
    saveMode: 1.0,           // guardar en playlist de modo → afinidad con el modo
    artistShare: 0.35,       // parte de la evidencia que va también al artista
    newArtistMaxPlays: 1,    // «artista prácticamente nuevo»
  },
  fatigue: {
    halfLifeDays: 4,
    skipKnownLoved: 0.3,     // saltar algo que gusta sube la fatiga
    playRecent: 0.08,        // cada escucha reciente suma algo
    threshold: 0.6,          // por encima, no se recomienda ahora
  },
  explicit: { love: 2.0, like: 1.4, neutral: 1.0, not_now: 0.05, block: 0 },
  pools: {
    // reparto inicial (§10): conocidas 20–35 %, cerca 40–55 %, lejos 15–30 %
    mix: { known: 0.3, near: 0.45, far: 0.25 },
    rediscoveryDays: 90,
    adjacentSimilarity: 0.35,
    knownPersonal: 0.5,
  },
  deepDive: { openAfterHits: 2, insertEvery: 3, closeAfterQuickSkips: 2 },
  repetition: { sameArtistLast: 1, maxArtistInLast5: 2, trackCooldownMs: 3 * 3600_000 },
  refresh: { cooldownMs: 30 * 24 * 3600_000 },
  language: { instrumental: "exclude", allowMultilingual: false }, // política explícita (§15)
});
