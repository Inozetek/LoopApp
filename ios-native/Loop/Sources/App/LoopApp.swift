//
//  LoopApp.swift
//  Loop
//
//  Main entry point for the Loop iOS app
//

import SwiftUI

@main
struct LoopApp: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .preferredColorScheme(.dark) // Loop is dark-mode first
        }
    }
}

// MARK: - App State
class AppState: ObservableObject {
    @Published var isAuthenticated = false
    @Published var currentUser: User?
    @Published var notifications = TabNotifications()

    struct TabNotifications {
        var calendar: Int = 0
        var explore: Int = 0
        var recommendations: Int = 3 // Show badge on For You
        var friends: Int = 2
        var profile: Int = 0
    }
}

// MARK: - Content View (Root)
struct ContentView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        MainTabView()
    }
}
