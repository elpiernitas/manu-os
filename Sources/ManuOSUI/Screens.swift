#if canImport(SwiftUI)
import ManuOSCore
import SwiftUI

// Screens show honest empty states until their data sources exist
// (storage in BRAIN-02a, calendar in BRAIN-09, money in BRAIN-13…).
// Nothing here pretends to show real data.

struct TodayView: View {
    let engine: ModeEngine

    var body: some View {
        ManuPage(title: "Hoy") {
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

struct MoneyView: View {
    var body: some View {
        ManuPage(title: "Dinero") {
            ManuCard(title: "Este mes") {
                EmptyStateText(text: "Cuando registres gastos verás en qué se va el dinero, sin juicios.")
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
