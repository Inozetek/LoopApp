# Fixes Applied - Calendar Task Creation

## Summary
Fixed two issues with the calendar task creation feature:
1. ✅ Database RLS policy error (code 42501)
2. ✅ End Time UI layout misalignment

---

## Issue 1: Database Error Code 42501

### Problem
When trying to create a calendar task, the app showed error code 42501. This is a PostgreSQL Row Level Security (RLS) error that occurs when insert policies are missing or incorrect.

### Root Cause
The `calendar_events` table has RLS enabled, but the INSERT policy was not properly configured to allow authenticated users to create their own events.

### Solution
A migration file already exists at `supabase/migrations/fix_calendar_events_rls.sql`.

**You need to run this SQL in your Supabase Dashboard:**

1. Go to: https://qcjyatstnnalxxugfwqy.supabase.co/project/_/sql
2. Copy the contents from `supabase/migrations/fix_calendar_events_rls.sql`
3. Paste and click **RUN**

Or see the detailed instructions in: `FIX_CALENDAR_RLS.md`

The migration will:
- Drop any existing RLS policies
- Enable RLS on `calendar_events` table
- Create proper policies for SELECT, INSERT, UPDATE, DELETE operations
- Allow users to only access their own calendar events

---

## Issue 2: End Time UI Layout

### Problem
In the Create Task modal, the "End Time" text was appearing beneath the clock icon instead of to the right of it (like the Start Time field).

### Root Cause
The End Time button was using `styles.datePickerButton` (which doesn't exist in the StyleSheet) instead of `styles.dateTimeButton`. It was also missing the `marginLeft: Spacing.sm` style on the text.

### Solution
**File:** `app/(tabs)/calendar.tsx` (Lines 774, 778)

**Changes:**
```diff
- style={[styles.datePickerButton, { backgroundColor: isDark ? '#2f3133' : '#f5f5f5' }]}
+ style={[styles.dateTimeButton, { backgroundColor: isDark ? '#2f3133' : '#f5f5f5' }]}

- <Text style={[Typography.bodyLarge, { color: Colors[colorScheme ?? 'light'].text }]}>
+ <Text style={[Typography.bodyLarge, { color: Colors[colorScheme ?? 'light'].text, marginLeft: Spacing.sm }]}>
```

Now the End Time button matches the Start Time button layout exactly, with the clock icon on the left and time text to the right with proper spacing.

---

## Testing

### Test the UI Fix (Already Applied)
1. Run `npx expo start`
2. Open the app
3. Go to Calendar tab
4. Tap the + button to create a task
5. Verify "End Time" appears to the RIGHT of the clock icon (not below it)

### Test the Database Fix (After Running SQL)
1. Fill out the Create Task form:
   - Title: "Test Task"
   - Location: Search and select any location
   - Category: Any category
2. Tap "Create Task"
3. Verify the task appears in your calendar without error code 42501

---

## Files Modified
- ✅ `app/(tabs)/calendar.tsx` - Fixed End Time UI layout
- 📝 `FIX_CALENDAR_RLS.md` - Instructions for database fix (new file)
- 📝 `FIXES_APPLIED.md` - This summary document (new file)

## Next Steps
1. **Run the RLS migration SQL** in your Supabase dashboard (see FIX_CALENDAR_RLS.md)
2. **Test task creation** to confirm both fixes work
3. **Commit the changes** when ready

```bash
git add app/(tabs)/calendar.tsx
git commit -m "Fix calendar task creation: UI layout and RLS policy instructions"
```
