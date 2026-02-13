//
//  GlassEffects.swift
//  Loop
//
//  Reusable glass effect components
//
//  UPGRADE PATH TO LIQUID GLASS (iOS 26+):
//  When upgrading to iOS 26 with Xcode 26, replace these implementations
//  with the native .glassEffect() modifier and UIGlassEffect.
//
//  Current implementation uses:
//  - .ultraThinMaterial, .thinMaterial, .regularMaterial (iOS 15+)
//  - UIVisualEffectView with UIBlurEffect (all iOS versions)
//
//  Future native implementation will use:
//  - .glassEffect() modifier (iOS 26+)
//  - UIGlassEffect (iOS 26+)
//  - GlassEffectContainer (iOS 26+)
//

import SwiftUI

// MARK: - Glass Card Modifier
struct GlassCard: ViewModifier {
    var cornerRadius: CGFloat = 20
    var opacity: Double = 0.1

    func body(content: Content) -> some View {
        content
            .background(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .fill(.ultraThinMaterial)
                    .overlay(
                        RoundedRectangle(cornerRadius: cornerRadius)
                            .fill(
                                LinearGradient(
                                    colors: [
                                        Color.white.opacity(opacity),
                                        Color.white.opacity(opacity * 0.3)
                                    ],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: cornerRadius)
                            .stroke(Color.white.opacity(0.15), lineWidth: 0.5)
                    )
            )
            .shadow(color: .black.opacity(0.2), radius: 16, y: 8)
    }
}

extension View {
    func glassCard(cornerRadius: CGFloat = 20, opacity: Double = 0.1) -> some View {
        modifier(GlassCard(cornerRadius: cornerRadius, opacity: opacity))
    }
}

// MARK: - Glass Button Style
struct GlassButtonStyle: ButtonStyle {
    var cornerRadius: CGFloat = 12

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .background(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .fill(.ultraThinMaterial)
                    .overlay(
                        RoundedRectangle(cornerRadius: cornerRadius)
                            .stroke(Color.white.opacity(0.2), lineWidth: 0.5)
                    )
            )
            .scaleEffect(configuration.isPressed ? 0.96 : 1.0)
            .animation(.spring(response: 0.3), value: configuration.isPressed)
    }
}

// MARK: - Glass Pill Background
struct GlassPill: View {
    var body: some View {
        Capsule()
            .fill(.thinMaterial)
            .overlay(
                Capsule()
                    .stroke(Color.white.opacity(0.15), lineWidth: 0.5)
            )
    }
}

// MARK: - Glass Sheet Background
struct GlassSheetBackground: View {
    var body: some View {
        Rectangle()
            .fill(.ultraThinMaterial)
            .overlay(
                Rectangle()
                    .fill(
                        LinearGradient(
                            colors: [
                                Color.white.opacity(0.08),
                                Color.clear
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
            )
            .ignoresSafeArea()
    }
}

// MARK: - Glass Navigation Bar
struct GlassNavigationBar<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity)
            .background(
                Rectangle()
                    .fill(.ultraThinMaterial)
                    .overlay(
                        Rectangle()
                            .fill(Color.white.opacity(0.05))
                    )
            )
    }
}

// MARK: - Morphing Glass Container
/// A container that will upgrade to native Liquid Glass morphing effects in iOS 26
struct MorphingGlassContainer<Content: View>: View {
    let content: Content
    var cornerRadius: CGFloat = 24

    init(cornerRadius: CGFloat = 24, @ViewBuilder content: () -> Content) {
        self.cornerRadius = cornerRadius
        self.content = content()
    }

    var body: some View {
        content
            .background(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .fill(.regularMaterial)
                    .overlay(
                        RoundedRectangle(cornerRadius: cornerRadius)
                            .fill(
                                LinearGradient(
                                    colors: [
                                        Color.white.opacity(0.12),
                                        Color.white.opacity(0.04)
                                    ],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: cornerRadius)
                            .stroke(
                                LinearGradient(
                                    colors: [
                                        Color.white.opacity(0.3),
                                        Color.white.opacity(0.1)
                                    ],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ),
                                lineWidth: 0.5
                            )
                    )
            )
            .shadow(color: .black.opacity(0.25), radius: 20, y: 10)
    }
}

// MARK: - Glass Menu Item
struct GlassMenuItem: View {
    let icon: String
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 18))
                    .foregroundStyle(Brand.primaryGradient)
                    .frame(width: 24)

                Text(title)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(.white)

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 14))
                    .foregroundColor(Brand.textMuted)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.white.opacity(0.05))
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Glass Popover
struct GlassPopover<Content: View>: View {
    let content: Content
    var arrowEdge: Edge = .top

    init(arrowEdge: Edge = .top, @ViewBuilder content: () -> Content) {
        self.arrowEdge = arrowEdge
        self.content = content()
    }

    var body: some View {
        content
            .padding(16)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(.ultraThinMaterial)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(Color.white.opacity(0.2), lineWidth: 0.5)
                    )
            )
            .shadow(color: .black.opacity(0.3), radius: 20, y: 10)
    }
}

// MARK: - Preview
#Preview {
    ZStack {
        Brand.backgroundPrimary
            .ignoresSafeArea()

        VStack(spacing: 20) {
            // Glass card example
            VStack {
                Text("Glass Card")
                    .font(.headline)
                    .foregroundColor(.white)
            }
            .frame(width: 200, height: 100)
            .glassCard()

            // Glass button example
            Button("Glass Button") {}
                .buttonStyle(GlassButtonStyle())
                .foregroundColor(.white)

            // Morphing container example
            MorphingGlassContainer {
                VStack {
                    Text("Morphing Glass")
                        .font(.headline)
                        .foregroundColor(.white)
                }
                .frame(width: 200, height: 80)
                .padding()
            }
        }
    }
}
