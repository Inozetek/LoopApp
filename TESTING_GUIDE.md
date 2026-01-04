# 🧪 Comprehensive Testing Guide - Loop MVP

**Version:** 1.1 (Updated with Latest Features)
**Last Updated:** December 21, 2024
**Estimated Testing Time:** 2-3 hours for full walkthrough

---

## ⚡ QUICK START: Testing Recent Updates

**Just updated these features? Test them first:**

### 1. Fix Walmart/Generic Places Issue (🔥 Priority)

**Problem:** Generic places (Walmart, Target, gas stations) were appearing in feed.
**Fix:** Strengthened filter patterns + clear cache to get fresh results.

**Test Steps:**
1. Open app → Go to Recommendation Feed
2. **Pull down to refresh** (this clears the cache)
3. Wait for new recommendations to load
4. Scroll through 10-15 cards

**✅ Expected Result:**
- **NO** Walmart, Target, Costco, Sam's Club, etc.
- **NO** McDonald's, Taco Bell, Subway, fast food chains
- **NO** Shell, Chevron, gas stations
- **NO** CVS, Walgreens, pharmacies
- **NO** Banks, ATMs, post offices
- **ONLY** interesting local places: restaurants, cafes, bars, entertainment, activities

**If still seeing generic places:**
- Pull to refresh **2-3 more times** (old cache takes multiple refreshes to clear)
- Check console logs for: `⏭️  Skipping generic place (absolute filter): [NAME]`
- Report the exact place name if it's getting through

---

### 2. Test Feed Filters (NEW/Updated)

**What's New:** Filters now actually work! Time, distance, and price filters now filter the recommendations.

