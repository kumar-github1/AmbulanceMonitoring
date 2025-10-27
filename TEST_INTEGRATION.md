# 🧪 Test Integration - Step by Step

## Current Status

✅ Files are created and in place:
- `src/config/piConfig.ts` - Configuration
- `src/services/RaspberryPiService.ts` - API calls
- `src/components/PiConnectionIndicator.tsx` - UI indicator
- `raspberry_pi/detection_system.py` - Pi server

## 🔍 What You Need to Check

### 1. Find Your Pi IP Address

On Raspberry Pi terminal:
```bash
hostname -I
```

Example output: `10.40.255.34` or `192.168.1.50`

### 2. Update Mobile App Config

**File:** `src/config/piConfig.ts`
**Line 9:** Change the IP address

```typescript
IP_ADDRESS: '192.168.1.50',  // ← Change this to YOUR Pi IP!
```

### 3. Start Raspberry Pi Server

```bash
cd raspberry_pi
python3 detection_system.py
```

**Expected output:**
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

🌐 Server starting on port 5000...
 * Running on http://10.40.255.34:5000    ← This is your Pi IP
```

**Leave this terminal running!**

### 4. Test Pi API Works (from any computer on same network)

```bash
# Replace with your Pi IP
curl http://10.40.255.34:5000/signals
```

**Expected response:**
```json
{
  "success": true,
  "signals": [
    {
      "id": "NORTH",
      "location": {"latitude": 11.0168, "longitude": 76.9558},
      "currentLight": "red",
      "direction": "north_south"
    },
    {
      "id": "EAST",
      "location": {"latitude": 11.0170, "longitude": 76.9562},
      "currentLight": "red",
      "direction": "east_west"
    },
    {
      "id": "SOUTH",
      "location": {"latitude": 11.0165, "longitude": 76.9560},
      "currentLight": "red",
      "direction": "north_south"
    }
  ]
}
```

✅ If you see this, **Pi is working!**

### 5. Restart Mobile App

**IMPORTANT:** Changes won't work until you restart/reload!

```bash
# Stop current app (Ctrl+C)
npm start

# Wait for Metro bundler to start
# Then press 'r' to reload
# Or shake device and tap "Reload"
```

### 6. Check Mobile App Console

**Look for these logs:**

```
✅ Pi connected at http://10.40.255.34:5000
🔗 Raspberry Pi connected, fetching signals...
✅ Loaded 3 signals from Pi
```

### 7. Visual Check - Look at App Screen

**Top-right corner should show:**

```
┌─────────────────┐
│ 📟 Pi Connected │  ← Green background = GOOD!
└─────────────────┘
```

OR

```
┌──────────────────────┐
│ 📟 Pi Offline        │  ← Red background = BAD!
│    192.168.1.50      │
└──────────────────────┘
```

## 🧪 Test Signal Control

### Test from Terminal:

```bash
# Turn NORTH signal green
curl -X POST http://10.40.255.34:5000/signal/NORTH \
  -H "Content-Type: application/json" \
  -d '{"status":"green"}'
```

**Pi terminal should show:**
```
✅ API: NORTH [] → green
🟢 NORTH → GREEN (GPIO17=HIGH, GPIO27=LOW)
   Verified: RED=0, GREEN=1
```

**Physical LED:** NORTH green LED should turn ON!

### Test Direction-Aware:

```bash
# This will work (north_south signal with north_south direction)
curl -X POST http://10.40.255.34:5000/signal/SOUTH/direction \
  -H "Content-Type: application/json" \
  -d '{"direction":"north_south","status":"green"}'
```

**Should see:** 🟢 SOUTH → GREEN

```bash
# This will skip (north_south signal with east_west direction)
curl -X POST http://10.40.255.34:5000/signal/SOUTH/direction \
  -H "Content-Type: application/json" \
  -d '{"direction":"east_west","status":"green"}'
```

**Should see:** ⏭️ API: SOUTH direction mismatch

## 🔴 Troubleshooting

### Problem: "Cannot connect to Pi"

**Check 1:** Same network?
```bash
# On Pi:
hostname -I

# On computer:
ping 10.40.255.34
```

**Check 2:** Firewall?
```bash
# On Pi:
sudo ufw allow 5000
```

**Check 3:** Server running?
```bash
ps aux | grep detection_system
```

### Problem: "Changes not appearing in app"

**Solution:** You MUST reload the app!
```bash
# In Metro bundler, press 'r'
# Or shake device → "Reload"
# Or restart: npm start
```

### Problem: "GPIO not changing"

**Test GPIO directly:**
```bash
python3 raspberry_pi/test_gpio.py
```

Watch your LEDs - they should cycle!

**Fix permissions:**
```bash
sudo usermod -a -G gpio $USER
sudo chmod 666 /dev/gpiochip0
```

## ✅ Success Criteria

When everything works, you should see:

1. **Pi Terminal:**
   ```
   🟢 SOUTH → GREEN (GPIO21=HIGH, GPIO20=LOW)
      Verified: RED=0, GREEN=1
   ```

2. **Mobile App UI:**
   - Top-right: 🟢 "Pi Connected"
   - Map: Shows 3 signal markers

3. **Mobile Console:**
   ```
   🚨 Activating emergency mode for SOUTH [north_south]
   ✅ Pi signal SOUTH [north_south] → GREEN
   ```

4. **Physical Hardware:**
   - LED changes from RED to GREEN

## 📊 Quick Checklist

- [ ] Found Pi IP: `hostname -I`
- [ ] Updated `src/config/piConfig.ts` line 9
- [ ] Started Pi: `python3 detection_system.py`
- [ ] Pi shows "Server starting on port 5000"
- [ ] Tested curl: `curl http://[PI_IP]:5000/signals`
- [ ] **Reloaded mobile app** (press 'r' or restart)
- [ ] App shows "Pi Connected" (green)
- [ ] Mobile console shows "✅ Loaded 3 signals from Pi"
- [ ] Tested curl POST: signal changes on Pi
- [ ] Physical LED changes color

If ALL checkboxes are ✅ → **WORKING!** 🎉

If any are ❌ → Check troubleshooting section above.
