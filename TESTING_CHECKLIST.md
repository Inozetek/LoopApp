# Loop App - Comprehensive Testing Checklist

**Version:** MVP v0.72 (Post-Autonomous Session)
**Date:** October 18, 2025
**Status:** Ready for systematic testing

---

## 📋 How to Use This Checklist

1. **Start fresh:** Close and restart the app before testing
2. **Test systematically:** Go through each section in order
3. **Mark status:** ✅ Pass | ⚠️ Issue Found | ❌ Broken
4. **Document issues:** Note any bugs/errors at the bottom
5. **Test both modes:** Light mode AND dark mode

---

## 🔐 Authentication Flow

### Sign Up

**Test Steps:**
1. [ ] Open app → See splash/auth screen
2. [ ] Tap "Create Account"
3. [ ] Enter email: `test@example.com`
4. [ ] Enter password: `password123`
5. [ ] Enter confirm password: `password123`
6. [ ] Tap "Create Account" button

**Expected Results:**
- ✅ Loading indicator appears
- ✅ Navigates to onboarding screen
- ✅ No error messages

**Error Cases to Test:**
- [ ] Empty email → Shows "Please fill in all fields"
- [ ] Passwords don't match → Shows "Passwords do not match"
- [ ] Password < 6 chars → Shows "Password must be at least 6 characters"
- [ ] Email already exists → Shows "User already exists" error

**Status:** ___________

---

### Onboarding

**Test Steps:**
1. [ ] See "Tell us about yourself" screen
2. [ ] Enter name: "Test User"
3. [ ] Select 3+ interests (tap to select)
4. [ ] Enter home address: "123 Main St, San Francisco, CA"
5. [ ] Enter work address: "456 Market St, San Francisco, CA"
6. [ ] Tap "Complete Setup"

**Expected Results:**
- ✅ All fields accept input
- ✅ Interest chips change color when selected
- ✅ Navigates to main app (tabs screen)
- ✅ User data saved to Supabase

**Error Cases:**
- [ ] Skip name → Shows validation error
- [ ] Skip interests → Shows "Select at least 3"
- [ ] Skip addresses → Shows validation error

**Status:** ___________

---

### Sign In

**Test Steps:**
1. [ ] Sign out (if signed in)
2. [ ] Open app → See login screen
3. [ ] Enter email: (existing account)
4. [ ] Enter password: (correct password)
5. [ ] Tap "Sign In"

**Expected Results:**
- ✅ Loading indicator appears
- ✅ Navigates to main app (For You tab)
- ✅ Shows personalized greeting with user's name

**Error Cases:**
- [ ] Wrong password → Shows authentication error
- [ ] Non-existent email → Shows error
- [ ] Empty fields → Shows validation error

**Status:** ___________

---

## 🎯 Recommendation Feed ("For You" Tab)

### Initial Load

**Test Steps:**
1. [ ] Open "For You" tab
2. [ ] Wait for load (with skeleton loaders)
3. [ ] Observe activity cards appear

**Expected Results:**
- ✅ Header shows "For You"
- ✅ Greeting shows user's first name
- ✅ Skeleton loaders appear during load (2 cards)
- ✅ **25 diverse activities** appear after load
- ✅ Activity cards show: image, name, category, distance, rating, price, AI reason
- ✅ Each card has "Add to Calendar" and "See Details" buttons
- ✅ **6 sponsored activities** have visible "Sponsored" badge

**Status:** ___________

---

### Activity Card Content

**Verify Each Card Shows:**
- [ ] High-quality image (Unsplash photos)
- [ ] Activity name (clear, readable)
- [ ] Category tag (Coffee, Dining, Fitness, etc.)
- [ ] Distance (e.g., "0.8 miles away")
- [ ] Rating stars + count (e.g., "4.5 ⭐ (1,250)")
- [ ] Price range ($, $$, $$$)
- [ ] AI-generated reason (e.g., "Based on your love of...")
- [ ] Sponsored badge (if applicable)

**Variety Check:**
- [ ] See coffee shops (3+)
- [ ] See restaurants (5+)
- [ ] See live music venues (3+)
- [ ] See fitness locations (4+)
- [ ] See outdoor activities (3+)
- [ ] See arts/culture (3+)
- [ ] See bars (2+)
- [ ] See shopping (2+)
- [ ] Distance varies (0.5 - 4.5 miles)
- [ ] Price varies (FREE - $$$)
- [ ] Some free activities exist

