import Foundation

/// In-memory state of one app session: chat, capture inbox and spending.
/// Persistence arrives with BRAIN-02a (`LocalStore`); until then nothing
/// survives closing the app, and the UI says so.
public struct AppSession: Equatable, Sendable {
    public private(set) var transcript = ChatTranscript()
    public private(set) var inbox = CaptureInbox()
    public private(set) var spending: [SpendingEntry] = []
    private var nextID = 0

    public init() {}

    /// Sends Manu's text to MANU and applies the recognised action.
    /// Ideas go to the inbox as pending (never auto-classified);
    /// expenses are recorded with an inferred, correctable category.
    @discardableResult
    public mutating func handle(_ text: String, at now: Date = Date()) -> ManuIntent? {
        guard let intent = transcript.send(text) else { return nil }
        switch intent {
        case let .captureIdea(idea):
            inbox.add(Capture(id: makeID("idea"), kind: .text, capturedAt: now, text: idea))
        case let .expense(amount, merchant):
            spending.append(SpendingEntry(id: makeID("gasto"), amount: amount, merchant: merchant, occurredAt: now))
        default:
            break
        }
        return intent
    }

    public mutating func confirmCapture(id: String, tags: [String], project: String? = nil) throws {
        try inbox.confirm(id: id, tags: tags, project: project)
    }

    public mutating func markUnclassified(id: String) throws {
        try inbox.markUnclassified(id: id)
    }

    public mutating func correctCategory(entryID: String, to category: SpendingCategory) {
        guard let index = spending.firstIndex(where: { $0.id == entryID }) else { return }
        spending[index].correctCategory(category)
    }

    private mutating func makeID(_ prefix: String) -> String {
        nextID += 1
        return "\(prefix)-\(nextID)"
    }
}
