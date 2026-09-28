import Foundation

/// What Manu asked MANU to do, recognised without any AI model
/// (ADR-0009, base level). Unknown input is never guessed.
public enum ManuIntent: Equatable, Sendable {
    /// Possible risk to life: human help comes first, always.
    case crisis
    /// "Estoy de bajón": emotional support (Refugio), never a diagnosis.
    case lowMood
    case expense(amount: Decimal, merchant: String?)
    case captureIdea(String)
    case agenda(AgendaDay)
    case weather
    case unknown

    public enum AgendaDay: Equatable, Sendable {
        case today
        case tomorrow
    }
}

public enum IntentParser {
    private static let crisisPhrases = [
        "suicid", "quitarme la vida", "no quiero vivir", "matarme",
        "hacerme dano", "acabar con todo", "no quiero seguir viviendo",
    ]
    private static let lowMoodPhrases = [
        "de bajon", "estoy mal", "me siento mal", "estoy triste",
        "me siento fatal", "estoy fatal", "estoy hundido", "no tengo ganas de nada",
    ]
    private static let expenseTriggers = ["gaste", "he gastado", "pague", "he pagado", "gasto de", "registra un gasto"]
    private static let ideaPrefixes = ["idea:", "guarda una idea", "guarda la idea", "apunta", "anota", "nueva idea"]

    public static func parse(_ input: String) -> ManuIntent {
        let text = normalise(input)
        guard !text.isEmpty else { return .unknown }

        // Safety first: crisis detection runs before anything else.
        if crisisPhrases.contains(where: text.contains) { return .crisis }
        if lowMoodPhrases.contains(where: text.contains) { return .lowMood }

        if let prefix = ideaPrefixes.first(where: text.hasPrefix) {
            let idea = String(input.trimmingCharacters(in: .whitespacesAndNewlines).dropFirst(prefix.count))
                .trimmingCharacters(in: CharacterSet(charactersIn: " :,.-").union(.whitespacesAndNewlines))
            return idea.isEmpty ? .unknown : .captureIdea(idea)
        }

        if expenseTriggers.contains(where: text.contains), let amount = amount(in: text) {
            return .expense(amount: amount, merchant: merchant(in: text))
        }

        if text.contains("tiempo") && (text.contains("que tiempo") || text.contains("hace"))
            || text.contains("va a llover") || text.contains("llueve")
        {
            return .weather
        }

        if text.contains("manana") && (text.contains("que tengo") || text.contains("agenda")) {
            return .agenda(.tomorrow)
        }
        if text.contains("que tengo") || text.contains("agenda") || text.contains("mi dia") {
            return .agenda(.today)
        }
        return .unknown
    }

    /// Lower case, no accents, single spaces.
    static func normalise(_ input: String) -> String {
        input
            .folding(options: [.caseInsensitive, .diacriticInsensitive], locale: Locale(identifier: "es_ES"))
            .lowercased()
            .split(whereSeparator: \.isWhitespace)
            .joined(separator: " ")
    }

    /// First amount such as "12", "12,50", "12.50" or "12,50€".
    static func amount(in text: String) -> Decimal? {
        let pattern = #"(\d+(?:[.,]\d{1,2})?)\s*(?:€|eur|euros)?"#
        guard let range = text.range(of: pattern, options: .regularExpression) else { return nil }
        let number = String(text[range])
            .replacingOccurrences(of: ",", with: ".")
            .filter { $0.isNumber || $0 == "." }
        guard let value = Decimal(string: number, locale: Locale(identifier: "en_US_POSIX")), value > 0 else {
            return nil
        }
        return value
    }

    /// Words after "en" following the amount, e.g. "gasté 3 en café" → "cafe".
    static func merchant(in text: String) -> String? {
        guard let range = text.range(of: #"\d(?:[.,]\d{1,2})?\s*(?:€|eur|euros)?\s+en\s+(.+)$"#, options: .regularExpression) else {
            return nil
        }
        let tail = text[range]
        guard let en = tail.range(of: " en ") else { return nil }
        let value = tail[en.upperBound...].trimmingCharacters(in: CharacterSet(charactersIn: " .!"))
        return value.isEmpty ? nil : value
    }
}

/// Replies in MANU's tone: close, honest, short, no artificial positivity.
/// Deterministic: the same `variant` always gives the same text.
public enum ManuReplies {
    public static let crisis = """
    Esto es importante y no quiero que lo lleves solo. Si estás en peligro ahora mismo, llama al 112. \
    También puedes llamar al 024, la línea de atención a la conducta suicida: es gratuita, confidencial \
    y atiende las 24 horas. Si puedes, avisa también a alguien de confianza para que esté contigo. \
    Yo sigo aquí, pero no sustituyo a esa ayuda.
    """

    public static func reply(to intent: ManuIntent, variant: Int = 0) -> String {
        switch intent {
        case .crisis:
            return crisis
        case .lowMood:
            return pick([
                "Vaya. Cuéntame un poco: ¿quieres entender por qué estás así, buscar una solución o desconectar un rato?",
                "Estoy aquí. ¿Te apetece hablarlo, arreglar algo concreto o cambiar de aire?",
            ], variant)
        case let .expense(amount, merchant):
            let place = merchant.map { " en \($0)" } ?? ""
            return pick([
                "Anotado: \(format(amount)) €\(place). Lo dejo pendiente de que confirmes la categoría.",
                "Hecho, \(format(amount)) €\(place) apuntados. Luego revisas la categoría.",
            ], variant)
        case let .captureIdea(idea):
            return pick([
                "Guardada: «\(idea)». No la convierto en proyecto; la vemos cuando quieras.",
                "Apuntada: «\(idea)». Queda en la bandeja para clasificarla contigo.",
            ], variant)
        case .agenda(.today):
            return "Te enseño lo que tienes hoy."
        case .agenda(.tomorrow):
            return "Te enseño lo que tienes mañana."
        case .weather:
            return "Te enseño el tiempo."
        case .unknown:
            return pick([
                "No te he entendido del todo. Puedo guardar una idea, apuntar un gasto o enseñarte tu agenda.",
                "Eso todavía no lo sé hacer sin un modelo de IA. Prueba con «apunta…», «gasté…» o «qué tengo hoy».",
            ], variant)
        }
    }

    private static func pick(_ options: [String], _ variant: Int) -> String {
        options[abs(variant) % options.count]
    }

    static func format(_ amount: Decimal) -> String {
        var value = amount
        var rounded = Decimal()
        NSDecimalRound(&rounded, &value, 2, .plain)
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "es_ES")
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 2
        return formatter.string(from: rounded as NSDecimalNumber) ?? "\(rounded)"
    }
}
