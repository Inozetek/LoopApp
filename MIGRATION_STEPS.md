# 📋 Step-by-Step Migration Guide

## ⚠️ IMPORTANT: What Went Wrong

You ran the **wrong file**!

- ❌ You ran: `MIGRATION_CHECKLIST.md` (markdown documentation)
- ✅ You need: `database/migrations/*.sql` (actual SQL scripts)

---

## ✅ Correct Steps to Run Migrations

### Step 1: Run Initial Schema Migration

1. Open your **Supabase Dashboard**: https://supabase.com/dashboard
2. Click your project
3. Go to **SQL Editor** (left sidebar)
4. Click **"New query"** button
5. Open the file `database/migrations/001_initial_schema.sql` in VS Code
6. **Copy ALL the contents** (Ctrl+A, Ctrl+C)
7. **Paste** into Supabase SQL Editor
8. Click **"Run"** button (or press Ctrl+Enter)
9. Wait 5-10 seconds...
10. Should see: **"Success. No rows returned"** ✅

**If you get an error**, share the exact error message with me!

---

### Step 2: Run Auth Trigger Migration

1. In Supabase SQL Editor, click **"New query"** again
2. Open the file `database/migrations/002_auth_trigger.sql` in VS Code
3. **Copy ALL the contents**
4. **Paste** into Supabase SQL Editor
5. Click **"Run"**
6. Should see: **"Success. No rows returned"** ✅

**If you get an error**, share the exact error message!

---

### Step 3: Verify Setup (Health Check)

1. In Supabase SQL Editor, click **"New query"** again
2. Open the file `database/health-check.sql` in VS Code (I just created this for you!)
3. **Copy ALL the contents**
4. **Paste** into Supabase SQL Editor
5. Click **"Run"**
6. You should see this output:

```
component              | status
-----------------------|----------------
PostGIS Extension      | ✅ Installed
Users Table            | ✅ Exists
Auth Trigger           | ✅ Active
Activities Table       | ✅ Exists
Recommendations Table  | ✅ Exists
```

**If any show ❌ Missing**, that migration didn't run correctly. Let me know which one!

---

## 🐛 Common Errors & Fixes

### Error: "extension 'postgis' already exists"
**This is fine!** It means PostGIS was already installed. The migration will skip it and continue. ✅

### Error: "relation 'users' already exists"
**This is fine!** It means you already ran this migration before. You can skip it. ✅

### Error: "syntax error at or near '#'"
**This means** you copied a markdown file (`.md`) instead of a SQL file (`.sql`).
**Fix:** Make sure you're copying from `.sql` files only!

### Error: "permission denied for schema public"
**This means** your Supabase user doesn't have permissions.
**Fix:** Make sure you're logged into Supabase dashboard and using the SQL Editor (not a local SQL tool).

---

## 📁 File Reference

### What to Run (in order):
1. ✅ `database/migrations/001_initial_schema.sql` (720 lines)
2. ✅ `database/migrations/002_auth_trigger.sql` (38 lines)

### What NOT to Run:
- ❌ `MIGRATION_CHECKLIST.md` - This is documentation, not SQL!
- ❌ `CLAUDE.md` - This is documentation!
- ❌ Any `.md` file - These are markdown, not SQL!

### How to Verify:
- ✅ `database/health-check.sql` - Run this to check if migrations worked

---

## ✅ Checklist

Mark these off as you complete them:

- [ ] Step 1: Run `001_initial_schema.sql` in Supabase SQL Editor
- [ ] Step 2: Run `002_auth_trigger.sql` in Supabase SQL Editor
- [ ] Step 3: Run `health-check.sql` to verify
- [ ] All 5 components show ✅ Installed/Exists/Active
- [ ] No errors

---

## 🎉 When You're Done

Reply with: **"Migrations complete! All ✅"**

Then we can move on to fixing the TypeScript error and starting development!

---

## 🆘 If You Get Stuck

Share:
1. **Which step** you're on (1, 2, or 3)
2. **Exact error message** (copy/paste the whole error)
3. **Which file** you were trying to run

I'll help you fix it immediately!
