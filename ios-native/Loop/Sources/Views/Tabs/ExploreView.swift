//
//  ExploreView.swift
//  Loop
//
//  Search and discover activities
//

import SwiftUI

struct ExploreView: View {
    @State private var searchText = ""
    @State private var selectedCategory: String?
    @FocusState private var isSearchFocused: Bool

    private let categories = [
        ("Dining", "fork.knife", Color.orange),
        ("Coffee", "cup.and.saucer.fill", Color.brown),
        ("Entertainment", "theatermasks.fill", Color.purple),
        ("Fitness", "figure.run", Color.green),
        ("Nightlife", "moon.stars.fill", Color.pink),
        ("Outdoors", "leaf.fill", Color.mint),
        ("Shopping", "bag.fill", Color.yellow),
        ("Arts", "paintpalette.fill", Color.indigo),
    ]

    var body: some View {
        ZStack {
            Brand.backgroundPrimary
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Header with search
                VStack(spacing: 16) {
                    HStack {
                        Text("Explore")
                            .font(.system(size: 28, weight: .bold))
                            .foregroundColor(.white)
                        Spacer()
                    }

                    // Search bar
                    HStack(spacing: 12) {
                        Image(systemName: "magnifyingglass")
                            .foregroundColor(Brand.textMuted)

                        TextField("Search places, activities...", text: $searchText)
                            .foregroundColor(.white)
                            .focused($isSearchFocused)

                        if !searchText.isEmpty {
                            Button(action: { searchText = "" }) {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundColor(Brand.textMuted)
                            }
                        }
                    }
                    .padding(12)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Brand.backgroundSecondary)
                    )
                }
                .padding(.horizontal, 16)
                .padding(.top, 16)

                ScrollView(.vertical, showsIndicators: false) {
                    VStack(spacing: 24) {
                        // Categories grid
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Categories")
                                .font(.system(size: 18, weight: .bold))
                                .foregroundColor(.white)

                            LazyVGrid(columns: [
                                GridItem(.flexible()),
                                GridItem(.flexible()),
                                GridItem(.flexible()),
                                GridItem(.flexible())
                            ], spacing: 12) {
                                ForEach(categories, id: \.0) { name, icon, color in
                                    CategoryButton(
                                        name: name,
                                        icon: icon,
                                        color: color,
                                        isSelected: selectedCategory == name
                                    ) {
                                        withAnimation(.spring(response: 0.3)) {
                                            selectedCategory = selectedCategory == name ? nil : name
                                        }
                                    }
                                }
                            }
                        }

                        // Trending section
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Text("Trending Now")
                                    .font(.system(size: 18, weight: .bold))
                                    .foregroundColor(.white)

                                Image(systemName: "flame.fill")
                                    .foregroundColor(.orange)

                                Spacer()

                                Button("See All") {}
                                    .font(.system(size: 14, weight: .medium))
                                    .foregroundStyle(Brand.primaryGradient)
                            }

                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 12) {
                                    ForEach(0..<5) { index in
                                        TrendingCard(index: index)
                                    }
                                }
                            }
                        }

                        // Nearby section
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Text("Popular Nearby")
                                    .font(.system(size: 18, weight: .bold))
                                    .foregroundColor(.white)

                                Spacer()

                                Button("Map View") {}
                                    .font(.system(size: 14, weight: .medium))
                                    .foregroundStyle(Brand.primaryGradient)
                            }

                            ForEach(0..<3) { index in
                                NearbyPlaceRow(index: index)
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 20)
                    .padding(.bottom, 100)
                }
            }
        }
    }
}

// MARK: - Category Button
struct CategoryButton: View {
    let name: String
    let icon: String
    let color: Color
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 20))
                    .foregroundColor(isSelected ? .white : color)
                    .frame(width: 48, height: 48)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(isSelected ? color : color.opacity(0.15))
                    )

                Text(name)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(isSelected ? color : Brand.textSecondary)
                    .lineLimit(1)
            }
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Trending Card
struct TrendingCard: View {
    let index: Int

    private let places = [
        ("Deep Ellum Arts", "arts", Color.indigo),
        ("Katy Trail", "outdoors", Color.mint),
        ("Bishop Arts", "shopping", Color.yellow),
        ("Uptown Rooftops", "nightlife", Color.pink),
        ("White Rock Lake", "fitness", Color.green),
    ]

    var body: some View {
        let place = places[index % places.count]

        VStack(alignment: .leading, spacing: 8) {
            // Image placeholder
            RoundedRectangle(cornerRadius: 12)
                .fill(
                    LinearGradient(
                        colors: [place.2.opacity(0.8), place.2.opacity(0.4)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 140, height: 100)
                .overlay(
                    Image(systemName: "photo")
                        .font(.system(size: 24))
                        .foregroundColor(.white.opacity(0.5))
                )

            Text(place.0)
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(.white)
                .lineLimit(1)

            HStack(spacing: 4) {
                Image(systemName: "star.fill")
                    .font(.system(size: 10))
                    .foregroundColor(.yellow)
                Text("4.\(5 - index)")
                    .font(.system(size: 12))
                    .foregroundColor(Brand.textSecondary)
            }
        }
        .frame(width: 140)
    }
}

// MARK: - Nearby Place Row
struct NearbyPlaceRow: View {
    let index: Int

    private let places = [
        ("The Rustic", "Restaurant & Bar", "0.3 mi", 4.5),
        ("Pecan Lodge", "BBQ", "0.8 mi", 4.8),
        ("Truck Yard", "Beer Garden", "1.2 mi", 4.3),
    ]

    var body: some View {
        let place = places[index % places.count]

        HStack(spacing: 12) {
            // Image placeholder
            RoundedRectangle(cornerRadius: 8)
                .fill(Brand.cardGradient)
                .frame(width: 60, height: 60)
                .overlay(
                    Image(systemName: "mappin.circle.fill")
                        .font(.system(size: 24))
                        .foregroundColor(.white.opacity(0.7))
                )

            VStack(alignment: .leading, spacing: 4) {
                Text(place.0)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(.white)

                Text(place.1)
                    .font(.system(size: 13))
                    .foregroundColor(Brand.textSecondary)

                HStack(spacing: 8) {
                    HStack(spacing: 2) {
                        Image(systemName: "star.fill")
                            .font(.system(size: 11))
                            .foregroundColor(.yellow)
                        Text("\(place.3, specifier: "%.1f")")
                            .font(.system(size: 12))
                            .foregroundColor(Brand.textSecondary)
                    }

                    Text("·")
                        .foregroundColor(Brand.textMuted)

                    Text(place.2)
                        .font(.system(size: 12))
                        .foregroundColor(Brand.textMuted)
                }
            }

            Spacer()

            Button(action: {}) {
                Image(systemName: "plus.circle")
                    .font(.system(size: 24))
                    .foregroundStyle(Brand.primaryGradient)
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Brand.backgroundSecondary)
        )
    }
}

// MARK: - Preview
#Preview {
    ExploreView()
        .environmentObject(AppState())
        .preferredColorScheme(.dark)
}
