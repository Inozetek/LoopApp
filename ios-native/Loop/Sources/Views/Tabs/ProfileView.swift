//
//  ProfileView.swift
//  Loop
//
//  User profile and settings
//

import SwiftUI

struct ProfileView: View {
    @EnvironmentObject var appState: AppState
    @State private var showSettings = false

    var body: some View {
        ZStack {
            Brand.backgroundPrimary
                .ignoresSafeArea()

            ScrollView(.vertical, showsIndicators: false) {
                VStack(spacing: 24) {
                    // Profile header
                    ProfileHeaderSection()

                    // Stats cards
                    StatsSection()

                    // Quick actions
                    QuickActionsSection(onSettingsTap: { showSettings = true })

                    // Recent activity
                    RecentActivitySection()
                }
                .padding(.horizontal, 16)
                .padding(.top, 16)
                .padding(.bottom, 100)
            }
        }
        .sheet(isPresented: $showSettings) {
            SettingsSheet()
        }
    }
}

// MARK: - Profile Header Section
struct ProfileHeaderSection: View {
    var body: some View {
        VStack(spacing: 16) {
            // Avatar
            ZStack {
                Circle()
                    .fill(Brand.primaryGradient)
                    .frame(width: 100, height: 100)

                Text("NM")
                    .font(.system(size: 36, weight: .bold))
                    .foregroundColor(.white)

                // Edit button
                Button(action: {}) {
                    Image(systemName: "pencil.circle.fill")
                        .font(.system(size: 28))
                        .foregroundStyle(.white, Brand.primaryStart)
                }
                .offset(x: 35, y: 35)
            }

            VStack(spacing: 4) {
                Text("Nick Mitchell")
                    .font(.system(size: 24, weight: .bold))
                    .foregroundColor(.white)

                Text("@nickmitchell")
                    .font(.system(size: 14))
                    .foregroundColor(Brand.textSecondary)
            }

            // Loop score badge
            HStack(spacing: 8) {
                Image(systemName: "bolt.fill")
                    .foregroundStyle(Brand.primaryGradient)

                Text("Loop Score: 847")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(.white)

                Image(systemName: "chevron.right")
                    .font(.system(size: 12))
                    .foregroundColor(Brand.textMuted)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 10)
            .background(
                Capsule()
                    .fill(Brand.backgroundSecondary)
            )

            // Subscription badge
            HStack(spacing: 6) {
                Image(systemName: "crown.fill")
                    .font(.system(size: 12))
                    .foregroundColor(.yellow)

                Text("Loop Premium")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(.yellow)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(
                Capsule()
                    .fill(Color.yellow.opacity(0.15))
            )
        }
        .padding(.vertical, 20)
        .frame(maxWidth: .infinity)
        .background(
            RoundedRectangle(cornerRadius: 20)
                .fill(Brand.backgroundSecondary)
        )
    }
}

// MARK: - Stats Section
struct StatsSection: View {
    var body: some View {
        HStack(spacing: 12) {
            StatCard(value: "127", label: "Activities", icon: "calendar.badge.checkmark")
            StatCard(value: "23", label: "Friends", icon: "person.2.fill")
            StatCard(value: "14", label: "Day Streak", icon: "flame.fill", iconColor: .orange)
        }
    }
}

struct StatCard: View {
    let value: String
    let label: String
    let icon: String
    var iconColor: Color = Brand.primaryStart

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundColor(iconColor)

            Text(value)
                .font(.system(size: 22, weight: .bold))
                .foregroundColor(.white)

            Text(label)
                .font(.system(size: 12))
                .foregroundColor(Brand.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Brand.backgroundSecondary)
        )
    }
}

// MARK: - Quick Actions Section
struct QuickActionsSection: View {
    let onSettingsTap: () -> Void

    var body: some View {
        VStack(spacing: 2) {
            QuickActionRow(icon: "person.text.rectangle", title: "Edit Profile", action: {})
            QuickActionRow(icon: "mappin.circle", title: "Saved Places", badge: 12, action: {})
            QuickActionRow(icon: "bell", title: "Notifications", action: {})
            QuickActionRow(icon: "lock.shield", title: "Privacy", action: {})
            QuickActionRow(icon: "gear", title: "Settings", action: onSettingsTap)
        }
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Brand.backgroundSecondary)
        )
    }
}

struct QuickActionRow: View {
    let icon: String
    let title: String
    var badge: Int? = nil
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 18))
                    .foregroundStyle(Brand.primaryGradient)
                    .frame(width: 28)

                Text(title)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(.white)

                Spacer()

                if let badge = badge {
                    Text("\(badge)")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(Brand.textSecondary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(
                            Capsule()
                                .fill(Brand.backgroundTertiary)
                        )
                }

                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(Brand.textMuted)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Recent Activity Section
struct RecentActivitySection: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Recent Activity")
                .font(.system(size: 18, weight: .bold))
                .foregroundColor(.white)

            VStack(spacing: 8) {
                ActivityRow(
                    icon: "checkmark.circle.fill",
                    iconColor: .green,
                    title: "Completed: Coffee at Houndstooth",
                    time: "2 hours ago"
                )

                ActivityRow(
                    icon: "hand.thumbsup.fill",
                    iconColor: Brand.primaryStart,
                    title: "Gave feedback on The Rustic",
                    time: "Yesterday"
                )

                ActivityRow(
                    icon: "person.2.fill",
                    iconColor: .purple,
                    title: "Joined group plan: Brunch with Sarah",
                    time: "2 days ago"
                )
            }
        }
    }
}

struct ActivityRow: View {
    let icon: String
    let iconColor: Color
    let title: String
    let time: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundColor(iconColor)
                .frame(width: 32, height: 32)
                .background(
                    Circle()
                        .fill(iconColor.opacity(0.15))
                )

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.white)
                    .lineLimit(1)

                Text(time)
                    .font(.system(size: 12))
                    .foregroundColor(Brand.textMuted)
            }

            Spacer()
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Brand.backgroundSecondary)
        )
    }
}

// MARK: - Settings Sheet
struct SettingsSheet: View {
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationView {
            List {
                Section("Account") {
                    Label("Email", systemImage: "envelope")
                    Label("Password", systemImage: "lock")
                    Label("Connected Accounts", systemImage: "link")
                }

                Section("Preferences") {
                    Label("Interests", systemImage: "heart")
                    Label("Home & Work", systemImage: "location")
                    Label("Calendar Sync", systemImage: "calendar")
                }

                Section("Subscription") {
                    Label("Manage Plan", systemImage: "creditcard")
                    Label("Billing History", systemImage: "doc.text")
                }

                Section("Support") {
                    Label("Help Center", systemImage: "questionmark.circle")
                    Label("Contact Us", systemImage: "envelope")
                    Label("Report a Problem", systemImage: "exclamationmark.triangle")
                }

                Section {
                    Button(action: {}) {
                        Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                            .foregroundColor(.red)
                    }
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(Brand.primaryGradient)
                }
            }
        }
    }
}

// MARK: - Preview
#Preview {
    ProfileView()
        .environmentObject(AppState())
        .preferredColorScheme(.dark)
}
