#!/usr/bin/env python3
"""
Quick GPIO test script to verify physical connections
"""
import lgpio
import time

TRAFFIC_LIGHTS = {
    "NORTH": {"RED": 27, "GREEN": 17},
    "EAST":  {"RED": 12, "GREEN": 16},
    "SOUTH": {"RED": 20, "GREEN": 21},
}

print("🧪 GPIO Test Script")
print("="*50)

try:
    chip = lgpio.gpiochip_open(0)
    print(f"✅ GPIO chip opened: {chip}")

    # Claim all pins
    print("\n📌 Claiming GPIO pins...")
    for direction, pins in TRAFFIC_LIGHTS.items():
        lgpio.gpio_claim_output(chip, pins["RED"])
        lgpio.gpio_claim_output(chip, pins["GREEN"])
        print(f"   {direction}: RED=GPIO{pins['RED']}, GREEN=GPIO{pins['GREEN']}")

    # Test each signal
    print("\n🔴 Testing RED lights (3 seconds each)...")
    for direction, pins in TRAFFIC_LIGHTS.items():
        print(f"   {direction} RED ON")
        lgpio.gpio_write(chip, pins["RED"], 1)
        lgpio.gpio_write(chip, pins["GREEN"], 0)
        time.sleep(3)
        lgpio.gpio_write(chip, pins["RED"], 0)

    print("\n🟢 Testing GREEN lights (3 seconds each)...")
    for direction, pins in TRAFFIC_LIGHTS.items():
        print(f"   {direction} GREEN ON")
        lgpio.gpio_write(chip, pins["GREEN"], 1)
        lgpio.gpio_write(chip, pins["RED"], 0)
        time.sleep(3)
        lgpio.gpio_write(chip, pins["GREEN"], 0)

    print("\n⚡ Testing rapid switching (all signals, 5 cycles)...")
    for i in range(5):
        print(f"   Cycle {i+1}: RED")
        for pins in TRAFFIC_LIGHTS.values():
            lgpio.gpio_write(chip, pins["RED"], 1)
            lgpio.gpio_write(chip, pins["GREEN"], 0)
        time.sleep(0.5)

        print(f"   Cycle {i+1}: GREEN")
        for pins in TRAFFIC_LIGHTS.values():
            lgpio.gpio_write(chip, pins["RED"], 0)
            lgpio.gpio_write(chip, pins["GREEN"], 1)
        time.sleep(0.5)

    # All off
    print("\n💤 Turning all lights OFF...")
    for pins in TRAFFIC_LIGHTS.values():
        lgpio.gpio_write(chip, pins["RED"], 0)
        lgpio.gpio_write(chip, pins["GREEN"], 0)

    lgpio.gpiochip_close(chip)
    print("\n✅ Test complete!")
    print("\nIf you saw lights changing, GPIO is working correctly.")
    print("If not, check:")
    print("  1. Physical wiring connections")
    print("  2. GPIO pin numbers match your setup")
    print("  3. Power supply to LEDs")
    print("  4. LED polarity (anode/cathode)")

except Exception as e:
    print(f"\n❌ Error: {e}")
    print("\nPossible issues:")
    print("  • GPIO permissions: sudo usermod -a -G gpio $USER")
    print("  • Device access: sudo chmod 666 /dev/gpiochip0")
    print("  • lgpio not installed: pip3 install lgpio")
