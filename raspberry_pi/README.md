# Raspberry Pi Traffic Control System

## Architecture

### Signal Mapping
- **NORTH, EAST, SOUTH**: Controlled by mobile app via API (GPIO pins 27, 17, 12, 16, 20, 21)
- **WEST**: Local detection system (YOLO + Audio + RFID) (GPIO pins 6, 13)

### Components

1. **api_server.py**: Flask REST API for remote control
2. **detection_system.py**: Local ambulance detection (YOLO, Audio, RFID)

## Installation

```bash
cd raspberry_pi
pip install -r requirements.txt
chmod +x start_system.sh
```

## Configuration

Edit signal locations in `api_server.py`:
```python
TRAFFIC_LIGHTS = {
    "NORTH": {"RED": 27, "GREEN": 17, "lat": 11.0168, "lng": 76.9558},
    "EAST":  {"RED": 12, "GREEN": 16, "lat": 11.0170, "lng": 76.9562},
    "SOUTH": {"RED": 20, "GREEN": 21, "lat": 11.0165, "lng": 76.9560},
}
```

Update coordinates to match your actual traffic signal locations.

## Running

### Start Both Systems
```bash
./start_system.sh
```

### Start Individually
```bash
# Terminal 1 - API Server
python3 api_server.py

# Terminal 2 - Detection System
python3 detection_system.py
```

## API Endpoints

### Get All Signals
```bash
GET http://192.168.1.50:5000/signals
```

### Update Signal
```bash
POST http://192.168.1.50:5000/signal/NORTH
Content-Type: application/json

{"status": "green"}
```

### Update Signal Direction
```bash
POST http://192.168.1.50:5000/signal/NORTH/direction
Content-Type: application/json

{"direction": "north_south", "status": "green"}
```

### Bulk Sync
```bash
POST http://192.168.1.50:5000/signals/sync
Content-Type: application/json

{
  "signals": [
    {"id": "NORTH", "status": "green"},
    {"id": "EAST", "status": "red"},
    {"id": "SOUTH", "status": "red"}
  ]
}
```

### Emergency Activation
```bash
POST http://192.168.1.50:5000/emergency/activate
Content-Type: application/json

{"direction": "SOUTH"}
```

### Emergency Deactivation
```bash
POST http://192.168.1.50:5000/emergency/deactivate
```

## Mobile App Integration

The mobile app automatically:
1. Fetches signal locations on startup
2. Detects ambulance heading (compass direction)
3. Activates only signals in ambulance's travel path
4. Maps directions:
   - North/South heading → `north_south` signals
   - East/West heading → `east_west` signals

## GPIO Pin Layout

```
NORTH:  RED=27,  GREEN=17
EAST:   RED=12,  GREEN=16
SOUTH:  RED=20,  GREEN=21
WEST:   RED=6,   GREEN=13  (local detection only)
BUZZER: GPIO 18
```

## Detection System (WEST)

### RFID Cards
Add cards in `detection_system.py`:
```python
card_names = {
    "1DABC063": {"Name": "AMBULANCE 1", "Number": "TN 99 AB 0000"},
}
```

### Manual Override
Press `o` in detection window to trigger WEST signal manually.

## Logs

Detection logs saved to: `detection_logs.csv`

## Troubleshooting

### API not accessible
```bash
# Check firewall
sudo ufw allow 5000

# Check IP address
hostname -I
```

### GPIO Permission Issues
```bash
sudo usermod -a -G gpio $USER
sudo chmod 666 /dev/gpiochip0
```

### Camera not found
```bash
v4l2-ctl --list-devices
# Update VideoCapture index if needed
```

## Testing

Test API from command line:
```bash
# Get signals
curl http://192.168.1.50:5000/signals

# Turn NORTH green
curl -X POST http://192.168.1.50:5000/signal/NORTH \
  -H "Content-Type: application/json" \
  -d '{"status": "green"}'

# Direction-aware control
curl -X POST http://192.168.1.50:5000/signal/SOUTH/direction \
  -H "Content-Type: application/json" \
  -d '{"direction": "north_south", "status": "green"}'
```

## System Flow

1. **Mobile App → API**: Ambulance approaches, app sends direction-aware signal commands
2. **API → GPIO**: Flask server controls NORTH, EAST, SOUTH signals
3. **Detection → GPIO**: Local system controls WEST signal independently
4. **Detection → API**: Local system notifies API of local activations

## Notes

- Mobile app controls 3 signals (NORTH, EAST, SOUTH)
- Local detection controls 1 signal (WEST)
- All systems log to CSV for analysis
- Emergency mode locks signals for 25 seconds
- Direction-aware logic prevents conflicting green signals
