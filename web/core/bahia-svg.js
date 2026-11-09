// Bahía 00 (WEB-93): the town as one big vertical vector scene (SVG string).
// Back row on the quay: the lighthouse and the rooftop. Middle row on the
// square: the café and the office. Front: the Muro, a promenade with a running
// lane, and Manu's character, large, in the foreground. Every place has three
// looks. Only presentation attributes (the CSP forbids inline style); motion
// comes from classes in styles.css and stops with reduced motion.
export const VW = 390, VH = 700;

// Tap areas in viewBox units; the badge corner keeps it clear of the character.
export const SPOTS = {
  faro: { x: 6, y: 60, w: 150, h: 262, badge: "left" },
  azotea: { x: 228, y: 110, w: 156, h: 212, badge: "right" },
  cafe: { x: 6, y: 330, w: 180, h: 192, badge: "left" },
  oficina: { x: 196, y: 318, w: 188, h: 204, badge: "right" },
  muro: { x: 0, y: 524, w: 390, h: 176, badge: "right" },
};

const C = {
  ink: "#15181f", white: "#f7f8fa", cream: "#f4e7cb", creamDark: "#e2cfa8", red: "#e0524d", blue: "#246bfd", blueDark: "#1a4fc0",
  sea: "#2a6fe0", seaDeep: "#1d4fa8", foam: "#d7e8ff", stone: "#8b939e", stoneDark: "#666d78", stoneLight: "#b9c0c9", pave: "#d9d2c3",
  paveLine: "#c6bead", wood: "#8a5a3b", woodDark: "#5e3a24", green: "#3fa66b", greenDark: "#2c7a4f", leaf: "#59c283", glass: "#a9d6ff",
  lit: "#ffd76a", roof: "#39414f", wall: "#dfe6f1", wallDark: "#c3ccda", peach: "#ecd3c1", peachDark: "#d6b7a2",
  skin: "#f3c9a4", skinShade: "#e0ab84", hair: "#6b3a1e", hairLight: "#8f5530", hairDark: "#4e2913", jeans: "#2e4f9a", jeansDark: "#223c78",
  tee: "#fbfbfb", teeShade: "#e3e6ea", hoop: "#cfd5dd", lens: "#e2f0fa", lensRim: "#aeb8c2",
};

