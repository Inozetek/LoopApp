//
//  ForYouView.swift
//  Loop
//
//  AI-powered recommendations feed (center tab)
//

import SwiftUI

struct ForYouView: View {
    @State private var recommendations: [Recommendation] = Recommendation.samples
    @State private var showFilterSheet = false
    @State private var showMainMenu = false

    var body: some View {
        ZStack {
            // Background
            Brand.backgroundPrimary
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Header
                ForYouHeader(
                    onMenuTap: { showMainMenu = true },
                    onFilterTap: { showFilterSheet = true }
                )

                // Tagline
                Text("Your perfect day starts here")
                    .font(.system(size: 16, weight: .regular))
                    .foregroundColor(Brand.textSecondary)
                    .padding(.top, 8)
                    .padding(.bottom, 16)

                // Recommendations scroll
                ScrollView(.vertical, showsIndicators: false) {
                    LazyVStack(spacing: 16) {
                        ForEach(recommendations) { recommendation in
                            RecommendationCard(recommendation: recommendation)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 100) // Space for tab bar
                }
            }
        }
        .sheet(isPresented: $showFilterSheet) {
            FilterSheet()
                .presentationDetents([.medium])
                .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showMainMenu) {
            MainMenuSheet()
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
    }
}

// MARK: - For You Header
struct ForYouHeader: View {
    let onMenuTap: () -> Void
    let onFilterTap: () -> Void

    var body: some View {
        HStack {
            // Menu button
            Button(action: onMenuTap) {
                Image(systemName: "line.3.horizontal")
                    .font(.system(size: 20, weight: .medium))
                    .foregroundColor(Brand.textPrimary)
            }

            Spacer()

            // Loop logo
            LoopLogo()

            Spacer()

            // Filter button
            Button(action: onFilterTap) {
                Image(systemName: "slider.horizontal.3")
                    .font(.system(size: 20, weight: .medium))
                    .foregroundColor(Brand.textPrimary)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }
}

// MARK: - Loop Logo
struct LoopLogo: View {
    var body: some View {
        VStack(spacing: 2) {
            // Interlocking rings
            ZStack {
                Circle()
                    .stroke(Brand.primaryGradient, lineWidth: 2.5)
                    .frame(width: 24, height: 24)
                    .offset(x: -6)

                Circle()
                    .stroke(Brand.primaryGradient, lineWidth: 2.5)
                    .frame(width: 24, height: 24)
                    .offset(x: 6)
            }

            // Dropdown chevron
            Image(systemName: "chevron.down")
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(Brand.primaryGradient)
        }
    }
}

// MARK: - Recommendation Card
struct RecommendationCard: View {
    let recommendation: Recommendation
    @State private var showDetails = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Image section with gradient overlay
            ZStack(alignment: .topLeading) {
                // Background gradient (placeholder for image)
                RoundedRectangle(cornerRadius: 16)
                    .fill(Brand.cardGradient)
                    .frame(height: 280)

                // Category badge
                Text(recommendation.category.capitalized)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(
                        Capsule()
                            .fill(.ultraThinMaterial)
                    )
                    .padding(12)

                // Quick action button
                Button(action: {}) {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.white)
                        .frame(width: 32, height: 32)
                        .background(
                            Circle()
                                .fill(.ultraThinMaterial)
                        )
                }
                .position(x: 28, y: 28)

                // Center pin icon
                VStack {
                    Spacer()
                    Image(systemName: "mappin.circle.fill")
                        .font(.system(size: 48))
                        .foregroundStyle(.white.opacity(0.9))
                    Spacer()
                }
                .frame(maxWidth: .infinity)
            }

            // Info section
            VStack(alignment: .leading, spacing: 8) {
                Text(recommendation.name)
                    .font(.system(size: 22, weight: .bold))
                    .foregroundColor(.white)

                // Rating, price, distance
                HStack(spacing: 4) {
                    // Stars
                    HStack(spacing: 2) {
                        ForEach(0..<5) { index in
                            Image(systemName: index < Int(recommendation.rating) ? "star.fill" : "star")
                                .font(.system(size: 12))
                                .foregroundColor(.yellow)
                        }
                    }

                    Text("(\(recommendation.reviewCount))")
                        .font(.system(size: 14))
                        .foregroundColor(Brand.textSecondary)

                    Text("·")
                        .foregroundColor(Brand.textMuted)

                    Text(recommendation.priceRange)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.white)

                    Text("·")
                        .foregroundColor(Brand.textMuted)

                    Text(recommendation.distance)
                        .font(.system(size: 14))
                        .foregroundColor(Brand.textSecondary)
                }

                // AI reason
                HStack(spacing: 6) {
                    Image(systemName: "sparkles")
                        .font(.system(size: 12))
                        .foregroundStyle(Brand.primaryGradient)

                    Text(recommendation.aiReason)
                        .font(.system(size: 14))
                        .foregroundColor(Brand.textSecondary)

                    Spacer()

                    Button(action: { showDetails.toggle() }) {
                        HStack(spacing: 4) {
                            Text("Why?")
                                .font(.system(size: 14, weight: .medium))
                            Image(systemName: showDetails ? "chevron.up" : "chevron.down")
                                .font(.system(size: 12))
                        }
                        .foregroundStyle(Brand.primaryGradient)
                    }
                }

                // Score breakdown (expandable)
                if showDetails {
                    ScoreBreakdown(recommendation: recommendation)
                        .transition(.opacity.combined(with: .move(edge: .top)))
                }

                // Add to calendar button
                HStack {
                    Spacer()
                    Button(action: {}) {
                        Image(systemName: "plus")
                            .font(.system(size: 20, weight: .bold))
                            .foregroundColor(.white)
                            .frame(width: 48, height: 48)
                            .background(
                                Circle()
                                    .fill(Brand.primaryGradient)
                            )
                            .shadow(color: Brand.primaryStart.opacity(0.4), radius: 8, y: 4)
                    }
                }
            }
            .padding(16)
            .background(Brand.backgroundSecondary)
        }
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .shadow(color: .black.opacity(0.3), radius: 12, y: 6)
    }
}

