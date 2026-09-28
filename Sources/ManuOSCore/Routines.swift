import Foundation

// MARK: - Night routine (docs/product/EXPERIENCE.md, "Noche")

public enum City: String, Codable, CaseIterable, Sendable {
    case gijon = "GIJON"
    case oviedo = "OVIEDO"

    public var title: String {
        switch self {
        case .gijon: "Gijón"
        case .oviedo: "Oviedo"
        }
    }
}

public struct PlannedEvent: Codable, Equatable, Sendable {
    public let title: String
    public let start: Date
    public let location: String?

    public init(title: String, start: Date, location: String? = nil) {
        self.title = title
        self.start = start
        self.location = location
    }
}

/// Every duration is a setting Manu can change. Defaults are placeholders,
/// not measured values (travel time Gijón–Oviedo is `NO_VERIFICADO`).
public struct MorningSettings: Codable, Equatable, Sendable {
    public var getReady: TimeInterval
    public var breakfast: TimeInterval
    public var travelToOviedo: TimeInterval
    public var arriveEarly: TimeInterval
    /// Used when there is no event tomorrow.
    public var defaultWake: DayTime
    /// Never propose an alarm earlier than this.
    public var earliestWake: DayTime

    public init(
        getReady: TimeInterval = 30 * 60,
        breakfast: TimeInterval = 20 * 60,
        travelToOviedo: TimeInterval = 40 * 60,
        arriveEarly: TimeInterval = 10 * 60,
        defaultWake: DayTime = DayTime(hour: 8),
        earliestWake: DayTime = DayTime(hour: 6)
    ) {
        self.getReady = getReady
        self.breakfast = breakfast
        self.travelToOviedo = travelToOviedo
        self.arriveEarly = arriveEarly
        self.defaultWake = defaultWake
        self.earliestWake = earliestWake
    }
}

public struct CityGuess: Equatable, Sendable {
    public let city: City
    public let reason: String
    /// MANU must still ask; a guess never decides by itself.
    public let needsConfirmation: Bool
}

public struct AlarmProposal: Equatable, Sendable {
    public let time: Date
    public let explanation: String
    /// Always true: the alarm is only set after Manu confirms it.
    public let requiresConfirmation: Bool
}

public enum NightPlanner {
    /// Guesses tomorrow's city from event locations. Home is Gijón.
    public static func guessCity(events: [PlannedEvent]) -> CityGuess {
        let oviedo = events.filter { IntentParser.normalise($0.location ?? "").contains("oviedo") }
        if let first = oviedo.min(by: { $0.start < $1.start }) {
            return CityGuess(city: .oviedo, reason: "«\(first.title)» es en Oviedo", needsConfirmation: true)
        }
        return CityGuess(city: .gijon, reason: "No veo nada en Oviedo mañana", needsConfirmation: true)
    }

    /// Proposes an alarm for the day of `day`, working back from the first event.
    public static func proposeAlarm(
        day: Date,
        events: [PlannedEvent],
        city: City,
        wantsBreakfast: Bool,
        settings: MorningSettings = MorningSettings(),
        timeZone: TimeZone
    ) -> AlarmProposal {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let startOfDay = calendar.startOfDay(for: day)
        let earliest = startOfDay.addingTimeInterval(TimeInterval(settings.earliestWake.minutes * 60))
        let todays = events.filter { calendar.isDate($0.start, inSameDayAs: day) }

        guard let first = todays.min(by: { $0.start < $1.start }) else {
            let wake = startOfDay.addingTimeInterval(TimeInterval(settings.defaultWake.minutes * 60))
            return AlarmProposal(
                time: max(wake, earliest),
                explanation: "No tienes nada temprano: te propongo tu hora habitual.",
                requiresConfirmation: true
            )
        }

        var needed = settings.getReady + settings.arriveEarly
        var parts = ["prepararte"]
        if wantsBreakfast {
            needed += settings.breakfast
            parts.append("desayunar")
        }
        if city == .oviedo {
            needed += settings.travelToOviedo
            parts.append("ir a Oviedo")
        }
        let proposed = first.start.addingTimeInterval(-needed)
        let clamped = max(proposed, earliest)
        let explanation = "Tu primera cita es «\(first.title)». Cuento tiempo para " + parts.joined(separator: ", ")
            + (clamped > proposed ? ". No te pongo la alarma antes de lo que tienes configurado." : ".")
        return AlarmProposal(time: clamped, explanation: explanation, requiresConfirmation: true)
    }
}

// MARK: - Work disconnection at 13:00

public enum TaskUrgency: Int, Codable, Comparable, Sendable {
    case low = 0
    case normal = 1
    case high = 2

    public static func < (lhs: Self, rhs: Self) -> Bool { lhs.rawValue < rhs.rawValue }
}

public struct WorkTask: Codable, Equatable, Identifiable, Sendable {
    public let id: String
    public let title: String
    public let urgency: TaskUrgency
    public let due: Date?
    public let done: Bool

    public init(id: String, title: String, urgency: TaskUrgency, due: Date? = nil, done: Bool = false) {
        self.id = id
        self.title = title
        self.urgency = urgency
        self.due = due
        self.done = done
    }
}

