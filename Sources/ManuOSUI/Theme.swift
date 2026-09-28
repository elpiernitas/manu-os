#if canImport(SwiftUI)
import SwiftUI

/// MANU OS visual identity (docs/product/EXPERIENCE.md, "Identidad visual").
/// Dark by default and stable all day: modes never change these values.
///
/// Contrast (WCAG, computed for this palette):
/// - textPrimary on background 19.1:1, on surface 17.5:1
/// - textSecondary on background 7.2:1, on surface 6.6:1
/// - accentText (#4D8DFF) on background 6.3:1, on surface 5.8:1
/// - accentFill (#246BFD) is only 4.4:1 / 4.1:1 as text on dark backgrounds,
///   below the 4.5:1 body-text minimum, so it is used only as a fill behind
///   white text (4.6:1), never as text or thin icons.
public enum ManuTheme {
    public static let background = Color(hex: 0x050608)
    public static let surface = Color(hex: 0x111318)
    public static let surfaceRaised = Color(hex: 0x1A1D24)
    public static let textPrimary = Color(hex: 0xF7F8FA)
    public static let textSecondary = Color(hex: 0x949AA6)
    /// Filled buttons and bubbles behind white text.
    public static let accentFill = Color(hex: 0x246BFD)
    /// Selected tab, links, icons and accent text.
    public static let accentText = Color(hex: 0x4D8DFF)
    /// Reserved for safety-critical content (crisis help). Never decorative.
    public static let safety = Color(hex: 0xFF6B6B)

    public static let cornerRadius: CGFloat = 16
    public static let spacing: CGFloat = 16
    /// Minimum touch target on iPhone (Apple HIG: 44 × 44 pt).
    public static let minimumTouchTarget: CGFloat = 44
}

extension Color {
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: 1
        )
    }
}

/// Card surface used across tabs. System text styles keep Dynamic Type.
struct ManuCard<Content: View>: View {
    let title: String
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(ManuTheme.textSecondary)
                .accessibilityAddTraits(.isHeader)
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(ManuTheme.spacing)
        .background(ManuTheme.surface, in: RoundedRectangle(cornerRadius: ManuTheme.cornerRadius, style: .continuous))
    }
}

/// Honest empty state: says what will appear and why it is not there yet.
struct EmptyStateText: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.body)
            .foregroundStyle(ManuTheme.textSecondary)
            .fixedSize(horizontal: false, vertical: true)
    }
}
#endif