**Status:** ___________

---

### Interactions

**Double-Tap to Like:**
1. [ ] Double-tap an activity card image
2. [ ] See heart animation appear
3. [ ] Feel haptic feedback
4. [ ] Small heart badge shows on card

**See Details:**
1. [ ] Tap "See Details" button
2. [ ] Alert shows with full details:
   - Name
   - Description
   - Address
   - Rating
   - Price
   - Distance
   - Score breakdown
   - Confidence percentage
3. [ ] Tap "OK" to dismiss

**Scroll Performance:**
- [ ] Scroll through all 25 activities
- [ ] Scrolling is smooth (60fps, no jank)
- [ ] Images load progressively
- [ ] No crashes or freezing

**Status:** ___________

---

### **NEW: Add to Calendar with Time Options**

**Test Steps:**
1. [ ] Tap "Add to Calendar" on any activity
2. [ ] Alert appears: `Add "[Activity Name]"`
3. [ ] See message: "When would you like to go?"
4. [ ] See 4 buttons:
   - "Today Evening (6pm)"
   - "Tomorrow Afternoon (2pm)"
   - "This Weekend"
   - "Cancel"

**Test Option 1: Today Evening**
1. [ ] Tap "Today Evening (6pm)"
2. [ ] Feel haptic feedback
3. [ ] Success alert appears: "Added to Calendar! 🎉"
4. [ ] Message shows formatted time (e.g., "Thu, Oct 18, 6:00 PM")
5. [ ] Tap "Great!" to dismiss
6. [ ] Go to Calendar tab
7. [ ] See event scheduled for today at 6pm with 2-hour duration (6pm-8pm)

**Test Option 2: Tomorrow Afternoon**
1. [ ] Tap "Add to Calendar" on different activity
2. [ ] Select "Tomorrow Afternoon (2pm)"
3. [ ] See success with correct date/time
4. [ ] Verify in Calendar tab: tomorrow at 2pm, 2-hour duration

**Test Option 3: This Weekend**
1. [ ] Tap "Add to Calendar" on third activity
2. [ ] Select "This Weekend"
3. [ ] See success with Saturday date at noon
4. [ ] Verify in Calendar tab: next Saturday at 12pm, 3-hour duration

**Edge Case: Past Time Handling**
1. [ ] Test after 6pm
2. [ ] Select "Today Evening"
3. [ ] Should auto-schedule for **tomorrow** evening (not today)
4. [ ] Verify correct behavior

**Status:** ___________

---

### Pull to Refresh

**Test Steps:**
1. [ ] Pull down on recommendation feed
2. [ ] See loading spinner (brand blue color)
3. [ ] Feel haptic feedback (light impact)
4. [ ] New recommendations appear (or same, shuffled)
5. [ ] Success haptic (if loaded successfully)

**Status:** ___________

---

### Empty State

**Test Steps:**
1. [ ] (Hard to test with mock data, skip for now)
2. [ ] If no recommendations: See "No Recommendations Yet" message
3. [ ] See large star icon
4. [ ] See friendly message with user's name
5. [ ] See instruction: "Pull down to discover..."

**Status:** ___________

---

## 📅 Calendar Tab

### Calendar View

**Test Steps:**
1. [ ] Tap "Calendar" tab
2. [ ] See month calendar with current date highlighted
3. [ ] See "+" button in header
4. [ ] See selected date's events below calendar

**Visual Check:**
- [ ] Today's date highlighted in blue
- [ ] Selected date has different color
- [ ] Month/year displayed at top
- [ ] Can swipe to change months
- [ ] Days with events have dots/markers

**Status:** ___________

---

### View Events for a Date

**Test Steps:**
1. [ ] Tap a date with events (e.g., today if you added from feed)
2. [ ] See formatted date: "Thursday, October 18, 2025"
3. [ ] See count: "X activities"
4. [ ] See event cards with:
   - Category icon + color
   - Event title
   - Start time (e.g., "6:00 PM")
   - Location address
   - Left border colored by category

**Status:** ___________

---

### View Events for Empty Date

**Test Steps:**
1. [ ] Tap a date with no events
2. [ ] See empty state:
   - Large calendar icon
   - "No activities scheduled"
   - "Tap the + button to add a task"

