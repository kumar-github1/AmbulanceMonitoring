#!/bin/bash

API="http://localhost:5000"

echo "🧪 Traffic Signal Test Suite"
echo "=============================="
echo ""

echo "1️⃣  Testing: Get all signals"
curl -s $API/signals | python3 -m json.tool
echo ""
echo ""

echo "2️⃣  Testing: NORTH GREEN"
curl -s -X POST $API/signal/NORTH \
  -H "Content-Type: application/json" \
  -d '{"status": "green"}'
echo ""
sleep 2

echo "3️⃣  Testing: EAST GREEN (direction aware)"
curl -s -X POST $API/signal/EAST/direction \
  -H "Content-Type: application/json" \
  -d '{"direction": "east_west", "status": "green"}'
echo ""
sleep 2

echo "4️⃣  Testing: SOUTH GREEN (direction aware)"
curl -s -X POST $API/signal/SOUTH/direction \
  -H "Content-Type: application/json" \
  -d '{"direction": "north_south", "status": "green"}'
echo ""
sleep 2

echo "5️⃣  Testing: All RED"
curl -s -X POST $API/test/all-red
echo ""
sleep 2

echo "6️⃣  Testing: Cycle through signals"
curl -s -X POST $API/test/cycle
echo ""
sleep 10

echo "7️⃣  Testing: Emergency activation (SOUTH)"
curl -s -X POST $API/emergency/activate \
  -H "Content-Type: application/json" \
  -d '{"direction": "SOUTH"}'
echo ""
sleep 3

echo "8️⃣  Testing: Emergency deactivation"
curl -s -X POST $API/emergency/deactivate
echo ""

echo ""
echo "✅ Test complete!"
