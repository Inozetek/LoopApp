# Google Places API - Cost Protection Guide

## ✅ Protection Layers Installed

Your app now has **3 layers of cost protection** to prevent surprise charges:

---

## 🛡️ Layer 1: Automatic Request Blocking

**How it works:**
- Tracks every API request in real-time
- Calculates costs automatically
- **Blocks requests at 95% of free tier** ($190 used of $200)
- Falls back to mock data if limit reached

**Location:** `utils/api-cost-tracker.ts` + `services/recommendations.ts`

---

## 📊 Layer 2: Visual Usage Banner

**How it works:**
- Shows API usage at top of recommendation feed
- Updates every 10 seconds
- Color-coded status:
  - 🟢 **Green** (0-49% used) - Safe
  - 🟠 **Orange** (50-79% used) - Warning
  - 🔴 **Red** (80-94% used) - Danger
- Auto-hides when collapsed

**Location:** `components/api-usage-banner.tsx`

---

## 🚨 Layer 3: Console Warnings

**How it works:**
- Logs usage summary before each API call
- Warnings appear in Expo console:
  - **50% used:** Yellow warning
  - **80% used:** Red danger alert
  - **95% used:** Request BLOCKED

**Example output:**
```
📊 === Google Places API Usage Summary ===
📅 Month: 2025-11
🔢 Total Requests: 150
💰 Total Cost: $2.55
📊 Free Tier Used: 1.3%
💵 Remaining Credit: $197.45
✅ Status: Safe
==========================================
```

---

## 💰 Cost Breakdown (Your Current Setup)

### **Google Places API (New) - Nearby Search**
- **Cost per request:** $0.017 (with your optimized field mask)
- **Free tier:** $200/month
- **Max requests before charges:** ~11,700 requests/month
- **Safe testing limit:** ~300 requests/month (keeps you at <5% usage)

### **Request Scenarios:**
| Activity | Requests | Cost | % of Free Tier |
|----------|----------|------|----------------|
| Open app once | 1 | $0.02 | 0.01% |
| 10 pull-to-refreshes | 10 | $0.17 | 0.09% |
| 100 refreshes | 100 | $1.70 | 0.85% |
| 500 refreshes | 500 | $8.50 | 4.25% |
| Daily testing (20/day × 30 days) | 600 | $10.20 | 5.10% |

---

## 🧪 Safe Testing Guidelines

### **For Personal Testing (Pre-Launch):**
- ✅ **Safe:** 10-20 requests per day (~300/month = $5.10)
- ⚠️ **Monitor:** 50+ requests per day
- 🚨 **Too much:** 100+ requests per day

### **Before Showing Mentor/Investors:**
- Test with mock data first (0 cost)
- Enable API only for final demo
- Disable API key after demo

### **During Beta Testing (10-50 users):**
- Monitor usage banner daily
- Set calendar reminder: Check usage every Friday
- Expected: 20-100 requests/day = $10-50/month

---

## 🔧 How to Enable/Disable API

### **Enable Real Google Places API:**
1. Open `.env` file
2. Uncomment line 18:
   ```bash
   EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=AIzaSyA5S_CE0OF_OnaWBG1efC73k7c47jgbaTI
   ```
3. Restart Expo: `Ctrl+C` then `npx expo start`
4. Usage banner will appear at top of feed

### **Disable API (Use Mock Data):**
1. Open `.env` file
2. Comment out line 18:
   ```bash
   # EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=AIzaSyA5S_CE0OF_OnaWBG1efC73k7c47jgbaTI
   ```
3. Restart Expo
4. App uses 25 mock activities (0 cost)

---

## 📱 What to Watch For

### **Console Warnings:**
- ✅ **Normal:** "✅ API request tracked: 5 requests, $0.09 used (0.0% of free tier)"
- ⚠️ **Warning:** "⚠️ WARNING: 50%+ of free tier used"
- 🚨 **Danger:** "⚠️ DANGER: 80%+ of free tier used!"
- 🛑 **Blocked:** "🚨 BLOCKED: 95% of free tier used! Blocking API request to prevent charges."

### **Usage Banner Colors:**
- 🟢 **Green badge:** Safe to continue testing
- 🟠 **Orange badge:** Monitor usage, consider mock data
- 🔴 **Red badge:** Stop testing with real API immediately

---

## 🔍 Manual Usage Check

### **View usage in console:**
```javascript
import { logAPIUsageSummary } from '@/utils/api-cost-tracker';
await logAPIUsageSummary();
```

### **Reset counter (for testing):**
```javascript
import { resetAPIUsageCounter } from '@/utils/api-cost-tracker';
await resetAPIUsageCounter();
```

---

## 🎯 Best Practices

1. **Default to Mock Data:** Keep API key commented out in `.env` unless actively testing
2. **Enable API for Demos:** Only uncomment for mentor meetings/investor pitches
3. **Monitor Weekly:** Check usage banner every Friday
4. **Set Calendar Reminder:** "Check Google Places API usage" - every Friday 5pm
5. **Screenshot Usage:** Take screenshots of usage banner for records
6. **Before Launch:** Set up Google Cloud billing alerts at $50, $100, $150

---

## 🚀 When to Upgrade (Post-Launch)

**You'll need to enable billing when:**
- You have 100+ active users
- Exceeding 10,000 requests/month
- Expected cost: $170+/month

**How to upgrade:**
1. Go to Google Cloud Console
2. Enable billing
3. Set budget alerts: $200, $400, $600
4. Implement caching (reduce costs by 50-70%)

---

## 📞 Emergency: Hit Limit Before Expected?

**If you see "🚨 BLOCKED" message:**
1. ✅ **Relax:** Your app auto-switched to mock data - no charges!
2. Check usage: `await logAPIUsageSummary()`
3. Review: What caused high usage? (App left running? Testing loop?)
4. Wait: Counter resets automatically on 1st of next month
5. Optional: Manually reset for testing: `await resetAPIUsageCounter()`

---

## 🧮 Monthly Cost Estimates (Post-Launch)

| User Count | Requests/Month | Cost/Month | Notes |
|------------|----------------|------------|-------|
| 10 users | 600 | $10 | Beta testing (free tier) |
| 100 users | 6,000 | $102 | Early adopters (free tier) |
| 1,000 users | 60,000 | $1,020 | Launch phase (paid) |
| 10,000 users | 600,000 | $10,200 | Scale phase (add caching!) |

**With caching (recommended at 1,000+ users):**
- Reduce costs by 60-80%
- 10,000 users → $2,000-4,000/month instead of $10,200

---

## ✅ Summary

You're **fully protected** from surprise costs!

- **Mock data by default** (0 cost)
- **Auto-blocking at 95%** (max $190 in any month)
- **Visual banner** (always know your usage)
- **Console warnings** (catch issues early)

**Safe to test!** Enable the API key when ready. 🚀