**Test Steps:**
1. On feed, pull down slightly (don't release)
2. Filters should slide down
3. **Test Time Filter:**
   - Tap "Morning" → Should show coffee, breakfast
   - Tap "Evening" → Should show dinner, bars, nightlife
4. **Test Distance Filter:**
   - Tap "1 mi" → Only very close places
   - Tap "10 mi" → Wider radius
5. **Test Price Filter:**
   - Tap "$" → Cheap/free options
   - Tap "$$$" → Upscale places

**✅ Expected Result:**
- Tapping any filter **immediately refreshes** the feed with filtered results
- Filters highlight blue when selected
- Feed shows ONLY activities matching ALL selected filters
- Filters auto-collapse after 3 seconds

**Common Issues:**
- "No results" → Loosen filters (increase distance or change price)
- Filters don't collapse → Scroll down manually

---

### 3. Test Native Ads (Infrastructure Ready)

**What Changed:** Removed fixed banner ad at bottom. Native sponsored activity cards now show inline with organic results.

**Test Steps:**
1. Scroll through recommendations
2. Look for any cards with **"Sponsored"** badge (top-right corner)

**✅ Expected Result (For Now):**
- You probably **WON'T see any sponsored badges yet** (no businesses paying)
- This is **expected** - infrastructure is built, just needs real sponsored businesses
- Once businesses subscribe ($49-149/mo), they'll automatically appear with badges

**Future (When businesses onboard):**
- ~20-30% of cards should have "Sponsored" badge
- Sponsored cards look identical to organic but with badge
- Mixed naturally into feed (not clustered)

---

### 4. Test Loop View Enhancements (NEW Stats)

**What's New:** Loop View now shows total distance and estimated travel time.

**Test Steps:**
1. Add 2-3 activities to calendar (from feed → "Add to Calendar")
2. Go to **Calendar tab**
3. Scroll to **Loop View** section (map)
4. Look at **stats overlay** at top of map

**✅ Expected Result:**
- **Map shows:**
  - 🏠 Green home marker
  - Numbered task pins (1, 2, 3...)
  - Blue polyline connecting them
- **Stats overlay shows:**
  - "X stops" (number of activities)
  - "Y.Z mi" (total distance) ← **NEW**
  - "Hh Mm" (estimated time) ← **NEW**

**Example:** "3 stops • 8.5 mi • 25 min"

**Common Issues:**
- Stats show "0 mi" → Make sure events have valid locations
- "Map not available" → Web version doesn't support maps (test on iOS/Android)
- Wrong home location → Set home address in Settings

---

### 5. Quick Smoke Test Checklist

**Run these quickly to verify everything works:**

- [ ] App opens without crashing
- [ ] Feed loads recommendations (no Walmart!)
- [ ] Pull to refresh works
- [ ] Filters slide down and work
- [ ] "Add to Calendar" works (shows toast "Added ✓")
- [ ] Calendar shows added events
- [ ] Loop View shows map with route stats
- [ ] No crashes during normal use

**If all ✅ → App is working correctly!**
**If any ❌ → See full testing guide below**

---

## 📋 Testing Prerequisites

### Before You Start:
- [ ] App installed on physical device (iOS or Android)
- [ ] Device has location services enabled
- [ ] Internet connection available
- [ ] Multiple test accounts created (for friends testing)
- [ ] Test data cleared (fresh start recommended)

### Optional but Recommended:
- [ ] Google Places API key configured (for real data testing)
- [ ] Second device for multi-user testing
- [ ] Screen recording software (for bug documentation)

---

## 🎯 Test Scenarios Overview

1. **Authentication & Onboarding** (20 min)
2. **Recommendation Feed** (30 min)
3. **Calendar Management** (25 min)
4. **Friends & Social** (30 min)
5. **Group Planning** (25 min)
6. **Profile & Settings** (20 min)
7. **Location Services** (15 min)
8. **Error Handling** (15 min)
9. **Dark Mode & Theming** (10 min)
10. **Performance & Edge Cases** (15 min)

**Total: ~3 hours**

---

## 1. Authentication & Onboarding (20 min)

### Test 1.1: Sign Up with Email/Password

**Steps:**
1. Open app for first time
2. Tap "Sign Up"
3. Enter:
   - Name: "Test User"
   - Email: "test@example.com"
   - Password: "TestPass123!"
   - Confirm Password: "TestPass123!"
4. Tap "Create Account"

**Expected Results:**
- ✅ Account created successfully
- ✅ Redirected to main app (recommendation feed)
- ✅ Welcome message or onboarding flow appears

**Bug Checklist:**
- [ ] Validation works (empty fields rejected)
- [ ] Password mismatch shows error
- [ ] Loading state displays during signup
- [ ] Haptic feedback on button press
- [ ] No crashes or freezes

---

### Test 1.2: Sign Out & Sign In

**Steps:**
1. Go to Friends tab
2. Tap settings icon (top-right)
3. Scroll down (if there's a sign out button)
4. Or manually sign out via Supabase
5. Sign in with same credentials

**Expected Results:**
- ✅ Sign out successful
- ✅ Redirected to auth screen
- ✅ Sign in successful with correct credentials
- ✅ Previous data persists (calendar events, friends)

**Bug Checklist:**
- [ ] Sign out clears auth state
- [ ] Sign in validates credentials
- [ ] Invalid credentials show error
- [ ] "Remember me" works if implemented

---

### Test 1.3: Google OAuth (If Configured)

**Steps:**
1. Tap "Continue with Google"
2. Select Google account
3. Grant permissions

**Expected Results:**
- ✅ Google OAuth flow opens
- ✅ Account created/signed in
- ✅ Profile populated with Google data (name, email, picture)

---

## 2. Recommendation Feed (30 min)

### Test 2.1: Initial Load

**Steps:**
1. Open app
2. Go to "For You" tab (should be default)
3. Observe loading state
4. Wait for recommendations to appear

**Expected Results:**
- ✅ Skeleton loaders appear while loading
- ✅ 5-10 activity recommendations load
- ✅ Each card shows:
  - Activity photo
  - Name and category
  - Rating and reviews
  - Price range
  - Distance
  - AI explanation
- ✅ No loading errors
- ✅ Smooth animations

**Bug Checklist:**
- [ ] No blank screen
- [ ] No infinite loading
- [ ] Images load correctly
- [ ] Text is readable
- [ ] Spacing looks good
- [ ] Works in dark mode

---

### Test 2.2: Pull to Refresh

**Steps:**
1. On recommendation feed
2. Pull down from top
3. Release
4. Wait for refresh

**Expected Results:**
- ✅ Refresh indicator appears
- ✅ New/reordered recommendations load
- ✅ Haptic feedback on refresh
- ✅ Success haptic when loaded

**Bug Checklist:**
- [ ] Refresh doesn't freeze
- [ ] Recommendations change or reorder
- [ ] Loading state shows correctly
- [ ] No crashes

---

### Test 2.3: Add Activity to Calendar

**Steps:**
1. Tap "Add to Calendar" on any activity
2. See 3 time options:
   - Today Evening (6pm)
   - Tomorrow Afternoon (2pm)
   - This Weekend (next Saturday)
3. Select "Tomorrow Afternoon"
4. Confirm in success alert

**Expected Results:**
- ✅ Time picker alert appears
- ✅ Tap option selects it
- ✅ Success alert shows with formatted time
- ✅ Haptic feedback throughout
- ✅ Modal closes automatically

**Bug Checklist:**
- [ ] Time options are correct
- [ ] Past times are handled (today evening after 6pm)
- [ ] Weekend calculates next Saturday correctly
- [ ] Success message is clear
- [ ] Event actually added (verify in Calendar tab)

---

### Test 2.4: See Activity Details

**Steps:**
1. Tap "See Details" on any activity
2. Read information in alert

**Expected Results:**
- ✅ Alert shows full activity details:
  - Name
  - Description
  - Address
  - Rating and reviews
  - Price range
  - Distance
  - Recommendation score
  - Confidence level

**Bug Checklist:**
- [ ] All information displays correctly
- [ ] Text is formatted well
- [ ] No data missing
- [ ] Alert can be dismissed

---

### Test 2.5: Sponsored Activities

**Steps:**
1. Scroll through recommendations
2. Look for "Sponsored" badges (should be 2-3 per 10 activities)
3. Note if they're mixed with organic results

**Expected Results:**
- ✅ ~20-30% of activities have "Sponsored" badge
- ✅ Badge is visible and clear
- ✅ Sponsored activities are high quality (not spam)
- ✅ Mix of sponsored and organic is natural

---

### Test 2.6: Empty State

**Steps:**
1. If possible, test with no recommendations available
2. Or modify mock data to return empty array

**Expected Results:**
- ✅ Empty state appears with:
  - Icon
  - "No Recommendations Yet" message
  - Helpful instruction ("Pull down to refresh")

---

## 3. Calendar Management (25 min)

### Test 3.1: View Calendar

**Steps:**
1. Go to Calendar tab
2. View current month
3. Look for colored dots on dates with events
4. Tap a date with events

**Expected Results:**
- ✅ Calendar displays current month
- ✅ Colored dots appear on event dates
- ✅ Tapping date shows events for that day
- ✅ Month navigation works (swipe or arrows)

---

### Test 3.2: Create Manual Event

**Steps:**
1. Tap "+" button (top-right or floating button)
2. Fill in form:
   - Title: "Coffee with Alice"
   - Description: "Catch up meeting"
   - Date: Tomorrow
   - Time: 10:00 AM
   - **Duration: 1 hour** ← NEW!
   - Location: Tap "Home" or search address
   - Category: "Coffee"
3. Tap "Create Task"

**Expected Results:**
- ✅ Modal appears with form
- ✅ All fields are fillable
- ✅ **Duration picker shows 5 options** (30min, 1hr, 2hr, 3hr, All Day)
- ✅ Location autocomplete works or defaults load
- ✅ Category picker works
- ✅ Success message appears
- ✅ Event appears on calendar
- ✅ Modal closes

**Bug Checklist:**
- [ ] Required fields are validated
- [ ] Date picker works
- [ ] Time picker works
- [ ] **Duration selection updates end time correctly**
- [ ] **"All Day" sets end time to 11:59pm**
- [ ] Location is required
- [ ] Saving actually works (event persists)

---

### Test 3.3: Duration Options

**Test each duration option:**

**30 min event:**
- Start: 10:00 AM
- Expected End: 10:30 AM

**1 hour event:**
- Start: 10:00 AM
- Expected End: 11:00 AM

**2 hour event:**
- Start: 10:00 AM
- Expected End: 12:00 PM

**3 hour event:**
- Start: 10:00 AM
- Expected End: 1:00 PM

**All Day event:**
- Start: Any time (e.g., 9:00 AM)
- Expected End: 11:59 PM same day

**Bug Checklist:**
- [ ] End times calculate correctly
- [ ] Duration persists when editing
- [ ] All Day events don't span multiple days
- [ ] Visual feedback shows selected duration

---

### Test 3.4: Loop View (Map Visualization)

**Steps:**
1. Create 3 events for tomorrow at different times
2. Tap "Loop View" button
3. View map with all events

**Expected Results:**
- ✅ Map appears with markers for each event
- ✅ Polyline connects events in chronological order
- ✅ Route distance/time displayed
- ✅ Tap marker shows event info

**Bug Checklist:**
- [ ] All events appear on map
- [ ] Route makes sense (chronological order)
- [ ] Map is interactive
- [ ] Events are labeled clearly

---

### Test 3.5: Edit/Delete Event

**Steps:**
1. Tap an event on calendar
2. Choose "Edit" or "Delete"
3. Modify details if editing
4. Confirm deletion if deleting

**Expected Results:**
- ✅ Event can be edited
- ✅ Event can be deleted
- ✅ Changes persist
- ✅ Confirmation prompts appear

---

## 4. Friends & Social (30 min)

### Test 4.1: Add Friend by Email

**Steps:**
1. Go to Friends tab
2. Tap "+" icon (person-add icon top-right)
3. Enter friend's email: "friend@example.com"
4. Tap "Find Friend"
5. Wait for search
6. If found, tap "Send Friend Request"

**Expected Results:**
- ✅ Modal appears with email input
- ✅ Search works (shows loading state)
- ✅ If found: User profile appears
- ✅ Send request button works
- ✅ Success message: "Friend request sent"
- ✅ Modal closes

**Bug Checklist:**
- [ ] Search validates email format
- [ ] Can't add yourself
- [ ] Can't add existing friend
- [ ] Duplicate requests blocked
- [ ] "Not found" message if email doesn't exist

---

### Test 4.2: Accept Friend Request

**Test from second device/account:**

**Steps (Friend's Device):**
1. Log in as the friend
2. Go to Friends tab
3. See "Friend Requests" section at top
4. See request from Test User
5. Tap "Accept"

**Expected Results:**
- ✅ Friend request appears in section
- ✅ Badge shows count (1, 2, etc.)
- ✅ Request shows sender name and email
- ✅ Accept button works
- ✅ Success message appears
- ✅ Request moves to "My Friends" list
- ✅ Both users see each other in friends list

---

### Test 4.3: Decline Friend Request

**Steps:**
1. Receive a friend request
2. Tap "Decline"

**Expected Results:**
- ✅ Confirmation prompt appears
- ✅ Request is removed from list
- ✅ Sender is not added to friends

---

### Test 4.4: View Friend's Loop

**Steps:**
1. Have at least 1 accepted friend
2. Tap on friend's card in "My Friends" list
3. View their Loop

**Expected Results:**
- ✅ Friend's profile appears
- ✅ Shows their Loop Score
- ✅ Shows upcoming activities (if any)
- ✅ "Phase 2 coming soon" message for full features

**Bug Checklist:**
- [ ] Only works if friend granted permission
- [ ] Shows "Private" message if not shared
- [ ] Data displays correctly

---

### Test 4.5: Leaderboard

**Steps:**
1. Have multiple friends with different Loop Scores
2. Scroll to "Top Loop Scores" section
3. View leaderboard

**Expected Results:**
- ✅ Friends ranked by Loop Score (high to low)
- ✅ Top 5 friends shown
- ✅ Each shows: Rank, Name, Score
- ✅ Trophy icon for leaderboard

---

## 5. Group Planning (25 min)

### Test 5.1: Open Group Planning Modal

**Steps:**
1. Go to Friends tab
2. Must have at least 1 friend
3. Tap green "Plan Activity" FAB (bottom-right)

**Expected Results:**
- ✅ Floating action button appears (green, with people icon)
- ✅ Button only appears if you have friends
- ✅ Tap opens modal from bottom
- ✅ Modal shows "Plan Group Activity" title

---

### Test 5.2: Select Friends

**Steps:**
1. In group planning modal
2. See "Select Friends" section
3. Tap 2-3 friends to select
4. Try selecting more than 5 (should show error)

**Expected Results:**
- ✅ All friends shown as chips
- ✅ Tap friend toggles selection
- ✅ Selected friends have blue background + checkmark
- ✅ Counter shows "X friend(s) selected"
- ✅ Haptic feedback on each tap
- ✅ Error if trying to select >5 friends

**Bug Checklist:**
- [ ] Can select 1-5 friends
- [ ] Visual feedback is clear
- [ ] Can deselect friends
- [ ] Count updates correctly

---

### Test 5.3: Add Preference Tags

**Steps:**
1. Scroll to "Activity Preferences" section
2. Tap tags to select: "Outdoor", "Weekend", "Budget-Friendly"
3. Enter custom tag: "Dog-Friendly Park"
4. Tap + to add custom tag
5. Try removing a custom tag

**Expected Results:**
- ✅ 12 pre-defined tags available
- ✅ Tap toggles selection (green when selected)
- ✅ Custom tag input works
- ✅ Custom tags appear separately with X button
- ✅ Can remove custom tags
- ✅ Haptic feedback on selection

**Bug Checklist:**
- [ ] Can select multiple tags
- [ ] Custom tags limited to 30 characters
- [ ] Tags save with group plan
- [ ] Visual feedback is clear

---

### Test 5.4: Find Group Activities

**Steps:**
1. With friends and tags selected
2. Tap "Find Group Activities" button
3. Wait for suggestions (1-2 seconds)

**Expected Results:**
- ✅ Button disabled if no friends selected
- ✅ Loading state shows "Finding Activities..."
- ✅ 3 activity suggestions appear
- ✅ Each shows: Name, description, rating, price, distance
- ✅ Success haptic feedback

---

### Test 5.5: Create Group Plan

**Steps:**
1. View suggested activities
2. Tap "Klyde Warren Park" (or any suggestion)
3. Confirm in alert

**Expected Results:**
- ✅ Tap opens confirmation
- ✅ Group plan created in database
- ✅ Success alert: "Group Plan Created! 🎉"
- ✅ Alert shows: "Invitations sent to X friend(s)"
- ✅ Modal closes automatically

**Bug Checklist:**
- [ ] Plan actually saves to database
- [ ] Participants added correctly
- [ ] Success message is clear
- [ ] No crashes or errors

---

### Test 5.6: Change Selection

**Steps:**
1. After viewing suggestions
2. Tap "← Change Selection" button
3. Modify friends or tags
4. Find activities again

**Expected Results:**
- ✅ Returns to selection screen
- ✅ Previous selections are cleared
- ✅ Can make new selections
- ✅ Smooth transition

---

## 6. Profile & Settings (20 min)

### Test 6.1: View Profile Settings

**Steps:**
1. Go to Friends tab
2. Tap settings icon (top-right)
3. View profile modal

**Expected Results:**
- ✅ Modal slides up from bottom
- ✅ Shows user profile card:
  - Avatar with initials
  - Name
  - Email
  - Loop Score with trophy icon
- ✅ Shows feedback stats (if any feedback submitted)
- ✅ Shows current interests
- ✅ Shows app version and progress (95%)

---

### Test 6.2: Edit Name

**Steps:**
1. In profile settings
2. Change name to "New Test Name"
3. Tap "Save Changes"

**Expected Results:**
- ✅ Name field is editable
- ✅ Validation: Name cannot be empty
- ✅ Save button works
- ✅ Success message appears
- ✅ Name updates throughout app
- ✅ Modal closes

---

### Test 6.3: Edit Interests

**Steps:**
1. In profile settings
2. Scroll to "Interests" section
3. Select 5-6 interests
4. Deselect 2 interests
5. Tap "Save Changes"

**Expected Results:**
- ✅ 18 interest chips available
- ✅ Tap toggles selection (blue when selected)
- ✅ Must select at least 1 interest
- ✅ Changes save successfully
- ✅ Interests affect future recommendations

**Bug Checklist:**
- [ ] Can't save with 0 interests
- [ ] Visual feedback is clear
- [ ] Haptic feedback on tap
- [ ] Changes persist after closing

---

### Test 6.4: Location Permission Management

**Steps:**
1. In profile settings
2. Scroll to "Location Services" card
3. Check status (should show Enabled/Disabled/Not Set)
4. If disabled, tap "Enable Location"
5. Grant permission in system dialog
6. Verify status updates to "Enabled" (green)

**Expected Results:**
- ✅ Location card shows current status
- ✅ Colored dot indicates status (green/red/orange)
- ✅ Enable button appears if disabled
- ✅ System permission dialog opens
- ✅ Status updates immediately after grant
- ✅ Success message if enabled
- ✅ If denied, shows "Open Settings" button

**Bug Checklist:**
- [ ] Status detection works correctly
- [ ] Permission request works
- [ ] iOS and Android dialogs appear
- [ ] Status updates in real-time
- [ ] "Open Settings" launches device settings

---

### Test 6.5: Feedback Statistics

**Steps:**
1. Complete some activities and give feedback
2. Open profile settings
3. View "Activity Feedback" card

**Expected Results:**
- ✅ Shows total feedback count
- ✅ Shows thumbs up count (green)
- ✅ Shows thumbs down count (red)
- ✅ Shows satisfaction rate percentage
- ✅ Shows top categories

---

## 7. Location Services (15 min)

### Test 7.1: Location Permission Request

**Fresh install test:**

**Steps:**
1. Fresh app install or clear app data
2. Open app
3. Go to "For You" tab
4. System should request location permission

**Expected Results:**
- ✅ Permission dialog appears automatically
- ✅ Message explains why location is needed
- ✅ iOS: "Loop needs your location to show nearby activities and calculate distances."
- ✅ Android: Similar message

---

### Test 7.2: Grant Location Permission

**Steps:**
1. In permission dialog, tap "Allow While Using App"
2. App continues loading
3. Check console logs for location acquisition

**Expected Results:**
- ✅ Permission granted
- ✅ Console shows: "✅ Location permission granted"
- ✅ GPS location acquired: "📍 Using location: X, Y"
- ✅ Recommendations load with real distances

---

### Test 7.3: Deny Location Permission

**Steps:**
1. Fresh install
2. Deny location permission
3. App should fallback to Dallas coordinates

**Expected Results:**
- ✅ App doesn't crash
- ✅ Console shows: "📍 Using fallback location (Dallas)"
- ✅ Recommendations still load
- ✅ Distances based on Dallas, TX
- ✅ Can enable later in settings

---

### Test 7.4: Real Location vs Fallback

**With permission granted:**

**Steps:**
1. Pull to refresh recommendations
2. Note distances shown
3. If in Dallas area: Should see very close activities (<1 mi)
4. If elsewhere: Should see activities near your location

**Expected Results:**
- ✅ Distances are realistic for your location
- ✅ Nearby activities appear first
- ✅ Distance text is formatted well ("2.3 mi" or "1,240 ft")

---

### Test 7.5: Location Caching

**Steps:**
1. Pull to refresh (gets location)
2. Immediately pull to refresh again
3. Check console logs

**Expected Results:**
- ✅ First request: "📍 Fetching current GPS location..."
- ✅ Second request (within 5 min): "📍 Using cached location"
- ✅ Faster load time on second request

---

## 8. Error Handling (15 min)

### Test 8.1: Network Error

**Steps:**
1. Turn off WiFi and mobile data
2. Pull to refresh recommendations
3. Observe error message

**Expected Results:**
- ✅ Alert appears: "Connection Error"
- ✅ Message: "Please check your internet connection and try again."
- ✅ [Cancel] and [Retry] buttons
- ✅ Haptic error feedback
- ✅ Console logs error with [NETWORK_ERROR] code

---

### Test 8.2: Retry Functionality

**Steps:**
1. After network error
2. Turn internet back on
3. Tap "Retry" in error alert

**Expected Results:**
- ✅ Request sent again
- ✅ Recommendations load successfully
- ✅ No need to manually refresh
- ✅ Success haptic feedback

---

### Test 8.3: Validation Error

**Steps:**
1. Try to save profile with empty name
2. Try to save profile with no interests

**Expected Results:**
- ✅ Alert appears: "Validation Error"
- ✅ Specific message: "Name is required" or "At least one interest is required"
- ✅ No retry button (not recoverable)
- ✅ [OK] button to dismiss

---

### Test 8.4: Database Error Simulation

**If possible, simulate:**

**Steps:**
1. Temporarily break Supabase connection
2. Try to create calendar event
3. Observe error

**Expected Results:**
- ✅ Alert appears: "Data Error"
- ✅ Message: "There was a problem loading your data. Please try again."
- ✅ [Retry] button available
- ✅ Console logs error

---

### Test 8.5: Permission Error

**Steps:**
1. Deny location permission
2. Try to add activity that requires location
3. Observe behavior

**Expected Results:**
- ✅ App handles gracefully
- ✅ Falls back to default location or prompts for permission
- ✅ No crashes

---

## 9. Dark Mode & Theming (10 min)

### Test 9.1: Toggle Dark Mode

**Steps:**
1. Open device settings
2. Toggle dark mode on
3. Return to app
4. Check all screens

**Expected Results:**
- ✅ App switches to dark theme immediately
- ✅ Background colors change (light → dark)
- ✅ Text colors change (dark → light)
- ✅ Borders and shadows adjust
- ✅ No readability issues

---

### Test 9.2: Dark Mode Consistency

**Check each screen:**

**Recommendation Feed:**
- [ ] Cards have dark background
- [ ] Text is readable
- [ ] Images have proper contrast
- [ ] Shadows visible but subtle

**Calendar:**
- [ ] Calendar grid is dark
- [ ] Dates are readable
- [ ] Modal is dark
- [ ] Form inputs are dark with proper contrast

**Friends:**
- [ ] Friend cards are dark
- [ ] Text is readable
- [ ] Leaderboard is dark
- [ ] Modals are dark

**Modals:**
- [ ] Profile settings modal is dark
- [ ] Group planning modal is dark
- [ ] Add friend modal is dark
- [ ] All text is readable

---

### Test 9.3: Toggle Back to Light Mode

**Steps:**
1. Toggle device back to light mode
2. Check all screens again

**Expected Results:**
- ✅ App returns to light theme
- ✅ All screens look good
- ✅ No artifacts from dark mode

---

## 10. Performance & Edge Cases (15 min)

### Test 10.1: App Launch Speed

**Steps:**
1. Force quit app
2. Reopen app
3. Time from tap to usable interface

**Expected Results:**
- ✅ App opens within 2-3 seconds
- ✅ Splash screen shows briefly
- ✅ Smooth transition to main screen
- ✅ No blank screens or freezes

---

### Test 10.2: Scroll Performance

**Steps:**
1. On recommendation feed with 20+ activities
2. Scroll rapidly up and down
3. Observe smoothness

**Expected Results:**
- ✅ 60 FPS scrolling (feels smooth)
- ✅ No janks or stutters
- ✅ Images load without blocking scroll
- ✅ Haptic feedback doesn't slow down scroll

---

### Test 10.3: Memory Usage

**Steps:**
1. Use app for 10-15 minutes
2. Navigate between all tabs multiple times
3. Create/delete several events
4. Check device doesn't slow down

**Expected Results:**
- ✅ App doesn't get sluggish
- ✅ No memory warnings
- ✅ Device stays responsive
- ✅ App doesn't crash

---

### Test 10.4: Offline Mode

**Steps:**
1. Use app online
2. Turn off internet
3. Navigate between tabs
4. Try various actions

**Expected Results:**
- ✅ Previously loaded data still visible
- ✅ Calendar events persist (local)
- ✅ Profile settings load
- ✅ Appropriate errors for online-only actions
- ✅ No crashes

---

### Test 10.5: Edge Cases

**Test these scenarios:**

**Empty States:**
- [ ] No friends → Empty state + "Add Friend" prompt
- [ ] No calendar events → Empty state + "Create Event" prompt
- [ ] No recommendations → Empty state + "Pull to refresh"
- [ ] No friend requests → Hide friend requests section

**Boundary Cases:**
- [ ] Create event at 11:59 PM
- [ ] Create all-day event
- [ ] Schedule weekend activity on Saturday (should go to next Saturday)
- [ ] Add 18 interests (should all save)
- [ ] Create calendar event with very long title (should truncate or wrap)

**Rapid Actions:**
- [ ] Rapidly tap "Add to Calendar" multiple times
- [ ] Rapidly switch between tabs
- [ ] Rapidly pull to refresh
- [ ] Rapidly tap friend chips in group planning

**Data Limits:**
- [ ] 100+ calendar events (performance)
- [ ] 50+ friends (scrolling)
- [ ] Very long activity descriptions (text overflow)

---

## 📊 Test Results Template

### Use this template to record results:

```markdown
## Test Session Results

**Date:** [Date]
**Device:** [iPhone 14 Pro / Samsung Galaxy S23]
**OS Version:** [iOS 17.0 / Android 14]
**App Version:** 1.0 (95% MVP)
**Tester:** [Your Name]

### Summary:
- Total Tests: [ ]
- Passed: [ ]
- Failed: [ ]
- Blockers: [ ]

### Failed Tests:

1. **Test X.X: [Name]**
   - **Issue:** [Description]
   - **Steps to Reproduce:** [Steps]
   - **Expected:** [What should happen]
   - **Actual:** [What happened]
   - **Severity:** [Critical/High/Medium/Low]
   - **Screenshots:** [Attach if available]

### Notes:
[Any additional observations]

### Overall Assessment:
[Pass/Fail for production readiness]
```

---

## 🚦 Go/No-Go Decision Criteria

### PASS (Ready for Beta/TestFlight):
- ✅ All critical tests pass (auth, recommendations, calendar, friends)
- ✅ 0 critical bugs (crashes, data loss)
- ✅ <3 high-severity bugs
- ✅ Dark mode works consistently
- ✅ Error handling works as expected
- ✅ Performance is acceptable (no freezes)

### NO-GO (More work needed):
- ❌ Any critical functionality broken
- ❌ Frequent crashes
- ❌ Data corruption issues
- ❌ Major UI breakage in dark mode
- ❌ Severe performance issues
- ❌ >5 high-severity bugs

---

## 🎯 Next Steps After Testing

### If All Tests Pass:
1. ✅ Mark testing as complete
2. Fix any minor bugs found
3. Proceed to production deployment prep
4. Create App Store/Play Store listings
5. Prepare for TestFlight/Internal Testing

### If Tests Fail:
1. Document all bugs
2. Prioritize fixes (critical first)
3. Create fix plan
4. Implement fixes
5. Retest affected areas
6. Repeat until pass criteria met

---

## 💡 Testing Tips

**For Best Results:**
- Take your time (don't rush)
- Test on multiple devices if possible
- Use real data (real friends, real activities)
- Try to break things (edge cases)
- Document everything (screenshots help)
- Think like a user (not a developer)

**Common Issues to Watch For:**
- Text overflow in small spaces
- Touch targets too small (<44pt)
- Loading states missing
- Error messages unclear
- Haptic feedback missing
- Dark mode text not readable
- Images not loading
- Slow animations

---

**Happy Testing!** 🧪

If you find bugs, that's great - it means the app will be better before launch! 🚀

---

*Comprehensive Testing Guide*
*Version: 1.0 (95% MVP)*
*Last Updated: October 19, 2025*
