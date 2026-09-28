import Foundation

/// Sensitivity of anything that might reach a system surface
/// (docs/architecture/DATA_MODEL.md, "Sensibilidad").
public enum SurfaceSensitivity: String, Codable, Comparable, Sendable {
    case normal = "NORMAL"
    case personal = "PERSONAL"
    case sensitive = "SENSITIVE"

    private var rank: Int {
        switch self {
        case .normal: 0
        case .personal: 1
        case .sensitive: 2
        }
    }

    public static func < (lhs: Self, rhs: Self) -> Bool { lhs.rank < rhs.rank }
}

public enum SurfaceItemKind: String, Codable, Sendable {
    case weather = "WEATHER"
    case battery = "BATTERY"
    case event = "EVENT"
    case task = "TASK"
    case workTask = "WORK_TASK"
    case reminder = "REMINDER"
    case money = "MONEY"
    case health = "HEALTH"
    case mood = "MOOD"
}

public struct SurfaceItem: Codable, Equatable, Sendable {
    public let id: String
    public let kind: SurfaceItemKind
    public let title: String
    public let sensitivity: SurfaceSensitivity
    public let priority: Int

    public init(id: String, kind: SurfaceItemKind, title: String, sensitivity: SurfaceSensitivity, priority: Int = 0) {
        self.id = id
        self.kind = kind
        self.title = title
        self.sensitivity = sensitivity
        self.priority = priority
    }

    /// Money, health and mood are sensitive by nature, whatever the caller
    /// labelled them. When in doubt, the most protective label wins.
    public var effectiveSensitivity: SurfaceSensitivity {
        switch kind {
        case .money, .health, .mood: .sensitive
        default: sensitivity
        }
    }
}

public enum SurfaceContext: Sendable {
    /// Visible without unlocking: lock screen, Live Activities, notifications.
    case locked
    /// Home screen widgets and the unlocked app.
    case unlocked
}

public struct SnapshotLine: Codable, Equatable, Sendable {
    public let id: String
    public let kind: SurfaceItemKind
    public let text: String
    public let redacted: Bool

    public init(id: String, kind: SurfaceItemKind, text: String, redacted: Bool) {
        self.id = id
        self.kind = kind
        self.text = text
        self.redacted = redacted
    }
}

/// The minimal snapshot that widgets and extensions may read
/// (ADR-0011, G-09). It never contains the vault, only these lines.
public struct SurfaceSnapshot: Codable, Equatable, Sendable {
    public let mode: Mode
    public let lines: [SnapshotLine]

    public init(mode: Mode, lines: [SnapshotLine]) {
        self.mode = mode
        self.lines = lines
    }

    /// Decodes a snapshot written by the app. Anything unreadable is treated
    /// as "no data", never as a crash in the widget.
    public static func decode(_ data: Data?) -> SurfaceSnapshot? {
        guard let data else { return nil }
        return try? JSONDecoder().decode(SurfaceSnapshot.self, from: data)
    }
}

public enum SnapshotBuilder {
    /// Builds what a system surface may show.
    /// - Sensitive content never leaves the app.
    /// - Personal content is redacted on locked surfaces.
    /// - Work content only appears while work content is visible.
    public static func build(
        items: [SurfaceItem],
        modeState: ModeState,
        context: SurfaceContext,
        limit: Int = 4
    ) -> SurfaceSnapshot {
        let lines = items
            .filter { $0.effectiveSensitivity != .sensitive }
            .filter { $0.kind != .workTask || modeState.showsWorkContent }
            .sorted { ($0.priority, $0.id) > ($1.priority, $1.id) }
            .prefix(max(0, limit))
            .map { item -> SnapshotLine in
                let redact = context == .locked && item.effectiveSensitivity == .personal
                return SnapshotLine(
                    id: item.id,
                    kind: item.kind,
                    text: redact ? placeholder(for: item.kind) : item.title,
                    redacted: redact
                )
            }
        return SurfaceSnapshot(mode: modeState.mode, lines: Array(lines))
    }

    static func placeholder(for kind: SurfaceItemKind) -> String {
        switch kind {
        case .event: "Tienes un evento"
        case .task, .workTask, .reminder: "Tienes algo pendiente"
        default: "Información disponible en MANU"
        }
    }
}
