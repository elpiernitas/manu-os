// El cielo de MANU OS · HORIZONTE. Puro: de una fecha y un tiempo sale la luz de toda la interfaz.
// La posición del sol se calcula con las fórmulas de la NOAA (aproximación de ±1°, suficiente
// para pintar). Las coordenadas son las públicas de la ciudad de Gijón, no una ubicación personal.
const RAD = Math.PI / 180;
export const GIJON = { lat: 43.5453, lon: -5.6619 };
export const TIEMPOS = ["despejado", "nubes", "lluvia", "niebla"];

/** Elevación del sol en grados y ángulo horario (negativo = mañana). */
export function sol(fecha, { lat, lon } = GIJON) {
  const inicio = Date.UTC(fecha.getUTCFullYear(), 0, 0);
  const dia = Math.floor((fecha.getTime() - inicio) / 864e5);
  const horas = fecha.getUTCHours() + fecha.getUTCMinutes() / 60;
  const g = (2 * Math.PI / 365) * (dia - 1 + (horas - 12) / 24);
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  let ha = (horas * 60 + eqt + 4 * lon) / 4 - 180;
  ha = ((ha + 540) % 360) - 180;
  const el = Math.asin(Math.sin(lat * RAD) * Math.sin(decl) + Math.cos(lat * RAD) * Math.cos(decl) * Math.cos(ha * RAD));
  return { elevacion: el / RAD, angulo: ha };
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
export const mezcla = (a, b, t) => toHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * t));

// Paradas de color por elevación del sol: [grados, arriba, horizonte, mar].
const PARADAS = (tarde) => [
  [-12, "#060a18", "#131c3a", "#0a1226"],
  [-4, "#1b2358", tarde ? "#a8456b" : "#8b5d9c", "#2a2a5c"],
  [0, tarde ? "#2e3384" : "#4a5aa6", tarde ? "#ff8a4c" : "#ffb199", tarde ? "#6b4480" : "#5f5a96"],
  [8, "#6fa8e8", tarde ? "#ffd9a6" : "#ffe6cf", "#3f7fa6"],
  [25, "#3d8bef", "#cde7ff", "#1f6fa8"],
];
const VELO = { despejado: 0, nubes: 0.32, lluvia: 0.58, niebla: 0.66 };

/** El estado del cielo: fase, colores, astro y si la interfaz va en tinta clara u oscura. */
export function cielo(fecha = new Date(), tiempo = "despejado", lugar = GIJON) {
  const { elevacion, angulo } = sol(fecha, lugar);
  const tarde = angulo > 0;
  const p = PARADAS(tarde);
  const e = Math.max(p[0][0], Math.min(p[p.length - 1][0], elevacion));
  let i = 0;
  while (i < p.length - 2 && e > p[i + 1][0]) i++;
  const t = (e - p[i][0]) / (p[i + 1][0] - p[i][0]);
  let colores = [1, 2, 3].map((k) => mezcla(p[i][k], p[i + 1][k], t));
  const noche = elevacion < -1;
  const velo = VELO[tiempo] ?? 0;
  if (velo) { const gris = noche ? "#1a1f2b" : tiempo === "niebla" ? "#c9ced3" : "#7d8792"; colores = colores.map((c) => mezcla(c, gris, velo)); }
  const fase = elevacion < -6 ? "noche" : elevacion < 6 ? (tarde ? "ocaso" : "alba") : "dia";
  // El astro recorre un arco: x de 0 a 1 (este → oeste), y de 0 (horizonte) a 1 (cénit).
  const astro = noche
    ? { tipo: "luna", x: ((angulo + 360) % 360 - 90) / 180, y: Math.min(1, Math.max(0.15, -elevacion / 50)) }
    : { tipo: "sol", x: Math.max(0, Math.min(1, (angulo + 100) / 200)), y: Math.max(0, Math.min(1, elevacion / 70)) };
  astro.x = Math.max(0.06, Math.min(0.94, astro.x));
  // La tinta de toda la interfaz sigue a la luz: cielo oscuro → papel de noche.
  const oscuro = lum(mezcla(colores[0], colores[1], 0.35)) < 0.18;
  return { fase, noche, oscuro, tiempo: TIEMPOS.includes(tiempo) ? tiempo : "despejado", elevacion, astro, colores: { arriba: colores[0], horizonte: colores[1], mar: colores[2] } };
}

/** Variables CSS que el resto del sistema de diseño consume. */
export const variables = (c) => ({ "--cielo-1": c.colores.arriba, "--cielo-2": c.colores.horizonte, "--mar": c.colores.mar, "--astro-x": c.astro.x.toFixed(3), "--astro-y": c.astro.y.toFixed(3) });

function lum(h) { const [r, g, b] = hex(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
const FRASE = { noche: "De noche", alba: "Amanece", dia: "De día", ocaso: "Atardece" };
export const describe = (c) => `${FRASE[c.fase]} · ${c.tiempo}`;

// Contraste WCAG, para probar los pares de color del sistema.
export const contraste = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
export const TOKENS = {
  dia: { papel: "#f3eee3", papel2: "#e9e2d3", tinta: "#15120e", tinta2: "#5a5348", boya: "#ff4b1f", boyaTinta: "#b02a07", sobreBoya: "#15120e" },
  noche: { papel: "#0a0f1e", papel2: "#141b30", tinta: "#eef0f6", tinta2: "#a3abc2", boya: "#ff6a3d", boyaTinta: "#ff8a66", sobreBoya: "#15120e" },
};
