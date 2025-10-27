from flask import Flask, request, jsonify
from flask_cors import CORS
import threading
import time
import lgpio

app = Flask(__name__)
CORS(app)

TRAFFIC_LIGHTS = {
    "NORTH": {"RED": 27, "GREEN": 17, "lat": 11.0168, "lng": 76.9558},
    "EAST":  {"RED": 12, "GREEN": 16, "lat": 11.0170, "lng": 76.9562},
    "SOUTH": {"RED": 20, "GREEN": 21, "lat": 11.0165, "lng": 76.9560},
}

print("Initializing GPIO...")
chip = lgpio.gpiochip_open(0)
for direction, pins in TRAFFIC_LIGHTS.items():
    lgpio.gpio_claim_output(chip, pins["RED"])
    lgpio.gpio_claim_output(chip, pins["GREEN"])
    print(f"✅ {direction}: RED={pins['RED']}, GREEN={pins['GREEN']}")

signal_states = {
    "NORTH": {"status": "red", "direction": "north_south", "override": False},
    "EAST":  {"status": "red", "direction": "east_west", "override": False},
    "SOUTH": {"status": "red", "direction": "north_south", "override": False},
}

emergency_active = False
api_control_lock = threading.Lock()

def set_physical_light(direction, color):
    pins = TRAFFIC_LIGHTS[direction]
    if color == "green":
        lgpio.gpio_write(chip, pins["GREEN"], 1)
        lgpio.gpio_write(chip, pins["RED"], 0)
        print(f"🟢 {direction} → GREEN")
    else:
        lgpio.gpio_write(chip, pins["GREEN"], 0)
        lgpio.gpio_write(chip, pins["RED"], 1)
        print(f"🔴 {direction} → RED")

def initialize_all_red():
    print("\nInitializing all signals to RED...")
    for direction in TRAFFIC_LIGHTS.keys():
        set_physical_light(direction, "red")

@app.route('/signals', methods=['GET'])
def get_signals():
    signals = []
    for direction, config in TRAFFIC_LIGHTS.items():
        state = signal_states[direction]
        signals.append({
            "id": direction,
            "location": {"latitude": config["lat"], "longitude": config["lng"]},
            "currentLight": state["status"],
            "emergencyOverride": state["override"],
            "normalCycle": {"red": 30, "yellow": 3, "green": 30},
            "countdown": 30,
            "type": "intersection",
            "direction": state["direction"],
            "status": "emergency_mode" if state["override"] else "normal"
        })
    return jsonify({"success": True, "signals": signals})

@app.route('/signal/<signal_id>', methods=['POST'])
def update_signal(signal_id):
    data = request.json
    status = data.get('status')

    if signal_id not in signal_states:
        return jsonify({"success": False, "error": "Invalid signal ID"}), 400

    with api_control_lock:
        signal_states[signal_id]["status"] = status
        signal_states[signal_id]["override"] = True
        set_physical_light(signal_id, status)

    return jsonify({"success": True, "signal": signal_id, "status": status})

@app.route('/signal/<signal_id>/direction', methods=['POST'])
def update_signal_direction(signal_id):
    data = request.json
    direction = data.get('direction')
    status = data.get('status')

    if signal_id not in signal_states:
        return jsonify({"success": False, "error": "Invalid signal ID"}), 400

    with api_control_lock:
        signal_direction = signal_states[signal_id]["direction"]

        if direction == signal_direction or direction == "all_directions":
            signal_states[signal_id]["status"] = status
            signal_states[signal_id]["override"] = True
            set_physical_light(signal_id, status)
            print(f"✅ API: {signal_id} [{direction}] → {status}")
            return jsonify({"success": True, "signal": signal_id, "direction": direction, "status": status})
        else:
            print(f"⏭️  API: {signal_id} direction mismatch (signal: {signal_direction}, requested: {direction})")
            return jsonify({"success": True, "signal": signal_id, "skipped": True, "reason": "direction_mismatch"})

