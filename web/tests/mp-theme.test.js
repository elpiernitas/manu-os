// Tema «mp.» (WEB-119): identidad de Manu Pernas, reversible y sin tocar datos ni elecciones guardadas.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { skinOf, SKINS } from "../core/horizonte.js";
import { hzApariencia } from "../design/horizonte.js";
import { mpLogo, mpAvatar } from "../design/mp-brand.js";
import { LocalStore } from "../core/storage.js";
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

test("una elección guardada siempre manda; mp. solo como predeterminado del dispositivo", () => {
  assert.equal(skinOf({}, "mp"), "mp", "instalación nueva");
  assert.equal(skinOf({}, null), "design", "instalación anterior sin elección: sigue como estaba");
  for (const s of ["design", "clasico", "horizonte"]) assert.equal(skinOf({ skin: s }, "mp"), s, `no pisa ${s}`);
  assert.equal(skinOf({ skin: "mp" }, null), "mp");
  assert.equal(skinOf({ skin: "<script>" }, "mp"), "mp");
  assert.equal(skinOf({}, "<script>"), "design", "un valor raro del dispositivo no vale");
  assert.equal(SKINS.mp, "mp. · Manu Pernas");
});

test("el almacenamiento distingue instalación nueva de la que ya tenía datos", () => {
  const mem = (v) => { const m = new Map(v ? [["manuos.vault", v]] : []); return { getItem: (k) => m.get(k) ?? null, setItem: (k, x) => m.set(k, x), removeItem: (k) => m.delete(k) }; };
  assert.equal(new LocalStore(mem()).load().fresh, true);
  const empty = new LocalStore(mem()).load().vault;
  assert.equal(new LocalStore(mem(JSON.stringify(empty))).load().fresh, undefined);
});

test("el predeterminado del dispositivo vive fuera del vault (no viaja por Tu nube)", () => {
  const app = read("app.js");
  assert.match(app, /DEVICE_SKIN_KEY = "manuos\.skinDefault"/);
  assert.match(app, /loaded\.fresh && !localStorage\.getItem\(DEVICE_SKIN_KEY\)/);
  assert.doesNotMatch(app, /vault\.settings\.skin = "mp"/, "nunca se escribe mp. en el vault sin que Manu lo pulse");
  assert.match(app, /function mpOfferCard\(\)/, "a las instalaciones anteriores se les ofrece, no se les impone");
});

test("logotipo mp.: m del color del texto, p. azul, sin diagonales ni otros símbolos", () => {
  const logo = mpLogo();
  assert.match(logo, /class="mp-m" fill="currentColor"/);
  assert.match(logo, /class="mp-p" fill="#0066FF"/);
  assert.equal((logo.match(/<path/g) ?? []).length, 2, "solo la m y la p.");
  assert.match(logo, /role="img" aria-label="mp\."/);
  assert.doesNotMatch(logo, /style=/, "CSP: sin estilos en línea");
  assert.match(mpAvatar(), /mp-avatar-provisional\.svg/);
  assert.match(read("design/mp-avatar-provisional.svg"), /PROVISIONAL/);
});

test("paleta y tipografía de la guía, con contraste AA en el texto", () => {
  const css = read("design/mp.css");
  for (const hex of ["#0066FF", "#0B0B0D", "#FFFFFF", "#F5F5F7"]) assert.ok(css.includes(hex), hex);
  assert.match(css, /font-family: "Montserrat"/);
  assert.match(css, /fonts\/montserrat\.woff2/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /tabular-nums/, "cifras legibles y alineadas");
  assert.ok(existsSync(new URL("../design/fonts/montserrat/OFL.txt", import.meta.url)), "licencia OFL incluida");
  const lum = (hex) => { const c = hex.match(/\w\w/g).map((x) => parseInt(x, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  for (const [fg, bg] of [["0B0B0D", "FFFFFF"], ["0B0B0D", "F5F5F7"], ["5E6270", "FFFFFF"], ["5E6270", "F5F5F7"], ["0057D9", "FFFFFF"], ["0057D9", "F5F5F7"], ["FFFFFF", "0066FF"], ["C62F28", "FFFFFF"], ["187A4C", "F5F5F7"], ["A35F00", "F5F5F7"]]) {
    assert.ok(ratio(fg, bg) >= 4.5, `#${fg} sobre #${bg}: ${ratio(fg, bg).toFixed(2)}`);
  }
  assert.ok(ratio("0066FF", "F5F5F7") < 4.5, "por eso el texto azul usa #0057D9 y no #0066FF");
});

test("Apariencia ofrece los cuatro temas y la PWA los tiene sin conexión", () => {
  const html = hzApariencia("mp");
  for (const x of ["mp", "design", "clasico", "horizonte"]) assert.match(html, new RegExp(`data-v="${x}"`));
  assert.match(html, /aria-label="mp\. Manu Pernas"/);
  const sw = read("sw.js"), index = read("index.html");
  for (const f of ["design/mp.css", "design/mp-brand.js", "design/mp-avatar-provisional.svg", "design/fonts/montserrat.woff2"]) assert.match(sw, new RegExp(`"${f.replace(/[./]/g, "\\$&")}"`), f);
  assert.match(index, /design\/mp\.css/);
});
