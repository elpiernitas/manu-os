// ContextMemory (§6.5): contexto como probabilidad. Una sola pista ambigua no lo declara cierto.
export const emptyContext = () => ({ device: null, shared: false, label: null, mode: null, confidence: 0, at: null });
/** `shared: true` solo si llega como señal explícita (sesión compartida, playlist «shared», corrección). */
export function applyContext(ctx, c, t) {
  const next = { ...ctx, at: t };
  if ("device" in c) next.device = c.device ?? null;
  if ("label" in c) next.label = c.label ?? null;
  if ("mode" in c) next.mode = c.mode ?? null;
  if ("shared" in c) { next.shared = Boolean(c.shared); next.confidence = c.shared ? Math.max(0.9, c.confidence ?? 0.9) : 0; }
  return next;
}
