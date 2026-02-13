//
//  FriendsView.swift
//  Loop
//
//  Friends list and group planning
//

import SwiftUI

struct FriendsView: View {
    @State private var searchText = ""
    @State private var showGroupPlanning = false
    @State private var selectedFriends: Set<String> = []
    @EnvironmentObject var appState: AppState

    var body: some View {
        ZStack {
            Brand.backgroundPrimary
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Header
                FriendsHeader(
                    friendCount: Friend.samples.count,
                    onAddTap: {},
                    onGroupTap: { showGroupPlanning = true }
                )

                // Search bar
                HStack(spacing: 12) {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(Brand.textMuted)

                    TextField("Search friends", text: $searchText)
                        .foregroundColor(.white)
                }
                .padding(12)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Brand.backgroundSecondary)
                )
                .padding(.horizontal, 16)
                .padding(.top, 8)

                // Group invitations section
                if appState.notifications.friends > 0 {
                    GroupInvitationsSection()
                        .padding(.horizontal, 16)
                        .padding(.top, 16)
                }

                // Friends list
                ScrollView(.vertical, showsIndicators: false) {
                    LazyVStack(spacing: 12) {
                        ForEach(Friend.samples) { friend in
                            FriendRow(
                                friend: friend,
                                isSelected: selectedFriends.contains(friend.id),
                                selectionMode: showGroupPlanning
                            ) {
                                if showGroupPlanning {
                                    if selectedFriends.contains(friend.id) {
                                        selectedFriends.remove(friend.id)
                                    } else {
                                        selectedFriends.insert(friend.id)
                                    }
                                }
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 16)
                    .padding(.bottom, 100)
                }
            }
        }
        .sheet(isPresented: $showGroupPlanning) {
            GroupPlanningSheet(selectedFriends: selectedFriends)
        }
    }
}

// MARK: - Friends Header
struct FriendsHeader: View {
    let friendCount: Int
    let onAddTap: () -> Void
    let onGroupTap: () -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("Friends")
                    .font(.system(size: 28, weight: .bold))
                    .foregroundColor(.white)

                Text("\(friendCount) friends")
                    .font(.system(size: 14))
                    .foregroundColor(Brand.textSecondary)
            }

            Spacer()

            // Group plan button
            Button(action: onGroupTap) {
                HStack(spacing: 6) {
                    Image(systemName: "person.3.fill")
                        .font(.system(size: 14))
                    Text("Plan")
                        .font(.system(size: 14, weight: .semibold))
                }
                .foregroundColor(.white)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(
                    Capsule()
                        .fill(Brand.primaryGradient)
                )
            }

            // Add friend button
            Button(action: onAddTap) {
                Image(systemName: "person.badge.plus")
                    .font(.system(size: 20))
                    .foregroundColor(Brand.textPrimary)
            }
            .padding(.leading, 8)
        }
        .padding(.horizontal, 16)
        .padding(.top, 16)
    }
}

// MARK: - Group Invitations Section
struct GroupInvitationsSection: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Pending Invitations")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(.white)

                Text("2")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(Capsule().fill(Color.red))
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    GroupInvitationCard(
                        title: "Brunch @ Maple Leaf",
                        host: "Sarah",
                        time: "Sun 11am",
                        attendees: 4
                    )

                    GroupInvitationCard(
                        title: "Game Night",
                        host: "Mike",
                        time: "Fri 8pm",
                        attendees: 6
                    )
                }
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Brand.backgroundSecondary)
        )
    }
}

struct GroupInvitationCard: View {
    let title: String
    let host: String
    let time: String
    let attendees: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(.white)

            HStack(spacing: 4) {
                Image(systemName: "person.fill")
                    .font(.system(size: 10))
                Text(host)
                    .font(.system(size: 12))
            }
            .foregroundColor(Brand.textSecondary)

            HStack {
                HStack(spacing: 4) {
                    Image(systemName: "clock")
                        .font(.system(size: 10))
                    Text(time)
                        .font(.system(size: 12))
                }
                .foregroundColor(Brand.textMuted)

                Spacer()

                Text("\(attendees) going")
                    .font(.system(size: 11))
                    .foregroundColor(Brand.primaryStart)
            }

