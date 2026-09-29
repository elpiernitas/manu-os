import { test } from "node:test";
import assert from "node:assert/strict";
import { detectLink, oembedUrl, parseOembed, linkInfo } from "../core/links.js";
import { buildImagePayload, buildLinkPayload, askWithActions, TOOLS } from "../core/ai.js";

test("detects TikTok, YouTube, Instagram and other links inside text", () => {
  assert.equal(detectLink("mira esto https://www.tiktok.com/@alguien/video/123?is_from=app").provider, "tiktok");
  assert.equal(detectLink("https://vm.tiktok.com/ZMabc/").provider, "tiktok");
  assert.equal(detectLink("https://youtu.be/abc123").provider, "youtube");
  assert.equal(detectLink("reel https://www.instagram.com/reel/XYZ/").provider, "instagram");
  assert.equal(detectLink("receta https://ejemplo.com/tarta).").url, "https://ejemplo.com/tarta");
  assert.equal(detectLink("mira esto https://ejemplo.com/a").rest, "mira esto");
  assert.equal(detectLink("sin enlace"), null);
  assert.equal(detectLink("javascript:alert(1)"), null);
});

test("oEmbed only for providers that allow it; Instagram needs a screenshot", () => {
  assert.ok(oembedUrl({ url: "https://www.tiktok.com/@a/video/1", provider: "tiktok" }).startsWith("https://www.tiktok.com/oembed?url="));
  assert.ok(oembedUrl({ url: "https://youtu.be/x", provider: "youtube" }).startsWith("https://www.youtube.com/oembed?format=json&url="));
  assert.equal(oembedUrl({ url: "https://www.instagram.com/reel/X/", provider: "instagram" }), null);
  assert.deepEqual(parseOembed({ title: "  Receta  de tarta\n#food ", author_name: "Cocina Ejemplo" }), { title: "Receta de tarta #food", author: "Cocina Ejemplo" });
  assert.equal(parseOembed({}), null);
});

test("linkInfo reads the public caption", async () => {
  const info = await linkInfo({ url: "https://www.tiktok.com/@a/video/1", provider: "tiktok" }, async (u) => ({ ok: true, json: async () => ({ title: "Plan: concierto el sábado 4 a las 21h", author_name: "Sala Ejemplo" }), url: u }));
  assert.deepEqual(info, { title: "Plan: concierto el sábado 4 a las 21h", author: "Sala Ejemplo" });
});

test("image and link payloads carry the fixed tools and only what Manu shared", () => {
  const p = buildImagePayload({ base64: "AAAA", mime: "image/jpeg" }, new Date(2026, 8, 29, 10));
  assert.deepEqual(p.contents[0].parts[0], { inlineData: { mimeType: "image/jpeg", data: "AAAA" } });
  assert.deepEqual(p.tools, TOOLS);
  assert.ok(p.systemInstruction.parts[0].text.includes("No inventes"));
  assert.throws(() => buildImagePayload({ base64: "x", mime: "application/pdf" }));
  const l = buildLinkPayload({ provider: "TikTok", url: "https://www.tiktok.com/@a/video/1", title: "Concierto el sábado", author: "Sala" });
  assert.equal(l.contents.length, 1);
  assert.ok(l.contents[0].parts[0].text.includes("Concierto el sábado"));
});

test("shared content is only sent with explicit consent", async () => {
  let calls = 0;
  const f = async () => { calls++; return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }) }; };
  await assert.rejects(askWithActions({ key: "k", model: "m", payload: buildImagePayload({ base64: "AAAA", mime: "image/png" }) }, f), (e) => e.code === "unconfirmed");
  assert.equal(calls, 0);
});
