# Loop App - Master Testing Guide

**Last Updated:** 2026-01-03
**Focus:** Feed functionality, Dashboard Controls, Calendar Integration

---

## 🎯 PRIORITY 1: Feed Core Functionality

### Feed Loading & Scrolling
- [ ] **Initial Load**: Feed shows 5-10 recommendations immediately
- [ ] **Smooth Scrolling**: No lag, stuttering, or frame drops
- [ ] **Infinite Scroll**: Pull down to refresh works smoothly
- [ ] **Loading States**: Skeleton cards or spinner shows while loading
- [ ] **Empty State**: If no recommendations, shows helpful message (not crash)

### Recommendation Quality
- [ ] **Relevance**: Recommendations match your interests (check AI explanation)
- [ ] **Diversity**: Top 10 cards show at least 3-4 different categories
- [ ] **No Duplicates**: Same place doesn't appear twice in feed
- [ ] **Distance**: All places are within your max distance preference
- [ ] **Photos**: Every card has a photo (no placeholder images)
- [ ] **Ratings**: All places have ratings displayed (3.5+ stars)

### Recommendation Intelligence
- [ ] **Refresh Logic**: Pull to refresh generates NEW recommendations (not same ones)
- [ ] **Clear After Add**: After adding to calendar, card disappears from feed
- [ ] **Clear After Decline**: After "Not Interested", card disappears
- [ ] **No Re-showing**: Declined places don't come back in next refresh
- [ ] **Persistent State**: If you leave app and come back, feed state is preserved

### Performance Benchmarks
- [ ] **First Load**: < 3 seconds to show first recommendations
- [ ] **Scroll Performance**: 60fps scrolling (no jank)
- [ ] **Refresh Time**: < 2 seconds to load new recommendations
- [ ] **Memory**: No memory leaks after 5+ minutes of scrolling

---

## 🎯 PRIORITY 2: Dashboard Controls (Just Built!)

### Discovery Mode Toggle
- [ ] **Access**: Tap dashboard button → Controls tab visible
- [ ] **Toggle Works**: Can switch between "Curated" and "Explore" modes
- [ ] **Curated Mode**: Shows mostly places matching your top interests
- [ ] **Explore Mode**: Shows diverse categories (more variety)
- [ ] **Feed Updates**: Toggling mode refreshes feed with new recommendations
- [ ] **Persistence**: Mode choice persists after closing/reopening app

### Category Filtering
- [ ] **Category Selector**: Shows all 12 categories (All, Dining, Coffee, etc.)
- [ ] **Multi-Select**: Can select multiple categories at once
- [ ] **Single Category**: Selecting only "Dining" shows ONLY restaurants
- [ ] **Multiple Categories**: Selecting "Dining + Coffee" shows both
- [ ] **All Categories**: Selecting "All Categories" clears filter
- [ ] **Feed Filters**: Feed updates immediately when categories change
- [ ] **Active Filter Display**: See which categories are active in Controls tab
- [ ] **Clear All Button**: "Clear All Filters" resets everything

### Combined Controls Testing
- [ ] **Curated + Category Filter**: Can use both filters together
- [ ] **Explore + Single Category**: "Explore mode" with "Coffee only" works
- [ ] **Filter Persistence**: Filters persist across app restarts

---

## 🎯 PRIORITY 3: Calendar Integration

### Add to Calendar Flow
- [ ] **Tap "Add to Calendar"**: Modal opens with pre-filled details
- [ ] **Suggested Time Shown**: Modal suggests optimal visit time (e.g., "Tomorrow 3-5pm")
- [ ] **Edit Time**: Can change suggested time to custom time
- [ ] **Location Required**: Activity location (address + coords) is pre-filled
- [ ] **Save**: Tapping "Save" adds event to calendar
- [ ] **Confirmation**: Success toast/message shows after adding
- [ ] **Feed Update**: Card disappears from feed after adding

### Intelligent Scheduling Logic
- [ ] **Free Time Detection**: Suggested time is during your free time (no conflicts)
- [ ] **Conflict Warning**: If you manually pick a conflicting time, shows warning
- [ ] **Business Hours**: Suggested time respects place's opening hours
- [ ] **Commute Time**: Suggested time accounts for travel time from previous event
- [ ] **Realistic Duration**: Event duration matches activity type (coffee = 1hr, dinner = 2hrs)

### Calendar Viewing
- [ ] **Calendar Screen**: Swipe left from feed → see calendar view
- [ ] **Events Display**: Added events show on correct dates
- [ ] **Event Details**: Tap event → see full details (time, location, category)
- [ ] **Loop View**: "Loop View" button shows map with all day's events
- [ ] **Route Visualization**: Map shows route connecting all events with polyline

---

## 🎯 PRIORITY 4: Critical Bugs to Watch For

### Known Issues (Should Be Fixed)
- [x] ~~Photo reference errors (Unsplash URLs)~~ - FIXED (removed mock data)
- [ ] **Duplicate Places**: Same place appearing multiple times
- [ ] **Stale Recommendations**: Old recommendations not clearing
- [ ] **Calendar Conflicts**: Double-booking same time slot
- [ ] **Location Permissions**: App crashes if location denied

### Performance Red Flags
- [ ] **Memory Leaks**: App slows down after 10+ minutes of use
- [ ] **API Quota**: "Free tier limit reached" errors
- [ ] **Slow Loading**: Feed takes >5 seconds to load
- [ ] **Crash on Scroll**: App crashes when scrolling fast

---

## 🧪 Quick Smoke Test (5 Minutes)

**Do this first to verify app is functional:**

1. **Launch App** → Feed loads with recommendations (no crashes)
2. **Scroll Feed** → Smooth scrolling, photos load correctly
3. **Add to Calendar** → Tap card → Modal opens → Save → Event added
4. **Check Calendar** → Swipe left → Event shows on calendar
5. **Dashboard Controls** → Tap dashboard → Controls tab → Toggle discovery mode → Feed refreshes
6. **Category Filter** → Select "Dining" only → Feed shows only restaurants
7. **Pull to Refresh** → New recommendations appear (not duplicates)

**If all 7 steps pass → App is working!** ✅
**If any step fails → Report which step and what happened** ❌

---

## 📝 Reporting Feedback

When you find issues, provide:
1. **What you did** (steps to reproduce)
2. **What you expected** (should have happened)
3. **What actually happened** (actual result)
4. **Logs** (copy error messages from console if visible)

Example:
```
ISSUE: Duplicate recommendations
Steps: 1) Opened app 2) Scrolled feed 3) Saw "Philz Coffee" twice
Expected: Each place appears only once
Actual: Philz Coffee at position 3 and position 8
```

---

## ✅ Testing Priorities

**Test in this order:**
1. Quick Smoke Test (5 min)
2. Feed Core Functionality (15 min)
3. Dashboard Controls (10 min)
4. Calendar Integration (10 min)
5. Performance & Bugs (ongoing)

**Total estimated time:** 40 minutes for comprehensive testing

---

**Ready to test! Launch the app and start with the Quick Smoke Test.** 🚀