            HStack(spacing: 8) {
                Button("Accept") {}
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                    .background(Brand.primaryGradient)
                    .cornerRadius(8)

                Button("Decline") {}
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(Brand.textMuted)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                    .background(Brand.backgroundTertiary)
                    .cornerRadius(8)
            }
        }
        .frame(width: 180)
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Brand.backgroundTertiary)
        )
    }
}

// MARK: - Friend Row
struct FriendRow: View {
    let friend: Friend
    let isSelected: Bool
    let selectionMode: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                // Selection indicator
                if selectionMode {
                    Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                        .font(.system(size: 22))
                        .foregroundStyle(isSelected ? Brand.primaryGradient : Color(Brand.textMuted))
                }

                // Avatar
                ZStack {
                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [friend.avatarColor, friend.avatarColor.opacity(0.6)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 48, height: 48)

                    Text(friend.initials)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(.white)

                    // Online indicator
                    if friend.isOnline {
                        Circle()
                            .fill(Color.green)
                            .frame(width: 12, height: 12)
                            .overlay(
                                Circle()
                                    .stroke(Brand.backgroundPrimary, lineWidth: 2)
                            )
                            .offset(x: 16, y: 16)
                    }
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text(friend.name)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(.white)

                    HStack(spacing: 8) {
                        // Loop score
                        HStack(spacing: 4) {
                            Image(systemName: "bolt.fill")
                                .font(.system(size: 10))
                                .foregroundStyle(Brand.primaryGradient)
                            Text("\(friend.loopScore)")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundColor(Brand.textSecondary)
                        }

                        if let status = friend.currentActivity {
                            Text("·")
                                .foregroundColor(Brand.textMuted)

                            Text(status)
                                .font(.system(size: 12))
                                .foregroundColor(Brand.textMuted)
                                .lineLimit(1)
                        }
                    }
                }

                Spacer()

                if !selectionMode {
                    // View Loop button
                    Button(action: {}) {
                        Text("Loop")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(Brand.primaryStart)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(
                                Capsule()
                                    .stroke(Brand.primaryStart, lineWidth: 1)
                            )
                    }
                }
            }
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(isSelected ? Brand.primaryStart.opacity(0.15) : Brand.backgroundSecondary)
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Group Planning Sheet
struct GroupPlanningSheet: View {
    let selectedFriends: Set<String>
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationView {
            ZStack {
                Brand.backgroundPrimary
                    .ignoresSafeArea()

                VStack(spacing: 24) {
                    // Selected friends preview
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Planning with")
                            .font(.system(size: 14))
                            .foregroundColor(Brand.textSecondary)

                        HStack(spacing: -8) {
                            ForEach(Array(selectedFriends.prefix(5)), id: \.self) { friendId in
                                Circle()
                                    .fill(Brand.primaryGradient)
                                    .frame(width: 36, height: 36)
                                    .overlay(
                                        Circle()
                                            .stroke(Brand.backgroundPrimary, lineWidth: 2)
                                    )
                            }

                            if selectedFriends.count > 5 {
                                Circle()
                                    .fill(Brand.backgroundTertiary)
                                    .frame(width: 36, height: 36)
                                    .overlay(
                                        Text("+\(selectedFriends.count - 5)")
                                            .font(.system(size: 12, weight: .medium))
                                            .foregroundColor(.white)
                                    )
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 16)

                    // Suggestions placeholder
                    VStack(spacing: 12) {
                        Image(systemName: "sparkles")
                            .font(.system(size: 48))
                            .foregroundStyle(Brand.primaryGradient)

                        Text("Finding the perfect spot...")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundColor(.white)

                        Text("Looking for activities that work for everyone's interests and location")
                            .font(.system(size: 14))
                            .foregroundColor(Brand.textSecondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 32)
                    }
                    .frame(maxHeight: .infinity)

                    Spacer()
                }
                .padding(.top, 24)
            }
            .navigationTitle("Group Plan")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") { dismiss() }
                        .foregroundColor(Brand.textSecondary)
                }
            }
        }
    }
}

// MARK: - Preview
#Preview {
    FriendsView()
        .environmentObject(AppState())
        .preferredColorScheme(.dark)
}
