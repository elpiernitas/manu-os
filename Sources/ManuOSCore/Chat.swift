import Foundation

public struct ChatMessage: Codable, Equatable, Identifiable, Sendable {
    public enum Author: String, Codable, Sendable {
        case manu = "MANU_USER"
        case assistant = "MANU_ASSISTANT"
    }

    public let id: Int
    public let author: Author
    public let text: String
    /// Replies that must stand out and never be hidden (crisis help).
    public let isSafetyCritical: Bool
}

/// Conversation state of the MANU tab, base level (ADR-0009).
/// Pure value type: the UI only renders it.
public struct ChatTranscript: Codable, Equatable, Sendable {
    public private(set) var messages: [ChatMessage]
    private var replyCount: Int

    public init() {
        messages = []
        replyCount = 0
    }

    /// Adds Manu's message and MANU's reply. Returns the recognised intent
    /// so the app can act on it (for example, open the capture inbox).
    @discardableResult
    public mutating func send(_ text: String) -> ManuIntent? {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        messages.append(ChatMessage(id: messages.count, author: .manu, text: trimmed, isSafetyCritical: false))
        let intent = IntentParser.parse(trimmed)
        let reply = ManuReplies.reply(to: intent, variant: replyCount)
        replyCount += 1
        messages.append(
            ChatMessage(id: messages.count, author: .assistant, text: reply, isSafetyCritical: intent == .crisis)
        )
        return intent
    }
}
