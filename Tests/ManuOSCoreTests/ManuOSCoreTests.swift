import Foundation
import Testing
import ManuOSCore

/// All fixtures are synthetic.
private let madrid = TimeZone(identifier: "Europe/Madrid")!

private func date(_ iso: String) -> Date {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime]
    return formatter.date(from: iso)!
}

struct ModeEngineTests {
    let engine = ModeEngine(timeZone: madrid)

    // 2026-09-28 is a Monday; 2026-10-03 is a Saturday. Times are Madrid (+02:00).
    @Test(
        "Weekday schedule follows Manu's routine",
        arguments: [
            ("2026-09-28T06:30:00+02:00", Mode.night, false),
            ("2026-09-28T07:00:00+02:00", Mode.morning, false),
            ("2026-09-28T08:59:00+02:00", Mode.morning, false),
            ("2026-09-28T09:00:00+02:00", Mode.work, true),
            ("2026-09-28T12:59:00+02:00", Mode.work, true),
            ("2026-09-28T13:00:00+02:00", Mode.afternoon, false),
            ("2026-09-28T21:59:00+02:00", Mode.afternoon, false),
            ("2026-09-28T22:00:00+02:00", Mode.night, false),
        ]
    )
    func weekday(iso: String, expected: Mode, showsWork: Bool) {
        let state = engine.state(at: date(iso))
        #expect(state.mode == expected)
        #expect(state.showsWorkContent == showsWork)
        #expect(!state.reason.isEmpty)
    }

    @Test("Work disconnection at 13:00 hides work content and explains why")
    func disconnection() {
        let state = engine.state(at: date("2026-09-28T13:00:00+02:00"))
        #expect(!state.showsWorkContent)
        #expect(state.reason.contains("13:00"))
    }

    @Test("Saturday is weekend at work hours")
    func weekend() {
        let state = engine.state(at: date("2026-10-03T10:00:00+02:00"))
        #expect(state.mode == .weekend)
        #expect(!state.showsWorkContent)
    }

    @Test("A manual override wins until it expires")
    func override() {
        let now = date("2026-09-28T10:00:00+02:00")
        let override = ModeOverride(mode: .afternoon, until: date("2026-09-28T11:00:00+02:00"))
        #expect(engine.state(at: now, override: override).mode == .afternoon)
        #expect(engine.state(at: date("2026-09-28T11:00:00+02:00"), override: override).mode == .work)
    }

    @Test("Mode choice follows Madrid time, not UTC")
    func timeZoneMatters() {
        // 07:30 UTC is 09:30 in Madrid in summer time.
        #expect(engine.state(at: date("2026-09-28T07:30:00Z")).mode == .work)
    }
}

struct SnapshotTests {
    let work = ModeState(mode: .work, showsWorkContent: true, reason: "test")
    let afternoon = ModeState(mode: .afternoon, showsWorkContent: false, reason: "test")

    @Test("Sensitive items never reach any surface")
    func sensitiveNeverShown() {
        let items = [
            SurfaceItem(id: "a", kind: .task, title: "Private", sensitivity: .sensitive, priority: 9),
            SurfaceItem(id: "b", kind: .weather, title: "18 °C", sensitivity: .normal),
        ]
        for context in [SurfaceContext.locked, .unlocked] {
            let snapshot = SnapshotBuilder.build(items: items, modeState: work, context: context)
            #expect(snapshot.lines.map(\.id) == ["b"])
        }
    }

    @Test("Money, health and mood are sensitive even if mislabelled")
    func sensitiveKinds() {
        let items = [
            SurfaceItem(id: "m", kind: .money, title: "Balance", sensitivity: .normal),
            SurfaceItem(id: "h", kind: .health, title: "Sleep", sensitivity: .normal),
            SurfaceItem(id: "o", kind: .mood, title: "Mood", sensitivity: .normal),
        ]
        #expect(SnapshotBuilder.build(items: items, modeState: work, context: .unlocked).lines.isEmpty)
    }

    @Test("Personal items are redacted only on locked surfaces")
    func personalRedacted() {
        let items = [SurfaceItem(id: "e", kind: .event, title: "Dentist 17:00", sensitivity: .personal)]
        let locked = SnapshotBuilder.build(items: items, modeState: work, context: .locked)
        #expect(locked.lines.first?.redacted == true)
        #expect(locked.lines.first?.text != "Dentist 17:00")
        let unlocked = SnapshotBuilder.build(items: items, modeState: work, context: .unlocked)
        #expect(unlocked.lines.first?.text == "Dentist 17:00")
    }

    @Test("Work tasks disappear after work disconnection")
    func workHidden() {
        let items = [SurfaceItem(id: "w", kind: .workTask, title: "Campaign", sensitivity: .normal)]
        #expect(SnapshotBuilder.build(items: items, modeState: work, context: .unlocked).lines.count == 1)
        #expect(SnapshotBuilder.build(items: items, modeState: afternoon, context: .unlocked).lines.isEmpty)
    }

