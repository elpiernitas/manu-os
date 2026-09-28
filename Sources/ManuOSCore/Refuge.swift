import Foundation

/// Refugio: emotional support without diagnosis (docs/product/EXPERIENCE.md).
/// Phases follow what Manu asked for: understand, solve, change of air.
public enum RefugePhase: String, Codable, Sendable {
    case choosing = "CHOOSING"
    case understand = "UNDERSTAND"
    case solve = "SOLVE"
    case changeOfAir = "CHANGE_OF_AIR"
    /// Possible real risk: human help first, the conversation does not go on as usual.
    case humanHelp = "HUMAN_HELP"
}

public struct RefugeSession: Equatable, Sendable {
    public private(set) var phase: RefugePhase = .choosing
    private var turn = 0

    public init() {}

    /// Distractions Manu said help him, in his words.
    public static let distractions = [
        "Poner música",
        "Salir a caminar un rato",
        "Hablar o quedar con alguien",
        "Ver una serie o vídeos",
        "Salir sin plan",
        "Hacer algo creativo",
    ]

    /// Next reply for Manu's message. Crisis detection always wins.
    public mutating func reply(to text: String) -> String {
        if IntentParser.parse(text) == .crisis {
            phase = .humanHelp
            return ManuReplies.crisis
        }
        if phase == .humanHelp {
            return "Antes de seguir: ¿has podido hablar con el 112, el 024 o con alguien de confianza? Eso es lo primero."
        }
        let normalised = IntentParser.normalise(text)
        if phase == .choosing {
            if normalised.contains("entender") || normalised.contains("por que") {
                phase = .understand
            } else if normalised.contains("solucion") || normalised.contains("arreglar") || normalised.contains("resolver") {
                phase = .solve
            } else if normalised.contains("distraer") || normalised.contains("desconectar") || normalised.contains("cambiar de aire") {
                phase = .changeOfAir
            } else {
                return "¿Qué te vendría mejor ahora: entender por qué estás así, buscar una solución o cambiar de aire?"
            }
        }
        turn += 1
        switch phase {
        case .understand:
            return [
                "Vale. ¿Desde cuándo lo notas y qué ha pasado justo antes?",
                "¿Hay alguna persona o situación que tenga que ver con esto?",
                "Si tuvieras que ponerle nombre a lo que sientes, ¿cuál sería?",
            ][(turn - 1) % 3]
        case .solve:
            return [
                "Vamos a lo práctico. ¿Cuál es la parte que más te pesa ahora mismo?",
                "¿Qué es lo más pequeño que podrías hacer hoy para que pese un poco menos?",
                "¿Quieres que lo apunte como tarea para no tener que acordarte?",
            ][(turn - 1) % 3]
        case .changeOfAir:
            let option = Self.distractions[(turn - 1) % Self.distractions.count]
            return "Propuesta: \(option.lowercased()). Si no te encaja, te propongo otra."
        case .choosing, .humanHelp:
            return ""
        }
    }
}

// MARK: - Recurring payments and subscriptions

public struct RecurringPayment: Equatable, Sendable {
    public let merchant: String
    public let typicalAmount: Decimal
    public let occurrences: Int
    public let lastPaid: Date
    public let nextExpected: Date
}

public enum RecurringDetector {
    /// Finds merchants charged roughly every month (25–35 days apart) at least
    /// `minimumOccurrences` times with stable amounts (within 10 %).
    public static func detect(_ entries: [SpendingEntry], minimumOccurrences: Int = 3) -> [RecurringPayment] {
        let grouped = Dictionary(grouping: entries.filter { $0.merchant != nil }) {
            IntentParser.normalise($0.merchant ?? "")
        }
        return grouped.compactMap { merchant, payments -> RecurringPayment? in
            let sorted = payments.sorted { $0.occurredAt < $1.occurredAt }
            guard sorted.count >= minimumOccurrences else { return nil }
            let gaps = zip(sorted.dropFirst(), sorted).map { $0.occurredAt.timeIntervalSince($1.occurredAt) / 86400 }
            guard gaps.allSatisfy({ (25...35).contains($0) }) else { return nil }
            let amounts = sorted.map(\.amount)
            guard let low = amounts.min(), let high = amounts.max(), low > 0,
                  (high - low) / low <= Decimal(string: "0.1")!
            else { return nil }
            let last = sorted.last!
            let averageGap = gaps.reduce(0, +) / Double(gaps.count)
            return RecurringPayment(
                merchant: last.merchant ?? merchant,
                typicalAmount: last.amount,
                occurrences: sorted.count,
                lastPaid: last.occurredAt,
                nextExpected: last.occurredAt.addingTimeInterval(averageGap * 86400)
            )
        }
        .sorted { $0.merchant < $1.merchant }
    }

    /// Recurring payments expected within `days` from `now`: "cobro próximo".
    public static func upcoming(_ payments: [RecurringPayment], from now: Date, days: Int = 3) -> [RecurringPayment] {
        payments.filter { $0.nextExpected >= now && $0.nextExpected.timeIntervalSince(now) <= Double(days) * 86400 }
    }
}
