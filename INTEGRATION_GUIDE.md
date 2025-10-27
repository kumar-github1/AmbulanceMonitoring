# Raspberry Pi + React Native Integration Guide

## Overview

Your ambulance tracking app now communicates with your Raspberry Pi to control physical traffic signals in real-time based on GPS location and heading.

## Architecture

```
Mobile App (React Native)
    ↓ GPS Location + Heading
    ↓ Calculate Direction (N/S/E/W)
    ↓ HTTP POST Request
Raspberry Pi Flask API (port 5000)
    ↓ Process Direction
    ↓ lgpio write
Physical Traffic Lights (GPIO pins)
```

## Configuration

### 1. Update Raspberry Pi IP Address

Edit **`src/config/piConfig.ts`**:
```typescript
export const PI_CONFIG = {
  IP_ADDRESS: '192.168.1.50',  // ← Change to your Pi's actual IP
  PORT: 5000,
  TIMEOUT: 3000,
  PING_INTERVAL: 5000,
};
```

Find your Pi's IP:
```bash
hostname -I
```

### 2. Update Signal GPS Coordinates

On Raspberry Pi, edit **`detection_system.py`** lines 10-14:
```python
TRAFFIC_LIGHTS = {
    "NORTH": {"RED": 27, "GREEN": 17, "lat": 11.0168, "lng": 76.9558},
    "EAST":  {"RED": 12, "GREEN": 16, "lat": 11.0170, "lng": 76.9562},
    "SOUTH": {"RED": 20, "GREEN": 21, "lat": 11.0165, "lng": 76.9560},
}
```

Use actual GPS coordinates of your physical traffic signals!

## How It Works

### Step-by-Step Flow

1. **App Starts**
   - Fetches signal locations from Pi: `GET /signals`
   - Shows signals on map
   - Displays Pi connection indicator (green = connected)

2. **Ambulance Moves**
   - GPS updates location every 200ms
   - Calculates heading (compass direction): 0°=North, 90°=East, 180°=South, 270°=West
   - Determines ambulance direction: `north_south` or `east_west`

3. **Approaching Signal** (within 500m)
   - App checks signal direction vs ambulance direction
   - If aligned: Sends `POST /signal/{id}/direction` with `{direction, status: "green"}`
   - If perpendicular: Skips signal

4. **Pi Receives Request**
   - Validates direction match
   - Turns appropriate GPIO pins HIGH/LOW
   - Physical lights change: RED → GREEN

5. **Ambulance Passes**
   - App detects ambulance moved away
   - Sends `{status: "red"}` to return signal to normal

## Console Logs

### On Mobile App

```
✅ Pi connected at http://192.168.1.50:5000
🔗 Raspberry Pi connected, fetching signals...
✅ Loaded 3 signals from Pi
🚨 Activating emergency mode for SOUTH [north_south]
✅ Pi signal SOUTH [north_south] → GREEN
✅ Signal SOUTH cleared for ambulance
```

### On Raspberry Pi

```
Initializing GPIO...
✅ GPIO chip opened: 0
✅ NORTH: RED=GPIO27, GREEN=GPIO17
✅ EAST: RED=GPIO12, GREEN=GPIO16
✅ SOUTH: RED=GPIO20, GREEN=GPIO21

🟢 SOUTH → GREEN (GPIO21=HIGH, GPIO20=LOW)
   Verified: RED=0, GREEN=1
```

## Testing

### Test 1: Check Connection
```bash
# On mobile app, you should see:
✅ Pi connected at http://192.168.1.50:5000

# If not connected:
⚠️  Pi connection lost (http://192.168.1.50:5000)
```

Tap the "Pi Connection" indicator to manually check connection.

### Test 2: Manual Signal Control

From any terminal on same network:
```bash
# Turn NORTH green
curl -X POST http://192.168.1.50:5000/signal/NORTH \
  -H "Content-Type: application/json" \
  -d '{"status": "green"}'

# Turn SOUTH green (direction-aware)
curl -X POST http://192.168.1.50:5000/signal/SOUTH/direction \
  -H "Content-Type: application/json" \
  -d '{"direction": "north_south", "status": "green"}'

# All red
curl -X POST http://192.168.1.50:5000/test/all-red
```

Watch physical lights change!

### Test 3: App Integration

1. Start React Native app
2. Grant location permissions
3. Start emergency mode
4. Walk/drive with phone
5. Approach a configured signal location
6. Watch app logs + physical lights

