# Simple Traffic Signal System

## What This Does

Controls 3 traffic signals via REST API for your ambulance mobile app:
- **NORTH** (GPIO 27/17) - north_south direction
- **EAST** (GPIO 12/16) - east_west direction
- **SOUTH** (GPIO 20/21) - north_south direction

No RFID, no YOLO, no audio detection - just pure API control.

## Quick Start

### 1. Install Dependencies
```bash
pip3 install flask flask-cors lgpio
```

### 2. Update GPS Coordinates
Edit `simple_api_server.py` lines 8-12 with your actual signal locations:
```python
TRAFFIC_LIGHTS = {
    "NORTH": {"RED": 27, "GREEN": 17, "lat": 11.0168, "lng": 76.9558},
    "EAST":  {"RED": 12, "GREEN": 16, "lat": 11.0170, "lng": 76.9562},
    "SOUTH": {"RED": 20, "GREEN": 21, "lat": 11.0165, "lng": 76.9560},
}
```

### 3. Run Server
```bash
python3 simple_api_server.py
```

You should see:
```
🚦 TRAFFIC SIGNAL CONTROL SYSTEM
==================================================
Initializing GPIO...
✅ NORTH: RED=27, GREEN=17
✅ EAST: RED=12, GREEN=16
✅ SOUTH: RED=20, GREEN=21

Initializing all signals to RED...
🔴 NORTH → RED
🔴 EAST → RED
🔴 SOUTH → RED

📡 API Endpoints: ...
🌐 Server starting on port 5000...
```

### 4. Test It
```bash
chmod +x test_signals.sh
./test_signals.sh
```

## API Endpoints

### Get All Signals
```bash
curl http://localhost:5000/signals
```

### Control Signal (Simple)
```bash
# Turn NORTH green
curl -X POST http://localhost:5000/signal/NORTH \
  -H "Content-Type: application/json" \
  -d '{"status": "green"}'

# Turn NORTH red
curl -X POST http://localhost:5000/signal/NORTH \
  -H "Content-Type: application/json" \
  -d '{"status": "red"}'
```

### Control Signal (Direction Aware)
```bash
# Turn SOUTH green (only if north_south direction)
curl -X POST http://localhost:5000/signal/SOUTH/direction \
  -H "Content-Type: application/json" \
  -d '{"direction": "north_south", "status": "green"}'

# Turn EAST green (only if east_west direction)
curl -X POST http://localhost:5000/signal/EAST/direction \
  -H "Content-Type: application/json" \
  -d '{"direction": "east_west", "status": "green"}'
```

### Emergency Mode
```bash
# Activate emergency - turns SOUTH green, others red
curl -X POST http://localhost:5000/emergency/activate \
  -H "Content-Type: application/json" \
  -d '{"direction": "SOUTH"}'

# Deactivate emergency - all red
curl -X POST http://localhost:5000/emergency/deactivate
```

### Test Endpoints
```bash
# All green
curl -X POST http://localhost:5000/test/all-green

# All red
curl -X POST http://localhost:5000/test/all-red

# Cycle through signals
curl -X POST http://localhost:5000/test/cycle
```

## Mobile App Integration

Your React Native app will automatically:
1. Fetch signal locations from `/signals`
2. Calculate ambulance heading
3. Send direction-aware commands to `/signal/{id}/direction`

Example from app:
```javascript
// Ambulance heading North (0°) approaching SOUTH signal
updateSignalDirection('SOUTH', 'north_south', 'green')
// Result: SOUTH turns GREEN

// Ambulance heading East (90°) approaching SOUTH signal
updateSignalDirection('SOUTH', 'north_south', 'green')
// Result: SOUTH stays RED (direction mismatch)
```

## GPIO Wiring

```
Signal   RED   GREEN   Common
------   ---   -----   ------
NORTH    27    17      GND
EAST     12    16      GND
SOUTH    20    21      GND
```

Connect:
- RED pins → Red LED (through resistor)
- GREEN pins → Green LED (through resistor)
- Common GND → Ground

## Troubleshooting

### Permission Denied
```bash
sudo usermod -a -G gpio $USER
sudo chmod 666 /dev/gpiochip0
```

### Port Already in Use
```bash
# Kill existing process
sudo lsof -ti:5000 | xargs kill -9

# Or use different port
python3 simple_api_server.py --port 5001
```

### Can't Access from Phone
```bash
# Check firewall
sudo ufw allow 5000

# Find Pi IP
hostname -I

# Test from phone
curl http://YOUR_PI_IP:5000/signals
```

### Signals Not Changing
```bash
# Test GPIO manually
python3 -c "
import lgpio
chip = lgpio.gpiochip_open(0)
lgpio.gpio_claim_output(chip, 17)
lgpio.gpio_write(chip, 17, 1)  # Should turn on
input('Press enter to turn off')
lgpio.gpio_write(chip, 17, 0)
lgpio.gpiochip_close(chip)
"
```

## Direction Logic

Your app calculates ambulance heading:
- **0° (North)** → activates `north_south` signals (NORTH, SOUTH)
- **90° (East)** → activates `east_west` signals (EAST)
- **180° (South)** → activates `north_south` signals (NORTH, SOUTH)
- **270° (West)** → activates `east_west` signals (EAST)

This ensures only signals in the ambulance's travel direction turn green!

## Production Tips

### Run as Service
Create `/etc/systemd/system/traffic-api.service`:
```ini
[Unit]
Description=Traffic Signal API
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/ambulance_system
ExecStart=/usr/bin/python3 simple_api_server.py
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable:
```bash
sudo systemctl enable traffic-api
sudo systemctl start traffic-api
```

### Use Production Server
```bash
pip3 install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 simple_api_server:app
```

### Add HTTPS
```bash
pip3 install pyopenssl
# Then modify app.run() to include ssl_context
```

## That's It!

Your system is now ready. The mobile app will control these 3 signals based on ambulance location and heading. Simple, clean, effective.
