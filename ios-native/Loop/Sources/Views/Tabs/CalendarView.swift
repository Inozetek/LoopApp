//
//  CalendarView.swift
//  Loop
//
//  Calendar with Loop route visualization
//

import SwiftUI

struct CalendarView: View {
    @State private var selectedDate = Date()
    @State private var showLoopView = false
    @State private var tasks: [CalendarTask] = CalendarTask.samples

    var body: some View {
        ZStack {
            Brand.backgroundPrimary
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Header
                CalendarHeader(
                    selectedDate: $selectedDate,
                    onLoopTap: { showLoopView = true }
                )

                // Calendar grid
                CalendarGrid(selectedDate: $selectedDate)
                    .padding(.horizontal, 16)

                // Today's tasks
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Text("Today's Loop")
                            .font(.system(size: 18, weight: .bold))
                            .foregroundColor(.white)

                        Spacer()

                        Button(action: {}) {
                            Image(systemName: "plus.circle.fill")
                                .font(.system(size: 24))
                                .foregroundStyle(Brand.primaryGradient)
                        }
                    }

                    ScrollView(.vertical, showsIndicators: false) {
                        LazyVStack(spacing: 12) {
                            ForEach(tasks) { task in
                                TaskRow(task: task)
                            }
                        }
                        .padding(.bottom, 100)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 20)
            }
        }
        .sheet(isPresented: $showLoopView) {
            LoopMapView(tasks: tasks)
        }
    }
}

// MARK: - Calendar Header
struct CalendarHeader: View {
    @Binding var selectedDate: Date
    let onLoopTap: () -> Void

    private var monthYearString: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMMM yyyy"
        return formatter.string(from: selectedDate)
    }

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(monthYearString)
                    .font(.system(size: 24, weight: .bold))
                    .foregroundColor(.white)

                Text("3 activities planned")
                    .font(.system(size: 14))
                    .foregroundColor(Brand.textSecondary)
            }

            Spacer()

            // Loop view button
            Button(action: onLoopTap) {
                HStack(spacing: 6) {
                    Image(systemName: "map")
                        .font(.system(size: 14))
                    Text("Loop")
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
        }
        .padding(.horizontal, 16)
        .padding(.top, 16)
        .padding(.bottom, 12)
    }
}

// MARK: - Calendar Grid
struct CalendarGrid: View {
    @Binding var selectedDate: Date

    private let columns = Array(repeating: GridItem(.flexible()), count: 7)
    private let weekdays = ["S", "M", "T", "W", "T", "F", "S"]

    var body: some View {
        VStack(spacing: 8) {
            // Weekday headers
            HStack {
                ForEach(weekdays, id: \.self) { day in
                    Text(day)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(Brand.textMuted)
                        .frame(maxWidth: .infinity)
                }
            }

            // Calendar days
            LazyVGrid(columns: columns, spacing: 8) {
                ForEach(0..<35) { index in
                    let day = index - 6 // Offset for month start
                    if day > 0 && day <= 31 {
                        CalendarDayCell(
                            day: day,
                            isSelected: day == Calendar.current.component(.day, from: selectedDate),
                            hasEvents: [5, 12, 15, 22, 28].contains(day)
                        )
                        .onTapGesture {
                            // Update selected date
                        }
                    } else {
                        Color.clear
                            .frame(height: 40)
                    }
                }
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Brand.backgroundSecondary)
        )
    }
}

struct CalendarDayCell: View {
    let day: Int
    let isSelected: Bool
    let hasEvents: Bool

    var body: some View {
        VStack(spacing: 4) {
            Text("\(day)")
                .font(.system(size: 16, weight: isSelected ? .bold : .regular))
                .foregroundColor(isSelected ? .white : Brand.textSecondary)
                .frame(width: 36, height: 36)
                .background(
                    Group {
                        if isSelected {
                            Circle()
                                .fill(Brand.primaryGradient)
                        }
                    }
                )

            // Event indicator
            if hasEvents && !isSelected {
                Circle()
                    .fill(Brand.primaryStart)
                    .frame(width: 6, height: 6)
            } else {
                Circle()
                    .fill(Color.clear)
                    .frame(width: 6, height: 6)
            }
        }
    }
}

// MARK: - Task Row
struct TaskRow: View {
    let task: CalendarTask

    var body: some View {
        HStack(spacing: 12) {
            // Time
            VStack(alignment: .trailing, spacing: 2) {
                Text(task.timeString)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.white)
                Text(task.duration)
                    .font(.system(size: 11))
                    .foregroundColor(Brand.textMuted)
            }
            .frame(width: 50)

            // Color bar
            RoundedRectangle(cornerRadius: 2)
                .fill(task.categoryColor)
                .frame(width: 4)

            // Task details
            VStack(alignment: .leading, spacing: 4) {
                Text(task.title)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(.white)

                HStack(spacing: 4) {
                    Image(systemName: "mappin")
                        .font(.system(size: 11))
                    Text(task.location)
                        .font(.system(size: 13))
                }
                .foregroundColor(Brand.textSecondary)
            }

            Spacer()

            // Category icon
            Image(systemName: task.categoryIcon)
                .font(.system(size: 18))
                .foregroundColor(task.categoryColor)
                .frame(width: 40, height: 40)
                .background(
                    Circle()
                        .fill(task.categoryColor.opacity(0.15))
                )
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Brand.backgroundSecondary)
        )
    }
}

// MARK: - Loop Map View
struct LoopMapView: View {
    let tasks: [CalendarTask]
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationView {
            ZStack {
                Brand.backgroundPrimary
                    .ignoresSafeArea()

                VStack {
                    // Map placeholder
                    RoundedRectangle(cornerRadius: 16)
                        .fill(Brand.backgroundTertiary)
                        .overlay(
                            VStack(spacing: 12) {
                                Image(systemName: "map")
                                    .font(.system(size: 48))
                                    .foregroundColor(Brand.textMuted)
                                Text("Loop Map View")
                                    .font(.system(size: 16, weight: .medium))
                                    .foregroundColor(Brand.textSecondary)
                                Text("Shows your day's route with all tasks connected")
                                    .font(.system(size: 14))
                                    .foregroundColor(Brand.textMuted)
                                    .multilineTextAlignment(.center)
                            }
                        )
                        .padding()

                    // Task list
                    ScrollView {
                        VStack(spacing: 8) {
                            ForEach(Array(tasks.enumerated()), id: \.element.id) { index, task in
                                HStack {
                                    Text("\(index + 1)")
                                        .font(.system(size: 14, weight: .bold))
                                        .foregroundColor(.white)
                                        .frame(width: 24, height: 24)
                                        .background(Circle().fill(Brand.primaryGradient))

                                    Text(task.title)
                                        .font(.system(size: 14, weight: .medium))
                                        .foregroundColor(.white)

                                    Spacer()

                                    Text(task.timeString)
                                        .font(.system(size: 12))
                                        .foregroundColor(Brand.textMuted)
                                }
                                .padding(.horizontal, 16)
                                .padding(.vertical, 8)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Today's Loop")
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
    CalendarView()
        .environmentObject(AppState())
        .preferredColorScheme(.dark)
}
