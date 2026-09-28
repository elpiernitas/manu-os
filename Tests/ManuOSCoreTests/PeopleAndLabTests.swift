import Foundation
import Testing
import ManuOSCore

private let madrid = TimeZone(identifier: "Europe/Madrid")!

private func at(_ iso: String) -> Date {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime]
    return formatter.date(from: iso)!
}

struct PeopleRadarTests {
    let now = at("2026-09-28T20:00:00+02:00")

    @Test("Upcoming birthdays, closest first, with a saved gift idea")
    func birthdays() {
        let people = [
            PersonProfile(id: "b", name: "Persona B", birthday: MonthDay(month: 10, day: 2)),
            PersonProfile(id: "a", name: "Persona A", birthday: MonthDay(month: 9, day: 28), giftIdeas: ["un libro"]),
            PersonProfile(id: "c", name: "Persona C", birthday: MonthDay(month: 12, day: 25)),
            PersonProfile(id: "d", name: "Persona D"),
        ]
        let reminders = PeopleRadar.upcomingBirthdays(people, from: now, timeZone: madrid)
        #expect(reminders.map(\.personID) == ["a", "b"])
        #expect(reminders[0].message.contains("hoy"))
        #expect(reminders[0].message.contains("un libro"))
        #expect(reminders[1].message.contains("en 4 días"))
    }

    @Test("Birthdays roll over into next year")
    func rollover() {
        let people = [PersonProfile(id: "x", name: "X", birthday: MonthDay(month: 1, day: 2))]
        let reminders = PeopleRadar.upcomingBirthdays(people, from: at("2026-12-30T10:00:00+01:00"), timeZone: madrid)
        #expect(reminders.first?.message.contains("en 3 días") == true)
    }

    @Test("Invalid month-day values are rejected")
    func invalidMonthDay() {
        #expect(MonthDay(month: 13, day: 1) == nil)
        #expect(MonthDay(month: 2, day: 0) == nil)
    }

    @Test("Only important people unseen for a while, based on known contact")
    func longTimeNoTalk() {
        let people = [
            PersonProfile(id: "1", name: "Uno", lastContact: now.addingTimeInterval(-40 * 86400), isImportant: true),
            PersonProfile(id: "2", name: "Dos", lastContact: now.addingTimeInterval(-40 * 86400), isImportant: false),
            PersonProfile(id: "3", name: "Tres", lastContact: now.addingTimeInterval(-5 * 86400), isImportant: true),
            PersonProfile(id: "4", name: "Cuatro", lastContact: nil, isImportant: true),
        ]
        let reminders = PeopleRadar.longTimeNoTalk(people, at: now)
        #expect(reminders.map(\.personID) == ["1"])
        #expect(reminders[0].message.contains("según lo que sé"))
    }
}

struct LabTests {
    @Test("Reports list open entries and are never approved by default")
    func report() {
        var fixed = LabEntry(id: "2", kind: .bug, text: "Arreglado", appVersion: "0.1", screen: nil, createdAt: .now)
        fixed.advance(to: .resolved)
        let open = LabEntry(id: "1", kind: .bug, text: "El chat no baja", appVersion: "0.1", screen: "MANU", createdAt: .now)
        var report = LabReporter.report([open, fixed])
        #expect(report.markdown.contains("Entradas abiertas: 1"))
        #expect(report.markdown.contains("El chat no baja"))
        #expect(!report.markdown.contains("Arreglado"))
        #expect(!report.approvedForSending)
        report.approve()
        #expect(report.approvedForSending)
    }
}

struct WalkProgressTests {
    @Test("Streak counts consecutive days and allows today to be pending")
    func streak() {
        let sessions = [
            WalkSession(start: at("2026-09-27T18:00:00+02:00"), minutes: 20),
            WalkSession(start: at("2026-09-26T18:00:00+02:00"), minutes: 30),
            WalkSession(start: at("2026-09-24T18:00:00+02:00"), minutes: 30),
            WalkSession(start: at("2026-09-25T18:00:00+02:00"), minutes: 0),
        ]
        #expect(WalkProgress.streak(sessions, at: at("2026-09-28T09:00:00+02:00"), timeZone: madrid) == 2)
        #expect(WalkProgress.streak(sessions, at: at("2026-09-30T09:00:00+02:00"), timeZone: madrid) == 0)
    }

    @Test("Weekly minutes use ISO weeks")
    func week() {
        let sessions = [
            WalkSession(start: at("2026-09-28T18:00:00+02:00"), minutes: 25),
            WalkSession(start: at("2026-09-27T18:00:00+02:00"), minutes: 30),
            WalkSession(start: at("2026-09-29T08:00:00+02:00"), minutes: -5),
        ]
        #expect(WalkProgress.minutesThisWeek(sessions, at: at("2026-09-30T12:00:00+02:00"), timeZone: madrid) == 25)
    }
}
