#if canImport(SwiftUI)
import ManuOSCore
import SwiftUI

public enum ManuTab: String, CaseIterable, Hashable, Sendable {
    case today, agenda, manu, money, you

    var title: String {
        switch self {
        case .today: "Hoy"
        case .agenda: "Agenda"
        case .manu: "MANU"
        case .money: "Dinero"
        case .you: "Tú"
        }
    }

    /// Fill variants: Apple recommends filled symbols in mobile tab bars.
    var symbol: String {
        switch self {
        case .today: "sun.max.fill"
        case .agenda: "calendar"
        case .manu: "bubble.left.and.bubble.right.fill"
        case .money: "eurosign.circle.fill"
        case .you: "person.crop.circle.fill"
        }
    }
}

/// App shell: the system tab bar with five tabs and MANU in the centre.
/// The system tab bar keeps Dynamic Type, VoiceOver and safe areas for free;
/// a custom floating button would break platform conventions.
public struct RootView: View {
    @State private var selection: ManuTab
    private let engine: ModeEngine

    public init(initialTab: ManuTab = .today, timeZone: TimeZone = TimeZone(identifier: "Europe/Madrid") ?? .current) {
        _selection = State(initialValue: initialTab)
        engine = ModeEngine(timeZone: timeZone)
    }

    public var body: some View {
        TabView(selection: $selection) {
            TodayView(engine: engine)
                .tabItem { Label(ManuTab.today.title, systemImage: ManuTab.today.symbol) }
                .tag(ManuTab.today)
            AgendaView()
                .tabItem { Label(ManuTab.agenda.title, systemImage: ManuTab.agenda.symbol) }
                .tag(ManuTab.agenda)
            ManuChatView()
                .tabItem { Label(ManuTab.manu.title, systemImage: ManuTab.manu.symbol) }
                .tag(ManuTab.manu)
            MoneyView()
                .tabItem { Label(ManuTab.money.title, systemImage: ManuTab.money.symbol) }
                .tag(ManuTab.money)
            YouView()
                .tabItem { Label(ManuTab.you.title, systemImage: ManuTab.you.symbol) }
                .tag(ManuTab.you)
        }
        .tint(ManuTheme.accentText)
        .preferredColorScheme(.dark)
    }
}

/// Shared page layout: dark background, scrolling cards, large title.
struct ManuPage<Content: View>: View {
    let title: String
    @ViewBuilder var content: Content

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: ManuTheme.spacing) { content }
                    .padding(ManuTheme.spacing)
            }
            .background(ManuTheme.background.ignoresSafeArea())
            .navigationTitle(title)
        }
    }
}
#endif