public struct RescheduleProposal: Equatable, Sendable {
    public let taskID: String
    public let proposedDay: Date
    public let reason: String
}

public enum WorkDisconnection {
    /// Proposes a new day for each unfinished task. Nothing is moved until
    /// Manu accepts; urgent or overdue work goes to the next working day.
    public static func proposals(
        for tasks: [WorkTask],
        at now: Date,
        schedule: ModeSchedule = .manuDefault,
        timeZone: TimeZone
    ) -> [RescheduleProposal] {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let today = calendar.startOfDay(for: now)

        func workDay(after start: Date, skipping extra: Int) -> Date {
            var day = start
            var remaining = extra + 1
            while remaining > 0 {
                day = calendar.date(byAdding: .day, value: 1, to: day)!
                let weekday = calendar.component(.weekday, from: day)
                if schedule.workDays.contains((weekday + 5) % 7 + 1) { remaining -= 1 }
            }
            return day
        }

        return tasks
            .filter { !$0.done }
            .sorted { ($0.urgency, $1.id) > ($1.urgency, $0.id) }
            .map { task in
                let overdue = task.due.map { $0 <= now } ?? false
                if task.urgency == .high || overdue {
                    return RescheduleProposal(
                        taskID: task.id,
                        proposedDay: workDay(after: today, skipping: 0),
                        reason: overdue ? "Ya está vencida" : "Es urgente"
                    )
                }
                let skip = task.urgency == .low ? 2 : 0
                return RescheduleProposal(
                    taskID: task.id,
                    proposedDay: workDay(after: today, skipping: skip),
                    reason: task.urgency == .low ? "Puede esperar un par de días" : "Siguiente día de trabajo"
                )
            }
    }
}

// MARK: - Projects and ideas

public struct ProjectStatus: Codable, Equatable, Sendable {
    public let name: String
    public let whyStarted: String?
    public let lastActivity: Date
    public let active: Bool

    public init(name: String, whyStarted: String?, lastActivity: Date, active: Bool) {
        self.name = name
        self.whyStarted = whyStarted
        self.lastActivity = lastActivity
        self.active = active
    }
}

public struct ProjectNudge: Equatable, Sendable {
    public let project: String
    public let message: String
}

public enum ProjectCoach {
    /// For active projects idle longer than `idleDays`: ask if Manu is still
    /// interested, remind why it started and propose a very small step.
    public static func nudges(for projects: [ProjectStatus], at now: Date, idleDays: Int = 14) -> [ProjectNudge] {
        projects
            .filter { $0.active && now.timeIntervalSince($0.lastActivity) >= Double(idleDays) * 86400 }
            .sorted { $0.lastActivity < $1.lastActivity }
            .map { project in
                let days = Int(now.timeIntervalSince(project.lastActivity) / 86400)
                var message = "«\(project.name)» lleva \(days) días parado. ¿Sigues con ganas?"
                if let why = project.whyStarted, !why.isEmpty {
                    message += " Lo empezaste porque: \(why)."
                }
                message += " Si te apetece, un paso de 10 minutos basta."
                return ProjectNudge(project: project.name, message: message)
            }
    }

    /// Honest view of the current load before adding a new idea.
    public static func loadWarning(activeProjects: Int, comfortableMaximum: Int = 3) -> String? {
        guard activeProjects >= comfortableMaximum else { return nil }
        return "Ya tienes \(activeProjects) proyectos activos. Guardo la idea sin activarla; decides tú cuándo."
    }
}

// MARK: - Morning briefing

public struct BriefingInput: Equatable, Sendable {
    public var events: [String]
    public var weather: String?
    public var workTasks: [String]
    public var messagesToAnswer: [String]
    public var campaigns: [String]
    public var files: [String]
    public var batteries: [String]

    public init(
        events: [String] = [],
        weather: String? = nil,
        workTasks: [String] = [],
        messagesToAnswer: [String] = [],
        campaigns: [String] = [],
        files: [String] = [],
        batteries: [String] = []
    ) {
        self.events = events
        self.weather = weather
        self.workTasks = workTasks
        self.messagesToAnswer = messagesToAnswer
        self.campaigns = campaigns
        self.files = files
        self.batteries = batteries
    }
}

public struct BriefingSection: Equatable, Sendable {
    public let title: String
    public let lines: [String]
}

public enum Briefing {
    /// Sections in Manu's order; empty ones are left out. Work sections only
    /// appear on days when work content is visible in the morning.
    public static func compose(_ input: BriefingInput, isWorkDay: Bool) -> [BriefingSection] {
        var sections: [BriefingSection] = []
        func add(_ title: String, _ lines: [String]) {
            let clean = lines.map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
            if !clean.isEmpty { sections.append(BriefingSection(title: title, lines: clean)) }
        }
        add("Hoy", input.events)
        add("Tiempo", input.weather.map { [$0] } ?? [])
        if isWorkDay {
            add("Trabajo", input.workTasks)
            add("Campañas y publicaciones", input.campaigns)
        }
        add("Mensajes por responder", input.messagesToAnswer)
        add("Archivos que vas a necesitar", input.files)
        add("Baterías", input.batteries)
        return sections
    }
}
