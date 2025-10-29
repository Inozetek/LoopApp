# Loop App - Product Roadmap

**Last Updated:** October 26, 2025
**Current Status:** MVP Development Phase (Day 3-5)
**Target MVP Launch:** 7 days from now

---

## 🎯 MISSION

Eliminate the time users waste searching for things to do and remove the complexity of coordinating with friends through AI-powered, context-aware activity recommendations.

---

## 📊 CURRENT STATUS

### ✅ Completed (Days 1-5)

**Foundation & Core Infrastructure:**
- [x] Expo React Native project initialized (SDK 54, Router 6)
- [x] Supabase project configured with authentication
- [x] Google Places API service built (`services/googlePlaces.ts`)
- [x] AI recommendation scoring algorithm implemented (`services/recommendations.ts`)
- [x] Recommendation feed UI connected to real data (`app/(tabs)/index.tsx`)
- [x] Error handling and null safety checks added
- [x] Brand design system (Loop logo, gradient icon, theme colors)

**External Integrations:**
- [x] Google Places API integration (nearby search, place details, photos)
- [x] Facebook OAuth with interest extraction (code complete, pending app approval)

**Current Testing:**
- ⏳ Google Places API key restriction (user completing now)
- ⏳ Real nearby recommendations display (pending API key fix)

### 🚧 In Progress (Day 5-7)

**Priority A: Calendar Screen & Loop Visualization**
- [ ] Full month calendar view with color-coded tasks
- [ ] Manual task creation with location selection
- [ ] Loop View: Map showing day's tasks with route polyline
- [ ] Integration with recommendation feed ("Add to Calendar")
- [ ] Swipe left navigation from Feed → Calendar

**Priority B: Friends Screen & Basic Group Planning**
- [ ] Friends list with profile pics and Loop Scores
- [ ] Friend search by email/phone
- [ ] Friend request system (send, accept, decline)
- [ ] Basic group planning flow
- [ ] PostGIS midpoint calculation for group activities
- [ ] Swipe right navigation from Feed → Friends

### ⏳ Upcoming (Day 8-10)

**Polish & Launch Prep:**
- [ ] Loading states (skeleton screens)
- [ ] Empty states with helpful messages
- [ ] Error handling UI
- [ ] Onboarding flow
- [ ] Location permission request flow
- [ ] Deploy backend to Render
- [ ] Create Expo development build
- [ ] End-to-end testing

---

## 📅 10-DAY MVP SPRINT PLAN

### Day 1-2: Foundation ✅ COMPLETE
- [x] Supabase setup with PostGIS
- [x] Database schema design
- [x] Expo project initialization
- [x] Authentication (email, Google OAuth)
- [x] Folder structure and TypeScript configuration

### Day 3-5: Recommendation Feed ✅ COMPLETE
- [x] Google Places API integration
- [x] Recommendation scoring algorithm
- [x] Feed UI with activity cards
- [x] "Add to Calendar" functionality (ready for calendar screen)
- [x] Pull-to-refresh and infinite scroll
- [x] Error handling and fallbacks

### Day 6-7: Calendar Screen 🔄 CURRENT
**Start:** Now
**Duration:** 2 days
**Goal:** Full calendar with Loop visualization

**Tasks:**
1. Install `react-native-calendars` package
2. Build calendar view component
3. Create manual task form with location picker
4. Integrate React Native Maps for Loop visualization
5. Connect "Add to Calendar" from recommendation feed
6. Implement swipe navigation (Feed ↔ Calendar)

**Deliverables:**
- Users can view monthly calendar
- Users can create tasks with required location
- Users can see their daily "Loop" on a map
- Recommendations can be added to calendar

### Day 8-9: Friends Screen 🔜 NEXT
**Start:** After Day 7
**Duration:** 2 days
**Goal:** Friend system with group planning

**Tasks:**
1. Build friends list UI
2. Create friend search functionality
3. Implement friend request system
4. Build group planning modal
5. PostGIS midpoint calculation
6. Group activity suggestions algorithm
7. Implement swipe navigation (Feed ↔ Friends)

**Deliverables:**
- Users can add/remove friends
- Users can create group plans
- Algorithm suggests optimal meeting locations
- Swipe navigation works across all 3 screens

### Day 10: Polish & Demo Prep 🎬 FINAL
**Start:** After Day 9
**Duration:** 1 day
**Goal:** Launch-ready MVP

