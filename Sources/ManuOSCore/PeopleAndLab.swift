import Foundation

// MARK: - People (docs/product/EXPERIENCE.md, "Personas y WhatsApp")

public struct PersonProfile: Codable, Equatable, Identifiable, Sendable {
    public let id: String
    public let name: String
    /// Month and day only; the year is often unknown.
    public let birthday: MonthDay?
    public let lastContact: Date?
    public let isImportant: Bool
    public let giftIdeas: [String]

    public init(id: String, name: String, birthday: MonthDay? = nil, lastContact: Date? = nil, isImportant: Bool = false, giftIdeas: [String] = []) {
        self.id = id
        self.name = name
        self.birthday = birthday
        self.lastContact = lastContact
        self.isImportant = isImportant
        self.giftIdeas = giftIdeas
    }
}

public struct MonthDay: Codable, Equatable, Hashable, Sendable {
    public let month: Int
    public let day: Int

    public init?(month: Int, day: Int) {
        guard (1...12).contains(month), (1...31).contains(day) else { return nil }
        self.month = month
        self.day = day
    }
}

public struct PeopleReminder: Equatable, Sendable {
    public let personID: String
    public let message: String
}

public enum PeopleRadar {
    /// Birthdays within `daysAhead` (today included), sorted by closeness.
    public static func upcomingBirthdays(
        _ people: [PersonProfile],
        from now: Date,
        daysAhead: Int = 7,
        timeZone: TimeZone
    ) -> [PeopleReminder] {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let today = calendar.startOfDay(for: now)
        let year = calendar.component(.year, from: today)

        return people.compactMap { person -> (Int, PeopleReminder)? in
            guard let birthday = person.birthday else { return nil }
            let candidates = [year, year + 1].compactMap {
                calendar.date(from: DateComponents(year: $0, month: birthday.month, day: birthday.day))
            }
            // Skip dates the calendar normalised (29 February in a non-leap year).
            guard let next = candidates.first(where: {
                $0 >= today && calendar.component(.day, from: $0) == birthday.day
            }) else { return nil }
            let days = calendar.dateComponents([.day], from: today, to: next).day ?? 0
            guard days <= daysAhead else { return nil }
            let when = days == 0 ? "hoy" : days == 1 ? "mañana" : "en \(days) días"
            var message = "El cumpleaños de \(person.name) es \(when)."
            if let idea = person.giftIdeas.first { message += " Tenías apuntado: \(idea)." }
            return (days, PeopleReminder(personID: person.id, message: message))
        }
        .sorted { ($0.0, $0.1.personID) < ($1.0, $1.1.personID) }
        .map(\.1)
    }

    /// Important people Manu has not talked to for a while, based only on
    /// what MANU knows (no automatic reading of WhatsApp or Messages).
    public static func longTimeNoTalk(_ people: [PersonProfile], at now: Date, days: Int = 30) -> [PeopleReminder] {
        people
            .filter { $0.isImportant }
            .compactMap { person -> PeopleReminder? in
                guard let last = person.lastContact else { return nil }
                let elapsed = Int(now.timeIntervalSince(last) / 86400)
                guard elapsed >= days else { return nil }
                return PeopleReminder(
                    personID: person.id,
                    message: "Hace unos \(elapsed) días que no hablas con \(person.name), según lo que sé. ¿Le escribes?"
                )
            }
    }
}

// MARK: - Laboratorio

public enum LabKind: String, Codable, Sendable {
    case bug = "BUG"
    case improvement = "IMPROVEMENT"
    case idea = "IDEA"
}

public enum LabStatus: String, Codable, CaseIterable, Sendable {
    case pending = "PENDING"
    case fixing = "FIXING"
    case readyToTest = "READY_TO_TEST"
    case resolved = "RESOLVED"

    public var title: String {
        switch self {
        case .pending: "Pendiente"
        case .fixing: "Arreglando"
        case .readyToTest: "Listo para probar"
        case .resolved: "Resuelto"
        }
    }
}

public struct LabEntry: Codable, Equatable, Identifiable, Sendable {
    public let id: String
    public let kind: LabKind
    public let text: String
    public let appVersion: String
    public let screen: String?
    public let createdAt: Date
    public private(set) var status: LabStatus

    public init(id: String, kind: LabKind, text: String, appVersion: String, screen: String?, createdAt: Date) {
        self.id = id
        self.kind = kind
        self.text = text
        self.appVersion = appVersion
        self.screen = screen
        self.createdAt = createdAt
        status = .pending
    }

    public mutating func advance(to status: LabStatus) {
        self.status = status
    }
}

/// A report prepared for Manu to review. It is never sent automatically:
/// `approvedForSending` starts false and only Manu can flip it.
public struct LabReport: Equatable, Sendable {
    public let markdown: String
    public private(set) var approvedForSending: Bool

    init(markdown: String) {
        self.markdown = markdown
        approvedForSending = false
    }

    public mutating func approve() {
        approvedForSending = true
    }
}

public enum LabReporter {
    public static func report(_ entries: [LabEntry]) -> LabReport {
        let open = entries.filter { $0.status != .resolved }.sorted { $0.createdAt < $1.createdAt }
        var lines = ["# Laboratorio de MANU OS", "", "Entradas abiertas: \(open.count)", ""]
        for entry in open {
            let screen = entry.screen.map { " · pantalla \($0)" } ?? ""
            lines.append("- [\(entry.kind.rawValue)] \(entry.text) (v\(entry.appVersion)\(screen) · \(entry.status.title))")
        }
        return LabReport(markdown: lines.joined(separator: "\n"))
    }
}

// MARK: - UREVO walking pad

public struct WalkSession: Codable, Equatable, Sendable {
    public let start: Date
    public let minutes: Int

    public init(start: Date, minutes: Int) {
        self.start = start
        self.minutes = max(0, minutes)
    }
}

public enum WalkProgress {
    /// Consecutive days with at least one session, ending today or yesterday.
    /// Recognises consistency without pressure: a missed day just resets it.
    public static func streak(_ sessions: [WalkSession], at now: Date, timeZone: TimeZone) -> Int {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let days = Set(sessions.filter { $0.minutes > 0 }.map { calendar.startOfDay(for: $0.start) })
        var cursor = calendar.startOfDay(for: now)
        if !days.contains(cursor) {
            cursor = calendar.date(byAdding: .day, value: -1, to: cursor)!
        }
        var count = 0
        while days.contains(cursor) {
            count += 1
            cursor = calendar.date(byAdding: .day, value: -1, to: cursor)!
        }
        return count
    }

    public static func minutesThisWeek(_ sessions: [WalkSession], at now: Date, timeZone: TimeZone) -> Int {
        var calendar = Calendar(identifier: .iso8601)
        calendar.timeZone = timeZone
        guard let week = calendar.dateInterval(of: .weekOfYear, for: now) else { return 0 }
        return sessions.filter { week.contains($0.start) }.reduce(0) { $0 + $1.minutes }
    }
}
