# Location Autocomplete Improvements

## Summary
Enhanced the location autocomplete component to provide better UX when selecting locations:
1. ✅ Prepend place name to the location field
2. ✅ Hide suggestions list after selection

---

## Changes Made

### File: `components/location-autocomplete.tsx`

#### Change 1: Prepend Place Name to Display Text (Line 303-306)

**Before:**
```typescript
// Set the input text to the selected prediction
onChangeText(prediction.description);
```

**After:**
```typescript
// Set the input text to show place name first, then address
// Format: "Place Name - Full Address"
const displayText = `${prediction.structured_formatting.main_text} - ${prediction.description}`;
onChangeText(displayText);
```

**Benefit:** When you select "Starbucks, 123 Main St, Dallas, TX", the field now shows:
- **New:** `Starbucks - 123 Main St, Dallas, TX`
- **Old:** `123 Main St, Dallas, TX` (just the address)

This makes it immediately clear which place you selected.

---

#### Change 2: Prevent Suggestions List from Reappearing (Line 363-366)

**Before:**
```typescript
onChangeText={(text) => {
  onChangeText(text);
  setShowPredictions(text.length >= 3);
}}
```

**After:**
```typescript
onChangeText={(text) => {
  onChangeText(text);
  // Only show predictions if we didn't just select one
  if (!justSelectedRef.current) {
    setShowPredictions(text.length >= 3);
  }
}}
```

**Problem Solved:** Previously, when you selected a location, the component would:
1. Close the suggestions list (line 300)
2. Update the text field with the selected location (line 306)
3. **Bug:** The `onChangeText` callback would trigger and see the text length > 3, so it would show predictions again!

**Solution:** Check if we just selected a prediction (`justSelectedRef.current`) before showing the list. The ref is already being set to `true` on line 293 and reset to `false` in the useEffect on line 63.

---

## How It Works Now

### User Flow:
1. User types "star" in the location field
2. After 300ms debounce, suggestions appear: "Starbucks", "Star Cinema", etc.
3. User taps "Starbucks - 123 Main St, Dallas, TX"
4. **Immediately:**
   - ✅ Keyboard dismisses
   - ✅ Suggestions list closes
   - ✅ Text field updates to: `Starbucks - 123 Main St, Dallas, TX`
   - ✅ Map preview appears below with pin at Starbucks location
   - ✅ Category auto-selects to "Dining" (based on place type)
5. **No more stuck suggestions list!**

---

## Testing

### Test Case 1: Place Name Prepending
1. Open Calendar tab → Tap + button
2. Scroll to "Location" field
3. Type "starbucks"
4. Tap any Starbucks from the list
5. **Expected:** Field shows `Starbucks - [full address]` (place name first)
6. **Before:** Field showed just `[full address]` (no place name)

### Test Case 2: Suggestions List Hiding
1. Open Calendar tab → Tap + button
2. Scroll to "Location" field
3. Type "target"
4. Wait for suggestions to appear
5. Tap "Target - 456 Oak Ave, Dallas, TX"
6. **Expected:** Suggestions list immediately disappears and stays hidden
7. **Before:** Suggestions list would reappear after selection (stuck on screen)

### Test Case 3: Suggestions Re-Appear on Manual Edit
1. Complete Test Case 2 (select a location)
2. Tap back into the location field
3. Manually edit the text (e.g., delete a character)
4. **Expected:** Suggestions list re-appears (user is searching again)
5. This proves `justSelectedRef` is being reset correctly

---

## Technical Details

### How `justSelectedRef` Works:
- **Purpose:** Track if the user just selected a prediction to prevent re-triggering the suggestions list
- **Set to true:** When user taps a prediction (line 293)
- **Set to false:** In useEffect when text changes from user typing (line 63)
- **Used in:** TextInput `onChangeText` to conditionally show predictions (line 364)

### Flow Diagram:
```
User taps prediction
  ↓
justSelectedRef = true
  ↓
onChangeText() called with selected text
  ↓
Check: justSelectedRef.current?
  → YES: Skip setShowPredictions (list stays hidden)
  ↓
useEffect triggered
  ↓
justSelectedRef = false (reset for next search)
```

---

## Files Modified
- ✅ `components/location-autocomplete.tsx` (2 changes)

## Next Steps
**Test the improvements:**
```bash
npx expo start
# Test location selection in Calendar → Create Task → Location field
```

**Commit when ready:**
```bash
git add components/location-autocomplete.tsx
git commit -m "Improve location autocomplete UX: prepend place name and fix stuck suggestions"
```