// MARK: - Score Breakdown
struct ScoreBreakdown: View {
    let recommendation: Recommendation

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Score bar
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    // Background track
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Brand.backgroundTertiary)
                        .frame(height: 8)

                    // Score segments
                    HStack(spacing: 2) {
                        // Interest (blue)
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color.blue)
                            .frame(width: geo.size.width * 0.3, height: 8)

                        // Location (green)
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color.green)
                            .frame(width: geo.size.width * 0.25, height: 8)

                        // Time (yellow)
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color.yellow)
                            .frame(width: geo.size.width * 0.15, height: 8)

                        // Feedback (orange)
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color.orange)
                            .frame(width: geo.size.width * 0.1, height: 8)
                    }
                }
            }
            .frame(height: 8)

            // Legend
            HStack(spacing: 16) {
                ScoreLegendItem(color: .blue, label: "Interest")
                ScoreLegendItem(color: .green, label: "Location")
                ScoreLegendItem(color: .yellow, label: "Time")
                ScoreLegendItem(color: .orange, label: "Feedback")
            }
        }
        .padding(.top, 8)
    }
}

struct ScoreLegendItem: View {
    let color: Color
    let label: String

    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(color)
                .frame(width: 8, height: 8)
            Text(label)
                .font(.system(size: 11))
                .foregroundColor(Brand.textMuted)
        }
    }
}

// MARK: - Filter Sheet
struct FilterSheet: View {
    var body: some View {
        NavigationView {
            VStack {
                Text("Filters coming soon")
                    .foregroundColor(Brand.textSecondary)
            }
            .navigationTitle("Filters")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

// MARK: - Main Menu Sheet
struct MainMenuSheet: View {
    var body: some View {
        NavigationView {
            List {
                Section("Account") {
                    Label("Settings", systemImage: "gear")
                    Label("Notifications", systemImage: "bell")
                    Label("Privacy", systemImage: "lock")
                }

                Section("Business") {
                    Label("Business Dashboard", systemImage: "chart.bar")
                    Label("Manage Listings", systemImage: "building.2")
                    Label("Analytics", systemImage: "chart.pie")
                }

                Section("Support") {
                    Label("Help Center", systemImage: "questionmark.circle")
                    Label("Send Feedback", systemImage: "envelope")
                }
            }
            .navigationTitle("Menu")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

// MARK: - Preview
#Preview {
    ForYouView()
        .environmentObject(AppState())
        .preferredColorScheme(.dark)
}
