# Google Maps Platform Billing Response

**Case:** 67530213
**Status:** Ready to send — reply to Laura's email thread

---

## Email to Copy-Paste

Hi Laura,

Thank you for looking into this — I really appreciate the thorough investigation. Here are the answers to your questions:

---

**1. What is the project used for?**

Loop is a mobile app I'm building as a solo developer — it's a local activity discovery app that helps users find nearby restaurants, entertainment, fitness spots, etc. The app uses the Places API (New) to search for nearby places, fetch place details, and display place photos. The app has not launched yet and has no users — all usage during this period was from my own development and testing.

**How were API keys used which incurred the excessive usage?**

The app has a feed that displays nearby places using the Places API. During development, each time I refreshed or reloaded the app to test changes, it made fresh API calls (Nearby Search, Place Details, and Place Photos) for the same set of places in Dallas, TX — my development location. I didn't have response caching implemented at that point, so every reload made redundant calls instead of serving previously fetched results. This is what caused the ~97% duplicate requests you identified — they were all from my own device running the same queries repeatedly.

**What went wrong?**

As a first-time Google Maps Platform user, I assumed my usage was covered under the $200/month free credit and didn't realize I needed to set up budget alerts or per-API quota limits to be notified when I exceeded it. I wasn't aware how quickly Places API calls accumulate, especially Place Photos which are billed per request.

**How were you able to identify the issue?**

I noticed unexpected charges on my payment method and investigated the Google Cloud billing console, where I saw Places API (New) charges had exceeded the monthly free credit significantly.

**What did you do to solve the problem and prevent it in the future?**

I've taken the following steps:
- Set per-API daily quota limits, including reducing Place Photos to 32 requests/day per your team's recommendation
- Set up billing budget alerts at multiple thresholds so I'm notified before charges accumulate
- Implemented response caching so duplicate requests are served from cache instead of making fresh API calls
- During development, I now use locally stored test data instead of live API calls

**What are the start and end dates of the unexpected usage?**

Approximately November 2025 through January 2026.

---

**2. Terms of Service confirmation**

Yes, I confirm that my use case is within the bounds of the Google Maps Platform Terms of Service. The app displays Google Places data (search results, place details, photos) to users within the mobile app with proper Google attribution.

---

Thank you for your assistance with this. I appreciate the team's willingness to review this as a one-time billing adjustment.

Best regards,
Nick Casey

---

## Pre-Send Checklist

- [ ] Verify date range in Google Cloud billing console (Nov 2025 - Jan 2026 = ~$405)
- [ ] Confirm Place Photos quota is set to 32/day (Laura can check this)
- [ ] Confirm billing budget alerts are configured (they can verify)
- [ ] Reply to the SAME email thread (don't open a new case)
- [ ] Don't add more detail — this is the right length
