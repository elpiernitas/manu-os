import test from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { unzip, parseChatgpt, readChatgptExport, search, stats, terms } from "../core/archive.js";

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

function zipOf(files) {
  const locals = [], centrals = []; let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const nameB = Buffer.from(name), raw = Buffer.from(text), data = deflateRawSync(raw);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(nameB.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(nameB.length, 28); ch.writeUInt32LE(offset, 42);
    locals.push(lh, nameB, data); centrals.push(ch, nameB); offset += 30 + nameB.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(centrals.length / 2, 8); eocd.writeUInt16LE(centrals.length / 2, 10); eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

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
  const asFile = (buf) => ({ arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) });
  assert.equal((await readChatgptExport(asFile(zip))).length, 2);
  assert.equal((await readChatgptExport(asFile(Buffer.from(JSON.stringify(EXPORT))))).length, 2);
  await assert.rejects(readChatgptExport(asFile(zipOf({ "otro.json": "[]" }))), /conversations\.json/);
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
