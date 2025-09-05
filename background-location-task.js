import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

const BACKGROUND_LOCATION_TASK = 'background-location-task';

// Define the background location task
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, ({ data, error }) => {
  if (error) {
    console.error('Background location task error:', error);
    return;
  }

  if (data) {
    const { locations } = data;
    console.log('Background location update:', locations);
    
    // Here you could send the location to your server
    // or save it to local storage for later processing
    locations.forEach(location => {
      // Process each location update
      console.log('Background location:', {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: location.timestamp,
        accuracy: location.coords.accuracy,
      });
    });
  }
});

export default BACKGROUND_LOCATION_TASK;