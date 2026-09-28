import ManuOSUI
import SwiftUI

/// Entry point of the MANU OS app. All UI and logic live in the Swift
/// package (ManuOSUI, ManuOSCore) so they are tested outside Xcode.
///
/// `-tab <today|agenda|manu|money|you>` opens a given tab; CI uses it to take
/// one screenshot per tab in the simulator.
@main
struct ManuOSApp: App {
    private let initialTab = ManuTab(rawValue: UserDefaults.standard.string(forKey: "tab") ?? "") ?? .today

    var body: some Scene {
        WindowGroup {
            RootView(initialTab: initialTab)
        }
    }
}
