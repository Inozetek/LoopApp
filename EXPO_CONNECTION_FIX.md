# Expo Go Connection Troubleshooting

## Issue: Request Timed Out / Can't Connect to Metro Bundler

### Quick Diagnostic

**Your Network Info:**
- Computer WiFi: `192.168.1.126`
- NordLynx Adapter: `10.5.0.2` (ACTIVE - even though VPN "disabled")
- Phone: Must be on same WiFi network (`192.168.1.x`)

---

## Fix 1: Disable NordLynx Network Adapter (Most Likely Fix)

Even with NordVPN "off", the network adapter can interfere.

### Windows Steps:
1. Press `Win + R`
2. Type: `ncpa.cpl` and press Enter
3. Find "NordLynx" adapter
4. **Right-click → Disable**
5. Restart Metro bundler: `npm start`

---

## Fix 2: Use Tunnel Mode (Bypasses Network Issues)

```bash
# Stop current server (Ctrl+C in terminal)
npx expo start --tunnel
```

**What this does:**
- Creates secure tunnel through Expo servers
- Bypasses VPN/firewall/network issues
- Slower (~2-3 sec reload) but works everywhere

**Then in Expo Go:**
- Scan the new QR code
- It will use tunnel connection

---

## Fix 3: Manually Specify Connection Type

```bash
# Try LAN mode explicitly
npx expo start --lan

# Or if that fails, localhost
npx expo start --localhost
```

---

## Fix 4: Windows Firewall Rule

Metro bundler needs ports 8081 and 19000-19006 open.

### Add Firewall Rules:

**Option A - Quick (Disable temporarily for testing):**
1. Windows Security → Firewall & network protection
2. Click your active network (Private network)
3. Toggle OFF "Windows Defender Firewall"
4. Try connecting again
5. **Remember to turn back ON after testing**

**Option B - Proper (Add exception):**
```powershell
# Run PowerShell as Administrator, then:
New-NetFirewallRule -DisplayName "Expo Metro Bundler" -Direction Inbound -Protocol TCP -LocalPort 8081,19000,19001,19002,19003,19004,19005,19006 -Action Allow
```

---

## Fix 5: Verify Same Network

**Check phone WiFi:**
1. Phone Settings → WiFi
2. Tap connected network (i icon)
3. Check IP address: Should be `192.168.1.xxx`

**If phone shows different subnet (like 10.x.x.x or 172.x.x.x):**
- You're on different network
- Connect to same WiFi as computer

---

## Fix 6: Use Ethernet Cable (Temporary Test)

If you have USB cable:

```bash
# Connect phone via USB, then:
npx expo start --localhost

# Phone will connect via USB debugging
```

---

## Fix 7: Clear Expo Cache + Restart Everything

```bash
# 1. Stop Metro bundler (Ctrl+C)

# 2. Clear all caches
npx expo start --clear

# Or nuclear option:
npm start -- --reset-cache --clear

# 3. Close Expo Go app on phone (force quit)
# 4. Reopen Expo Go and scan QR
```

---

## Fix 8: Check if Port 8081 is Blocked

```bash
# Check what's using port 8081
netstat -ano | findstr :8081
```

If something else is using it:
```bash
# Kill the process (replace PID with actual number from above)
taskkill /PID [number] /F
```

---

## Fix 9: Manual Connection

If QR code won't work:

1. Start Metro: `npm start`
2. Note the URL shown (like `exp://192.168.1.126:8081`)
3. **On phone:**
   - Open Expo Go
   - Tap "Enter URL manually"
   - Type: `exp://192.168.1.126:8081`
   - Connect

---

## Fix 10: Use Development Build Instead of Expo Go

Expo Go has limitations. Try EAS development build:

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Create development build
eas build --profile development --platform android

# This creates a custom dev app without Expo Go limitations
```

---

## Recommended Troubleshooting Order:

### Try these in order:

**1. Disable NordLynx adapter** (most likely issue)
```
Win + R → ncpa.cpl → Disable NordLynx
```

**2. Use tunnel mode**
```bash
npx expo start --tunnel
```

**3. Check Windows Firewall**
```
Temporarily disable to test
```

**4. Verify same WiFi network**
```
Computer: 192.168.1.126
Phone: Should be 192.168.1.xxx
```

**5. Clear everything and restart**
```bash
npx expo start --clear
```

---

## Still Not Working? Nuclear Option

```bash
# 1. Stop all Node processes
taskkill /F /IM node.exe

# 2. Clear all caches
rmdir /s /q node_modules
rmdir /s /q .expo
del package-lock.json

# 3. Reinstall
npm install

# 4. Start with tunnel
npx expo start --tunnel
```

---

## Alternative: Just Use Emulator

If nothing works, use emulator instead:

### Android Emulator (no network issues):
```bash
npm run android
```

### iOS Simulator (Mac only):
```bash
npm run ios
```

**Advantages:**
- No network issues
- Faster reload
- Better debugging tools
- No VPN conflicts

---

## Check Connection Status

When Metro starts, you should see:
```
Metro waiting on exp://192.168.1.126:8081
› Scan the QR code above with Expo Go (Android) or Camera (iOS)

› Using Expo Go
› Press s │ switch to development build

› Press a │ open Android
› Press i │ open iOS simulator
› Press w │ open web

› Press j │ open debugger
› Press r │ reload app
› Press m │ toggle menu
› Press o │ open project code in your editor

› Press ? │ show all commands
```

If you see this, Metro is running. The issue is phone → computer connection.

---

## Quick Test: Can Phone Reach Computer?

**On phone browser:**
- Open Chrome/Safari
- Visit: `http://192.168.1.126:8081`
- You should see Metro bundler page

**If this works:** Network is fine, issue is Expo Go app
**If this fails:** Network issue (firewall/VPN/different network)

---

## Success Checklist

✅ NordLynx adapter disabled
✅ Computer and phone on same WiFi (192.168.1.x)
✅ Windows Firewall allows port 8081
✅ Metro bundler running (no errors in terminal)
✅ Expo Go app updated to latest version
✅ Both devices on same network subnet

---

## Get Help

If none of this works, run diagnostics:

```bash
npx expo-doctor
```

This checks for common issues.

Also check:
```bash
# See what Metro sees
npx expo start --lan
```

Copy the terminal output and we can debug from there.
