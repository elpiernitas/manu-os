// ExplicitPreferenceMemory (§6.1): reglas del usuario. Máxima prioridad; editables; con fecha.
export const STANCES = ["love", "like", "neutral", "not_now", "block"];
export const emptyExplicit = () => ({ artists: {}, language: null, mode: null, log: [] });

export function applyRule(mem, rule, at) {
  const m = structuredClone(mem);
  if (rule.kind === "artist") {
    if (!rule.artistId || !STANCES.includes(rule.stance)) throw new Error("Regla de artista: falta artistId o stance válida");
    m.artists[rule.artistId] = { stance: rule.stance, at };
  } else if (rule.kind === "language") {
    m.language = rule.only ? { only: rule.only, allowMultilingual: Boolean(rule.allowMultilingual), instrumental: rule.instrumental ?? null, at } : null;
  } else if (rule.kind === "mode") {
    m.mode = rule.mode ? { mode: String(rule.mode), at } : null;
  } else if (rule.kind !== "playlist") throw new Error(`Regla desconocida: ${rule.kind}`);
  m.log = [...m.log, { at, rule }].slice(-500);
  return m;
}

/** Filtro duro de idioma (§15). Se evalúa ANTES del ranking. */
export function passesLanguage(track, language, defaults) {
  if (!language?.only) return { ok: true };
  const lang = track.language ?? "unknown";
  if (lang === language.only) return { ok: true };
  if (lang === "multi" && language.allowMultilingual) return { ok: true };
  if (lang === "instrumental" && (language.instrumental ?? defaults.instrumental) === "allow") return { ok: true };
  return { ok: false, why: `idioma «${lang}» fuera del filtro «solo ${language.only}»` };
}
