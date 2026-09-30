import test from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { unzip, parseChatgpt, readChatgptExport, search, stats, terms, zipEntries, jsonArrayItems } from "../core/archive.js";

// Synthetic ChatGPT export: one conversation with an edited branch that was abandoned.
const EXPORT = [
  {
    id: "c1", title: "Viaje a Lisboa", create_time: 1767225600, update_time: 1767229200, current_node: "a2",
    mapping: {
      root: { message: null, parent: null, children: ["u1"] },
      u1: { parent: "root", children: ["a1", "a1b"], message: { author: { role: "user" }, create_time: 1767225600, content: { content_type: "text", parts: ["¿Qué ver en Lisboa en dos días?"] } } },
      a1b: { parent: "u1", children: [], message: { author: { role: "assistant" }, content: { parts: ["RAMA DESCARTADA"] } } },
      a1: { parent: "u1", children: ["sys"], message: { author: { role: "assistant" }, content: { parts: ["Alfama, Belém y el tranvía 28."] } } },
      sys: { parent: "a1", children: ["a2"], message: { author: { role: "system" }, content: { parts: ["oculto"] } } },
      a2: { parent: "sys", children: [], message: { author: { role: "assistant" }, content: { content_type: "multimodal_text", parts: [{ text: "Y pastéis de nata." }, { asset_pointer: "file://img" }] } } },
    },
  },
  { id: "c2", title: "Receta de lentejas", create_time: 1764547200, current_node: "x", mapping: { x: { parent: null, children: [], message: { author: { role: "user" }, content: { parts: ["lentejas con chorizo"] } } } } },
  { id: "c3", title: "Vacía", mapping: {} },
];

// `zip64` writes sizes/offsets as 0xFFFFFFFF + the ZIP64 extra field and
// end records, like real exports over 4 GB; `stored` names are not compressed.
function zipOf(files, { zip64 = false, stored = [] } = {}) {
  const locals = [], centrals = []; let offset = 0, n = 0;
  for (const [name, text] of Object.entries(files)) {
    const nameB = Buffer.from(name), raw = Buffer.from(text), keep = stored.includes(name), data = keep ? raw : deflateRawSync(raw), method = keep ? 0 : 8;
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(method, 8); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(nameB.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(method, 10); ch.writeUInt16LE(nameB.length, 28);
    let extra = Buffer.alloc(0);
    if (zip64) {
      ch.writeUInt32LE(0xffffffff, 20); ch.writeUInt32LE(0xffffffff, 24); ch.writeUInt32LE(0xffffffff, 42);
      extra = Buffer.alloc(28); extra.writeUInt16LE(1, 0); extra.writeUInt16LE(24, 2);
      extra.writeBigUInt64LE(BigInt(raw.length), 4); extra.writeBigUInt64LE(BigInt(data.length), 12); extra.writeBigUInt64LE(BigInt(offset), 20);
      ch.writeUInt16LE(extra.length, 30);
    } else { ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt32LE(offset, 42); }
    locals.push(lh, nameB, data); centrals.push(ch, nameB, extra); offset += 30 + nameB.length + data.length; n++;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0);
  if (!zip64) {
    eocd.writeUInt16LE(n, 8); eocd.writeUInt16LE(n, 10); eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16);
    return Buffer.concat([...locals, cd, eocd]);
  }
  eocd.writeUInt16LE(0xffff, 8); eocd.writeUInt16LE(0xffff, 10); eocd.writeUInt32LE(0xffffffff, 12); eocd.writeUInt32LE(0xffffffff, 16);
  const rec = Buffer.alloc(56); rec.writeUInt32LE(0x06064b50, 0); rec.writeBigUInt64LE(44n, 4);
  rec.writeBigUInt64LE(BigInt(n), 24); rec.writeBigUInt64LE(BigInt(n), 32); rec.writeBigUInt64LE(BigInt(cd.length), 40); rec.writeBigUInt64LE(BigInt(offset), 48);
  const loc = Buffer.alloc(20); loc.writeUInt32LE(0x07064b50, 0); loc.writeBigUInt64LE(BigInt(offset + cd.length), 8); loc.writeUInt32LE(1, 16);
  return Buffer.concat([...locals, cd, rec, loc, eocd]);
}
const fileOf = (buf, name = "export.zip") => new File([buf], name);

test("ChatGPT: follows the kept branch, skips system and hidden turns, keeps order", () => {
  const convs = parseChatgpt(EXPORT);
  assert.equal(convs.length, 2); // the empty one is dropped
  const lisboa = convs.find((c) => c.title === "Viaje a Lisboa");
  assert.deepEqual(lisboa.messages.map((m) => [m.role, m.text]), [["me", "¿Qué ver en Lisboa en dos días?"], ["ai", "Alfama, Belém y el tranvía 28."], ["ai", "Y pastéis de nata."]]);
  assert.equal(lisboa.id, "chatgpt:c1");
  assert.equal(convs[0].title, "Viaje a Lisboa"); // newest first
  assert.throws(() => parseChatgpt({}), /conversations\.json/);
});

