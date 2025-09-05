// Mock geolocation for web testing
const mockLocation = {
  latitude: 37.7749,
  longitude: -122.4194,
  accuracy: 10,
};

export default {
  getCurrentPosition: (success, error, options) => {
    setTimeout(() => {
      success({
        coords: mockLocation,
        timestamp: Date.now(),
      });
    }, 1000);
  },
  
  watchPosition: (success, error, options) => {
    const watchId = setInterval(() => {
      success({
        coords: {
          ...mockLocation,
          latitude: mockLocation.latitude + (Math.random() - 0.5) * 0.01,
          longitude: mockLocation.longitude + (Math.random() - 0.5) * 0.01,
        },
        timestamp: Date.now(),
      });
    }, 5000);
    
    return watchId;
  },
  
  clearWatch: (watchId) => {
    clearInterval(watchId);
  },
  
  requestAuthorization: (success, error) => {
    setTimeout(success, 100);
  },
};
