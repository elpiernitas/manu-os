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

// ---- WEB-56: streaming, for real exports (Manu's is 1,49 GB) ----
// Nothing is loaded whole: the zip's central directory is read from its end,
// only conversations*.json is inflated, piece by piece, and the JSON array is
// split into one conversation at a time. Photos and audio in the zip are never read.
const bytesOf = async (file, start, end) => new Uint8Array(await file.slice(start, end).arrayBuffer());

// Entries of a zip (ZIP64 too): [{ name, method, compSize, size, local }]
export async function zipEntries(file) {
  const size = file.size;
  const tailStart = Math.max(0, size - 65557 - 20);
  const tail = await bytesOf(file, tailStart, size);
  const v = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
  let e = -1;
  for (let i = tail.length - 22; i >= 0; i--) if (v.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error("No parece un .zip");
  let count = v.getUint16(e + 10, true), cdSize = v.getUint32(e + 12, true), cdOff = v.getUint32(e + 16, true);
  if (count === 0xffff || cdSize === 0xffffffff || cdOff === 0xffffffff) {
    const loc = e - 20;
    if (loc >= 0 && v.getUint32(loc, true) === 0x07064b50) {
      const at = Number(v.getBigUint64(loc + 8, true));
      const z = await bytesOf(file, at, at + 56), zv = new DataView(z.buffer, z.byteOffset, z.byteLength);
      if (zv.getUint32(0, true) !== 0x06064b50) throw new Error("ZIP64 dañado");
      count = Number(zv.getBigUint64(32, true)); cdSize = Number(zv.getBigUint64(40, true)); cdOff = Number(zv.getBigUint64(48, true));
    }
  }
  const cd = await bytesOf(file, cdOff, cdOff + cdSize);
  const cv = new DataView(cd.buffer, cd.byteOffset, cd.byteLength);
  const out = [];
  for (let p = 0, n = 0; n < count && p + 46 <= cd.length; n++) {
    if (cv.getUint32(p, true) !== 0x02014b50) throw new Error("ZIP dañado");
    const method = cv.getUint16(p + 10, true);
    let compSize = cv.getUint32(p + 20, true), usize = cv.getUint32(p + 24, true), local = cv.getUint32(p + 42, true);
    const nameLen = cv.getUint16(p + 28, true), extraLen = cv.getUint16(p + 30, true), commentLen = cv.getUint16(p + 32, true);
    const name = new TextDecoder().decode(cd.subarray(p + 46, p + 46 + nameLen));
    // ZIP64 extra field (0x0001): only the fields that were 0xFFFFFFFF, in this order.
    for (let x = p + 46 + nameLen, end = x + extraLen; x + 4 <= end;) {
      const id = cv.getUint16(x, true), len = cv.getUint16(x + 2, true);
      if (id === 0x0001) {
        let q = x + 4;
        if (usize === 0xffffffff) { usize = Number(cv.getBigUint64(q, true)); q += 8; }
        if (compSize === 0xffffffff) { compSize = Number(cv.getBigUint64(q, true)); q += 8; }
        if (local === 0xffffffff) { local = Number(cv.getBigUint64(q, true)); }
      }
      x += 4 + len;
    }
    out.push({ name, method, compSize, size: usize, local });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

// The bytes of one entry, as a stream (inflated if needed).
// `tap` sees the raw (compressed) bytes as they are read, for progress.
export async function entryStream(file, entry, tap = null) {
  const lh = await bytesOf(file, entry.local, entry.local + 30);
  const lv = new DataView(lh.buffer, lh.byteOffset, lh.byteLength);
  if (lv.getUint32(0, true) !== 0x04034b50) throw new Error("ZIP dañado");
  const start = entry.local + 30 + lv.getUint16(26, true) + lv.getUint16(28, true);
  let raw = file.slice(start, start + entry.compSize).stream();
  if (tap) raw = raw.pipeThrough(tap);
  if (entry.method === 0) return raw;
  if (entry.method === 8) return raw.pipeThrough(new DecompressionStream("deflate-raw"));
  throw new Error(`ZIP con compresión no soportada (${entry.method})`);
}

// Splits a JSON array arriving as text chunks into its items, one at a time.
export async function* jsonArrayItems(textStream) {
  const reader = textStream.getReader();
  let depth = 0, inStr = false, esc = false, started = false, parts = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    let from = -1;
    for (let i = 0; i < value.length; i++) {
      const c = value.charCodeAt(i);
      if (inStr) { if (esc) esc = false; else if (c === 92) esc = true; else if (c === 34) inStr = false; continue; }
      if (c === 34) { inStr = true; continue; }
      if (c === 91 || c === 123) { // [ {
        if (!started) { if (c !== 91) throw new Error("No es un conversations.json de ChatGPT"); started = true; continue; }
        if (depth === 0) from = i;
        depth++;
      } else if (c === 93 || c === 125) { // ] }
        if (depth === 0) continue; // end of the top-level array
        depth--;
        if (depth === 0) { parts.push(value.slice(from === -1 ? 0 : from, i + 1)); yield JSON.parse(parts.join("")); parts = []; from = -1; }
      }
    }
    if (depth > 0) parts.push(value.slice(from === -1 ? 0 : from));
  }
  if (!started) throw new Error("No es un conversations.json de ChatGPT");
  if (depth !== 0) throw new Error("El archivo está incompleto (¿se cortó la descarga?)");
}

// Reads what Manu picked: the export .zip or conversations.json itself.
// With `onBatch`, conversations are handed over in batches (to save them as
// they come) and only the count is kept; otherwise they are returned.
export async function readChatgptExport(file, { onBatch = null, batch = 100, onProgress = null } = {}) {
  const head = await bytesOf(file, 0, 4);
  let sources;
  if (head[0] === 0x50 && head[1] === 0x4b) {
    const entries = (await zipEntries(file)).filter((x) => /(^|\/)conversations(-\d+)?\.json$/i.test(x.name)).sort((a, b) => a.name.localeCompare(b.name));
    if (!entries.length) throw new Error("El .zip no trae conversations.json");
    sources = entries.map((x) => ({ total: x.compSize, open: (tap) => entryStream(file, x, tap) }));
  } else sources = [{ total: file.size, open: async (tap) => file.stream().pipeThrough(tap) }];
  const grand = sources.reduce((s, x) => s + x.total, 0) || 1;
  let readBytes = 0, count = 0, pending = [];
  const all = onBatch ? null : [];
  const flush = async () => { if (!pending.length) return; const docs = pending; pending = []; if (onBatch) await onBatch(docs); else all.push(...docs); };
  for (const src of sources) {
    // count the bytes of the file as they are read, for a real percentage
    const stream = await src.open(new TransformStream({ transform(chunk, ctl) { readBytes += chunk.byteLength; ctl.enqueue(chunk); } }));
    for await (const conv of jsonArrayItems(stream.pipeThrough(new TextDecoderStream()))) {
      const docs = parseChatgpt([conv]);
      if (!docs.length) continue;
      pending.push(docs[0]); count++;
      if (pending.length >= batch) { await flush(); onProgress?.({ count, fraction: Math.min(1, readBytes / grand) }); }
    }
  }
  await flush();
  onProgress?.({ count, fraction: 1 });
  return onBatch ? count : all.sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
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

// ---- MANU's own chats (WEB-37) ----
// Each conversation with MANU is archived when a new one starts, so the chat
// starts empty but MANU can still recall it («lo que hablamos de …»).
export const NEW_CHAT_AFTER_MS = 30 * 60000;

export function chatToDoc(chat) {
  const messages = (chat ?? [])
    .filter((m) => m?.text && m.text !== "Pensando…" && (m.from === "me" || m.from === "manu"))
    .map((m) => ({ role: m.from === "me" ? "me" : "ai", text: String(m.text).slice(0, 20000), at: Date.parse(m.at) || null }));
  if (!messages.some((m) => m.role === "me")) return null;
  const first = messages.find((m) => m.role === "me");
  const at = messages[0].at ?? Date.now();
  return { id: `manu:${at}`, source: "manu", title: first.text.replace(/\s+/g, " ").slice(0, 80), at, messages };
}

// True when the last message is old enough to start a new conversation.
export const staleChat = (chat, now = Date.now()) => {
  const last = Date.parse(chat?.at?.(-1)?.at ?? "");
  return Number.isFinite(last) && now - last > NEW_CHAT_AFTER_MS;
};
