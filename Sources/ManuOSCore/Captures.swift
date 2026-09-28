import Foundation

public enum CaptureKind: String, Codable, Sendable {
    case text = "TEXT"
    case link = "LINK"
    case audio = "AUDIO"
    case photo = "PHOTO"
    case screenshot = "SCREENSHOT"
    case file = "FILE"
}

public enum CaptureStatus: String, Codable, Sendable {
    /// Waiting for Manu. Nothing has been classified yet.
    case pending = "PENDING"
    /// Manu confirmed the classification.
    case confirmed = "CONFIRMED"
    /// Manu did not remember why; text kept as unclassified context.
    case unclassified = "UNCLASSIFIED"
}

/// A proposed classification. It is only a suggestion: applying it
/// always needs `CaptureInbox.confirm` (docs/product/EXPERIENCE.md).
public struct ClassificationProposal: Codable, Equatable, Sendable {
    public let tags: [String]
    public let project: String?
    public let reason: String

    public init(tags: [String], project: String? = nil, reason: String) {
        self.tags = tags
        self.project = project
        self.reason = reason
    }
}

public struct Capture: Codable, Equatable, Identifiable, Sendable {
    public let id: String
    public let kind: CaptureKind
    public let capturedAt: Date
    public let text: String?
    public let sensitive: Bool
    public private(set) var status: CaptureStatus
    public private(set) var proposal: ClassificationProposal?
    public private(set) var confirmedTags: [String]
    public private(set) var confirmedProject: String?
    /// Why Manu took it, when he tells MANU.
    public private(set) var reason: String?

    public init(id: String, kind: CaptureKind, capturedAt: Date, text: String? = nil, sensitive: Bool = false) {
        self.id = id
        self.kind = kind
        self.capturedAt = capturedAt
        self.text = text
        self.sensitive = sensitive
        status = .pending
        proposal = nil
        confirmedTags = []
        confirmedProject = nil
        reason = nil
    }

    fileprivate mutating func propose(_ value: ClassificationProposal) {
        proposal = value
    }

    fileprivate mutating func confirm(tags: [String], project: String?, reason: String?) {
        confirmedTags = tags
        confirmedProject = project
        self.reason = reason
        status = .confirmed
    }

    fileprivate mutating func markUnclassified() {
        status = .unclassified
    }
}

public enum CaptureInboxError: Error, Equatable, Sendable {
    case unknownCapture(String)
    case emptyClassification
}

/// Inbox of captures. Classification is never applied without confirmation.
public struct CaptureInbox: Codable, Equatable, Sendable {
    public private(set) var captures: [Capture]

    public init(captures: [Capture] = []) {
        self.captures = captures
    }

    public var pending: [Capture] { captures.filter { $0.status == .pending } }

    public mutating func add(_ capture: Capture) {
        captures.append(capture)
    }

    public mutating func propose(_ proposal: ClassificationProposal, for id: String) throws {
        try update(id) { $0.propose(proposal) }
    }

    /// Only Manu's explicit confirmation classifies a capture.
    public mutating func confirm(id: String, tags: [String], project: String? = nil, reason: String? = nil) throws {
        let cleanTags = tags.map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        guard !cleanTags.isEmpty || project != nil else { throw CaptureInboxError.emptyClassification }
        try update(id) { $0.confirm(tags: cleanTags, project: project, reason: reason) }
    }

    public mutating func markUnclassified(id: String) throws {
        try update(id) { $0.markUnclassified() }
    }

    private mutating func update(_ id: String, _ change: (inout Capture) -> Void) throws {
        guard let index = captures.firstIndex(where: { $0.id == id }) else {
            throw CaptureInboxError.unknownCapture(id)
        }
        change(&captures[index])
    }
}

/// A group of consecutive screenshots about the same moment,
/// told in chronological order (daily capture tray).
public struct CaptureGroup: Equatable, Sendable {
    public let captures: [Capture]
    public var start: Date { captures.first!.capturedAt }
    public var end: Date { captures.last!.capturedAt }
}

public enum CaptureGrouping {
    /// Groups screenshots taken less than `maxGap` apart. Order is chronological,
    /// and non-screenshot captures are ignored.
    public static func groupScreenshots(_ captures: [Capture], maxGap: TimeInterval = 120) -> [CaptureGroup] {
        let screenshots = captures
            .filter { $0.kind == .screenshot }
            .sorted { ($0.capturedAt, $0.id) < ($1.capturedAt, $1.id) }
        var groups: [[Capture]] = []
        for capture in screenshots {
            if let last = groups.last?.last, capture.capturedAt.timeIntervalSince(last.capturedAt) <= maxGap {
                groups[groups.count - 1].append(capture)
            } else {
                groups.append([capture])
            }
        }
        return groups.map(CaptureGroup.init)
    }
}