@app.route('/signals/sync', methods=['POST'])
def sync_signals():
    data = request.json
    signals = data.get('signals', [])

    with api_control_lock:
        for sig in signals:
            sig_id = sig.get('id')
            status = sig.get('status')
            if sig_id in signal_states:
                signal_states[sig_id]["status"] = status
                set_physical_light(sig_id, status)

    return jsonify({"success": True, "synced": len(signals)})

@app.route('/signal/<signal_id>/status', methods=['GET'])
def get_signal_status(signal_id):
    if signal_id not in signal_states:
        return jsonify({"success": False, "error": "Invalid signal ID"}), 400

    return jsonify({"success": True, "signal": signal_id, "state": signal_states[signal_id]})

@app.route('/emergency/activate', methods=['POST'])
def activate_emergency():
    global emergency_active
    data = request.json
    direction = data.get('direction', 'SOUTH')

    with api_control_lock:
        emergency_active = True
        print(f"\n🚨 EMERGENCY ACTIVATED - {direction} 🚨")
        for sig_id in signal_states.keys():
            if sig_id == direction:
                signal_states[sig_id]["status"] = "green"
                signal_states[sig_id]["override"] = True
                set_physical_light(sig_id, "green")
            else:
                signal_states[sig_id]["status"] = "red"
                set_physical_light(sig_id, "red")

    return jsonify({"success": True, "emergency_direction": direction})

@app.route('/emergency/deactivate', methods=['POST'])
def deactivate_emergency():
    global emergency_active

    with api_control_lock:
        emergency_active = False
        print(f"\n✅ EMERGENCY DEACTIVATED")
        for sig_id in signal_states.keys():
            signal_states[sig_id]["override"] = False
            signal_states[sig_id]["status"] = "red"
            set_physical_light(sig_id, "red")

    return jsonify({"success": True})

@app.route('/test/all-green', methods=['POST'])
def test_all_green():
    print("\n🧪 TEST: All signals GREEN")
    with api_control_lock:
        for direction in TRAFFIC_LIGHTS.keys():
            set_physical_light(direction, "green")
    return jsonify({"success": True, "message": "All green for 5 seconds"})

@app.route('/test/all-red', methods=['POST'])
def test_all_red():
    print("\n🧪 TEST: All signals RED")
    with api_control_lock:
        for direction in TRAFFIC_LIGHTS.keys():
            set_physical_light(direction, "red")
    return jsonify({"success": True, "message": "All red"})

@app.route('/test/cycle', methods=['POST'])
def test_cycle():
    print("\n🧪 TEST: Cycling through signals")
    directions = ["NORTH", "EAST", "SOUTH"]

    def cycle():
        for direction in directions:
            with api_control_lock:
                for d in TRAFFIC_LIGHTS.keys():
                    set_physical_light(d, "red")
                set_physical_light(direction, "green")
            time.sleep(3)
        with api_control_lock:
            for d in TRAFFIC_LIGHTS.keys():
                set_physical_light(d, "red")

    threading.Thread(target=cycle, daemon=True).start()
    return jsonify({"success": True, "message": "Cycling through signals"})

def cleanup_on_exit():
    print("\n🧹 Cleaning up GPIO...")
    for direction in TRAFFIC_LIGHTS.keys():
        set_physical_light(direction, "red")
    lgpio.gpiochip_close(chip)
    print("✅ Cleanup complete")

if __name__ == '__main__':
    try:
        print("\n" + "="*50)
        print("🚦 TRAFFIC SIGNAL CONTROL SYSTEM")
        print("="*50)
        initialize_all_red()
        print("\n📡 API Endpoints:")
        print("  GET  /signals")
        print("  POST /signal/{id}")
        print("  POST /signal/{id}/direction")
        print("  POST /signals/sync")
        print("  POST /emergency/activate")
        print("  POST /emergency/deactivate")
        print("\n🧪 Test Endpoints:")
        print("  POST /test/all-green")
        print("  POST /test/all-red")
        print("  POST /test/cycle")
        print("\n🌐 Server starting on port 5000...")
        print("="*50 + "\n")

        app.run(host='0.0.0.0', port=5000, debug=False)
    except KeyboardInterrupt:
        cleanup_on_exit()
    except Exception as e:
        print(f"❌ Error: {e}")
        cleanup_on_exit()
