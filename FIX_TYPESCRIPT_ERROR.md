# Fix TypeScript Error - Quick Guide

## Problem
You accidentally pasted my instructions into `app/(tabs)/index.tsx` around line 25-32.

## Solution

### Step 1: Open the file
Open `app/(tabs)/index.tsx` in your code editor

### Step 2: Find lines 24-33
Look for this section (around line 24):

```typescript
import { handleError, showErrorAlert } from '@/utils/error-handler';
  // Type for lat/lng coordinates
  type PlaceLocation = { lat: number; lng: number };

  Insert it right after:
  import { handleError, showErrorAlert } from '@/utils/error-handler';

  // ADD THIS LINE HERE ⬇️
  type PlaceLocation = { lat: number; lng: number };

export default function RecommendationFeedScreen() {
```

### Step 3: Replace with this EXACT text

Delete everything from line 24 to line 34, and replace with:

```typescript
import { handleError, showErrorAlert } from '@/utils/error-handler';

// Type for lat/lng coordinates
type PlaceLocation = { lat: number; lng: number };

export default function RecommendationFeedScreen() {
```

### Step 4: Save the file

### Step 5: Verify it works
Run: `npx tsc --noEmit`

Should show: **No errors!** ✅

---

## What Happened
When I said "add this line", you accidentally copied the entire instruction text including "Insert it right after:" into the code file. That's not valid TypeScript syntax!

---

## After You Fix This
Come back and let me know, then we'll tackle the migration issue!