test("reads the export .zip or the bare conversations.json", async () => {
  const zip = zipOf({ "user.json": "{}", "conversations.json": JSON.stringify(EXPORT) });
  const files = await unzip(zip, (n) => n === "conversations.json");
  assert.deepEqual(Object.keys(files), ["conversations.json"]);
  assert.equal((await readChatgptExport(fileOf(zip))).length, 2);
  assert.equal((await readChatgptExport(fileOf(Buffer.from(JSON.stringify(EXPORT)), "conversations.json"))).length, 2);
  await assert.rejects(readChatgptExport(fileOf(zipOf({ "otro.json": "[]" }))), /conversations\.json/);
});

test("WEB-56: big exports are streamed — ZIP64, stored photos skipped, split conversations-N.json", async () => {
  const photo = "\x89PNG".repeat(50000); // never read: not a conversations file
  const zip = zipOf({ "file-abc.png": photo, "conversations-000.json": JSON.stringify(EXPORT.slice(0, 1)), "chat.html": "<html>", "conversations-001.json": JSON.stringify(EXPORT.slice(1)) }, { zip64: true, stored: ["file-abc.png"] });
  const entries = await zipEntries(fileOf(zip));
  assert.deepEqual(entries.map((e) => [e.name, e.method]), [["file-abc.png", 0], ["conversations-000.json", 8], ["chat.html", 8], ["conversations-001.json", 8]]);
  assert.equal(entries[0].size, Buffer.byteLength(photo));
  const docs = await readChatgptExport(fileOf(zip));
  assert.deepEqual(docs.map((d) => d.title), ["Viaje a Lisboa", "Receta de lentejas"]);
});

test("WEB-56: conversations are handed over in batches, with progress, never all at once", async () => {
  const many = Array.from({ length: 250 }, (_, i) => ({ id: `k${i}`, title: `Charla ${i}`, create_time: 1767225600 + i, current_node: "m", mapping: { m: { parent: null, children: [], message: { author: { role: "user" }, content: { parts: [`hola ${i} con "comillas", [corchetes] y {llaves} \\ fin`] } } } } }));
  const batches = [], progress = [];
  const n = await readChatgptExport(fileOf(zipOf({ "conversations.json": JSON.stringify(many) })), { batch: 100, onBatch: async (d) => batches.push(d.length), onProgress: (p) => progress.push(p) });
  assert.equal(n, 250);
  assert.deepEqual(batches, [100, 100, 50]);
  assert.equal(progress.at(-1).fraction, 1);
  assert.ok(progress.every((p, i) => i === 0 || p.fraction >= progress[i - 1].fraction));
});

test("WEB-56: the JSON splitter survives chunks cut anywhere, strings with brackets and escapes", async () => {
  const items = [{ a: "x]}\"[{" }, { b: [1, { c: "\\" }] }, { d: "ñandú 🍝" }];
  const text = JSON.stringify(items);
  for (const size of [1, 2, 3, 7, 1000]) {
    const chunks = []; for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size));
    const got = []; for await (const x of jsonArrayItems(ReadableStream.from(chunks))) got.push(x);
    assert.deepEqual(got, items, `chunk size ${size}`);
  }
  const all = async (t) => { const out = []; for await (const x of jsonArrayItems(ReadableStream.from([t]))) out.push(x); return out; };
  assert.deepEqual(await all("  [ ]"), []);
  await assert.rejects(all('[{"a":1},{"b":'), /incompleto/);
  await assert.rejects(all('{"no":"array"}'), /conversations/);
  await assert.rejects(readChatgptExport(fileOf(Buffer.from('[{"id":"x","mapping":{'), "conversations.json")), /incompleto/);
});

test("search: accents ignored, titles weigh more, snippet around the hit", () => {
  const docs = parseChatgpt(EXPORT);
  assert.deepEqual(terms("¿Qué vi en LISBOA?"), ["lisboa"]);
  const r = search(docs, "pasteis lisboa");
  assert.equal(r[0].doc.title, "Viaje a Lisboa");
  assert.ok(r[0].snippet.toLowerCase().includes("lisboa"));
  assert.equal(search(docs, "lentejas")[0].doc.title, "Receta de lentejas");
  assert.deepEqual(search(docs, "de la"), []);
  const s = stats(docs);
  assert.equal(s.count, 2); assert.equal(s.mine, 2);
});

test("WEB-37: a finished chat becomes an archive document; only chats with Manu's words", async () => {
  const { chatToDoc, staleChat, search: s2 } = await import("../core/archive.js");
  const chat = [
    { from: "manu", text: "Hola, Manu.", at: "2026-09-29T10:00:00Z" },
    { from: "me", text: "Quiero ir a Oporto en noviembre", at: "2026-09-29T10:01:00Z" },
    { from: "manu", text: "Pensando…", at: "2026-09-29T10:01:01Z" },
    { from: "manu", text: "¡Buena idea! Mira vuelos.", at: "2026-09-29T10:01:02Z" },
  ];
  const doc = chatToDoc(chat);
  assert.equal(doc.source, "manu");
  assert.equal(doc.title, "Quiero ir a Oporto en noviembre");
  assert.deepEqual(doc.messages.map((m) => m.role), ["ai", "me", "ai"]);
  assert.equal(chatToDoc([{ from: "manu", text: "Hola", at: "2026-09-29T10:00:00Z" }]), null);
  assert.equal(s2([doc], "oporto")[0].doc.id, doc.id);
  assert.equal(staleChat(chat, Date.parse("2026-09-29T10:20:00Z")), false);
  assert.equal(staleChat(chat, Date.parse("2026-09-29T10:40:00Z")), true);
  assert.equal(staleChat([], Date.now()), false);
});