    @Test("Snapshot respects the limit and priority order")
    func limit() {
        let items = (0..<10).map {
            SurfaceItem(id: "i\($0)", kind: .task, title: "T\($0)", sensitivity: .normal, priority: $0)
        }
        let snapshot = SnapshotBuilder.build(items: items, modeState: work, context: .unlocked, limit: 3)
        #expect(snapshot.lines.map(\.id) == ["i9", "i8", "i7"])
        #expect(SnapshotBuilder.build(items: items, modeState: work, context: .unlocked, limit: -1).lines.isEmpty)
    }
}

struct CaptureTests {
    @Test("A proposal never classifies a capture by itself")
    func proposalIsNotConfirmation() throws {
        var inbox = CaptureInbox()
        inbox.add(Capture(id: "c1", kind: .screenshot, capturedAt: date("2026-09-28T18:00:00Z"), text: "text"))
        try inbox.propose(ClassificationProposal(tags: ["idea"], reason: "keyword"), for: "c1")
        #expect(inbox.captures[0].status == .pending)
        #expect(inbox.captures[0].confirmedTags.isEmpty)
        #expect(inbox.pending.count == 1)
    }

    @Test("Confirmation stores Manu's tags, project and reason")
    func confirm() throws {
        var inbox = CaptureInbox(captures: [Capture(id: "c1", kind: .text, capturedAt: .now, text: "x")])
        try inbox.confirm(id: "c1", tags: [" idea ", ""], project: "Synthetic", reason: "for later")
        let capture = inbox.captures[0]
        #expect(capture.status == .confirmed)
        #expect(capture.confirmedTags == ["idea"])
        #expect(capture.confirmedProject == "Synthetic")
        #expect(capture.reason == "for later")
        #expect(inbox.pending.isEmpty)
    }

    @Test("An empty classification is rejected")
    func emptyClassification() {
        var inbox = CaptureInbox(captures: [Capture(id: "c1", kind: .text, capturedAt: .now)])
        #expect(throws: CaptureInboxError.emptyClassification) {
            try inbox.confirm(id: "c1", tags: ["  "])
        }
    }

    @Test("Unknown captures and unclassified context")
    func unknownAndUnclassified() throws {
        var inbox = CaptureInbox(captures: [Capture(id: "c1", kind: .text, capturedAt: .now)])
        #expect(throws: CaptureInboxError.unknownCapture("nope")) {
            try inbox.markUnclassified(id: "nope")
        }
        try inbox.markUnclassified(id: "c1")
        #expect(inbox.captures[0].status == .unclassified)
    }

    @Test("Consecutive screenshots are grouped chronologically")
    func grouping() {
        let base = date("2026-09-28T18:00:00Z")
        let captures = [
            Capture(id: "s3", kind: .screenshot, capturedAt: base.addingTimeInterval(600)),
            Capture(id: "s1", kind: .screenshot, capturedAt: base),
            Capture(id: "t", kind: .text, capturedAt: base.addingTimeInterval(30)),
            Capture(id: "s2", kind: .screenshot, capturedAt: base.addingTimeInterval(90)),
        ]
        let groups = CaptureGrouping.groupScreenshots(captures, maxGap: 120)
        #expect(groups.map { $0.captures.map(\.id) } == [["s1", "s2"], ["s3"]])
        #expect(groups[0].start == base)
        #expect(CaptureGrouping.groupScreenshots([]).isEmpty)
    }
}

struct AssistantTests {
    @Test(
        "Crisis phrases always route to human help first",
        arguments: ["No quiero vivir", "estoy de bajón y pienso en quitarme la vida", "Tengo ideas de SUICIDIO"]
    )
    func crisis(input: String) {
        #expect(IntentParser.parse(input) == .crisis)
        let reply = ManuReplies.reply(to: .crisis)
        #expect(reply.contains("112"))
        #expect(reply.contains("024"))
    }

    @Test("Low mood opens the Refugio conversation without diagnosing")
    func lowMood() {
        #expect(IntentParser.parse("MANU, estoy de bajón") == .lowMood)
        #expect(!ManuReplies.reply(to: .lowMood).lowercased().contains("depresi"))
    }

    @Test(
        "Expenses are parsed with Spanish decimals and merchant",
        arguments: [
            ("Gasté 12,50 en café", "12.5", "cafe"),
            ("he pagado 30€ en gasolina", "30", "gasolina"),
            ("registra un gasto de 8 euros", "8", nil as String?),
            ("gaste 4.20 en el bar", "4.2", "el bar"),
        ]
    )
    func expense(input: String, amount: String, merchant: String?) {
        #expect(IntentParser.parse(input) == .expense(amount: Decimal(string: amount)!, merchant: merchant))
    }

