# Secrets Rotation Guide

Quick reference for rotating all API keys and credentials used by Loop.

---

## Keys That Need Rotation

| Key | Where to rotate | Side |
|-----|----------------|-------|
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Settings → API | Client-safe (RLS enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Settings → API | **Server only — never in app binary** |
| `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` | Google Cloud Console → APIs & Services → Credentials | Client-safe (restrict by HTTP referrer/app) |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Cloud Console → APIs & Services → Credentials | Client-safe (restrict by app bundle ID) |
| `EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID` | Google Cloud Console → APIs & Services → OAuth 2.0 Client IDs | Client-safe (public by design) |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google Cloud Console → APIs & Services → OAuth 2.0 Client IDs | **Server only — never in app binary** |
| `EXPO_PUBLIC_TICKETMASTER_API_KEY` | developer.ticketmaster.com → My Apps | Client-safe (rate-limited by key) |
| `EXPO_PUBLIC_EVENTBRITE_API_KEY` | eventbrite.com/platform/api-keys | Client-safe (rate-limited by key) |

---

## Client-safe vs. Needs Backend Proxy

### OK to ship in the app binary (`EXPO_PUBLIC_*`)

`EXPO_PUBLIC_*` variables are **baked into the app bundle at build time**. Anyone who
downloads the app can extract them. That is expected — these keys are designed to be
public when combined with proper restrictions:

- **Supabase anon key** — Row-Level Security (RLS) ensures users can only read/write
  their own data. The anon key alone cannot access other users' data.
- **Google Places / Maps API keys** — Restrict in Google Cloud Console:
  - iOS: restrict to bundle ID `com.ncasey92.LoopApp`
  - Android: restrict to package `com.ncasey92.loopapp` + SHA-1 fingerprint
  - (This means the key is useless outside the app even if extracted.)
- **Ticketmaster / Eventbrite keys** — Rate-limited per key. Low risk for read-only
  event discovery. Rotate if abuse is detected.
- **Google OAuth Client ID** — Public by design; the OAuth flow is safe without the secret.

### Must NEVER be in the app binary (no `EXPO_PUBLIC_` prefix)

These keys have elevated privileges. Exposing them gives an attacker full access:

- **`SUPABASE_SERVICE_ROLE_KEY`** — Bypasses all RLS. Only use in server-side scripts
  (seed scripts, migrations, admin functions). Store in EAS as a non-public secret.
- **`GOOGLE_OAUTH_CLIENT_SECRET`** — Used server-side to exchange auth codes for tokens.
  If exposed, attackers can impersonate your OAuth application.
- Any future **Stripe secret key** (`sk_live_...`) — Full account access; server only.
- Any future **OpenAI API key** — Metered billing; proxy through your backend to control
  spend and prevent abuse.

---

## Step-by-Step Rotation Process

Follow these steps every time you rotate a key.

### 1. Generate the new key

Go to the service's dashboard (links in the table above) and create a new key/credential.
Do **not** delete the old key yet.

### 2. Update EAS Secrets (for CI/CD builds)

EAS Secrets are injected at build time and override local `.env` values in production builds.

```bash
# Create or overwrite a secret in EAS
eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "new_value_here" --force

# List all current EAS secrets to confirm
eas secret:list
```

Repeat for every key you are rotating. Use the exact variable name from the table above.

For server-only keys (no `EXPO_PUBLIC_` prefix), set them as EAS secrets too — they will
be available to EAS Build scripts and server-side functions but will NOT be embedded in
the app binary.

### 3. Update local `.env.local` for development

Open `.env.local` and replace the old value with the new key. This file is gitignored
and is your local development override.

```
EXPO_PUBLIC_SUPABASE_ANON_KEY=new_value_here
```

### 4. Test the app

Run the app locally and smoke-test the affected feature:

```bash
npx expo start
```

For a production-equivalent test, trigger a preview build:

```bash
eas build --profile preview --platform ios
```

### 5. Revoke the old key

Once the new key is confirmed working, go back to the service dashboard and revoke/delete
the old key.

---

## EAS Secrets Reference

### Setting secrets

```bash
# Single secret
eas secret:create --name KEY_NAME --value "value" --force

# Bulk: pipe from a file (useful for initial setup)
# Note: EAS has no bulk import command — set each key individually
```

### Viewing secrets

```bash
eas secret:list
```

Values are never shown after creation — you can only see names. If you lose a key, rotate it.

### Deleting secrets

```bash
eas secret:delete --name KEY_NAME
```

### Which profile gets which secrets

EAS Secrets are scoped to the **project** by default and apply to all build profiles
(development, preview, production). If you need profile-specific values (e.g. a staging
Supabase project), use environment-specific secret names:

```
EXPO_PUBLIC_SUPABASE_URL_STAGING
EXPO_PUBLIC_SUPABASE_URL_PRODUCTION
```

Then reference them conditionally in `app.config.ts` using `process.env.EAS_BUILD_PROFILE`.

---

## Rotation Schedule Recommendation

| Frequency | Keys |
|-----------|------|
| Immediately on suspected compromise | All keys |
| Every 6 months | `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_OAUTH_CLIENT_SECRET` |
| Annually or on team member departure | All keys |
| On Google Cloud billing alert | `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`, `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` |

---

## Adding Future Keys

When you add a new third-party integration:

1. Determine whether it is client-safe or server-only (see rules above).
2. If client-safe: prefix with `EXPO_PUBLIC_`, add to `.env.local`, add to `.env.example`
   with a placeholder, and register in EAS Secrets.
3. If server-only: no `EXPO_PUBLIC_` prefix, **do not** add to `.env` or `.env.local`
   (use `.env.local` only in a server directory that is gitignored), register only in EAS
   Secrets and your server's environment manager.
4. Add a row to the table at the top of this file.