// A well-mixed string hash, so stars, rain and confetti spread out instead of bunching.
const hash = (s) => { let h = [...s].reduce((a, c) => Math.imul(a ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; return h >>> 0; };
const rect = (x, y, w, h, fill, extra = "") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${extra}/>`;
const rr = (x, y, w, h, r, fill, extra = "") => rect(x, y, w, h, fill, ` rx="${r}"${extra}`);
const circ = (cx, cy, r, fill, extra = "") => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${extra}/>`;
const path = (d, fill, extra = "") => `<path d="${d}" fill="${fill}"${extra}/>`;
const line = (x1, y1, x2, y2, stroke, w = 2, extra = "") => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"${extra}/>`;

function sky(hour) {
  if (hour >= 21 || hour < 6) return { top: "#08112a", bottom: "#24365f", night: true };
  if (hour < 8) return { top: "#f3a35f", bottom: "#9cc3ff", night: false };
  if (hour >= 19) return { top: "#ff8a5c", bottom: "#6d7fe0", night: false };
  return { top: "#69b8ff", bottom: "#d6ecff", night: false };
}

const win = (x, y, w, h, night, i = 0) => rr(x, y, w, h, 3, night ? (i % 3 === 2 ? "#3b4a66" : C.lit) : C.glass, ` stroke="${C.white}" stroke-width="2"`);

// ——— back row ———
function faro(level, night) {
  let s = path("M0 322 L0 286 Q30 262 70 270 Q118 258 156 284 L162 322 Z", C.stoneDark) + path("M8 300 Q40 282 80 290 Q120 282 150 300 L150 322 L8 322 Z", C.stone);
  if (level === 1) {
    s += rect(46, 236, 70, 50, C.white) + path("M38 238 L81 210 L124 238 Z", C.blue) + rr(70, 256, 20, 30, 3, C.woodDark);
    s += path("M98 258 q10 -12 20 0 q4 10 -4 16 h-12 q-8 -6 -4 -16 Z", "#5d9bff") + rect(106, 254, 6, 2, C.ink); // the blue piggy bank
    return s;
  }
  const top = level === 3 ? 92 : 182, x = 62, w = 40;
  if (level >= 2) s += rect(108, 248, 42, 38, C.cream) + path("M104 250 L129 232 L154 250 Z", C.red) + rr(122, 262, 14, 24, 2, C.woodDark);
  const bands = Math.round((286 - top) / 24);
  for (let i = 0; i < bands; i++) s += path(`M${x + i * 0.6} ${286 - i * 24} L${x + w - i * 0.6} ${286 - i * 24} L${x + w - (i + 1) * 0.6} ${286 - (i + 1) * 24} L${x + (i + 1) * 0.6} ${286 - (i + 1) * 24} Z`, i % 2 ? C.red : C.white);
  const tw = w - bands * 1.2, tx = x + bands * 0.6;
  s += rect(tx - 6, top - 4, tw + 12, 6, C.ink) + rect(tx + 2, top - 26, tw - 4, 22, night ? C.lit : C.glass) + line(tx + 2 + (tw - 4) / 2, top - 26, tx + 2 + (tw - 4) / 2, top - 4, C.ink, 2);
  s += path(`M${tx - 2} ${top - 26} L${tx + tw / 2} ${top - 46} L${tx + tw + 2} ${top - 26} Z`, C.red) + circ(tx + tw / 2, top - 48, 3, C.ink);
  if (level === 3) {
    s += rect(tx - 10, top + 40, tw + 20, 4, C.ink) + rr(x + 13, 230, 14, 22, 7, C.woodDark);
    if (night) s += path(`M${tx + tw} ${top - 18} L390 ${top - 70} L390 ${top + 40} Z`, C.lit, ' opacity=".28" class="bz-beam"');
  }
  return s;
}

function azotea(level, night) {
  const x = 240, y = 204, w = 132, h = 118;
  let s = rect(x, y, w, h, C.peach) + rect(x, y, 10, h, C.peachDark);
  [0, 1, 2].forEach((r) => [0, 1, 2].forEach((c) => { s += win(x + 20 + c * 38, y + 14 + r * 32, 22, 20, night, r + c); }));
  s += rr(x + 54, y + 92, 24, 26, 3, C.woodDark);
  s += rect(x - 4, y - 6, w + 8, 6, C.stoneLight); // roof edge
  for (let i = 0; i <= 12; i++) s += line(x - 2 + i * 11, y - 6, x - 2 + i * 11, y - 26, C.white, 2);
  s += line(x - 2, y - 26, x + w + 2, y - 26, C.white, 3);
  s += rr(x + 10, y - 30, 46, 18, 6, C.blue) + rr(x + 10, y - 40, 12, 28, 5, C.blue) + rr(x + 44, y - 40, 12, 28, 5, C.blueDark); // sofa
  s += rect(x + 104, y - 24, 14, 18, C.wood) + circ(x + 111, y - 32, 12, C.leaf) + circ(x + 104, y - 38, 8, C.green);
  if (level >= 2) {
    s += rr(x + 66, y - 22, 26, 4, 2, C.woodDark) + rect(x + 77, y - 18, 4, 12, C.woodDark) + rr(x + 72, y - 30, 8, 8, 2, C.white); // table and a cup
    s += path(`M${x - 4} ${y - 70} Q${x + w / 2} ${y - 52} ${x + w + 4} ${y - 70}`, "none", ` stroke="${C.ink}" stroke-width="1.5"`);
    for (let i = 0; i < 9; i++) { const t = (i + 0.5) / 9, px = x - 4 + t * (w + 8), py = y - 70 + 18 * 4 * t * (1 - t) * 0.5 * 2; s += circ(px.toFixed(1), py.toFixed(1), 3.5, i % 3 ? C.lit : "#ff9fd0", ' class="bz-twinkle"'); }
    s += line(x - 4, y - 70, x - 4, y - 26, C.ink, 2) + line(x + w + 4, y - 70, x + w + 4, y - 26, C.ink, 2);
  }
  if (level === 3) {
    s += rect(x + 84, y - 96, 4, 70, C.woodDark) + path(`M${x + 58} ${y - 92} Q${x + 86} ${y - 116} ${x + 114} ${y - 92} Z`, C.red) + path(`M${x + 72} ${y - 92} Q${x + 86} ${y - 112} ${x + 100} ${y - 92} Z`, C.white);
    s += rect(x + 2, y - 70, 6, 50, C.woodDark) + circ(x + 5, y - 80, 18, C.greenDark) + circ(x + 14, y - 72, 12, C.green);
  }
  return s;
}

// ——— middle row ———
function plot(x, w) {
  let s = "";
  for (let i = x; i <= x + w; i += 14) s += rect(i, 492, 4, 28, C.wood);
  s += rect(x, 498, w + 4, 4, C.wood) + rect(x, 510, w + 4, 3, C.woodDark);
  s += rect(x + w - 44, 456, 40, 26, C.cream, ` stroke="${C.woodDark}" stroke-width="2"`) + rect(x + w - 26, 482, 4, 38, C.woodDark) + line(x + w - 40, 466, x + w - 10, 466, C.blue, 3) + line(x + w - 40, 474, x + w - 20, 474, C.blue, 3); // "soon" sign
  return s;
}

function cafe(level, night) {
  const x = 14, base = 520;
  if (level === 1) {
    let s = plot(x, 160);
    s += rect(x + 62, 430, 4, 72, C.ink) + path(`M${x + 20} 434 Q${x + 64} 400 ${x + 108} 434 Z`, C.red) + path(`M${x + 42} 434 Q${x + 64} 410 ${x + 86} 434 Z`, C.white);
    s += rr(x + 34, 474, 62, 6, 3, C.wood) + rect(x + 40, 480, 5, 30, C.woodDark) + rect(x + 86, 480, 5, 30, C.woodDark);
    s += rr(x + 48, 462, 14, 12, 3, C.white) + path(`M${x + 62} 465 q6 0 6 4 q0 4 -6 4`, "none", ` stroke="${C.white}" stroke-width="2"`);
    s += path(`M${x + 70} 470 l20 -4 l2 8 l-20 3 Z`, C.white) + line(x + 74, 470, x + 86, 468, C.blue, 1.2) + `<g class="bz-steam">${path(`M${x + 53} 456 q-4 -6 0 -12 q4 -6 0 -12`, "none", ` stroke="${C.white}" stroke-width="2" opacity=".8"`)}</g>`;
    return s;
  }
  const h = level === 3 ? 176 : 112, top = base - h, w = 166;
  let s = rect(x, top, w, h, C.cream) + rect(x, top, 10, h, C.creamDark) + rect(x - 4, top - 10, w + 8, 12, C.roof);
  for (let i = 0; i < 8; i++) s += path(`M${x + i * 21} ${base - 98} h21 v18 q-10.5 10 -21 0 Z`, i % 2 ? C.white : C.red); // awning
  s += rr(x + 66, base - 62, 34, 62, 4, C.woodDark) + circ(x + 94, base - 30, 2.5, C.lit);
  s += win(x + 14, base - 64, 40, 36, night) + win(x + 112, base - 64, 40, 36, night, 1);
  s += rr(x + 48, base - 124 + (level === 3 ? 0 : 6), 70, 20, 4, C.blue) + `<text x="${x + 83}" y="${base - 109 + (level === 3 ? 0 : 6)}" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="800" font-size="13" fill="${C.white}">CAFÉ</text>`;
  if (level === 3) {
    [0, 1, 2].forEach((c) => { s += win(x + 16 + c * 52, top + 18, 32, 28, night, c + 1); s += rect(x + 22 + c * 52, top + 24, 8, 8, C.white) + rect(x + 34 + c * 52, top + 30, 8, 8, "#fff4b0"); }); // napkins pinned to the windows
    s += rect(x + 130, top - 30, 16, 22, C.stoneDark) + `<g class="bz-steam">${path(`M${x + 138} ${top - 34} q-6 -8 0 -16 q6 -8 0 -16`, "none", ` stroke="${C.white}" stroke-width="3" opacity=".7"`)}</g>`;
    for (let i = 0; i < 10; i++) s += circ(x + 8 + i * 17, top - 14, 3, i % 2 ? C.lit : "#9fe0b8", ' class="bz-twinkle"');
  }
  s += rr(x + 112, base - 18, 40, 4, 2, C.wood) + rect(x + 130, base - 14, 4, 14, C.woodDark) + rr(x + 122, base - 26, 9, 8, 2, C.white);
  return s;
}

function oficina(level, night) {
  const x = 206, base = 520;
  if (level === 1) {
    let s = plot(x, 168);
    s += rr(x + 30, 478, 80, 6, 2, C.wood) + rect(x + 36, 484, 5, 28, C.woodDark) + rect(x + 100, 484, 5, 28, C.woodDark);
    s += rr(x + 52, 456, 38, 22, 3, C.stoneDark) + rr(x + 55, 459, 32, 16, 2, night ? "#5fa0ff" : C.glass) + rect(x + 46, 477, 50, 3, C.stone);
    s += line(x + 122, 520, x + 134, 440, C.woodDark, 3) + line(x + 150, 520, x + 138, 440, C.woodDark, 3) + rect(x + 118, 438, 40, 34, C.white, ` stroke="${C.stoneLight}" stroke-width="1"`);
    s += rr(x + 132, 444, 12, 6, 1, C.blue) + line(x + 138, 450, x + 138, 456, C.ink, 1) + line(x + 126, 456, x + 150, 456, C.ink, 1) + rr(x + 121, 458, 10, 6, 1, C.red) + rr(x + 145, 458, 10, 6, 1, C.green); // org chart on paper
    return s;
  }
  const floors = level === 3 ? 3 : 1, fh = 58, h = floors * fh + 34, top = base - h, w = 170;
  let s = rect(x, top, w, h, C.wall) + rect(x + w - 10, top, 10, h, C.wallDark) + rect(x - 4, top - 8, w + 8, 10, C.roof);
  if (floors === 1) {
    s += rr(x + 14, base - 80, 142, 52, 4, night ? "#132a55" : "#bfe0ff", ` stroke="${C.ink}" stroke-width="3"`);
    [0, 1, 2].forEach((i) => { s += rr(x + 26 + i * 44, base - 70, 34, 22, 2, C.ink) + rr(x + 29 + i * 44, base - 67, 28, 16, 1, i === 1 ? "#5fa0ff" : "#7fc0ff"); });
  } else {
    for (let f = 0; f < 3; f++) { const fy = top + 16 + f * fh; [0, 1, 2].forEach((c) => { s += win(x + 16 + c * 50, fy, 36, 30, night, f === 1 && c === 1 ? 0 : 2); }); }
    s += rr(x + 22, top - 40, 126, 28, 4, C.blue) + `<text x="${x + 85}" y="${top - 21}" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="800" font-size="12" fill="${C.white}">OFICINA DE UNO</text>` + line(x + 50, top - 12, x + 50, top - 8, C.ink, 3) + line(x + 120, top - 12, x + 120, top - 8, C.ink, 3);
  }
  s += rr(x + 70, base - 26, 30, 26, 3, C.blue) + line(x + 85, base - 26, x + 85, base, C.blueDark, 2);
  return s;
}

// ——— front: the Muro ———
function muro(level, night) {
  let s = rect(0, 520, VW, 180, C.pave);
  for (let y = 548; y < 700; y += 30) s += line(0, y, VW, y, C.paveLine, 1.5);
  for (let x = 30; x < VW; x += 60) s += line(x, 520, x - 20, 700, C.paveLine, 1.5);
  // The running lane: a lap marker per level.
  s += path("M0 664 Q195 640 390 664 L390 690 Q195 666 0 690 Z", "#e26b5b") + path("M0 677 Q195 653 390 677", "none", ` stroke="${C.white}" stroke-width="2" stroke-dasharray="14 10"`);
  for (let i = 0; i < level; i++) s += `<text x="${342 - i * 26}" y="660" font-family="system-ui, sans-serif" font-weight="800" font-size="14" fill="${C.white}">${i + 1}</text>`;
  s += rr(22, 596, 92, 10, 4, C.wood) + rr(22, 578, 92, 8, 4, C.wood) + rect(30, 606, 6, 22, C.woodDark) + rect(100, 606, 6, 22, C.woodDark); // bench
  s += rr(150, 600, 30, 30, 6, C.stoneDark) + circ(165, 592, 18, C.leaf) + circ(156, 584, 10, C.green);
  if (level >= 2) {
    for (const lx of [8, 370]) { s += rect(lx, 470, 6, 180, C.ink) + rr(lx - 10, 462, 26, 12, 5, C.ink) + circ(lx + 3, 478, 7, night ? C.lit : "#e8e2c4"); if (night) s += circ(lx + 3, 482, 30, C.lit, ' opacity=".18"'); }
    s += rr(280, 600, 30, 30, 6, C.stoneDark) + circ(295, 590, 20, C.leaf) + circ(305, 582, 11, C.green);
  }
  if (level === 3) {
    s += rect(212, 548, 4, 60, C.ink) + path("M216 550 L250 560 L216 570 Z", C.blue) + rect(330, 548, 4, 60, C.ink) + path("M334 550 L368 560 L334 570 Z", C.red);
    s += rr(232, 596, 40, 10, 3, C.stoneDark) + rect(248, 576, 6, 22, C.ink) + rr(238, 568, 30, 12, 5, C.stone); // the lookout telescope
  }
  return s;
}

// ——— Manu ———
// From his own drawings: big head, messy brown hair swept to his left (the
// viewer's right), glasses black on top and clear below, a silver hoop on the
// ear, a serious half-frown, oversized white tee, baggy dark jeans, white
// trainers with three black stripes. Local box 0..130 × 0..200.
export function character(mood = "tranquilo") {
  const lens = mood === "celebrando" ? "#ffb3ec" : C.lens;
  let s = "";
  // Shoes.
  for (const sx of [18, 70]) {
    s += path(`M${sx} 186 q0 -12 14 -12 h18 q16 0 18 12 v6 h-50 Z`, C.white, ` stroke="${C.ink}" stroke-width="2.5"`) + rect(sx, 190, 52, 6, C.stoneLight);
    for (let i = 0; i < 3; i++) s += line(sx + 16 + i * 8, 178, sx + 22 + i * 8, 188, C.ink, 2.5);
  }
  // Baggy jeans.
  s += path("M24 118 L106 118 L112 178 L74 180 L66 140 L62 140 L56 180 L18 178 Z", C.jeans, ` stroke="${C.ink}" stroke-width="2.5" stroke-linejoin="round"`);
  s += line(64, 122, 64, 140, C.jeansDark, 2) + line(34, 150, 30, 172, C.jeansDark, 2) + line(98, 150, 102, 172, C.jeansDark, 2) + path("M20 170 h36 M74 172 h36", "none", ` stroke="${C.jeansDark}" stroke-width="3"`);
  // Arms (behind the tee sleeves) and props held.
  const armsUp = mood === "celebrando";
  if (armsUp) s += path("M18 92 L4 52", "none", ` stroke="${C.skin}" stroke-width="13" stroke-linecap="round"`) + path("M112 92 L126 52", "none", ` stroke="${C.skin}" stroke-width="13" stroke-linecap="round"`);
  else s += path("M16 100 Q8 124 16 140", "none", ` stroke="${C.skin}" stroke-width="13" stroke-linecap="round"`) + path("M114 100 Q122 124 114 140", "none", ` stroke="${C.skin}" stroke-width="13" stroke-linecap="round"`);
  // Oversized tee.
  s += path("M30 84 Q65 76 100 84 L124 100 L114 116 L106 110 L108 126 Q65 132 22 126 L24 110 L16 116 L6 100 Z", C.tee, ` stroke="${C.ink}" stroke-width="2.5" stroke-linejoin="round"`);
  s += path("M50 84 Q65 92 80 84", "none", ` stroke="${C.ink}" stroke-width="2.5"`) + line(36, 112, 40, 124, C.teeShade, 3) + line(96, 112, 92, 124, C.teeShade, 3);
  // Neck and head.
  s += rect(56, 72, 18, 14, C.skinShade);
  s += path("M22 40 Q22 4 65 4 Q108 4 108 40 L108 52 Q108 82 65 82 Q22 82 22 52 Z", C.skin, ` stroke="${C.ink}" stroke-width="2.5"`);
  s += path("M18 44 q-8 0 -8 9 q0 9 9 9", C.skin, ` stroke="${C.ink}" stroke-width="2.5"`) + `<circle cx="14" cy="66" r="5" fill="none" stroke="${C.hoop}" stroke-width="2.5"/>`; // ear and the silver hoop
  // Hair: messy, swept to the viewer's right, spikes on top.
  s += path("M18 44 Q12 14 34 6 L30 -4 L46 2 L50 -10 L62 0 L72 -10 L80 2 L94 -6 L94 6 L114 4 L106 16 Q120 26 112 48 L106 40 Q104 26 92 22 Q80 34 46 30 Q36 34 30 50 Z", C.hair, ` stroke="${C.hairDark}" stroke-width="2.5" stroke-linejoin="round"`);
  s += path("M46 30 Q70 22 98 26 Q86 12 70 12", "none", ` stroke="${C.hairLight}" stroke-width="3" stroke-linecap="round"`) + path("M40 10 Q54 4 64 8", "none", ` stroke="${C.hairLight}" stroke-width="3" stroke-linecap="round"`);
  // Brows, glasses (heavy black top rim, thin clear bottom), eyes.
  s += path("M32 38 h22 M74 38 h22", "none", ` stroke="${C.hairDark}" stroke-width="4" stroke-linecap="round"`);
  for (const gx of [28, 70]) s += path(`M${gx} 46 h30 v6 q0 12 -15 12 q-15 0 -15 -12 Z`, lens, ` stroke="${C.lensRim}" stroke-width="1.5" opacity=".95"`) + path(`M${gx - 1} 45 h32 v6 h-32 Z`, C.ink);
  s += line(58, 48, 70, 48, C.ink, 3);
  if (mood === "cansado") s += path("M36 56 q7 4 14 0 M78 56 q7 4 14 0", "none", ` stroke="${C.ink}" stroke-width="2.5" stroke-linecap="round"`);
  else if (mood === "celebrando") s += path("M36 58 q7 -6 14 0 M78 58 q7 -6 14 0", "none", ` stroke="${C.ink}" stroke-width="2.5" stroke-linecap="round"`);
  else s += `<g class="bz-blink">${circ(43, 56, 3.6, C.ink)}${circ(85, 56, 3.6, C.ink)}</g>`;
  // Mouth: his serious half-frown; a grin when celebrating.
  s += mood === "celebrando" ? path("M54 70 q11 9 22 0 Z", "#b2524a", ` stroke="${C.ink}" stroke-width="2"`) : path("M56 72 q8 -2 18 1", "none", ` stroke="${C.ink}" stroke-width="2.5" stroke-linecap="round"`);
  // Mood props.
  if (mood === "inspirado") s += `<g class="bz-float">${circ(118, -6, 12, C.lit, ` stroke="${C.ink}" stroke-width="2"`)}${rr(112, 5, 12, 8, 2, C.stoneLight, ` stroke="${C.ink}" stroke-width="2"`)}${line(118, -28, 118, -22, C.lit, 3)}${line(100, -18, 104, -14, C.lit, 3)}${line(136, -18, 132, -14, C.lit, 3)}</g>`;
  if (mood === "trabajando") s += rr(28, 112, 74, 6, 2, C.stone, ` stroke="${C.ink}" stroke-width="2"`) + path("M34 112 L40 86 L96 86 L102 112 Z", C.stoneDark, ` stroke="${C.ink}" stroke-width="2"`) + path("M44 108 L48 90 L88 90 L92 108 Z", "#7fc0ff");
  if (mood === "cansado") s += `<g class="bz-float"><text x="104" y="6" font-family="system-ui, sans-serif" font-weight="800" font-size="22" fill="${C.white}" stroke="${C.ink}" stroke-width="1">z</text><text x="120" y="-14" font-family="system-ui, sans-serif" font-weight="800" font-size="16" fill="${C.white}" stroke="${C.ink}" stroke-width="1">z</text></g>` + rr(4, 128, 18, 22, 3, C.white, ` stroke="${C.ink}" stroke-width="2"`) + path("M22 134 q8 0 8 6 q0 6 -8 6", "none", ` stroke="${C.ink}" stroke-width="2"`); // a coffee, of course
  if (mood === "descansado") s += path("M20 44 Q20 0 65 -2 Q110 0 110 44", "none", ` stroke="${C.ink}" stroke-width="5"`) + rr(12, 38, 14, 22, 5, C.blue) + rr(104, 38, 14, 22, 5, C.blue) + `<g class="bz-float"><text x="116" y="0" font-size="20" font-family="system-ui, sans-serif" fill="${C.ink}">♪</text><text x="0" y="-8" font-size="16" font-family="system-ui, sans-serif" fill="${C.ink}">♫</text></g>`;
  if (mood === "celebrando") for (let i = 0; i < 14; i++) { const h = hash(`c${i}`); s += rect((h % 170) - 20, ((h >>> 6) % 70) - 60, 5, 9, [C.lit, C.red, C.blue, C.leaf][i % 4], ` class="bz-confetti" transform="rotate(${h % 90} ${(h % 170) - 18} ${((h >>> 6) % 70) - 56})"`); }
  return s;
}

const SPOT_FOR = { trabajando: 214, inspirado: 120, cansado: 34, descansado: 60, celebrando: 130, tranquilo: 140 };

export function townSVG({ places = [], mood = "tranquilo", now = new Date(), label = "Tu bahía" } = {}) {
  const lv = Object.fromEntries(places.map((p) => [p.id, p.level]));
  const L = (id) => lv[id] ?? 1;
  const { top, bottom, night } = sky(now.getHours());
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}" role="img" aria-label="${label.replace(/[<>&"]/g, "")}">`;
  s += `<defs><linearGradient id="bzSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>`;
  s += `<linearGradient id="bzSea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${night ? C.seaDeep : C.sea}"/><stop offset="1" stop-color="${night ? "#10306e" : C.seaDeep}"/></linearGradient></defs>`;
  s += rect(0, 0, VW, 330, "url(#bzSky)");
  if (night) { for (let i = 0; i < 36; i++) { const h = hash(`s${i}`); s += circ(h % VW, (h >>> 9) % 200, (h % 3) * 0.6 + 1.1, "#fff", ` opacity="${0.5 + (h % 5) / 10}" class="${i % 4 ? "" : "bz-twinkle"}"`); } s += circ(320, 64, 24, "#f4f1d0") + circ(330, 56, 22, top); }
  else s += circ(318, 70, 28, "#ffe27a", ' class="bz-sun"') + circ(318, 70, 40, "#ffe27a", ' opacity=".25"');
  for (const [cx, cy, k] of [[90, 60, 1], [230, 110, 0.8], [40, 150, 0.6]]) s += `<g class="bz-cloud" opacity="${night ? 0.25 : 0.9}">${circ(cx, cy, 16 * k, C.white)}${circ(cx + 18 * k, cy - 8 * k, 20 * k, C.white)}${circ(cx + 40 * k, cy, 16 * k, C.white)}${rr(cx - 10 * k, cy, 64 * k, 14 * k, 7 * k, C.white)}</g>`;
  s += path("M0 236 Q60 212 130 228 Q210 206 280 226 Q340 214 390 230 L390 250 L0 250 Z", night ? "#1d3b35" : "#79b88f");
  s += rect(0, 244, VW, 80, "url(#bzSea)");
  for (let row = 0; row < 3; row++) s += `<g class="bz-wave"${row % 2 ? ' opacity=".7"' : ""}>${Array.from({ length: 8 }, (_, i) => path(`M${i * 60 - 30 + row * 20} ${262 + row * 20} q10 -6 20 0`, "none", ` stroke="${C.foam}" stroke-width="2" stroke-linecap="round"`)).join("")}</g>`;
  s += `<g class="bz-boat">${path("M150 280 h44 l-8 10 h-28 Z", C.white)}${line(170, 280, 170, 256, C.ink, 2)}${path("M172 258 L190 278 L172 278 Z", C.red)}</g>`;
  s += faro(L("faro"), night) + azotea(L("azotea"), night);
  s += rect(0, 318, VW, 12, C.stone) + rect(0, 316, VW, 3, C.stoneLight); // the quay
  s += rect(0, 330, VW, 190, "#e9e1cf");
  for (let x = 0; x < VW; x += 26) s += line(x, 330, x - 10, 520, "#ddd3bd", 1);
  s += cafe(L("cafe"), night) + oficina(L("oficina"), night);
  s += muro(L("muro"), night);
  s += `<g transform="translate(${SPOT_FOR[mood] ?? 140} 462)"><g class="bz-char${mood === "celebrando" ? " bz-jump" : ""}">${path("M10 196 Q65 214 120 196 Q65 186 10 196 Z", "#000", ' opacity=".15"')}${character(mood)}</g></g>`;
  if (night) s += rect(0, 0, VW, VH, "#0b1530", ' opacity=".18"');
  if (hash(now.toDateString()) % 6 === 0) s += `<g class="bz-rain" opacity=".55">${Array.from({ length: 50 }, (_, i) => { const h = hash(`r${i}`); return line(h % VW, (h >>> 7) % VH, (h % VW) - 4, ((h >>> 7) % VH) + 14, "#dcebff", 1.5); }).join("")}</g>`;
  return s + "</svg>";
}
