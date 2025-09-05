/*
 * Example Socket.io Server for Ambulance Driver Mobile Application
 * 
 * This is a basic server implementation for testing the ambulance tracking app.
 * In a production environment, you would integrate this with a proper database
 * and add authentication, logging, and other production features.
 * 
 * To run this server:
 * 1. npm install socket.io express
 * 2. node server-example.js
 * 3. Configure your mobile app to connect to ws://localhost:3001
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(express.json());

const PORT = process.env.PORT || 3001;

const connectedAmbulances = new Map();

const mockHospitals = [
  {
    id: 'hospital_1',
    name: 'City General Hospital',
    location: { latitude: 37.7749, longitude: -122.4194 },
    type: 'General',
    emergencyServices: true,
    facilities: ['Emergency Room', 'ICU', 'Surgery', 'Cardiology', 'Neurology'],
    phoneNumber: '+1-555-0101',
    address: '123 Medical Center Dr, San Francisco, CA',
    capacity: 150,
    currentLoad: 85,
    rating: 4.2,
    isOpen24Hours: true,
  },
  {
    id: 'hospital_2', 
    name: 'St. Mary Medical Center',
    location: { latitude: 37.7849, longitude: -122.4094 },
    type: 'General',
    emergencyServices: true,
    facilities: ['Emergency Room', 'ICU', 'Surgery', 'Pediatrics', 'Maternity'],
    phoneNumber: '+1-555-0102',
    address: '456 Healthcare Ave, San Francisco, CA',
    capacity: 200,
    currentLoad: 120,
    rating: 4.5,
    isOpen24Hours: true,
  },
  {
    id: 'hospital_3',
    name: 'Memorial Hospital',
    location: { latitude: 37.7649, longitude: -122.4294 },
    type: 'Specialty',
    emergencyServices: false,
    facilities: ['Surgery', 'Orthopedics', 'Rehabilitation'],
    phoneNumber: '+1-555-0103',
    address: '789 Wellness Blvd, San Francisco, CA',
    capacity: 120,
    currentLoad: 60,
    rating: 4.0,
    isOpen24Hours: false,
  },
  {
    id: 'hospital_4',
    name: 'University Trauma Center',
    location: { latitude: 37.7549, longitude: -122.4394 },
    type: 'Trauma Center',
    emergencyServices: true,
    facilities: ['Level 1 Trauma', 'Emergency Room', 'ICU', 'Surgery', 'Burn Unit'],
    phoneNumber: '+1-555-0104',
    address: '321 University Hospital Way, San Francisco, CA',
    capacity: 300,
    currentLoad: 180,
    rating: 4.7,
    isOpen24Hours: true,
  },
  {
    id: 'hospital_5',
    name: 'Mercy Emergency Hospital',
    location: { latitude: 37.7950, longitude: -122.3994 },
    type: 'Emergency',
    emergencyServices: true,
    facilities: ['Emergency Room', 'ICU', 'Fast Track', 'Ambulatory Surgery'],
    phoneNumber: '+1-555-0105',
    address: '654 Emergency Lane, San Francisco, CA',
    capacity: 80,
    currentLoad: 45,
    rating: 4.3,
    isOpen24Hours: true,
  },
];

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function getNearbyHospitals(location, radius = 10) {
  return mockHospitals.map(hospital => {
    const distance = calculateDistance(
      location.latitude, location.longitude,
      hospital.location.latitude, hospital.location.longitude
    );
    return { ...hospital, distance };
  }).filter(hospital => hospital.distance <= radius)
    .sort((a, b) => a.distance - b.distance);
}

// Enhanced traffic signal simulation
const trafficSignals = new Map([
  ['signal_001', { id: 'signal_001', location: { latitude: 37.7849, longitude: -122.4094 }, status: 'normal', clearedFor: null }],
  ['signal_002', { id: 'signal_002', location: { latitude: 37.7749, longitude: -122.4194 }, status: 'normal', clearedFor: null }],
  ['signal_003', { id: 'signal_003', location: { latitude: 37.7649, longitude: -122.4294 }, status: 'normal', clearedFor: null }],
]);

// Route calculation simulation
function calculateRoute(start, destination) {
  const route = {
    points: [
      start,
      { latitude: (start.latitude + destination.latitude) / 2, longitude: (start.longitude + destination.longitude) / 2 },
      destination
    ],
    distance: calculateDistance(start.latitude, start.longitude, destination.latitude, destination.longitude) * 1000, // Convert to meters
    duration: Math.floor(Math.random() * 1800) + 600, // 10-40 minutes
    instructions: [
      'Head north on Main Street',
      'Turn right onto Hospital Avenue',
      'Continue straight for 2.5 miles',
      'Destination will be on your left'
    ]
  };

  const signals = Array.from(trafficSignals.values()).map(signal => ({
    id: signal.id,
    location: signal.location,
    status: signal.clearedFor ? 'cleared' : 'pending',
    clearanceTime: signal.clearedFor ? 120 : undefined
  }));

  return { route, trafficSignals: signals };
}

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id, socket.handshake.query);

  // Enhanced ambulance registration
  socket.on('register-ambulance', (data) => {
    const { ambulanceId, initialLocation, deviceInfo } = data;
    console.log(`🚑 Ambulance registered: ${ambulanceId} from ${deviceInfo?.platform || 'unknown'}`);
    
    connectedAmbulances.set(socket.id, {
      ambulanceId,
      socket,
      isEmergency: false,
      lastLocation: initialLocation,
      connectedAt: new Date(),
      deviceInfo
    });

    socket.emit('server-message', {
      type: 'registration_success',
      message: `Ambulance ${ambulanceId} registered successfully`,
      timestamp: Date.now()
    });

    // Send nearby hospitals
    const nearbyHospitals = getNearbyHospitals(initialLocation, 10);
    socket.emit('hospitals:list', nearbyHospitals);
  });

  // Real-time location updates
  socket.on('update-location', (data) => {
    const ambulance = connectedAmbulances.get(socket.id);
    if (ambulance) {
      ambulance.lastLocation = data.location;
      ambulance.lastUpdate = Date.now();
      
      const speed = data.speed || 0;
      const heading = data.heading || 0;
      
      console.log(`📍 Location update from ${ambulance.ambulanceId}: ${data.location.latitude.toFixed(6)}, ${data.location.longitude.toFixed(6)} (${speed.toFixed(1)} km/h, ${heading.toFixed(0)}°)`);
      
      // Send updated ETA if in emergency mode
      if (data.isEmergency && ambulance.destination) {
        const distance = calculateDistance(
          data.location.latitude, data.location.longitude,
          ambulance.destination.latitude, ambulance.destination.longitude
        );
        
        const eta = Date.now() + (distance / (speed / 3.6) * 1000); // Rough ETA calculation
        
        socket.emit('eta-update', {
          ambulanceId: ambulance.ambulanceId,
          newETA: eta,
          remainingDistance: distance * 1000, // meters
          estimatedDuration: (distance / (speed / 3.6)), // seconds
          timestamp: Date.now()
        });
      }
    }
  });

  // Emergency route calculation
  socket.on('emergency-route', (data) => {
    const ambulance = connectedAmbulances.get(socket.id);
    if (ambulance) {
      console.log(`🚨 Emergency route requested by ${ambulance.ambulanceId} to ${data.destination.name}`);
      
      ambulance.destination = data.destination;
      ambulance.isEmergency = true;
      
      // Calculate route
      const routeData = calculateRoute(data.currentLocation, data.destination.location || data.destination);
      
      // Clear traffic signals for high priority emergencies
      if (data.priority === 'high') {
        trafficSignals.forEach(signal => {
          signal.clearedFor = ambulance.ambulanceId;
          signal.status = 'cleared';
        });
      }
      
      // Send calculated route
      setTimeout(() => {
        socket.emit('route-calculated', {
          ambulanceId: ambulance.ambulanceId,
          route: routeData.route,
          trafficSignals: routeData.trafficSignals,
          eta: Date.now() + routeData.route.duration * 1000,
          timestamp: Date.now()
        });
      }, 2000); // Simulate calculation time
      
      // Simulate traffic signal clearance notifications
      if (data.priority === 'high') {
        let delay = 5000;
        trafficSignals.forEach(signal => {
          setTimeout(() => {
            socket.emit('signal-cleared', {
              signalId: signal.id,
              ambulanceId: ambulance.ambulanceId,
              location: signal.location,
              clearanceDuration: 120,
              timestamp: Date.now()
            });
          }, delay);
          delay += 3000;
        });
      }
    }
  });

  // Ping-pong for latency measurement
  socket.on('ping', (timestamp) => {
    socket.emit('pong', timestamp);
  });

  // Heartbeat
  socket.on('heartbeat', (data) => {
    const ambulance = connectedAmbulances.get(socket.id);
    if (ambulance) {
      ambulance.lastHeartbeat = Date.now();
      // console.log(`💓 Heartbeat from ${ambulance.ambulanceId}`);
    }
  });

  // Legacy event handlers for backward compatibility
  socket.on('ambulance:register', (data) => {
    socket.emit('register-ambulance', data);
  });

  socket.on('ambulance:location', (data) => {
    socket.emit('update-location', {
      ambulanceId: data.ambulanceId,
      location: data.location,
      timestamp: data.timestamp,
      isEmergency: false
    });
  });

  socket.on('ambulance:emergency', (data) => {
    const ambulance = connectedAmbulances.get(socket.id);
    if (ambulance) {
      ambulance.isEmergency = data.isEmergency;
      console.log(`🚨 Emergency ${data.isEmergency ? 'ACTIVATED' : 'DEACTIVATED'} for ${ambulance.ambulanceId}`);

      socket.emit('emergency:response', {
        status: 'acknowledged',
        isEmergency: data.isEmergency,
        trafficClearance: data.isEmergency ? 'requested' : 'released',
        message: data.isEmergency 
          ? 'Emergency mode activated. Traffic management system notified.'
          : 'Emergency mode deactivated. Normal traffic flow resumed.',
        timestamp: Date.now()
      });

      if (data.isEmergency) {
        // Simulate traffic clearance process
        socket.emit('traffic:clearance', {
          status: 'processing',
          message: 'Requesting priority traffic clearance...',
          estimatedClearanceTime: 30
        });

        setTimeout(() => {
          socket.emit('traffic:clearance', {
            status: 'active',
            message: 'Traffic signals cleared for priority passage',
            duration: 300
          });
        }, 3000);
      }
    }
  });

  socket.on('hospitals:request', (data) => {
    const { location, radius } = data;
    const nearbyHospitals = getNearbyHospitals(location, radius);
    
    console.log(`🏥 Hospital request from ${data.ambulanceId}: Found ${nearbyHospitals.length} hospitals`);
    
    socket.emit('hospitals:list', nearbyHospitals);
  });

  socket.on('ambulance:hospital_selected', (data) => {
    const ambulance = connectedAmbulances.get(socket.id);
    if (ambulance) {
      console.log(`🏥 Hospital selected by ${ambulance.ambulanceId}: ${data.hospital.name}`);
      
      ambulance.destination = data.hospital;
      
      socket.emit('server-message', {
        type: 'hospital_confirmed',
        message: `Destination set to ${data.hospital.name}. Calculating optimal route...`,
        hospital: data.hospital,
        timestamp: Date.now()
      });

      // Auto-calculate route to selected hospital
      if (ambulance.lastLocation) {
        setTimeout(() => {
          socket.emit('emergency-route', {
            ambulanceId: ambulance.ambulanceId,
            destination: {
              latitude: data.hospital.location.latitude,
              longitude: data.hospital.location.longitude,
              name: data.hospital.name,
              type: 'hospital'
            },
            currentLocation: ambulance.lastLocation,
            priority: ambulance.isEmergency ? 'high' : 'medium'
          });
        }, 1000);
      }
    }
  });

  socket.on('disconnect', (reason) => {
    const ambulance = connectedAmbulances.get(socket.id);
    if (ambulance) {
      console.log(`🚑 Ambulance ${ambulance.ambulanceId} disconnected (${reason})`);
      
      // Clear any traffic signals that were cleared for this ambulance
      trafficSignals.forEach(signal => {
        if (signal.clearedFor === ambulance.ambulanceId) {
          signal.clearedFor = null;
          signal.status = 'normal';
        }
      });
      
      connectedAmbulances.delete(socket.id);
    }
    console.log('Client disconnected:', socket.id, reason);
  });
});

// Enhanced route calculation with optimization
function calculateOptimizedRoute(start, destination, options = {}) {
  const {
    optimizeFor = 'time',
    avoidTraffic = true,
    isEmergency = false,
    avoidTolls = false,
    avoidHighways = false
  } = options;

  const baseDistance = calculateDistance(start.latitude, start.longitude, destination.latitude, destination.longitude);
  const distanceInMeters = baseDistance * 1000;

  // Calculate base duration based on route type
  let baseSpeed = 40; // km/h default
  if (isEmergency) {
    baseSpeed = avoidTraffic ? 65 : 55; // Emergency vehicles with/without traffic clearance
  } else if (avoidHighways) {
    baseSpeed = 35; // City roads
  } else if (!avoidTraffic) {
    baseSpeed = 50; // Highway with potential traffic
  }

  let duration = (baseDistance / baseSpeed) * 3600; // seconds

  // Apply optimization adjustments
  if (optimizeFor === 'distance' && !isEmergency) {
    // Take more direct route, potentially slower
    duration *= 1.1;
  } else if (optimizeFor === 'time' && avoidTraffic) {
    // Take faster route, potentially longer distance
    duration *= 0.9;
  }

  // Generate route points
  const numPoints = Math.max(8, Math.floor(baseDistance * 3));
  const polylineCoords = [];
  
  for (let i = 0; i <= numPoints; i++) {
    const ratio = i / numPoints;
    // Add some realistic curve to the route
    const curve = 0.001 * Math.sin(ratio * Math.PI * 2);
    const lat = start.latitude + (destination.latitude - start.latitude) * ratio + curve;
    const lng = start.longitude + (destination.longitude - start.longitude) * ratio + curve;
    polylineCoords.push({ latitude: lat, longitude: lng });
  }

  // Generate turn-by-turn steps
  const steps = generateRouteSteps(start, destination, polylineCoords, duration, isEmergency);

  // Generate traffic signals along route
  const signals = generateTrafficSignalsForRoute(start, destination, isEmergency);

  return {
    points: [
      { latitude: start.latitude, longitude: start.longitude, address: 'Starting Point' },
      { latitude: destination.latitude, longitude: destination.longitude, address: 'Destination' }
    ],
    steps,
    totalDistance: distanceInMeters,
    totalDuration: Math.round(duration),
    trafficSignals: signals,
    polylineCoords,
    optimization: {
      optimizedFor: optimizeFor,
      avoidedTraffic: avoidTraffic,
      emergencyRoute: isEmergency,
      estimatedFuelSaved: avoidTraffic ? '15%' : '0%',
      timeSaved: avoidTraffic ? Math.round(duration * 0.2) : 0
    }
  };
}

function generateRouteSteps(start, destination, polylineCoords, totalDuration, isEmergency) {
  const steps = [];
  const stepCount = Math.min(12, Math.max(4, Math.floor(polylineCoords.length / 3)));
  const streets = [
    'Main Street', 'Oak Avenue', 'First Street', 'Hospital Drive',
    'Medical Center Blvd', 'Emergency Lane', 'Health Plaza', 'Center Street',
    'University Way', 'Memorial Drive', 'Trauma Center Ave', 'Care Circle'
  ];
  const maneuvers = ['straight', 'left', 'right', 'merge', 'exit'];

  for (let i = 0; i < stepCount; i++) {
    const pointIndex = Math.floor((i / stepCount) * polylineCoords.length);
    const point = polylineCoords[Math.min(pointIndex, polylineCoords.length - 1)];
    
    const stepDistance = (calculateDistance(start.latitude, start.longitude, destination.latitude, destination.longitude) * 1000) / stepCount;
    const stepDuration = totalDuration / stepCount;

    let instruction;
    let maneuver;

    if (i === 0) {
      instruction = `Head ${getDirection(start, destination)} on ${streets[0]}`;
      maneuver = 'straight';
    } else if (i === stepCount - 1) {
      instruction = `Destination will be on your ${Math.random() > 0.5 ? 'right' : 'left'}`;
      maneuver = Math.random() > 0.5 ? 'right' : 'left';
    } else {
      maneuver = maneuvers[Math.floor(Math.random() * maneuvers.length)];
      const street = streets[i % streets.length];
      instruction = getManeuverInstruction(maneuver, street, stepDistance, isEmergency);
    }

    steps.push({
      instruction,
      distance: stepDistance,
      duration: stepDuration,
      maneuver,
      location: point,
      streetName: streets[i % streets.length]
    });
  }

  return steps;
}

function getDirection(start, destination) {
  const bearing = calculateBearing(start, destination);
  
  if (bearing >= 337.5 || bearing < 22.5) return 'north';
  if (bearing >= 22.5 && bearing < 67.5) return 'northeast';
  if (bearing >= 67.5 && bearing < 112.5) return 'east';
  if (bearing >= 112.5 && bearing < 157.5) return 'southeast';
  if (bearing >= 157.5 && bearing < 202.5) return 'south';
  if (bearing >= 202.5 && bearing < 247.5) return 'southwest';
  if (bearing >= 247.5 && bearing < 292.5) return 'west';
  return 'northwest';
}

function calculateBearing(start, end) {
  const startLat = start.latitude * Math.PI / 180;
  const startLng = start.longitude * Math.PI / 180;
  const endLat = end.latitude * Math.PI / 180;
  const endLng = end.longitude * Math.PI / 180;

  const dLng = endLng - startLng;
  const y = Math.sin(dLng) * Math.cos(endLat);
  const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);

  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
}

function getManeuverInstruction(maneuver, street, distance, isEmergency) {
  const distanceKm = (distance / 1000).toFixed(1);
  const prefix = isEmergency ? 'Continue with emergency signals to' : 'Proceed to';
  
  switch (maneuver) {
    case 'left':
      return `Turn left onto ${street}`;
    case 'right':
      return `Turn right onto ${street}`;
    case 'straight':
      return `Continue straight on ${street} for ${distanceKm}km`;
    case 'merge':
      return `Merge onto ${street}`;
    case 'exit':
      return `Take the exit toward ${street}`;
    default:
      return `Continue on ${street}`;
  }
}

function generateTrafficSignalsForRoute(start, destination, isEmergency) {
  const signals = [];
  const signalCount = Math.floor(Math.random() * 5) + 2; // 2-6 signals

  for (let i = 0; i < signalCount; i++) {
    const ratio = (i + 1) / (signalCount + 1);
    const lat = start.latitude + (destination.latitude - start.latitude) * ratio;
    const lng = start.longitude + (destination.longitude - start.longitude) * ratio;

    let status = 'normal';
    let clearanceTime = null;
    let estimatedWait = null;

    if (isEmergency) {
      // Emergency vehicles get priority
      status = Math.random() > 0.2 ? 'cleared' : 'pending';
      if (status === 'cleared') {
        clearanceTime = Math.floor(Math.random() * 90) + 60; // 60-150 seconds
      } else {
        estimatedWait = Math.floor(Math.random() * 30) + 10; // 10-40 seconds
      }
    } else {
      // Regular traffic patterns
      const rand = Math.random();
      if (rand > 0.7) status = 'normal';
      else if (rand > 0.3) status = 'pending';
      else status = 'cleared';
      
      if (status === 'normal') {
        estimatedWait = Math.floor(Math.random() * 60) + 20; // 20-80 seconds
      }
    }

    signals.push({
      id: `signal_route_${Date.now()}_${i}`,
      location: { latitude: lat, longitude: lng },
      status,
      clearanceTime,
      estimatedWait
    });
  }

  return signals;
}

// Hospital API endpoints
app.get('/hospitals', (req, res) => {
  try {
    const { lat, lng, radius = 25, emergencyOnly, sortBy = 'distance' } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const userLocation = { latitude: parseFloat(lat), longitude: parseFloat(lng) };
    const searchRadius = parseFloat(radius);

    let hospitals = mockHospitals.map(hospital => ({
      ...hospital,
      distance: calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        hospital.location.latitude,
        hospital.location.longitude
      )
    })).filter(hospital => hospital.distance <= searchRadius);

    // Apply emergency filter if requested
    if (emergencyOnly === 'true') {
      hospitals = hospitals.filter(h => h.emergencyServices);
    }

    // Sort hospitals
    switch (sortBy) {
      case 'distance':
        hospitals.sort((a, b) => a.distance - b.distance);
        break;
      case 'capacity':
        hospitals.sort((a, b) => {
          const aAvailability = ((a.capacity - a.currentLoad) / a.capacity) * 100;
          const bAvailability = ((b.capacity - b.currentLoad) / b.capacity) * 100;
          return bAvailability - aAvailability;
        });
        break;
      case 'rating':
        hospitals.sort((a, b) => b.rating - a.rating);
        break;
      default:
        hospitals.sort((a, b) => a.distance - b.distance);
    }

    res.json(hospitals);
  } catch (error) {
    console.error('Hospital search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route calculation API endpoint
app.post('/calculate-route', (req, res) => {
  try {
    const { start, destination, options = {} } = req.body;
    
    if (!start || !destination) {
      return res.status(400).json({ error: 'Start and destination locations are required' });
    }

    if (!start.latitude || !start.longitude || !destination.latitude || !destination.longitude) {
      return res.status(400).json({ error: 'Invalid location coordinates' });
    }

    const route = calculateOptimizedRoute(start, destination, options);
    
    console.log(`🗺️ Route calculated: ${route.totalDistance}m, ${Math.round(route.totalDuration/60)}min, ${options.isEmergency ? 'EMERGENCY' : 'normal'}`);
    
    res.json(route);
  } catch (error) {
    console.error('Route calculation error:', error);
    res.status(500).json({ error: 'Failed to calculate route' });
  }
});

// Hospital search API endpoint
app.get('/hospitals/search', (req, res) => {
  try {
    const { q, lat, lng, radius = 50 } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const query = q.toLowerCase();
    let hospitals = mockHospitals;

    // Add distance if location provided
    if (lat && lng) {
      const userLocation = { latitude: parseFloat(lat), longitude: parseFloat(lng) };
      hospitals = hospitals.map(hospital => ({
        ...hospital,
        distance: calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          hospital.location.latitude,
          hospital.location.longitude
        )
      })).filter(hospital => hospital.distance <= parseFloat(radius));
    }

    // Filter by search query
    const filteredHospitals = hospitals.filter(hospital =>
      hospital.name.toLowerCase().includes(query) ||
      hospital.type.toLowerCase().includes(query) ||
      hospital.facilities.some(facility =>
        facility.toLowerCase().includes(query)
      ) ||
      hospital.address.toLowerCase().includes(query)
    );

    // Sort by distance if location provided
    if (lat && lng) {
      filteredHospitals.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    }

    res.json(filteredHospitals);
  } catch (error) {
    console.error('Hospital search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

app.get('/', (req, res) => {
  res.json({
    service: 'Ambulance Tracking Server',
    status: 'running',
    connectedAmbulances: connectedAmbulances.size,
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

app.get('/status', (req, res) => {
  const ambulances = Array.from(connectedAmbulances.values()).map(amb => ({
    ambulanceId: amb.ambulanceId,
    isEmergency: amb.isEmergency,
    hasLocation: !!amb.lastLocation,
    connectedAt: amb.connectedAt
  }));

  res.json({
    server: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    },
    ambulances,
    hospitals: mockHospitals.length
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚑 Ambulance Tracking Server running on port ${PORT}`);
  console.log(`📊 Status endpoint: http://10.144.117.52:${PORT}/status`);
  console.log(`🔌 WebSocket endpoint: ws://10.144.117.52:${PORT}`);
  console.log(`📱 Configure your mobile app to connect to: ws://10.144.117.52:${PORT}`);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  connectedAmbulances.clear();
  server.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
});