    @Test("An expense without an amount is not invented")
    func expenseWithoutAmount() {
        #expect(IntentParser.parse("gasté en café") == .unknown)
        #expect(IntentParser.parse("gasté 0 en nada") == .unknown)
    }

    @Test("Ideas keep Manu's original text")
    func idea() {
        #expect(IntentParser.parse("Idea: app para ordenar capturas") == .captureIdea("app para ordenar capturas"))
        #expect(IntentParser.parse("apunta comprar pilas") == .captureIdea("comprar pilas"))
        #expect(IntentParser.parse("idea:") == .unknown)
    }

    @Test("Agenda and weather queries")
    func queries() {
        #expect(IntentParser.parse("¿Qué tengo hoy?") == .agenda(.today))
        #expect(IntentParser.parse("qué tengo mañana") == .agenda(.tomorrow))
        #expect(IntentParser.parse("¿Va a llover?") == .weather)
        #expect(IntentParser.parse("¿qué tiempo hace?") == .weather)
    }

    @Test("Unknown input is not guessed and replies are deterministic")
    func unknown() {
        #expect(IntentParser.parse("") == .unknown)
        #expect(IntentParser.parse("cuéntame un chiste") == .unknown)
        #expect(ManuReplies.reply(to: .unknown, variant: 1) == ManuReplies.reply(to: .unknown, variant: 3))
    }

    @Test("Expense reply uses Spanish number format")
    func expenseReply() {
        let reply = ManuReplies.reply(to: .expense(amount: Decimal(string: "12.5")!, merchant: "cafe"))
        #expect(reply.contains("12,5 €"))
    }
}

struct ProactivityTests {
    let policy = ProactivityPolicy()
    let now = date("2026-09-28T18:00:00Z")

    @Test("An active Focus blocks non-urgent suggestions only")
    func focus() {
        #expect(!policy.decide(kind: "walk", at: now, history: [], focusActive: true).allowed)
        #expect(policy.decide(kind: "battery", at: now, history: [], focusActive: true, urgent: true).allowed)
    }

    @Test("Daily budget and minimum gap")
    func budget() {
        let four = (1...4).map {
            SuggestionRecord(kind: "k\($0)", shownAt: now.addingTimeInterval(Double(-$0) * 3 * 3600), outcome: .accepted)
        }
        #expect(!policy.decide(kind: "new", at: now, history: four, focusActive: false).allowed)
        let recent = [SuggestionRecord(kind: "a", shownAt: now.addingTimeInterval(-30 * 60), outcome: .accepted)]
        #expect(!policy.decide(kind: "b", at: now, history: recent, focusActive: false).allowed)
        #expect(policy.decide(kind: "b", at: now, history: [], focusActive: false).allowed)
    }

    @Test("Backs off after being ignored repeatedly")
    func backoff() {
        let ignored = (1...3).map {
            SuggestionRecord(kind: "walk", shownAt: now.addingTimeInterval(Double(-$0) * 22 * 3600), outcome: .ignored)
        }
        #expect(!policy.decide(kind: "walk", at: now, history: ignored, focusActive: false).allowed)
        let later = now.addingTimeInterval(4 * 24 * 3600)
        #expect(policy.decide(kind: "walk", at: later, history: ignored, focusActive: false).allowed)
    }
}

struct MoneyTests {
    @Test(
        "Merchants map to categories, unknown ones to Otros",
        arguments: [
            ("Café Central", SpendingCategory.foodAndDrink),
            ("MERCADONA", .groceries),
            ("Repsol", .transport),
            ("Spotify", .subscriptions),
            ("tienda rara", .other),
        ]
    )
    func categories(merchant: String, expected: SpendingCategory) {
        #expect(SpendingCategorizer.category(for: merchant) == expected)
    }

    @Test("Category is inferred until Manu corrects it")
    func correction() {
        var entry = SpendingEntry(id: "1", amount: 5, merchant: "cafe", occurredAt: .now)
        #expect(entry.categoryInferred)
        entry.correctCategory(.leisure)
        #expect(entry.category == .leisure)
        #expect(!entry.categoryInferred)
    }

    @Test("Summary totals by range and category")
    func summary() {
        let start = date("2026-09-28T00:00:00Z")
        let entries = [
            SpendingEntry(id: "1", amount: Decimal(string: "2.5")!, merchant: "cafe", occurredAt: start.addingTimeInterval(3600)),
            SpendingEntry(id: "2", amount: 40, merchant: "mercadona", occurredAt: start.addingTimeInterval(7200)),
            SpendingEntry(id: "3", amount: 99, merchant: "cafe", occurredAt: start.addingTimeInterval(-60)),
        ]
        let summary = SpendingReport.summary(entries, from: start, to: start.addingTimeInterval(86400))
        #expect(summary.total == Decimal(string: "42.5")!)
        #expect(summary.byCategory[.foodAndDrink] == Decimal(string: "2.5")!)
    }
}
