# Date-Filtered Recommendations + Social Moments — Design Summary

## Overview

Two major feature sets researched and designed by agents:

1. **Date-Filtered Recommendations** — Browse recs for a specific day, with calendar-aware smart time slots
2. **Moments / Social Sharing** — Share completed activities to a feed friends can see

Plus two supporting features:
3. **Mini Loop SVG** — Tiny route preview on calendar day headers
4. **Frosted glass badge redesign** — Activity card badge refresh (pending from previous session)

---

## FEATURE 1: Date-Filtered Recommendations

### Components

| Component | File | Purpose |
|-----------|------|---------|
| `DateFilterBar` | `components/date-filter-bar.tsx` | Horizontal pill chips: Today, Tomorrow, Sat 22, Sun 23... + calendar icon |
| `DatePickerSheet` | `components/date-picker-sheet.tsx` | Bottom sheet calendar for dates 7+ days out |
| `DateContextBanner` | `components/date-context-banner.tsx` | "Saturday, Feb 22 — 3 events, 4 hrs free" above feed |
| Smart Time Slot Engine | `services/time-slot-engine.ts` | Analyzes calendar, computes free time gaps, matches activities to slots |
| Activity duration estimates | `constants/activity-durations.ts` | Typical visit durations per category |
| Type definitions | `types/time-slots.ts` | FreeTimeSlot, SlotMatch, DaySlotAnalysis, etc. |

### Layout

```
LoopHeader (blur, absolute)
DateFilterBar (always visible, below header spacer)
FeedFiltersBar (collapsible, revealed on pull-down)
DateContextBanner (conditional, when non-today selected)
Recommendation Cards (enriched with time context)
```

### Card Enhancement

When date-filtered, each card shows:
- **Suggested Time Row**: "Sat 2:30 PM - 4:00 PM" with confidence dot
- **Travel Context**: "8 min from Surf Lessons"
- **Time Context Chip**: "After Surf Lessons — 2.5 hrs before Dinner"

### Add to Loop Pre-population

When user taps "Add to Loop" on a date-filtered card:
- Date, time, duration all pre-filled from the smart slot
- Context banner: "Fits between Surf Lessons and Dinner"
- One-tap confirm (2 taps total: card → confirm)

### Smart Slot Algorithm

1. Fetch calendar events for target date
2. Merge overlapping events into busy blocks
3. Find free gaps >= 45 minutes
4. For each gap, compute travel buffers from surrounding events
5. Match activities to best-fit slots (scoring: timing + duration + travel + opening hours)
6. Generate human-readable context labels

### Tier Gating

- Free: Date pills (7 days), smart slots (within INSIGHTS_LIMIT)
- Plus: Calendar picker (90 days), date range, travel detection, unlimited context

---

## FEATURE 2: Moments / Social Sharing (pending agent research)

### Core Flow
1. User completes activity, gives thumbs up feedback
2. "Share to Loop" option appears in feedback modal
3. Creates a "Moment" visible to friends
4. Friends see in feed, can like/comment, tap to view place
5. Moment also creates a review on the place (dual storage)

### Integration Points
- Feedback modal: Add "Share" step after rating
- Friends tab: "Moments" section at top
- Activity cards: "Nick recommends" social proof badge
- Recommendation engine: Friends' moments boost place scores

---

## FEATURE 3: Mini Loop SVG (pending agent research)

### Concept
- 60x60px SVG path preview on calendar day header
- Shows dots (activity locations) connected by lines (route)
- Normalizes lat/lng into tiny viewport
- Tap to open full Loop Map view
- Uses react-native-svg (bundled with Expo)

---

## Implementation Priority

### Phase 1: Date Filtering + Smart Slots (3-4 days)
1. Create types and duration estimates
2. Build DateFilterBar component
3. Build time-slot-engine.ts
4. Wire into index.tsx and recommendation engine
5. Enhance activity cards with dateContext
6. Update SchedulePlanModal for pre-population
7. Write tests

### Phase 2: Social Moments MVP (3-4 days)
1. Moments data model + Supabase table
2. Share flow in feedback modal
3. Moments feed on Friends tab
4. "Friends visited" badge on cards
5. Write tests

### Phase 3: Mini Loop SVG + Polish (2 days)
1. MiniLoopPreview component
2. Calendar header integration
3. Tap-to-expand to full map
4. Polish transitions and animations
