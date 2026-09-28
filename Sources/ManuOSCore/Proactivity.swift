import Foundation

public enum SuggestionOutcome: String, Codable, Sendable {
    case accepted = "ACCEPTED"
    case rejected = "REJECTED"
    case ignored = "IGNORED"
}

public struct SuggestionRecord: Codable, Equatable, Sendable {
    public let kind: String
    public let shownAt: Date
    public let outcome: SuggestionOutcome?

    public init(kind: String, shownAt: Date, outcome: SuggestionOutcome?) {
        self.kind = kind
        self.shownAt = shownAt
        self.outcome = outcome
    }
}

public struct ProactivityDecision: Equatable, Sendable {
    public let allowed: Bool
    public let reason: String
}

/// Keeps MANU's initiative useful instead of annoying (R-32):
/// a daily budget, a minimum gap, no repeats and back-off after being ignored.
public struct ProactivityPolicy: Codable, Equatable, Sendable {
    public var maxPerDay: Int
    public var minimumGap: TimeInterval
    public var sameKindCooldown: TimeInterval
    public var ignoresBeforeBackoff: Int
    public var backoff: TimeInterval

    public init(
        maxPerDay: Int = 4,
        minimumGap: TimeInterval = 90 * 60,
        sameKindCooldown: TimeInterval = 20 * 3600,
        ignoresBeforeBackoff: Int = 3,
        backoff: TimeInterval = 3 * 24 * 3600
    ) {
        self.maxPerDay = maxPerDay
        self.minimumGap = minimumGap
        self.sameKindCooldown = sameKindCooldown
        self.ignoresBeforeBackoff = ignoresBeforeBackoff
        self.backoff = backoff
    }

    public func decide(
        kind: String,
        at now: Date,
        history: [SuggestionRecord],
        focusActive: Bool,
        urgent: Bool = false
    ) -> ProactivityDecision {
        if focusActive && !urgent {
            return ProactivityDecision(allowed: false, reason: "Hay un Focus activo")
        }
        let lastDay = history.filter { now.timeIntervalSince($0.shownAt) < 24 * 3600 && $0.shownAt <= now }
        if !urgent && lastDay.count >= maxPerDay {
            return ProactivityDecision(allowed: false, reason: "Presupuesto diario agotado")
        }
        if !urgent, let last = history.filter({ $0.shownAt <= now }).map(\.shownAt).max(),
           now.timeIntervalSince(last) < minimumGap
        {
            return ProactivityDecision(allowed: false, reason: "Demasiado pronto desde la última sugerencia")
        }
        let sameKind = history.filter { $0.kind == kind && $0.shownAt <= now }.sorted { $0.shownAt < $1.shownAt }
        if let last = sameKind.last, now.timeIntervalSince(last.shownAt) < sameKindCooldown {
            return ProactivityDecision(allowed: false, reason: "Ya lo sugerí hace poco")
        }
        let recent = sameKind.suffix(ignoresBeforeBackoff)
        if recent.count == ignoresBeforeBackoff,
           recent.allSatisfy({ $0.outcome == .ignored || $0.outcome == .rejected }),
           let last = recent.last, now.timeIntervalSince(last.shownAt) < backoff
        {
            return ProactivityDecision(allowed: false, reason: "Lo ignoraste varias veces; espero un poco")
        }
        return ProactivityDecision(allowed: true, reason: urgent ? "Urgente" : "Dentro del presupuesto")
    }
}
