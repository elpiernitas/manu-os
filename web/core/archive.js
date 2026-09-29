// «Tu archivo» (WEB-34): the data exports Manu imports (ChatGPT first) turned
// into searchable documents. Everything stays on this device (IndexedDB); it
// is never in the vault backups, the repository or a model request by itself.

const clip = (s, n) => String(s ?? "").replace(/\u0000/g, "").slice(0, n);
export const normalise = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// ---- Minimal ZIP reader (stored + deflate), enough for data exports ----
// Reads the central directory and inflates only the entries `want(name)` accepts.
export async function unzip(buffer, want = () => true) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("No parece un .zip");
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const out = {};
  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new Error("ZIP dañado");
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true), extraLen = view.getUint16(p + 30, true), commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith("/") || !want(name)) continue;
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = bytes.subarray(start, start + size);
    if (method === 0) out[name] = data.slice();
    else if (method === 8) out[name] = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
    else throw new Error(`ZIP con compresión no soportada (${method})`);
  }
  return out;
}

// ---- ChatGPT export (conversations.json) ----
// Follows the branch Manu actually kept (current_node back to the root).
const partText = (p) => (typeof p === "string" ? p : typeof p?.text === "string" ? p.text : "");
export function parseChatgpt(json) {
  if (!Array.isArray(json)) throw new Error("No es un conversations.json de ChatGPT");
  const convs = [];
  for (const c of json) {
    const map = c?.mapping ?? {};
    let node = c?.current_node && map[c.current_node] ? c.current_node : Object.keys(map).find((k) => !(map[k]?.children ?? []).length);
    const chain = [];
    const seen = new Set();
    while (node && map[node] && !seen.has(node)) { seen.add(node); chain.push(map[node]); node = map[node].parent; }
    const messages = chain.reverse().map((x) => x.message).filter((m) => m && ["user", "assistant"].includes(m.author?.role) && !m.metadata?.is_visually_hidden_from_conversation)
      .map((m) => ({ role: m.author.role === "user" ? "me" : "ai", text: clip((m.content?.parts ?? []).map(partText).filter(Boolean).join("\n"), 20000), at: m.create_time ? Math.round(m.create_time * 1000) : null }))
      .filter((m) => m.text.trim());
    if (!messages.length) continue;
    convs.push({
      id: `chatgpt:${clip(c.id ?? c.conversation_id ?? `${c.create_time}-${convs.length}`, 80)}`,
      source: "chatgpt",
      title: clip(c.title || messages[0].text, 120),
      at: c.create_time ? Math.round(c.create_time * 1000) : messages[0].at,
      updated: c.update_time ? Math.round(c.update_time * 1000) : null,
      messages,
    });
  }
  return convs.sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
}

// Reads what Manu picked: the export .zip or conversations.json itself.
export async function readChatgptExport(file) {
  const buf = await file.arrayBuffer();
  const head = new Uint8Array(buf.slice(0, 4));
  let text;
  if (head[0] === 0x50 && head[1] === 0x4b) {
    const files = await unzip(buf, (n) => /(^|\/)conversations\.json$/.test(n));
    const entry = Object.values(files)[0];
    if (!entry) throw new Error("El .zip no trae conversations.json");
    text = new TextDecoder().decode(entry);
  } else text = new TextDecoder().decode(new Uint8Array(buf));
  return parseChatgpt(JSON.parse(text));
}

// ---- Search ----
const STOP = new Set("a al algo como con de del el en es esa ese eso esta este esto la las le lo los me mi mis no o para pero por que se si sin su sus te tu un una uno y yo ya the and of to in is it for on".split(" "));
export const terms = (q) => [...new Set(normalise(q).split(/[^a-z0-9ñ]+/).filter((w) => w.length > 2 && !STOP.has(w)))];

// Scores documents by how often the query terms appear (titles count triple).
// Returns [{ doc, score, snippet }] best first.
export function search(docs, query, { limit = 8 } = {}) {
  const ts = terms(query);
  if (!ts.length) return [];
  const out = [];
  for (const d of docs) {
    const title = normalise(d.title);
    const body = normalise(d.messages.map((m) => m.text).join("\n"));
    let score = 0, hits = 0;
    for (const t of ts) {
      const inTitle = title.split(t).length - 1, inBody = Math.min(body.split(t).length - 1, 20);
      if (inTitle || inBody) hits++;
      score += inTitle * 3 + inBody;
    }
    if (!score) continue;
    score *= hits / ts.length; // documents with every term first
    const first = d.messages.find((m) => ts.some((t) => normalise(m.text).includes(t)));
    let snippet = "";
    if (first) {
      const nt = normalise(first.text);
      const i = Math.max(0, Math.min(...ts.map((t) => { const k = nt.indexOf(t); return k < 0 ? Infinity : k; })) - 60);
      snippet = `${i ? "…" : ""}${first.text.slice(i, i + 200).replace(/\s+/g, " ").trim()}…`;
    }
    out.push({ doc: d, score, snippet });
  }
  return out.sort((a, b) => b.score - a.score || (b.doc.at ?? 0) - (a.doc.at ?? 0)).slice(0, limit);
}

// Overview: how many, from when to when, messages written by Manu.
export function stats(docs) {
  const times = docs.map((d) => d.at).filter(Boolean);
  return {
    count: docs.length,
    mine: docs.reduce((n, d) => n + d.messages.filter((m) => m.role === "me").length, 0),
    from: times.length ? Math.min(...times) : null,
    to: times.length ? Math.max(...times) : null,
  };
}
