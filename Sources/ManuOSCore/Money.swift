import Foundation

public enum SpendingCategory: String, Codable, CaseIterable, Sendable {
    case foodAndDrink = "FOOD_AND_DRINK"
    case groceries = "GROCERIES"
    case transport = "TRANSPORT"
    case subscriptions = "SUBSCRIPTIONS"
    case leisure = "LEISURE"
    case home = "HOME"
    case health = "HEALTH"
    case other = "OTHER"

    public var title: String {
        switch self {
        case .foodAndDrink: "Comer y beber"
        case .groceries: "Supermercado"
        case .transport: "Transporte"
        case .subscriptions: "Suscripciones"
        case .leisure: "Ocio"
        case .home: "Casa"
        case .health: "Salud"
        case .other: "Otros"
        }
    }
}

/// A spending entry. Amount, date and merchant are confirmed by Manu;
/// the category is inferred and always correctable (EXPERIENCE.md, Finanzas).
public struct SpendingEntry: Codable, Equatable, Identifiable, Sendable {
    public let id: String
    public let amount: Decimal
    public let merchant: String?
    public let occurredAt: Date
    public private(set) var category: SpendingCategory
    public private(set) var categoryInferred: Bool

    public init(id: String, amount: Decimal, merchant: String?, occurredAt: Date) {
        self.id = id
        self.amount = amount
        self.merchant = merchant
        self.occurredAt = occurredAt
        category = SpendingCategorizer.category(for: merchant)
        categoryInferred = true
    }

    /// Manu's correction always wins and is no longer an inference.
    public mutating func correctCategory(_ value: SpendingCategory) {
        category = value
        categoryInferred = false
    }
}

public enum SpendingCategorizer {
    private static let rules: [(SpendingCategory, [String])] = [
        (.subscriptions, ["netflix", "spotify", "hbo", "disney", "prime", "icloud", "suscripcion"]),
        (.groceries, ["mercadona", "carrefour", "lidl", "alcampo", "eroski", "dia", "supermercado", "super"]),
        (.transport, ["gasolina", "gasolinera", "repsol", "cepsa", "bus", "tren", "renfe", "taxi", "parking", "peaje"]),
        (.foodAndDrink, ["cafe", "bar", "restaurante", "cena", "comida", "desayuno", "pizza", "burger", "cerveza"]),
        (.leisure, ["cine", "concierto", "entradas", "libro", "juego"]),
        (.health, ["farmacia", "medico", "dentista", "fisio"]),
        (.home, ["luz", "agua", "alquiler", "ikea", "internet"]),
    ]

    public static func category(for merchant: String?) -> SpendingCategory {
        guard let merchant else { return .other }
        let words = Set(IntentParser.normalise(merchant).split(whereSeparator: { !$0.isLetter }).map(String.init))
        for (category, keywords) in rules where keywords.contains(where: words.contains) {
            return category
        }
        return .other
    }
}

public struct SpendingSummary: Equatable, Sendable {
    public let total: Decimal
    public let byCategory: [SpendingCategory: Decimal]
}

public enum SpendingReport {
    /// Totals for entries inside `[start, end)`.
    public static func summary(_ entries: [SpendingEntry], from start: Date, to end: Date) -> SpendingSummary {
        let inRange = entries.filter { $0.occurredAt >= start && $0.occurredAt < end }
        var byCategory: [SpendingCategory: Decimal] = [:]
        for entry in inRange {
            byCategory[entry.category, default: 0] += entry.amount
        }
        return SpendingSummary(total: inRange.reduce(0) { $0 + $1.amount }, byCategory: byCategory)
    }
}
