# Loop App Roadmap

> **Source of Truth** - Reference this document in future Claude Code sessions to maintain roadmap continuity.

**Last Updated:** January 28, 2026

---

## Architecture: Instagram-Style Dual Feed

### Bottom Navigation (6 Tabs)

| Tab | Icon | Purpose |
|-----|------|---------|
| **Daily** | Sparkles | AI-curated recommendations, subscription-limited (10/25/unlimited) |
| **Explore** | Compass | Search, browse, discover through trending activities |
| **Calendar** | Calendar | Schedule, tasks, Loop route view |
| **Friends** | People | Stories, friend activity, group planning |
| **Profile** | Person | Settings, preferences, subscription |
| **Settings** | Cog | App settings, logout |

### Mental Model
- **Daily** = "What should I do today?" (AI picks FOR ME)
- **Explore** = "What's out there?" (Discover NEW through strangers)
- **Friends** = "What are my people doing?" (Stories + Coordinate with friends)

---

## Phase 1: Bug Fixes & Cleanup ✅ COMPLETED

### 1.1 Fix Ticketmaster Place ID Errors ✅
**File:** `services/recommendations.ts`

Skip `enrichPlacePhotos` for non-Google sources to eliminate 400 errors.
- Fixed: Check `place.source` before enrichment
- Cleaned up duplicate comment

### 1.2 Remove Standalone Toggle ✅
**File:** `components/feed-mode-toggle.tsx` (DELETED)

Removed `FeedModeToggle` component - dual-feed handled by tabs instead.
- Updated TESTING_GUIDE.md to reflect new architecture

### 1.3 Stories Integration into Friends Tab ✅
**Files:**
- `components/stories-grid-section.tsx` (NEW)
- `app/(tabs)/friends.tsx` (UPDATED)

Added Instagram-style stories grid at top of Friends tab:
- 2-column grid with 72px avatars
- Gradient rings for unseen stories
- "Add Story" button
- Timestamps showing when posted
- Collapsible "See all" link
- Integrated MomentViewer and MomentCaptureModal

### 1.4 Instagram-Inspired Header System ✅
**Issue:** All tabs used the same LoopHeader component - repetitive and not optimized per screen

**Solution:** Created distinct header components per tab following Instagram patterns

**New Headers:**
- **Daily Tab**: Kept LoopHeader (premium experience with logo, shimmer, swipe-down)
- **Explore Tab**: ExploreHeader with full-width search bar + filter button
- **Calendar Tab**: CalendarHeader with section title + action bar (sync, view mode)
- **Friends Tab**: FriendsHeader with title + notification badge + add friend button
- **Profile Tab**: ProfileHeader with username + settings gear

**Files Created:**
- `components/explore-header.tsx`
- `components/calendar-header.tsx`
- `components/friends-header.tsx`
- `components/profile-header.tsx`

**Files Updated:**
- `app/(tabs)/explore.tsx` - Integrated ExploreHeader
- `app/(tabs)/calendar.tsx` - Integrated CalendarHeader with action bar
- `app/(tabs)/friends.tsx` - Integrated FriendsHeader
- `app/(tabs)/profile.tsx` - Integrated ProfileHeader, added SwipeableLayout

### 1.5 Enhanced Swipe Navigation ✅
**Issue:** SwipeableLayout only supported 3 tabs (calendar, daily, friends)

**Solution:** Extended to support all 5 tabs with proper routing

**Updates:**
- `components/swipeable-layout.tsx` - Updated screen indices (0-4)
- `app/(tabs)/_layout.tsx` - Fixed profile icon size (28→24px for visual balance)

**Tab Order:**
0. Calendar
1. Explore
2. Daily (center)
3. Friends
4. Profile

---

## Phase 2: Tab Architecture ✅ COMPLETED

### 2.1 Update Bottom Navigation
**File:** `app/(tabs)/_layout.tsx`

Add Explore tab: Daily → Explore → Calendar → Friends → Profile

### 2.2 Create Explore Screen
**File:** `app/(tabs)/explore.tsx` (NEW)

