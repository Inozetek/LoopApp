# Quick Start: Testing the Calendar Feature

## Start the App

```bash
npm start
```

Then scan QR code with Expo Go app on your phone.

---

## Test Flow 1: Create a Manual Task

1. **Open the Calendar tab** (rightmost tab)
2. **Tap the "+" button** in the top-right
3. **Fill out the form:**
   - Title: "Coffee with Sarah"
   - Description: "Catch up and discuss the project"
   - Date: Tomorrow
   - Time: 9:00 AM
   - Location: "Starbucks, 123 Main St"
   - Category: Dining (tap the restaurant icon)
4. **Tap "Create Task"**
5. **Result:** Modal closes, success alert shows, event appears in calendar

---

## Test Flow 2: Add from Recommendations

1. **Go to the "For You" tab** (center tab with sparkles icon)
2. **Find a recommendation you like**
   - Example: "Blue Cup Coffee" or "Klyde Warren Park"
3. **Tap "Add to Calendar"**
4. **Tap "Add" in the confirmation dialog**
5. **Success alert appears:** "Blue Cup Coffee has been added to your calendar for tomorrow at 2:00 PM"
6. **Switch to Calendar tab**
7. **Select tomorrow's date**
8. **Result:** Event appears in the list!

---

## Test Flow 3: Browse Calendar

1. **Open Calendar tab**
2. **Tap different dates** in the calendar
3. **Observe:**
   - Selected date is highlighted in blue
   - Event list updates for each date
   - Empty state shows when no events
   - Event cards are color-coded by category

---

## What to Look For

### Visual Polish:
- ✅ Calendar highlights today and selected date
- ✅ Event cards have colored left borders (category colors)
- ✅ Icons match categories
- ✅ Clean typography and spacing
- ✅ Dark mode works (change phone settings to test)

### Interactions:
- ✅ Haptic feedback when tapping dates
- ✅ Smooth modal animations
- ✅ Date/time pickers are native (iOS/Android specific)
- ✅ Form validation (try submitting without title)

### Functionality:
- ✅ Events persist after app reload
- ✅ Can create multiple events on same day
- ✅ Can switch between tabs without losing data
- ✅ Recommendations flow into calendar

---

## Known Issues (Expected):

1. **Location coordinates are default (Dallas)** - Real geocoding coming in Phase 2
2. **"View Loop Map" button shows "Coming soon"** - Map visualization deferred to Phase 2
3. **Can't edit events yet** - Edit/delete coming in Phase 2
4. **Mock activity data** - Google Places API integration coming soon

---

## If Something Breaks:

```bash
# Reset Metro cache and restart
npm start -- --reset-cache

# Or kill all Node processes and restart
# Windows:
taskkill /F /IM node.exe
npm start

# Mac/Linux:
killall node
npm start
```

---

## Expected Console Logs:

```
Generated 5 recommendations for [Your Name]
Recommendation accepted: [uuid]
```

---

## Next Steps:

1. Test all three flows above
2. Try dark mode
3. Create multiple events
4. Report any bugs or unexpected behavior

Enjoy exploring your new Calendar feature! 🎉