**Status:** ___________

---

### **NEW: Create Manual Event with Duration Picker**

**Test Steps:**
1. [ ] Tap "+" button in header
2. [ ] Modal slides up from bottom
3. [ ] See "Create Task" header
4. [ ] See form fields in order:
   - Title *
   - Description (optional)
   - Date
   - Time
   - **Duration** ← NEW FIELD
   - Location *
   - Category

**Fill Out Form:**
1. [ ] Title: "Test Coffee Meeting"
2. [ ] Description: "Meeting with friend"
3. [ ] Date: Tap → Select tomorrow
4. [ ] Time: Tap → Select 10:00 AM
5. [ ] **Duration: Tap "2 hours"** ← TEST THIS
6. [ ] Location: "Blue Bottle Coffee"
7. [ ] Category: Tap "Social" (people icon)
8. [ ] Scroll down → Tap "Create Task" button

**Duration Picker Tests:**

**Visual:**
- [ ] See 5 duration options in horizontal row:
  - 30 min
  - 1 hour (default, pre-selected)
  - 2 hours
  - 3 hours
  - All Day
- [ ] Selected option: Blue background + white text
- [ ] Unselected options: Gray background + theme text
- [ ] Options have rounded borders

**Functionality:**
1. [ ] Tap "30 min" → Becomes selected (blue)
2. [ ] Feel haptic feedback
3. [ ] Previous selection de-selected
4. [ ] Tap "2 hours" → Becomes selected
5. [ ] Tap "3 hours" → Becomes selected
6. [ ] Tap "All Day" → Becomes selected

**Create Event with Each Duration:**
- [ ] Create event with **30 min** duration → Verify ends 30min after start
- [ ] Create event with **1 hour** duration → Verify ends 1hr after start
- [ ] Create event with **2 hours** duration → Verify ends 2hr after start
- [ ] Create event with **3 hours** duration → Verify ends 3hr after start
- [ ] Create event with **All Day** → Verify ends at 11:59pm same day

**Expected Results:**
- ✅ Modal closes after creation
- ✅ Success alert: "Task added to calendar!"
- ✅ Event appears on selected date
- ✅ Event shows correct start and end times based on duration

**Error Cases:**
- [ ] Leave title empty → Shows "Please enter a task title"
- [ ] Leave location empty → Shows "Please enter a location"
- [ ] All other fields work without validation

**Status:** ___________

---

### Category Selection

