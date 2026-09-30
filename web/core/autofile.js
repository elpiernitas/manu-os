// Projects that fill themselves (WEB-60). Each project has keywords (its name
// plus the ones Manu or Gemini add). Whatever he drops — ideas, tasks, kept
// screenshots — is filed into the project it clearly belongs to. It can also
// export itself as a .zip or a Markdown file for ChatGPT, Claude or
// NotebookLM. Pure: no DOM, no network.
import { normalise } from "./text.js";
import { addSource, PROJECT_LIMITS } from "./projects.js";
import { zipStore } from "./zipwrite.js";
import { mayGo } from "./ai.js";

const STOP = new Set("para como sobre entre desde hasta este esta estos estas todo toda todos todas cosas proyecto proyectos nuevo nueva mis tus sus".split(" "));
const words = (t) => normalise(t).replace(/[^a-z0-9ñ]+/g, " ").trim().split(" ").filter(Boolean);

// The words that mark something as belonging to a project.
export function projectKeys(p) {
  const fromName = words(p.name).filter((w) => w.length >= 4 && !STOP.has(w));
  const extra = (p.keywords ?? []).map((k) => words(k).join(" ")).filter((k) => k.length >= 3);
  return [...new Set([...fromName, ...extra])];
}

export function parseKeywords(text) {
  return [...new Set(String(text ?? "").split(/[,;\n]+/).map((k) => k.trim().slice(0, 40)).filter((k) => k.length >= 3))].slice(0, 15);
}