**Tasks:**
1. Bug fixes from testing
2. Add loading/empty/error states
3. UI polish and animations
4. Deploy backend to Render
5. Create Expo build for testing
6. Record demo video
7. Prepare presentation deck

**Deliverables:**
- Polished, bug-free app
- Deployed backend
- Demo materials ready
- Ready to show mentor

---

## 🚀 POST-MVP ROADMAP (Month 1-3)

### Phase 1A: Launch Features (Week 1-2)
**Focus:** Essential features missing from 10-day sprint

**User Onboarding:**
- [ ] Welcome screens with app explanation
- [ ] Interest selection (10-15 categories)
- [ ] Home/work address input
- [ ] Calendar sync (Google/Apple)
- [ ] Location permission request with clear explanation

**Feedback System:**
- [ ] Post-activity feedback prompt (thumbs up/down)
- [ ] Feedback tags (too expensive, too far, boring, etc.)
- [ ] Feedback history view

**Profile & Settings:**
- [ ] User profile screen
- [ ] Edit interests/preferences
- [ ] Notification settings
- [ ] Privacy controls
- [ ] Max distance slider

**Estimated Time:** 10-12 days
**Priority:** High - Required for usable product

### Phase 1B: Algorithm Improvements (Week 3-4)
**Focus:** Make recommendations smarter

**Collaborative Filtering:**
- [ ] Implement basic collaborative filtering (Scikit-learn NMF)
- [ ] "Users like you also liked..." scoring component
- [ ] Weekly model retraining batch job

**Context Awareness:**
- [ ] Weather API integration (OpenWeather)
- [ ] Weather-based activity filtering
- [ ] Time-of-day preference learning
- [ ] Price sensitivity detection from feedback

**OpenAI Integration:**
- [ ] Replace template explanations with GPT-4 Turbo
- [ ] Personalized recommendation reasons
- [ ] Cost optimization ($0.03/1K tokens)

**Estimated Time:** 8-10 days
**Priority:** High - Directly impacts recommendation quality

### Phase 1C: Business Features (Week 3-4, Parallel)
**Focus:** Enable revenue from day 1

**Business Dashboard (Premium tier only):**
- [ ] Business sign-up flow
- [ ] Stripe integration for subscriptions
- [ ] Analytics dashboard (impressions, clicks, conversions)
- [ ] Business profile editing
- [ ] Photo upload for activities

**Business Analytics Tracking:**
- [ ] Log recommendation impressions
- [ ] Log click-through events
- [ ] Log conversions (thumbs up after visit)
- [ ] Weekly email reports to businesses

**Estimated Time:** 10-12 days
**Priority:** High - Required for monetization

### Phase 1D: Polish & Testing (Week 5-6)
**Focus:** Launch-ready product

**Testing:**
- [ ] Unit tests for critical algorithms
- [ ] Integration tests for API endpoints
- [ ] E2E tests for key user flows
- [ ] Beta testing with 10-20 users

**Performance:**
- [ ] API response time optimization (<200ms)
- [ ] Image loading optimization
- [ ] Reduce battery drain
- [ ] Offline mode for viewing recommendations

**Launch Prep:**
- [ ] App Store listing (screenshots, description)
- [ ] Google Play Store listing
- [ ] Landing page (loopapp.com)
- [ ] Support documentation
- [ ] Privacy policy & terms of service

**Estimated Time:** 10-12 days
**Priority:** High - Required before public launch

---

## 🎯 PHASE 2: GROWTH & ENGAGEMENT (Month 4-6)

### Phase 2A: Smart Scheduling (Intelligent Schedule Recognition)

**Vision:** Learn user's routine schedule through background location tracking, auto-populate calendar without manual entry.

**Phased Approach:**

**Phase 2A.1: Commute Learning (Weeks 13-15)**
- [ ] Background location tracking (iOS Significant Location Change API)
- [ ] Identify work location (most common weekday 9-5 location)
- [ ] Build commute route polyline (home → work)
- [ ] On-route activity suggestions during commute times
- [ ] Battery optimization (<5% increase in drain)

**Success Metrics:**
- 40%+ of users enable commute tracking
- 70%+ of users keep it enabled after 30 days
- <5% battery drain increase

**Estimated Time:** 2-3 weeks
**Priority:** Medium-High - Strong competitive differentiator

