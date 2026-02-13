//
//  Models.swift
//  Loop
//
//  Data models for the Loop app
//

import SwiftUI

// MARK: - User
struct User: Identifiable, Codable {
    let id: String
    var email: String
    var name: String
    var username: String?
    var profilePictureUrl: String?
    var homeLocation: Location?
    var workLocation: Location?
    var interests: [String]
    var subscriptionTier: SubscriptionTier
    var loopScore: Int
    var streakDays: Int

    enum SubscriptionTier: String, Codable {
        case free
        case plus
        case premium
    }
}

// MARK: - Location
struct Location: Codable {
    let latitude: Double
    let longitude: Double
    var address: String?
}

// MARK: - Recommendation
struct Recommendation: Identifiable {
    let id: String
    let name: String
    let category: String
    let description: String
    let rating: Double
    let reviewCount: Int
    let priceRange: String
    let distance: String
    let location: Location
    let imageUrl: String?
    let aiReason: String
    let scoreBreakdown: ScoreBreakdown
    let isSponsored: Bool

    struct ScoreBreakdown {
        var interest: Double
        var location: Double
        var time: Double
        var feedback: Double

        var total: Double {
            interest + location + time + feedback
        }
    }
}

// MARK: - Sample Recommendations
extension Recommendation {
    static var samples: [Recommendation] {
        [
            Recommendation(
                id: "1",
                name: "John F. Kennedy Memorial Plaza",
                category: "other",
                description: "Historic memorial plaza in downtown Dallas",
                rating: 4.0,
                reviewCount: 4872,
                priceRange: "$$",
                distance: "14.7 mi",
                location: Location(latitude: 32.7789, longitude: -96.8086),
                imageUrl: nil,
                aiReason: "Highly rated other spot — 4.5★",
                scoreBreakdown: ScoreBreakdown(interest: 30, location: 25, time: 15, feedback: 10),
                isSponsored: false
            ),
            Recommendation(
                id: "2",
                name: "Deep Ellum Brewing",
                category: "nightlife",
                description: "Local craft brewery with taproom",
                rating: 4.5,
                reviewCount: 2341,
                priceRange: "$$",
                distance: "3.2 mi",
                location: Location(latitude: 32.7841, longitude: -96.7827),
                imageUrl: nil,
                aiReason: "Popular with locals who love craft beer",
                scoreBreakdown: ScoreBreakdown(interest: 35, location: 30, time: 10, feedback: 15),
                isSponsored: false
            ),
            Recommendation(
                id: "3",
                name: "Pecan Lodge",
                category: "dining",
                description: "Famous Texas BBQ in Deep Ellum",
                rating: 4.8,
                reviewCount: 8234,
                priceRange: "$$$",
                distance: "3.5 mi",
                location: Location(latitude: 32.7843, longitude: -96.7815),
                imageUrl: nil,
                aiReason: "Top-rated BBQ, perfect for lunch",
                scoreBreakdown: ScoreBreakdown(interest: 40, location: 25, time: 20, feedback: 10),
                isSponsored: true
            ),
        ]
    }
}

// MARK: - Calendar Task
struct CalendarTask: Identifiable {
    let id: String
    let title: String
    let category: String
    let location: String
    let startTime: Date
    let endTime: Date
    let latitude: Double
    let longitude: Double

    var timeString: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "h:mm a"
        return formatter.string(from: startTime)
    }

    var duration: String {
        let minutes = Int(endTime.timeIntervalSince(startTime) / 60)
        if minutes >= 60 {
            return "\(minutes / 60)h"
        }
        return "\(minutes)m"
    }

    var categoryIcon: String {
        switch category.lowercased() {
        case "dining": return "fork.knife"
        case "coffee": return "cup.and.saucer.fill"
        case "fitness": return "figure.run"
        case "entertainment": return "theatermasks.fill"
        case "work": return "briefcase.fill"
        case "personal": return "person.fill"
        default: return "mappin"
        }
    }

    var categoryColor: Color {
        Brand.categoryColors[category.lowercased()] ?? Brand.textMuted
    }
}

// MARK: - Sample Tasks
extension CalendarTask {
    static var samples: [CalendarTask] {
        let calendar = Calendar.current
        let today = Date()

        return [
            CalendarTask(
                id: "1",
                title: "Coffee at Houndstooth",
                category: "coffee",
                location: "1900 N Henderson Ave",
                startTime: calendar.date(bySettingHour: 9, minute: 0, second: 0, of: today)!,
                endTime: calendar.date(bySettingHour: 10, minute: 0, second: 0, of: today)!,
                latitude: 32.8135,
                longitude: -96.7945
            ),
            CalendarTask(
                id: "2",
                title: "Lunch at Pecan Lodge",
                category: "dining",
                location: "2702 Main St",
                startTime: calendar.date(bySettingHour: 12, minute: 30, second: 0, of: today)!,
                endTime: calendar.date(bySettingHour: 14, minute: 0, second: 0, of: today)!,
                latitude: 32.7843,
                longitude: -96.7815
            ),
            CalendarTask(
                id: "3",
                title: "Gym Session",
                category: "fitness",
                location: "Equinox Highland Park",
                startTime: calendar.date(bySettingHour: 17, minute: 30, second: 0, of: today)!,
                endTime: calendar.date(bySettingHour: 19, minute: 0, second: 0, of: today)!,
                latitude: 32.8295,
                longitude: -96.8055
            ),
        ]
    }
}

// MARK: - Friend
struct Friend: Identifiable {
    let id: String
    let name: String
    let username: String
    let loopScore: Int
    let isOnline: Bool
    let currentActivity: String?
    let avatarColor: Color

    var initials: String {
        let parts = name.split(separator: " ")
        if parts.count >= 2 {
            return "\(parts[0].prefix(1))\(parts[1].prefix(1))"
        }
        return String(name.prefix(2)).uppercased()
    }
}

// MARK: - Sample Friends
extension Friend {
    static var samples: [Friend] {
        [
            Friend(
                id: "1",
                name: "Sarah Chen",
                username: "sarahc",
                loopScore: 923,
                isOnline: true,
                currentActivity: "At The Rustic",
                avatarColor: .purple
            ),
            Friend(
                id: "2",
                name: "Mike Johnson",
                username: "mikej",
                loopScore: 756,
                isOnline: true,
                currentActivity: nil,
                avatarColor: .blue
            ),
            Friend(
                id: "3",
                name: "Emily Rodriguez",
                username: "emilyr",
                loopScore: 891,
                isOnline: false,
                currentActivity: nil,
                avatarColor: .pink
            ),
            Friend(
                id: "4",
                name: "Alex Kim",
                username: "alexk",
                loopScore: 634,
                isOnline: true,
                currentActivity: "On the way to gym",
                avatarColor: .orange
            ),
            Friend(
                id: "5",
                name: "Jordan Taylor",
                username: "jordant",
                loopScore: 812,
                isOnline: false,
                currentActivity: nil,
                avatarColor: .mint
            ),
        ]
    }
}

// MARK: - Group Plan
struct GroupPlan: Identifiable {
    let id: String
    let title: String
    let activityId: String?
    let creatorId: String
    let suggestedTime: Date
    let meetingLocation: Location
    let meetingAddress: String
    let status: Status
    let participants: [Participant]

    enum Status: String {
        case proposed
        case confirmed
        case completed
        case cancelled
    }

    struct Participant: Identifiable {
        let id: String
        let userId: String
        let rsvpStatus: RSVPStatus
        let travelTime: Int? // minutes

        enum RSVPStatus: String {
            case invited
            case accepted
            case declined
            case maybe
        }
    }
}