// Best project for a text: the one with most key hits (word starts). Ties → none.
export function matchProject(text, projects) {
  const hay = ` ${words(text).join(" ")} `;
  const scored = (projects ?? []).map((p) => ({ p, score: projectKeys(p).filter((k) => hay.includes(` ${k}`)).length })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  if (!scored.length || (scored[1] && scored[1].score === scored[0].score)) return null;
  return scored[0].p;
}

const itemsToFile = (v) => [
  // PENDING: what he jots in the chat before sorting it («apunta …»).
  ...(v.inbox ?? []).filter((i) => ["IDEA", "TASK", "PENDING"].includes(i.status) && i.text).map((i) => ({ list: "inbox", id: i.id, text: i.text, title: `${i.status === "TASK" ? "Tarea" : i.status === "IDEA" ? "Idea" : "Apunte"}: ${i.text.slice(0, 60)}`, at: i.at })),
  ...(v.captures ?? []).filter((c) => c.status === "kept" && c.text).map((c) => ({ list: "captures", id: c.id, text: `${c.topic ?? ""}. ${c.text}`, title: `Captura: ${c.topic ?? c.text.slice(0, 50)}`, at: c.at })),
];

// Files every new item (never looked at before) into its project. With
// `onlyProject`, re-checks every item for that one project (just created).
export function autoFile(vault, { onlyProject = null, uid = () => Math.random().toString(36).slice(2) } = {}) {
  const projects = (vault.projects ?? []).map((p) => ({ ...p, sources: [...p.sources] }));
  const seen = new Set(projects.flatMap((p) => p.sources.map((s) => s.from).filter(Boolean)));
  const filed = [];
  const mark = { inbox: {}, captures: {} };
  for (const it of itemsToFile(vault)) {
    const key = `${it.list}:${it.id}`;
    const orig = vault[it.list].find((x) => x.id === it.id);
    if (seen.has(key)) continue;
    if (!onlyProject && orig.filed !== undefined) continue;
    const target = onlyProject ? (matchProject(it.text, [projects.find((p) => p.id === onlyProject)].filter(Boolean)) ? projects.find((p) => p.id === onlyProject) : null) : matchProject(it.text, projects);
    if (!onlyProject) mark[it.list][it.id] = target ? target.id : false;
    if (!target || target.sources.length >= PROJECT_LIMITS.sources) continue;
    const next = addSource(target, { id: uid(), kind: "note", title: it.title, text: it.text, at: it.at ?? new Date().toISOString() });
    next.sources[next.sources.length - 1].from = key;
    next.sources[next.sources.length - 1].auto = true;
    projects[projects.findIndex((p) => p.id === target.id)] = next;
    if (onlyProject) mark[it.list][it.id] = target.id;
    filed.push({ project: target.name, title: it.title });
  }
  const setMark = (list, name) => list.map((x) => (mark[name][x.id] !== undefined ? { ...x, filed: mark[name][x.id] } : x));
  return { projects, inbox: setMark(vault.inbox ?? [], "inbox"), captures: setMark(vault.captures ?? [], "captures"), filed };
}

// ---------- Suggest projects from what Manu has been talking about ----------
export function buildSuggestPayload({ titles, notes }) {
  const safe = (xs) => xs.filter((t) => mayGo(t)).map((t) => String(t).slice(0, 120));
  const list = [...safe(titles).slice(0, 150).map((t) => `- ${t}`), ...safe(notes).slice(0, 60).map((t) => `- (apunte) ${t}`)].join("\n");
  if (!list) throw new Error("Aún no hay nada de lo que sacar proyectos");
  return {
    systemInstruction: { parts: [{ text: "Eres MANU. A partir de los títulos de conversaciones y apuntes recientes de Manu, detecta los proyectos personales o de trabajo que tiene EN MARCHA (no temas sueltos ni deberes ya pasados). Devuelve SOLO un array JSON de 3 a 8 objetos {\"nombre\": 2-4 palabras, \"emoji\": un emoji, \"palabras\": 3-8 palabras clave en minúscula que aparezcan en sus títulos}." }] },
    contents: [{ role: "user", parts: [{ text: list }] }],
    generationConfig: { maxOutputTokens: 2048, temperature: 0.3, responseMimeType: "application/json" }, // room for thinking models (WEB-69)
  };
}

export function parseSuggestions(text, existing = []) {
  let data;
  // WEB-69: null = the answer could not be read (not «no projects»).
  try { data = JSON.parse(String(text ?? "").replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { return null; }
  // Models sometimes wrap the list: {"proyectos": [...]}.
  if (data && !Array.isArray(data) && typeof data === "object") data = Object.values(data).find(Array.isArray) ?? null;
  if (!Array.isArray(data)) return null;
  const have = new Set(existing.map((p) => normalise(p.name)));
  const out = [];
  for (const r of data) {
    const name = String(r?.nombre ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 60);
    if (!name || have.has(normalise(name))) continue;
    have.add(normalise(name));
    out.push({ name, emoji: String(r.emoji ?? "📁").slice(0, 4) || "📁", keywords: parseKeywords((Array.isArray(r.palabras) ? r.palabras : []).join(",")) });
    if (out.length === 8) break;
  }
  return out;
}

// ---------- Export: Markdown (NotebookLM) and .zip (ChatGPT, Claude) ----------
const safeName = (s) => normalise(s).replace(/[^a-z0-9ñ]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "proyecto";
const day = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10); };

export function projectMarkdown(p) {
  const lines = [`# ${p.emoji ?? ""} ${p.name}`.trim(), "", `Exportado de MANU OS el ${day(new Date().toISOString())}. ${p.sources.length} fuentes.`, ""];
  if ((p.keywords ?? []).length) lines.push(`Palabras clave: ${p.keywords.join(", ")}`, "");
  lines.push("## Fuentes", "");
  p.sources.forEach((s, i) => {
    lines.push(`### [${i + 1}] ${s.title}`, `*${s.kind === "image" ? "Captura" : s.kind === "link" ? "Enlace" : "Nota"} · ${day(s.at)}*${s.url ? ` · ${s.url}` : ""}`, "");
    if (s.kind === "image") lines.push(`(imagen: capturas/${i + 1}.jpg)`, "");
    if (s.text) lines.push(s.text, "");
  });
  if ((p.chat ?? []).length) {
    lines.push("## Conversación con MANU sobre este proyecto", "");
    for (const m of p.chat) if (m.text) lines.push(`**${m.from === "me" ? "Manu" : "MANU"}:** ${m.text}`, "");
  }
  return lines.join("\n");
}

const README = (p) => `Proyecto «${p.name}» exportado de MANU OS.

Cómo usarlo:
- ChatGPT o Claude: adjunta este .zip (o el archivo proyecto.md) en un chat nuevo y di «Lee este proyecto y ayúdame a seguir».
- NotebookLM: sube proyecto.md como fuente.

proyecto.md lleva todas las notas, enlaces y la conversación; la carpeta capturas/ lleva las imágenes.
`;

// images: { imageId: "data:image/jpeg;base64,…" }
export function projectZip(p, images = {}) {
  const files = [{ name: "LEEME.txt", data: README(p) }, { name: "proyecto.md", data: projectMarkdown(p) }];
  p.sources.forEach((s, i) => {
    const d = s.imageId && images[s.imageId];
    if (!d) return;
    const b64 = String(d).split(",")[1] ?? "";
    const bin = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
    const bytes = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
    files.push({ name: `capturas/${i + 1}.jpg`, data: bytes });
  });
  return { name: `${safeName(p.name)}.zip`, bytes: zipStore(files) };
}
export const projectFileName = (p, ext) => `${safeName(p.name)}.${ext}`;
