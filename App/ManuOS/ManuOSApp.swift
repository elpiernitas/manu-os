import ManuOSUI
import SwiftUI

/// Entry point of the MANU OS iPhone app. All UI and logic live in the
/// Swift package (ManuOSUI, ManuOSCore) so they are tested outside Xcode.
@main
struct ManuOSApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
        }
    }
}
