# Known Issues & Error Tracking

**Last Updated:** 2025-10-28
**Purpose:** Centralized tracking of recurring errors, their causes, and proven solutions

---

## 🔴 Critical Recurring Issues (Top Priority)

### 1. Expo Metro Bundler Connection Failures
**Frequency:** High (multiple occurrences)
**Status:** Documented solution exists
**Doc:** `EXPO_CONNECTION_FIX.md`

**Symptoms:**
- "Request Timed Out" when trying to connect Expo Go
- Metro bundler running but phone can't connect
- QR code scan fails

**Root Causes:**
1. NordVPN adapter interfering (even when VPN "disabled")
2. Windows Firewall blocking ports 8081, 19000-19006
3. Phone and computer on different WiFi networks
4. Port 8081 already in use

**Proven Solutions (in order of effectiveness):**
1. Disable NordLynx network adapter (`Win+R` → `ncpa.cpl` → Disable)
2. Use tunnel mode: `npx expo start --tunnel`
3. Temporarily disable Windows Firewall for testing
4. Add firewall exception for ports 8081, 19000-19006

**Prevention:**
- Always check NordLynx adapter status before starting dev server
- Use tunnel mode as default during development
- Document network configuration in README

---

### 2. Signup/Auth Issues
**Frequency:** Medium (occasional)
**Status:** Documented solution exists
**Doc:** `SIGNUP_TROUBLESHOOTING.md`

**Symptoms:**
- "Failed to create user profile" after signup
- User can sign up but can't log in
- Profile data not appearing after signup
- "Row violates row-level security policy" error

**Root Causes:**
1. Auth trigger not set up in Supabase (most common)
2. Email confirmation required but not configured
3. RLS policies too restrictive
4. Database schema not created properly

**Proven Solutions:**
1. Run auth trigger migration: `database/migrations/002_auth_trigger.sql`
2. Disable email confirmation in Supabase (testing only): Dashboard → Authentication → Providers → Email → Disable "Confirm email"
3. Verify RLS policies allow authenticated users to insert their own profile
4. Check both `auth.users` and `public.users` tables have matching records

**Prevention:**
- Include auth trigger check in onboarding docs
- Add pre-flight check script to verify Supabase setup
- Create test script to validate auth flow before development

---

### 3. Google Places API Migration Issues
**Frequency:** Low (resolved)
**Status:** Migration complete ✅
**Doc:** `GOOGLE_PLACES_API_NEW_MIGRATION.md`

**Symptoms:**
- "This API method has been disabled" errors
- Legacy API returning errors
- Places not showing up in recommendations

**Resolution:**
- Successfully migrated to Places API (New) on 2025-01-26
- All code updated to use new API format
- Cost savings: 47-50% reduction with field masks

**Prevention:**
- Never use legacy API URLs
- Always use field masks to stay in "Basic" pricing tier
- Monitor for API deprecation notices

---

## 🟡 Medium Priority Issues

### 4. TypeScript Compilation Errors
**Frequency:** Low (well-managed)
**Current Status:** 0 errors ✅

**Common Causes:**
- Supabase type mismatches
- Missing type definitions for external packages
- Incorrect type assertions

**Solutions:**
- Use `(supabase.from('table') as any)` pattern for complex queries
- Keep @types packages up to date
- Use TypeScript strict mode to catch errors early

**Tracking:**
- Check TypeScript status before every commit
- Document type workarounds in code comments

---

### 5. Location Permission Issues
**Frequency:** Low
**Status:** UI solution implemented

**Symptoms:**
- Users not granting location permission
- Location services disabled
- Recommendations using default location instead of real GPS

**Solutions:**
- Profile settings now includes location permission management
- Clear explanation of why location is needed
- One-tap enable with direct settings link

**Prevention:**
- Always check permission status before making location-dependent API calls
- Provide fallback behavior when location unavailable
- Show contextual prompts explaining value of location access

---

## 🟢 Minor Issues (Documented for Future Reference)

### 6. Cache/Hot Reload Issues
**Frequency:** Occasional
**Status:** Known workaround

**Symptoms:**
- Changes not appearing after save
- Old code still running
- Strange behavior after code changes

**Solutions:**
```bash
# Clear all caches
npx expo start --clear

# Or nuclear option
npm start -- --reset-cache
```

**Prevention:**
- Restart dev server after major changes
- Clear cache when switching branches
- Use `--clear` flag if behavior seems odd

---

### 7. Database Query Performance
**Frequency:** None yet (preemptive)
**Status:** Monitoring

**Potential Issues:**
- Slow recommendation queries with large dataset
- PostGIS queries not using indexes
- N+1 queries in friend relationships

**Prevention Measures:**
- All location columns use GIST indexes
- Queries use PostGIS spatial functions
- Monitor slow query log in Supabase

---

## 📋 Error Tracking Template

When documenting new errors, use this format:

```markdown
### [Error Number]. [Brief Description]
**Frequency:** High/Medium/Low/One-time
**Status:** Active/Investigating/Documented/Resolved
**First Occurrence:** [Date]
**Last Occurrence:** [Date]

**Symptoms:**
- [What the user sees/experiences]

**Root Cause:**
- [Technical reason for the error]

**Solution:**
1. [Step-by-step fix]

**Prevention:**
- [How to avoid in future]

**Related Files:**
- [List of affected files]

**Related Docs:**
- [Links to relevant documentation]
```

---

## 🔍 Current Investigation (Active Issues)

### None Currently ✅

*If you're experiencing a recurring error not listed above, add it here for tracking.*

---

## 📊 Error Statistics

**Total Documented Issues:** 7
**Critical/Recurring:** 3
**Medium Priority:** 2
**Minor/Resolved:** 2

**Most Common Error Category:** Network/Connection issues (Expo Metro)
**Most Recently Resolved:** Google Places API migration
**Zero Occurrence Categories:** Performance, Security, Data Loss

---

## 🛠️ Improvement Recommendations

### Immediate Actions:
1. **Add Pre-flight Checks** - Create script to verify:
   - Supabase connection
   - Auth trigger exists
   - Database schema complete
   - Environment variables set

2. **Automated Error Logging** - Implement:
   - Sentry integration for production error tracking
   - Console log categorization (error, warning, info)
   - Error analytics dashboard

3. **Development Checklist** - Before starting dev session:
   - [ ] NordLynx adapter disabled
   - [ ] Metro bundler ports free
   - [ ] Environment variables loaded
   - [ ] Supabase connection tested
   - [ ] TypeScript compilation passes

### Future Enhancements:
1. Create health check endpoint for API status
2. Add error boundary components in React Native
3. Implement retry logic with exponential backoff (✅ partially implemented)
4. Create user-facing error reporting tool
5. Build monitoring dashboard for error rates

---

## 📚 Related Documentation

- **Network Issues:** `EXPO_CONNECTION_FIX.md`
- **Auth Issues:** `SIGNUP_TROUBLESHOOTING.md`
- **API Migration:** `GOOGLE_PLACES_API_NEW_MIGRATION.md`
- **Testing Guide:** `TESTING_GUIDE.md`
- **Quick Start:** `QUICK_START.md`

---

## 🤔 Need to Report a New Error?

**Include these details:**
1. **What were you trying to do?**
2. **What did you expect to happen?**
3. **What actually happened?**
4. **Error message (exact text)**
5. **Steps to reproduce**
6. **Screenshot/console logs**
7. **Environment:** (OS, Node version, Expo version)

**Update this document** by adding the error using the template above.

---

**Note:** This is a living document. Update it whenever you discover new errors or find better solutions to existing ones.
