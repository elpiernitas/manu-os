// Idioma real de cada canción (DJ-BRAIN §15). Ninguna fuente fiable está conectada todavía: no se
// adivina por título, país ni artista. Hoy la única fuente son las etiquetas que pones tú desde el DJ
// («esta es en inglés»). Mañana se añade otra fuente (letras, MusicBrainz…) implementando languageOf.
export const LANGS = { en: "Inglés", es: "Español", multi: "Varios idiomas", instrumental: "Instrumental" };
export const manualLanguageSource = (tags) => ({ name: "manual", languageOf: (trackId) => tags?.[trackId] ?? null });
/** Aplica las fuentes en orden; lo que ninguna sabe se queda «unknown» (y un filtro estricto lo excluye). */
export function applyLanguages(catalog, sources) {
  let known = 0;
  for (const t of catalog.values()) {
    const lang = sources.map((s) => s.languageOf(t.id)).find(Boolean);
    t.language = LANGS[lang] ? lang : "unknown";
    if (t.language !== "unknown") known++;
  }
  return known;
}
