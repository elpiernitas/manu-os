import Foundation
import Testing
import ManuOSCore

struct RefugeTests {
    @Test("Asks what Manu needs, then follows the chosen phase")
    func phases() {
        var session = RefugeSession()
        let first = session.reply(to: "no sé")
        #expect(session.phase == .choosing)
        #expect(first.contains("entender"))
        let understand = session.reply(to: "quiero entender por qué")
        #expect(session.phase == .understand)
        #expect(understand.hasSuffix("?"))
    }

    @Test("Change of air proposes Manu's own distractions without repeating")
    func changeOfAir() {
        var session = RefugeSession()
        let a = session.reply(to: "necesito desconectar")
        let b = session.reply(to: "otra")
        #expect(session.phase == .changeOfAir)
        #expect(a.contains("música"))
        #expect(a != b)
    }

    @Test("Crisis always switches to human help, whatever the phase")
    func crisisWins() {
        var session = RefugeSession()
        _ = session.reply(to: "buscar una solución")
        #expect(session.phase == .solve)
        let reply = session.reply(to: "no quiero vivir")
        #expect(session.phase == .humanHelp)
        #expect(reply.contains("112") && reply.contains("024"))
        let next = session.reply(to: "vale")
        #expect(next.contains("112"))
        #expect(session.phase == .humanHelp)
    }

    @Test("No reply ever contains a diagnosis word")
    func noDiagnosis() {
        var session = RefugeSession()
        let texts = ["entender", "sigo", "más", "otra cosa"].map { session.reply(to: $0) }
        for text in texts {
            #expect(!text.lowercased().contains("depresi"))
            #expect(!text.lowercased().contains("trastorno"))
        }
    }
}

struct RecurringTests {
    private func entry(_ id: String, _ merchant: String, _ amount: String, day: Double) -> SpendingEntry {
        SpendingEntry(
            id: id,
            amount: Decimal(string: amount)!,
            merchant: merchant,
            occurredAt: Date(timeIntervalSince1970: 1_780_000_000 + day * 86400)
        )
    }

    @Test("Monthly charges with stable amounts are detected")
    func detect() {
        let entries = [
            entry("1", "Netflix", "12.99", day: 0),
            entry("2", "Netflix", "12.99", day: 30),
            entry("3", "netflix", "13.49", day: 61),
            entry("4", "Cafe", "2.5", day: 1),
            entry("5", "Cafe", "2.5", day: 2),
            entry("6", "Cafe", "2.5", day: 3),
            entry("7", "Gym", "30", day: 0),
            entry("8", "Gym", "30", day: 30),
        ]
        let found = RecurringDetector.detect(entries)
        #expect(found.map(\.occurrences) == [3])
        #expect(found.first?.typicalAmount == Decimal(string: "13.49")!)
        let next = try? #require(found.first?.nextExpected)
        #expect(next.map { $0 > Date(timeIntervalSince1970: 1_780_000_000 + 61 * 86400) } == true)
    }

    @Test("Big amount changes are not treated as the same subscription")
    func unstableAmounts() {
        let entries = [
            entry("1", "Luz", "40", day: 0),
            entry("2", "Luz", "80", day: 30),
            entry("3", "Luz", "45", day: 60),
        ]
        #expect(RecurringDetector.detect(entries).isEmpty)
    }

    @Test("Upcoming charges within the window")
    func upcoming() {
        let entries = (0..<3).map { entry("\($0)", "Spotify", "11.99", day: Double($0) * 30) }
        let payments = RecurringDetector.detect(entries)
        let last = Date(timeIntervalSince1970: 1_780_000_000 + 60 * 86400)
        #expect(RecurringDetector.upcoming(payments, from: last.addingTimeInterval(28 * 86400)).count == 1)
        #expect(RecurringDetector.upcoming(payments, from: last.addingTimeInterval(10 * 86400)).isEmpty)
    }
}
