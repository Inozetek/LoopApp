//
//  Brand.swift
//  Loop
//
//  Brand colors, gradients, and design tokens
//

import SwiftUI

// MARK: - Brand Colors
struct Brand {
    // Primary gradient colors (teal to cyan)
    static let primaryStart = Color(hex: "14B8A6")  // Teal
    static let primaryEnd = Color(hex: "06B6D4")    // Cyan

    // Accent colors
    static let accent = Color(hex: "0D9488")        // Darker teal
    static let accentLight = Color(hex: "5EEAD4")   // Light teal

    // Background colors (dark theme)
    static let backgroundPrimary = Color(hex: "000000")
    static let backgroundSecondary = Color(hex: "1C1C1E")
    static let backgroundTertiary = Color(hex: "2C2C2E")

    // Text colors
    static let textPrimary = Color.white
    static let textSecondary = Color(hex: "A1A1AA")
    static let textMuted = Color(hex: "71717A")

    // Category colors
    static let categoryColors: [String: Color] = [
        "dining": Color(hex: "F97316"),      // Orange
        "coffee": Color(hex: "92400E"),      // Brown
        "entertainment": Color(hex: "8B5CF6"), // Purple
        "fitness": Color(hex: "22C55E"),     // Green
        "nightlife": Color(hex: "EC4899"),   // Pink
        "outdoors": Color(hex: "10B981"),    // Emerald
        "shopping": Color(hex: "F59E0B"),    // Amber
        "arts": Color(hex: "6366F1"),        // Indigo
        "wellness": Color(hex: "14B8A6"),    // Teal
        "other": Color(hex: "6B7280"),       // Gray
    ]

    // MARK: - Gradients
    static var primaryGradient: LinearGradient {
        LinearGradient(
            colors: [primaryStart, primaryEnd],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    static var cardGradient: LinearGradient {
        LinearGradient(
            colors: [
                Color(hex: "0D9488").opacity(0.8),
                Color(hex: "06B6D4").opacity(0.6)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    static var glassGradient: LinearGradient {
        LinearGradient(
            colors: [
                Color.white.opacity(0.15),
                Color.white.opacity(0.05)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
}

// MARK: - Color Extension for Hex
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - Design Tokens
struct DesignTokens {
    // Spacing
    static let spacingXS: CGFloat = 4
    static let spacingSM: CGFloat = 8
    static let spacingMD: CGFloat = 16
    static let spacingLG: CGFloat = 24
    static let spacingXL: CGFloat = 32

    // Border radius
    static let radiusSM: CGFloat = 8
    static let radiusMD: CGFloat = 12
    static let radiusLG: CGFloat = 16
    static let radiusXL: CGFloat = 24
    static let radiusFull: CGFloat = 9999

    // Shadows
    static func cardShadow() -> some View {
        Color.black.opacity(0.3)
    }

    // Animation
    static let springResponse: Double = 0.5
    static let springDamping: Double = 0.8
}