**Phase 2A.2: Full Schedule Recognition (Weeks 16-22)**
- [ ] Extended background location tracking (7am-11pm)
- [ ] DBSCAN clustering for place recognition
- [ ] Visit pattern analysis (day of week, time, duration)
- [ ] User confirmation flow for recognized places
- [ ] Auto-generate recurring calendar events
- [ ] On-device processing option for privacy

**Success Metrics:**
- 50%+ of users enable Smart Scheduling
- 90%+ place recognition accuracy
- 85%+ of auto-generated events kept by users
- 25%+ increase in recommendation acceptance rate

**Estimated Time:** 6-8 weeks
**Priority:** Medium - Complex but high impact

### Phase 2B: Social & Gamification (Weeks 13-18)

**Loop Score System:**
- [ ] Scoring algorithm (complete tasks, accept suggestions, feedback)
- [ ] Badge system (Early Bird, Social Butterfly, Explorer)
- [ ] Weekly leaderboard among friends
- [ ] Streak tracking
- [ ] Milestone celebrations

**Friend Features:**
- [ ] View friend's daily Loop (with permission)
- [ ] Friend groups (custom lists)
- [ ] Activity history sharing
- [ ] "Challenge a friend" feature

**Estimated Time:** 4-6 weeks
**Priority:** Medium - Drives retention and viral growth

### Phase 2C: Advanced Group Planning (Weeks 16-20)

**User-Prompted Planning:**
- [ ] "Plan an activity" flow with custom tags
- [ ] Multi-constraint filtering (budget, time, location, tags)
- [ ] Optimal time finding (overlapping free time)
- [ ] Group chat messaging
- [ ] RSVP system
- [ ] Activity voting

**Group Context Awareness:**
- [ ] "Dog-friendly" activities for dog owners
- [ ] "Kid-friendly" for families
- [ ] Accessibility options
- [ ] Dietary restrictions for dining

**Estimated Time:** 3-5 weeks
**Priority:** Medium - Enhances group planning MVP

### Phase 2D: Calendar Enhancements (Weeks 18-22)

**External Calendar Sync:**
- [ ] Google Calendar OAuth
- [ ] Apple Calendar integration
- [ ] Two-way sync (Loop ↔ External)
- [ ] Import events with location data
- [ ] Conflict detection

**Smart Free Time Detection:**
- [ ] Parse calendar for busy/free blocks
- [ ] Identify gaps ≥1 hour
- [ ] Consider commute time buffers
- [ ] Proactive suggestions for free time

**Departure Alerts:**
- [ ] Google Maps Traffic API integration
- [ ] Real-time traffic calculation
- [ ] "Leave now" push notifications
- [ ] Route preview with alternates

**Estimated Time:** 4-5 weeks
**Priority:** Medium - Improves core functionality

---

## 🚀 PHASE 3: SCALE & ADVANCED FEATURES (Month 7-12)

### Phase 3A: Multi-Day Itinerary Planning (Weeks 24-28)

**Travel Mode:**
- [ ] "Traveling to [city]" input flow
- [ ] Multi-day itinerary generation
- [ ] Day-by-day scheduling with optimal routing
- [ ] Advance booking links (tickets, reservations)
- [ ] Budget tracking for entire trip
- [ ] Calendar integration for travel plans

**Monetization:**
- [ ] Affiliate commissions (OpenTable, Fandango, Eventbrite)
- [ ] Hotels.com / Airbnb partnerships
- [ ] Revenue: $8K-10K/month estimated at 10K users

**Estimated Time:** 4-5 weeks
**Priority:** Low-Medium - Premium feature, high revenue potential

### Phase 3B: Interest-Based Discovery (Weeks 28-32)

**RSS-Style Feed:**
- [ ] Custom interest tags (e.g., "Taylor Swift", "startup events")
- [ ] Event aggregation (Eventbrite, local news, social media)
- [ ] Push notifications for matching events
- [ ] "My Feed" separate tab

**Friend Discovery:**
- [ ] Interest-based matching (60%+ overlap)
- [ ] "Users near you" suggestions
- [ ] Group activity recommendations
- [ ] Opt-in only, privacy controls

**Estimated Time:** 3-4 weeks
**Priority:** Low - Nice-to-have, not critical

