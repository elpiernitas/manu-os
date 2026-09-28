import ManuOSCore
import SwiftUI
import WidgetKit

/// Shared container identifier (ADR-0011). Without signing, as in CI, the
/// container is not available and the widget shows the mode only.
let manuAppGroup = "group.local.manuos"
let snapshotKey = "surfaceSnapshot"

struct SnapshotEntry: TimelineEntry {
    let date: Date
    let snapshot: SurfaceSnapshot
}

struct SnapshotProvider: TimelineProvider {
    private let engine = ModeEngine(timeZone: TimeZone(identifier: "Europe/Madrid") ?? .current)

    func placeholder(in context: Context) -> SnapshotEntry {
        SnapshotEntry(date: Date(), snapshot: SurfaceSnapshot(mode: .morning, lines: []))
    }

    func getSnapshot(in context: Context, completion: @escaping (SnapshotEntry) -> Void) {
        completion(entry(at: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SnapshotEntry>) -> Void) {
        let now = Date()
        completion(Timeline(entries: [entry(at: now)], policy: .after(now.addingTimeInterval(15 * 60))))
    }

    /// Reads only the minimal snapshot the app wrote. The mode is recomputed
    /// here so it stays right even if the app has not run recently.
    private func entry(at date: Date) -> SnapshotEntry {
        let mode = engine.state(at: date).mode
        let stored = SurfaceSnapshot.decode(UserDefaults(suiteName: manuAppGroup)?.data(forKey: snapshotKey))
        return SnapshotEntry(date: date, snapshot: SurfaceSnapshot(mode: mode, lines: stored?.lines ?? []))
    }
}

struct SnapshotWidgetView: View {
    let entry: SnapshotEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(entry.snapshot.mode.title)
                .font(family == .accessoryRectangular ? .headline : .title3.weight(.semibold))
                .widgetAccentable()
            if entry.snapshot.lines.isEmpty {
                Text("Abre MANU para ver tu día")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(entry.snapshot.lines.prefix(family == .accessoryRectangular ? 2 : 3), id: \.id) { line in
                    Text(line.text)
                        .font(.caption)
                        .lineLimit(1)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .modifier(WidgetBackground())
    }
}

/// iOS 17 requires a container background; iOS 16 does not have the API.
private struct WidgetBackground: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 17.0, *) {
            content.containerBackground(Color(red: 0.067, green: 0.075, blue: 0.094), for: .widget)
        } else {
            content.padding().background(Color(red: 0.067, green: 0.075, blue: 0.094))
        }
    }
}

@main
struct ManuOSWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "ManuOSSnapshot", provider: SnapshotProvider()) { entry in
            SnapshotWidgetView(entry: entry)
        }
        .configurationDisplayName("MANU · Ahora")
        .description("El modo activo y lo mínimo del momento. Nunca muestra datos sensibles.")
        .supportedFamilies([.systemSmall, .accessoryRectangular])
    }
}
