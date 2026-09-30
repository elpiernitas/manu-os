import test from "node:test";
import assert from "node:assert/strict";
import { projectKeys, parseKeywords, matchProject, autoFile, buildSuggestPayload, parseSuggestions, projectMarkdown, projectZip } from "../core/autofile.js";
import { unzip } from "../core/archive.js";
import { crc32 } from "../core/zipwrite.js";

const proj = (id, name, keywords = [], sources = []) => ({ id, name, emoji: "📁", createdAt: "2026-09-01T10:00:00Z", sources, chat: [], keywords });

test("WEB-60: keys come from the name and the keywords; ties file nowhere", () => {
  const ps = [proj("f", "Fiestas Gijón", ["prao", "cimadevilla"]), proj("a", "App de parejas", ["twocount", "bereal"]), proj("r", "Portal RK Iglesias", ["venture", "shopify"])];
  assert.deepEqual(projectKeys(ps[0]), ["fiestas", "gijon", "prao", "cimadevilla"]);
  assert.equal(matchProject("historia para las fiestas de prao del sábado", ps).id, "f");
  assert.equal(matchProject("idea: widget de Twocount con el saldo", ps).id, "a");
  assert.equal(matchProject("revisar horas venture en shopify", ps).id, "r");
  assert.equal(matchProject("comprar pan", ps), null);
  assert.equal(matchProject("gijón y twocount", ps), null); // one hit each → tie → don't guess
  assert.deepEqual(parseKeywords("prao, Cimadevilla;  x ,prao\npuerto"), ["prao", "Cimadevilla", "puerto"]);
});

test("WEB-60: new ideas, tasks and kept screenshots are filed once, into the right project", () => {
  let n = 0; const uid = () => `s${++n}`;
  const vault = {
    projects: [proj("f", "Fiestas Gijón", ["prao"]), proj("a", "App de parejas", ["twocount"])],
    inbox: [{ id: "i1", status: "IDEA", text: "Reel con planes de prao", at: "2026-09-30T10:00:00Z" }, { id: "i2", status: "TASK", text: "Pagar Orange" }, { id: "i3", status: "EXPENSE", text: "twocount 3 €" }, { id: "i4", status: "PENDING", text: "apunte suelto de twocount" }],
    captures: [{ id: "c1", status: "kept", topic: "App parejas", text: "Captura de la pantalla de Twocount", at: "2026-09-30T11:00:00Z" }, { id: "c2", status: "read", topic: "x", text: "prao" }],
  };
  const r = autoFile(vault, { uid });
  assert.deepEqual(r.filed.map((f) => f.project), ["Fiestas Gijón", "App de parejas", "App de parejas"]);
  assert.equal(r.projects[0].sources[0].from, "inbox:i1");
  assert.equal(r.projects[0].sources[0].auto, true);
  assert.equal(r.inbox.find((i) => i.id === "i1").filed, "f");
  assert.equal(r.inbox.find((i) => i.id === "i2").filed, false); // looked at, nowhere
  assert.equal(r.inbox.find((i) => i.id === "i3").filed, undefined); // expenses are not filed
  assert.equal(r.inbox.find((i) => i.id === "i4").filed, "a"); // what he jots in the chat is
  assert.equal(r.captures.find((c) => c.id === "c2").filed, undefined); // not reviewed yet
  // second pass: nothing new
  const again = autoFile({ ...vault, projects: r.projects, inbox: r.inbox, captures: r.captures }, { uid });
  assert.equal(again.filed.length, 0);
  // a project created later picks up the old items that belong to it
  const late = autoFile({ projects: [...r.projects, proj("o", "Orange factura", ["orange"])], inbox: r.inbox, captures: r.captures }, { uid, onlyProject: "o" });
  assert.deepEqual(late.filed.map((f) => f.title), ["Tarea: Pagar Orange"]);
});

test("WEB-60: project suggestions — sensitive titles never go, reply validated, no duplicates", () => {
  const p = buildSuggestPayload({ titles: ["Fiestas de prao Gijón", "Mi contraseña del banco es 1234"], notes: ["twocount widget"] });
  const sent = p.contents[0].parts[0].text;
  assert.match(sent, /Fiestas de prao/);
  assert.doesNotMatch(sent, /contraseña/);
  assert.equal(p.generationConfig.responseMimeType, "application/json");
  const s = parseSuggestions(JSON.stringify([{ nombre: "Fiestas Gijón", emoji: "🎉", palabras: ["prao", "fiesta"] }, { nombre: "App de parejas", palabras: ["twocount"] }, { nombre: "fiestas gijon" }, { nombre: "" }]), [proj("x", "App de parejas")]);
  assert.deepEqual(s.map((x) => x.name), ["Fiestas Gijón"]);
  assert.deepEqual(s[0].keywords, ["prao", "fiesta"]);
  assert.deepEqual(parseSuggestions("nope"), []);
});

test("WEB-60: export — Markdown for NotebookLM and a real .zip with the screenshots", async () => {
  const p = { ...proj("f", "Fiestas Gijón", ["prao"]), sources: [{ id: "a", kind: "note", title: "Plan prao", text: "Sábado en Contrueces", at: "2026-09-20T10:00:00Z" }, { id: "b", kind: "image", title: "Cartel", text: "", imageId: "img1", at: "2026-09-21T10:00:00Z" }], chat: [{ from: "me", text: "¿qué hay el sábado?" }, { from: "manu", text: "Contrueces [1]" }] };
  const md = projectMarkdown(p);
  assert.match(md, /^# 📁 Fiestas Gijón/);
  assert.match(md, /### \[1\] Plan prao/);
  assert.match(md, /capturas\/2\.jpg/);
  assert.match(md, /\*\*Manu:\*\* ¿qué hay el sábado\?/);
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  const z = projectZip(p, { img1: `data:image/jpeg;base64,${jpeg.toString("base64")}` });
  assert.equal(z.name, "fiestas-gijon.zip");
  const files = await unzip(Buffer.from(z.bytes));
  assert.deepEqual(Object.keys(files).sort(), ["LEEME.txt", "capturas/2.jpg", "proyecto.md"]);
  assert.equal(new TextDecoder().decode(files["proyecto.md"]), md);
  assert.deepEqual([...files["capturas/2.jpg"]], [...jpeg]);
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926); // standard check value
});
