import Foundation
import Testing
import ManuOSCore

struct AppSessionTests {
    @Test("An idea from the chat lands in the inbox as pending")
    func ideaGoesToInbox() {
        var session = AppSession()
        session.handle("apunta llamar al taller")
        #expect(session.inbox.pending.count == 1)
        #expect(session.inbox.pending.first?.text == "llamar al taller")
        #expect(session.transcript.messages.count == 2)
    }

    @Test("An expense from the chat is recorded with an inferred category")
    func expenseRecorded() {
        var session = AppSession()
        session.handle("gasté 3,20 en café")
        #expect(session.spending.count == 1)
        #expect(session.spending[0].amount == Decimal(string: "3.2")!)
        #expect(session.spending[0].category == .foodAndDrink)
        #expect(session.spending[0].categoryInferred)
    }

    @Test("Other intents do not create records")
    func otherIntents() {
        var session = AppSession()
        session.handle("qué tengo hoy")
        session.handle("estoy de bajón")
        session.handle("   ")
        #expect(session.inbox.captures.isEmpty)
        #expect(session.spending.isEmpty)
        #expect(session.transcript.messages.count == 4)
    }

    @Test("Confirming and correcting go through explicit actions")
    func confirmAndCorrect() throws {
        var session = AppSession()
        session.handle("idea: web para el curso")
        session.handle("gasté 10 en tienda rara")
        let captureID = try #require(session.inbox.pending.first?.id)
        try session.confirmCapture(id: captureID, tags: ["Idea"])
        #expect(session.inbox.pending.isEmpty)
        let entryID = session.spending[0].id
        session.correctCategory(entryID: entryID, to: .leisure)
        #expect(session.spending[0].category == .leisure)
        #expect(!session.spending[0].categoryInferred)
        session.correctCategory(entryID: "missing", to: .home)
        #expect(session.spending.count == 1)
    }

    @Test("Euros use Spanish formatting")
    func euros() {
        #expect(SpendingReport.euros(Decimal(string: "12.5")!) == "12,50 €")
        #expect(SpendingReport.euros(Decimal(string: "1234.5")!).hasSuffix("234,50 €"))
    }

    @Test("Generated IDs are unique across kinds")
    func uniqueIDs() {
        var session = AppSession()
        session.handle("apunta a")
        session.handle("gasté 1 en bar")
        session.handle("apunta b")
        let ids = session.inbox.captures.map(\.id) + session.spending.map(\.id)
        #expect(Set(ids).count == 3)
    }
}