### Phase 3C: Advanced Business Features (Weeks 30-34)

**Premium Analytics Dashboard:**
- [ ] Conversion funnel visualization
- [ ] Customer lifetime value tracking
- [ ] Repeat visit rate
- [ ] Competitive analysis
- [ ] Day/time heatmaps
- [ ] Demographic breakdowns
- [ ] CSV export
- [ ] CRM integration API

**Business Optimization Tools:**
- [ ] Sponsored post creator
- [ ] A/B test different photos/descriptions
- [ ] Audience targeting controls
- [ ] Budget management

**Estimated Time:** 3-5 weeks
**Priority:** Low-Medium - Increases business retention and ARPU

### Phase 3D: Wearables & Voice (Weeks 32-36)

**Apple Watch App:**
- [ ] Today's Loop quick glance
- [ ] Swipe through recommendations
- [ ] Add to calendar via Siri
- [ ] Departure alerts (haptic)
- [ ] Location-aware suggestions

**Voice Assistant:**
- [ ] "Hey Loop, what should I do tonight?"
- [ ] Natural language queries
- [ ] Siri Shortcuts integration
- [ ] Google Assistant integration

**Estimated Time:** 3-4 weeks
**Priority:** Low - Convenience feature, not essential

---

## 💰 MONETIZATION MILESTONES

### Month 1-3: Launch & Validation
**Target:** Prove product-market fit

**User Metrics:**
- 1,000 active users
- 25% recommendation acceptance rate
- 70% satisfaction rate (thumbs up)
- 5% conversion to Loop Plus ($4.99/mo)

**Business Metrics:**
- 10 businesses signed up
- $490/month business revenue (10 × $49/mo Boosted tier)
- $50/month user subscription revenue

**Total MRR:** ~$540/month

### Month 4-6: Growth
**Target:** Viral adoption, multi-city expansion

**User Metrics:**
- 10,000 active users
- 30% recommendation acceptance rate
- 8-12% conversion to paid tiers

**Business Metrics:**
- 50 businesses across multiple cities
- $2,450-4,950/month business revenue
- $5,000-10,000/month user subscriptions
- $2,000-5,000/month affiliate commissions

**Total MRR:** ~$10,000-20,000/month

### Month 7-12: Scale
**Target:** Profitability and acquisition readiness

**User Metrics:**
- 50,000 active users
- 35% recommendation acceptance rate
- 10-15% paid conversion rate

**Business Metrics:**
- 200+ businesses
- $17,800/month business subscriptions
- $25,000-40,000/month user subscriptions
- $10,000-15,000/month affiliate commissions

**Total MRR:** ~$50,000-70,000/month
**Annual Revenue:** $600K-840K/year
**Net Profit:** ~$400K-600K/year (after costs)

---

## 📊 KEY METRICS & TARGETS

### User Engagement (North Star Metrics)

**Daily/Weekly/Monthly Active Users:**
- Month 1: 500 DAU / 800 WAU / 1,000 MAU
- Month 3: 3,000 DAU / 5,000 WAU / 10,000 MAU
- Month 12: 20,000 DAU / 30,000 WAU / 50,000 MAU

**Recommendation Acceptance Rate:**
- MVP: 20-25% (good)
- Month 6: 30-35% (great)
- Month 12: 35-40% (excellent)

**User Satisfaction (Thumbs Up Rate):**
- MVP: 65-70% (acceptable)
- Month 6: 70-75% (good)
- Month 12: 75-80% (excellent)

**Retention:**
- Day 1 → Day 7: 60%+ (MVP target)
- Day 7 → Day 30: 40%+ (MVP target)
- Month 1 → Month 3: 50%+ (growth target)

### Business Health

**Customer Acquisition Cost (CAC):**
- MVP: $0 (organic only)
- Growth: <$3/user (paid ads)
- Scale: <$5/user (multi-channel)

**Lifetime Value (LTV):**
- Free user: $5-10 (ad revenue over 12 months)
- Plus user: $40-60 (8-12 months × $4.99/mo)
- Premium user: $80-120 (8-12 months × $9.99/mo)

**LTV:CAC Ratio:**
- Target: >3:1 (healthy)
- Goal: >5:1 (excellent)

**Paid Conversion Rate:**
- Month 1: 5% (free → paid)
- Month 6: 10% (free → paid)
- Month 12: 12-15% (free → paid)

