//
//  MainTabView.swift
//  Loop
//
//  Main tab navigation with glass pill tab bar
//

import SwiftUI

struct MainTabView: View {
    @State private var selectedTab: Tab = .forYou
    @EnvironmentObject var appState: AppState
    @Namespace private var tabAnimation

    enum Tab: String, CaseIterable {
        case calendar = "Calendar"
        case explore = "Explore"
        case forYou = "For You"
        case friends = "Friends"
        case profile = "Profile"

        var icon: String {
            switch self {
            case .calendar: return "calendar"
            case .explore: return "magnifyingglass"
            case .forYou: return "sparkles"
            case .friends: return "bubble.left.and.bubble.right"
            case .profile: return "person.circle"
            }
        }

        var filledIcon: String {
            switch self {
            case .calendar: return "calendar"
            case .explore: return "magnifyingglass"
            case .forYou: return "sparkles"
            case .friends: return "bubble.left.and.bubble.right.fill"
            case .profile: return "person.circle.fill"
            }
        }
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            // Tab content
            TabView(selection: $selectedTab) {
                CalendarView()
                    .tag(Tab.calendar)

                ExploreView()
                    .tag(Tab.explore)

                ForYouView()
                    .tag(Tab.forYou)

                FriendsView()
                    .tag(Tab.friends)

                ProfileView()
                    .tag(Tab.profile)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))

            // Custom glass pill tab bar
            GlassTabBar(selectedTab: $selectedTab, namespace: tabAnimation)
        }
        .ignoresSafeArea(.keyboard)
    }
}

// MARK: - Glass Tab Bar
struct GlassTabBar: View {
    @Binding var selectedTab: MainTabView.Tab
    var namespace: Namespace.ID
    @EnvironmentObject var appState: AppState

    var body: some View {
        HStack(spacing: 0) {
            ForEach(MainTabView.Tab.allCases, id: \.self) { tab in
                TabBarButton(
                    tab: tab,
                    isSelected: selectedTab == tab,
                    namespace: namespace,
                    badgeCount: badgeCount(for: tab)
                ) {
                    withAnimation(.spring(response: 0.4, dampingFraction: 0.75)) {
                        selectedTab = tab
                    }
                    // Haptic feedback
                    let impactFeedback = UIImpactFeedbackGenerator(style: .light)
                    impactFeedback.impactOccurred()
                }
            }
        }
        .padding(.horizontal, 4)
        .padding(.vertical, 4)
        .background(
            // Glass pill background
            GlassBackground()
        )
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
    }

    private func badgeCount(for tab: MainTabView.Tab) -> Int {
        switch tab {
        case .calendar: return appState.notifications.calendar
        case .explore: return appState.notifications.explore
        case .forYou: return appState.notifications.recommendations
        case .friends: return appState.notifications.friends
        case .profile: return appState.notifications.profile
        }
    }
}

// MARK: - Tab Bar Button
struct TabBarButton: View {
    let tab: MainTabView.Tab
    let isSelected: Bool
    var namespace: Namespace.ID
    let badgeCount: Int
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 2) {
                ZStack(alignment: .topTrailing) {
                    // Icon with gradient when selected (For You tab) or white
                    if tab == .forYou {
                        Image(systemName: isSelected ? tab.filledIcon : tab.icon)
                            .font(.system(size: 22, weight: .medium))
                            .foregroundStyle(Brand.primaryGradient)
                    } else {
                        Image(systemName: isSelected ? tab.filledIcon : tab.icon)
                            .font(.system(size: 20, weight: .medium))
                            .foregroundColor(isSelected ? .white : Brand.textMuted)
                    }

                    // Badge
                    if badgeCount > 0 {
                        BadgeView(count: badgeCount)
                            .offset(x: 8, y: -4)
                    }
                }

                Text(tab.rawValue)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(isSelected ? .white : Brand.textMuted)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background(
                // Glass lens indicator for selected tab
                Group {
                    if isSelected {
                        GlassLens()
                            .matchedGeometryEffect(id: "lens", in: namespace)
                    }
                }
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Glass Lens (Selected Tab Indicator)
struct GlassLens: View {
    var body: some View {
        RoundedRectangle(cornerRadius: 20)
            .fill(.ultraThinMaterial)
            .overlay(
                RoundedRectangle(cornerRadius: 20)
                    .stroke(Color.white.opacity(0.2), lineWidth: 0.5)
            )
            .shadow(color: .black.opacity(0.2), radius: 8, y: 4)
    }
}

// MARK: - Glass Background (Tab Bar Container)
struct GlassBackground: View {
    var body: some View {
        RoundedRectangle(cornerRadius: 28)
            .fill(Brand.backgroundTertiary)
            .overlay(
                RoundedRectangle(cornerRadius: 28)
                    .stroke(Color.white.opacity(0.1), lineWidth: 0.5)
            )
            .shadow(color: .black.opacity(0.3), radius: 12, y: 4)
    }
}

// MARK: - Badge View
struct BadgeView: View {
    let count: Int

    var body: some View {
        Text(count > 9 ? "9+" : "\(count)")
            .font(.system(size: 9, weight: .bold))
            .foregroundColor(.white)
            .padding(.horizontal, 4)
            .padding(.vertical, 2)
            .background(
                Capsule()
                    .fill(Color.red)
            )
            .fixedSize()
    }
}

// MARK: - Preview
#Preview {
    MainTabView()
        .environmentObject(AppState())
        .preferredColorScheme(.dark)
}
