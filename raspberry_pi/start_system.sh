#!/bin/bash

echo "Starting Ambulance Traffic Control System"
echo "=========================================="

echo "Starting Flask API Server..."
python3 api_server.py &
API_PID=$!

sleep 3

echo "Starting Detection System..."
python3 detection_system.py &
DETECTION_PID=$!

echo ""
echo "System Started!"
echo "API Server PID: $API_PID"
echo "Detection System PID: $DETECTION_PID"
echo ""
echo "API accessible at: http://192.168.1.50:5000"
echo ""
echo "Press Ctrl+C to stop all processes"

trap "echo 'Stopping...'; kill $API_PID $DETECTION_PID; exit" INT TERM

wait
