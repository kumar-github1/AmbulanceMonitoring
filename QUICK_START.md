# 🚀 Quick Start Guide

## What You Need to Run

### On Raspberry Pi: **1 File**
### On Mobile: **Rebuild App**

---

## 📍 STEP 1: Find Your Raspberry Pi IP Address

On your Raspberry Pi:
```bash
hostname -I
```

Example output: `10.40.255.34`

**Write it down!** ✍️

---

## 🔧 STEP 2: Update Mobile App Configuration

Edit this file: **`src/config/piConfig.ts`**

```typescript
export const PI_CONFIG = {
  IP_ADDRESS: '10.40.255.34',  // ← PUT YOUR PI IP HERE!
  PORT: 5000,
  TIMEOUT: 3000,
  PING_INTERVAL: 5000,
};
```

---

## 🍓 STEP 3: Start Raspberry Pi Server

```bash
cd raspberry_pi/
python3 detection_system.py
```

You should see:
```
==================================================
🚦 TRAFFIC SIGNAL CONTROL SYSTEM
==================================================
Initializing GPIO...
✅ GPIO chip opened: 0
✅ NORTH: RED=GPIO27, GREEN=GPIO17
✅ EAST: RED=GPIO12, GREEN=GPIO16
✅ SOUTH: RED=GPIO20, GREEN=GPIO21

Initializing all signals to RED...
🔴 NORTH → RED (GPIO27=HIGH, GPIO17=LOW)
   Verified: RED=1, GREEN=0
🔴 EAST → RED (GPIO12=HIGH, GPIO16=LOW)
   Verified: RED=1, GREEN=0
🔴 SOUTH → RED (GPIO20=HIGH, GPIO21=LOW)
   Verified: RED=1, GREEN=0

📡 API Endpoints:
  GET  /signals
  POST /signal/{id}
  POST /signal/{id}/direction
  POST /signals/sync
  POST /emergency/activate
  POST /emergency/deactivate

🧪 Test Endpoints:
  POST /test/all-green
  POST /test/all-red
  POST /test/cycle

🌐 Server starting on port 5000...
==================================================

 * Serving Flask app 'detection_system'
 * Debug mode: off
 * Running on all addresses (0.0.0.0)
 * Running on http://127.0.0.1:5000
 * Running on http://10.40.255.34:5000    ← YOUR PI IP!
Press CTRL+C to quit
```

**Keep this terminal open!** ✅

---

## 📱 STEP 4: Rebuild and Start Mobile App

### Important: You MUST rebuild the app!

```bash
# Option 1: Expo
npm start
# Press 'r' to reload
# Or shake device → "Reload"

# Option 2: React Native CLI
npx react-native run-android
# or
npx react-native run-ios
```

**The new code won't work until you reload/rebuild!** 🔄

---

## ✅ STEP 5: Verify Connection

### On Mobile App:
Look for **top-right indicator**:
- 🟢 **Green "Pi Connected"** = ✅ Working!
- 🔴 **Red "Pi Offline"** = ❌ Not connected

### Check Console Logs:

**Mobile App (Metro/Expo console):**
```
✅ Pi connected at http://10.40.255.34:5000
🔗 Raspberry Pi connected, fetching signals...
✅ Loaded 3 signals from Pi
```

**Raspberry Pi Terminal:**
```
127.0.0.1 - - [28/Oct/2025 00:00:00] "GET /signals HTTP/1.1" 200 -
```

---

## 🧪 STEP 6: Test It!

### Test 1: Manual API Test (from computer)

```bash
# Get signals
curl http://10.40.255.34:5000/signals

# Turn NORTH green
curl -X POST http://10.40.255.34:5000/signal/NORTH \
  -H "Content-Type: application/json" \
  -d '{"status":"green"}'

# Watch your Pi terminal - should see:
# 🟢 NORTH → GREEN (GPIO17=HIGH, GPIO27=LOW)
```

### Test 2: From Mobile App

1. Start emergency mode in app
2. Move around (simulate GPS movement)
3. When within 500m of a signal, watch:

**Mobile Console:**
```
🚨 Activating emergency mode for SOUTH [north_south]
✅ Pi signal SOUTH [north_south] → GREEN
```

**Pi Terminal:**
```
✅ API: SOUTH [north_south] → green
🟢 SOUTH → GREEN (GPIO21=HIGH, GPIO20=LOW)
   Verified: RED=0, GREEN=1
```

---

## 🔥 Common Issues

### Issue: "Pi Offline" (Red indicator)

**Check 1: Same Network?**
```bash
# On Pi:
hostname -I

# On computer:
ping 10.40.255.34
```

**Check 2: Firewall?**
```bash
# On Pi:
sudo ufw allow 5000
```

**Check 3: Server Running?**
```bash
ps aux | grep detection_system
```

### Issue: GPIO Not Changing

**Run test script:**
```bash
python3 raspberry_pi/test_gpio.py
```

Watch your LEDs - they should cycle through red and green!

**Check permissions:**
```bash
sudo usermod -a -G gpio $USER
sudo chmod 666 /dev/gpiochip0
```

### Issue: App Not Sending Requests

**Did you rebuild the app?**
- Metro: Press `r` to reload
- Or completely restart: `npm start` (clear cache if needed)

**Check config file:**
```bash
cat src/config/piConfig.ts
# Verify IP_ADDRESS is correct
```

---

## 📋 Summary Checklist

- [ ] Found Pi IP with `hostname -I`
- [ ] Updated `src/config/piConfig.ts` with correct IP
- [ ] Started Pi server: `python3 detection_system.py`
- [ ] **Rebuilt/reloaded mobile app** (this is crucial!)
- [ ] Mobile app shows "Pi Connected" (green)
- [ ] Tested with curl command
- [ ] Tested from mobile app in emergency mode

---

## 🎯 Expected Behavior

### When It's Working:

1. **App starts** → Shows "Pi Connected" (green chip icon top-right)
2. **Emergency mode ON** → App fetches signal locations
3. **Within 500m of signal** → App calculates heading
4. **Correct direction** → Sends green command to Pi
5. **Pi receives** → GPIO pins change
6. **Physical lights** → GREEN turns ON, RED turns OFF
7. **Ambulance passes** → Signal returns to RED

### Console Output Flow:

**Mobile → Pi:**
```
Mobile: 🚨 Activating emergency mode for SOUTH [north_south]
Mobile: ✅ Pi signal SOUTH [north_south] → GREEN
  ↓
Pi: ✅ API: SOUTH [north_south] → green
Pi: 🟢 SOUTH → GREEN (GPIO21=HIGH, GPIO20=LOW)
Pi:    Verified: RED=0, GREEN=1
```

---

## 🆘 Still Not Working?

1. **Verify network:** `ping [PI_IP]`
2. **Test API directly:** `curl http://[PI_IP]:5000/signals`
3. **Check both console logs** (mobile + Pi)
4. **Verify GPIO wiring** with `test_gpio.py`
5. **Ensure app was rebuilt** after config change

---

## 🎉 Success!

When you see both:
- ✅ Mobile app showing "Pi Connected" (green)
- ✅ Pi terminal showing GPIO state changes
- ✅ Physical LEDs changing color

**You're ready to go!** 🚦📱

The system is now integrated and controlling physical traffic signals from your mobile app based on GPS location and heading.