Basic structure with search bar and placeholders.

---

## Phase 3: Explore Tab Features

- **Search:** Autocomplete, recent/trending searches
- **Browse Grid:** Instagram-style, trending activities, categories
- **Public Reviews:** Social proof from strangers

---

## Phase 4: Friends Tab Enhancements

### Snapchat-Style Friends View:
```
┌─────────────────────────────────┐
│ Friends              [+ Plan]   │
├─────────────────────────────────┤
│ TODAY'S LOOPS                   │
│ [👤 Sarah 3] [👤 Mike 5] [...]  │ ← Tap to see their Loop
├─────────────────────────────────┤
│ 💡 GROUP OPPORTUNITY            │
│ "You, Sarah & Mike are free..." │ ← AI-detected
├─────────────────────────────────┤
│ FRIEND ACTIVITY FEED            │
│ "Sarah added Coffee - 3pm"      │
│ [Join Her] [Comment]            │
└─────────────────────────────────┘
```

---

## Phase 5: Group Recommendations & Smart Invites

### Smart Invite Flow (on any activity):
```
┌─────────────────────────────────┐
│ LIKELY TO JOIN                  │
│ [Sarah 92%] [Mike 85%]          │ ← AI-powered match scores
│ "Sarah loves sushi & is free"   │
│ [Send Invites]                  │
└─────────────────────────────────┘
```

### Mutually Convenient Location:
```
┌─────────────────────────────────┐
│ 🎯 GROUP PLAN                   │
│ SUGGESTIONS FOR YOUR GROUP      │
│ 🍕 Cane Rosso                   │
│ Everyone travels ~12min         │ ← Fairness optimization
│ [Propose to Group]              │
└─────────────────────────────────┘
```

### "Likely to Join" Algorithm Factors:
- Past acceptance rate
- Interest match (category)
- Calendar availability
- Location proximity
- Time preferences
- Historical patterns

### Recipient Experience:
```
┌─────────────────────────────────┐
│ 🎉 Nick invited you!            │
│ Sushi at Nobu • Tonight 7pm     │
│ Sarah is also going ✓           │
│ [I'm In!] [Maybe] [Can't]       │
└─────────────────────────────────┘
```

### AI Nudge Philosophy:
- Only HIGH confidence (85%+)
- Max 2-3 nudges/day
- Social proof increases conversion
- Easy opt-out

---

## Phase 6: Daily Tab Limits

| Tier | Daily Picks |
|------|-------------|
| Free | 5 |
| Plus ($4.99/mo) | 15 |
| Premium ($9.99/mo) | 30 |

- No infinite scroll in Daily
- "You've seen all picks" → Explore or Upgrade

---

## Future Phases (Backlog)

### Phase 7: User Posts & Social Feed
- Users share activities they've completed
- Photos, ratings, written reviews
- Appears in Explore (public) and Friends (private) feeds

### Phase 8: Smart Scheduling
- Background location learning
- Auto-detect routines (work, gym, etc.)
- Proactive suggestions based on patterns

### Phase 9: Travel Mode
- Multi-day itinerary planning
- City-specific recommendations
- Affiliate bookings (hotels, tickets)

### Phase 10: Business Features
- Business dashboard
- Sponsored placements
- Analytics for venues

---

## Success Metrics

| Feature | Target Metric |
|---------|---------------|
| Daily Tab | 25-35% recommendation acceptance |
| Explore Tab | 40% of users use search weekly |
| Friends Tab | 60% view friends' Loops daily |
| Group Invites | 50% invite acceptance rate |
| Subscription | 10% free→paid conversion |

---

## Monetization Targets

### Month 3 (Launch)
- 1,000 active users
- 10 businesses ($490/mo)
- $540/mo MRR

### Month 6 (Growth)
- 10,000 active users
- 50 businesses
- $10K-20K/mo MRR

### Month 12 (Scale)
- 50,000 active users
- 200+ businesses
- $50K-70K/mo MRR

---

*Reference this document in future Claude Code sessions to maintain roadmap continuity.*
