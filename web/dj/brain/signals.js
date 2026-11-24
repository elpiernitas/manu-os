// Qué significa cuánto se escuchó una canción (DJ-BRAIN-00 §7). Umbrales en config: [PROPUESTA].
/** @returns {{kind: "skip_strong"|"skip_moderate"|"ambiguous"|"accept"|"accept_strong"|"repeat", quick: boolean, positive: boolean, negative: boolean}} */
export function classifyListen({ type, msPlayed = 0, durationMs = 0 }, cfg) {
  if (type === "track_repeated") return { kind: "repeat", quick: false, positive: true, negative: false };
  if (type === "track_completed") return { kind: "accept_strong", quick: false, positive: true, negative: false };
  const ratio = durationMs > 0 ? msPlayed / durationMs : 0;
  if (ratio >= cfg.strongAcceptRatio) return { kind: "accept_strong", quick: false, positive: true, negative: false, ratio };
  if (ratio > cfg.acceptRatio) return { kind: "accept", quick: false, positive: true, negative: false, ratio };
  const quick = msPlayed < cfg.quickMs;
  if (msPlayed < cfg.strongMs) return { kind: "skip_strong", quick, positive: false, negative: true, ratio };
  if (msPlayed < cfg.moderateMs) return { kind: "skip_moderate", quick, positive: false, negative: true, ratio };
  return { kind: "ambiguous", quick: false, positive: false, negative: false, ratio };
}