### Algorithm Performance

**Recommendation Quality:**
- Response time: <200ms (target)
- Accuracy: 70%+ match user interests (target)
- Diversity: 3+ categories in top 5 (rule)

**Sponsored Activity Performance:**
- Acceptance rate: 15-20% (vs 25-35% organic)
- Satisfaction rate: 70%+ (must match organic)
- Business ROI: 5-10x (critical for retention)

---

## 🛠 TECHNICAL DEBT & INFRASTRUCTURE

### High Priority (Month 1-3)

**Database Optimization:**
- [ ] Create all indexes per schema in CLAUDE.md
- [ ] PostGIS query optimization for location searches
- [ ] Implement Redis caching for recommendations (60 min TTL)

**API Performance:**
- [ ] Implement rate limiting (100 requests/min per user)
- [ ] Add request/response compression (gzip)
- [ ] Set up CDN for images (Cloudflare)

**Monitoring & Observability:**
- [ ] Sentry for error tracking
- [ ] PostHog for analytics
- [ ] Backend logging (Winston or Pino)
- [ ] Alert system for critical failures

**Security:**
- [ ] JWT token refresh strategy
- [ ] Row-level security (RLS) in Supabase
- [ ] Input validation on all endpoints
- [ ] Rate limiting per IP

### Medium Priority (Month 4-6)

**Testing:**
- [ ] Unit tests (80%+ coverage)
- [ ] Integration tests for API
- [ ] E2E tests for critical flows (Detox)
- [ ] CI/CD pipeline (GitHub Actions)

**Scalability:**
- [ ] Horizontal scaling for backend (load balancer)
- [ ] Database read replicas for analytics queries
- [ ] Separate ML service (Python FastAPI microservice)
- [ ] Message queue for background jobs (Redis/Bull)

**DevOps:**
- [ ] Staging environment
- [ ] Blue-green deployment
- [ ] Database backup automation
- [ ] Disaster recovery plan

### Low Priority (Month 7-12)

**Advanced Infrastructure:**
- [ ] Multi-region deployment
- [ ] Database sharding by geographic region
- [ ] Real-time recommendation updates (WebSocket)
- [ ] GraphQL API (optional, for advanced clients)

**Advanced Monitoring:**
- [ ] Custom dashboards (Grafana)
- [ ] Performance profiling
- [ ] Cost optimization analysis
- [ ] A/B testing framework

---

## 🎓 LEARNING & VALIDATION

### MVP Validation Questions
*Must answer before scaling*

**Product-Market Fit:**
- [ ] Do users accept 25%+ of recommendations?
- [ ] Do users return 3+ days/week?
- [ ] Do users recommend Loop to friends?
- [ ] Would users be disappointed if Loop disappeared?

**Algorithm Effectiveness:**
- [ ] Does satisfaction improve after 30 days of feedback?
- [ ] Do sponsored activities perform reasonably (15-20% acceptance)?
- [ ] Are users discovering new places they love?

**Business Model:**
- [ ] Do businesses see 5x+ ROI?
- [ ] Do businesses renew after free trial?
- [ ] Do users convert to paid tiers (5-10%)?

### User Research (Ongoing)

**Week 2:** First 50 users
- Interview 10 users about initial experience
- Ask: What's confusing? What's delightful? What's missing?

**Week 6:** 500 users
- Survey: NPS score, feature requests
- Analytics: Drop-off points in funnel

**Week 12:** 2,000 users
- Cohort analysis: Which acquisition channels retain best?
- Feature usage: Which features drive retention?

**Month 6:** 10,000 users
- Business interviews: Is ROI real? What do they need?
- Power user interviews: What makes Loop essential?

---

## 📝 OPEN QUESTIONS & DECISIONS NEEDED

### Business Model
- [ ] **Decision:** Should we offer a "Freemium" tier with ads, or just free/Plus/Premium?
- [ ] **Decision:** Should businesses pay per impression, per click, or flat subscription?
- [ ] **Research:** What's the right price point for Plus ($4.99 vs $2.99 vs $7.99)?

### Product Features
- [ ] **Decision:** Should we support group sizes >5 people in MVP? (Or cap at 5)
- [ ] **Decision:** Should we show user profile pictures in friends list? (Privacy concern)
- [ ] **Research:** Do users want a "Surprise me" button for random suggestions?

