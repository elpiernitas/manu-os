// Bahía 00 (WEB-91): the town, drawn pixel by pixel on a small canvas that the
// browser scales up without smoothing. No images, no libraries. Each place has
// three looks; the character changes with his mood. Hour of day → sky.
export const W = 192, H = 128;

// Where each place stands (logical pixels) and its tap area for the buttons
// over the canvas (percent of the scene).
export const SPOTS = {
  faro: { x: 6, y: 34, w: 30, h: 70 },
  cafe: { x: 44, y: 64, w: 40, h: 40 },
  oficina: { x: 92, y: 40, w: 46, h: 64 },
  azotea: { x: 146, y: 46, w: 42, h: 58 },
  muro: { x: 0, y: 104, w: 192, h: 24 },
};

const C = {
  sea: "#1b5fd6", seaDark: "#123f94", foam: "#cfe3ff", sand: "#e8d9b5", stone: "#7d8590", stoneDark: "#5a616b", rail: "#e9eef6",
  wood: "#8a5a3b", woodDark: "#5e3a24", white: "#f7f8fa", blue: "#0066ff", cream: "#f3e6c8", glass: "#9fd0ff", lit: "#ffd76a",
  green: "#3fa66b", greenDark: "#2c7a4f", red: "#e0524d", ink: "#111318", grey: "#c9ced6", roof: "#3a4250", plant: "#4cbf7a",
  skin: "#f2c6a0", hair: "#6b4226", shirt: "#ffffff", jeans: "#3b5ba5", shoe: "#222831", ring: "#d8dde6",
};

function sky(hour) {
  if (hour >= 21 || hour < 6) return ["#0b1530", "#1c2a52", true];
  if (hour < 8) return ["#f2a65a", "#7fb2ff", false];
  if (hour >= 19) return ["#ff8a5c", "#5d6fd8", false];
  return ["#7fc4ff", "#cfe8ff", false];
}

const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

// The character: a big head, messy brown hair, glasses, a silver earring,
// white t-shirt, baggy jeans. 10 × 16. «.» is transparent.
const SPRITE = [
  "..hhhhhh..",
  ".hhhhhhhh.",
  "hhssssssh.",
  "hsggsggsse",
  ".sssssssse",
  ".sssmmsss.",
  "..ssssss..",
  "...wwww...",
  "..wwwwww..",
  ".swwwwwws.",
  ".swwwwwws.",
  "..bbbbbb..",
  "..bbbbbb..",
  "..bb..bb..",
  "..bb..bb..",
  ".kkk..kkk.",
];
const PAL = { h: C.hair, s: C.skin, g: C.ink, e: C.ring, m: "#c97b6b", w: C.shirt, b: C.jeans, k: C.shoe };