**Test Each Category:**
- [ ] Dining (restaurant icon, red #FF6B6B)
- [ ] Entertainment (music icon, teal #4ECDC4)
- [ ] Fitness (dumbbell icon, green #95E1D3)
- [ ] Social (people icon, coral #F38181)
- [ ] Work (briefcase icon, purple #AA96DA)
- [ ] Personal (person icon, pink #FCBAD3)
- [ ] Travel (airplane icon, blue #A8D8EA)
- [ ] Other (ellipsis icon, lavender #C7CEEA)

**Verify:**
- [ ] Selected category has colored background
- [ ] Icon changes color
- [ ] Only one can be selected at a time
- [ ] Haptic feedback on selection

**Status:** ___________

---

### Date/Time Pickers

**Date Picker:**
1. [ ] Tap date button
2. [ ] Native date picker appears (iOS calendar wheel or Android dialog)
3. [ ] Select a future date
4. [ ] Date updates in button
5. [ ] Picker closes (on Android; stays on iOS)

**Time Picker:**
1. [ ] Tap time button
2. [ ] Native time picker appears
3. [ ] Select a time (e.g., 3:30 PM)
4. [ ] Time updates in button with format "3:30 PM"

**Status:** ___________

---

### Edit/Delete Events

**Test Steps:**
1. [ ] (Not implemented in MVP)
2. [ ] For now: Events are read-only once created
3. [ ] Phase 2: Add edit/delete functionality

**Status:** ___________

---

### Mark as Complete & Feedback

**Test Steps:**
1. [ ] Create event with past end time (or wait for event to end)
2. [ ] Refresh calendar (close and reopen app)
3. [ ] Event now shows "Rate Activity" button (blue checkmark)
4. [ ] Tap "Rate Activity"
5. [ ] Feedback modal appears (see Feedback section below)

**Status:** ___________

---

### Loop View Button

**Test Steps:**
1. [ ] View a date with 2+ events
2. [ ] See "View Loop Map" button at bottom
3. [ ] Tap button
4. [ ] Alert: "Loop View: Map visualization coming in Phase 2!"
5. [ ] Tap OK

**Status:** ___________

---

## 👥 Friends Tab

### Friends List

**Test Steps:**
1. [ ] Tap "Friends" tab
2. [ ] If no friends: See empty state
3. [ ] If have friends: See list of friend cards

**Friend Card Content:**
- [ ] Profile picture OR initials in colored circle
- [ ] Friend's name
- [ ] Friend's email
- [ ] Loop Score with lightning bolt icon ⚡
- [ ] "View Loop" button

**Status:** ___________

---

### Add Friend

**Test Steps:**
1. [ ] Tap "+" button in header
2. [ ] Modal appears: "Add Friend"
3. [ ] See email input field
4. [ ] See help text: "Enter your friend's email address"
5. [ ] Enter email: (existing user's email)
6. [ ] Tap "Find Friend" button
7. [ ] See loading state (button shows "Searching...")
8. [ ] Success: "Friend request sent!"
9. [ ] Modal closes

**Error Cases:**
- [ ] Empty email → "Please enter an email address"
- [ ] Your own email → "You can't add yourself as a friend!"
- [ ] Non-existent email → "No user found with that email address"
- [ ] Already friends → "Already Friends"
- [ ] Request already sent → "Request Pending"

**Status:** ___________

---

### Friend Requests

**Test Steps:**
1. [ ] Have another user send you a friend request
2. [ ] Refresh friends tab (close and reopen)
3. [ ] See "Friend Requests" section at top
4. [ ] See blue badge with count (e.g., "2")
5. [ ] See request card with:
   - Sender's profile picture/initials
   - Sender's name
   - Sender's email
   - "Accept" button (green checkmark)
   - "Decline" button (gray outlined)
   - Blue highlighted border

**Accept Request:**
1. [ ] Tap "Accept" button
2. [ ] Feel haptic feedback (medium)
3. [ ] Success haptic (notification type)
4. [ ] Alert: "You're now friends with [Name]!"
5. [ ] Request disappears from list
6. [ ] Friend appears in "My Friends" section below
7. [ ] Friend count updates

**Decline Request:**
1. [ ] Tap "Decline" button
2. [ ] Feel haptic feedback
3. [ ] Request disappears immediately
4. [ ] No confirmation alert

**Status:** ___________

---

### View Friend's Loop

**Test Steps:**
1. [ ] Tap on any friend card
2. [ ] Feel haptic feedback
3. [ ] Alert appears: "View Loop"
4. [ ] Shows friend's Loop Score
5. [ ] Shows message: "Full Loop viewing coming in Phase 2!"
6. [ ] Lists upcoming features:
   - Today's activities
   - Upcoming events
   - Activity history
   - Shared interests
7. [ ] Tap "OK"

**Status:** ___________

---

### Loop Score Leaderboard

**Test Steps:**
1. [ ] If you have 1+ friends, scroll to bottom
2. [ ] See "Top Loop Scores" section
3. [ ] Trophy icon 🏆 in header
4. [ ] See top 5 friends ranked by Loop Score
5. [ ] Each shows: Rank (#1, #2, etc.), Name, Score
6. [ ] Sorted from highest to lowest

**Status:** ___________

---

### Empty States

**No Friends:**
- [ ] Large people icon
- [ ] "No friends yet"
- [ ] Helpful message: "Add friends to share activities and compete on Loop Scores!"

**No Requests:**
- [ ] "Friend Requests" section doesn't appear at all
- [ ] Clean, uncluttered UI

**Status:** ___________

---

## 💬 Feedback System

### Feedback Modal (After Completing Activity)

**Trigger Modal:**
1. [ ] Complete an activity (wait for end time to pass)
2. [ ] Open app or tap "Rate Activity" button
3. [ ] Feedback modal appears from bottom

**Modal Content:**
- [ ] Activity name at top
- [ ] "How was it?" question
- [ ] Two large buttons:
  - Thumbs Up 👍 (green)
  - Thumbs Down 👎 (red)
- [ ] Both disabled initially (must select one)

**Give Positive Feedback:**
1. [ ] Tap "Thumbs Up" button
2. [ ] Button turns green
3. [ ] Positive tags appear:
   - "Great value"
   - "Convenient"
   - "Loved it!"
4. [ ] Optional: Select 1-3 tags
5. [ ] Optional: Add text notes
6. [ ] Tap "Submit Feedback"
7. [ ] Success message: "Thanks for your feedback! 🎯"
8. [ ] Modal closes

**Give Negative Feedback:**
1. [ ] Tap "Thumbs Down" button
2. [ ] Button turns red
3. [ ] Negative tags appear:
   - "Too expensive"
   - "Too far"
   - "Too crowded"
   - "Boring"
   - "Bad weather"
4. [ ] Optional: Select tags
5. [ ] Optional: Add notes
6. [ ] Submit
7. [ ] Success message appears

**AI Profile Update:**
- [ ] After feedback, AI profile updates in database
- [ ] (Check Supabase: users.ai_profile JSON field)
- [ ] Favorite/disliked categories updated
- [ ] Preferences adjusted based on tags

**Status:** ___________

---

## 🎨 UI/UX Testing

### Dark Mode

**Test Steps:**
1. [ ] Toggle device to dark mode (System Settings)
2. [ ] Reopen app (or it should auto-update)

**Check All Screens:**
- [ ] **For You Tab:**
  - Background is dark
  - Text is light/white
  - Activity cards have dark background
  - Buttons have correct dark mode colors
  - No white flashes or light backgrounds

- [ ] **Calendar Tab:**
  - Calendar has dark theme
  - Event cards have dark backgrounds
  - Modal has dark background
  - Input fields have dark backgrounds
  - Text is readable (light color)

- [ ] **Friends Tab:**
  - Friend cards have dark backgrounds
  - Text is light
  - Modal has dark theme

- [ ] **Modals:**
  - Create task modal: dark background
  - Add friend modal: dark background
  - Feedback modal: dark background

**Status:** ___________

---

### Light Mode

**Test Steps:**
1. [ ] Toggle device to light mode
2. [ ] Verify all screens look good
3. [ ] Check: backgrounds white, text dark, proper contrast

**Status:** ___________

---

### Haptic Feedback

**Test on Physical Device:**
(Haptics don't work on simulator/emulator)

- [ ] Pull to refresh → Light impact
- [ ] Tap activity card → Medium impact
- [ ] Add to calendar success → Success notification
- [ ] Button presses → Light impact
- [ ] Switch tabs → Light impact
- [ ] Accept friend request → Medium + success
- [ ] Create event → Success notification
- [ ] Feedback submission → Success notification

**Status:** ___________

---

### Loading States

**Check These Show Properly:**
- [ ] **Feed:** Skeleton loaders (2 shimmer cards) while loading
- [ ] **Auth:** Spinner when signing in/up
- [ ] **Calendar:** Loading indicator when fetching events
- [ ] **Friends:** Loading when searching for user
- [ ] **Add to Calendar:** Button disabled + spinner during save

**Status:** ___________

---

### Animations

**Verify Smooth Animations:**
- [ ] Modal slide up (calendar create, add friend)
- [ ] Pull-to-refresh spinner rotation
- [ ] Tab switch fade
- [ ] Card press scale (subtle 0.98x)
- [ ] Double-tap heart animation (scale + fade)
- [ ] Skeleton shimmer effect (opacity pulse)

**Status:** ___________

---

### Typography & Spacing

**Visual Check:**
- [ ] All text is readable (not too small)
- [ ] Consistent font sizes across screens
- [ ] Proper spacing between elements (not cramped)
- [ ] Buttons are easy to tap (≥44pt touch targets)
- [ ] No text overlap or clipping
- [ ] Icons aligned with text

**Status:** ___________

---

### Brand Colors

**Verify Brand Colors Used:**
- [ ] Primary: Loop Blue (#0066FF) - buttons, selected states
- [ ] Success: Loop Green (#00D9A3) - accept buttons
- [ ] Like: Pink (#FF3B6C) - heart/like indicators
- [ ] Star: Gold (#FFD700) - ratings
- [ ] Category colors: Correct for each category

**Status:** ___________

---

## 🐛 Performance Testing

### App Launch

**Test Steps:**
1. [ ] Close app completely
2. [ ] Reopen app
3. [ ] Time from tap to interactive:
   - **Target:** < 3 seconds
   - **Actual:** _______ seconds

**Status:** ___________

---

### Memory Usage

**Test Steps:**
1. [ ] Use app for 10-15 minutes
2. [ ] Navigate between all 3 tabs multiple times
3. [ ] Add several activities to calendar
4. [ ] Scroll through all recommendations
5. [ ] Check device settings: Memory usage
   - **Target:** < 200MB
   - **Actual:** _______ MB

**No Crashes:**
- [ ] App doesn't crash during normal use
- [ ] No force closes
- [ ] No freezing/hanging

**Status:** ___________

---

### Scroll Performance

**Test Steps:**
1. [ ] Scroll through 25 recommendations quickly
2. [ ] Scroll calendar months forward/backward
3. [ ] Scroll through friends list (if many friends)

**Smoothness:**
- [ ] No stuttering or jank
- [ ] Images load without causing lag
- [ ] Maintains 60fps (feels smooth)

**Status:** ___________

---

### Network Efficiency

**Test Steps:**
1. [ ] (Mock data = no network for now)
2. [ ] Phase 2: Test with real API calls

**Status:** ___________

---

## 🔄 State Management & Data Persistence

### Session Persistence

**Test Steps:**
1. [ ] Add activities to calendar
2. [ ] Add friends
3. [ ] Close app completely (kill from multitask)
4. [ ] Reopen app

**Expected:**
- [ ] Still signed in (no need to login again)
- [ ] Calendar events still there
- [ ] Friends list still there
- [ ] User profile data preserved

**Status:** ___________

---

### Data Consistency

**Test Steps:**
1. [ ] Add event to calendar from recommendation feed
2. [ ] Go to Calendar tab → Event appears immediately
3. [ ] Accept friend request
4. [ ] Friend appears in list immediately (no need to refresh)

**Status:** ___________

---

## 📱 Platform-Specific Testing

### iOS Specific

**Test Steps:**
- [ ] SF Symbols icons render correctly
- [ ] Native date/time pickers work
- [ ] Keyboard dismissal works (tap outside)
- [ ] Safe area respected (no text under notch)
- [ ] Haptics feel responsive

**Status:** ___________

---

### Android Specific

**Test Steps:**
- [ ] Material icons render correctly
- [ ] Native date/time pickers work
- [ ] Back button works (closes modals, navigates back)
- [ ] Keyboard doesn't cover input fields
- [ ] Edge-to-edge layout works

**Status:** ___________

---

### Web Specific (If Testing Web)

**Test Steps:**
- [ ] Responsive layout
- [ ] Mouse hover states work
- [ ] Click interactions work
- [ ] No mobile-specific components break

**Status:** ___________

---

## 🚨 Edge Cases & Error Handling

### No Internet Connection

**Test Steps:**
1. [ ] Turn off WiFi and cellular data
2. [ ] Try to use app

**Expected:**
- [ ] Mock data still works (local)
- [ ] Supabase calls fail gracefully
- [ ] Shows error message (not crash)

**Status:** ___________

---

### Long Text Handling

**Test Steps:**
1. [ ] Create event with very long title (100+ characters)
2. [ ] Create event with long description
3. [ ] Add activity with long name

**Expected:**
- [ ] Text truncates properly (ellipsis ...)
- [ ] No layout breaking
- [ ] Still readable

**Status:** ___________

---

### Rapid Interactions

**Test Steps:**
1. [ ] Rapidly tap "Add to Calendar" multiple times
2. [ ] Rapidly switch between tabs
3. [ ] Rapidly scroll

**Expected:**
- [ ] No duplicate events created
- [ ] No crashes
- [ ] Handles gracefully

**Status:** ___________

---

### Empty Data States

**Test Steps:**
1. [ ] New user with no calendar events
2. [ ] New user with no friends
3. [ ] New user with no recommendations (hard to test with mock)

**Expected:**
- [ ] Proper empty states show
- [ ] Helpful messaging
- [ ] Clear calls to action

**Status:** ___________

---

## 📊 Database Testing (Supabase)

### Events Saved Correctly

**Test Steps:**
1. [ ] Add event from recommendation
2. [ ] Go to Supabase dashboard → calendar_events table
3. [ ] Find your event

**Verify Columns:**
- [ ] user_id: Correct UUID
- [ ] title: Activity name
- [ ] description: Populated
- [ ] category: Lowercase with underscores
- [ ] location: POINT(lng lat) format
- [ ] address: Full address string
- [ ] start_time: ISO timestamp
- [ ] end_time: ISO timestamp (start + duration)
- [ ] status: 'scheduled'
- [ ] source: 'recommendation' or 'manual'
- [ ] created_at: Recent timestamp

**Status:** ___________

---

### Friendships Saved Correctly

**Test Steps:**
1. [ ] Send friend request
2. [ ] Check Supabase → friendships table
3. [ ] Find your friendship record

**Verify Columns:**
- [ ] user_id: Your UUID
- [ ] friend_id: Friend's UUID
- [ ] status: 'pending' → changes to 'accepted' after accept
- [ ] can_view_loop: true (default)
- [ ] can_invite_to_activities: true (default)
- [ ] created_at: Request send time
- [ ] accepted_at: NULL → populated after accept

**Status:** ___________

---

### User Profile Updated

**Test Steps:**
1. [ ] Give feedback on activities
2. [ ] Check Supabase → users table → your user
3. [ ] Check ai_profile JSONB field

**Verify Updates:**
- [ ] favorite_categories: Thumbs up categories added
- [ ] disliked_categories: Thumbs down categories added
- [ ] price_sensitivity: Adjusts based on "too expensive" tags
- [ ] distance_tolerance: Adjusts based on "too far" tags

**Status:** ___________

---

## 🎯 MVP Completeness Check

### Core Features (Must Have)

- [ ] ✅ User authentication (signup, login, onboarding)
- [ ] ✅ Recommendation feed with 25 diverse activities
- [ ] ✅ AI scoring algorithm (interest match, location, time, feedback)
- [ ] ✅ **Add to calendar with time options (NEW)**
- [ ] ✅ Calendar view (monthly + daily events)
- [ ] ✅ **Manual event creation with duration picker (NEW)**
- [ ] ✅ Friends system (add, accept, view list)
- [ ] ✅ Loop Scores displayed
- [ ] ✅ Feedback system (thumbs up/down)
- [ ] ✅ AI profile learning (categories, preferences)
- [ ] ✅ Dark mode support
- [ ] ✅ Haptic feedback
- [ ] ✅ Loading states
- [ ] ✅ Empty states

### Missing Features (Nice to Have)

- [ ] ⏱️ Google Places API integration (real data)
- [ ] ⏱️ Location permissions & GPS
- [ ] ⏱️ Group planning feature
- [ ] ⏱️ Push notifications
- [ ] ⏱️ Profile editing
- [ ] ⏱️ Loop View map visualization
- [ ] ⏱️ Real-time updates (Supabase subscriptions)

**MVP Completeness:** ~72% (was 65% before this session)

---

## 🐛 Issues Found

### Critical (Blocks Testing)

**Issue #:**
**Description:**
**Steps to Reproduce:**
**Expected:**
**Actual:**
**Status:**

---

### High Priority (Major UX Issue)

**Issue #:**
**Description:**
**Steps to Reproduce:**
**Expected:**
**Actual:**
**Status:**

---

### Medium Priority (Minor Issue)

**Issue #:**
**Description:**
**Steps to Reproduce:**
**Expected:**
**Actual:**
**Status:**

---

### Low Priority (Polish/Enhancement)

**Issue #:**
**Description:**
**Steps to Reproduce:**
**Expected:**
**Actual:**
**Status:**

---

## ✅ Testing Sign-Off

**Tester Name:** _________________________
**Date:** _________________________
**Device:** _________________________
**OS Version:** _________________________
**App Version:** MVP v0.72

**Overall Status:**
- [ ] All critical tests passed
- [ ] Ready for demo
- [ ] Ready for beta testing
- [ ] Needs more work (see issues above)

**Additional Notes:**
_________________________________________________________
_________________________________________________________
_________________________________________________________

---

**Next Steps After Testing:**
1. Fix any critical/high priority issues found
2. Retest after fixes
3. Prepare for demo or beta launch
4. Integrate Google Places API for real data
5. Build group planning feature

---

*Testing checklist generated for Loop MVP v0.72*
*Last updated: October 18, 2025*
