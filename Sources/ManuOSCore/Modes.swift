import Foundation

/// Moments of Manu's day (docs/product/EXPERIENCE.md, "Rutinas del día").
/// A mode changes content and behaviour, never colours or backgrounds.
public enum Mode: String, Codable, CaseIterable, Sendable {
    case night = "NIGHT"
    case morning = "MORNING"
    case work = "WORK"
    case afternoon = "AFTERNOON"
    case weekend = "WEEKEND"

    public var title: String {
        switch self {
        case .night: "Noche"
        case .morning: "Mañana"
        case .work: "Trabajo"
        case .afternoon: "Tarde"
        case .weekend: "Fin de semana"
        }
    }
}

/// Minutes since local midnight, e.g. 9:00 → 540.
public struct DayTime: Codable, Comparable, Hashable, Sendable {
    public let minutes: Int

    public init(hour: Int, minute: Int = 0) {
        precondition((0..<24).contains(hour) && (0..<60).contains(minute), "Invalid time")
        minutes = hour * 60 + minute
    }

    public static func < (lhs: DayTime, rhs: DayTime) -> Bool { lhs.minutes < rhs.minutes }
}

/// Deterministic, explainable schedule. Defaults follow Manu's routine:
/// work Monday to Friday 09:00–13:00, work disconnection from 13:00.
public struct ModeSchedule: Codable, Equatable, Sendable {
    public var nightStart: DayTime
    public var morningStart: DayTime
    public var workStart: DayTime
    public var workEnd: DayTime
    /// ISO weekday numbers (1 = Monday … 7 = Sunday).
    public var workDays: Set<Int>

    public init(
        nightStart: DayTime = DayTime(hour: 22),
        morningStart: DayTime = DayTime(hour: 7),
        workStart: DayTime = DayTime(hour: 9),
        workEnd: DayTime = DayTime(hour: 13),
        workDays: Set<Int> = [1, 2, 3, 4, 5]
    ) {
        self.nightStart = nightStart
        self.morningStart = morningStart
        self.workStart = workStart
        self.workEnd = workEnd
        self.workDays = workDays
    }

    public static let manuDefault = ModeSchedule()
}

/// Manual choice that wins over the schedule until it expires.
public struct ModeOverride: Codable, Equatable, Sendable {
    public let mode: Mode
    public let until: Date

    public init(mode: Mode, until: Date) {
        self.mode = mode
        self.until = until
    }
}

public struct ModeState: Equatable, Sendable {
    public let mode: Mode
    /// Work content (tasks, work contacts, campaigns) is visible.
    public let showsWorkContent: Bool
    /// Human-readable reason, so the choice is always explainable.
    public let reason: String

    public init(mode: Mode, showsWorkContent: Bool, reason: String) {
        self.mode = mode
        self.showsWorkContent = showsWorkContent
        self.reason = reason
    }
}

public struct ModeEngine: Sendable {
    public let schedule: ModeSchedule
    public let timeZone: TimeZone

    public init(schedule: ModeSchedule = .manuDefault, timeZone: TimeZone) {
        self.schedule = schedule
        self.timeZone = timeZone
    }

    public func state(at date: Date, override: ModeOverride? = nil) -> ModeState {
        if let override, date < override.until {
            return ModeState(
                mode: override.mode,
                showsWorkContent: override.mode == .work,
                reason: "Elegido manualmente hasta \(format(override.until))"
            )
        }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let parts = calendar.dateComponents([.hour, .minute, .weekday], from: date)
        let now = DayTime(hour: parts.hour ?? 0, minute: parts.minute ?? 0)
        // Calendar weekday: 1 = Sunday … 7 = Saturday. Convert to ISO.
        let isoWeekday = ((parts.weekday ?? 1) + 5) % 7 + 1
        let isWorkDay = schedule.workDays.contains(isoWeekday)

        if now >= schedule.nightStart || now < schedule.morningStart {
            return ModeState(mode: .night, showsWorkContent: false, reason: "Horario de noche")
        }
        guard isWorkDay else {
            return ModeState(mode: .weekend, showsWorkContent: false, reason: "Día sin trabajo")
        }
        if now < schedule.workStart {
            return ModeState(mode: .morning, showsWorkContent: false, reason: "Antes del trabajo")
        }
        if now < schedule.workEnd {
            return ModeState(mode: .work, showsWorkContent: true, reason: "Horario de trabajo")
        }
        return ModeState(
            mode: .afternoon,
            showsWorkContent: false,
            reason: "Desconexión laboral desde las \(format(schedule.workEnd))"
        )
    }

    private func format(_ time: DayTime) -> String {
        String(format: "%02d:%02d", time.minutes / 60, time.minutes % 60)
    }

    private func format(_ date: Date) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let parts = calendar.dateComponents([.hour, .minute], from: date)
        return String(format: "%02d:%02d", parts.hour ?? 0, parts.minute ?? 0)
    }
}
