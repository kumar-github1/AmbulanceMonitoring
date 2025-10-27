# Troubleshooting Guide

## PyTorch 2.6 Model Loading Error

### Error Message
```
_pickle.UnpicklingError: Weights only load failed...
GLOBAL ultralytics.nn.tasks.DetectionModel was not an allowed global
```

### Solution 1: Use Fixed Detection System
The updated `detection_system.py` already includes the fix. It will:
- Automatically add safe globals for YOLO
- Gracefully handle model loading failures
- Continue with RFID detection even if YOLO fails

### Solution 2: Fix Your Model File
Run the fix script:
```bash
python3 fix_model.py
```

Then update line 184 in `detection_system.py`:
```python
model = YOLO("best_fixed.pt")  # Use fixed model
```

### Solution 3: Downgrade PyTorch (Not Recommended)
```bash
pip install torch==2.0.0 torchvision==0.15.0
```

### Solution 4: Run Without YOLO
The system will still work with:
- RFID detection (card authentication)
- Audio detection (siren recognition)
- Manual override (press 'o' key)

Just start the system normally - it will skip YOLO if loading fails.

## Common Issues

### Issue: API Server Not Accessible
**Error**: Connection refused to 192.168.1.50:5000

**Solutions**:
```bash
# Check if server is running
netstat -tuln | grep 5000

# Check firewall
sudo ufw allow 5000

# Verify IP address
hostname -I

# Test locally first
curl http://localhost:5000/signals
```

### Issue: GPIO Permission Denied
**Error**: Permission denied accessing GPIO

**Solutions**:
```bash
# Add user to gpio group
sudo usermod -a -G gpio $USER

# Set permissions
sudo chmod 666 /dev/gpiochip0

# Reboot to apply
sudo reboot
```

### Issue: Camera Not Found
**Error**: Cannot open camera

**Solutions**:
```bash
# List cameras
v4l2-ctl --list-devices

# Try different index
# In detection_system.py line 191:
cap = cv2.VideoCapture(1)  # Try 1 instead of 0

# Test camera
raspistill -o test.jpg
```

### Issue: RFID Reader Not Detected
**Error**: No response from RFID

**Solutions**:
```bash
# Enable SPI
sudo raspi-config
# Navigate to: Interface Options -> SPI -> Enable

# Check SPI devices
ls /dev/spi*

# Test MFRC522 connections:
# SDA  -> GPIO 8  (Pin 24)
# SCK  -> GPIO 11 (Pin 23)
# MOSI -> GPIO 10 (Pin 19)
# MISO -> GPIO 9  (Pin 21)
# RST  -> GPIO 25 (Pin 22)
# GND  -> GND
# 3.3V -> 3.3V
```

### Issue: Audio Detection Not Working
**Error**: sounddevice errors or no audio input

**Solutions**:
```bash
# List audio devices
python3 -c "import sounddevice as sd; print(sd.query_devices())"

# Install ALSA utils
sudo apt-get install alsa-utils

# Test microphone
arecord -l

# Adjust microphone volume
alsamixer
```

### Issue: Model Files Missing
**Error**: FileNotFoundError: best.pt not found

**Solutions**:
```bash
# Ensure model is in correct directory
ls -la best.pt

# If missing, copy from training location
# Or disable YOLO (system will still work with RFID)
```

## Testing Without Full Setup

### Test API Only
```bash
python3 api_server.py
# In another terminal:
curl http://localhost:5000/signals
```

### Test GPIO (Without Camera/RFID)
```python
import lgpio
chip = lgpio.gpiochip_open(0)
lgpio.gpio_claim_output(chip, 13)
lgpio.gpio_write(chip, 13, 1)  # Turn on
lgpio.gpio_write(chip, 13, 0)  # Turn off
lgpio.gpiochip_close(chip)
```

### Test Detection Without GPIO
Comment out GPIO initialization in detection_system.py:
```python
# chip = lgpio.gpiochip_open(0)
# ... rest of GPIO setup
```

## Performance Issues

### High CPU Usage
- Reduce YOLO image size: `imgsz=128` instead of `imgsz=160`
- Increase detection interval: Change `> 60` to `> 120`
- Disable audio detection if not needed

### Slow Network Response
- Check network latency: `ping 192.168.1.50`
- Reduce API timeout: `timeout=1` instead of `timeout=2`
- Use local IP (localhost) when possible

## Logs

### Check Detection Logs
```bash
cat detection_logs.csv
tail -f detection_logs.csv  # Watch in real-time
```

### Check Flask Logs
Flask prints to stdout. Redirect to file:
```bash
python3 api_server.py > api.log 2>&1 &
tail -f api.log
```

## Complete System Reset

If all else fails:
```bash
# Stop all processes
pkill -f "python3 api_server.py"
pkill -f "python3 detection_system.py"

# Reset GPIO
python3 -c "import lgpio; chip=lgpio.gpiochip_open(0); [lgpio.gpio_write(chip, p, 0) for p in [27,17,12,16,20,21,6,13,18]]; lgpio.gpiochip_close(chip)"

# Restart
./start_system.sh
```

## Getting Help

Include this information when asking for help:
```bash
# System info
uname -a
python3 --version
pip3 list | grep -E "torch|ultralytics|lgpio|flask"

# Hardware check
gpio readall
ls /dev/spi*
ls /dev/video*

# Network check
hostname -I
netstat -tuln | grep 5000
```