export function drawTown(ctx, { places, mood = "tranquilo", now = new Date(), tick = 0 }) {
  const lv = Object.fromEntries(places.map((p) => [p.id, p.level]));
  const [top, bottom, night] = sky(now.getHours());
  const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); };
  const win = (x, y, w = 4, h = 4) => r(x, y, w, h, night ? C.lit : C.glass);
  ctx.imageSmoothingEnabled = false;

  // Sky in bands, stars or sun.
  const mix = (a, b, t) => `rgb(${[0, 2, 4].map((i) => Math.round(parseInt(a.slice(1 + i, 3 + i), 16) * (1 - t) + parseInt(b.slice(1 + i, 3 + i), 16) * t)).join(",")})`;
  for (let y = 0; y < 96; y += 4) r(0, y, W, 4, mix(top, bottom, y / 92));
  if (night) { for (let i = 0; i < 18; i++) { const h = hash(`s${i}`); r(h % W, (h >> 8) % 44, 1, 1, "#fff"); } r(160, 10, 8, 8, "#f4f1d0"); }
  else r(166, 10, 10, 10, "#ffe27a");
  // Hills and the sea.
  r(0, 84, W, 12, night ? "#1d3b35" : "#5fa67a");
  r(0, 96, W, 10, night ? C.seaDark : C.sea);
  for (let x = (tick % 16); x < W; x += 16) r(x, 98, 6, 1, C.foam);

  // The lighthouse (faro).
  const f = SPOTS.faro;
  r(f.x, 94, f.w, 10, C.stoneDark);
  if (lv.faro === 1) { r(f.x + 6, 82, 16, 12, C.white); r(f.x + 4, 78, 20, 4, C.blue); r(f.x + 11, 86, 6, 5, "#2f7dff"); }
  else {
    const top = lv.faro === 3 ? 40 : 60;
    for (let y = top; y < 94; y += 8) r(f.x + 9, y, 12, 8, ((y - top) / 8) % 2 ? C.red : C.white);
    r(f.x + 7, top - 8, 16, 8, C.ink); r(f.x + 10, top - 6, 10, 5, night ? C.lit : C.glass); r(f.x + 8, top - 11, 14, 3, C.red);
    if (night && lv.faro === 3) { ctx.fillStyle = "rgba(255,215,106,.25)"; ctx.beginPath(); ctx.moveTo(f.x + 22, top - 4); ctx.lineTo(W * 0.55, top - 22); ctx.lineTo(W * 0.55, top + 8); ctx.fill(); }
  }

  const plot = (x, w) => { for (let i = x; i < x + w; i += 4) r(i, 97, 1, 7, C.wood); r(x, 99, w, 1, C.wood); r(x + w - 9, 88, 8, 6, C.cream); r(x + w - 6, 94, 1, 10, C.woodDark); r(x + w - 8, 90, 6, 1, C.blue); };
  // The café (servilleta).
  const c = SPOTS.cafe;
  if (lv.cafe === 1) { plot(c.x + 2, 36); r(c.x + 19, 82, 1, 12, C.ink); r(c.x + 12, 80, 15, 3, C.red); r(c.x + 14, 79, 11, 1, C.white); }
  if (lv.cafe === 1) { r(c.x + 14, 94, 14, 2, C.wood); r(c.x + 16, 96, 2, 8, C.woodDark); r(c.x + 24, 96, 2, 8, C.woodDark); r(c.x + 18, 91, 4, 3, C.white); r(c.x + 22, 92, 5, 2, C.cream); }
  else {
    const h = lv.cafe === 3 ? 36 : 26;
    r(c.x + 2, 104 - h, 36, h, C.cream); r(c.x, 104 - h - 4, 40, 5, C.roof);
    for (let x = c.x + 2; x < c.x + 38; x += 6) r(x, 104 - h + 2, 3, 4, x % 12 ? C.red : C.white); // awning
    r(c.x + 16, 92, 8, 12, C.woodDark); win(c.x + 5, 90, 8, 6); win(c.x + 27, 90, 8, 6);
    if (lv.cafe === 3) { win(c.x + 6, 74, 6, 6); win(c.x + 28, 74, 6, 6); r(c.x + 12, 66, 16, 5, C.blue); for (let x = c.x + 2; x < c.x + 38; x += 4) r(x, 104 - h - 6, 1, 1, C.lit); }
  }

  // The office of one (oficina).
  const o = SPOTS.oficina;
  if (lv.oficina === 1) plot(o.x + 2, 42);
  if (lv.oficina === 1) { r(o.x + 14, 94, 18, 2, C.wood); r(o.x + 15, 96, 2, 8, C.woodDark); r(o.x + 29, 96, 2, 8, C.woodDark); r(o.x + 18, 89, 10, 5, C.grey); r(o.x + 19, 90, 8, 3, C.glass); r(o.x + 34, 86, 8, 10, C.white); }
  else {
    const floors = lv.oficina === 3 ? 3 : 1, fh = 18, h = floors * fh + 8;
    r(o.x + 2, 104 - h, 42, h, "#d9e2f0"); r(o.x, 104 - h - 3, 46, 4, C.roof);
    for (let i = 0; i < floors; i++) { const y = 104 - 12 - (i + 1) * fh + 14; win(o.x + 6, y, 8, 6); win(o.x + 19, y, 8, 6); win(o.x + 32, y, 8, 6); }
    r(o.x + 18, 92, 10, 12, C.blue);
    if (lv.oficina === 3) { r(o.x + 12, 104 - h - 9, 22, 6, C.blue); r(o.x + 14, 104 - h - 8, 18, 4, C.white); }
  }

  // The rooftop of the day after (azotea): a building with a terrace.
  const a = SPOTS.azotea;
  r(a.x + 2, 72, 38, 32, "#e7d3c4"); win(a.x + 7, 80, 6, 6); win(a.x + 18, 80, 6, 6); win(a.x + 29, 80, 6, 6); r(a.x + 17, 94, 8, 10, C.woodDark);
  r(a.x, 70, 42, 2, C.rail);
  r(a.x + 4, 64, 12, 6, C.blue); r(a.x + 4, 62, 3, 4, C.blue); // sofa
  r(a.x + 30, 63, 5, 7, C.wood); r(a.x + 29, 58, 7, 5, C.plant);
  if (lv.azotea >= 2) { for (let x = a.x + 2; x < a.x + 40; x += 5) r(x, 54 + ((x / 5) % 2), 1, 1, C.lit); r(a.x + 20, 63, 4, 7, C.wood); r(a.x + 19, 58, 6, 5, C.plant); }
  if (lv.azotea === 3) { r(a.x + 35, 50, 4, 20, C.woodDark); r(a.x + 31, 44, 12, 10, C.greenDark); r(a.x + 1, 52, 3, 18, C.woodDark); r(a.x - 2, 46, 9, 8, C.green); }

  // The Muro: the promenade along the sea.
  const m = SPOTS.muro;
  r(0, 104, W, 6, C.stone); r(0, 110, W, 18, C.sand);
  const railTo = lv.muro === 1 ? 48 : W;
  for (let x = 0; x < railTo; x += 6) r(x, 101, 1, 3, C.rail);
  r(0, 101, railTo, 1, C.rail);
  r(20, 112, 14, 2, C.wood); r(21, 114, 2, 3, C.woodDark); r(31, 114, 2, 3, C.woodDark); // bench
  if (lv.muro >= 2) { for (const x of [60, 110, 160]) { r(x, 108, 1, 12, C.ink); r(x - 1, 106, 3, 2, night ? C.lit : C.grey); } r(122, 112, 14, 2, C.wood); }
  if (lv.muro === 3) { r(84, 108, 24, 4, C.stoneDark); r(86, 100, 1, 8, C.ink); r(87, 100, 6, 3, C.blue); r(170, 113, 4, 6, C.red); }

  // The character, by the place that matches his mood.
  const spot = { trabajando: [o.x + 4, 88], inspirado: [c.x + 2, 88], cansado: [24, 96], descansado: [a.x + 18, 48], celebrando: [80, 88], tranquilo: [70, 90] }[mood] ?? [70, 90];
  const bob = mood === "celebrando" ? (tick % 2) * -2 : mood === "cansado" ? 0 : (tick % 4 === 0 ? -1 : 0);
  const [sx, sy] = [spot[0], spot[1] + bob];
  SPRITE.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== ".") r(sx + x, sy + y, 1, 1, mood === "celebrando" && ch === "g" ? "#ff3df5" : PAL[ch]); }));
  if (mood === "inspirado") { r(sx + 3, sy - 7, 4, 4, C.lit); r(sx + 4, sy - 3, 2, 2, C.grey); }
  if (mood === "trabajando") { r(sx + 9, sy + 8, 6, 4, C.grey); r(sx + 10, sy + 9, 4, 2, C.glass); }
  if (mood === "cansado") { r(sx + 11, sy - 4, 3, 1, C.white); r(sx + 13, sy - 6, 3, 1, C.white); r(sx + 10, sy + 9, 2, 3, C.glass); }
  if (mood === "descansado") { r(sx + 11, sy - 3, 1, 4, C.ink); r(sx + 12, sy - 3, 2, 1, C.ink); }
  if (mood === "celebrando") for (let i = 0; i < 10; i++) { const h = hash(`c${i}${tick}`); r(sx - 10 + (h % 30), sy - 12 + ((h >> 5) % 10), 1, 2, [C.lit, C.red, C.blue, C.green][i % 4]); }

  // A drizzly day now and then (chirimiri): nothing to do, it just happens.
  if (hash(now.toDateString()) % 6 === 0) for (let i = 0; i < 40; i++) { const h = hash(`r${i}`); r((h + tick * 3) % W, ((h >> 7) + tick * 5) % 100, 1, 3, "rgba(220,235,255,.55)"); }
}
