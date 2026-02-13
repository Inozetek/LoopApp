# Loop iOS Native App

Native SwiftUI implementation of Loop with glass effects, ready for iOS 26 Liquid Glass upgrade.

## Requirements

### Current Development (Your 2018 MacBook)
- **macOS**: Monterey 12.0+ (your Mac should support this)
- **Xcode**: 14.0+ (available on your Mac)
- **iOS Target**: iOS 15.0+
- **Device**: iPhone for testing

### Future Liquid Glass Upgrade (Cloud Mac)
- **macOS**: macOS 26+ (requires newer Mac or cloud service)
- **Xcode**: 26+
- **iOS Target**: iOS 26+

## Quick Start

### 1. Clone/Pull on Your MacBook
```bash
cd ~/Projects  # or wherever you keep code
git clone <your-repo-url>
cd LoopApp
```

### 2. Open in Xcode
```bash
# Open Xcode and create a new project
# File > New > Project
# Choose: iOS > App
# Product Name: Loop
# Team: Your Apple ID
# Organization Identifier: com.yourname
# Interface: SwiftUI
# Language: Swift
```

### 3. Add Source Files
After creating the project:
1. Delete the default `ContentView.swift`
2. Drag all files from `ios-native/Loop/Sources/` into your Xcode project
3. Make sure "Copy items if needed" is checked
4. Add to target: Loop

### 4. Run on Device
1. Connect your iPhone via USB
2. Select your device in Xcode's device dropdown
3. Press Cmd+R to build and run
4. Trust the developer on your iPhone: Settings > General > Device Management

## Project Structure

```
ios-native/Loop/Sources/
├── App/
│   └── LoopApp.swift          # App entry point
├── Theme/
│   └── Brand.swift            # Colors, gradients, design tokens
├── Models/
│   └── Models.swift           # Data models (User, Recommendation, etc.)
├── Views/
│   ├── MainTabView.swift      # Tab navigation with glass tab bar
│   ├── Tabs/
│   │   ├── ForYouView.swift   # AI recommendations (center tab)
│   │   ├── CalendarView.swift # Calendar with Loop route view
│   │   ├── ExploreView.swift  # Search and discover
│   │   ├── FriendsView.swift  # Friends and group planning
│   │   └── ProfileView.swift  # Profile and settings
│   └── Components/
│       └── GlassEffects.swift # Reusable glass components
├── Services/
│   └── (Supabase integration - to be added)
└── Resources/
    └── (Assets - to be added)
```

## Current Glass Effects (iOS 15+)

The app uses these SwiftUI materials that work on your 2018 MacBook:
- `.ultraThinMaterial` - Most transparent
- `.thinMaterial` - Light blur
- `.regularMaterial` - Standard glass
- Custom gradients for premium look

## Upgrading to Liquid Glass (iOS 26+)

When you're ready to use the real Liquid Glass APIs:

### 1. Get Access to Xcode 26
- **Option A**: Use a cloud Mac service (~$30-50/month)
  - [MacStadium](https://www.macstadium.com/)
  - [MacinCloud](https://www.macincloud.com/)
  - [AWS EC2 Mac](https://aws.amazon.com/ec2/instance-types/mac/)
- **Option B**: Buy a newer Mac (M1/M2/M3)

### 2. Update GlassEffects.swift
Replace the current implementations with native APIs:

```swift
// BEFORE (iOS 15+)
.background(.ultraThinMaterial)

// AFTER (iOS 26+)
.glassEffect()

// BEFORE (iOS 15+)
RoundedRectangle(cornerRadius: 20)
    .fill(.thinMaterial)

// AFTER (iOS 26+)
RoundedRectangle(cornerRadius: 20)
    .glassEffect(.regular)
```

### 3. Update Tab Bar
The `GlassLens` and `GlassBackground` in `MainTabView.swift` can use:
```swift
// Native Liquid Glass for tab bar
.glassEffect(.prominent)
```

## Testing Workflow

### Development Cycle
1. **Write code** on your Windows PC (faster, better screen)
2. **Commit & push** to Git
3. **Pull on MacBook**
4. **Build & test** on iPhone via USB

### TestFlight (Later)
1. Archive in Xcode: Product > Archive
2. Upload to App Store Connect
3. Add testers via email
4. Testers download via TestFlight app

## Shared Backend

Both iOS native and React Native (Android) apps share:
- Supabase database
- Supabase Auth
- Same API endpoints
- Same business logic

The Supabase Swift SDK will be integrated in `Services/SupabaseService.swift`.

## Commands Reference

```bash
# Build for device
Cmd+R

# Build for simulator
Cmd+R (with simulator selected)

# Clean build
Cmd+Shift+K

# Show/hide navigator
Cmd+0

# Show/hide inspector
Cmd+Option+0

# Format code
Ctrl+I (select all first with Cmd+A)
```

## Troubleshooting

### "Untrusted Developer" on iPhone
Settings > General > VPN & Device Management > Your Developer App > Trust

### Build fails with signing error
1. Xcode > Preferences > Accounts
2. Add your Apple ID
3. Select your team in project settings

### Simulator is slow
Use a real device - much faster and better for testing gestures

## Next Steps

1. [ ] Set up Xcode project on MacBook
2. [ ] Add source files to project
3. [ ] Run on iPhone
4. [ ] Integrate Supabase Swift SDK
5. [ ] Add real API calls
6. [ ] Test all screens
7. [ ] (Future) Upgrade to Liquid Glass with cloud Mac
