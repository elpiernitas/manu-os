#if canImport(SwiftUI)
import ManuOSCore
import SwiftUI

// Screens show honest empty states until their data sources exist
// (storage in BRAIN-02a, calendar in BRAIN-09, money in BRAIN-13…).
// Nothing here pretends to show real data.

struct TodayView: View {
    let engine: ModeEngine
    @EnvironmentObject private var store: SessionStore

    var body: some View {
        ManuPage(title: "Hoy") {
            InboxCard(captures: store.session.inbox.pending, store: store)
            TimelineView(.periodic(from: .now, by: 60)) { context in
                let state = engine.state(at: context.date)
                ManuCard(title: "Ahora") {
                    Text(state.mode.title)
                        .font(.title2.weight(.semibold))
                        .foregroundStyle(ManuTheme.textPrimary)
                    Text(state.reason)
                        .font(.subheadline)
                        .foregroundStyle(ManuTheme.textSecondary)
                }
                .accessibilityElement(children: .combine)
            }
            ManuCard(title: "Briefing") {
                EmptyStateText(text: "Aquí verás tus eventos, tareas y lo importante del día cuando conectes el calendario.")
            }
            ManuCard(title: "Tiempo") {
                EmptyStateText(text: "Pendiente de elegir el servicio meteorológico (D-06).")
            }
            ManuCard(title: "Baterías") {
                EmptyStateText(text: "La batería de este dispositivo aparecerá aquí.")
            }
        }
    }
}

struct AgendaView: View {
    var body: some View {
        ManuPage(title: "Agenda") {
            ManuCard(title: "Hoy") {
                EmptyStateText(text: "Sin eventos todavía. El calendario se conecta en una fase posterior.")
            }
            ManuCard(title: "Tareas") {
                EmptyStateText(text: "Las tareas que confirmes en MANU aparecerán aquí.")
            }
            ManuCard(title: "Proyectos") {
                EmptyStateText(text: "Tus proyectos activos, sin convertir ideas en proyectos sin tu permiso.")
            }
        }
    }
}

/// Pending captures. Nothing is classified until Manu taps a button.
private struct InboxCard: View {
    let captures: [Capture]
    let store: SessionStore

    var body: some View {
        ManuCard(title: "Bandeja") {
            if captures.isEmpty {
                EmptyStateText(text: "Nada pendiente. Lo que le pidas a MANU que apunte aparecerá aquí para que lo confirmes.")
            } else {
                ForEach(captures) { capture in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(capture.text ?? "Captura sin texto")
                            .font(.body)
                            .foregroundStyle(ManuTheme.textPrimary)
                        HStack(spacing: 12) {
                            Button("Guardar como idea") { store.confirmAsIdea(captureID: capture.id) }
                                .buttonStyle(.borderedProminent)
                                .tint(ManuTheme.accentFill)
                            Button("No recuerdo") { store.markUnclassified(captureID: capture.id) }
                                .buttonStyle(.bordered)
                        }
                        .frame(minHeight: ManuTheme.minimumTouchTarget)
                    }
                }
            }
            Text("Por ahora la bandeja no se guarda al cerrar la app.")
                .font(.footnote)
                .foregroundStyle(ManuTheme.textSecondary)
        }
    }
}

struct MoneyView: View {
    @EnvironmentObject private var store: SessionStore

    var body: some View {
        ManuPage(title: "Dinero") {
            ManuCard(title: "Esta sesión") {
                let entries = store.session.spending
                if entries.isEmpty {
                    EmptyStateText(text: "Cuando registres gastos verás en qué se va el dinero, sin juicios.")
                } else {
                    ForEach(entries) { entry in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(entry.merchant ?? "Sin comercio")
                                    .font(.body)
                                    .foregroundStyle(ManuTheme.textPrimary)
                                Text(entry.category.title + (entry.categoryInferred ? " · propuesta" : ""))
                                    .font(.footnote)
                                    .foregroundStyle(ManuTheme.textSecondary)
                            }
                            Spacer()
                            Text(SpendingReport.euros(entry.amount))
                                .font(.body.monospacedDigit())
                                .foregroundStyle(ManuTheme.textPrimary)
                        }
                        .accessibilityElement(children: .combine)
                    }
                    let total = entries.reduce(Decimal(0)) { $0 + $1.amount }
                    Text("Total: " + SpendingReport.euros(total))
                        .font(.headline)
                        .foregroundStyle(ManuTheme.textPrimary)
                }
            }
            ManuCard(title: "Cómo registrar") {
                EmptyStateText(text: "Escribe a MANU, por ejemplo: «gasté 12,50 en café». La categoría se propone y la puedes corregir.")
            }
        }
    }
}

private struct YouSection: Identifiable {
    let title: String
    let symbol: String
    let detail: String
    var id: String { title }
}

struct YouView: View {
    private let sections: [YouSection] = [
        YouSection(title: "Cómo estás", symbol: "heart.text.square.fill", detail: "Solo lo que tú quieras contar."),
        YouSection(title: "Salud y actividad", symbol: "figure.walk", detail: "Sueño, pasos y ritmo cardiaco con tu permiso."),
        YouSection(title: "UREVO", symbol: "figure.walk", detail: "Sesiones y constancia, sin presión."),
        YouSection(title: "Comidas", symbol: "fork.knife", detail: "Por foto, habituales o texto rápido."),
        YouSection(title: "Personas", symbol: "person.2.fill", detail: "Fechas, planes y detalles que no quieres olvidar."),
        YouSection(title: "Hábitos", symbol: "repeat", detail: "Lo que MANU aprenda, siempre visible y corregible."),
    ]

    var body: some View {
        ManuPage(title: "Tú") {
            ForEach(sections) { section in
                let title = section.title, symbol = section.symbol, detail = section.detail
                HStack(spacing: 12) {
                    Image(systemName: symbol)
                        .font(.title3)
                        .foregroundStyle(ManuTheme.accentText)
                        .frame(width: ManuTheme.minimumTouchTarget, height: ManuTheme.minimumTouchTarget)
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(title).font(.headline).foregroundStyle(ManuTheme.textPrimary)
                        Text(detail).font(.subheadline).foregroundStyle(ManuTheme.textSecondary)
                    }
                    Spacer(minLength: 0)
                }
                .padding(ManuTheme.spacing)
                .background(ManuTheme.surface, in: RoundedRectangle(cornerRadius: ManuTheme.cornerRadius, style: .continuous))
                .accessibilityElement(children: .combine)
            }
        }
    }
}
#endif
