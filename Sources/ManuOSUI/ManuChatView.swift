#if canImport(SwiftUI)
import ManuOSCore
import SwiftUI

/// The MANU tab: base-level chat (ADR-0009). Works offline and without AI.
struct ManuChatView: View {
    @State private var transcript = ChatTranscript()
    @State private var draft = ""
    @FocusState private var inputFocused: Bool

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 12) {
                            if transcript.messages.isEmpty {
                                EmptyStateText(
                                    text: "Escríbeme lo que quieras guardar o hacer. Por ejemplo: «apunta llamar al taller», «gasté 8 en gasolina» o «qué tengo hoy»."
                                )
                                .padding(.top, 24)
                            }
                            ForEach(transcript.messages) { message in
                                MessageBubble(message: message).id(message.id)
                            }
                        }
                        .padding(ManuTheme.spacing)
                    }
                    .onChange(of: transcript.messages.count) { _ in
                        if let last = transcript.messages.last {
                            withAnimation(.easeOut(duration: 0.2)) { proxy.scrollTo(last.id, anchor: .bottom) }
                        }
                    }
                }
                composer
            }
            .background(ManuTheme.background.ignoresSafeArea())
            .navigationTitle("MANU")
        }
    }

    private var composer: some View {
        HStack(alignment: .bottom, spacing: 8) {
            TextField("Escribe a MANU", text: $draft, axis: .vertical)
                .lineLimit(1...5)
                .focused($inputFocused)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .foregroundStyle(ManuTheme.textPrimary)
                .background(ManuTheme.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                .onSubmit(send)
            Button(action: send) {
                Image(systemName: "arrow.up")
                    .font(.headline)
                    .foregroundStyle(.white)
                    .frame(width: ManuTheme.minimumTouchTarget, height: ManuTheme.minimumTouchTarget)
                    .background(ManuTheme.accentFill, in: Circle())
            }
            .buttonStyle(.plain)
            .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            .accessibilityLabel("Enviar")
        }
        .padding(.horizontal, ManuTheme.spacing)
        .padding(.vertical, 10)
        .background(ManuTheme.background)
    }

    private func send() {
        guard transcript.send(draft) != nil else { return }
        draft = ""
    }
}

private struct MessageBubble: View {
    let message: ChatMessage

    private var isManu: Bool { message.author == .manu }

    var body: some View {
        HStack {
            if isManu { Spacer(minLength: 40) }
            Text(message.text)
                .font(.body)
                .foregroundStyle(isManu ? Color.white : ManuTheme.textPrimary)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(background, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay {
                    if message.isSafetyCritical {
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .strokeBorder(ManuTheme.safety, lineWidth: 2)
                    }
                }
                .textSelection(.enabled)
                .accessibilityLabel((isManu ? "Tú: " : "MANU: ") + message.text)
            if !isManu { Spacer(minLength: 40) }
        }
    }

    private var background: Color {
        isManu ? ManuTheme.accentFill : ManuTheme.surfaceRaised
    }
}
#endif
