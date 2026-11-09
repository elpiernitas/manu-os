// Ideas y proyectos (WEB-95): MANU aprende de cómo Manu ordena sus ideas.
//
// autofile.js (WEB-60) archiva ideas, tareas y capturas en el proyecto cuyas palabras clave
// aparecen en el texto. Aquí se aprenden esas palabras de lo que hace Manu:
// - lo que él mete a mano en un proyecto (notas, ideas) enseña palabras de ese proyecto;
// - lo que él saca de un proyecto después de que se archivara solo es una corrección: la palabra
//   que lo provocó cuenta en contra.
// MANU solo propone («¿añado “logo” a Onda Norte?»); la palabra entra si Manu dice que sí.

import { normalise } from "./text.js";
import { projectKeys } from "./autofile.js";

export const MIN_TIMES = 3;
export const MIN_SHARE = 0.8;
export const MISFIRES = 2;
const STOP = new Set("para como sobre entre desde hasta este esta estos estas esto todo toda todos todas cosas cosa proyecto proyectos nuevo nueva mis tus sus que porque pero cuando donde hacer tengo tiene tener quiero algo mucho poco otra otro otras otros idea ideas tarea tareas nota notas captura apunte hola vale bueno pues entonces tambien solo".split(" "));

export const emptyTopics = () => ({ words: {}, miss: {}, decided: {} });

// Content words of a text: 4+ letters, no numbers, no capitalised words inside a sentence (names).
export function contentWords(text) {
  const out = new Set();
  let start = true;
  for (const raw of String(text ?? "").split(/(\s+|[.!?¡¿,;:\n]+)/)) {
    if (!raw || /^\s+$/.test(raw)) continue;
    if (/^[.!?¡¿\n]+$/.test(raw)) { start = true; continue; }
    if (/^[,;:]+$/.test(raw)) continue;
    const w = raw.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
    const name = /^\p{Lu}/u.test(w) && !start;
    start = false;
    if (!w || name || /\d/.test(raw)) continue;
    const n = normalise(w);
    if (n.length >= 4 && !STOP.has(n)) out.add(n);
  }
  return [...out];
}

/** Manu put this text in project `projectId` himself. */
export function observeFiling(topics, projectId, text) {
  const t = topics ?? emptyTopics();
  const words = { ...t.words };
  for (const w of contentWords(text)) words[w] = { ...(words[w] ?? {}), [projectId]: (words[w]?.[projectId] ?? 0) + 1 };
  return { ...t, words };
}

/**
 * Manu removed from project `project` something that had been filed automatically: each key of
 * the project present in that text misfired once.
 */
export function observeMisfile(topics, project, text) {
  const t = topics ?? emptyTopics();
  const hay = ` ${normalise(text).replace(/[^a-z0-9ñ]+/g, " ")} `;
  const hits = projectKeys(project).filter((k) => hay.includes(` ${k}`));
  const miss = { ...t.miss, [project.id]: { ...(t.miss[project.id] ?? {}) } };
  for (const k of hits) miss[project.id][k] = (miss[project.id][k] ?? 0) + 1;
  return { ...t, miss };
}

/** Words that clearly belong to one project and are not its keywords yet. */
export function keywordCandidates(topics, projects, { limit = 2 } = {}) {
  if (!topics) return [];
  const out = [];
  const byId = new Map((projects ?? []).map((p) => [p.id, p]));
  for (const [w, per] of Object.entries(topics.words)) {
    const total = Object.values(per).reduce((a, b) => a + b, 0);
    const [pid, n] = Object.entries(per).sort((a, b) => b[1] - a[1])[0];
    const p = byId.get(pid);
    if (!p || n < MIN_TIMES || n / total < MIN_SHARE) continue;
    if (projectKeys(p).some((k) => k === w || k.split(" ").includes(w))) continue;
    const key = `kw+:${pid}:${w}`;
    if (topics.decided[key]) continue;
    out.push({ key, project: pid, projectName: p.name, word: w, times: n, total });
  }
  return out.sort((a, b) => b.times - a.times).slice(0, limit);
}

/** Keywords Manu added that keep filing the wrong things. Name words are never removed. */
export function keywordRemovals(topics, projects) {
  if (!topics) return [];
  const out = [];
  for (const p of projects ?? []) {
    const own = new Set((p.keywords ?? []).map((k) => normalise(k).replace(/[^a-z0-9ñ]+/g, " ").trim()));
    for (const [k, n] of Object.entries(topics.miss[p.id] ?? {})) {
      const key = `kw-:${p.id}:${k}`;
      if (n >= MISFIRES && own.has(k) && !topics.decided[key]) out.push({ key, project: p.id, projectName: p.name, word: k, misfires: n });
    }
  }
  return out;
}

export const decideTopic = (topics, key, yes, { now = new Date() } = {}) => ({ ...(topics ?? emptyTopics()), decided: { ...(topics?.decided ?? {}), [key]: { yes: Boolean(yes), at: now.toISOString() } } });

// Applies an accepted proposal to the projects list (pure).
export function applyKeyword(projects, c, add) {
  return projects.map((p) => {
    if (p.id !== c.project) return p;
    const kws = p.keywords ?? [];
    if (add) return kws.some((k) => normalise(k) === c.word) ? p : { ...p, keywords: [...kws, c.word].slice(0, 15) };
    return { ...p, keywords: kws.filter((k) => normalise(k).replace(/[^a-z0-9ñ]+/g, " ").trim() !== c.word) };
  });
}