## Troubleshooting

### App Shows "Pi Offline"

**Check Network:**
```bash
# On mobile, try browser:
http://192.168.1.50:5000/signals

# Ping from computer:
ping 192.168.1.50
```

**Check Firewall:**
```bash
# On Pi:
sudo ufw allow 5000
sudo ufw status
```

**Check Pi Server Running:**
```bash
# Should see Flask process:
ps aux | grep detection_system
```

### Signals Not Changing on Pi

**Check Console for GPIO Errors:**
```
❌ GPIO write error for SOUTH: ...
```

**Verify GPIO Permissions:**
```bash
sudo usermod -a -G gpio $USER
sudo chmod 666 /dev/gpiochip0
```

**Test GPIO Manually:**
```bash
python3 test_gpio.py
```

### UI Changes But Physical Lights Don't

**Check Wiring:**
- GPIO pins match configuration
- LEDs connected with correct polarity
- Ground connections secure
- Resistors (220Ω-330Ω) in series with LEDs

**Verify API Response:**
Look for in Pi logs:
```
🟢 SOUTH → GREEN (GPIO21=HIGH, GPIO20=LOW)
   Verified: RED=0, GREEN=1
```

If you see "Verified: RED=0, GREEN=0", GPIO write may be failing.

### Direction Mismatch

App shows:
```
⏭️  Pi signal NORTH skipped: direction mismatch
```

This is **correct behavior**! It means:
- Ambulance heading: East/West
- Signal direction: North/South
- Signal correctly stays red (perpendicular to ambulance path)

## Advanced Configuration

### Change Activation Distance

Edit **`src/screens/MainMapScreen.tsx`** line 181:
```typescript
if (signal.ambulanceProximity && signal.ambulanceProximity <= 500) {
  // Change 500 to your desired distance in meters
```

### Change Update Frequency

Edit **`src/components/EnhancedMapView.tsx`** line 77:
```typescript
const UPDATE_THROTTLE = 200; // milliseconds between updates
```

### Add More Signals

1. On Pi, edit `detection_system.py`:
```python
TRAFFIC_LIGHTS = {
    "NORTH": {"RED": 27, "GREEN": 17, "lat": 11.0168, "lng": 76.9558},
    "EAST":  {"RED": 12, "GREEN": 16, "lat": 11.0170, "lng": 76.9562},
    "SOUTH": {"RED": 20, "GREEN": 21, "lat": 11.0165, "lng": 76.9560},
    "WEST":  {"RED": 6,  "GREEN": 13, "lat": 11.0166, "lng": 76.9555},  # ← Add new
}
```

2. Update signal_states:
```python
signal_states = {
    "NORTH": {"status": "red", "direction": "north_south", "override": False},
    "EAST":  {"status": "red", "direction": "east_west", "override": False},
    "SOUTH": {"status": "red", "direction": "north_south", "override": False},
    "WEST":  {"status": "red", "direction": "east_west", "override": False},  # ← Add new
}
```

3. Restart Pi server

App will automatically fetch new signals!

## Network Requirements

- **Same Network**: Mobile app and Pi must be on same WiFi/LAN
- **Pi Static IP**: Recommended to assign static IP to Pi in router settings
- **Port Open**: Port 5000 must be accessible
- **No VPN**: VPN on phone may block local network access

## Production Deployment

### Use Systemd Service

Create `/etc/systemd/system/traffic-signals.service`:
```ini
[Unit]
Description=Traffic Signal Control API
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/ambulance_system
ExecStart=/usr/bin/python3 detection_system.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable:
```bash
sudo systemctl enable traffic-signals
sudo systemctl start traffic-signals
sudo systemctl status traffic-signals
```

### Use Production WSGI Server

```bash
pip3 install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 detection_system:app
```

## Safety Notes

⚠️ **IMPORTANT**:
- This is a prototype system
- Always have manual override capability
- Test extensively before real-world deployment
- Ensure backup traffic control systems
- Follow local traffic control regulations
- Consider fail-safe modes (default to red on connection loss)

## Support

If you encounter issues:

1. Check console logs (mobile + Pi)
2. Verify network connectivity
3. Test GPIO with `test_gpio.py`
4. Review this guide's troubleshooting section
5. Check Pi server is running: `ps aux | grep detection_system`

Your system is now fully integrated and ready to control physical traffic signals from your mobile app! 🚦📱
