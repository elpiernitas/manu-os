#if canImport(SwiftUI)
import Combine
import ManuOSCore
import SwiftUI

/// Observable wrapper around `AppSession` for SwiftUI. All rules live in
/// ManuOSCore; this type only forwards actions and publishes changes.
@MainActor
public final class SessionStore: ObservableObject {
    @Published public private(set) var session = AppSession()

    public init() {}

    public func handle(_ text: String) {
        session.handle(text)
    }

    public func confirmAsIdea(captureID: String) {
        try? session.confirmCapture(id: captureID, tags: ["Idea"])
    }

    public func markUnclassified(captureID: String) {
        try? session.markUnclassified(id: captureID)
    }
}
#endif
