// Similitud independiente del proveedor (sin Audio Features ni Related Artists): etiquetas y, si las
// hay, rasgos numéricos que aporte cualquier adaptador de catálogo. Devuelve 0–1.
const jaccard = (a = [], b = []) => {
  if (!a.length || !b.length) return 0;
  const A = new Set(a), B = new Set(b); let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
};
const cosine = (a, b) => {
  if (!a || !b) return null;
  const keys = Object.keys(a).filter((k) => k in b);
  if (!keys.length) return null;
  let dot = 0, na = 0, nb = 0;
  for (const k of keys) { dot += a[k] * b[k]; na += a[k] ** 2; nb += b[k] ** 2; }
  return na && nb ? Math.max(0, dot / Math.sqrt(na * nb)) : null;
};
export function similarity(x, y) {
  if (!x || !y) return 0;
  if (x.id === y.id) return 1;
  const tags = jaccard(x.tags, y.tags);
  const tr = cosine(x.traits, y.traits);
  const base = tr === null ? tags : 0.5 * tags + 0.5 * tr;
  return Math.min(1, Math.max(base, x.artistId && x.artistId === y.artistId ? 0.6 : 0));
}