### Algorithm Design
- [ ] **Decision:** How much weight should "distance" have vs "interest match"?
- [ ] **Decision:** Should we show sponsored activities if they score <40 base points?
- [ ] **Experiment:** Does showing AI explanation increase acceptance rate?

### Technical Architecture
- [ ] **Decision:** Should we use Expo EAS (paid) or build locally? (Cost vs convenience)
- [ ] **Decision:** Python microservice for ML or keep it in Node.js backend?
- [ ] **Decision:** Redis hosting: Upstash (serverless) or Redis Cloud (dedicated)?

---

## 🚀 LAUNCH PLAN

### Pre-Launch (Days 1-10)
- [x] Build MVP (10-day sprint)
- [ ] Internal testing (mentor, friends, family)
- [ ] Fix critical bugs
- [ ] Create demo materials

### Soft Launch (Week 1-2, 100 users)
- [ ] Launch in Dallas/Austin only
- [ ] Invite-only beta (Google Form waitlist)
- [ ] Onboard 10 businesses manually
- [ ] Daily monitoring of metrics
- [ ] Iterate based on feedback

### Public Launch (Week 3-4, 1,000 users)
- [ ] Product Hunt launch
- [ ] Post in local subreddits (r/Dallas, r/Austin)
- [ ] Campus outreach (UT Austin, SMU)
- [ ] Local Facebook groups
- [ ] Press release to local media

### Growth Phase (Month 2-3, 5,000-10,000 users)
- [ ] Paid ads (Facebook/Instagram, $500-1,000/mo)
- [ ] Referral program ($5 credit for both parties)
- [ ] Content marketing (TikTok, Instagram, YouTube)
- [ ] Partnership with Eventbrite, Meetup

### Scale Phase (Month 4-12, 50,000 users)
- [ ] Multi-city expansion (SF, LA, NYC, Chicago, Miami)
- [ ] B2B partnerships (tourism boards, real estate developers)
- [ ] Advanced monetization (affiliates, data licensing)
- [ ] Series A fundraising or acquisition talks

---

## 🎯 SUCCESS CRITERIA

### MVP Success (Day 10)
- ✅ App works end-to-end (signup → recommendations → calendar → friends)
- ✅ Google Places API shows real nearby activities
- ✅ Recommendation scoring algorithm functions correctly
- ✅ No critical bugs or crashes
- ✅ Mentor approves prototype

### Phase 1 Success (Month 3)
- 🎯 1,000 active users
- 🎯 25% recommendation acceptance rate
- 🎯 70% user satisfaction (thumbs up)
- 🎯 60% Day 7 retention
- 🎯 10 paying businesses

### Phase 2 Success (Month 6)
- 🎯 10,000 active users
- 🎯 30% recommendation acceptance rate
- 🎯 50% Day 30 retention
- 🎯 K-factor >1.0 (viral growth)
- 🎯 $10K-20K MRR

### Phase 3 Success (Month 12)
- 🎯 50,000 active users
- 🎯 35% recommendation acceptance rate
- 🎯 $50K-70K MRR ($600K-840K ARR)
- 🎯 Profitable (30-40% net margin)
- 🎯 Acquisition offer or Series A term sheet

---

## 📞 SUPPORT & RESOURCES

### Documentation
- `CLAUDE.md` - Complete architecture and vision
- `ROADMAP.md` - This file
- `GOOGLE_PLACES_SETUP.md` - Google Places API setup
- `FACEBOOK_OAUTH_SETUP.md` - Facebook OAuth setup

### Key Links
- Supabase Dashboard: https://supabase.com/dashboard
- Google Cloud Console: https://console.cloud.google.com
- Expo Dashboard: https://expo.dev
- GitHub Repo: (To be created)

### Team & Communication
- **Developer:** Nick (you)
- **AI Assistant:** Claude Code
- **Mentor:** (Name TBD)
- **Communication:** Claude Code workspace

---

## 🔄 ROADMAP UPDATES

This roadmap is a living document. Update it:
- After completing major milestones
- When priorities shift based on user feedback
- When new opportunities arise (partnerships, features)
- Monthly to reflect actual vs planned progress

**Next Review:** After MVP launch (Day 10)

---

**Last Updated:** October 26, 2025
**Version:** 1.0.0
**Maintained By:** Nick (Product Owner) + Claude Code
