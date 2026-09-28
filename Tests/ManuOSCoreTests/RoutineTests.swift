import Foundation
import Testing
import ManuOSCore

private let madrid = TimeZone(identifier: "Europe/Madrid")!

private func at(_ iso: String) -> Date {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime]
    return formatter.date(from: iso)!
}

struct NightPlannerTests {
    @Test("Oviedo is guessed from an event location, but still needs confirmation")
    func guessOviedo() {
        let events = [
            PlannedEvent(title: "Reunión", start: at("2026-09-29T11:00:00+02:00"), location: "Calle Uría, OVIEDO"),
            PlannedEvent(title: "Café", start: at("2026-09-29T17:00:00+02:00"), location: "Gijón"),
        ]
        let guess = NightPlanner.guessCity(events: events)
        #expect(guess.city == .oviedo)
        #expect(guess.needsConfirmation)
        #expect(guess.reason.contains("Reunión"))
    }

    @Test("Without Oviedo events the guess is Gijón")
    func guessGijon() {
        #expect(NightPlanner.guessCity(events: []).city == .gijon)
    }

    @Test("Alarm works back from the first event with breakfast and travel")
    func alarmOviedoWithBreakfast() {
        let events = [
            PlannedEvent(title: "Tarde", start: at("2026-09-29T16:00:00+02:00")),
            PlannedEvent(title: "Cliente", start: at("2026-09-29T10:00:00+02:00"), location: "Oviedo"),
        ]
        let proposal = NightPlanner.proposeAlarm(
            day: at("2026-09-29T00:30:00+02:00"),
            events: events,
            city: .oviedo,
            wantsBreakfast: true,
            timeZone: madrid
        )
        // 10:00 − (30 get ready + 10 early + 20 breakfast + 40 travel) = 08:20
        #expect(proposal.time == at("2026-09-29T08:20:00+02:00"))
        #expect(proposal.requiresConfirmation)
        #expect(proposal.explanation.contains("desayunar"))
        #expect(proposal.explanation.contains("Oviedo"))
    }

    @Test("Gijón without breakfast needs less time")
    func alarmGijon() {
        let events = [PlannedEvent(title: "Trabajo", start: at("2026-09-29T09:00:00+02:00"))]
        let proposal = NightPlanner.proposeAlarm(
            day: at("2026-09-29T12:00:00+02:00"), events: events, city: .gijon, wantsBreakfast: false, timeZone: madrid
        )
        #expect(proposal.time == at("2026-09-29T08:20:00+02:00"))
    }

    @Test("The alarm is never earlier than the configured limit")
    func earliestLimit() {
        let events = [PlannedEvent(title: "Vuelo", start: at("2026-09-29T06:30:00+02:00"))]
        let proposal = NightPlanner.proposeAlarm(
            day: at("2026-09-29T12:00:00+02:00"), events: events, city: .oviedo, wantsBreakfast: true, timeZone: madrid
        )
        #expect(proposal.time == at("2026-09-29T06:00:00+02:00"))
        #expect(proposal.explanation.contains("configurado"))
    }

    @Test("No events means the usual wake time")
    func noEvents() {
        let proposal = NightPlanner.proposeAlarm(
            day: at("2026-09-29T12:00:00+02:00"),
            events: [PlannedEvent(title: "Otro día", start: at("2026-09-30T09:00:00+02:00"))],
            city: .gijon,
            wantsBreakfast: true,
            timeZone: madrid
        )
        #expect(proposal.time == at("2026-09-29T08:00:00+02:00"))
    }
}

struct WorkDisconnectionTests {
    // 2026-10-02 is a Friday.
    let friday1pm = at("2026-10-02T13:00:00+02:00")

    @Test("Unfinished tasks get proposals on working days, done tasks are ignored")
    func proposals() {
        let tasks = [
            WorkTask(id: "low", title: "Ordenar Drive", urgency: .low),
            WorkTask(id: "high", title: "Enviar campaña", urgency: .high),
            WorkTask(id: "done", title: "Hecho", urgency: .high, done: true),
            WorkTask(id: "late", title: "Factura", urgency: .normal, due: at("2026-10-01T18:00:00+02:00")),
            WorkTask(id: "normal", title: "Revisar", urgency: .normal),
        ]
        let result = WorkDisconnection.proposals(for: tasks, at: friday1pm, timeZone: madrid)
        #expect(result.map(\.taskID) == ["high", "late", "normal", "low"])
        let monday = at("2026-10-05T00:00:00+02:00")
        #expect(result[0].proposedDay == monday)
        #expect(result[1].reason == "Ya está vencida")
        #expect(result[1].proposedDay == monday)
        #expect(result[2].proposedDay == monday)
        // Low urgency skips two working days: Wednesday.
        #expect(result[3].proposedDay == at("2026-10-07T00:00:00+02:00"))
    }
}

struct ProjectCoachTests {
    let now = at("2026-09-28T20:00:00+02:00")

    @Test("Idle active projects get a small, honest nudge")
    func nudges() {
        let projects = [
            ProjectStatus(name: "Web", whyStarted: "quería vender online", lastActivity: now.addingTimeInterval(-20 * 86400), active: true),
            ProjectStatus(name: "Curso", whyStarted: nil, lastActivity: now.addingTimeInterval(-3 * 86400), active: true),
            ProjectStatus(name: "Viejo", whyStarted: nil, lastActivity: now.addingTimeInterval(-90 * 86400), active: false),
        ]
        let result = ProjectCoach.nudges(for: projects, at: now)
        #expect(result.map(\.project) == ["Web"])
        #expect(result[0].message.contains("20 días"))
        #expect(result[0].message.contains("quería vender online"))
    }

    @Test("Load warning only when there are already enough projects")
    func load() {
        #expect(ProjectCoach.loadWarning(activeProjects: 2) == nil)
        #expect(ProjectCoach.loadWarning(activeProjects: 3)?.contains("sin activarla") == true)
    }
}

struct BriefingTests {
    @Test("Empty sections are skipped and work only shows on work days")
    func compose() {
        let input = BriefingInput(
            events: ["10:00 Reunión", " "],
            weather: "Lluvia por la tarde",
            workTasks: ["Enviar campaña"],
            campaigns: ["Reel viernes"],
            batteries: ["iPhone 20 %"]
        )
        let workDay = Briefing.compose(input, isWorkDay: true)
        #expect(workDay.map(\.title) == ["Hoy", "Tiempo", "Trabajo", "Campañas y publicaciones", "Baterías"])
        #expect(workDay[0].lines == ["10:00 Reunión"])
        let weekend = Briefing.compose(input, isWorkDay: false)
        #expect(!weekend.map(\.title).contains("Trabajo"))
        #expect(Briefing.compose(BriefingInput(), isWorkDay: true).isEmpty)
    }
}
